-- =============================================================================
-- Migration 007: GitHub-connected models & usage guide support
-- Adds hosting type (hosted vs github-linked), GitHub repo fields,
-- usage guide (markdown) to ModelMetadata, and a StorageSubscriptions
-- table for the $10/mo hosted-model plan.
-- =============================================================================

-- ─── Extend ModelMetadata ────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'HostingType')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD HostingType NVARCHAR(20) NOT NULL DEFAULT 'hosted';
    -- 'hosted'  = files stored on retomY (paid $10/mo)
    -- 'github'  = linked to a GitHub repo (free, we just show info)
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubRepoUrl')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubRepoUrl NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubOwner')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubOwner NVARCHAR(200) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubRepoName')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubRepoName NVARCHAR(200) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubBranch')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubBranch NVARCHAR(100) NOT NULL DEFAULT 'main';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubLastSyncAt')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubLastSyncAt DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubReadme')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubReadme NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubStars')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubStars INT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'GithubTopics')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD GithubTopics NVARCHAR(1000) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'UsageGuide')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD UsageGuide NVARCHAR(MAX) NULL;
    -- Markdown content: installation, inference, training, etc.
END
GO

-- ─── Storage Subscriptions ──────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'StorageSubscriptions')
BEGIN
    CREATE TABLE retomy.StorageSubscriptions (
        SubscriptionId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        UserId              UNIQUEIDENTIFIER    NOT NULL,
        RepoId              UNIQUEIDENTIFIER    NOT NULL,
        [Plan]              NVARCHAR(50)        NOT NULL DEFAULT 'model_storage',
        PriceMonthly        DECIMAL(10,2)       NOT NULL DEFAULT 10.00,
        [Status]            NVARCHAR(30)        NOT NULL DEFAULT 'active',
            -- active, cancelled, past_due, trialing
        StripeSubscriptionId NVARCHAR(200)      NULL,
        CurrentPeriodStart  DATETIME2           NULL,
        CurrentPeriodEnd    DATETIME2           NULL,
        CancelledAt         DATETIME2           NULL,
        CreatedAt           DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_StorageSubscriptions PRIMARY KEY CLUSTERED (SubscriptionId),
        CONSTRAINT FK_StorageSubs_User FOREIGN KEY (UserId)  REFERENCES retomy.Users(UserId),
        CONSTRAINT FK_StorageSubs_Repo FOREIGN KEY (RepoId)  REFERENCES retomy.Repositories(RepoId)
    );

    CREATE NONCLUSTERED INDEX IX_StorageSubs_User ON retomy.StorageSubscriptions(UserId) WHERE [Status] = 'active';
    CREATE NONCLUSTERED INDEX IX_StorageSubs_Repo ON retomy.StorageSubscriptions(RepoId);
END
GO

PRINT '007 — GitHub-connected models & usage guide migration complete';
GO
