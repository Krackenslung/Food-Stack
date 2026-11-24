/* 008: catalog extensions (slugs, translations, stock, availability, promo codes).
   Idempotent. Numbered 008 because 001-007 were applied outside this repo. */
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.Categories', 'Slug') IS NULL ALTER TABLE dbo.Categories ADD Slug NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Categories', 'Sort_Order') IS NULL ALTER TABLE dbo.Categories ADD Sort_Order INT NOT NULL CONSTRAINT DF_Categories_Sort DEFAULT 0;
GO
-- Slugs for the known categories; Drinks becomes Beverages; Tacos/Shakes are retired (soft-deleted).
UPDATE dbo.Categories SET Slug = 'burgers',   Sort_Order = 1 WHERE Slug IS NULL AND Name = 'Burgers';
UPDATE dbo.Categories SET Slug = 'burritos',  Sort_Order = 2 WHERE Slug IS NULL AND Name = 'Burritos';
UPDATE dbo.Categories SET Slug = 'sides',     Sort_Order = 3 WHERE Slug IS NULL AND Name = 'Sides';
UPDATE dbo.Categories SET Slug = 'beverages', Sort_Order = 4, Name = 'Beverages' WHERE Slug IS NULL AND Name IN ('Drinks', 'Beverages');
UPDATE dbo.Products SET Status = 0 WHERE Category_Id IN (SELECT Id FROM dbo.Categories WHERE Slug IS NULL AND Name IN ('Tacos', 'Shakes'));
UPDATE dbo.Categories SET Status = 0 WHERE Slug IS NULL AND Name IN ('Tacos', 'Shakes');
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Categories_Slug' AND object_id = OBJECT_ID('dbo.Categories'))
    CREATE UNIQUE INDEX UX_Categories_Slug ON dbo.Categories (Slug) WHERE Slug IS NOT NULL;
GO

IF OBJECT_ID('dbo.Category_Translations') IS NULL
CREATE TABLE dbo.Category_Translations (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    Category_Id INT NOT NULL REFERENCES dbo.Categories(Id),
    Lang        NVARCHAR(5)   NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    Status      INT NOT NULL DEFAULT 1,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_Category_Translations UNIQUE (Category_Id, Lang)
);

IF OBJECT_ID('dbo.Product_Translations') IS NULL
CREATE TABLE dbo.Product_Translations (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    Product_Id  INT NOT NULL REFERENCES dbo.Products(Id),
    Lang        NVARCHAR(5)   NOT NULL,
    Name        NVARCHAR(150) NOT NULL,
    Description NVARCHAR(500) NULL,
    Status      INT NOT NULL DEFAULT 1,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_Product_Translations UNIQUE (Product_Id, Lang)
);

IF OBJECT_ID('dbo.Ingredient_Translations') IS NULL
CREATE TABLE dbo.Ingredient_Translations (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    Ingredient_Id INT NOT NULL REFERENCES dbo.Ingredients(Id),
    Lang          NVARCHAR(5)   NOT NULL,
    Name          NVARCHAR(100) NOT NULL,
    Status        INT NOT NULL DEFAULT 1,
    Created_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_Ingredient_Translations UNIQUE (Ingredient_Id, Lang)
);
GO

IF COL_LENGTH('dbo.Products', 'Sku') IS NULL ALTER TABLE dbo.Products ADD Sku NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.Products', 'Cost') IS NULL ALTER TABLE dbo.Products ADD Cost DECIMAL(10,2) NOT NULL CONSTRAINT DF_Products_Cost DEFAULT 0;
IF COL_LENGTH('dbo.Products', 'Stock') IS NULL ALTER TABLE dbo.Products ADD Stock INT NULL;
IF COL_LENGTH('dbo.Products', 'Low_Stock_Threshold') IS NULL ALTER TABLE dbo.Products ADD Low_Stock_Threshold INT NOT NULL CONSTRAINT DF_Products_LowStock DEFAULT 10;
IF COL_LENGTH('dbo.Products', 'Prep_Time_Min') IS NULL ALTER TABLE dbo.Products ADD Prep_Time_Min INT NOT NULL CONSTRAINT DF_Products_PrepMin DEFAULT 10;
IF COL_LENGTH('dbo.Products', 'Prep_Time_Max') IS NULL ALTER TABLE dbo.Products ADD Prep_Time_Max INT NOT NULL CONSTRAINT DF_Products_PrepMax DEFAULT 15;
IF COL_LENGTH('dbo.Products', 'Calories') IS NULL ALTER TABLE dbo.Products ADD Calories INT NULL;
IF COL_LENGTH('dbo.Products', 'Is_Available') IS NULL ALTER TABLE dbo.Products ADD Is_Available BIT NOT NULL CONSTRAINT DF_Products_Avail DEFAULT 1;
IF COL_LENGTH('dbo.Products', 'Is_Featured') IS NULL ALTER TABLE dbo.Products ADD Is_Featured BIT NOT NULL CONSTRAINT DF_Products_Featured DEFAULT 0;
IF COL_LENGTH('dbo.Products', 'Allow_Customization') IS NULL ALTER TABLE dbo.Products ADD Allow_Customization BIT NOT NULL CONSTRAINT DF_Products_Custom DEFAULT 1;
IF COL_LENGTH('dbo.Products', 'Publish_Status') IS NULL ALTER TABLE dbo.Products ADD Publish_Status NVARCHAR(10) NOT NULL CONSTRAINT DF_Products_Publish DEFAULT 'active';
IF COL_LENGTH('dbo.Products', 'Updated_At') IS NULL ALTER TABLE dbo.Products ADD Updated_At DATETIME2 NOT NULL CONSTRAINT DF_Products_Updated DEFAULT SYSUTCDATETIME();
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Products_Publish')
    ALTER TABLE dbo.Products ADD CONSTRAINT CK_Products_Publish CHECK (Publish_Status IN ('active', 'draft'));
UPDATE dbo.Products SET Sku = CONCAT('SKU-', RIGHT(CONCAT('0000', Id), 4)) WHERE Sku IS NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Products_Sku' AND object_id = OBJECT_ID('dbo.Products'))
    CREATE UNIQUE INDEX UX_Products_Sku ON dbo.Products (Sku) WHERE Sku IS NOT NULL;
GO

IF COL_LENGTH('dbo.Product_Ingredients', 'Is_Removable') IS NULL ALTER TABLE dbo.Product_Ingredients ADD Is_Removable BIT NOT NULL CONSTRAINT DF_PI_Removable DEFAULT 1;
IF COL_LENGTH('dbo.Product_Ingredients', 'Sort_Order') IS NULL ALTER TABLE dbo.Product_Ingredients ADD Sort_Order INT NOT NULL CONSTRAINT DF_PI_Sort DEFAULT 0;
GO

IF OBJECT_ID('dbo.Promo_Codes') IS NULL
CREATE TABLE dbo.Promo_Codes (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    Code             NVARCHAR(40) NOT NULL UNIQUE,
    Percent_Off      DECIMAL(5,2)  NULL,
    Amount_Off       DECIMAL(10,2) NULL,
    Min_Subtotal     DECIMAL(10,2) NULL,
    First_Order_Only BIT NOT NULL DEFAULT 0,
    Max_Redemptions  INT NULL,
    Times_Redeemed   INT NOT NULL DEFAULT 0,
    Starts_At        DATETIME2 NULL,
    Expires_At       DATETIME2 NULL,
    Status           INT NOT NULL DEFAULT 1,
    Created_At       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Promo_Kind CHECK ((Percent_Off IS NOT NULL AND Amount_Off IS NULL) OR (Percent_Off IS NULL AND Amount_Off IS NOT NULL))
);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Promo_Codes WHERE Code = 'FOODSTACK20')
    INSERT INTO dbo.Promo_Codes (Code, Percent_Off, First_Order_Only) VALUES ('FOODSTACK20', 20, 1);
GO
