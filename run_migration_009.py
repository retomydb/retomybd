#!/usr/bin/env python3
"""Run migration 009 - create OllamaConversations and OllamaMessages tables."""
import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost,1433;'
    'DATABASE=retomY;UID=sa;PWD=Prestige@123;'
    'TrustServerCertificate=yes;Encrypt=yes;',
    timeout=10
)
cur = conn.cursor()

# Check if tables exist
cur.execute(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
    "WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME LIKE '%Ollama%'"
)
existing = [r[0] for r in cur.fetchall()]
print("Existing tables:", existing)

if 'OllamaConversations' not in existing:
    cur.execute("""
    CREATE TABLE retomy.OllamaConversations (
        ConversationId   UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWSEQUENTIALID(),
        UserId           UNIQUEIDENTIFIER   NOT NULL,
        Model            NVARCHAR(100)      NOT NULL,
        Title            NVARCHAR(300)      NULL,
        SystemPrompt     NVARCHAR(MAX)      NULL,
        CreatedAt        DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt        DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt        DATETIME2          NULL,
        CONSTRAINT PK_OllamaConversations PRIMARY KEY CLUSTERED (ConversationId),
        CONSTRAINT FK_OllamaConversations_User FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
    )
    """)
    conn.commit()
    cur.execute(
        "CREATE NONCLUSTERED INDEX IX_OllamaConversations_UserId "
        "ON retomy.OllamaConversations(UserId, UpdatedAt DESC) "
        "WHERE DeletedAt IS NULL"
    )
    conn.commit()
    print("Created OllamaConversations table")

if 'OllamaMessages' not in existing:
    cur.execute("""
    CREATE TABLE retomy.OllamaMessages (
        MessageId        UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWSEQUENTIALID(),
        ConversationId   UNIQUEIDENTIFIER   NOT NULL,
        Role             NVARCHAR(20)       NOT NULL,
        Content          NVARCHAR(MAX)      NOT NULL,
        TokenCount       INT                NULL,
        DurationSecs     FLOAT              NULL,
        CreatedAt        DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_OllamaMessages PRIMARY KEY CLUSTERED (MessageId),
        CONSTRAINT FK_OllamaMessages_Conversation FOREIGN KEY (ConversationId)
            REFERENCES retomy.OllamaConversations(ConversationId) ON DELETE CASCADE,
        CONSTRAINT CK_OllamaMessages_Role CHECK (Role IN ('user','assistant','system'))
    )
    """)
    conn.commit()
    cur.execute(
        "CREATE NONCLUSTERED INDEX IX_OllamaMessages_ConversationId "
        "ON retomy.OllamaMessages(ConversationId, CreatedAt ASC)"
    )
    conn.commit()
    print("Created OllamaMessages table")

# Verify
cur.execute(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
    "WHERE TABLE_SCHEMA='retomy' AND TABLE_NAME LIKE '%Ollama%'"
)
for r in cur.fetchall():
    print(f"  -> {r[0]}")

conn.close()
print("Migration 009 complete")
