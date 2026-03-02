-- =============================================================================
-- Migration 005: Stripe Payment Integration
-- Adds Stripe Customer IDs, Connect Account IDs, and checkout session tracking
-- =============================================================================

-- Add Stripe fields to Users table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Users') AND name = 'StripeCustomerId')
BEGIN
    ALTER TABLE retomy.Users ADD StripeCustomerId NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Users') AND name = 'StripeConnectAccountId')
BEGIN
    ALTER TABLE retomy.Users ADD StripeConnectAccountId NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Users') AND name = 'StripeConnectOnboarded')
BEGIN
    ALTER TABLE retomy.Users ADD StripeConnectOnboarded BIT DEFAULT 0;
END
GO

-- Add Stripe session/intent tracking to Purchases
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Purchases') AND name = 'StripeSessionId')
BEGIN
    ALTER TABLE retomy.Purchases ADD StripeSessionId NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Purchases') AND name = 'StripePaymentIntentId')
BEGIN
    ALTER TABLE retomy.Purchases ADD StripePaymentIntentId NVARCHAR(255) NULL;
END
GO

-- Add Stripe payout tracking to SellerPayouts
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.SellerPayouts') AND name = 'StripeTransferId')
BEGIN
    ALTER TABLE retomy.SellerPayouts ADD StripeTransferId NVARCHAR(255) NULL;
END
GO

-- Create CheckoutSessions table to track pending Stripe sessions
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID('retomy') AND name = 'CheckoutSessions')
BEGIN
    CREATE TABLE retomy.CheckoutSessions (
        SessionId NVARCHAR(255) PRIMARY KEY,
        UserId UNIQUEIDENTIFIER NOT NULL,
        DatasetIds NVARCHAR(MAX) NOT NULL, -- JSON array of dataset IDs
        TotalAmount DECIMAL(18,2) NOT NULL,
        Currency NVARCHAR(10) DEFAULT 'USD',
        Status NVARCHAR(50) DEFAULT 'pending', -- pending, completed, expired
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        CompletedAt DATETIME2 NULL,
        FOREIGN KEY (UserId) REFERENCES retomy.Users(UserId)
    );
END
GO

PRINT 'Migration 005: Stripe integration columns added successfully';
