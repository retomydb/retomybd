-- =============================================================================
-- Migration 009: Chat History for Ollama Conversations
-- Stores conversation threads so users can resume past chats (ChatGPT-style)
-- =============================================================================

-- ── Conversations (threads) ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OllamaConversations' AND schema_id = SCHEMA_ID('retomy'))
BEGIN
    CREATE TABLE retomy.OllamaConversations (
        ConversationId   UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWSEQUENTIALID(),
        UserId           UNIQUEIDENTIFIER   NOT NULL,
        Model            NVARCHAR(100)      NOT NULL,       -- e.g. "llama3:8b"
        Title            NVARCHAR(300)      NULL,           -- auto-generated from first message
        SystemPrompt     NVARCHAR(MAX)      NULL,
        CreatedAt        DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt        DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt        DATETIME2          NULL,

        CONSTRAINT PK_OllamaConversations PRIMARY KEY CLUSTERED (ConversationId),
        CONSTRAINT FK_OllamaConversations_User FOREIGN KEY (UserId)
            REFERENCES retomy.Users(UserId)
    );

    CREATE NONCLUSTERED INDEX IX_OllamaConversations_UserId
        ON retomy.OllamaConversations(UserId, UpdatedAt DESC)
        WHERE DeletedAt IS NULL;

    CREATE NONCLUSTERED INDEX IX_OllamaConversations_Model
        ON retomy.OllamaConversations(Model)
        WHERE DeletedAt IS NULL;
END
GO

-- ── Messages ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OllamaMessages' AND schema_id = SCHEMA_ID('retomy'))
BEGIN
    CREATE TABLE retomy.OllamaMessages (
        MessageId        UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWSEQUENTIALID(),
        ConversationId   UNIQUEIDENTIFIER   NOT NULL,
        Role             NVARCHAR(20)       NOT NULL,   -- 'user', 'assistant', 'system'
        Content          NVARCHAR(MAX)      NOT NULL,
        TokenCount       INT                NULL,       -- eval_count from Ollama
        DurationSecs     FLOAT              NULL,       -- total_duration / 1e9
        CreatedAt        DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_OllamaMessages PRIMARY KEY CLUSTERED (MessageId),
        CONSTRAINT FK_OllamaMessages_Conversation FOREIGN KEY (ConversationId)
            REFERENCES retomy.OllamaConversations(ConversationId) ON DELETE CASCADE,
        CONSTRAINT CK_OllamaMessages_Role CHECK (Role IN ('user', 'assistant', 'system'))
    );

    CREATE NONCLUSTERED INDEX IX_OllamaMessages_ConversationId
        ON retomy.OllamaMessages(ConversationId, CreatedAt ASC);
END
GO

PRINT 'Migration 009: Chat history tables created successfully';
GO
