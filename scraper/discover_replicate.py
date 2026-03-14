#!/usr/bin/env python3
"""
Discover Replicate models (listing-only) and enqueue jobs to Redis.

Uses cursor-based pagination as required by the Replicate API.  Follows the
`next` URL from each response until exhausted.

Usage:
  .venv/bin/python scraper/discover_replicate.py \
    --token-file scraper/.replicatetoken_worker \
    --redis-url redis://localhost:6379/0 \
    --queue replicate_repos --max-pages 0
"""

import argparse
import json
import time
from typing import Optional, Tuple, List

import requests

try:
    import redis
except Exception:
    redis = None


class TokenPool:
    def __init__(self, token_file: str):
        self.tokens = []
        with open(token_file, "r") as f:
            for line in f:
                t = line.strip()
                if t and t.startswith("r8_"):
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
            "User-Agent": "retomY-replicate-discovery",
        }


def fetch_page(pool: TokenPool, url: str) -> Tuple[List[dict], Optional[str]]:
    """Fetch one page. Returns (models, next_url)."""
    token = pool.next()
    try:
        resp = requests.get(url, headers=pool.headers(token), timeout=30)
    except Exception as e:
        print(f"Request error: {e}")
        return [], None

    if resp.status_code == 429:
        wait = int(resp.headers.get("Retry-After", 10))
        print(f"Rate limited, sleeping {wait}s")
        time.sleep(wait)
        return [], url  # return same URL to retry

    if resp.status_code == 401:
        # try next token
        token2 = pool.next()
        try:
            resp = requests.get(url, headers=pool.headers(token2), timeout=30)
        except Exception:
            return [], None
        if resp.status_code != 200:
            print(f"HTTP {resp.status_code} (2nd token): {resp.text[:200]}")
            return [], None

    if resp.status_code != 200:
        print(f"HTTP {resp.status_code}: {resp.text[:200]}")
        return [], None

    data = resp.json()
    next_url = data.get("next")
    results = data.get("results") or []

    models = []
    for item in results:
        raw_owner = item.get("owner", "")
        raw_name = item.get("name", "")
        if isinstance(raw_owner, dict):
            raw_owner = raw_owner.get("username", "")

        if raw_owner and raw_name:
            slug = f"{raw_owner}/{raw_name}"
        else:
            slug = raw_name or item.get("id") or ""

        if not slug:
            continue

        owner = slug.split("/")[0] if "/" in slug else None
        title = raw_name or (slug.split("/")[-1] if "/" in slug else slug)
        description = item.get("description") or ""
        model_url = item.get("url") or f"https://replicate.com/{slug}"

        models.append({
            "source": "replicate",
            "source_id": slug,
            "title": title,
            "model_url": model_url,
            "description": description,
            "owner": owner,
        })

    return models, next_url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--redis-url", default="redis://localhost:6379/0")
    parser.add_argument("--queue", default="replicate_repos")
    parser.add_argument("--max-pages", type=int, default=0,
                        help="Max pages to request (0 = unlimited)")
    parser.add_argument("--output", default=None,
                        help="Optional JSONL output file")
    args = parser.parse_args()

    pool = TokenPool(args.token_file)

    if redis is None:
        print("redis package not installed")
        return

    r = redis.from_url(args.redis_url)
    out_f = None
    if args.output:
        out_f = open(args.output, "a", encoding="utf-8")

    seen = set()  # dedup within this run
    url = "https://api.replicate.com/v1/models"
    page = 0
    total = 0

    while url:
        page += 1
        if args.max_pages and page > args.max_pages:
            break

        models, next_url = fetch_page(pool, url)
        if not models and next_url is None:
            break

        enqueued_page = 0
        for m in models:
            if m["source_id"] in seen:
                continue
            seen.add(m["source_id"])

            job = {
                "source": m["source"],
                "source_id": m["source_id"],
                "title": m["title"],
                "model_url": m["model_url"],
                "description": m["description"],
                "owner": m.get("owner"),
            }
            try:
                r.rpush(args.queue, json.dumps(job, ensure_ascii=False))
            except Exception as e:
                print(f"Redis error: {e}")
                return

            if out_f:
                out_f.write(json.dumps(job, ensure_ascii=False) + "\n")

            enqueued_page += 1
            total += 1

        print(f"Page {page}: {enqueued_page} new (total {total}, seen {len(seen)})")
        url = next_url
        time.sleep(0.1)

    if out_f:
        out_f.close()
    print(f"Discovery finished: {total} unique models enqueued")


if __name__ == "__main__":
    main()
