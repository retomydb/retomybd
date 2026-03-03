-- =============================================================================
-- retomY — Enterprise Dataset Marketplace
-- Migration 002: Stored Procedures
-- =============================================================================

-- =============================================================================
-- SP: Register New User
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_RegisterUser
    @Email          NVARCHAR(255),
    @PasswordHash   NVARCHAR(512),
    @PasswordSalt   NVARCHAR(256),
    @FirstName      NVARCHAR(100),
    @LastName       NVARCHAR(100),
    @DisplayName    NVARCHAR(150) = NULL,
    @Role           NVARCHAR(50) = 'user',
    @IpAddress      NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM retomy.Users WHERE Email = @Email AND DeletedAt IS NULL)
    BEGIN
        RAISERROR('Email already registered', 16, 1);
        RETURN;
    END

    DECLARE @UserId UNIQUEIDENTIFIER = NEWID();
    DECLARE @FinalDisplayName NVARCHAR(150) = COALESCE(@DisplayName, @FirstName + ' ' + @LastName);

    BEGIN TRANSACTION;

    INSERT INTO retomy.Users (UserId, Email, PasswordHash, PasswordSalt, FirstName, LastName, DisplayName, Role)
    VALUES (@UserId, @Email, @PasswordHash, @PasswordSalt, @FirstName, @LastName, @FinalDisplayName, @Role);

    -- Audit log
    INSERT INTO retomy.AuditLogs (UserId, Action, EntityType, EntityId, IpAddress)
    VALUES (@UserId, 'USER_REGISTERED', 'User', CAST(@UserId AS NVARCHAR(255)), @IpAddress);

    COMMIT TRANSACTION;

    -- Return user data
    SELECT
        UserId, Email, FirstName, LastName, DisplayName, Role,
        CreditsBalance, IsEmailVerified, IsSellerVerified, CreatedAt
    FROM retomy.Users
    WHERE UserId = @UserId;
END
GO

-- =============================================================================
-- SP: Authenticate User
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_AuthenticateUser
    @Email      NVARCHAR(255),
    @IpAddress  NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId UNIQUEIDENTIFIER;
    DECLARE @LockoutEnd DATETIME2;
    DECLARE @FailedAttempts INT;

    SELECT @UserId = UserId, @LockoutEnd = LockoutEndAt, @FailedAttempts = FailedLoginAttempts
    FROM retomy.Users
    WHERE Email = @Email AND DeletedAt IS NULL;

    IF @UserId IS NULL
    BEGIN
        RAISERROR('Invalid credentials', 16, 1);
        RETURN;
    END

    -- Check lockout
    IF @LockoutEnd IS NOT NULL AND @LockoutEnd > SYSUTCDATETIME()
    BEGIN
        RAISERROR('Account is temporarily locked. Try again later.', 16, 1);
        RETURN;
    END

    -- Check suspension
    IF EXISTS (SELECT 1 FROM retomy.Users WHERE UserId = @UserId AND IsSuspended = 1)
    BEGIN
        RAISERROR('Account is suspended', 16, 1);
        RETURN;
    END

    -- Return user data with password hash for verification in application layer
    SELECT
        UserId, Email, PasswordHash, PasswordSalt, FirstName, LastName,
        DisplayName, AvatarUrl, Role, CreditsBalance,
        IsEmailVerified, IsSellerVerified, IsSuspended,
        FailedLoginAttempts, LockoutEndAt
    FROM retomy.Users
    WHERE UserId = @UserId;
END
GO

-- =============================================================================
-- SP: Record Login Success
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_RecordLoginSuccess
    @UserId     UNIQUEIDENTIFIER,
    @IpAddress  NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE retomy.Users
    SET LastLoginAt = SYSUTCDATETIME(),
        LastLoginIp = @IpAddress,
        FailedLoginAttempts = 0,
        LockoutEndAt = NULL,
        UpdatedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId;

    INSERT INTO retomy.AuditLogs (UserId, Action, EntityType, EntityId, IpAddress)
    VALUES (@UserId, 'LOGIN_SUCCESS', 'User', CAST(@UserId AS NVARCHAR(255)), @IpAddress);
END
GO

-- =============================================================================
-- SP: Record Login Failure
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_RecordLoginFailure
    @Email      NVARCHAR(255),
    @IpAddress  NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId UNIQUEIDENTIFIER;
    DECLARE @FailedAttempts INT;

    SELECT @UserId = UserId, @FailedAttempts = FailedLoginAttempts
    FROM retomy.Users
    WHERE Email = @Email AND DeletedAt IS NULL;

    IF @UserId IS NOT NULL
    BEGIN
        SET @FailedAttempts = @FailedAttempts + 1;

        UPDATE retomy.Users
        SET FailedLoginAttempts = @FailedAttempts,
            LockoutEndAt = CASE WHEN @FailedAttempts >= 5
                           THEN DATEADD(MINUTE, 15, SYSUTCDATETIME())
                           ELSE LockoutEndAt END,
            UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @UserId;

        INSERT INTO retomy.AuditLogs (UserId, Action, EntityType, EntityId, IpAddress,
            NewValues)
        VALUES (@UserId, 'LOGIN_FAILURE', 'User', CAST(@UserId AS NVARCHAR(255)), @IpAddress,
            '{"failed_attempts":' + CAST(@FailedAttempts AS NVARCHAR(10)) + '}');
    END
END
GO

-- =============================================================================
-- SP: Get User Profile
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetUserProfile
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId, u.Email, u.FirstName, u.LastName, u.DisplayName,
        u.AvatarUrl, u.Bio, u.Company, u.Website, u.Location,
        u.Role, u.CreditsBalance, u.IsEmailVerified, u.IsSellerVerified,
        u.CreatedAt, u.LastLoginAt,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE SellerId = u.UserId AND DeletedAt IS NULL AND Status = 'published') AS PublishedDatasets,
        (SELECT COUNT(*) FROM retomy.Purchases WHERE BuyerId = u.UserId AND Status = 'completed') AS TotalPurchases,
        (SELECT COUNT(*) FROM retomy.Followers WHERE FollowingId = u.UserId) AS FollowerCount,
        (SELECT COUNT(*) FROM retomy.Followers WHERE FollowerId = u.UserId) AS FollowingCount
    FROM retomy.Users u
    WHERE u.UserId = @UserId AND u.DeletedAt IS NULL;
END
GO

-- =============================================================================
-- SP: Update User Profile
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_UpdateUserProfile
    @UserId         UNIQUEIDENTIFIER,
    @FirstName      NVARCHAR(100) = NULL,
    @LastName       NVARCHAR(100) = NULL,
    @DisplayName    NVARCHAR(150) = NULL,
    @Bio            NVARCHAR(2000) = NULL,
    @Company        NVARCHAR(255) = NULL,
    @Website        NVARCHAR(500) = NULL,
    @Location       NVARCHAR(255) = NULL,
    @AvatarUrl      NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE retomy.Users
    SET FirstName   = COALESCE(@FirstName, FirstName),
        LastName    = COALESCE(@LastName, LastName),
        DisplayName = COALESCE(@DisplayName, DisplayName),
        Bio         = COALESCE(@Bio, Bio),
        Company     = COALESCE(@Company, Company),
        Website     = COALESCE(@Website, Website),
        Location    = COALESCE(@Location, Location),
        AvatarUrl   = COALESCE(@AvatarUrl, AvatarUrl),
        UpdatedAt   = SYSUTCDATETIME()
    WHERE UserId = @UserId AND DeletedAt IS NULL;

    EXEC retomy.sp_GetUserProfile @UserId;
END
GO

-- =============================================================================
-- SP: Create Dataset
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_CreateDataset
    @SellerId           UNIQUEIDENTIFIER,
    @Title              NVARCHAR(300),
    @ShortDescription   NVARCHAR(500),
    @FullDescription    NVARCHAR(MAX) = NULL,
    @CategoryId         INT = NULL,
    @Price              DECIMAL(18,2) = 0.00,
    @PricingModel       NVARCHAR(50) = 'one-time',
    @LicenseType        NVARCHAR(100) = 'standard',
    @FileFormat         NVARCHAR(50) = NULL,
    @Tags               NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validate seller
    IF NOT EXISTS (SELECT 1 FROM retomy.Users WHERE UserId = @SellerId AND DeletedAt IS NULL)
    BEGIN
        RAISERROR('User not found', 16, 1);
        RETURN;
    END

    DECLARE @DatasetId UNIQUEIDENTIFIER = NEWID();
    DECLARE @Slug NVARCHAR(300);

    -- Generate slug from title
    SET @Slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(@Title), ' ', '-'), '''', ''), '"', ''), '.', ''));
    -- Ensure unique slug
    DECLARE @Counter INT = 0;
    DECLARE @BaseSlug NVARCHAR(300) = @Slug;
    WHILE EXISTS (SELECT 1 FROM retomy.Datasets WHERE Slug = @Slug)
    BEGIN
        SET @Counter = @Counter + 1;
        SET @Slug = @BaseSlug + '-' + CAST(@Counter AS NVARCHAR(10));
    END

    BEGIN TRANSACTION;

    INSERT INTO retomy.Datasets (
        DatasetId, SellerId, CategoryId, Title, Slug, ShortDescription,
        FullDescription, Price, PricingModel, LicenseType, FileFormat, Tags, Status
    )
    VALUES (
        @DatasetId, @SellerId, @CategoryId, @Title, @Slug, @ShortDescription,
        @FullDescription, @Price, @PricingModel, @LicenseType, @FileFormat, @Tags, 'draft'
    );

    INSERT INTO retomy.AuditLogs (UserId, Action, EntityType, EntityId)
    VALUES (@SellerId, 'DATASET_CREATED', 'Dataset', CAST(@DatasetId AS NVARCHAR(255)));

    COMMIT TRANSACTION;

    SELECT * FROM retomy.Datasets WHERE DatasetId = @DatasetId;
END
GO

-- =============================================================================
-- SP: Get Dataset Detail
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetDatasetDetail
    @DatasetId  UNIQUEIDENTIFIER,
    @ViewerId   UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Increment view count
    UPDATE retomy.Datasets
    SET TotalViews = TotalViews + 1
    WHERE DatasetId = @DatasetId AND DeletedAt IS NULL;

    -- Log view metric
    IF @ViewerId IS NOT NULL
    BEGIN
        INSERT INTO retomy.UsageMetrics (UserId, DatasetId, MetricType, MetricValue)
        VALUES (@ViewerId, @DatasetId, 'view', 1);
    END

    -- Return dataset with seller info
    SELECT
        d.*,
        u.DisplayName AS SellerName,
        u.AvatarUrl AS SellerAvatarUrl,
        u.IsSellerVerified,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE SellerId = d.SellerId AND Status = 'published' AND DeletedAt IS NULL) AS SellerDatasetCount,
        (SELECT COUNT(*) FROM retomy.Followers WHERE FollowingId = d.SellerId) AS SellerFollowers,
        CASE WHEN @ViewerId IS NOT NULL AND EXISTS (
            SELECT 1 FROM retomy.Entitlements WHERE UserId = @ViewerId AND DatasetId = d.DatasetId AND IsActive = 1
        ) THEN 1 ELSE 0 END AS HasAccess,
        CASE WHEN @ViewerId IS NOT NULL AND EXISTS (
            SELECT 1 FROM retomy.Wishlists WHERE UserId = @ViewerId AND DatasetId = d.DatasetId
        ) THEN 1 ELSE 0 END AS IsWishlisted
    FROM retomy.Datasets d
    INNER JOIN retomy.Users u ON d.SellerId = u.UserId
    WHERE d.DatasetId = @DatasetId AND d.DeletedAt IS NULL;

    -- Return reviews
    SELECT
        r.ReviewId, r.Rating, r.Title, r.Content, r.IsVerifiedPurchase,
        r.HelpfulCount, r.CreatedAt, r.SellerResponse, r.SellerRespondedAt,
        u.DisplayName AS ReviewerName, u.AvatarUrl AS ReviewerAvatarUrl
    FROM retomy.Reviews r
    INNER JOIN retomy.Users u ON r.UserId = u.UserId
    WHERE r.DatasetId = @DatasetId AND r.Status = 'active'
    ORDER BY r.CreatedAt DESC;
END
GO

-- =============================================================================
-- SP: Search Datasets
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_SearchDatasets
    @Query          NVARCHAR(300) = NULL,
    @CategoryId     INT = NULL,
    @MinPrice       DECIMAL(18,2) = NULL,
    @MaxPrice       DECIMAL(18,2) = NULL,
    @FileFormat     NVARCHAR(50) = NULL,
    @PricingModel   NVARCHAR(50) = NULL,
    @SortBy         NVARCHAR(50) = 'relevance',  -- relevance, newest, price_asc, price_desc, rating, downloads
    @PageNumber     INT = 1,
    @PageSize       INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    -- Get total count
    SELECT COUNT(*) AS TotalCount
    FROM retomy.Datasets d
    WHERE d.Status = 'published'
      AND d.DeletedAt IS NULL
      AND (@Query IS NULL OR d.Title LIKE '%' + @Query + '%' OR d.ShortDescription LIKE '%' + @Query + '%' OR d.Tags LIKE '%' + @Query + '%')
      AND (@CategoryId IS NULL OR d.CategoryId = @CategoryId)
      AND (@MinPrice IS NULL OR d.Price >= @MinPrice)
      AND (@MaxPrice IS NULL OR d.Price <= @MaxPrice)
      AND (@FileFormat IS NULL OR d.FileFormat = @FileFormat)
      AND (@PricingModel IS NULL OR d.PricingModel = @PricingModel);

    -- Get paginated results
    SELECT
        d.DatasetId, d.Title, d.Slug, d.ShortDescription, d.ThumbnailUrl,
        d.Price, d.Currency, d.PricingModel, d.FileFormat, d.FileSize,
        d.[RowCount], d.AverageRating, d.TotalReviews, d.TotalDownloads,
        d.TotalViews, d.IsFeatured, d.PublishedAt, d.Tags,
        u.DisplayName AS SellerName, u.IsSellerVerified,
        c.Name AS CategoryName, c.Slug AS CategorySlug
    FROM retomy.Datasets d
    INNER JOIN retomy.Users u ON d.SellerId = u.UserId
    LEFT JOIN retomy.Categories c ON d.CategoryId = c.CategoryId
    WHERE d.Status = 'published'
      AND d.DeletedAt IS NULL
      AND (@Query IS NULL OR d.Title LIKE '%' + @Query + '%' OR d.ShortDescription LIKE '%' + @Query + '%' OR d.Tags LIKE '%' + @Query + '%')
      AND (@CategoryId IS NULL OR d.CategoryId = @CategoryId)
      AND (@MinPrice IS NULL OR d.Price >= @MinPrice)
      AND (@MaxPrice IS NULL OR d.Price <= @MaxPrice)
      AND (@FileFormat IS NULL OR d.FileFormat = @FileFormat)
      AND (@PricingModel IS NULL OR d.PricingModel = @PricingModel)
    ORDER BY
        CASE WHEN @SortBy = 'newest' THEN d.PublishedAt END DESC,
        CASE WHEN @SortBy = 'price_asc' THEN d.Price END ASC,
        CASE WHEN @SortBy = 'price_desc' THEN d.Price END DESC,
        CASE WHEN @SortBy = 'rating' THEN d.AverageRating END DESC,
        CASE WHEN @SortBy = 'downloads' THEN d.TotalDownloads END DESC,
        CASE WHEN @SortBy = 'relevance' OR @SortBy IS NULL THEN d.IsFeatured END DESC,
        d.TotalDownloads DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- =============================================================================
-- SP: Purchase Dataset
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_PurchaseDataset
    @BuyerId        UNIQUEIDENTIFIER,
    @DatasetId      UNIQUEIDENTIFIER,
    @PaymentMethod  NVARCHAR(50) = 'credits',
    @PaymentRef     NVARCHAR(255) = NULL,
    @IpAddress      NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validate dataset
    DECLARE @Price DECIMAL(18,2), @SellerId UNIQUEIDENTIFIER, @Currency NVARCHAR(3), @DatasetTitle NVARCHAR(300);
    SELECT @Price = Price, @SellerId = SellerId, @Currency = Currency, @DatasetTitle = Title
    FROM retomy.Datasets
    WHERE DatasetId = @DatasetId AND Status = 'published' AND DeletedAt IS NULL;

    IF @Price IS NULL
    BEGIN
        RAISERROR('Dataset not available for purchase', 16, 1);
        RETURN;
    END

    -- Can't buy own dataset
    IF @BuyerId = @SellerId
    BEGIN
        RAISERROR('Cannot purchase your own dataset', 16, 1);
        RETURN;
    END

    -- Check if already purchased
    IF EXISTS (SELECT 1 FROM retomy.Purchases WHERE BuyerId = @BuyerId AND DatasetId = @DatasetId AND Status = 'completed')
    BEGIN
        RAISERROR('Dataset already purchased', 16, 1);
        RETURN;
    END

    DECLARE @PlatformFee DECIMAL(18,2) = @Price * 0.15;  -- 15% commission
    DECLARE @SellerEarnings DECIMAL(18,2) = @Price - @PlatformFee;
    DECLARE @PurchaseId UNIQUEIDENTIFIER = NEWID();
    DECLARE @InvoiceNumber NVARCHAR(50) = 'INV-' + FORMAT(SYSUTCDATETIME(), 'yyyyMMdd') + '-' + LEFT(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', ''), 8);

    BEGIN TRANSACTION;

    -- Check credits if paying with credits
    IF @PaymentMethod = 'credits'
    BEGIN
        DECLARE @Balance DECIMAL(18,2);
        SELECT @Balance = CreditsBalance FROM retomy.Users WHERE UserId = @BuyerId;

        IF @Balance < @Price
        BEGIN
            ROLLBACK TRANSACTION;
            RAISERROR('Insufficient credits', 16, 1);
            RETURN;
        END

        -- Deduct credits
        UPDATE retomy.Users SET CreditsBalance = CreditsBalance - @Price, UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @BuyerId;

        -- Add to seller balance
        UPDATE retomy.Users SET CreditsBalance = CreditsBalance + @SellerEarnings, UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @SellerId;
    END

    -- Create purchase record
    INSERT INTO retomy.Purchases (PurchaseId, BuyerId, DatasetId, SellerId, Amount, PlatformFee, SellerEarnings,
        Currency, PaymentMethod, PaymentRef, Status, InvoiceNumber, CompletedAt)
    VALUES (@PurchaseId, @BuyerId, @DatasetId, @SellerId, @Price, @PlatformFee, @SellerEarnings,
        @Currency, @PaymentMethod, @PaymentRef, 'completed', @InvoiceNumber, SYSUTCDATETIME());

    -- Create entitlement
    INSERT INTO retomy.Entitlements (UserId, DatasetId, PurchaseId, AccessLevel, IsActive)
    VALUES (@BuyerId, @DatasetId, @PurchaseId, 'download', 1);

    -- Update dataset stats
    UPDATE retomy.Datasets SET TotalPurchases = TotalPurchases + 1, UpdatedAt = SYSUTCDATETIME()
    WHERE DatasetId = @DatasetId;

    -- Remove from cart if present
    DELETE FROM retomy.CartItems WHERE UserId = @BuyerId AND DatasetId = @DatasetId;

    -- Remove from wishlist if present
    DELETE FROM retomy.Wishlists WHERE UserId = @BuyerId AND DatasetId = @DatasetId;

    -- Create notifications
    INSERT INTO retomy.Notifications (UserId, Type, Title, Message, ActionUrl)
    VALUES (@BuyerId, 'purchase', 'Purchase Complete', 'You now have access to "' + @DatasetTitle + '"',
        '/datasets/' + CAST(@DatasetId AS NVARCHAR(36)));

    INSERT INTO retomy.Notifications (UserId, Type, Title, Message, ActionUrl)
    VALUES (@SellerId, 'purchase', 'New Sale!', 'Someone purchased "' + @DatasetTitle + '" for ' + CAST(@Price AS NVARCHAR(20)) + ' ' + @Currency,
        '/seller/dashboard');

    -- Audit log
    INSERT INTO retomy.AuditLogs (UserId, Action, EntityType, EntityId, IpAddress, NewValues)
    VALUES (@BuyerId, 'DATASET_PURCHASED', 'Purchase', CAST(@PurchaseId AS NVARCHAR(255)), @IpAddress,
        '{"dataset_id":"' + CAST(@DatasetId AS NVARCHAR(36)) + '","amount":' + CAST(@Price AS NVARCHAR(20)) + '}');

    COMMIT TRANSACTION;

    -- Return purchase details
    SELECT
        p.*, d.Title AS DatasetTitle, d.Slug AS DatasetSlug, d.FullBlobPath
    FROM retomy.Purchases p
    INNER JOIN retomy.Datasets d ON p.DatasetId = d.DatasetId
    WHERE p.PurchaseId = @PurchaseId;
END
GO

-- =============================================================================
-- SP: Get Buyer Dashboard
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetBuyerDashboard
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    -- User summary
    SELECT UserId, DisplayName, AvatarUrl, CreditsBalance, Role
    FROM retomy.Users WHERE UserId = @UserId;

    -- Recent purchases
    SELECT TOP 10
        p.PurchaseId, p.Amount, p.Currency, p.Status, p.CompletedAt,
        d.DatasetId, d.Title, d.Slug, d.ThumbnailUrl, d.FileFormat,
        e.DownloadCount, e.LastAccessedAt
    FROM retomy.Purchases p
    INNER JOIN retomy.Datasets d ON p.DatasetId = d.DatasetId
    LEFT JOIN retomy.Entitlements e ON e.PurchaseId = p.PurchaseId
    WHERE p.BuyerId = @UserId AND p.Status = 'completed'
    ORDER BY p.CompletedAt DESC;

    -- Unread notifications
    SELECT TOP 10
        NotificationId, Type, Title, Message, ActionUrl, CreatedAt
    FROM retomy.Notifications
    WHERE UserId = @UserId AND IsRead = 0
    ORDER BY CreatedAt DESC;

    -- Wishlist count
    SELECT COUNT(*) AS WishlistCount FROM retomy.Wishlists WHERE UserId = @UserId;

    -- Buyer stats
    SELECT
        (SELECT COUNT(*) FROM retomy.Purchases WHERE BuyerId = @UserId AND Status = 'completed') AS TotalPurchases,
        (SELECT ISNULL(SUM(Amount), 0) FROM retomy.Purchases WHERE BuyerId = @UserId AND Status = 'completed') AS TotalSpent,
        (SELECT COUNT(*) FROM retomy.Reviews WHERE UserId = @UserId) AS TotalReviews;
END
GO

-- =============================================================================
-- SP: Get Seller Dashboard
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetSellerDashboard
    @SellerId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    -- Seller summary
    SELECT
        u.UserId, u.DisplayName, u.AvatarUrl, u.CreditsBalance, u.IsSellerVerified,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE SellerId = @SellerId AND DeletedAt IS NULL) AS TotalDatasets,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE SellerId = @SellerId AND Status = 'published' AND DeletedAt IS NULL) AS PublishedDatasets,
        (SELECT ISNULL(SUM(SellerEarnings), 0) FROM retomy.Purchases WHERE SellerId = @SellerId AND Status = 'completed') AS TotalEarnings,
        (SELECT COUNT(*) FROM retomy.Purchases WHERE SellerId = @SellerId AND Status = 'completed') AS TotalSales,
        (SELECT COUNT(*) FROM retomy.Followers WHERE FollowingId = @SellerId) AS FollowerCount
    FROM retomy.Users u
    WHERE u.UserId = @SellerId;

    -- Recent sales
    SELECT TOP 10
        p.PurchaseId, p.Amount, p.PlatformFee, p.SellerEarnings, p.CompletedAt,
        d.Title AS DatasetTitle, d.Slug AS DatasetSlug,
        buyer.DisplayName AS BuyerName
    FROM retomy.Purchases p
    INNER JOIN retomy.Datasets d ON p.DatasetId = d.DatasetId
    INNER JOIN retomy.Users buyer ON p.BuyerId = buyer.UserId
    WHERE p.SellerId = @SellerId AND p.Status = 'completed'
    ORDER BY p.CompletedAt DESC;

    -- Revenue by month (last 12 months)
    SELECT
        FORMAT(p.CompletedAt, 'yyyy-MM') AS Month,
        SUM(p.SellerEarnings) AS Revenue,
        COUNT(*) AS SalesCount
    FROM retomy.Purchases p
    WHERE p.SellerId = @SellerId
      AND p.Status = 'completed'
      AND p.CompletedAt >= DATEADD(MONTH, -12, SYSUTCDATETIME())
    GROUP BY FORMAT(p.CompletedAt, 'yyyy-MM')
    ORDER BY Month;

    -- Dataset performance
    SELECT
        d.DatasetId, d.Title, d.Slug, d.Status, d.Price,
        d.TotalViews, d.TotalDownloads, d.TotalPurchases,
        d.AverageRating, d.TotalReviews, d.CreatedAt
    FROM retomy.Datasets d
    WHERE d.SellerId = @SellerId AND d.DeletedAt IS NULL
    ORDER BY d.TotalPurchases DESC;
END
GO

-- =============================================================================
-- SP: Admin Get Platform Stats
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetPlatformStats
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM retomy.Users WHERE DeletedAt IS NULL) AS TotalUsers,
        (SELECT COUNT(DISTINCT SellerId) FROM retomy.Datasets WHERE DeletedAt IS NULL) AS TotalSellers,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE DeletedAt IS NULL) AS TotalDatasets,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE Status = 'published' AND DeletedAt IS NULL) AS PublishedDatasets,
        (SELECT COUNT(*) FROM retomy.Datasets WHERE Status = 'pending_review' AND DeletedAt IS NULL) AS PendingReview,
        (SELECT COUNT(*) FROM retomy.Purchases WHERE Status = 'completed') AS TotalTransactions,
        (SELECT ISNULL(SUM(Amount), 0) FROM retomy.Purchases WHERE Status = 'completed') AS TotalRevenue,
        (SELECT ISNULL(SUM(PlatformFee), 0) FROM retomy.Purchases WHERE Status = 'completed') AS PlatformRevenue,
        (SELECT COUNT(*) FROM retomy.DatasetReports WHERE Status = 'open') AS OpenReports;

    -- New users by day (last 30 days)
    SELECT
        CAST(CreatedAt AS DATE) AS Date,
        COUNT(*) AS NewUsers
    FROM retomy.Users
    WHERE CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME()) AND DeletedAt IS NULL
    GROUP BY CAST(CreatedAt AS DATE)
    ORDER BY Date;

    -- Revenue by day (last 30 days)
    SELECT
        CAST(CompletedAt AS DATE) AS Date,
        SUM(Amount) AS Revenue,
        SUM(PlatformFee) AS PlatformFee,
        COUNT(*) AS Transactions
    FROM retomy.Purchases
    WHERE CompletedAt >= DATEADD(DAY, -30, SYSUTCDATETIME()) AND Status = 'completed'
    GROUP BY CAST(CompletedAt AS DATE)
    ORDER BY Date;
END
GO

-- =============================================================================
-- SP: Add to Cart
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_AddToCart
    @UserId     UNIQUEIDENTIFIER,
    @DatasetId  UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM retomy.Datasets WHERE DatasetId = @DatasetId AND Status = 'published' AND DeletedAt IS NULL)
    BEGIN
        RAISERROR('Dataset not available', 16, 1);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM retomy.Entitlements WHERE UserId = @UserId AND DatasetId = @DatasetId AND IsActive = 1)
    BEGIN
        RAISERROR('You already own this dataset', 16, 1);
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM retomy.CartItems WHERE UserId = @UserId AND DatasetId = @DatasetId)
    BEGIN
        INSERT INTO retomy.CartItems (UserId, DatasetId) VALUES (@UserId, @DatasetId);
    END

    -- Return cart contents
    SELECT
        ci.CartItemId, ci.AddedAt,
        d.DatasetId, d.Title, d.Slug, d.ThumbnailUrl, d.Price, d.Currency, d.PricingModel,
        u.DisplayName AS SellerName
    FROM retomy.CartItems ci
    INNER JOIN retomy.Datasets d ON ci.DatasetId = d.DatasetId
    INNER JOIN retomy.Users u ON d.SellerId = u.UserId
    WHERE ci.UserId = @UserId
    ORDER BY ci.AddedAt DESC;
END
GO

-- =============================================================================
-- SP: Submit Review
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_SubmitReview
    @UserId     UNIQUEIDENTIFIER,
    @DatasetId  UNIQUEIDENTIFIER,
    @Rating     TINYINT,
    @Title      NVARCHAR(255) = NULL,
    @Content    NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IsVerified BIT = 0;
    IF EXISTS (SELECT 1 FROM retomy.Purchases WHERE BuyerId = @UserId AND DatasetId = @DatasetId AND Status = 'completed')
        SET @IsVerified = 1;

    BEGIN TRANSACTION;

    INSERT INTO retomy.Reviews (DatasetId, UserId, Rating, Title, Content, IsVerifiedPurchase)
    VALUES (@DatasetId, @UserId, @Rating, @Title, @Content, @IsVerified);

    -- Update dataset average rating
    UPDATE retomy.Datasets
    SET AverageRating = (SELECT AVG(CAST(Rating AS DECIMAL(3,2))) FROM retomy.Reviews WHERE DatasetId = @DatasetId AND Status = 'active'),
        TotalReviews = (SELECT COUNT(*) FROM retomy.Reviews WHERE DatasetId = @DatasetId AND Status = 'active'),
        UpdatedAt = SYSUTCDATETIME()
    WHERE DatasetId = @DatasetId;

    COMMIT TRANSACTION;

    SELECT 'Review submitted successfully' AS Message;
END
GO

-- =============================================================================
-- SP: Get Featured / Home Page Data
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetHomepageData
AS
BEGIN
    SET NOCOUNT ON;

    -- Featured datasets
    SELECT TOP 6
        d.DatasetId, d.Title, d.Slug, d.ShortDescription, d.ThumbnailUrl, d.BannerUrl,
        d.Price, d.Currency, d.PricingModel, d.AverageRating, d.TotalReviews,
        d.TotalDownloads, d.FileFormat, d.Tags, d.PublishedAt,
        u.DisplayName AS SellerName, u.IsSellerVerified,
        c.Name AS CategoryName
    FROM retomy.Datasets d
    INNER JOIN retomy.Users u ON d.SellerId = u.UserId
    LEFT JOIN retomy.Categories c ON d.CategoryId = c.CategoryId
    WHERE d.Status = 'published' AND d.DeletedAt IS NULL AND d.IsFeatured = 1
    ORDER BY d.PublishedAt DESC;

    -- Trending datasets (most downloads in last 7 days, fallback to all-time)
    SELECT TOP 12
        d.DatasetId, d.Title, d.Slug, d.ShortDescription, d.ThumbnailUrl,
        d.Price, d.Currency, d.PricingModel, d.AverageRating, d.TotalReviews,
        d.TotalDownloads, d.FileFormat, d.Tags,
        u.DisplayName AS SellerName, u.IsSellerVerified,
        c.Name AS CategoryName
    FROM retomy.Datasets d
    INNER JOIN retomy.Users u ON d.SellerId = u.UserId
    LEFT JOIN retomy.Categories c ON d.CategoryId = c.CategoryId
    WHERE d.Status = 'published' AND d.DeletedAt IS NULL
    ORDER BY d.TotalDownloads DESC, d.TotalViews DESC;

    -- New arrivals
    SELECT TOP 12
        d.DatasetId, d.Title, d.Slug, d.ShortDescription, d.ThumbnailUrl,
        d.Price, d.Currency, d.PricingModel, d.AverageRating, d.TotalReviews,
        d.TotalDownloads, d.FileFormat, d.Tags,
        u.DisplayName AS SellerName, u.IsSellerVerified,
        c.Name AS CategoryName
    FROM retomy.Datasets d
    INNER JOIN retomy.Users u ON d.SellerId = u.UserId
    LEFT JOIN retomy.Categories c ON d.CategoryId = c.CategoryId
    WHERE d.Status = 'published' AND d.DeletedAt IS NULL
    ORDER BY d.PublishedAt DESC;

    -- Categories with counts
    SELECT
        c.CategoryId, c.Name, c.Slug, c.Description, c.IconUrl,
        COUNT(d.DatasetId) AS DatasetCount
    FROM retomy.Categories c
    LEFT JOIN retomy.Datasets d ON c.CategoryId = d.CategoryId AND d.Status = 'published' AND d.DeletedAt IS NULL
    WHERE c.IsActive = 1
    GROUP BY c.CategoryId, c.Name, c.Slug, c.Description, c.IconUrl, c.SortOrder
    ORDER BY c.SortOrder;

    -- Platform stats for hero section
    SELECT
        (SELECT COUNT(*) FROM retomy.Datasets WHERE Status = 'published' AND DeletedAt IS NULL) AS TotalDatasets,
        (SELECT COUNT(DISTINCT SellerId) FROM retomy.Datasets WHERE Status = 'published' AND DeletedAt IS NULL) AS TotalSellers,
        (SELECT COUNT(*) FROM retomy.Users WHERE DeletedAt IS NULL) AS TotalUsers,
        (SELECT ISNULL(SUM(TotalDownloads), 0) FROM retomy.Datasets WHERE Status = 'published' AND DeletedAt IS NULL) AS TotalDownloads,
        -- Count of free datasets by explicit pricing model, zero price, or NULL price
        (SELECT COUNT(*) FROM retomy.Datasets WHERE Status = 'published' AND DeletedAt IS NULL AND (Price = 0 OR Price IS NULL OR PricingModel = 'free')) AS FreeDatasets;
END
GO

-- =============================================================================
-- SP: Toggle Wishlist
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_ToggleWishlist
    @UserId     UNIQUEIDENTIFIER,
    @DatasetId  UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM retomy.Wishlists WHERE UserId = @UserId AND DatasetId = @DatasetId)
    BEGIN
        DELETE FROM retomy.Wishlists WHERE UserId = @UserId AND DatasetId = @DatasetId;
        SELECT 'removed' AS Action;
    END
    ELSE
    BEGIN
        INSERT INTO retomy.Wishlists (UserId, DatasetId) VALUES (@UserId, @DatasetId);
        SELECT 'added' AS Action;
    END
END
GO

-- =============================================================================
-- SP: Get User Notifications
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_GetNotifications
    @UserId     UNIQUEIDENTIFIER,
    @PageSize   INT = 20,
    @PageNumber INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT COUNT(*) AS TotalCount, SUM(CASE WHEN IsRead = 0 THEN 1 ELSE 0 END) AS UnreadCount
    FROM retomy.Notifications WHERE UserId = @UserId;

    SELECT NotificationId, Type, Title, Message, ActionUrl, IsRead, CreatedAt
    FROM retomy.Notifications
    WHERE UserId = @UserId
    ORDER BY CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- =============================================================================
-- SP: Mark Notifications Read
-- =============================================================================
CREATE OR ALTER PROCEDURE retomy.sp_MarkNotificationsRead
    @UserId         UNIQUEIDENTIFIER,
    @NotificationId UNIQUEIDENTIFIER = NULL  -- NULL = mark all read
AS
BEGIN
    SET NOCOUNT ON;

    IF @NotificationId IS NULL
        UPDATE retomy.Notifications SET IsRead = 1 WHERE UserId = @UserId AND IsRead = 0;
    ELSE
        UPDATE retomy.Notifications SET IsRead = 1 WHERE NotificationId = @NotificationId AND UserId = @UserId;
END
GO

PRINT 'Migration 002 completed successfully - Stored Procedures created.';
GO
