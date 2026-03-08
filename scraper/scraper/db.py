from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.orm import sessionmaker

from scraper.config import DATABASE_URL

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
metadata = MetaData()

def get_table(table_name: str) -> Table:
    """Reflect and return a SQLAlchemy Table object for `table_name`."""
    try:
        # Try reflecting the plain table name first (default schema)
        metadata.reflect(bind=engine, only=[table_name])
        return Table(table_name, metadata, autoload_with=engine)
    except Exception:
        # Fallback: try the 'retomy' schema (many tables live under retomy schema)
        try:
            metadata.reflect(bind=engine, only=[table_name], schema='retomy')
            return Table(table_name, metadata, schema='retomy', autoload_with=engine)
        except Exception:
            # Re-raise original error to surface helpful message
            raise

def insert_into_table(table_name: str, row_dict: dict):
    table = get_table(table_name)
    cols = {c.name for c in table.columns}
    filtered = {k: v for k, v in row_dict.items() if k in cols}
    with engine.begin() as conn:
        conn.execute(table.insert().values(**filtered))
