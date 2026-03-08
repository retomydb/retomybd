#!/usr/bin/env python3
"""Bulk import 3000 HuggingFace models across all major categories into retomY.

Usage:
    python3 bulk_import.py              # dry-run
    python3 bulk_import.py --apply      # actually insert into DB
"""
import sys
import os
import json
import time
import requests
import argparse

# Add parent dir so we can import scraper package
sys.path.insert(0, os.path.dirname(__file__))

from scraper.hf_client import HFClient
from scraper.importer import HFImporter

OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"

# ── Categories and how many models to fetch per category ──────────────────────
# Total target: 3000 models across all major ML task categories
CATEGORIES = [
    # NLP - Text
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
    # Vision
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
    # Audio
    ("automatic-speech-recognition", 100),
    ("text-to-speech", 60),
    ("audio-classification", 60),
    ("audio-to-audio", 30),
    # Multimodal
    ("text-to-video", 40),
    ("image-text-to-text", 60),
    # RL & Tabular
    ("reinforcement-learning", 60),
    ("tabular-classification", 30),
    ("tabular-regression", 20),
    # Other
    ("mask-generation", 20),
    ("any-to-any", 20),
]

# Sum check
TOTAL_TARGET = sum(count for _, count in CATEGORIES)


def fetch_model_ids_for_task(task: str, limit: int) -> list[str]:
    """Fetch top model IDs for a given pipeline_tag from HF API."""
    url = "https://huggingface.co/api/models"
    params = {
        "pipeline_tag": task,
        "sort": "downloads",
        "limit": str(limit),
    }
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        models = r.json()
        return [m["id"] for m in models if m.get("id")]
    except Exception as e:
        print(f"  [WARN] Failed to fetch list for {task}: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description="Bulk import 3000 HF models")
    parser.add_argument("--apply", action="store_true", help="Actually insert into DB (default: dry-run)")
    parser.add_argument("--resume-from", type=int, default=0, help="Skip first N models (for resuming)")
    args = parser.parse_args()

    print(f"{'='*70}")
    print(f"retomY Bulk HuggingFace Model Import")
    print(f"Target: ~{TOTAL_TARGET} models across {len(CATEGORIES)} categories")
    print(f"Owner:  {OWNER_ID}")
    print(f"Mode:   {'LIVE INSERT' if args.apply else 'DRY RUN'}")
    print(f"{'='*70}\n")

    # Phase 1: Collect all model IDs across categories
    print("Phase 1: Collecting model IDs from HuggingFace API...\n")
    all_ids = []
    seen = set()
    category_counts = {}

    for task, target_count in CATEGORIES:
        ids = fetch_model_ids_for_task(task, target_count)
        new_ids = []
        for mid in ids:
            if mid not in seen:
                seen.add(mid)
                new_ids.append((mid, task))
        all_ids.extend(new_ids)
        category_counts[task] = len(new_ids)
        print(f"  {task:<45} {len(new_ids):>4} models (fetched {len(ids)})")
        time.sleep(0.2)  # Be nice to HF API

    print(f"\n  Total unique models collected: {len(all_ids)}")

    # Trim to exactly 3000 if we got more
    if len(all_ids) > 3000:
        all_ids = all_ids[:3000]
        print(f"  Trimmed to 3000 models")

    # Phase 2: Import each model
    print(f"\nPhase 2: {'Importing' if args.apply else 'Processing (dry-run)'}...\n")

    importer = HFImporter()
    success = 0
    failed = 0
    skipped = 0

    # Save progress periodically
    progress_file = os.path.join(os.path.dirname(__file__), "import_progress.json")

    for i, (model_id, task) in enumerate(all_ids):
        if i < args.resume_from:
            skipped += 1
            continue

        try:
            print(f"[{i+1}/{len(all_ids)}] {model_id} ({task})...", end=" ", flush=True)

            repo_row, meta_row = importer.prepare_rows(model_id)

            if args.apply:
                repo_row["OwnerId"] = OWNER_ID
                from scraper import db
                db.insert_into_table('Repositories', repo_row)
                db.insert_into_table('ModelMetadata', meta_row)
                print(f"✓ inserted (fw={meta_row['Framework']}, lib={meta_row['Library']}, "
                      f"params={meta_row['ParameterCount']}, readme={'yes' if meta_row['GithubReadme'] else 'no'})")
            else:
                print(f"✓ ok (fw={meta_row['Framework']}, lib={meta_row['Library']}, "
                      f"params={meta_row['ParameterCount']}, readme={'yes' if meta_row['GithubReadme'] else 'no'})")

            success += 1

            # Save progress every 50 models
            if args.apply and success % 50 == 0:
                with open(progress_file, "w") as f:
                    json.dump({"last_index": i, "success": success, "failed": failed}, f)

            # Rate limit: ~2 requests per model (API + README), be nice
            time.sleep(0.3)

        except Exception as e:
            print(f"✗ error: {e}")
            failed += 1
            # Don't stop on individual failures
            time.sleep(0.5)

    # Final summary
    print(f"\n{'='*70}")
    print(f"IMPORT COMPLETE")
    print(f"  Succeeded:  {success}")
    print(f"  Failed:     {failed}")
    print(f"  Skipped:    {skipped}")
    print(f"  Total:      {success + failed + skipped}")
    print(f"{'='*70}")

    # Category breakdown
    print(f"\nCategory Breakdown:")
    for task, count in category_counts.items():
        print(f"  {task:<45} {count:>4} models")


if __name__ == "__main__":
    main()
