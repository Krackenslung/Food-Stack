/* 009: order columns, status history, payments and Stripe webhook idempotency. Idempotent. */
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.Orders', 'Payment_Status') IS NULL ALTER TABLE dbo.Orders ADD Payment_Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PayStatus DEFAULT 'unpaid';
IF COL_LENGTH('dbo.Orders', 'Payment_Method') IS NULL ALTER TABLE dbo.Orders ADD Payment_Method NVARCHAR(10) NOT NULL CONSTRAINT DF_Orders_PayMethod DEFAULT 'counter';
IF COL_LENGTH('dbo.Orders', 'Fulfillment_Type') IS NULL ALTER TABLE dbo.Orders ADD Fulfillment_Type NVARCHAR(10) NOT NULL CONSTRAINT DF_Orders_Fulfil DEFAULT 'pickup';
IF COL_LENGTH('dbo.Orders', 'Contact_Name') IS NULL ALTER TABLE dbo.Orders ADD Contact_Name NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.Orders', 'Contact_Phone') IS NULL ALTER TABLE dbo.Orders ADD Contact_Phone NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.Orders', 'Contact_Email') IS NULL ALTER TABLE dbo.Orders ADD Contact_Email NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Orders', 'Delivery_Address') IS NULL ALTER TABLE dbo.Orders ADD Delivery_Address NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.Orders', 'Scheduled_For') IS NULL ALTER TABLE dbo.Orders ADD Scheduled_For DATETIME2 NULL;
IF COL_LENGTH('dbo.Orders', 'Notes') IS NULL ALTER TABLE dbo.Orders ADD Notes NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Orders', 'Currency') IS NULL ALTER TABLE dbo.Orders ADD Currency NVARCHAR(3) NOT NULL CONSTRAINT DF_Orders_Currency DEFAULT 'usd';
IF COL_LENGTH('dbo.Orders', 'Subtotal') IS NULL ALTER TABLE dbo.Orders ADD Subtotal DECIMAL(10,2) NOT NULL CONSTRAINT DF_Orders_Subtotal DEFAULT 0;
IF COL_LENGTH('dbo.Orders', 'Discount') IS NULL ALTER TABLE dbo.Orders ADD Discount DECIMAL(10,2) NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT 0;
IF COL_LENGTH('dbo.Orders', 'Service_Fee') IS NULL ALTER TABLE dbo.Orders ADD Service_Fee DECIMAL(10,2) NOT NULL CONSTRAINT DF_Orders_ServiceFee DEFAULT 0;
IF COL_LENGTH('dbo.Orders', 'Delivery_Fee') IS NULL ALTER TABLE dbo.Orders ADD Delivery_Fee DECIMAL(10,2) NOT NULL CONSTRAINT DF_Orders_DeliveryFee DEFAULT 0;
IF COL_LENGTH('dbo.Orders', 'Tax') IS NULL ALTER TABLE dbo.Orders ADD Tax DECIMAL(10,2) NOT NULL CONSTRAINT DF_Orders_Tax DEFAULT 0;
IF COL_LENGTH('dbo.Orders', 'Promo_Code_Id') IS NULL ALTER TABLE dbo.Orders ADD Promo_Code_Id INT NULL REFERENCES dbo.Promo_Codes(Id);
IF COL_LENGTH('dbo.Orders', 'Stripe_Payment_Intent_Id') IS NULL ALTER TABLE dbo.Orders ADD Stripe_Payment_Intent_Id NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Orders', 'Cancel_Reason') IS NULL ALTER TABLE dbo.Orders ADD Cancel_Reason NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.Orders', 'Stock_Consumed') IS NULL ALTER TABLE dbo.Orders ADD Stock_Consumed BIT NOT NULL CONSTRAINT DF_Orders_StockConsumed DEFAULT 0;
IF COL_LENGTH('dbo.Orders', 'Updated_At') IS NULL ALTER TABLE dbo.Orders ADD Updated_At DATETIME2 NOT NULL CONSTRAINT DF_Orders_Updated DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Orders', 'Order_Number') IS NULL ALTER TABLE dbo.Orders ADD Order_Number AS (CONCAT('FS-', RIGHT(CONCAT('0000', CAST(Id AS VARCHAR(10))), 4)));
GO
-- 'pending' is the legacy status: those orders are now 'received'.
UPDATE dbo.Orders SET Status = 'received' WHERE Status = 'pending';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Orders_Status')
    ALTER TABLE dbo.Orders ADD CONSTRAINT CK_Orders_Status
        CHECK (Status IN ('pending', 'pending_payment', 'received', 'preparing', 'ready', 'completed', 'cancelled'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Orders_PaymentStatus')
    ALTER TABLE dbo.Orders ADD CONSTRAINT CK_Orders_PaymentStatus
        CHECK (Payment_Status IN ('unpaid', 'paid', 'failed', 'refunded', 'pay_at_counter'));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Orders_Intent' AND object_id = OBJECT_ID('dbo.Orders'))
    CREATE UNIQUE INDEX UX_Orders_Intent ON dbo.Orders (Stripe_Payment_Intent_Id) WHERE Stripe_Payment_Intent_Id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_Status' AND object_id = OBJECT_ID('dbo.Orders'))
    CREATE INDEX IX_Orders_Status ON dbo.Orders (Status, Created_At);
GO

IF COL_LENGTH('dbo.Order_Products', 'Notes') IS NULL ALTER TABLE dbo.Order_Products ADD Notes NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Order_Product_Ingredients', 'Unit_Extra_Price') IS NULL ALTER TABLE dbo.Order_Product_Ingredients ADD Unit_Extra_Price DECIMAL(10,2) NOT NULL CONSTRAINT DF_OPI_Extra DEFAULT 0;
GO

IF OBJECT_ID('dbo.Order_Status_History') IS NULL
CREATE TABLE dbo.Order_Status_History (
    Id                 INT IDENTITY(1,1) PRIMARY KEY,
    Order_Id           INT NOT NULL REFERENCES dbo.Orders(Id),
    From_Status        NVARCHAR(30) NULL,
    To_Status          NVARCHAR(30) NOT NULL,
    Changed_By_User_Id INT NULL REFERENCES dbo.Users(id),
    Note               NVARCHAR(300) NULL,
    Status             INT NOT NULL DEFAULT 1,
    Created_At         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Payments') IS NULL
CREATE TABLE dbo.Payments (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    Order_Id      INT NOT NULL REFERENCES dbo.Orders(Id),
    Kind          NVARCHAR(10) NOT NULL CHECK (Kind IN ('charge', 'refund')),
    Provider      NVARCHAR(10) NOT NULL CHECK (Provider IN ('stripe', 'counter')),
    Provider_Ref  NVARCHAR(100) NULL,
    Amount        DECIMAL(10,2) NOT NULL,
    Currency      NVARCHAR(3) NOT NULL DEFAULT 'usd',
    Payment_State NVARCHAR(10) NOT NULL DEFAULT 'succeeded' CHECK (Payment_State IN ('pending', 'succeeded', 'failed')),
    Card_Brand    NVARCHAR(20) NULL,
    Card_Last4    NVARCHAR(4) NULL,
    Status        INT NOT NULL DEFAULT 1,
    Created_At    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Stripe_Events') IS NULL
CREATE TABLE dbo.Stripe_Events (
    Event_Id   NVARCHAR(100) NOT NULL PRIMARY KEY,
    Type       NVARCHAR(100) NOT NULL,
    Order_Id   INT NULL,
    Created_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Payments_Ref' AND object_id = OBJECT_ID('dbo.Payments'))
    CREATE UNIQUE INDEX UX_Payments_Ref ON dbo.Payments (Provider_Ref, Kind) WHERE Provider_Ref IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_History_Order' AND object_id = OBJECT_ID('dbo.Order_Status_History'))
    CREATE INDEX IX_History_Order ON dbo.Order_Status_History (Order_Id, Created_At);
GO
