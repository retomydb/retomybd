"""Example scraper that demonstrates inserting rows into the `datasets` table.

Adapt `fetch_items()` to implement real scraping/parsing logic.
"""
from typing import List


def fetch_items() -> List[dict]:
    # Placeholder example. Replace this with real scraping code (requests / aiohttp + BeautifulSoup)
    return [
        {"title": "Example Dataset A", "description": "Demo dataset A", "source_url": "https://example.com/a"},
        {"title": "Example Dataset B", "description": "Demo dataset B", "source_url": "https://example.com/b"},
    ]


def run_example():
    items = fetch_items()
    for it in items:
        row = {
            "name": it.get("title"),
            "description": it.get("description"),
            "source_url": it.get("source_url"),
        }
        try:
            # import DB helper lazily so running other scraper commands doesn't require DB
            from scraper.db import insert_into_table
            insert_into_table('datasets', row)
            print('Inserted:', row.get('name'))
        except Exception as e:
            print('Insert failed:', e)
