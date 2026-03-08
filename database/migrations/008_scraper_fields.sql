-- =============================================================================
-- Migration 008: Scraper fields
-- Adds minimal columns to store scraper-specific metadata without changing existing behavior.
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Repositories') AND name = 'SourceUrl')
BEGIN
    ALTER TABLE retomy.Repositories ADD SourceUrl NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.Repositories') AND name = 'ImportedFrom')
BEGIN
    ALTER TABLE retomy.Repositories ADD ImportedFrom NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'OriginalModelId')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD OriginalModelId NVARCHAR(400) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('retomy.ModelMetadata') AND name = 'ScraperFetchedAt')
BEGIN
    ALTER TABLE retomy.ModelMetadata ADD ScraperFetchedAt DATETIME2 NULL;
END
GO

PRINT '008 — Scraper fields migration complete';
GO
