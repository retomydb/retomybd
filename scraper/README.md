# RetomY Scraper (standalone)

Lightweight independent scraper project to fetch external data and insert into the RetomY database schema.

Purpose
- Run scrapers independently from the main `retomy` app and push data into the same PostgreSQL database.

Quick start
1. Copy `.env.example` → `.env` and set `DATABASE_URL`.
2. Create a virtualenv and install deps:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Run the example scraper:

```bash
python -m scraper.main run_example
```

Notes
- This project intentionally does not import code from the main `retomy` repo. It reflects the DB schema at runtime using SQLAlchemy metadata reflection and inserts rows into existing tables.
- Adapt `scraper/example_scraper.py` to implement real site scraping and map fields to your DB schema.
