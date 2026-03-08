-- =============================================================================
-- Migration 006: HuggingFace-Style Hub Expansion
-- Adds Repositories, Models, Spaces, Discussions, Organizations, Collections
-- Does NOT modify any existing tables (Datasets, Purchases, etc.)
-- =============================================================================

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Organizations')
BEGIN
    CREATE TABLE retomy.Organizations (
        OrgId           UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name            NVARCHAR(100)       NOT NULL,
        Slug            NVARCHAR(100)       NOT NULL,
        AvatarUrl       NVARCHAR(500)       NULL,
        Description     NVARCHAR(1000)      NULL,
        Website         NVARCHAR(300)       NULL,
        IsVerified      BIT                 NOT NULL DEFAULT 0,
        [Plan]            NVARCHAR(20)        NOT NULL DEFAULT 'free',
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Organizations PRIMARY KEY CLUSTERED (OrgId),
        CONSTRAINT UQ_Organizations_Slug UNIQUE (Slug)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'OrgMembers')
BEGIN
    CREATE TABLE retomy.OrgMembers (
        OrgId           UNIQUEIDENTIFIER    NOT NULL,
        UserId          UNIQUEIDENTIFIER    NOT NULL,
        Role            NVARCHAR(20)        NOT NULL DEFAULT 'member',
        JoinedAt        DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_OrgMembers PRIMARY KEY CLUSTERED (OrgId, UserId),
        CONSTRAINT FK_OrgMembers_Orgs FOREIGN KEY (OrgId) REFERENCES retomy.Organizations(OrgId),
        CONSTRAINT FK_OrgMembers_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId),
        CONSTRAINT CK_OrgMembers_Role CHECK (Role IN ('owner', 'admin', 'write', 'read', 'member'))
    );
END
GO

-- =============================================================================
-- CONTENT-ADDRESSABLE BLOB STORAGE
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Blobs')
BEGIN
    CREATE TABLE retomy.Blobs (
        BlobHash        VARCHAR(64)         NOT NULL,
        StoragePath     NVARCHAR(500)       NOT NULL,
        SizeBytes       BIGINT              NOT NULL,
        ContentType     NVARCHAR(100)       NULL,
        RefCount        INT                 NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Blobs PRIMARY KEY CLUSTERED (BlobHash)
    );
END
GO

-- =============================================================================
-- UNIFIED REPOSITORY
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Repositories')
BEGIN
    CREATE TABLE retomy.Repositories (
        RepoId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        OwnerId         UNIQUEIDENTIFIER    NOT NULL,
        OwnerType       NVARCHAR(10)        NOT NULL DEFAULT 'user',
        RepoType        NVARCHAR(10)        NOT NULL,
        Name            NVARCHAR(200)       NOT NULL,
        Slug            NVARCHAR(400)       NOT NULL,
        Description     NVARCHAR(1000)      NULL,
        Private         BIT                 NOT NULL DEFAULT 0,
        Gated           NVARCHAR(20)        NOT NULL DEFAULT 'none',
        DefaultBranch   NVARCHAR(50)        NOT NULL DEFAULT 'main',
        PricingModel    NVARCHAR(20)        NOT NULL DEFAULT 'free',
        Price           DECIMAL(10,2)       NOT NULL DEFAULT 0,
        LicenseType     NVARCHAR(50)        NULL DEFAULT 'apache-2.0',
        Tags            NVARCHAR(MAX)       NULL,
        TotalDownloads  BIGINT              NOT NULL DEFAULT 0,
        TotalLikes      INT                 NOT NULL DEFAULT 0,
        TotalViews      BIGINT              NOT NULL DEFAULT 0,
        Trending        FLOAT               NOT NULL DEFAULT 0,
        LastCommitAt    DATETIME2           NULL,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt       DATETIME2           NULL,

        CONSTRAINT PK_Repositories PRIMARY KEY CLUSTERED (RepoId),
        CONSTRAINT UQ_Repositories_Slug UNIQUE (Slug),
        CONSTRAINT CK_Repositories_Type CHECK (RepoType IN ('model', 'dataset', 'space')),
        CONSTRAINT CK_Repositories_OwnerType CHECK (OwnerType IN ('user', 'org')),
        CONSTRAINT CK_Repositories_Gated CHECK (Gated IN ('none', 'auto', 'manual'))
    );

    CREATE NONCLUSTERED INDEX IX_Repos_Slug ON retomy.Repositories(Slug) WHERE DeletedAt IS NULL;
    CREATE NONCLUSTERED INDEX IX_Repos_Type_Trending ON retomy.Repositories(RepoType, Trending DESC) WHERE DeletedAt IS NULL;
    CREATE NONCLUSTERED INDEX IX_Repos_Owner ON retomy.Repositories(OwnerId, OwnerType) WHERE DeletedAt IS NULL;
END
GO

-- =============================================================================
-- COMMITS (version history)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Commits')
BEGIN
    CREATE TABLE retomy.Commits (
        CommitId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        CommitHash      VARCHAR(40)         NOT NULL,
        ParentHash      VARCHAR(40)         NULL,
        AuthorId        UNIQUEIDENTIFIER    NOT NULL,
        Message         NVARCHAR(500)       NULL,
        Branch          NVARCHAR(50)        NOT NULL DEFAULT 'main',
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Commits PRIMARY KEY CLUSTERED (CommitId),
        CONSTRAINT FK_Commits_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId),
        CONSTRAINT FK_Commits_Users FOREIGN KEY (AuthorId) REFERENCES retomy.Users(UserId)
    );

    CREATE NONCLUSTERED INDEX IX_Commits_Repo_Branch ON retomy.Commits(RepoId, Branch, CreatedAt DESC);
END
GO

-- =============================================================================
-- REPO FILES (file tree per commit)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'RepoFiles')
BEGIN
    CREATE TABLE retomy.RepoFiles (
        FileId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        CommitId        UNIQUEIDENTIFIER    NOT NULL,
        FilePath        NVARCHAR(500)       NOT NULL,
        BlobHash        VARCHAR(64)         NOT NULL,
        SizeBytes       BIGINT              NULL,
        IsLFS           BIT                 NOT NULL DEFAULT 0,

        CONSTRAINT PK_RepoFiles PRIMARY KEY CLUSTERED (FileId),
        CONSTRAINT FK_RepoFiles_Commits FOREIGN KEY (CommitId) REFERENCES retomy.Commits(CommitId),
        CONSTRAINT FK_RepoFiles_Blobs FOREIGN KEY (BlobHash) REFERENCES retomy.Blobs(BlobHash)
    );

    CREATE NONCLUSTERED INDEX IX_RepoFiles_Commit ON retomy.RepoFiles(CommitId);
END
GO

-- =============================================================================
-- REPO TAGS (releases / versions)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'RepoTags')
BEGIN
    CREATE TABLE retomy.RepoTags (
        TagId           UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        TagName         NVARCHAR(100)       NOT NULL,
        CommitId        UNIQUEIDENTIFIER    NOT NULL,
        ReleaseNotes    NVARCHAR(MAX)       NULL,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_RepoTags PRIMARY KEY CLUSTERED (TagId),
        CONSTRAINT FK_RepoTags_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId),
        CONSTRAINT FK_RepoTags_Commits FOREIGN KEY (CommitId) REFERENCES retomy.Commits(CommitId)
    );
END
GO

-- =============================================================================
-- MODEL METADATA
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'ModelMetadata')
BEGIN
    CREATE TABLE retomy.ModelMetadata (
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        Framework       NVARCHAR(30)        NULL,
        Task            NVARCHAR(100)       NULL,
        Library         NVARCHAR(50)        NULL,
        Architecture    NVARCHAR(100)       NULL,
        Language        NVARCHAR(200)       NULL,
        BaseModel       NVARCHAR(400)       NULL,
        ParameterCount  BIGINT              NULL,
        TensorType      NVARCHAR(30)        NULL,
        SafeTensors     BIT                 NOT NULL DEFAULT 0,
        PipelineTag     NVARCHAR(100)       NULL,
        InferenceEnabled BIT                NOT NULL DEFAULT 0,
        WidgetData      NVARCHAR(MAX)       NULL,
        EvalResults     NVARCHAR(MAX)       NULL,

        CONSTRAINT PK_ModelMetadata PRIMARY KEY CLUSTERED (RepoId),
        CONSTRAINT FK_ModelMetadata_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

-- =============================================================================
-- DATASET METADATA (links repo to existing Datasets table)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'DatasetRepoMetadata')
BEGIN
    CREATE TABLE retomy.DatasetRepoMetadata (
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        LegacyDatasetId UNIQUEIDENTIFIER    NULL,
        Builder         NVARCHAR(50)        NULL,
        Splits          NVARCHAR(MAX)       NULL,
        Features        NVARCHAR(MAX)       NULL,
        Language        NVARCHAR(200)       NULL,
        TaskCategories  NVARCHAR(MAX)       NULL,
        SizeCategory    NVARCHAR(20)        NULL,
        Modalities      NVARCHAR(200)       NULL,

        CONSTRAINT PK_DatasetRepoMetadata PRIMARY KEY CLUSTERED (RepoId),
        CONSTRAINT FK_DatasetRepoMeta_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

-- =============================================================================
-- SPACE METADATA
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'SpaceMetadata')
BEGIN
    CREATE TABLE retomy.SpaceMetadata (
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        SDK             NVARCHAR(30)        NULL,
        SDKVersion      NVARCHAR(20)        NULL,
        AppPort         INT                 NOT NULL DEFAULT 7860,
        Hardware        NVARCHAR(30)        NOT NULL DEFAULT 'cpu-basic',
        LinkedModels    NVARCHAR(MAX)       NULL,
        LinkedDatasets  NVARCHAR(MAX)       NULL,
        ContainerId     NVARCHAR(100)       NULL,
        Status          NVARCHAR(20)        NOT NULL DEFAULT 'building',
        SleepAfter      INT                 NOT NULL DEFAULT 172800,
        EmbedUrl        NVARCHAR(500)       NULL,
        PinnedMessage   NVARCHAR(500)       NULL,

        CONSTRAINT PK_SpaceMetadata PRIMARY KEY CLUSTERED (RepoId),
        CONSTRAINT FK_SpaceMetadata_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

-- =============================================================================
-- DISCUSSIONS (community threads on any repo)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Discussions')
BEGIN
    CREATE TABLE retomy.Discussions (
        DiscussionId    UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        AuthorId        UNIQUEIDENTIFIER    NOT NULL,
        DiscussionNum   INT                 NOT NULL,
        Title           NVARCHAR(300)       NOT NULL,
        Type            NVARCHAR(20)        NOT NULL DEFAULT 'discussion',
        Status          NVARCHAR(20)        NOT NULL DEFAULT 'open',
        IsPinned        BIT                 NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Discussions PRIMARY KEY CLUSTERED (DiscussionId),
        CONSTRAINT FK_Discussions_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId),
        CONSTRAINT FK_Discussions_Users FOREIGN KEY (AuthorId) REFERENCES retomy.Users(UserId),
        CONSTRAINT UQ_Discussions_Num UNIQUE (RepoId, DiscussionNum)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'DiscussionComments')
BEGIN
    CREATE TABLE retomy.DiscussionComments (
        CommentId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        DiscussionId    UNIQUEIDENTIFIER    NOT NULL,
        AuthorId        UNIQUEIDENTIFIER    NOT NULL,
        Content         NVARCHAR(MAX)       NULL,
        IsHidden        BIT                 NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
        EditedAt        DATETIME2           NULL,

        CONSTRAINT PK_DiscussionComments PRIMARY KEY CLUSTERED (CommentId),
        CONSTRAINT FK_DiscComments_Disc FOREIGN KEY (DiscussionId) REFERENCES retomy.Discussions(DiscussionId),
        CONSTRAINT FK_DiscComments_Users FOREIGN KEY (AuthorId) REFERENCES retomy.Users(UserId)
    );
END
GO

-- =============================================================================
-- LIKES (universal)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Likes')
BEGIN
    CREATE TABLE retomy.Likes (
        UserId          UNIQUEIDENTIFIER    NOT NULL,
        ResourceType    NVARCHAR(20)        NOT NULL,
        ResourceId      UNIQUEIDENTIFIER    NOT NULL,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Likes PRIMARY KEY CLUSTERED (UserId, ResourceType, ResourceId),
        CONSTRAINT FK_Likes_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
    );
END
GO

-- =============================================================================
-- FOLLOWS
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Follows')
BEGIN
    CREATE TABLE retomy.Follows (
        FollowerId      UNIQUEIDENTIFIER    NOT NULL,
        TargetType      NVARCHAR(10)        NOT NULL,
        TargetId        UNIQUEIDENTIFIER    NOT NULL,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Follows PRIMARY KEY CLUSTERED (FollowerId, TargetType, TargetId),
        CONSTRAINT FK_Follows_Users FOREIGN KEY (FollowerId) REFERENCES retomy.Users(UserId)
    );
END
GO

-- =============================================================================
-- COLLECTIONS
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'Collections')
BEGIN
    CREATE TABLE retomy.Collections (
        CollectionId    UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        OwnerId         UNIQUEIDENTIFIER    NOT NULL,
        Title           NVARCHAR(200)       NOT NULL,
        Description     NVARCHAR(1000)      NULL,
        Slug            NVARCHAR(200)       NOT NULL,
        IsPublic        BIT                 NOT NULL DEFAULT 1,
        TotalLikes      INT                 NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Collections PRIMARY KEY CLUSTERED (CollectionId),
        CONSTRAINT FK_Collections_Users FOREIGN KEY (OwnerId) REFERENCES retomy.Users(UserId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'CollectionItems')
BEGIN
    CREATE TABLE retomy.CollectionItems (
        CollectionId    UNIQUEIDENTIFIER    NOT NULL,
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        Note            NVARCHAR(500)       NULL,
        SortOrder       INT                 NOT NULL DEFAULT 0,
        AddedAt         DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_CollectionItems PRIMARY KEY CLUSTERED (CollectionId, RepoId),
        CONSTRAINT FK_CollItems_Coll FOREIGN KEY (CollectionId) REFERENCES retomy.Collections(CollectionId),
        CONSTRAINT FK_CollItems_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

-- =============================================================================
-- ACCESS REQUESTS (gated repos)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'AccessRequests')
BEGIN
    CREATE TABLE retomy.AccessRequests (
        RequestId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        UserId          UNIQUEIDENTIFIER    NOT NULL,
        Status          NVARCHAR(20)        NOT NULL DEFAULT 'pending',
        Justification   NVARCHAR(1000)      NULL,
        ReviewedBy      UNIQUEIDENTIFIER    NULL,
        ReviewedAt      DATETIME2           NULL,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_AccessRequests PRIMARY KEY CLUSTERED (RequestId),
        CONSTRAINT FK_AccReq_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId),
        CONSTRAINT FK_AccReq_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
    );
END
GO

-- =============================================================================
-- REPO PURCHASES (unified purchase for models/datasets/spaces)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'RepoPurchases')
BEGIN
    CREATE TABLE retomy.RepoPurchases (
        PurchaseId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        BuyerId         UNIQUEIDENTIFIER    NOT NULL,
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        PricePaid       DECIMAL(10,2)       NOT NULL DEFAULT 0,
        Currency        CHAR(3)             NOT NULL DEFAULT 'USD',
        PricingModel    NVARCHAR(20)        NULL,
        StripePaymentId NVARCHAR(100)       NULL,
        Status          NVARCHAR(20)        NOT NULL DEFAULT 'completed',
        GrantedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
        ExpiresAt       DATETIME2           NULL,

        CONSTRAINT PK_RepoPurchases PRIMARY KEY CLUSTERED (PurchaseId),
        CONSTRAINT FK_RepoPurch_Users FOREIGN KEY (BuyerId) REFERENCES retomy.Users(UserId),
        CONSTRAINT FK_RepoPurch_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

-- =============================================================================
-- UPLOAD SESSIONS (chunked uploads for large files)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'UploadSessions')
BEGIN
    CREATE TABLE retomy.UploadSessions (
        SessionId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        UserId          UNIQUEIDENTIFIER    NOT NULL,
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        FileName        NVARCHAR(500)       NULL,
        TotalSize       BIGINT              NULL,
        ChunkSize       INT                 NOT NULL DEFAULT 67108864,
        TotalChunks     INT                 NULL,
        UploadedChunks  INT                 NOT NULL DEFAULT 0,
        Status          NVARCHAR(20)        NOT NULL DEFAULT 'in_progress',
        ExpiresAt       DATETIME2           NULL,
        CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_UploadSessions PRIMARY KEY CLUSTERED (SessionId),
        CONSTRAINT FK_UploadSess_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId),
        CONSTRAINT FK_UploadSess_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'UploadChunks')
BEGIN
    CREATE TABLE retomy.UploadChunks (
        ChunkId         UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        SessionId       UNIQUEIDENTIFIER    NOT NULL,
        ChunkIndex      INT                 NOT NULL,
        BlobPath        NVARCHAR(500)       NULL,
        SizeBytes       BIGINT              NULL,
        Checksum        VARCHAR(64)         NULL,
        UploadedAt      DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_UploadChunks PRIMARY KEY CLUSTERED (ChunkId),
        CONSTRAINT FK_UploadChunks_Sess FOREIGN KEY (SessionId) REFERENCES retomy.UploadSessions(SessionId)
    );
END
GO

-- =============================================================================
-- INFERENCE ENDPOINTS
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'InferenceEndpoints')
BEGIN
    CREATE TABLE retomy.InferenceEndpoints (
        EndpointId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        RepoId          UNIQUEIDENTIFIER    NOT NULL,
        Provider        NVARCHAR(20)        NULL,
        EndpointUrl     NVARCHAR(500)       NULL,
        Hardware        NVARCHAR(30)        NULL,
        Status          NVARCHAR(20)        NOT NULL DEFAULT 'cold',
        LastCalledAt    DATETIME2           NULL,
        TotalCalls      BIGINT              NOT NULL DEFAULT 0,
        AvgLatencyMs    INT                 NULL,

        CONSTRAINT PK_InferenceEndpoints PRIMARY KEY CLUSTERED (EndpointId),
        CONSTRAINT FK_InfEndp_Repos FOREIGN KEY (RepoId) REFERENCES retomy.Repositories(RepoId)
    );
END
GO

-- =============================================================================
-- Add Slug column to Users for profile URLs (non-destructive)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Users') AND name = 'Slug')
BEGIN
    ALTER TABLE retomy.Users ADD Slug NVARCHAR(100) NULL;
END
GO

-- Populate slugs from existing users (email prefix)
UPDATE retomy.Users
SET Slug = LOWER(LEFT(Email, CHARINDEX('@', Email) - 1))
WHERE Slug IS NULL AND Email LIKE '%@%';
GO

PRINT '=== Migration 006 complete: HuggingFace Hub tables created ==='
GO
