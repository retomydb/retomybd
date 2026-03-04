"""Fix Organizations + OrgMembers tables"""
import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=localhost,1433;'
    'DATABASE=retomY;'
    'UID=sa;'
    'PWD=Prestige@123;'
    'TrustServerCertificate=yes;',
    autocommit=True
)
cur = conn.cursor()

# Organizations
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Organizations')
BEGIN
    CREATE TABLE retomy.Organizations (
        OrgId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(100) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        AvatarUrl NVARCHAR(500) NULL,
        Description NVARCHAR(1000) NULL,
        Website NVARCHAR(300) NULL,
        IsVerified BIT NOT NULL DEFAULT 0,
        [Plan] NVARCHAR(20) NOT NULL DEFAULT 'free',
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Organizations PRIMARY KEY CLUSTERED (OrgId),
        CONSTRAINT UQ_Organizations_Slug UNIQUE (Slug)
    );
    PRINT 'Created Organizations';
END
""")
print("Organizations: OK")

# OrgMembers
cur.execute("""
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'OrgMembers')
BEGIN
    CREATE TABLE retomy.OrgMembers (
        OrgId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Role NVARCHAR(20) NOT NULL DEFAULT 'member',
        JoinedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_OrgMembers PRIMARY KEY CLUSTERED (OrgId, UserId),
        CONSTRAINT FK_OrgMembers_Orgs FOREIGN KEY (OrgId) REFERENCES retomy.Organizations(OrgId),
        CONSTRAINT FK_OrgMembers_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
    );
    PRINT 'Created OrgMembers';
END
""")
print("OrgMembers: OK")

# Verify all tables
cur.execute("""
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA='retomy' ORDER BY TABLE_NAME
""")
tables = [r[0] for r in cur.fetchall()]
print(f"\nTotal tables: {len(tables)}")
for t in tables:
    print(f"  {t}")

conn.close()
print("\nDone!")
