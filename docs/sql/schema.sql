/*
FoodStack - schema for local SQL Server.
Reconstructed from the column names used in the model files in backend/Models.
Idempotent: safe to run more than once.
*/
IF DB_ID('FoodStack') IS NULL CREATE DATABASE FoodStack;
GO
USE FoodStack;
GO

IF OBJECT_ID('dbo.Users') IS NULL
CREATE TABLE dbo.Users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100) NOT NULL,
    lastname      NVARCHAR(100) NOT NULL DEFAULT '',
    phone_number  NVARCHAR(30)  NULL,
    email         NVARCHAR(200) NOT NULL UNIQUE,
    password_hash NVARCHAR(200) NOT NULL,
    role          NVARCHAR(30)  NOT NULL DEFAULT 'customer',
    status        INT NOT NULL DEFAULT 1,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Categories') IS NULL
CREATE TABLE dbo.Categories (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    Name       NVARCHAR(100) NOT NULL,
    Status     INT NOT NULL DEFAULT 1,
    Created_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Products') IS NULL
CREATE TABLE dbo.Products (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    Category_Id INT NOT NULL REFERENCES dbo.Categories(Id),
    Name        NVARCHAR(150) NOT NULL,
    Description NVARCHAR(500) NULL,
    Image       NVARCHAR(300) NULL,
    Price       DECIMAL(10,2) NOT NULL,
    Status      INT NOT NULL DEFAULT 1,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Ingredients') IS NULL
CREATE TABLE dbo.Ingredients (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(100) NOT NULL,
    Extra_Price DECIMAL(10,2) NOT NULL DEFAULT 0,
    Status      INT NOT NULL DEFAULT 1,
    Created_At  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Product_Ingredients') IS NULL
CREATE TABLE dbo.Product_Ingredients (
    Id                  INT IDENTITY(1,1) PRIMARY KEY,
    Product_Id          INT NOT NULL REFERENCES dbo.Products(Id),
    Ingredient_Id       INT NOT NULL REFERENCES dbo.Ingredients(Id),
    Max_Ingredients     INT NOT NULL DEFAULT 1,
    Default_Ingredients INT NOT NULL DEFAULT 0,
    Status              INT NOT NULL DEFAULT 1,
    Created_At          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Orders') IS NULL
CREATE TABLE dbo.Orders (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    User_Id    INT NOT NULL REFERENCES dbo.Users(id),
    Total      DECIMAL(10,2) NOT NULL DEFAULT 0,
    Datetime   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Status     NVARCHAR(30) NOT NULL DEFAULT 'pending',
    Created_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Order_Products') IS NULL
CREATE TABLE dbo.Order_Products (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    Order_Id   INT NOT NULL REFERENCES dbo.Orders(Id),
    Product_Id INT NOT NULL REFERENCES dbo.Products(Id),
    Quantity   INT NOT NULL DEFAULT 1,
    Price      DECIMAL(10,2) NOT NULL,
    Status     INT NOT NULL DEFAULT 1,
    Created_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Order_Product_Ingredients') IS NULL
CREATE TABLE dbo.Order_Product_Ingredients (
    Id                    INT IDENTITY(1,1) PRIMARY KEY,
    Order_Product_Id      INT NOT NULL REFERENCES dbo.Order_Products(Id),
    Product_Ingredient_Id INT NOT NULL REFERENCES dbo.Product_Ingredients(Id),
    Quantity              INT NOT NULL DEFAULT 1,
    Status                INT NOT NULL DEFAULT 1,
    Created_At            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
