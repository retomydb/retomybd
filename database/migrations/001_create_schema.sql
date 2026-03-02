-- =============================================================================
-- retomY — Enterprise Dataset Marketplace
-- Migration 001: Create Schema and Core Tables
-- =============================================================================

-- Create dedicated schema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'retomy')
BEGIN
    EXEC('CREATE SCHEMA retomy');
END
GO

-- =============================================================================
-- USERS & AUTH
-- =============================================================================

CREATE TABLE retomy.Users (
    UserId              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    Email               NVARCHAR(255)       NOT NULL,
    PasswordHash        NVARCHAR(512)       NOT NULL,
    PasswordSalt        NVARCHAR(256)       NOT NULL,
    FirstName           NVARCHAR(100)       NOT NULL,
    LastName            NVARCHAR(100)       NOT NULL,
    DisplayName         NVARCHAR(150)       NULL,
    AvatarUrl           NVARCHAR(1000)      NULL,
    Bio                 NVARCHAR(2000)      NULL,
    Company             NVARCHAR(255)       NULL,
    Website             NVARCHAR(500)       NULL,
    Location            NVARCHAR(255)       NULL,
    IsEmailVerified     BIT                 NOT NULL DEFAULT 0,
    IsSellerVerified    BIT                 NOT NULL DEFAULT 0,
    IsSuspended         BIT                 NOT NULL DEFAULT 0,
    SuspensionReason    NVARCHAR(1000)      NULL,
    Role                NVARCHAR(50)        NOT NULL DEFAULT 'user',  -- user, admin, superadmin
    CreditsBalance      DECIMAL(18,2)       NOT NULL DEFAULT 0.00,
    LastLoginAt         DATETIME2           NULL,
    LastLoginIp         NVARCHAR(45)        NULL,
    FailedLoginAttempts INT                 NOT NULL DEFAULT 0,
    LockoutEndAt        DATETIME2           NULL,
    CreatedAt           DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt           DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    DeletedAt           DATETIME2           NULL,

    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('user', 'admin', 'superadmin'))
);
GO

CREATE NONCLUSTERED INDEX IX_Users_Email ON retomy.Users(Email) WHERE DeletedAt IS NULL;
CREATE NONCLUSTERED INDEX IX_Users_Role ON retomy.Users(Role) WHERE DeletedAt IS NULL;
CREATE NONCLUSTERED INDEX IX_Users_DisplayName ON retomy.Users(DisplayName) WHERE DeletedAt IS NULL;
GO

-- =============================================================================
-- REFRESH TOKENS
-- =============================================================================

CREATE TABLE retomy.RefreshTokens (
    TokenId         UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    Token           NVARCHAR(512)       NOT NULL,
    ExpiresAt       DATETIME2           NOT NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    RevokedAt       DATETIME2           NULL,
    ReplacedByToken NVARCHAR(512)       NULL,
    CreatedByIp     NVARCHAR(45)        NULL,

    CONSTRAINT PK_RefreshTokens PRIMARY KEY CLUSTERED (TokenId),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
);
GO

CREATE NONCLUSTERED INDEX IX_RefreshTokens_Token ON retomy.RefreshTokens(Token);
CREATE NONCLUSTERED INDEX IX_RefreshTokens_UserId ON retomy.RefreshTokens(UserId);
GO

-- =============================================================================
-- API KEYS
-- =============================================================================

CREATE TABLE retomy.ApiKeys (
    ApiKeyId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    KeyHash         NVARCHAR(512)       NOT NULL,
    KeyPrefix       NVARCHAR(10)        NOT NULL,   -- First 8 chars for identification
    Name            NVARCHAR(255)       NOT NULL,
    Scopes          NVARCHAR(MAX)       NULL,        -- JSON array of scopes
    LastUsedAt      DATETIME2           NULL,
    ExpiresAt       DATETIME2           NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    RevokedAt       DATETIME2           NULL,

    CONSTRAINT PK_ApiKeys PRIMARY KEY CLUSTERED (ApiKeyId),
    CONSTRAINT FK_ApiKeys_Users FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
);
GO

-- =============================================================================
-- CATEGORIES
-- =============================================================================

CREATE TABLE retomy.Categories (
    CategoryId      INT                 IDENTITY(1,1) NOT NULL,
    ParentId        INT                 NULL,
    Name            NVARCHAR(100)       NOT NULL,
    Slug            NVARCHAR(100)       NOT NULL,
    Description     NVARCHAR(500)       NULL,
    IconUrl         NVARCHAR(500)       NULL,
    SortOrder       INT                 NOT NULL DEFAULT 0,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Categories PRIMARY KEY CLUSTERED (CategoryId),
    CONSTRAINT FK_Categories_Parent FOREIGN KEY (ParentId) REFERENCES retomy.Categories(CategoryId),
    CONSTRAINT UQ_Categories_Slug UNIQUE (Slug)
);
GO

-- =============================================================================
-- DATASETS (Core Catalog)
-- =============================================================================

CREATE TABLE retomy.Datasets (
    DatasetId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    SellerId        UNIQUEIDENTIFIER    NOT NULL,
    CategoryId      INT                 NULL,
    Title           NVARCHAR(300)       NOT NULL,
    Slug            NVARCHAR(300)       NOT NULL,
    ShortDescription NVARCHAR(500)      NOT NULL,
    FullDescription NVARCHAR(MAX)       NULL,
    ThumbnailUrl    NVARCHAR(1000)      NULL,
    BannerUrl       NVARCHAR(1000)      NULL,
    Price           DECIMAL(18,2)       NOT NULL DEFAULT 0.00,
    Currency        NVARCHAR(3)         NOT NULL DEFAULT 'USD',
    PricingModel    NVARCHAR(50)        NOT NULL DEFAULT 'one-time',  -- one-time, subscription, freemium, free
    LicenseType     NVARCHAR(100)       NOT NULL DEFAULT 'standard',
    LicenseText     NVARCHAR(MAX)       NULL,
    FileFormat      NVARCHAR(50)        NULL,        -- csv, json, parquet, etc.
    FileSize        BIGINT              NULL,        -- in bytes
    [RowCount]      BIGINT              NULL,
    [ColumnCount]   INT                 NULL,
    SchemaDefinition NVARCHAR(MAX)      NULL,        -- JSON schema
    SampleBlobPath  NVARCHAR(1000)      NULL,        -- Path in Azurite
    FullBlobPath    NVARCHAR(1000)      NULL,        -- Path in Azurite
    Version         NVARCHAR(20)        NOT NULL DEFAULT '1.0.0',
    PrivacyScore    DECIMAL(5,2)        NULL,        -- 0-100 privacy score
    QualityScore    DECIMAL(5,2)        NULL,        -- 0-100 quality score
    Status          NVARCHAR(50)        NOT NULL DEFAULT 'draft',  -- draft, pending_review, published, suspended, archived
    ReviewNotes     NVARCHAR(MAX)       NULL,
    Tags            NVARCHAR(MAX)       NULL,        -- JSON array
    Metadata        NVARCHAR(MAX)       NULL,        -- JSON additional metadata
    TotalDownloads  INT                 NOT NULL DEFAULT 0,
    TotalViews      INT                 NOT NULL DEFAULT 0,
    TotalPurchases  INT                 NOT NULL DEFAULT 0,
    AverageRating   DECIMAL(3,2)        NULL,
    TotalReviews    INT                 NOT NULL DEFAULT 0,
    FreshnessDate   DATETIME2           NULL,        -- When data was last refreshed
    DataStartDate   DATETIME2           NULL,
    DataEndDate     DATETIME2           NULL,
    IsFeatured      BIT                 NOT NULL DEFAULT 0,
    PublishedAt     DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    DeletedAt       DATETIME2           NULL,

    CONSTRAINT PK_Datasets PRIMARY KEY CLUSTERED (DatasetId),
    CONSTRAINT FK_Datasets_Seller FOREIGN KEY (SellerId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_Datasets_Category FOREIGN KEY (CategoryId) REFERENCES retomy.Categories(CategoryId),
    CONSTRAINT UQ_Datasets_Slug UNIQUE (Slug),
    CONSTRAINT CK_Datasets_Status CHECK (Status IN ('draft', 'pending_review', 'published', 'suspended', 'archived')),
    CONSTRAINT CK_Datasets_PricingModel CHECK (PricingModel IN ('one-time', 'subscription', 'freemium', 'free'))
);
GO

CREATE NONCLUSTERED INDEX IX_Datasets_SellerId ON retomy.Datasets(SellerId) WHERE DeletedAt IS NULL;
CREATE NONCLUSTERED INDEX IX_Datasets_CategoryId ON retomy.Datasets(CategoryId) WHERE DeletedAt IS NULL;
CREATE NONCLUSTERED INDEX IX_Datasets_Status ON retomy.Datasets(Status) WHERE DeletedAt IS NULL;
CREATE NONCLUSTERED INDEX IX_Datasets_Price ON retomy.Datasets(Price) WHERE DeletedAt IS NULL AND Status = 'published';
CREATE NONCLUSTERED INDEX IX_Datasets_PublishedAt ON retomy.Datasets(PublishedAt DESC) WHERE DeletedAt IS NULL AND Status = 'published';
CREATE NONCLUSTERED INDEX IX_Datasets_AverageRating ON retomy.Datasets(AverageRating DESC) WHERE DeletedAt IS NULL AND Status = 'published';
CREATE NONCLUSTERED INDEX IX_Datasets_TotalDownloads ON retomy.Datasets(TotalDownloads DESC) WHERE DeletedAt IS NULL AND Status = 'published';
CREATE FULLTEXT CATALOG FT_retomY AS DEFAULT;
GO

-- =============================================================================
-- DATASET VERSIONS
-- =============================================================================

CREATE TABLE retomy.DatasetVersions (
    VersionId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    VersionNumber   NVARCHAR(20)        NOT NULL,
    Changelog       NVARCHAR(MAX)       NULL,
    BlobPath        NVARCHAR(1000)      NOT NULL,
    FileSize        BIGINT              NULL,
    [RowCount]      BIGINT              NULL,
    Checksum        NVARCHAR(128)       NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy       UNIQUEIDENTIFIER    NOT NULL,

    CONSTRAINT PK_DatasetVersions PRIMARY KEY CLUSTERED (VersionId),
    CONSTRAINT FK_DatasetVersions_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT FK_DatasetVersions_User FOREIGN KEY (CreatedBy) REFERENCES retomy.Users(UserId)
);
GO

-- =============================================================================
-- DATASET TAGS (Many-to-Many)
-- =============================================================================

CREATE TABLE retomy.Tags (
    TagId           INT                 IDENTITY(1,1) NOT NULL,
    Name            NVARCHAR(100)       NOT NULL,
    Slug            NVARCHAR(100)       NOT NULL,
    UsageCount      INT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Tags PRIMARY KEY CLUSTERED (TagId),
    CONSTRAINT UQ_Tags_Slug UNIQUE (Slug)
);
GO

CREATE TABLE retomy.DatasetTags (
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    TagId           INT                 NOT NULL,

    CONSTRAINT PK_DatasetTags PRIMARY KEY CLUSTERED (DatasetId, TagId),
    CONSTRAINT FK_DatasetTags_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT FK_DatasetTags_Tag FOREIGN KEY (TagId) REFERENCES retomy.Tags(TagId)
);
GO

-- =============================================================================
-- REVIEWS & RATINGS
-- =============================================================================

CREATE TABLE retomy.Reviews (
    ReviewId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    Rating          TINYINT             NOT NULL,  -- 1-5
    Title           NVARCHAR(255)       NULL,
    Content         NVARCHAR(MAX)       NULL,
    IsVerifiedPurchase BIT              NOT NULL DEFAULT 0,
    HelpfulCount    INT                 NOT NULL DEFAULT 0,
    Status          NVARCHAR(20)        NOT NULL DEFAULT 'active',  -- active, flagged, removed
    SellerResponse  NVARCHAR(MAX)       NULL,
    SellerRespondedAt DATETIME2         NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Reviews PRIMARY KEY CLUSTERED (ReviewId),
    CONSTRAINT FK_Reviews_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT FK_Reviews_User FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId),
    CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5),
    CONSTRAINT UQ_Reviews_UserDataset UNIQUE (DatasetId, UserId)
);
GO

-- =============================================================================
-- PURCHASES & TRANSACTIONS
-- =============================================================================

CREATE TABLE retomy.Purchases (
    PurchaseId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    BuyerId         UNIQUEIDENTIFIER    NOT NULL,
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    SellerId        UNIQUEIDENTIFIER    NOT NULL,
    Amount          DECIMAL(18,2)       NOT NULL,
    PlatformFee     DECIMAL(18,2)       NOT NULL,
    SellerEarnings  DECIMAL(18,2)       NOT NULL,
    Currency        NVARCHAR(3)         NOT NULL DEFAULT 'USD',
    PaymentMethod   NVARCHAR(50)        NULL,
    PaymentRef      NVARCHAR(255)       NULL,
    Status          NVARCHAR(50)        NOT NULL DEFAULT 'pending',  -- pending, completed, refunded, disputed, failed
    LicenseKey      NVARCHAR(255)       NULL,
    InvoiceNumber   NVARCHAR(50)        NULL,
    RefundedAt      DATETIME2           NULL,
    RefundReason    NVARCHAR(500)       NULL,
    CompletedAt     DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Purchases PRIMARY KEY CLUSTERED (PurchaseId),
    CONSTRAINT FK_Purchases_Buyer FOREIGN KEY (BuyerId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_Purchases_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT FK_Purchases_Seller FOREIGN KEY (SellerId) REFERENCES retomy.Users(UserId),
    CONSTRAINT CK_Purchases_Status CHECK (Status IN ('pending', 'completed', 'refunded', 'disputed', 'failed'))
);
GO

CREATE NONCLUSTERED INDEX IX_Purchases_BuyerId ON retomy.Purchases(BuyerId);
CREATE NONCLUSTERED INDEX IX_Purchases_SellerId ON retomy.Purchases(SellerId);
CREATE NONCLUSTERED INDEX IX_Purchases_DatasetId ON retomy.Purchases(DatasetId);
CREATE NONCLUSTERED INDEX IX_Purchases_Status ON retomy.Purchases(Status);
GO

-- =============================================================================
-- ENTITLEMENTS (Access Rights)
-- =============================================================================

CREATE TABLE retomy.Entitlements (
    EntitlementId   UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    PurchaseId      UNIQUEIDENTIFIER    NULL,
    AccessLevel     NVARCHAR(50)        NOT NULL DEFAULT 'download',  -- download, query, api
    ExpiresAt       DATETIME2           NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    DownloadCount   INT                 NOT NULL DEFAULT 0,
    LastAccessedAt  DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Entitlements PRIMARY KEY CLUSTERED (EntitlementId),
    CONSTRAINT FK_Entitlements_User FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_Entitlements_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT FK_Entitlements_Purchase FOREIGN KEY (PurchaseId) REFERENCES retomy.Purchases(PurchaseId)
);
GO

-- =============================================================================
-- WISHLISTS
-- =============================================================================

CREATE TABLE retomy.Wishlists (
    WishlistId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    NotifyOnSale    BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Wishlists PRIMARY KEY CLUSTERED (WishlistId),
    CONSTRAINT FK_Wishlists_User FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_Wishlists_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT UQ_Wishlists_UserDataset UNIQUE (UserId, DatasetId)
);
GO

-- =============================================================================
-- CART
-- =============================================================================

CREATE TABLE retomy.CartItems (
    CartItemId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    AddedAt         DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_CartItems PRIMARY KEY CLUSTERED (CartItemId),
    CONSTRAINT FK_CartItems_User FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_CartItems_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT UQ_CartItems_UserDataset UNIQUE (UserId, DatasetId)
);
GO

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE retomy.Notifications (
    NotificationId  UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    Type            NVARCHAR(50)        NOT NULL,  -- purchase, review, update, system, promo
    Title           NVARCHAR(255)       NOT NULL,
    Message         NVARCHAR(MAX)       NOT NULL,
    ActionUrl       NVARCHAR(500)       NULL,
    IsRead          BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Notifications PRIMARY KEY CLUSTERED (NotificationId),
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
);
GO

CREATE NONCLUSTERED INDEX IX_Notifications_UserId ON retomy.Notifications(UserId, IsRead, CreatedAt DESC);
GO

-- =============================================================================
-- AUDIT LOG (Immutable)
-- =============================================================================

CREATE TABLE retomy.AuditLogs (
    AuditLogId      BIGINT              IDENTITY(1,1) NOT NULL,
    UserId          UNIQUEIDENTIFIER    NULL,
    Action          NVARCHAR(100)       NOT NULL,
    EntityType      NVARCHAR(100)       NOT NULL,
    EntityId        NVARCHAR(255)       NULL,
    OldValues       NVARCHAR(MAX)       NULL,  -- JSON
    NewValues       NVARCHAR(MAX)       NULL,  -- JSON
    IpAddress       NVARCHAR(45)        NULL,
    UserAgent       NVARCHAR(500)       NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_AuditLogs PRIMARY KEY CLUSTERED (AuditLogId)
);
GO

CREATE NONCLUSTERED INDEX IX_AuditLogs_UserId ON retomy.AuditLogs(UserId, CreatedAt DESC);
CREATE NONCLUSTERED INDEX IX_AuditLogs_EntityType ON retomy.AuditLogs(EntityType, EntityId);
CREATE NONCLUSTERED INDEX IX_AuditLogs_Action ON retomy.AuditLogs(Action, CreatedAt DESC);
GO

-- =============================================================================
-- SELLER PAYOUTS
-- =============================================================================

CREATE TABLE retomy.SellerPayouts (
    PayoutId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    SellerId        UNIQUEIDENTIFIER    NOT NULL,
    Amount          DECIMAL(18,2)       NOT NULL,
    Currency        NVARCHAR(3)         NOT NULL DEFAULT 'USD',
    Status          NVARCHAR(50)        NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    PayoutMethod    NVARCHAR(50)        NULL,
    PayoutRef       NVARCHAR(255)       NULL,
    PeriodStart     DATETIME2           NOT NULL,
    PeriodEnd       DATETIME2           NOT NULL,
    CompletedAt     DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_SellerPayouts PRIMARY KEY CLUSTERED (PayoutId),
    CONSTRAINT FK_SellerPayouts_Seller FOREIGN KEY (SellerId) REFERENCES retomy.Users(UserId)
);
GO

-- =============================================================================
-- DATASET REPORTS (Moderation)
-- =============================================================================

CREATE TABLE retomy.DatasetReports (
    ReportId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    DatasetId       UNIQUEIDENTIFIER    NOT NULL,
    ReporterId      UNIQUEIDENTIFIER    NOT NULL,
    Reason          NVARCHAR(100)       NOT NULL,
    Description     NVARCHAR(MAX)       NULL,
    Status          NVARCHAR(50)        NOT NULL DEFAULT 'open',  -- open, investigating, resolved, dismissed
    ResolvedBy      UNIQUEIDENTIFIER    NULL,
    Resolution      NVARCHAR(MAX)       NULL,
    ResolvedAt      DATETIME2           NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_DatasetReports PRIMARY KEY CLUSTERED (ReportId),
    CONSTRAINT FK_DatasetReports_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
    CONSTRAINT FK_DatasetReports_Reporter FOREIGN KEY (ReporterId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_DatasetReports_Resolver FOREIGN KEY (ResolvedBy) REFERENCES retomy.Users(UserId)
);
GO

-- =============================================================================
-- USAGE METRICS
-- =============================================================================

CREATE TABLE retomy.UsageMetrics (
    MetricId        BIGINT              IDENTITY(1,1) NOT NULL,
    UserId          UNIQUEIDENTIFIER    NULL,
    DatasetId       UNIQUEIDENTIFIER    NULL,
    MetricType      NVARCHAR(50)        NOT NULL,  -- view, download, query, api_call, search
    MetricValue     DECIMAL(18,4)       NULL,
    Metadata        NVARCHAR(MAX)       NULL,  -- JSON
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_UsageMetrics PRIMARY KEY CLUSTERED (MetricId)
);
GO

CREATE NONCLUSTERED INDEX IX_UsageMetrics_DatasetId ON retomy.UsageMetrics(DatasetId, MetricType, CreatedAt DESC);
CREATE NONCLUSTERED INDEX IX_UsageMetrics_UserId ON retomy.UsageMetrics(UserId, MetricType, CreatedAt DESC);
GO

-- =============================================================================
-- FOLLOWERS (User follows Seller)
-- =============================================================================

CREATE TABLE retomy.Followers (
    FollowerId      UNIQUEIDENTIFIER    NOT NULL,
    FollowingId     UNIQUEIDENTIFIER    NOT NULL,
    CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Followers PRIMARY KEY CLUSTERED (FollowerId, FollowingId),
    CONSTRAINT FK_Followers_Follower FOREIGN KEY (FollowerId) REFERENCES retomy.Users(UserId),
    CONSTRAINT FK_Followers_Following FOREIGN KEY (FollowingId) REFERENCES retomy.Users(UserId)
);
GO

PRINT 'Migration 001 completed successfully - Core schema created.';
GO
