"""
retomY — Enterprise Dataset Marketplace
Database Migration Runner
"""
import pyodbc
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment from root .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

MSSQL_HOST = os.getenv("MSSQL_HOST", "localhost")
MSSQL_PORT = os.getenv("MSSQL_PORT", "1433")
MSSQL_USER = os.getenv("MSSQL_USER", "sa")
MSSQL_PASSWORD = os.getenv("MSSQL_PASSWORD", "Prestige@123")
MSSQL_DATABASE = os.getenv("MSSQL_DATABASE", "retomY")
MSSQL_DRIVER = os.getenv("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server")

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def get_connection(database: str = "master"):
    """Get a connection to MSSQL."""
    conn_str = (
        f"DRIVER={{{MSSQL_DRIVER}}};"
        f"SERVER={MSSQL_HOST},{MSSQL_PORT};"
        f"DATABASE={database};"
        f"UID={MSSQL_USER};"
        f"PWD={MSSQL_PASSWORD};"
        f"TrustServerCertificate=yes;"
        f"Connection Timeout=30;"
    )
    return pyodbc.connect(conn_str, autocommit=True)


def ensure_database():
    """Create the retomY database if it doesn't exist."""
    print(f"🔗 Connecting to MSSQL at {MSSQL_HOST}:{MSSQL_PORT}...")
    conn = get_connection("master")
    cursor = conn.cursor()

    cursor.execute(f"""
        IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '{MSSQL_DATABASE}')
        BEGIN
            CREATE DATABASE [{MSSQL_DATABASE}];
        END
    """)
    print(f"✅ Database '{MSSQL_DATABASE}' ensured.")
    conn.close()


def ensure_migration_table():
    """Create migration tracking table."""
    conn = get_connection(MSSQL_DATABASE)
    cursor = conn.cursor()

    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'retomy')
        BEGIN
            EXEC('CREATE SCHEMA retomy');
        END
    """)

    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                       WHERE TABLE_SCHEMA = 'retomy' AND TABLE_NAME = 'MigrationHistory')
        BEGIN
            CREATE TABLE retomy.MigrationHistory (
                MigrationId     INT IDENTITY(1,1) PRIMARY KEY,
                FileName        NVARCHAR(255) NOT NULL UNIQUE,
                AppliedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                Checksum        NVARCHAR(64) NULL
            );
        END
    """)
    conn.close()
    print("✅ Migration tracking table ensured.")


def get_applied_migrations():
    """Get list of already applied migrations."""
    conn = get_connection(MSSQL_DATABASE)
    cursor = conn.cursor()

    cursor.execute("SELECT FileName FROM retomy.MigrationHistory ORDER BY MigrationId")
    applied = {row.FileName for row in cursor.fetchall()}
    conn.close()
    return applied


def run_migration(filename: str, sql: str):
    """Execute a migration file."""
    conn = get_connection(MSSQL_DATABASE)
    cursor = conn.cursor()

    # Split on GO statements for MSSQL batch processing
    batches = [b.strip() for b in sql.split("\nGO\n") if b.strip()]
    # Also handle GO at end of file
    if sql.strip().endswith("GO"):
        last = batches[-1] if batches else ""
        if last.endswith("GO"):
            batches[-1] = last[:-2].strip()

    for i, batch in enumerate(batches):
        if batch and batch.upper() != "GO":
            try:
                cursor.execute(batch)
            except Exception as e:
                print(f"  ❌ Error in batch {i + 1}: {e}")
                conn.close()
                raise

    # Record migration
    import hashlib
    checksum = hashlib.sha256(sql.encode()).hexdigest()[:16]
    cursor.execute(
        "INSERT INTO retomy.MigrationHistory (FileName, Checksum) VALUES (?, ?)",
        filename, checksum
    )
    conn.close()


def run_all_migrations():
    """Run all pending migrations."""
    ensure_database()
    ensure_migration_table()

    applied = get_applied_migrations()
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    if not migration_files:
        print("📂 No migration files found.")
        return

    pending = [f for f in migration_files if f.name not in applied]

    if not pending:
        print("✅ All migrations are up to date.")
        return

    print(f"\n📦 Found {len(pending)} pending migration(s):\n")

    for migration_file in pending:
        print(f"  ▶ Running: {migration_file.name}...")
        sql = migration_file.read_text(encoding="utf-8")

        try:
            run_migration(migration_file.name, sql)
            print(f"  ✅ {migration_file.name} applied successfully.")
        except Exception as e:
            print(f"  ❌ Failed: {migration_file.name}")
            print(f"     Error: {e}")
            sys.exit(1)

    print(f"\n🎉 All {len(pending)} migration(s) applied successfully!")


def rollback_last():
    """Remove the last applied migration record (manual rollback)."""
    conn = get_connection(MSSQL_DATABASE)
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM retomy.MigrationHistory
        WHERE MigrationId = (SELECT MAX(MigrationId) FROM retomy.MigrationHistory)
    """)
    print("⏪ Last migration record removed. Run manual SQL to undo schema changes.")
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_last()
    else:
        run_all_migrations()
