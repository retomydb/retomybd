import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;',
    autocommit=True
)
cur = conn.cursor()

with open('/Users/oladimejishodipe/retomY/database/migrations/007_github_models.sql', 'r') as f:
    sql = f.read()

for block in sql.split('\nGO\n'):
    block = block.strip()
    if block and not block.startswith('--'):
        try:
            cur.execute(block)
            print(f'OK: {block[:80]}...')
        except Exception as e:
            print(f'ERR: {e}')

cur.execute("""SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME='ModelMetadata' 
               ORDER BY ORDINAL_POSITION""")
cols = [r[0] for r in cur.fetchall()]
print(f'\nModelMetadata columns: {cols}')

cur.execute("""SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
               WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME='StorageSubscriptions'""")
st = cur.fetchall()
print(f'StorageSubscriptions table exists: {len(st) > 0}')

conn.close()
print('\nMigration 007 done')
