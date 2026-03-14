import pyodbc
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=retomY;"
    "UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;Encrypt=yes;"
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM retomy.ModelMetadata WHERE HostingType='huggingface'")
print(f"Total HF models now: {cur.fetchone()[0]:,}")
cur.execute(
    "SELECT TOP 5 OriginalModelId, Task, Framework, ParameterCount "
    "FROM retomy.ModelMetadata WHERE HostingType='huggingface' "
    "ORDER BY ScraperFetchedAt DESC"
)
for r in cur.fetchall():
    print(f"  {r[0]:40s} task={str(r[1]):30s} fw={str(r[2]):12s} params={r[3]}")
conn.close()
