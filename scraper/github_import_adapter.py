#!/usr/bin/env python3
"""Adapter: import GitHub-scraped JSONL into retomY via ScrapedImporter.

Reads lines of JSON (each line produced by `github_metadata_scraper.py`),
maps the `meta`/`norm` fields into the shape expected by
`scraper.importer.ScrapedImporter`, and runs the importer.

Usage:
  python3 github_import_adapter.py --input github_models.jsonl     # dry-run
  python3 github_import_adapter.py --input github_models.jsonl --apply --owner-id <OWNER>
"""
import argparse
import json
import os
import re
from typing import List

OWNER_ID_DEFAULT = "84C9D1F7-F3B0-46B3-9BA5-1441887D9F5B"


def parse_repo_url(url: str):
    """Return (owner, name) from a GitHub URL, or (None, None)."""
    if not url:
        return None, None
    m = re.match(r'https?://github.com/([^/]+)/([^/]+)', url.rstrip('/'))
    if not m:
        return None, None
    return m.group(1), m.group(2)


def map_norm_to_scraped_item(line_obj: dict) -> dict:
    """Map a single scraped JSON object (with `meta` and `norm`) to the
    format expected by `ScrapedImporter.prepare_rows_from_scraped()`.
    """
    meta = line_obj.get('meta') or {}
    norm = line_obj.get('norm') or {}

    repo_url = norm.get('RepoUrl') or meta.get('repo_url')
    owner, name = parse_repo_url(repo_url)
    model_id = f"{owner}/{name}" if owner and name else repo_url or norm.get('Slug')

    files = []
    for rel in meta.get('releases', []) if isinstance(meta.get('releases'), list) else []:
        url = rel.get('url') or rel.get('download_url') or rel.get('html_url')
        if url:
            files.append(url)

    item = {
        'model_id': model_id,
        'name': norm.get('Name') or name,
        'description': norm.get('Description') or meta.get('description'),
        'tags': norm.get('Topics') or meta.get('topics') or [],
        'license': norm.get('License') or meta.get('license'),
        'source_url': repo_url,
        'source': 'github',
        'readme': norm.get('ReadmeSnippet') or meta.get('readme_snippet'),
        'files': files,
        # optional metadata fields (best-effort)
        'framework': None,
        'task': None,
        'library': None,
        'architecture': None,
        'language': None,
        'base_model': None,
        'parameter_count': None,
        'tensor_type': None,
        'safetensors': False,
        'pipeline_tag': None,
        'inference_enabled': False,
        'eval_results': None,
        'usage_snippets': None,
        'hosting_type': 'github',
    }

    return item


def load_items_from_jsonl(path: str, limit: int = None) -> List[dict]:
    out = []
    with open(path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if limit and i >= limit:
                break
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                # allow bare lines that are already the `norm` dict
                try:
                    obj = {'norm': json.loads(line)}
                except Exception:
                    continue
            # if file contains raw `norm` only, wrap it
            if 'meta' not in obj and 'norm' not in obj:
                obj = {'norm': obj}
            item = map_norm_to_scraped_item(obj)
            out.append(item)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', '-i', default='github_models.jsonl', help='Input JSONL file')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of items to process')
    parser.add_argument('--apply', action='store_true', help='Apply inserts to DB (default: dry-run)')
    parser.add_argument('--owner-id', default=os.environ.get('OWNER_ID', OWNER_ID_DEFAULT), help='OwnerId to assign on insert')
    args = parser.parse_args()

    items = load_items_from_jsonl(args.input, limit=args.limit)
    print(f"Loaded {len(items)} items from {args.input}")

    # run importer
    from scraper.importer import ScrapedImporter
    importer = ScrapedImporter()

    if args.apply:
        print(f"Running importer: inserting {len(items)} items as owner {args.owner_id}")
        res = importer.run(items, dry_run=False, owner_id=args.owner_id, limit=args.limit)
    else:
        print("Dry-run: showing first 5 mapped items")
        for it in items[:5]:
            print(json.dumps(it, ensure_ascii=False))
        res = importer.run(items, dry_run=True, owner_id=None, limit=args.limit)

    print("Importer finished. Summary: ")
    # `res` is a list of results per item
    success = sum(1 for r in res if r.get('inserted') or r.get('repo_row'))
    errors = sum(1 for r in res if r.get('error'))
    print(f"  Mapped: {len(items)}, success-like: {success}, errors: {errors}")


if __name__ == '__main__':
    main()
