#!/usr/bin/env python3
"""Fast parallel bulk import of HuggingFace models into retomY.

Uses ThreadPoolExecutor for 10x speedup over sequential import.
Skips models already in the database.

Usage:
    python3 fast_import.py          # run it
"""
import sys
import os
import json
import time
import threading
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))

from scraper.hf_client import HFClient
from scraper.importer import HFImporter

OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"
MAX_WORKERS = 3  # parallel threads — conservative to avoid HF rate limits

CATEGORIES = [
    ("text-generation", 300),
    ("text2text-generation", 100),
    ("text-classification", 200),
    ("token-classification", 100),
    ("question-answering", 100),
    ("summarization", 80),
    ("translation", 80),
    ("fill-mask", 80),
    ("conversational", 60),
    ("zero-shot-classification", 50),
    ("sentence-similarity", 80),
    ("feature-extraction", 100),
    ("table-question-answering", 30),
    ("image-classification", 150),
    ("object-detection", 80),
    ("image-segmentation", 80),
    ("image-to-text", 60),
    ("text-to-image", 150),
    ("image-to-image", 60),
    ("depth-estimation", 40),
    ("unconditional-image-generation", 30),
    ("video-classification", 30),
    ("visual-question-answering", 40),
    ("document-question-answering", 40),
    ("image-feature-extraction", 30),
    ("automatic-speech-recognition", 100),
    ("text-to-speech", 60),
    ("audio-classification", 60),
    ("audio-to-audio", 30),
    ("text-to-video", 40),
    ("image-text-to-text", 60),
    ("reinforcement-learning", 60),
    ("tabular-classification", 30),
    ("tabular-regression", 20),
    ("mask-generation", 20),
    ("any-to-any", 20),
]

# Thread-safe counters
lock = threading.Lock()
success_count = 0
fail_count = 0
skip_count = 0


def get_existing_slugs():
    """Get slugs already in the DB to avoid duplicates."""
    import pyodbc
    conn = pyodbc.connect(
        'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;'
        'DATABASE=retomY;UID=sa;PWD=Prestige@123;'
        'TrustServerCertificate=yes;Encrypt=yes'
    )
    cursor = conn.cursor()
    cursor.execute("SELECT Slug FROM retomy.Repositories WHERE RepoType = 'model'")
    slugs = {r[0] for r in cursor.fetchall()}
    conn.close()
    return slugs


def fetch_model_ids(task, limit):
    """Fetch model IDs for a task from HF API."""
    try:
        r = requests.get(
            "https://huggingface.co/api/models",
            params={"pipeline_tag": task, "sort": "downloads", "limit": str(limit)},
            timeout=20,
        )
        r.raise_for_status()
        return [(m["id"], task) for m in r.json() if m.get("id")]
    except Exception as e:
        print(f"  [WARN] Failed to fetch {task}: {e}")
        return []


def import_one_model(model_id, task, existing_slugs):
    """Import a single model. Thread-safe. Retries on rate limit."""
    global success_count, fail_count, skip_count

    slug = model_id.replace('/', '-').lower()
    if slug in existing_slugs:
        with lock:
            skip_count += 1
        return "skip", model_id, "already exists"

    max_retries = 4
    for attempt in range(max_retries):
        try:
            importer = HFImporter()
            repo_row, meta_row = importer.prepare_rows(model_id)
            repo_row["OwnerId"] = OWNER_ID

            from scraper import db
            db.insert_into_table('Repositories', repo_row)
            db.insert_into_table('ModelMetadata', meta_row)

            # Add to existing slugs to prevent dupes within this run
            with lock:
                existing_slugs.add(slug)
                success_count += 1
                n = success_count
            
            fw = meta_row.get('Framework') or '—'
            lib = meta_row.get('Library') or '—'
            params = meta_row.get('ParameterCount')
            readme = 'yes' if meta_row.get('GithubReadme') else 'no'
            print(f"  ✓ [{n}] {model_id} ({task}) fw={fw} lib={lib} params={params} readme={readme}", flush=True)
            return "ok", model_id, None

        except Exception as e:
            err_str = str(e)
            if "429" in err_str and attempt < max_retries - 1:
                wait = (attempt + 1) * 5  # 5s, 10s, 15s backoff
                time.sleep(wait)
                continue
            elif "duplicate" in err_str.lower() or "UNIQUE" in err_str:
                with lock:
                    existing_slugs.add(slug)
                    skip_count += 1
                return "skip", model_id, "duplicate"
            else:
                with lock:
                    fail_count += 1
                err = err_str.split('\n')[0][:120]
                print(f"  ✗ {model_id}: {err}", flush=True)
                return "error", model_id, err_str


def main():
    global success_count, fail_count, skip_count

    print("=" * 70)
    print("retomY FAST Parallel HuggingFace Import")
    print(f"Workers: {MAX_WORKERS} threads")
    print(f"Owner:   {OWNER_ID}")
    print("=" * 70)

    # Phase 1: Get existing slugs
    print("\nLoading existing models from DB...")
    existing_slugs = get_existing_slugs()
    print(f"  {len(existing_slugs)} models already in DB (will skip)\n")

    # Phase 2: Collect all model IDs
    print("Collecting model IDs from HuggingFace API...")
    all_models = []
    seen = set()
    for task, count in CATEGORIES:
        ids = fetch_model_ids(task, count)
        new = []
        for mid, t in ids:
            if mid not in seen:
                seen.add(mid)
                new.append((mid, t))
        all_models.extend(new)
        print(f"  {task:<45} {len(new):>4} models")
        time.sleep(0.15)

    # Cap at 3000
    if len(all_models) > 3000:
        all_models = all_models[:3000]

    to_import = [(mid, t) for mid, t in all_models
                 if mid.replace('/', '-').lower() not in existing_slugs]

    print(f"\n  Total unique: {len(all_models)}")
    print(f"  Already in DB: {len(all_models) - len(to_import)}")
    print(f"  To import: {len(to_import)}")

    # Phase 3: Parallel import
    print(f"\nImporting {len(to_import)} models with {MAX_WORKERS} threads...\n")
    start = time.time()
    errors = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {}
        for mid, task in to_import:
            f = pool.submit(import_one_model, mid, task, existing_slugs)
            futures[f] = (mid, task)
            time.sleep(0.15)  # stagger submissions to avoid burst rate limits
        for future in as_completed(futures):
            status, mid, err = future.result()
            if status == "error":
                errors.append((mid, err))

    elapsed = time.time() - start

    # Summary
    print(f"\n{'=' * 70}")
    print(f"IMPORT COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"  Succeeded: {success_count}")
    print(f"  Failed:    {fail_count}")
    print(f"  Skipped:   {skip_count} (already in DB)")
    print(f"  Total:     {success_count + fail_count + skip_count}")
    print(f"  Speed:     {(success_count + fail_count) / max(elapsed, 1):.1f} models/sec")
    print(f"{'=' * 70}")

    if errors:
        print(f"\nFailed models ({len(errors)}):")
        for mid, err in errors[:20]:
            print(f"  - {mid}: {err[:100]}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")

    # Final DB count
    try:
        final_slugs = get_existing_slugs()
        print(f"\nTotal models now in DB: {len(final_slugs)}")
    except:
        pass


if __name__ == "__main__":
    main()
