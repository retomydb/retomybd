#!/usr/bin/env python3
"""Check indexes and query performance."""
import pyodbc, time

CONN = 'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;Encrypt=yes;'
conn = pyodbc.connect(CONN, timeout=5)
cur = conn.cursor()

# Check existing indexes on Repositories
cur.execute("""
SELECT i.name, i.type_desc, STRING_AGG(c.name, ', ') AS columns
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('retomy.Repositories')
GROUP BY i.name, i.type_desc
ORDER BY i.name
""")
print('=== Repositories Indexes ===')
for r in cur.fetchall():
    print(f'  {r[0]} ({r[1]}): {r[2]}')

# Check indexes on ModelMetadata
cur.execute("""
SELECT i.name, i.type_desc, STRING_AGG(c.name, ', ') AS columns
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('retomy.ModelMetadata')
GROUP BY i.name, i.type_desc
ORDER BY i.name
""")
print('\n=== ModelMetadata Indexes ===')
for r in cur.fetchall():
    print(f'  {r[0]} ({r[1]}): {r[2]}')

# Time the count query (the slow one)
t0 = time.time()
cur.execute("""
SELECT COUNT(*) AS cnt
FROM retomy.Repositories r
LEFT JOIN retomy.ModelMetadata mm ON mm.RepoId = r.RepoId
WHERE r.DeletedAt IS NULL AND r.RepoType = 'model' AND r.Private = 0
""")
cnt = cur.fetchone()[0]
t1 = time.time()
print(f'\n=== COUNT with JOIN: {cnt} rows in {t1-t0:.2f}s ===')

# Count without join
t0 = time.time()
cur.execute("""
SELECT COUNT(*) AS cnt
FROM retomy.Repositories r
WHERE r.DeletedAt IS NULL AND r.RepoType = 'model' AND r.Private = 0
""")
cnt = cur.fetchone()[0]
t1 = time.time()
print(f'=== COUNT no JOIN: {cnt} rows in {t1-t0:.2f}s ===')

# Data query with pagination
t0 = time.time()
cur.execute("""
SELECT r.RepoId, r.Name, r.Slug, r.Description, r.TotalDownloads, r.Trending
FROM retomy.Repositories r
LEFT JOIN retomy.ModelMetadata mm ON mm.RepoId = r.RepoId
LEFT JOIN retomy.Users u ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
WHERE r.DeletedAt IS NULL AND r.RepoType = 'model' AND r.Private = 0
ORDER BY r.Trending DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
""")
rows = cur.fetchall()
t1 = time.time()
print(f'=== Data query (page 1, 20 rows): {len(rows)} rows in {t1-t0:.2f}s ===')

conn.close()
