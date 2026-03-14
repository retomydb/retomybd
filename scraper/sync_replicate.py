#!/usr/bin/env python3
"""
Worker that consumes `replicate_repos` Redis queue, fetches model details from
the Replicate API, and upserts into retomy.Repositories + retomy.ModelMetadata.

Fixes over the original scaffold:
  - Derives owner/model from model_url (source_id in queue was model-name only)
  - Hardcodes CONN_STR (matches batch_process.py) instead of env-var lookup
  - Uses correct retomy schema columns
  - Adds DB connection retry/reconnect logic
  - Limits retries per job (max 3) to avoid infinite requeue loops
  - Tracks stats (processed / ok / skip / err)

Usage:
  .venv/bin/python scraper/sync_replicate.py --token-file scraper/.replicatetoken_worker \
    --redis-url redis://localhost:6379/0 --queue replicate_repos --max-jobs 0
"""

import argparse
import json
import sys
import time
import uuid
from typing import Optional
from urllib.parse import urlparse

import requests

try:
    import redis as redis_lib
except Exception:
    redis_lib = None

try:
    import pyodbc
except Exception:
    pyodbc = None

# ── constants ──────────────────────────────────────────────────────────────
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost,1433;DATABASE=retomY;"
    "UID=sa;PWD=Prestige@123;"
    "TrustServerCertificate=yes;Encrypt=yes;"
)
OWNER_ID = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"
MAX_RETRIES_PER_JOB = 3
STATS_INTERVAL = 50  # print stats every N jobs


# ── token pool ─────────────────────────────────────────────────────────────
class TokenPool:
    def __init__(self, token_file: str):
        self.tokens = []
        with open(token_file, "r") as f:
            for line in f:
                t = line.strip()
                if t and t.startswith("r8_"):  # skip malformed tokens
                    self.tokens.append(t)
        if not self.tokens:
            raise ValueError("No valid tokens found in token file")
        print(f"Loaded {len(self.tokens)} tokens")
        self.i = 0

    def next(self) -> str:
        tok = self.tokens[self.i % len(self.tokens)]
        self.i += 1
        return tok

    def headers(self, token: str):
        return {
            "Authorization": f"Token {token}",
            "Accept": "application/json",
            "User-Agent": "retomY-replicate-worker",
        }


# ── DB helpers ─────────────────────────────────────────────────────────────
def _connect_db(conn_str: str = CONN_STR):
    return pyodbc.connect(conn_str, autocommit=False, timeout=30)


def _is_conn_error(exc):
    code = getattr(exc, "args", [None])[0] if exc.args else None
    return code in ("08S01", "08001", "HYT00", "HY000", "01000") or "closed" in str(exc).lower()


def _ensure_conn(conn, conn_str: str = CONN_STR):
    """Return a live connection; reconnect if stale."""
    if conn is not None:
        try:
            conn.execute("SELECT 1")
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
    return _connect_db(conn_str)


# ── Replicate API ──────────────────────────────────────────────────────────
def resolve_model_id(job: dict) -> Optional[str]:
    """
    Derive 'owner/model' from the job.
    Jobs from discover_replicate.py have model_url like
    https://replicate.com/heygen/avatar-iv but source_id may only be
    the model name ('avatar-iv'). Parse owner/model from the URL.
    """
    # Try source_id first — if it already has a slash, use it
    sid = job.get("source_id", "")
    if isinstance(sid, str) and "/" in sid:
        return sid

    # Parse from model_url
    url = job.get("model_url", "")
    if url:
        parts = urlparse(url).path.strip("/").split("/")
        if len(parts) >= 2:
            return f"{parts[0]}/{parts[1]}"

    # Fallback: try owner + source_id fields
    owner = job.get("owner")
    if owner and sid:
        return f"{owner}/{sid}"

    return None


def fetch_model_detail(pool: TokenPool, model_id: str) -> Optional[dict]:
    """GET /v1/models/{owner}/{model} with retry on rate limit."""
    token = pool.next()
    url = f"https://api.replicate.com/v1/models/{model_id}"
    try:
        resp = requests.get(url, headers=pool.headers(token), timeout=20)
    except Exception as e:
        print(f"  Request error for {model_id}: {e}")
        return None

    if resp.status_code == 429:
        wait = int(resp.headers.get("Retry-After", 5))
        print(f"  Rate limited, sleeping {wait}s")
        time.sleep(wait)
        return None

    if resp.status_code == 401:
        # try next token once
        token2 = pool.next()
        try:
            resp = requests.get(url, headers=pool.headers(token2), timeout=20)
        except Exception:
            return None
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code} (2nd token) for {model_id}")
            return None

    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code} for {model_id}: {resp.text[:120]}")
        return None

    return resp.json()


# ── DB insert ──────────────────────────────────────────────────────────────
def insert_replicate_model(conn, job: dict, detail: dict, model_id: str):
    """
    Insert into retomy.Repositories + retomy.ModelMetadata.
    Returns 'ok', 'skip', or 'error:...' string.
    """
    owner_model = model_id  # e.g. 'heygen/avatar-iv'
    owner = owner_model.split("/")[0]
    model_name = owner_model.split("/")[1] if "/" in owner_model else owner_model
    repo_id = str(uuid.uuid4()).upper()

    desc = (job.get("description") or detail.get("description") or "")[:2000]
    model_url = job.get("model_url") or f"https://replicate.com/{owner_model}"
    run_count = detail.get("run_count")
    github_url = detail.get("github_url")
    license_url = detail.get("license_url")
    # LicenseType column is VARCHAR(50) — extract short name or truncate
    license_type = "LICENSE"
    if license_url:
        # Try to extract license name from URL, e.g. ".../blob/main/LICENSE" -> "LICENSE"
        last_seg = license_url.rstrip("/").split("/")[-1]
        license_type = last_seg[:50] if last_seg else license_url[:50]
    created_at = detail.get("created_at")

    # Extract task from latest_version openapi schema if available
    task = None
    lv = detail.get("latest_version") or {}
    openapi = lv.get("openapi_schema") or {}
    # Replicate doesn't have a standard 'task' field; leave null

    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            cur = conn.cursor()

            # ── Check duplicate ──
            cur.execute("""
                SELECT 1 FROM retomy.ModelMetadata
                WHERE HostingType = 'replicate' AND OriginalModelId = ?
            """, [owner_model])
            if cur.fetchone():
                return "skip"

            # ── Insert Repositories row ──
            slug = f"{owner}-{model_name}".lower()[:200]
            try:
                cur.execute("""
                    INSERT INTO retomy.Repositories
                    (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description,
                     Private, PricingModel, Price, LicenseType, SourceUrl, ImportedFrom,
                     TotalDownloads)
                    VALUES (?, ?, 'user', 'model', ?, ?, ?, 0, 'free', 0,
                            ?, ?, 'replicate_discovery', ?)
                """, [repo_id, OWNER_ID, model_name, slug, desc,
                      license_type, model_url,
                      run_count or 0])
                conn.commit()
            except Exception:
                conn.rollback()
                slug = f"{slug}-{repo_id[:8].lower()}"
                cur.execute("""
                    INSERT INTO retomy.Repositories
                    (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description,
                     Private, PricingModel, Price, LicenseType, SourceUrl, ImportedFrom,
                     TotalDownloads)
                    VALUES (?, ?, 'user', 'model', ?, ?, ?, 0, 'free', 0,
                            ?, ?, 'replicate_discovery', ?)
                """, [repo_id, OWNER_ID, model_name, slug, desc,
                      license_type, model_url,
                      run_count or 0])
                conn.commit()

            # ── Insert ModelMetadata row ──
            cur.execute("""
                INSERT INTO retomy.ModelMetadata
                (RepoId, HostingType, OriginalModelId,
                 GithubOwner, GithubRepoName, GithubRepoUrl,
                 ScraperFetchedAt, GithubStars)
                VALUES (?, 'replicate', ?,
                        ?, ?, ?,
                        GETDATE(), ?)
            """, [repo_id, owner_model,
                  owner, model_name,
                  github_url or model_url,
                  run_count or 0])
            conn.commit()
            return "ok"

        except pyodbc.Error as e:
            if attempt < max_attempts - 1 and _is_conn_error(e):
                print(f"  DB conn error (reconnecting): {e}")
                try:
                    conn.close()
                except Exception:
                    pass
                conn = _connect_db()
                continue
            try:
                conn.rollback()
            except Exception:
                pass
            return f"error:db:{e}"

    return "error:db:exhausted_retries"


# ── main loop ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--redis-url", default="redis://localhost:6379/0")
    parser.add_argument("--queue", default="replicate_repos")
    parser.add_argument("--max-jobs", type=int, default=0, help="0 = infinite")
    parser.add_argument("--exit-empty", action="store_true",
                        help="Exit when queue is empty")
    args = parser.parse_args()

    pool = TokenPool(args.token_file)

    if redis_lib is None:
        print("redis package not installed")
        sys.exit(1)
    if pyodbc is None:
        print("pyodbc package not installed")
        sys.exit(1)

    r = redis_lib.from_url(args.redis_url)
    conn = _connect_db()
    print("DB connected")

    processed = ok = skip = err = 0
    t0 = time.time()

    while True:
        item = r.lpop(args.queue)
        if item is None:
            if args.exit_empty:
                print("Queue empty, exiting")
                break
            time.sleep(1)
            continue

        try:
            job = json.loads(item)
        except Exception:
            print("Malformed JSON, dropping")
            err += 1
            continue

        # ── Resolve owner/model ──
        model_id = resolve_model_id(job)
        if not model_id:
            print(f"Cannot resolve model_id for job, dropping: {json.dumps(job)[:120]}")
            err += 1
            continue

        # ── Retry budget ──
        retries = job.get("_retries", 0)
        if retries >= MAX_RETRIES_PER_JOB:
            print(f"  Dead-letter (max retries): {model_id}")
            err += 1
            continue

        # ── Fetch detail from Replicate API ──
        detail = fetch_model_detail(pool, model_id)
        if detail is None:
            job["_retries"] = retries + 1
            r.rpush(args.queue, json.dumps(job, ensure_ascii=False))
            time.sleep(0.5)
            continue

        # ── Ensure DB connection is alive ──
        conn = _ensure_conn(conn)

        # ── Insert ──
        result = insert_replicate_model(conn, job, detail, model_id)

        processed += 1
        if result == "ok":
            ok += 1
        elif result == "skip":
            skip += 1
        else:
            err += 1
            print(f"  {result} for {model_id}")

        # ── Stats ──
        if processed % STATS_INTERVAL == 0:
            elapsed = time.time() - t0
            rate = int(processed / elapsed * 3600) if elapsed > 0 else 0
            qlen = r.llen(args.queue)
            print(f"[stats] Processed: {processed} | OK: {ok} | Skip: {skip} "
                  f"| Err: {err} | Rate: {rate:,}/hr | Queue: {qlen:,}")

        if args.max_jobs and processed >= args.max_jobs:
            break

    elapsed = time.time() - t0
    rate = int(processed / elapsed * 3600) if elapsed > 0 else 0
    print(f"[DONE] Processed: {processed} | OK: {ok} | Skip: {skip} "
          f"| Err: {err} | Rate: {rate:,}/hr | Elapsed: {elapsed:.0f}s")

    if conn:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
