#!/usr/bin/env python3
"""Mass importer to reach a large target (20k) using existing HFClient/Importer.

This script preserves the current method of fetching from Hugging Face (requests
to the /api/models endpoint via HFClient) and adds robust, resumable collection
and import logic with persistent state, exponential backoff on 429s, and safe
pacing to avoid triggering rate limits.

Usage: run from `scraper/` directory. It creates `mass_state.json` and logs to
`mass_import.log` when run with nohup.
"""
import os
import sys
import time
import json
import math
import random
from pathlib import Path
from typing import Set, List, Tuple

sys.path.insert(0, os.path.dirname(__file__))

import requests
import pyodbc

from scraper.hf_client import HFClient
from scraper.importer import HFImporter

# Config
TARGET = 20000
OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"
CONN_STR = (
    'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;'
    'DATABASE=retomY;UID=sa;PWD=Prestige@123;'
    'TrustServerCertificate=yes;Encrypt=yes'
)

STATE_PATH = Path("mass_state.json")

# Categories and per-category attempt size (we request up to `LIMIT` each call)
CATEGORIES = [
    ("text-generation", 2000), ("text2text-generation", 1000),
    ("text-classification", 1500), ("token-classification", 1000),
    ("question-answering", 1000), ("summarization", 800),
    ("translation", 800), ("fill-mask", 800), ("conversational", 600),
    ("zero-shot-classification", 500), ("sentence-similarity", 800),
    ("feature-extraction", 1000), ("table-question-answering", 400),
    ("image-classification", 1500), ("object-detection", 1000),
    ("image-segmentation", 1000), ("image-to-text", 800),
    ("text-to-image", 1500), ("image-to-image", 800),
    ("depth-estimation", 400), ("unconditional-image-generation", 400),
    ("video-classification", 400), ("visual-question-answering", 600),
    ("document-question-answering", 400), ("image-feature-extraction", 400),
    ("automatic-speech-recognition", 1000), ("text-to-speech", 600),
    ("audio-classification", 600), ("audio-to-audio", 400),
    ("text-to-video", 400), ("image-text-to-text", 600),
    ("reinforcement-learning", 400), ("tabular-classification", 300),
    ("tabular-regression", 200), ("mask-generation", 200), ("any-to-any", 200),
]


def get_existing_slugs() -> Set[str]:
    conn = pyodbc.connect(CONN_STR)
    c = conn.cursor()
    c.execute("SELECT Slug FROM retomy.Repositories WHERE RepoType = 'model'")
    slugs = {r[0] for r in c.fetchall()}
    conn.close()
    return slugs


def save_state(state: dict):
    with STATE_PATH.open('w', encoding='utf8') as f:
        json.dump(state, f, indent=2)


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding='utf8'))
    except Exception:
        return {}


def fetch_ids_for_task(task: str, limit: int, session: requests.Session) -> List[str]:
    """Fetch model ids for a pipeline tag with retries/backoff on 429s."""
    url = "https://huggingface.co/api/models"
    for attempt in range(6):
        try:
            r = session.get(url, params={"pipeline_tag": task, "sort": "downloads", "limit": str(limit)}, timeout=30)
            r.raise_for_status()
            js = r.json()
            return [m.get('id') for m in js if m.get('id')]
        except Exception as e:
            es = str(e)
            # Backoff on rate limits or transient errors
            if '429' in es or 'Too Many Requests' in es:
                wait = (2 ** attempt) * 5
                print(f"  WARN fetch {task}: 429, waiting {wait}s...", flush=True)
                time.sleep(wait)
                continue
            # Other transient network errors
            wait = (2 ** attempt)
            print(f"  WARN fetch {task}: {es[:120]}, retry in {wait}s", flush=True)
            time.sleep(wait)
    print(f"  ERROR fetch {task}: all retries failed", flush=True)
    return []


def db_insert(table: str, row: dict):
    conn = pyodbc.connect(CONN_STR)
    c = conn.cursor()
    cols = ', '.join(row.keys())
    placeholders = ', '.join(['?'] * len(row))
    sql = f"INSERT INTO retomy.{table} ({cols}) VALUES ({placeholders})"
    c.execute(sql, list(row.values()))
    conn.commit()
    conn.close()


def import_model(importer: HFImporter, model_id: str, existing: Set[str]) -> Tuple[bool, str]:
    slug = model_id.replace('/', '-').lower()
    if slug in existing:
        return True, 'skip'

    for attempt in range(6):
        try:
            repo_row, meta_row = importer.prepare_rows(model_id)
            repo_row['OwnerId'] = OWNER_ID
            db_insert('Repositories', repo_row)
            db_insert('ModelMetadata', meta_row)
            existing.add(slug)
            return True, 'ok'
        except Exception as e:
            es = str(e)
            if '429' in es or 'Too Many Requests' in es:
                wait = (2 ** attempt) * 5
                print(f"    rate limited on {model_id}, waiting {wait}s...", flush=True)
                time.sleep(wait)
                continue
            if 'UNIQUE' in es or 'duplicate' in es.lower():
                existing.add(slug)
                return True, 'dup'
            return False, es[:200]
    return False, 'max retries exceeded (429)'


def main():
    print('=' * 60, flush=True)
    print('retomY Mass Import (resumable, conservative)', flush=True)
    print('=' * 60, flush=True)

    state = load_state()
    existing = get_existing_slugs()
    collected = set(state.get('collected', []))
    imported = set(state.get('imported', []))
    print(f'Already in DB: {len(existing)} models', flush=True)
    print(f'Previously collected IDs: {len(collected)}', flush=True)
    print(f'Previously imported: {len(imported)}', flush=True)

    session = requests.Session()
    hf = HFClient()
    importer = HFImporter()

    # Phase 1: collect until we have TARGET unique candidate ids
    passes = 0
    while len(collected) + len(existing) < TARGET and passes < 200:
        passes += 1
        print(f'Collect pass {passes} | collected={len(collected)} | in_db={len(existing)}', flush=True)
        for task, limit in CATEGORIES:
            ids = fetch_ids_for_task(task, limit, session)
            new = 0
            for mid in ids:
                if not mid:
                    continue
                slug = mid.replace('/', '-').lower()
                if slug in existing:
                    continue
                if mid not in collected:
                    collected.add(mid)
                    new += 1
            print(f'  {task:<40} {new:>4} new', flush=True)
            # safe pause between category calls
            time.sleep(0.8 + random.random() * 0.6)
            # save progress intermittently
            state['collected'] = list(collected)
            save_state(state)
            if len(collected) + len(existing) >= TARGET:
                break
        # If a pass yields no new IDs, wait longer to avoid hammering HF
        if new == 0:
            print('No new ids this pass; sleeping 60s before next pass', flush=True)
            time.sleep(60)

    print(f'Collection complete: collected={len(collected)} | in_db={len(existing)}', flush=True)

    # Build import queue (preserve order)
    queue = [m for m in list(collected) if m.replace('/', '-').lower() not in existing]
    print(f'To import: {len(queue)} models', flush=True)

    # Phase 2: import sequentially with resume support
    ok = 0
    fail = 0
    skip = 0
    start = time.time()

    for i, mid in enumerate(queue):
        # persist every 10 imports
        if i % 10 == 0:
            state['collected'] = list(collected)
            state['imported'] = list(imported)
            save_state(state)

        success, note = import_model(importer, mid, existing)
        if success:
            if note == 'skip' or note == 'dup':
                skip += 1
            else:
                ok += 1
                imported.add(mid)
        else:
            fail += 1
            print(f'FAIL {mid}: {note}', flush=True)

        # pacing to keep HF happy
        time.sleep(0.5)

        # quick progress print
        if (ok + fail) % 50 == 0 and (ok + fail) > 0:
            elapsed = time.time() - start
            rate = (ok + fail) / max(elapsed, 1)
            remaining = max(0, len(queue) - i - 1)
            print(f'--- Progress: {ok} ok, {fail} fail, {skip} skip | {rate:.2f}/s | ~{remaining/60:.0f}min left ---', flush=True)

    # final save
    state['collected'] = list(collected)
    state['imported'] = list(imported)
    save_state(state)

    elapsed = time.time() - start
    print('\n' + '=' * 60, flush=True)
    print(f'DONE: Inserted={ok} Failed={fail} Skipped={skip} in {elapsed/60:.1f} min', flush=True)
    print(f'Total in DB now: {len(get_existing_slugs())}', flush=True)
    print('=' * 60, flush=True)


if __name__ == '__main__':
    main()
