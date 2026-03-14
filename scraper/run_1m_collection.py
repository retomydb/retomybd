#!/usr/bin/env python3
"""
Full 1M Collection Orchestrator
================================
Runs the complete pipeline:
  Phase 1: Discover ML/AI repos via GitHub Search API
  Phase 2: Dedup against existing DB repos
  Phase 3: Enqueue new repos to Redis
  Phase 4: Process (insert + sync metadata) via workers

Usage:
  # Full run (all phases)
  python scraper/run_1m_collection.py --token-file scraper/.githubtokens

  # Skip discovery (use existing JSONL)
  python scraper/run_1m_collection.py --token-file scraper/.githubtokens --skip-discovery

  # Just discover
  python scraper/run_1m_collection.py --token-file scraper/.githubtokens --discovery-only

  # Custom target
  python scraper/run_1m_collection.py --token-file scraper/.githubtokens --target 50000

Estimated times (40 tokens):
  Discovery:   ~1-3 hours (depends on query count)
  Processing:  ~15 hours for 1M repos (3 API calls/repo × 1M ÷ 200K req/hr)
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path

VENV_PYTHON = sys.executable  # Use same Python as invoked

def run(cmd, description, timeout=None):
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"  Command: {' '.join(cmd)}")
    print(f"{'='*60}\n")
    start = time.time()
    result = subprocess.run(cmd, timeout=timeout)
    elapsed = time.time() - start
    print(f"\n  Completed in {elapsed/60:.1f} min (exit code {result.returncode})")
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description="1M GitHub ML repo collection orchestrator")
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--target", type=int, default=1_000_000)
    parser.add_argument("--discovery-strategy", default="full",
                        choices=["full", "topics", "keywords", "dates", "filenames"])
    parser.add_argument("--skip-discovery", action="store_true",
                        help="Skip Phase 1, use existing discovered_repos.jsonl")
    parser.add_argument("--discovery-only", action="store_true",
                        help="Only run Phase 1 (discovery)")
    parser.add_argument("--redis-url", default="redis://localhost:6379/0")
    parser.add_argument("--queue", default="github_repos")
    parser.add_argument("--worker-max-jobs", type=int, default=0,
                        help="Max jobs per worker run (0=unlimited)")
    parser.add_argument("--discovered-file", default="scraper/discovered_repos.jsonl")
    parser.add_argument("--deduped-file", default="scraper/new_candidates.jsonl")

    args = parser.parse_args()

    discovered = Path(args.discovered_file)
    deduped = Path(args.deduped_file)

    print(f"""
╔══════════════════════════════════════════════════════════╗
║         retomY 1M GitHub Collection Pipeline            ║
╠══════════════════════════════════════════════════════════╣
║  Target:     {args.target:>10,} repos                         ║
║  Tokens:     {args.token_file:<40} ║
║  Strategy:   {args.discovery_strategy:<40} ║
║  Redis:      {args.redis_url:<40} ║
╚══════════════════════════════════════════════════════════╝
""")

    overall_start = time.time()

    # ── Phase 1: Discovery ──────────────────────────────────────────
    if not args.skip_discovery:
        rc = run(
            [VENV_PYTHON, "scraper/discover_github_repos.py",
             "--token-file", args.token_file,
             "--output", args.discovered_file,
             "--target", str(args.target),
             "--strategy", args.discovery_strategy],
            f"Phase 1: Discovering up to {args.target:,} ML/AI repos",
        )
        if rc != 0:
            print("Discovery failed!")
            sys.exit(1)
    else:
        print(f"\nSkipping discovery. Using: {discovered}")
        if not discovered.exists():
            print(f"Error: {discovered} not found!")
            sys.exit(1)

    if args.discovery_only:
        print("\nDiscovery-only mode. Done.")
        sys.exit(0)

    # Count discovered
    with discovered.open("r") as f:
        disc_count = sum(1 for line in f if line.strip())
    print(f"\nDiscovered repos: {disc_count:,}")

    # ── Phase 2: Dedup ──────────────────────────────────────────────
    rc = run(
        [VENV_PYTHON, "scraper/batch_process.py", "dedup",
         "--input", args.discovered_file,
         "--output", args.deduped_file],
        "Phase 2: Dedup against existing DB repos",
    )
    if rc != 0:
        print("Dedup failed!")
        sys.exit(1)

    with deduped.open("r") as f:
        new_count = sum(1 for line in f if line.strip())
    print(f"\nNew repos to process: {new_count:,}")

    if new_count == 0:
        print("No new repos to process. Done.")
        sys.exit(0)

    # ── Phase 3: Enqueue ────────────────────────────────────────────
    rc = run(
        [VENV_PYTHON, "scraper/batch_process.py", "enqueue",
         "--input", args.deduped_file,
         "--redis-url", args.redis_url,
         "--queue", args.queue],
        f"Phase 3: Enqueuing {new_count:,} repos to Redis",
    )
    if rc != 0:
        print("Enqueue failed!")
        sys.exit(1)

    # ── Phase 4: Process ────────────────────────────────────────────
    worker_cmd = [
        VENV_PYTHON, "scraper/batch_process.py", "work",
        "--token-file", args.token_file,
        "--redis-url", args.redis_url,
        "--queue", args.queue,
        "--exit-empty",
    ]
    if args.worker_max_jobs > 0:
        worker_cmd.extend(["--max-jobs", str(args.worker_max_jobs)])

    rc = run(
        worker_cmd,
        f"Phase 4: Processing repos (insert + sync metadata)",
    )

    overall_elapsed = time.time() - overall_start
    print(f"""
╔══════════════════════════════════════════════════════════╗
║                    Pipeline Complete                     ║
╠══════════════════════════════════════════════════════════╣
║  Total time: {overall_elapsed/3600:.1f} hours ({overall_elapsed/60:.0f} min)                         ║
║  Worker exit code: {rc}                                     ║
╚══════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    main()
