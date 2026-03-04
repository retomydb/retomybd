import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;DATABASE=retomY;UID=sa;PWD=Prestige@123;TrustServerCertificate=yes;',
    autocommit=True
)
cur = conn.cursor()

# 1. Add HostingType if missing
try:
    cur.execute("SELECT HostingType FROM retomy.ModelMetadata WHERE 1=0")
    print("HostingType already exists")
except:
    cur.execute("ALTER TABLE retomy.ModelMetadata ADD HostingType NVARCHAR(20) NOT NULL DEFAULT 'hosted'")
    print("Added HostingType column")

# 2. Create StorageSubscriptions if missing
cur.execute("""SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
               WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME='StorageSubscriptions'""")
if cur.fetchone():
    print("StorageSubscriptions already exists")
else:
    cur.execute("""
        CREATE TABLE retomy.StorageSubscriptions (
            SubscriptionId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
            UserId              UNIQUEIDENTIFIER    NOT NULL,
            RepoId              UNIQUEIDENTIFIER    NOT NULL,
            [Plan]              NVARCHAR(50)        NOT NULL DEFAULT 'model_storage',
            PriceMonthly        DECIMAL(10,2)       NOT NULL DEFAULT 10.00,
            [Status]            NVARCHAR(30)        NOT NULL DEFAULT 'active',
            StripeSubscriptionId NVARCHAR(200)      NULL,
            CurrentPeriodStart  DATETIME2           NULL,
            CurrentPeriodEnd    DATETIME2           NULL,
            CancelledAt         DATETIME2           NULL,
            CreatedAt           DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
            UpdatedAt           DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT PK_StorageSubscriptions PRIMARY KEY CLUSTERED (SubscriptionId),
            CONSTRAINT FK_StorageSubs_User FOREIGN KEY (UserId)  REFERENCES retomy.Users(UserId),
            CONSTRAINT FK_StorageSubs_Repo FOREIGN KEY (RepoId)  REFERENCES retomy.Repositories(RepoId)
        )
    """)
    cur.execute("CREATE NONCLUSTERED INDEX IX_StorageSubs_User ON retomy.StorageSubscriptions(UserId) WHERE [Status] = 'active'")
    cur.execute("CREATE NONCLUSTERED INDEX IX_StorageSubs_Repo ON retomy.StorageSubscriptions(RepoId)")
    print("Created StorageSubscriptions table")

# Verify
cur.execute("""SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME='ModelMetadata' 
               ORDER BY ORDINAL_POSITION""")
print(f"\nModelMetadata: {[r[0] for r in cur.fetchall()]}")

cur.execute("""SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
               WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME='StorageSubscriptions'""")
print(f"StorageSubscriptions exists: {cur.fetchone() is not None}")

conn.close()
print("Done")
