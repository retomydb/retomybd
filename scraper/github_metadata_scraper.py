#!/usr/bin/env python3
"""
Metadata-only GitHub scraper (HTML-only).

Fetches repository pages from GitHub search results and extracts metadata
useful for ingesting AI model entries into retomY. Does NOT download any
model weights or large files — only captures metadata and asset URLs.

Usage:
  python3 github_metadata_scraper.py --query "topic:transformers model" --max 100 --out out.jsonl

Notes:
 - Honor rate limits; set GITHUB_TOKEN env var to include an Authorization header
   (this script still uses HTML pages, not the REST API).
 - This is a best-effort scraper; HTML structure can change. Inspect logs when
   results look incorrect.
"""
import argparse
import json
import os
import random
import re
import sys
import time
from typing import List

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "retomy-github-scraper/1.0 (+contact@retomy.example)"
}


def build_search_url(query: str, page: int = 1) -> str:
    q = requests.utils.quote(query)
    return f"https://github.com/search?q={q}&type=repositories&p={page}"


def fetch(url: str, session: requests.Session, timeout: int = 15) -> str:
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text


def parse_search_page(html: str) -> List[str]:
    """Return list of repo URLs found on a GitHub search results page."""
    soup = BeautifulSoup(html, "lxml")
    links = []
    # Try well-known selector
    for a in soup.select('a.v-align-middle'):
        href = a.get('href')
        if href and href.count('/') >= 2:
            links.append('https://github.com' + href.strip())
    # Fallback: repo-list items
    if not links:
        for a in soup.select('ul.repo-list li a'):
            href = a.get('href')
            if href and href.count('/') >= 2:
                links.append('https://github.com' + href.strip())
    # Dedupe while preserving order
    seen = set()
    out = []
    for l in links:
        if l not in seen:
            seen.add(l)
            out.append(l)
    return out


def extract_repo_metadata(html: str, repo_url: str) -> dict:
    soup = BeautifulSoup(html, 'lxml')
    meta = {}
    meta['repo_url'] = repo_url
    # Owner/name
    m = re.match(r'https?://github.com/([^/]+)/([^/]+)$', repo_url.rstrip('/'))
    if m:
        meta['owner'] = m.group(1)
        meta['name'] = m.group(2)
        meta['slug'] = f"{meta['owner']}/{meta['name']}"

    # Description
    desc = None
    d = soup.find('p', attrs={'class': re.compile(r'.*f4.*')})
    if d:
        desc = d.get_text(strip=True)
    if not desc:
        og = soup.select_one('meta[property="og:description"]')
        if og and og.get('content'):
            desc = og['content']
    meta['description'] = desc

    # Topics
    topics = [t.get_text(strip=True) for t in soup.select('a.topic-tag')]
    meta['topics'] = topics

    # Stars and forks
    def parse_count(sel):
        el = soup.select_one(sel)
        if el:
            text = el.get_text(strip=True).replace(',', '')
            try:
                # handle shorthand like 1.2k
                if text.endswith('k'):
                    return int(float(text[:-1]) * 1000)
                return int(text)
            except Exception:
                return text
        return None

    meta['stars'] = parse_count('a[href$="/stargazers"]')
    meta['forks'] = parse_count('a[href$="/network/members."]') or parse_count('a[href$="/network/members"]')

    # License
    license_el = soup.select_one('a[href$="/blob/master/LICENSE"], a[href$="/blob/main/LICENSE"]')
    if license_el:
        meta['license'] = license_el.get_text(strip=True)
    else:
        # fallback: look for license summary
        lic = soup.select_one('summary[aria-label="Repository details"] ~ div a[href*="LICENSE"]')
        meta['license'] = lic.get_text(strip=True) if lic else None

    # Last updated
    rt = soup.select_one('relative-time')
    meta['last_updated'] = rt['datetime'] if rt and rt.has_attr('datetime') else None

    # README snippet
    readme = soup.select_one('#readme')
    if readme:
        txt = readme.get_text(separator='\n', strip=True)
        meta['readme_snippet'] = txt[:2000]
    else:
        meta['readme_snippet'] = None

    return meta


def fetch_releases(session: requests.Session, repo_url: str) -> List[dict]:
    releases_url = repo_url.rstrip('/') + '/releases'
    try:
        html = fetch(releases_url, session)
    except Exception:
        return []
    soup = BeautifulSoup(html, 'lxml')
    assets = []
    for a in soup.select('a[href*="/releases/download/"]'):
        href = a.get('href')
        name = a.get_text(strip=True)
        if href:
            assets.append({'name': name or os.path.basename(href), 'url': requests.compat.urljoin('https://github.com', href)})
    return assets


def normalize_for_retomy(meta: dict) -> dict:
    """Map fields into a shape similar to retomY's `Repositories` + `ModelMetadata` minimal fields."""
    return {
        'RepoUrl': meta.get('repo_url'),
        'Name': meta.get('name'),
        'Slug': meta.get('slug'),
        'Description': meta.get('description'),
        'Owner': meta.get('owner'),
        'Topics': meta.get('topics'),
        'License': meta.get('license'),
        'Stars': meta.get('stars'),
        'Forks': meta.get('forks'),
        'LastUpdated': meta.get('last_updated'),
        'ReadmeSnippet': meta.get('readme_snippet'),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--query', '-q', required=True, help='GitHub search query (HTML search, e.g. "topic:transformers model")')
    parser.add_argument('--max', type=int, default=100, help='Maximum number of repos to collect')
    parser.add_argument('--out', default='github_models.jsonl', help='Output JSONL file')
    parser.add_argument('--delay', type=float, default=1.0, help='Base delay between requests (seconds)')
    parser.add_argument('--dry', action='store_true', help='Dry run: print results instead of writing')
    args = parser.parse_args()

    token = os.environ.get('GITHUB_TOKEN')
    session = requests.Session()
    session.headers.update(HEADERS)
    if token:
        session.headers.update({'Authorization': f'token {token}'})

    collected = 0
    page = 1
    seen = set()

    out_f = None
    if not args.dry:
        out_f = open(args.out, 'w', encoding='utf-8')

    try:
        while collected < args.max:
            url = build_search_url(args.query, page=page)
            try:
                html = fetch(url, session)
            except Exception as e:
                print(f"Failed to fetch search page {url}: {e}", file=sys.stderr)
                break

            repo_urls = parse_search_page(html)
            if not repo_urls:
                break

            for repo_url in repo_urls:
                if collected >= args.max:
                    break
                if repo_url in seen:
                    continue
                seen.add(repo_url)

                try:
                    repo_html = fetch(repo_url, session)
                    meta = extract_repo_metadata(repo_html, repo_url)
                    releases = fetch_releases(session, repo_url)
                    meta['releases'] = releases
                    norm = normalize_for_retomy(meta)
                    if args.dry:
                        print(json.dumps({'meta': meta, 'norm': norm}, ensure_ascii=False))
                    else:
                        out_f.write(json.dumps({'meta': meta, 'norm': norm}, ensure_ascii=False) + '\n')
                    collected += 1
                except Exception as e:
                    print(f"Error processing {repo_url}: {e}", file=sys.stderr)

                # polite delay
                time.sleep(args.delay + random.random() * 0.5)

            page += 1
            time.sleep(args.delay * 2)

    finally:
        if out_f:
            out_f.close()

    print(f"Collected {collected} repos")


if __name__ == '__main__':
    main()
