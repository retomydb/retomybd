#!/usr/bin/env python3
"""
Batch processor: dedup discovered repos against DB, enqueue new ones,
and run the worker to process them.

Usage:
  # Step 1: Dedup against DB and produce a clean JSONL
  python scraper/batch_process.py dedup \
    --input scraper/discovered_repos.jsonl \
    --output scraper/new_candidates.jsonl

  # Step 2: Enqueue new candidates (in chunks)
  python scraper/batch_process.py enqueue \
    --input scraper/new_candidates.jsonl \
    --redis-url redis://localhost:6379/0 \
    --chunk-size 5000

  # Step 3: Run worker (or multiple workers)
  python scraper/batch_process.py work \
    --token-file scraper/.githubtokens \
    --redis-url redis://localhost:6379/0 \
    --max-jobs 10000
"""
import argparse
import json
import sys
import time
import uuid
import subprocess
from pathlib import Path
from typing import Set
import random
import traceback

import pyodbc

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;"
    "DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;Encrypt=yes;"
)

OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"


def get_existing_repos(conn) -> Set[str]:
    """Get set of already-imported GitHub repo full_names."""
    cur = conn.cursor()
    cur.execute("""
        SELECT mm.GithubOwner + '/' + mm.GithubRepoName
        FROM retomy.ModelMetadata mm
        WHERE mm.HostingType = 'github'
          AND mm.GithubOwner IS NOT NULL
          AND mm.GithubRepoName IS NOT NULL
    """)
    return {row[0] for row in cur.fetchall()}


def cmd_dedup(args):
    """Remove repos already in DB from the discovered JSONL."""
    conn = pyodbc.connect(CONN_STR)
    existing = get_existing_repos(conn)
    conn.close()
    print(f"DB already has {len(existing)} GitHub repos")

    inp = Path(args.input)
    out = Path(args.output)
    seen = set()
    total = 0
    kept = 0

    with inp.open("r") as fin, out.open("w") as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                doc = json.loads(line)
            except Exception:
                continue

            fn = doc.get("full_name", "")
            if not fn:
                continue

            # Skip forks by default
            if doc.get("fork", False):
                continue

            # Skip if already in DB or already seen in this file
            if fn in existing or fn in seen:
                continue

            seen.add(fn)

            # Add repo_id for downstream
            doc["repo_id"] = str(uuid.uuid4()).upper()
            fout.write(json.dumps(doc, ensure_ascii=False) + "\n")
            kept += 1

    print(f"Input: {total:,} | Deduped: {kept:,} new repos → {out}")


def cmd_enqueue(args):
    """Enqueue deduped candidates to Redis in chunks."""
    if redis_lib is None:
        print("redis package not installed")
        sys.exit(2)

    r = redis_lib.from_url(args.redis_url)
    inp = Path(args.input)
    count = 0

    pipe = r.pipeline()
    with inp.open("r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                doc = json.loads(line)
            except Exception:
                continue

            job = {
                "full_name": doc["full_name"],
                "owner": doc.get("owner"),
                "repo": doc.get("repo"),
                "repo_id": doc.get("repo_id"),
                "source": doc.get("source", "discovered"),
                "stars": doc.get("stars", 0),
                "language": doc.get("language"),
                "description": doc.get("description", ""),
                "topics": doc.get("topics", []),
                "license": doc.get("license"),
            }
            pipe.rpush(args.queue, json.dumps(job))
            count += 1

            if count % args.chunk_size == 0:
                pipe.execute()
                pipe = r.pipeline()
                print(f"  Enqueued {count:,}...")

    pipe.execute()
    print(f"Done. Enqueued {count:,} jobs to {args.queue}")


def _connect_db(conn_str: str = CONN_STR, attempts: int = 5):
    """Create a pyodbc connection with retry/backoff."""
    for attempt in range(1, attempts + 1):
        try:
            return pyodbc.connect(conn_str, timeout=15)
        except pyodbc.OperationalError as e:
            if attempt == attempts:
                raise
            sleep_time = (2 ** (attempt - 1)) + random.random()
            print(f"  DB connect retry {attempt}: {e}")
            time.sleep(sleep_time)


def _is_conn_error(e: Exception) -> bool:
    """Return True if the exception signals a stale/closed DB connection."""
    msg = str(e).lower()
    return any(s in msg for s in (
        'closed connection', 'login timeout', 'communication link',
        'connection is busy', 'connection was killed',
    ))


def insert_and_sync(job: dict, token: str, conn_str: str = CONN_STR):
    """Insert a new repo into DB and sync its metadata from GitHub.

    Uses job['_db_conn'] if available (persistent connection from worker).
    On closed/stale connection, reconnects once and updates job['_db_conn']
    so the caller can pick up the fresh connection for future jobs.
    NEVER closes a persistent (non-local) connection.
    """
    full_name = job["full_name"]
    owner = job.get("owner") or full_name.split("/")[0]
    repo = job.get("repo") or full_name.split("/")[1]
    repo_id = job.get("repo_id") or str(uuid.uuid4()).upper()
    topics_str = ",".join(job.get("topics", [])) if isinstance(job.get("topics"), list) else (job.get("topics") or "")

    # Connection management: prefer persistent conn from caller, else create local
    conn = job.get("_db_conn") if isinstance(job, dict) else None
    local_conn = conn is None  # True => we created it and must close it

    max_attempts = 2  # first try + one reconnect
    for attempt in range(max_attempts):
        try:
            # Create or recreate connection when needed
            if conn is None:
                conn = _connect_db(conn_str)
                if isinstance(job, dict):
                    job["_db_conn"] = conn
                if attempt > 0:
                    local_conn = False  # caller now owns the refreshed conn

            cur = conn.cursor()

            # ---- Check if already exists ----
            cur.execute("""
                SELECT 1 FROM retomy.ModelMetadata mm
                WHERE (mm.GithubOwner = ? AND mm.GithubRepoName = ?)
                   OR mm.OriginalModelId = ?
            """, [owner, repo, full_name])
            if cur.fetchone():
                if local_conn:
                    conn.close()
                return "skip"

            # ---- Insert into Repositories ----
            slug = f"{owner}-{repo}".lower()[:200]
            try:
                cur.execute("""
                    INSERT INTO retomy.Repositories
                    (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description,
                     Private, PricingModel, Price, LicenseType, SourceUrl, ImportedFrom)
                    VALUES (?, ?, 'user', 'model', ?, ?, ?, 0, 'free', 0,
                            ?, ?, 'github_discovery')
                """, [repo_id, OWNER_ID, repo, slug,
                      (job.get("description") or "")[:2000],
                      job.get("license") or "LICENSE",
                      f"https://github.com/{full_name}"])
                conn.commit()
            except Exception:
                conn.rollback()
                slug = f"{slug}-{repo_id[:8].lower()}"
                cur.execute("""
                    INSERT INTO retomy.Repositories
                    (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description,
                     Private, PricingModel, Price, LicenseType, SourceUrl, ImportedFrom)
                    VALUES (?, ?, 'user', 'model', ?, ?, ?, 0, 'free', 0,
                            ?, ?, 'github_discovery')
                """, [repo_id, OWNER_ID, repo, slug,
                      (job.get("description") or "")[:2000],
                      job.get("license") or "LICENSE",
                      f"https://github.com/{full_name}"])
                conn.commit()

            # ---- Insert into ModelMetadata ----
            cur.execute("""
                INSERT INTO retomy.ModelMetadata
                (RepoId, HostingType, OriginalModelId, GithubOwner, GithubRepoName,
                 GithubRepoUrl, GithubTopics, GithubStars, ScraperFetchedAt)
                VALUES (?, 'github', ?, ?, ?, ?, ?, ?, GETDATE())
            """, [repo_id, full_name, owner, repo,
                  f"https://github.com/{full_name}",
                  topics_str, job.get("stars", 0)])
            conn.commit()
            break  # success

        except pyodbc.Error as e:
            if attempt < max_attempts - 1 and _is_conn_error(e):
                print(f"  DB connection error (reconnecting): {e}")
                try:
                    conn.close()
                except Exception:
                    pass
                conn = None  # forces reconnect on next iteration
                continue
            if local_conn and conn:
                try:
                    conn.close()
                except Exception:
                    pass
            return f"error:db:{e}"

    if local_conn and conn:
        try:
            conn.close()
        except Exception:
            pass

    # ---- Sync README / enriched metadata from GitHub ----
    import os
    env = os.environ.copy()
    env["GITHUB_TOKEN"] = token
    result = subprocess.run(
        [sys.executable, "scraper/sync_github_readmes.py",
         "--single-repo", full_name, "--repo-id", repo_id],
        env=env, capture_output=True, text=True, timeout=60,
    )

    if result.returncode == 0:
        return "ok"
    else:
        return f"sync_error:{result.stderr[:200]}"


def cmd_work(args):
    """Worker that pops jobs from Redis, inserts into DB, and syncs metadata."""
    if redis_lib is None:
        print("redis package not installed")
        sys.exit(2)

    # Load tokens
    tokens = []
    with open(args.token_file, "r") as f:
        for line in f:
            t = line.strip()
            if t and t.startswith("ghp_"):
                tokens.append(t)
    if not tokens:
        print("No tokens found")
        sys.exit(2)
    print(f"Loaded {len(tokens)} tokens")

    r = redis_lib.from_url(args.redis_url)
    token_idx = 0
    processed = 0
    ok_count = 0
    skip_count = 0
    err_count = 0
    consecutive_db_failures = 0
    start = time.time()
    
    # Create a persistent DB connection to reuse across jobs. We'll attach
    # it to the job dict as `_db_conn` so `insert_and_sync` can use it.
    def connect_with_retry(conn_str=CONN_STR, attempts=5):
        for attempt in range(1, attempts + 1):
            try:
                return pyodbc.connect(conn_str, timeout=15)
            except pyodbc.OperationalError as e:
                if attempt == attempts:
                    raise
                sleep_time = (2 ** (attempt - 1)) + random.random()
                print(f"Persistent DB connect failed (attempt {attempt}), retrying in {sleep_time:.1f}s: {e}")
                time.sleep(sleep_time)

    try:
        persistent_conn = connect_with_retry()
    except Exception as e:
        print(f"Failed to establish initial persistent DB connection: {e}")
        persistent_conn = None
    print(f"Worker started. Queue: {args.queue}, max-jobs: {args.max_jobs}")

    try:
        while True:
            if args.max_jobs > 0 and processed >= args.max_jobs:
                break

            item = r.lpop(args.queue)
            if not item:
                # Check queue length
                qlen = r.llen(args.queue)
                if qlen == 0 and args.exit_empty:
                    print("Queue empty, exiting")
                    break
                time.sleep(1)
                continue

            try:
                job = json.loads(item)
            except Exception:
                continue

            token = tokens[token_idx % len(tokens)]
            token_idx += 1

            # Validate persistent connection before giving it to the job.
            # If stale/closed, reconnect so every job starts with a live conn.
            if persistent_conn:
                try:
                    persistent_conn.cursor().execute("SELECT 1")
                except Exception:
                    try:
                        persistent_conn.close()
                    except Exception:
                        pass
                    try:
                        persistent_conn = connect_with_retry()
                    except Exception:
                        persistent_conn = None

            job["_db_conn"] = persistent_conn  # may be None; insert_and_sync handles it

            try:
                result = insert_and_sync(job, token)
                processed += 1

                # Sync back: insert_and_sync may have reconnected internally
                refreshed = job.get("_db_conn")
                if refreshed is not None and refreshed is not persistent_conn:
                    persistent_conn = refreshed

            except pyodbc.OperationalError as e:
                # Persistent DB failure: requeue job, alert and exit for supervisor restart
                job_clean = {k: v for k, v in job.items() if k != "_db_conn"}
                try:
                    r.rpush(args.queue, json.dumps(job_clean))
                except Exception:
                    print("Failed to requeue job after DB error")
                consecutive_db_failures += 1
                print(f"DB OperationalError, requeued {job.get('full_name')}: {e}")
                try:
                    if persistent_conn:
                        persistent_conn.close()
                except Exception:
                    pass
                persistent_conn = None
                try:
                    subprocess.Popen(["./scripts/alert_db_failure.sh", str(consecutive_db_failures), str(e)])
                except Exception:
                    pass
                print("Exiting worker due to persistent DB error; supervisor should restart it")
                sys.exit(1)

            except Exception as e:
                tb = traceback.format_exc()
                print(f"Unexpected error for {job.get('full_name')}: {e}\n{tb}")
                err_count += 1
                processed += 1
                # Connection may have gone bad; mark it for re-validation next loop
                if persistent_conn:
                    try:
                        persistent_conn.cursor().execute("SELECT 1")
                    except Exception:
                        try:
                            persistent_conn.close()
                        except Exception:
                            pass
                        try:
                            persistent_conn = connect_with_retry()
                        except Exception:
                            persistent_conn = None
                consecutive_db_failures = 0
                continue

            # successful DB interaction resets consecutive failure counter
            consecutive_db_failures = 0

            if result == "ok":
                ok_count += 1
            elif result == "skip":
                skip_count += 1
            else:
                err_count += 1
                if err_count <= 20:
                    print(f"  Error: {job.get('full_name')}: {result}")

            if processed % 100 == 0:
                elapsed = time.time() - start
                rate = processed / max(elapsed, 1) * 3600
                qlen = r.llen(args.queue)
                print(f"  Processed: {processed:,} | OK: {ok_count} | Skip: {skip_count} | "
                      f"Err: {err_count} | Rate: {rate:,.0f}/hr | Queue: {qlen:,}")

    except KeyboardInterrupt:
        print("\nWorker interrupted")

    elapsed = time.time() - start
    print(f"\nWorker done. Processed: {processed:,} | OK: {ok_count} | "
          f"Skip: {skip_count} | Err: {err_count} | Time: {elapsed/60:.1f} min")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")

    # dedup
    p1 = sub.add_parser("dedup")
    p1.add_argument("--input", required=True)
    p1.add_argument("--output", default="scraper/new_candidates.jsonl")

    # enqueue
    p2 = sub.add_parser("enqueue")
    p2.add_argument("--input", required=True)
    p2.add_argument("--redis-url", default="redis://localhost:6379/0")
    p2.add_argument("--queue", default="github_repos")
    p2.add_argument("--chunk-size", type=int, default=5000)

    # work
    p3 = sub.add_parser("work")
    p3.add_argument("--token-file", required=True)
    p3.add_argument("--redis-url", default="redis://localhost:6379/0")
    p3.add_argument("--queue", default="github_repos")
    p3.add_argument("--max-jobs", type=int, default=0)
    p3.add_argument("--exit-empty", action="store_true",
                    help="Exit when queue is empty instead of polling")

    args = parser.parse_args()

    if args.command == "dedup":
        cmd_dedup(args)
    elif args.command == "enqueue":
        cmd_enqueue(args)
    elif args.command == "work":
        cmd_work(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
