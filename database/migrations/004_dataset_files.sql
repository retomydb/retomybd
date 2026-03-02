-- =============================================================================
-- retomY — Migration 004: DatasetFiles (Multi-file, any-format support)
-- =============================================================================

-- DatasetFiles: allows each dataset to have multiple files of any type
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_SCHEMA = 'retomy' AND TABLE_NAME = 'DatasetFiles')
BEGIN
    CREATE TABLE retomy.DatasetFiles (
        FileId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
        DatasetId       UNIQUEIDENTIFIER    NOT NULL,
        FileName        NVARCHAR(500)       NOT NULL,   -- original upload name
        BlobPath        NVARCHAR(1000)      NOT NULL,   -- container/blob path in Azure
        FileSize        BIGINT              NOT NULL DEFAULT 0,
        MimeType        NVARCHAR(255)       NULL,       -- e.g. application/pdf, image/png
        FileCategory    NVARCHAR(50)        NOT NULL DEFAULT 'primary',
            -- primary  = main dataset file(s)
            -- sample   = free preview / sample slice
            -- documentation = README, data dictionary, etc.
            -- preview  = screenshot, chart, image preview
        Checksum        NVARCHAR(128)       NULL,       -- SHA-256 hex
        SortOrder       INT                 NOT NULL DEFAULT 0,
        UploadedAt      DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_DatasetFiles PRIMARY KEY CLUSTERED (FileId),
        CONSTRAINT FK_DatasetFiles_Dataset FOREIGN KEY (DatasetId) REFERENCES retomy.Datasets(DatasetId),
        CONSTRAINT CK_DatasetFiles_Category CHECK (FileCategory IN ('primary','sample','documentation','preview'))
    );

    CREATE NONCLUSTERED INDEX IX_DatasetFiles_DatasetId
        ON retomy.DatasetFiles(DatasetId, FileCategory, SortOrder);
END
GO

PRINT 'Migration 004 completed — DatasetFiles table created.';
GO
