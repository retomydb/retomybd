# Scaling GitHub Model Harvesting to 500k Repositories

Goal: collect ~500,000 candidate model-like repositories from GitHub and ingest metadata + README into the retomY pipeline.

Summary (short)
- Use BigQuery public GitHub dataset to select candidate repos at scale (fast, no API rate limits).
- For each selected repo, fetch latest metadata + README via GitHub API (or mirror via GHTorrent/Archive if available).
- Use token-rotation and worker pools to stay within GitHub rate limits while doing the final fetches.

Key constraints
- GitHub Search API: 1,000 results per query → requires partitioning or BigQuery.
- GitHub REST API rate limit: 5k requests/hour per token (authenticated). Unauthenticated: 60/hr.
- Large scale fetching will take substantial time and infra (storage, DB writes, retry logic).

BigPicture Approach (recommended)
1. Selection phase (fast): Use BigQuery public GitHub dataset to run SQL and produce the list of candidate repos matching heuristics (topics, filenames, README content, stars, languages). This avoids search API limits and is O(seconds) to O(minutes).
2. Fetch phase (IO-heavy): For each repo from selection, fetch via GitHub REST API the repo metadata and README (use `GET /repos/{owner}/{repo}` and `GET /repos/{owner}/{repo}/readme` with Accept: raw). Use multiple tokens + worker pool to parallelize but respect per-token rate limits.
3. Ingestion phase: Normalize entries into the `scraper` JSONL shape and feed into the existing adapter/importer with dedupe checks.

Partitioning & de-duplication
- Partition selection by: year of creation, primary language, topic, or repo name prefix. Generate buckets that each return <= ~1M rows to keep downstream manageable.
- Deduplicate by repo full name (owner/repo). Keep a canonical source (OriginalModelId or GithubRepoUrl).

Token rotation & worker design
- Maintain a token pool (list of PATs). Each worker obtains a token lease for a fixed window (e.g., 60s) and performs up to N requests based on observed remaining quota.
- Track per-token remaining quota via `X-RateLimit-Remaining` headers and avoid exhausting a token.
- Use a central job queue (Redis/RabbitMQ) with idempotent tasks (repo full name). Workers report status and errors; retries use exponential backoff and a max retry cap.

Estimate & resources
- Readme + metadata per repo ≈ 5–20 KB; 500k ⇒ 2.5–10 GB raw text storage. DB/wider indexing increases size.
- API calls: ~2 calls/repo → 1M calls. With 10 tokens (5k each) = 50k/hour → ~20 hours. With 50 tokens → ~4 hours.
- Compute: modest (dozens–hundreds of workers depending on token count). Use autoscaling containers.

Monitoring & observability
- Track metrics: processed_count, success_count, fail_count (per error category), per-token rate usage, per-worker throughput.
- Store raw responses (or a hash) to enable re-run without refetch.

Failure modes & mitigations
- Abuse detection (GitHub): slow down, add random jitter, and use a pool of IPs if necessary (but check GitHub TOS).
- Partial data: mark rows with fetch state and retry later.

Prototype steps (what I'll provide next)
- SQL templates for BigQuery selection (examples by topic/filename/README keyword).
- A small Python script `tools/bq_repo_selector.py` that runs a provided SQL query against BigQuery and writes JSONL of candidate repo owner/repo pairs.
- A worker skeleton showing token rotation and fetch logic for README + metadata.

Security & compliance
- Store GitHub tokens in a secrets manager; rotate tokens periodically.
- Rate-limit and respect robots and GitHub Terms of Service. Prefer API + BigQuery over raw HTML scraping.

Roadmap (phased)
1. Prototype selection using BigQuery (small runs).
2. Build fetch worker + token rotation + ingestion pipeline; run on a 10k sample.
3. Scale tokens/workers; monitor and iterate until target throughput achieved.

If you want, I'll now add the BigQuery prototype script and a worker skeleton for token-rotation fetches.
