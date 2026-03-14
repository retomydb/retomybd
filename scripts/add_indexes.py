#!/usr/bin/env python3
"""Add performance indexes for browse queries on 894K+ models."""
import pyodbc

CONN = 'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;Encrypt=yes;'
conn = pyodbc.connect(CONN, timeout=10)
conn.autocommit = True
cur = conn.cursor()

indexes = [
    # Covering index for the default browse: WHERE DeletedAt IS NULL AND RepoType='model' AND Private=0 ORDER BY Trending DESC
    (
        "IX_Repos_Browse_Default",
        "retomy.Repositories",
        """CREATE NONCLUSTERED INDEX IX_Repos_Browse_Default
           ON retomy.Repositories (RepoType, Private, Trending DESC)
           INCLUDE (OwnerId, OwnerType, Name, Slug, Description, PricingModel, Price,
                    LicenseType, TotalDownloads, TotalLikes, TotalViews, LastCommitAt, CreatedAt, UpdatedAt)
           WHERE DeletedAt IS NULL"""
    ),
    # Index on ModelMetadata for the JOIN
    (
        "IX_ModelMeta_RepoId_Cols",
        "retomy.ModelMetadata",
        """CREATE NONCLUSTERED INDEX IX_ModelMeta_RepoId_Cols
           ON retomy.ModelMetadata (RepoId)
           INCLUDE (Framework, Task, Library, Architecture, Language, ParameterCount,
                    PipelineTag, HostingType, OriginalModelId, GithubStars)"""
    ),
]

for name, table, ddl in indexes:
    # Check if exists
    cur.execute(f"SELECT 1 FROM sys.indexes WHERE name = '{name}'")
    if cur.fetchone():
        print(f"  SKIP {name} (already exists)")
        continue
    print(f"  CREATE {name} on {table} ...")
    try:
        cur.execute(ddl)
        print(f"  OK {name}")
    except Exception as e:
        print(f"  FAIL {name}: {e}")

print("\nDone.")
conn.close()
