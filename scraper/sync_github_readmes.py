#!/usr/bin/env python3
"""Sync GitHub README and metadata into retomy.ModelMetadata for github-hosted rows.

Usage:
  python3 sync_github_readmes.py --limit 200

Reads DB rows where HostingType='github' and GithubReadme IS NULL or empty,
then calls GitHub API to fetch repo info and README and updates the DB.
"""
import argparse
import time
import re
import os
import pyodbc
import requests

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;"
    "DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;Encrypt=yes;"
)


def parse_github_url(url: str):
    if not url:
        return None, None
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", url.strip())
    if not m:
        return None, None
    return m.group(1), m.group(2)


def get_candidates(conn, limit=200):
    cur = conn.cursor()
    sql = ("SELECT r.RepoId, r.Name, mm.OriginalModelId, mm.GithubRepoUrl, mm.GithubOwner, mm.GithubRepoName, r.SourceUrl "
           "FROM retomy.ModelMetadata mm "
           "JOIN retomy.Repositories r ON r.RepoId = mm.RepoId "
           "WHERE mm.HostingType = 'github' AND (mm.GithubReadme IS NULL OR LTRIM(RTRIM(mm.GithubReadme)) = '') "
           "ORDER BY mm.ScraperFetchedAt DESC")
    if limit:
        sql = sql + f" OFFSET 0 ROWS FETCH NEXT {limit} ROWS ONLY"
    cur.execute(sql)
    return cur.fetchall()


def ensure_columns(conn, table, col_specs):
    """Add columns to a table if they don't exist yet."""
    cur = conn.cursor()
    for col, sqltype in col_specs:
        cur.execute(f"SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('{table}') AND name = ?", [col])
        if not cur.fetchone():
            try:
                cur.execute(f"ALTER TABLE {table} ADD [{col}] {sqltype} NULL")
                conn.commit()
                print(f"  Added column {table}.{col} ({sqltype})")
            except Exception as e:
                conn.rollback()
                print(f"  WARN: could not add {table}.{col}: {e}")


# New ModelMetadata columns we want (beyond the migration-007 set)
EXTRA_MM_COLS = [
    ('GithubForks', 'INT'),
    ('GithubWatchers', 'INT'),
    ('GithubOpenIssues', 'INT'),
    ('GithubSizeKB', 'INT'),
    ('GithubLanguage', 'NVARCHAR(200)'),
    ('GithubLanguages', 'NVARCHAR(2000)'),
    ('GithubHomepage', 'NVARCHAR(500)'),
    ('GithubIsFork', 'BIT'),
    ('GithubIsArchived', 'BIT'),
    ('GithubCreatedAt', 'NVARCHAR(50)'),
    ('GithubPushedAt', 'NVARCHAR(50)'),
    ('GithubUpdatedAt', 'NVARCHAR(50)'),
    ('GithubLicense', 'NVARCHAR(100)'),
]


def update_metadata(conn, repo_id, mm_updates: dict, repo_updates: dict = None):
    """Write metadata to ModelMetadata and Repositories."""
    # Ensure extra columns exist
    ensure_columns(conn, 'retomy.ModelMetadata', EXTRA_MM_COLS)

    cur = conn.cursor()
    if mm_updates:
        cols = ", ".join(f"[{k}] = ?" for k in mm_updates.keys())
        sql = f"UPDATE retomy.ModelMetadata SET {cols}, GithubLastSyncAt = GETDATE() WHERE RepoId = ?"
        vals = list(mm_updates.values()) + [repo_id]
        cur.execute(sql, vals)

    if repo_updates:
        cols = ", ".join(f"[{k}] = ?" for k in repo_updates.keys())
        sql = f"UPDATE retomy.Repositories SET {cols}, UpdatedAt = GETDATE() WHERE RepoId = ?"
        vals = list(repo_updates.values()) + [repo_id]
        cur.execute(sql, vals)

    conn.commit()


def fetch_repo_and_readme(owner, repo, headers):
    """Fetch ALL available metadata from GitHub API for a repo."""
    base = f"https://api.github.com/repos/{owner}/{repo}"
    r1 = requests.get(base, headers=headers, timeout=15)
    if r1.status_code != 200:
        return None
    info = r1.json()

    # ── Core metadata ──
    stars = info.get('stargazers_count', 0)
    forks = info.get('forks_count', 0)
    watchers = info.get('subscribers_count', 0)  # true watchers
    open_issues = info.get('open_issues_count', 0)
    size_kb = info.get('size', 0)
    language = info.get('language') or ''
    default_branch = info.get('default_branch') or 'main'
    topics = ",".join(info.get('topics', []))
    desc = info.get('description') or ''
    html_url = info.get('html_url') or ''
    homepage = info.get('homepage') or ''
    is_fork = info.get('fork', False)
    is_archived = info.get('archived', False)
    created_at = info.get('created_at')   # ISO 8601
    pushed_at = info.get('pushed_at')     # ISO 8601
    updated_at_gh = info.get('updated_at')  # ISO 8601

    # License
    license_spdx = None
    lic = info.get('license')
    if isinstance(lic, dict):
        license_spdx = lic.get('spdx_id') or lic.get('name')

    # ── README (raw markdown) ──
    r2 = requests.get(base + "/readme",
                      headers={**headers, 'Accept': 'application/vnd.github.v3.raw'},
                      timeout=15)
    readme = None
    if r2.status_code == 200:
        readme = r2.text[:200000]

    # ── Languages breakdown ──
    languages = {}
    try:
        r3 = requests.get(base + "/languages", headers=headers, timeout=10)
        if r3.status_code == 200:
            languages = r3.json()  # {"Python": 45000, "Shell": 200, ...}
    except Exception:
        pass
    languages_str = ",".join(f"{k}:{v}" for k, v in languages.items()) if languages else ''

    return {
        'description': desc,
        'html_url': html_url,
        'readme': readme,
        'stars': stars,
        'forks': forks,
        'watchers': watchers,
        'open_issues': open_issues,
        'size_kb': size_kb,
        'language': language,
        'languages': languages_str,
        'default_branch': default_branch,
        'topics': topics,
        'homepage': homepage,
        'is_fork': is_fork,
        'is_archived': is_archived,
        'created_at': created_at,
        'pushed_at': pushed_at,
        'updated_at_gh': updated_at_gh,
        'license_spdx': license_spdx,
    }


def build_updates(info: dict, owner: str, repo: str):
    """Map fetched GitHub info → (ModelMetadata updates, Repositories updates)."""
    mm = {
        # ── Existing migration-007 columns ──
        'GithubStars': info['stars'],
        'GithubTopics': info['topics'],
        'GithubReadme': info['readme'],
        'GithubRepoUrl': info['html_url'],
        'GithubOwner': owner,
        'GithubRepoName': repo,
        'GithubBranch': info['default_branch'],
        # ── New extended columns (auto-created) ──
        'GithubForks': info['forks'],
        'GithubWatchers': info['watchers'],
        'GithubOpenIssues': info['open_issues'],
        'GithubSizeKB': info['size_kb'],
        'GithubLanguage': info['language'],
        'GithubLanguages': info['languages'],
        'GithubHomepage': info['homepage'],
        'GithubIsFork': 1 if info['is_fork'] else 0,
        'GithubIsArchived': 1 if info['is_archived'] else 0,
        'GithubCreatedAt': info['created_at'],
        'GithubPushedAt': info['pushed_at'],
        'GithubUpdatedAt': info['updated_at_gh'],
        'GithubLicense': info['license_spdx'],
    }

    # Also populate enrichment hints if we can infer them
    if info['language']:
        mm['Language'] = info['language']

    # ── Repositories table updates ──
    repo_upd = {}
    if info['description']:
        repo_upd['Description'] = info['description'][:2000]
    if info['license_spdx']:
        repo_upd['LicenseType'] = info['license_spdx']
    if info['default_branch']:
        repo_upd['DefaultBranch'] = info['default_branch']
    if info['pushed_at']:
        repo_upd['LastCommitAt'] = info['pushed_at']
    if info['topics']:
        repo_upd['Tags'] = info['topics']
    if info['html_url']:
        repo_upd['SourceUrl'] = info['html_url']

    return mm, repo_upd


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=200)
    parser.add_argument('--delay', type=float, default=1.0, help='seconds between requests')
    parser.add_argument('--single-repo', default=None, help='Optional owner/repo to fetch and update immediately')
    parser.add_argument('--repo-id', default=None, help='Optional RepoId to update when using --single-repo')
    args = parser.parse_args()

    token = os.environ.get('GITHUB_TOKEN')
    headers = {'User-Agent': 'retomY-sync-script'}
    if token:
        headers['Authorization'] = f'token {token}'

    conn = pyodbc.connect(CONN_STR)

    if args.single_repo:
        # single repo mode: attempt to resolve repo_id if not provided
        owner_repo = args.single_repo
        if '/' not in owner_repo:
            print('Invalid --single-repo value, expected owner/repo')
            return
        owner, repo = owner_repo.split('/', 1)
        repo_id = args.repo_id
        if not repo_id:
            # try to find RepoId from ModelMetadata/Repositories
            cur = conn.cursor()
            sql = ("SELECT mm.RepoId FROM retomy.ModelMetadata mm JOIN retomy.Repositories r ON r.RepoId = mm.RepoId "
                   "WHERE (mm.GithubOwner = ? AND mm.GithubRepoName = ?) "
                   "OR (mm.GithubRepoUrl LIKE ?) "
                   "OR (mm.OriginalModelId = ?) "
                   "OR (r.SourceUrl LIKE ?)")
            like_url = f"%github.com/{owner}/{repo}%"
            cur.execute(sql, [owner, repo, like_url, f"{owner}/{repo}", like_url])
            row = cur.fetchone()
            if row:
                repo_id = row[0]

        print(f"Fetching single repo {owner}/{repo} (RepoId={repo_id})...")
        info = fetch_repo_and_readme(owner, repo, headers)
        if not info:
            print(f"Failed to fetch {owner}/{repo}")
            conn.close()
            return

        mm_updates, repo_updates = build_updates(info, owner, repo)
        if repo_id:
            update_metadata(conn, repo_id, mm_updates, repo_updates)
            print(f"Updated {repo_id} ({owner}/{repo})")
        else:
            print("No RepoId found; not updating DB. Use --repo-id to force update.")

        conn.close()
        return

    rows = get_candidates(conn, limit=args.limit)
    print(f"Found {len(rows)} github-hosted models missing README")

    updated = 0
    for r in rows:
        repo_id, name, orig, gh_url, gh_owner, gh_reponame, source_url = r
        owner, repo = None, None
        if gh_owner and gh_reponame:
            owner, repo = gh_owner, gh_reponame
        elif gh_url:
            owner, repo = parse_github_url(gh_url)
        elif orig and '/' in orig:
            owner, repo = orig.split('/', 1)
        elif source_url:
            owner, repo = parse_github_url(source_url)

        if not owner:
            print(f"Skipping {repo_id}: no owner/repo")
            continue

        print(f"Fetching {owner}/{repo}...")
        info = fetch_repo_and_readme(owner, repo, headers)
        if not info:
            print(f"Failed to fetch {owner}/{repo}")
            time.sleep(args.delay)
            continue

        mm_updates, repo_updates = build_updates(info, owner, repo)
        update_metadata(conn, repo_id, mm_updates, repo_updates)
        updated += 1
        print(f"Updated {repo_id} ({owner}/{repo})")
        time.sleep(args.delay)

    conn.close()
    print(f"Done. Updated {updated} rows.")


if __name__ == '__main__':
    main()
