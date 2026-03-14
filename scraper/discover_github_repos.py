#!/usr/bin/env python3
"""
GitHub ML/AI Repo Discovery - Find up to 1M+ model repos via GitHub Search API.

Uses aggressive query partitioning (topics, keywords, languages, star ranges,
date ranges) to bypass the 1,000-result-per-query limit.

Usage:
  python scraper/discover_github_repos.py \
    --token-file scraper/.githubtokens \
    --output scraper/discovered_repos.jsonl \
    --target 1000000

Features:
  - Token rotation (round-robin across all tokens)
  - Resume support (checkpoint file)
  - Dedup by repo full_name
  - Rate-limit aware (respects X-RateLimit headers)
  - Partitions queries by topic × language × stars × date
"""
import argparse
import json
import os
import time
import sys
import datetime
from pathlib import Path
from typing import List, Optional, Set, Dict

import requests

# ─── Search query building blocks ────────────────────────────────────────────

ML_TOPICS = [
    "machine-learning", "deep-learning", "neural-network", "artificial-intelligence",
    "pytorch", "tensorflow", "keras", "transformers", "huggingface",
    "llm", "large-language-model", "gpt", "bert", "language-model",
    "nlp", "natural-language-processing", "text-generation", "text-classification",
    "computer-vision", "image-classification", "object-detection", "image-segmentation",
    "generative-ai", "stable-diffusion", "diffusion-model", "gan",
    "reinforcement-learning", "rl", "model-training", "fine-tuning", "finetuning",
    "pretrained-models", "model-zoo", "model-hub",
    "onnx", "safetensors", "model-compression", "quantization", "pruning",
    "speech-recognition", "text-to-speech", "tts", "asr",
    "recommendation-system", "embeddings", "vector-database",
    "chatbot", "conversational-ai", "dialogue-system",
    "image-generation", "text-to-image", "vision-transformer", "vit",
    "sentiment-analysis", "named-entity-recognition", "ner",
    "question-answering", "summarization", "translation", "machine-translation",
    "audio-classification", "music-generation", "video-generation",
    "multimodal", "clip", "llava", "vision-language",
    "knowledge-distillation", "transfer-learning", "few-shot-learning",
    "graph-neural-network", "gnn", "point-cloud",
    "autonomous-driving", "self-driving", "robotics",
    "medical-imaging", "drug-discovery", "bioinformatics",
    "time-series", "forecasting", "anomaly-detection",
    "federated-learning", "differential-privacy",
    "model-serving", "model-deployment", "inference",
    "mlops", "experiment-tracking", "model-registry",
    "data-augmentation", "data-labeling", "active-learning",
]

ML_KEYWORDS = [
    "neural network", "deep learning", "machine learning model",
    "pretrained model", "language model", "transformer model",
    "diffusion model", "image classifier", "object detector",
    "text generator", "speech synthesis", "model weights",
    "model checkpoint", "fine-tuned", "foundation model",
    "pytorch model", "tensorflow model", "onnx model",
    "huggingface model", "llm inference", "model training",
]

LANGUAGES = [
    "Python", "Jupyter Notebook", "C++", "Rust", "Julia",
    "R", "Java", "Go", "TypeScript", "JavaScript",
    "Scala", "MATLAB", "Lua", "Swift", "Kotlin",
    "Shell", "Dockerfile", "Cuda",
]

STAR_RANGES = [
    (0, 5), (5, 10), (10, 25), (25, 50), (50, 100),
    (100, 250), (250, 500), (500, 1000), (1000, 2500),
    (2500, 5000), (5000, 10000), (10000, 50000), (50000, 500000),
]

# Generate date ranges (quarterly from 2015 to 2026)
def generate_date_ranges():
    ranges = []
    for year in range(2015, 2027):
        for q_start, q_end in [("01-01", "03-31"), ("04-01", "06-30"),
                                ("07-01", "09-30"), ("10-01", "12-31")]:
            start = f"{year}-{q_start}"
            end = f"{year}-{q_end}"
            if start <= "2026-03-09":
                ranges.append((start, end))
    return ranges

DATE_RANGES = generate_date_ranges()


# ─── Token rotation ─────────────────────────────────────────────────────────

class TokenPool:
    def __init__(self, token_file: str):
        self.tokens = []
        with open(token_file, "r") as f:
            for line in f:
                t = line.strip()
                if t and t.startswith("ghp_"):
                    self.tokens.append(t)
        self.index = 0
        self.rate_limits = {}  # token -> reset_time
        if not self.tokens:
            raise ValueError("No tokens found in token file")
        print(f"Loaded {len(self.tokens)} tokens")

    def get_token(self) -> str:
        """Get next available token, waiting if all are rate-limited."""
        attempts = 0
        while attempts < len(self.tokens) * 2:
            token = self.tokens[self.index % len(self.tokens)]
            self.index += 1

            reset = self.rate_limits.get(token, 0)
            if time.time() < reset:
                attempts += 1
                continue
            return token

        # All tokens rate-limited; wait for the soonest reset
        soonest = min(self.rate_limits.values())
        wait = max(0, soonest - time.time()) + 1
        print(f"  All tokens rate-limited, waiting {wait:.0f}s...")
        time.sleep(wait)
        return self.get_token()

    def mark_limited(self, token: str, reset_time: float):
        self.rate_limits[token] = reset_time

    def get_headers(self, token: str) -> dict:
        return {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "retomY-discovery",
        }


# ─── Search executor ────────────────────────────────────────────────────────

def search_repos(pool: TokenPool, query: str, max_pages: int = 10) -> List[dict]:
    """Run a single search query and return all result repos (up to max_pages * 100)."""
    repos = []
    page = 1
    per_page = 100

    while page <= max_pages:
        token = pool.get_token()
        headers = pool.get_headers(token)

        try:
            resp = requests.get(
                "https://api.github.com/search/repositories",
                params={"q": query, "sort": "updated", "order": "desc",
                        "per_page": per_page, "page": page},
                headers=headers,
                timeout=30,
            )
        except Exception as e:
            print(f"  Request error: {e}")
            time.sleep(2)
            continue

        # Handle rate limiting
        remaining = int(resp.headers.get("X-RateLimit-Remaining", 999))
        reset = int(resp.headers.get("X-RateLimit-Reset", 0))

        if resp.status_code == 403 or remaining < 2:
            pool.mark_limited(token, reset)
            continue

        if resp.status_code == 422:
            # Validation failed (e.g., too broad query) — skip
            break

        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code} for query: {query[:80]}")
            time.sleep(1)
            break

        data = resp.json()
        items = data.get("items", [])
        if not items:
            break

        for item in items:
            repos.append({
                "full_name": item["full_name"],
                "owner": item["owner"]["login"],
                "repo": item["name"],
                "stars": item.get("stargazers_count", 0),
                "language": item.get("language"),
                "description": (item.get("description") or "")[:500],
                "topics": item.get("topics", []),
                "license": (item.get("license") or {}).get("spdx_id"),
                "created_at": item.get("created_at"),
                "pushed_at": item.get("pushed_at"),
                "fork": item.get("fork", False),
                "source": "github_search",
            })

        total_count = data.get("total_count", 0)
        if page * per_page >= min(total_count, 1000):
            break

        page += 1
        time.sleep(0.1)  # small delay between pages

    return repos


# ─── Query generation ────────────────────────────────────────────────────────

def generate_queries(strategy: str = "full") -> List[str]:
    """Generate partitioned queries to maximize unique repo discovery."""
    queries = []

    if strategy in ("full", "topics"):
        # Topic-based
        for topic in ML_TOPICS:
            queries.append(f"topic:{topic}")
            # Topic + language combos for popular topics
            if topic in ML_TOPICS[:20]:
                for lang in LANGUAGES[:6]:
                    queries.append(f"topic:{topic} language:{lang}")

        # Topic + star ranges for the most popular topics
        for topic in ML_TOPICS[:15]:
            for lo, hi in STAR_RANGES:
                queries.append(f"topic:{topic} stars:{lo}..{hi}")

    if strategy in ("full", "keywords"):
        # Keyword-based
        for kw in ML_KEYWORDS:
            queries.append(f'"{kw}" in:name,description')
            for lang in LANGUAGES[:5]:
                queries.append(f'"{kw}" in:name,description language:{lang}')

    if strategy in ("full", "dates"):
        # Topic + date range combos (for high-volume topics)
        for topic in ML_TOPICS[:10]:
            for start, end in DATE_RANGES:
                queries.append(f"topic:{topic} created:{start}..{end}")

    if strategy in ("full", "filenames"):
        # File-based (repos containing model files)
        model_files = [
            "config.json", "pytorch_model.bin", "model.safetensors",
            "tf_model.h5", "model.onnx", "tokenizer.json",
            "special_tokens_map.json", "vocab.txt",
            "requirements.txt transformer", "setup.py torch",
        ]
        for mf in model_files:
            queries.append(f'"{mf}" in:name,readme')

    return queries


# ─── Main driver ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Discover ML/AI repos on GitHub")
    parser.add_argument("--token-file", required=True, help="File with GitHub tokens")
    parser.add_argument("--output", default="scraper/discovered_repos.jsonl")
    parser.add_argument("--target", type=int, default=1_000_000, help="Target repo count")
    parser.add_argument("--checkpoint", default="scraper/discovery_checkpoint.json")
    parser.add_argument("--strategy", default="full",
                        choices=["full", "topics", "keywords", "dates", "filenames"])
    parser.add_argument("--max-pages", type=int, default=10,
                        help="Max pages per query (max 10 = 1000 results)")
    args = parser.parse_args()

    pool = TokenPool(args.token_file)
    output = Path(args.output)
    checkpoint_path = Path(args.checkpoint)

    # Load checkpoint
    seen: Set[str] = set()
    completed_queries: Set[str] = set()
    if checkpoint_path.exists():
        cp = json.loads(checkpoint_path.read_text())
        completed_queries = set(cp.get("completed_queries", []))
        print(f"Resuming: {len(completed_queries)} queries already done")

    # Load existing output for dedup
    if output.exists():
        with output.open("r") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        d = json.loads(line)
                        seen.add(d["full_name"])
                    except Exception:
                        pass
        print(f"Already discovered: {len(seen)} unique repos")

    if len(seen) >= args.target:
        print(f"Target {args.target} already reached ({len(seen)} repos). Done.")
        return

    queries = generate_queries(args.strategy)
    remaining_queries = [q for q in queries if q not in completed_queries]
    print(f"Total queries: {len(queries)}, remaining: {len(remaining_queries)}")
    print(f"Target: {args.target:,} repos")

    out_file = output.open("a", encoding="utf-8")
    new_count = 0
    query_count = 0
    start_time = time.time()

    try:
        for i, query in enumerate(remaining_queries):
            if len(seen) >= args.target:
                print(f"\nTarget reached: {len(seen):,} repos!")
                break

            repos = search_repos(pool, query, max_pages=args.max_pages)
            added = 0
            for repo in repos:
                fn = repo["full_name"]
                if fn not in seen:
                    seen.add(fn)
                    out_file.write(json.dumps(repo, ensure_ascii=False) + "\n")
                    new_count += 1
                    added += 1

            completed_queries.add(query)
            query_count += 1

            # Progress every 10 queries
            if query_count % 10 == 0:
                elapsed = time.time() - start_time
                rate = new_count / max(elapsed, 1) * 3600
                print(f"  [{query_count}/{len(remaining_queries)}] "
                      f"Total: {len(seen):,} repos (+{new_count:,} new) | "
                      f"Rate: {rate:,.0f}/hr | "
                      f"Query: {query[:60]}")

            # Checkpoint every 50 queries
            if query_count % 50 == 0:
                out_file.flush()
                checkpoint_path.write_text(json.dumps({
                    "completed_queries": list(completed_queries),
                    "total_discovered": len(seen),
                    "timestamp": datetime.datetime.now().isoformat(),
                }))

        # Final flush
        out_file.flush()
        out_file.close()

    except KeyboardInterrupt:
        print("\nInterrupted. Saving checkpoint...")
        out_file.flush()
        out_file.close()

    # Save final checkpoint
    checkpoint_path.write_text(json.dumps({
        "completed_queries": list(completed_queries),
        "total_discovered": len(seen),
        "timestamp": datetime.datetime.now().isoformat(),
    }))

    elapsed = time.time() - start_time
    print(f"\nDiscovery complete:")
    print(f"  Total unique repos: {len(seen):,}")
    print(f"  New repos this run: {new_count:,}")
    print(f"  Queries executed: {query_count}")
    print(f"  Time: {elapsed/60:.1f} min")
    print(f"  Output: {output}")


if __name__ == "__main__":
    main()
