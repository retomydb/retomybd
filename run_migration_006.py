"""Run migration 006 — HuggingFace Hub tables"""
import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;',
    autocommit=True
)
cur = conn.cursor()

with open('database/migrations/006_huggingface_expansion.sql', 'r') as f:
    sql = f.read()

# Split on GO and execute each batch
batches = [b.strip() for b in sql.split('\nGO\n') if b.strip()]
for i, batch in enumerate(batches):
    lines = [l for l in batch.split('\n') if l.strip() and not l.strip().startswith('--')]
    if not lines:
        continue
    try:
        cur.execute(batch)
        print(f'Batch {i+1}: OK')
    except Exception as e:
        print(f'Batch {i+1}: ERROR - {e}')

# Verify
cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='retomy' ORDER BY TABLE_NAME")
tables = [r[0] for r in cur.fetchall()]
print(f'\nAll retomy tables ({len(tables)}):')
for t in tables:
    print(f'  {t}')

conn.close()
print('\nMigration complete.')
