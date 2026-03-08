#!/usr/bin/env python3
"""Entry point for the scraper project."""
import argparse
import json
import requests
from scraper.example_scraper import run_example
from scraper.importer import HFImporter, import_from_file, ScrapedImporter, import_scraped_json


def browse_hf_models(args):
    """Browse trending / popular models on HuggingFace."""
    sort_map = {
        "trending": "trendingScore",
        "downloads": "downloads",
        "likes": "likes",
        "modified": "lastModified",
    }
    params = {
        "sort": sort_map.get(args.sort, "trendingScore"),
        "limit": str(args.limit or 20),
    }
    if args.task:
        params["pipeline_tag"] = args.task
    if args.library:
        params["library"] = args.library
    if args.search:
        params["search"] = args.search

    url = "https://huggingface.co/api/models"
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    models = r.json()

    print(f"\n{'#':<4} {'Model ID':<45} {'Task':<25} {'Downloads':<12} {'Likes':<8}")
    print("-" * 95)
    for i, m in enumerate(models, 1):
        mid = m.get("id", "?")
        task = m.get("pipeline_tag", "—")
        dl = m.get("downloads", 0)
        likes = m.get("likes", 0)
        print(f"{i:<4} {mid:<45} {task:<25} {dl:<12} {likes:<8}")

    if args.output:
        ids = [m["id"] for m in models]
        with open(args.output, "w") as f:
            f.write("\n".join(ids))
        print(f"\nSaved {len(ids)} model IDs to {args.output}")


def main():
    parser = argparse.ArgumentParser(description='retomY Scraper — Import models from Hugging Face & other sources')
    sub = parser.add_subparsers(dest='command')

    sub.add_parser('run_example', help='Run example scraper')

    # ── browse_hf: discover models ─────────────────────────────────────
    pb = sub.add_parser('browse_hf', help='Browse/search models on Hugging Face')
    pb.add_argument('--sort', choices=['trending', 'downloads', 'likes', 'modified'],
                    default='trending', help='Sort order (default: trending)')
    pb.add_argument('--task', help='Filter by pipeline_tag (e.g. text-generation)')
    pb.add_argument('--library', help='Filter by library (e.g. transformers)')
    pb.add_argument('--search', help='Free text search query')
    pb.add_argument('--limit', type=int, default=20, help='Max results (default: 20)')
    pb.add_argument('--output', '-o', help='Save model IDs to file (for use with import_hf --file)')

    # ── import_hf: import models with rich metadata ────────────────────
    p = sub.add_parser('import_hf', help='Import models from Hugging Face with rich metadata')
    p.add_argument('--model', '-m', action='append', help='Model id on Hugging Face (e.g. "facebook/opt-350m")')
    p.add_argument('--file', '-f', help='Path to newline-separated file with model ids')
    p.add_argument('--limit', type=int, default=None, help='Limit number of models processed')
    p.add_argument('--apply', action='store_true', help='Apply changes (requires --owner-id)')
    p.add_argument('--owner-id', help='Owner UserId to assign imported repos to (required when --apply)')
    p.add_argument('--token', help='HuggingFace API token (for gated models / higher rate limits)')

    # ── import_scraped: import from local JSON ─────────────────────────
    p2 = sub.add_parser('import_scraped', help='Import models from a scraped JSON file')
    p2.add_argument('--file', '-f', help='Path to JSON file (list or newline JSON objects)')
    p2.add_argument('--limit', type=int, default=None, help='Limit number of models processed')
    p2.add_argument('--apply', action='store_true', help='Apply changes (requires --owner-id)')
    p2.add_argument('--owner-id', help='Owner UserId to assign imported repos to (required when --apply)')

    # ── preview: dry-run a single model to see extracted metadata ──────
    pp = sub.add_parser('preview', help='Preview extracted metadata for a single HF model (no DB)')
    pp.add_argument('model', help='Model id (e.g. "meta-llama/Llama-2-7b")')
    pp.add_argument('--token', help='HuggingFace API token')

    args = parser.parse_args()

    if args.command == 'run_example':
        run_example()

    elif args.command == 'browse_hf':
        browse_hf_models(args)

    elif args.command == 'import_hf':
        ids = []
        if args.model:
            ids += args.model
        if args.file:
            ids += import_from_file(args.file)
        if not ids:
            print('No models provided. Use --model or --file.')
            return
        importer = HFImporter(hf_token=getattr(args, 'token', None))
        dry = not args.apply
        owner = args.owner_id
        if dry:
            print(f"DRY RUN — processing {len(ids)} model(s). Add --apply to insert into DB.\n")
        res = importer.run(ids, dry_run=dry, owner_id=owner, limit=args.limit)
        print(f"\nDone. {sum(1 for r in res if 'error' not in r)} succeeded, "
              f"{sum(1 for r in res if 'error' in r)} failed.")

    elif args.command == 'import_scraped':
        if not args.file:
            print('Please provide --file path to scraped JSON file')
            return
        items = import_scraped_json(args.file)
        if not items:
            print('No items found in file')
            return
        importer = ScrapedImporter()
        dry = not args.apply
        owner = args.owner_id
        res = importer.run(items, dry_run=dry, owner_id=owner, limit=args.limit)
        for r in res:
            print(r)

    elif args.command == 'preview':
        from scraper.hf_client import HFClient
        client = HFClient(token=getattr(args, 'token', None))
        data = client.fetch_model(args.model)
        # Print a clean summary
        print(f"\n{'='*60}")
        print(f"Model:        {data['model_id']}")
        print(f"Pipeline Tag: {data.get('pipeline_tag', '—')}")
        print(f"Task:         {data.get('task', '—')}")
        print(f"Framework:    {data.get('framework', '—')}")
        print(f"Library:      {data.get('library', '—')}")
        print(f"Architecture: {data.get('architecture', '—')}")
        print(f"Language:     {data.get('language', '—')}")
        print(f"Base Model:   {data.get('base_model', '—')}")
        print(f"Parameters:   {data.get('parameter_count', '—')}")
        print(f"Tensor Type:  {data.get('tensor_type', '—')}")
        print(f"SafeTensors:  {data.get('safetensors', False)}")
        print(f"License:      {data.get('license', '—')}")
        print(f"Downloads:    {data.get('downloads', 0):,}")
        print(f"Likes:        {data.get('likes', 0):,}")
        print(f"Inference:    {data.get('inference_enabled', False)}")
        print(f"Files:        {len(data.get('files', []))} files")
        print(f"README:       {'yes' if data.get('readme') else 'no'} ({len(data.get('readme') or '')} chars)")
        print(f"{'='*60}")

        # Print usage snippets
        snippets = json.loads(data.get('usage_snippets', '{}'))
        if snippets:
            print(f"\n── Usage Snippets ──")
            for key, code in snippets.items():
                print(f"\n[{key}]")
                print(code)
        print()

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
