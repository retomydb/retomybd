#!/usr/bin/env python3
"""Sequential import with proper rate limiting and retry.

Picks up where previous runs left off (skips existing slugs).
"""
import sys, os, time, requests, json
sys.path.insert(0, os.path.dirname(__file__))

from scraper.hf_client import HFClient
from scraper.importer import HFImporter
import pyodbc

OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"
CONN_STR = (
    'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;'
    'DATABASE=retomY;UID=sa;PWD=Prestige@123;'
    'TrustServerCertificate=yes;Encrypt=yes'
)

CATEGORIES = [
    ("text-generation", 300), ("text2text-generation", 100),
    ("text-classification", 200), ("token-classification", 100),
    ("question-answering", 100), ("summarization", 80),
    ("translation", 80), ("fill-mask", 80), ("conversational", 60),
    ("zero-shot-classification", 50), ("sentence-similarity", 80),
    ("feature-extraction", 100), ("table-question-answering", 30),
    ("image-classification", 150), ("object-detection", 80),
    ("image-segmentation", 80), ("image-to-text", 60),
    ("text-to-image", 150), ("image-to-image", 60),
    ("depth-estimation", 40), ("unconditional-image-generation", 30),
    ("video-classification", 30), ("visual-question-answering", 40),
    ("document-question-answering", 40), ("image-feature-extraction", 30),
    ("automatic-speech-recognition", 100), ("text-to-speech", 60),
    ("audio-classification", 60), ("audio-to-audio", 30),
    ("text-to-video", 40), ("image-text-to-text", 60),
    ("reinforcement-learning", 60), ("tabular-classification", 30),
    ("tabular-regression", 20), ("mask-generation", 20),
    ("any-to-any", 20),
]


def get_existing_slugs():
    conn = pyodbc.connect(CONN_STR)
    c = conn.cursor()
    c.execute("SELECT Slug FROM retomy.Repositories WHERE RepoType = 'model'")
    slugs = {r[0] for r in c.fetchall()}
    conn.close()
    return slugs


def fetch_ids(task, limit):
    try:
        r = requests.get("https://huggingface.co/api/models",
                         params={"pipeline_tag": task, "sort": "downloads", "limit": str(limit)},
                         timeout=20)
        r.raise_for_status()
        return [(m["id"], task) for m in r.json() if m.get("id")]
    except Exception as e:
        print(f"  WARN fetch {task}: {e}", flush=True)
        return []


def import_model(importer, model_id, task, existing):
    """Import one model with retry on 429."""
    slug = model_id.replace('/', '-').lower()
    if slug in existing:
        return "skip"

    for attempt in range(5):
        try:
            repo_row, meta_row = importer.prepare_rows(model_id)
            repo_row["OwnerId"] = OWNER_ID
            from scraper import db
            db.insert_into_table('Repositories', repo_row)
            db.insert_into_table('ModelMetadata', meta_row)
            existing.add(slug)
            fw = meta_row.get('Framework') or '-'
            lib = meta_row.get('Library') or '-'
            params = meta_row.get('ParameterCount')
            readme = 'Y' if meta_row.get('GithubReadme') else 'N'
            return f"ok fw={fw} lib={lib} params={params} readme={readme}"
        except Exception as e:
            es = str(e)
            if "429" in es:
                wait = 2 ** attempt * 2  # 2, 4, 8, 16, 32 sec
                print(f"    rate limited, waiting {wait}s...", flush=True)
                time.sleep(wait)
                continue
            if "UNIQUE" in es or "duplicate" in es.lower():
                existing.add(slug)
                return "dup"
            return f"ERR: {es[:100]}"
    return "ERR: max retries exceeded (429)"


def main():
    print("=" * 60, flush=True)
    print("retomY Sequential Import (rate-limit safe)", flush=True)
    print("=" * 60, flush=True)

    existing = get_existing_slugs()
    print(f"Already in DB: {len(existing)} models\n", flush=True)

    # Collect IDs
    all_models = []
    seen = set()
    for task, count in CATEGORIES:
        ids = fetch_ids(task, count)
        new = [(mid, t) for mid, t in ids if mid not in seen]
        for mid, _ in new:
            seen.add(mid)
        all_models.extend(new)
        print(f"  {task:<40} {len(new):>4}", flush=True)
        time.sleep(0.2)

    if len(all_models) > 3000:
        all_models = all_models[:3000]

    to_import = [(m, t) for m, t in all_models if m.replace('/', '-').lower() not in existing]
    print(f"\nTotal unique: {len(all_models)}", flush=True)
    print(f"To import: {len(to_import)}", flush=True)
    print(f"\nStarting import...\n", flush=True)

    importer = HFImporter()
    ok = 0
    fail = 0
    skip = 0
    start = time.time()

    for i, (mid, task) in enumerate(to_import):
        result = import_model(importer, mid, task, existing)
        if result == "skip" or result == "dup":
            skip += 1
        elif result.startswith("ok"):
            ok += 1
            print(f"[{ok}] {mid} ({task}) {result}", flush=True)
        else:
            fail += 1
            print(f"FAIL {mid}: {result}", flush=True)

        # Progress every 100
        if (ok + fail) % 100 == 0 and (ok + fail) > 0:
            elapsed = time.time() - start
            rate = (ok + fail) / elapsed
            remaining = (len(to_import) - i) / max(rate, 0.1)
            print(f"\n--- Progress: {ok} ok, {fail} fail, {skip} skip | "
                  f"{rate:.1f}/s | ~{remaining/60:.0f}min left ---\n", flush=True)

        # Pace: ~0.5s between models keeps us under HF rate limits
        time.sleep(0.5)

    elapsed = time.time() - start
    print(f"\n{'=' * 60}", flush=True)
    print(f"DONE in {elapsed/60:.1f} min", flush=True)
    print(f"  Inserted: {ok}", flush=True)
    print(f"  Failed:   {fail}", flush=True)
    print(f"  Skipped:  {skip}", flush=True)

    final = get_existing_slugs()
    print(f"  Total in DB: {len(final)}", flush=True)
    print("=" * 60, flush=True)


if __name__ == "__main__":
    main()
