/* 010: Google sign-in and user preferences. Idempotent. */
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.Users', 'google_sub') IS NULL ALTER TABLE dbo.Users ADD google_sub NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'auth_provider') IS NULL ALTER TABLE dbo.Users ADD auth_provider NVARCHAR(10) NOT NULL CONSTRAINT DF_Users_Provider DEFAULT 'password';
IF COL_LENGTH('dbo.Users', 'preferred_language') IS NULL ALTER TABLE dbo.Users ADD preferred_language NVARCHAR(5) NOT NULL CONSTRAINT DF_Users_Lang DEFAULT 'en';
IF COL_LENGTH('dbo.Users', 'preferred_theme') IS NULL ALTER TABLE dbo.Users ADD preferred_theme NVARCHAR(10) NOT NULL CONSTRAINT DF_Users_Theme DEFAULT 'system';
IF COL_LENGTH('dbo.Users', 'avatar_url') IS NULL ALTER TABLE dbo.Users ADD avatar_url NVARCHAR(400) NULL;
IF COL_LENGTH('dbo.Users', 'last_login_at') IS NULL ALTER TABLE dbo.Users ADD last_login_at DATETIME2 NULL;
GO
-- Google-only accounts have no password.
ALTER TABLE dbo.Users ALTER COLUMN password_hash NVARCHAR(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Credential')
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Credential CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Theme')
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Theme CHECK (preferred_theme IN ('light', 'dark', 'system'));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_GoogleSub' AND object_id = OBJECT_ID('dbo.Users'))
    CREATE UNIQUE INDEX UX_Users_GoogleSub ON dbo.Users (google_sub) WHERE google_sub IS NOT NULL;
GO
