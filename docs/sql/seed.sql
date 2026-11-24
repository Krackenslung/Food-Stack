/* FoodStack catalog seed: 4 categories, 17 products with EN/ES text.
   Generated from frontend/src/mocks/catalog.ts (node frontend/gen-seed.cjs). Needs migrations 008+.
   Runs only when Products is empty; users are created by scripts/seed_users.py. */
SET NOCOUNT ON;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Products)
BEGIN
    BEGIN TRANSACTION;

    -- Retire the legacy categories (Tacos, Shakes) and keep exactly the four live ones.
    UPDATE dbo.Categories SET Status = 0 WHERE Slug IS NULL OR Slug NOT IN ('burgers','burritos','sides','beverages');

    IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = 'burgers')
        INSERT INTO dbo.Categories (Name, Slug, Sort_Order, Status) VALUES (N'Burgers', 'burgers', 1, 1);
    UPDATE dbo.Categories SET Name = N'Burgers', Sort_Order = 1, Status = 1 WHERE Slug = 'burgers';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'burgers' AND ct.Lang = 'en')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'en', N'Burgers' FROM dbo.Categories WHERE Slug = 'burgers';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'burgers' AND ct.Lang = 'es')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'es', N'Hamburguesas' FROM dbo.Categories WHERE Slug = 'burgers';

    IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = 'burritos')
        INSERT INTO dbo.Categories (Name, Slug, Sort_Order, Status) VALUES (N'Burritos', 'burritos', 2, 1);
    UPDATE dbo.Categories SET Name = N'Burritos', Sort_Order = 2, Status = 1 WHERE Slug = 'burritos';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'burritos' AND ct.Lang = 'en')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'en', N'Burritos' FROM dbo.Categories WHERE Slug = 'burritos';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'burritos' AND ct.Lang = 'es')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'es', N'Burritos' FROM dbo.Categories WHERE Slug = 'burritos';

    IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = 'sides')
        INSERT INTO dbo.Categories (Name, Slug, Sort_Order, Status) VALUES (N'Sides', 'sides', 3, 1);
    UPDATE dbo.Categories SET Name = N'Sides', Sort_Order = 3, Status = 1 WHERE Slug = 'sides';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'sides' AND ct.Lang = 'en')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'en', N'Sides' FROM dbo.Categories WHERE Slug = 'sides';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'sides' AND ct.Lang = 'es')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'es', N'Acompañamientos' FROM dbo.Categories WHERE Slug = 'sides';

    IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = 'beverages')
        INSERT INTO dbo.Categories (Name, Slug, Sort_Order, Status) VALUES (N'Beverages', 'beverages', 4, 1);
    UPDATE dbo.Categories SET Name = N'Beverages', Sort_Order = 4, Status = 1 WHERE Slug = 'beverages';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'beverages' AND ct.Lang = 'en')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'en', N'Beverages' FROM dbo.Categories WHERE Slug = 'beverages';
    IF NOT EXISTS (SELECT 1 FROM dbo.Category_Translations ct JOIN dbo.Categories c ON c.Id = ct.Category_Id WHERE c.Slug = 'beverages' AND ct.Lang = 'es')
        INSERT INTO dbo.Category_Translations (Category_Id, Lang, Name) SELECT Id, 'es', N'Bebidas' FROM dbo.Categories WHERE Slug = 'beverages';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Angus beef patty')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Angus beef patty', 2.50, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Angus beef patty' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Angus beef patty' FROM dbo.Ingredients WHERE Name = N'Angus beef patty';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Angus beef patty' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Carne Angus' FROM dbo.Ingredients WHERE Name = N'Angus beef patty';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Aged cheddar')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Aged cheddar', 1.00, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Aged cheddar' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Aged cheddar' FROM dbo.Ingredients WHERE Name = N'Aged cheddar';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Aged cheddar' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Queso cheddar añejo' FROM dbo.Ingredients WHERE Name = N'Aged cheddar';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Crispy bacon')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Crispy bacon', 1.50, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Crispy bacon' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Crispy bacon' FROM dbo.Ingredients WHERE Name = N'Crispy bacon';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Crispy bacon' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Tocino crujiente' FROM dbo.Ingredients WHERE Name = N'Crispy bacon';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Caramelized onions')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Caramelized onions', 0.00, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Caramelized onions' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Caramelized onions' FROM dbo.Ingredients WHERE Name = N'Caramelized onions';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Caramelized onions' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Cebolla caramelizada' FROM dbo.Ingredients WHERE Name = N'Caramelized onions';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Pickles')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Pickles', 0.00, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Pickles' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Pickles' FROM dbo.Ingredients WHERE Name = N'Pickles';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Pickles' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Pepinillos' FROM dbo.Ingredients WHERE Name = N'Pickles';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Jalapeños')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Jalapeños', 0.50, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Jalapeños' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Jalapeños' FROM dbo.Ingredients WHERE Name = N'Jalapeños';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Jalapeños' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Jalapeños' FROM dbo.Ingredients WHERE Name = N'Jalapeños';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Rice')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Rice', 0.00, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Rice' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Rice' FROM dbo.Ingredients WHERE Name = N'Rice';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Rice' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Arroz' FROM dbo.Ingredients WHERE Name = N'Rice';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Black beans')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Black beans', 0.00, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Black beans' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Black beans' FROM dbo.Ingredients WHERE Name = N'Black beans';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Black beans' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Frijoles negros' FROM dbo.Ingredients WHERE Name = N'Black beans';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Guacamole')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Guacamole', 1.50, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Guacamole' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Guacamole' FROM dbo.Ingredients WHERE Name = N'Guacamole';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Guacamole' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Guacamole' FROM dbo.Ingredients WHERE Name = N'Guacamole';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Salsa')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Salsa', 0.00, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Salsa' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Salsa' FROM dbo.Ingredients WHERE Name = N'Salsa';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Salsa' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Salsa' FROM dbo.Ingredients WHERE Name = N'Salsa';

    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE Name = N'Sour cream')
        INSERT INTO dbo.Ingredients (Name, Extra_Price, Status) VALUES (N'Sour cream', 0.75, 1);
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Sour cream' AND it.Lang = 'en')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'en', N'Sour cream' FROM dbo.Ingredients WHERE Name = N'Sour cream';
    IF NOT EXISTS (SELECT 1 FROM dbo.Ingredient_Translations it JOIN dbo.Ingredients i ON i.Id = it.Ingredient_Id WHERE i.Name = N'Sour cream' AND it.Lang = 'es')
        INSERT INTO dbo.Ingredient_Translations (Ingredient_Id, Lang, Name) SELECT Id, 'es', N'Crema' FROM dbo.Ingredients WHERE Name = N'Sour cream';

    DECLARE @pid INT;

    -- Overkill Double Burger
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Overkill Double Burger', N'Two smashed patties, double cheddar, house sauce.', N'/menu/overkill-double.jpg', 12.99, 1, 'SKU-B001', 4.16,
        48, 10, 15, 20, 980,
        1, 1, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burgers';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Overkill Double Burger', N'Two smashed patties, double cheddar, house sauce.'),
        (@pid, 'es', N'Hamburguesa Overkill Doble', N'Dos carnes aplastadas, doble cheddar y salsa de la casa.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 0, 1, 1 FROM dbo.Ingredients WHERE Name = N'Angus beef patty';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Aged cheddar';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Crispy bacon';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Caramelized onions';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Pickles';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 3, 1, 6, 1 FROM dbo.Ingredients WHERE Name = N'Jalapeños';

    -- BBQ Bacon Burger
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'BBQ Bacon Burger', N'Smoky BBQ sauce, crispy bacon and aged cheddar.', N'/menu/bbq-bacon.jpg', 11.49, 1, 'SKU-B002', 3.68,
        36, 10, 15, 20, 820,
        1, 0, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burgers';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'BBQ Bacon Burger', N'Smoky BBQ sauce, crispy bacon and aged cheddar.'),
        (@pid, 'es', N'Hamburguesa BBQ con Tocino', N'Salsa BBQ ahumada, tocino crujiente y cheddar añejo.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 0, 1, 1 FROM dbo.Ingredients WHERE Name = N'Angus beef patty';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Aged cheddar';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Crispy bacon';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Caramelized onions';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Pickles';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 3, 1, 6, 1 FROM dbo.Ingredients WHERE Name = N'Jalapeños';

    -- Stack Burger
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Stack Burger', N'Our signature stack with lettuce, tomato and pickles.', N'/menu/stack-burger.jpg', 10.49, 1, 'SKU-B003', 3.36,
        40, 10, 12, 18, 760,
        1, 0, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burgers';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Stack Burger', N'Our signature stack with lettuce, tomato and pickles.'),
        (@pid, 'es', N'Hamburguesa Stack', N'Nuestra clásica con lechuga, jitomate y pepinillos.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 0, 1, 1 FROM dbo.Ingredients WHERE Name = N'Angus beef patty';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Aged cheddar';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Crispy bacon';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Caramelized onions';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Pickles';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 3, 1, 6, 1 FROM dbo.Ingredients WHERE Name = N'Jalapeños';

    -- Spicy Burger
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Spicy Burger', N'Pepper jack, jalapeños and a chipotle kick.', N'/menu/spicy-burger.jpg', 10.99, 1, 'SKU-B004', 3.52,
        40, 10, 12, 18, 790,
        1, 0, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burgers';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Spicy Burger', N'Pepper jack, jalapeños and a chipotle kick.'),
        (@pid, 'es', N'Hamburguesa Picante', N'Queso pepper jack, jalapeños y un toque de chipotle.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 0, 1, 1 FROM dbo.Ingredients WHERE Name = N'Angus beef patty';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Aged cheddar';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Crispy bacon';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Caramelized onions';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Pickles';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 3, 1, 6, 1 FROM dbo.Ingredients WHERE Name = N'Jalapeños';

    -- Burrito Stack
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Burrito Stack', N'Loaded with rice, beans, salsa and grilled steak.', N'/menu/burrito-stack.jpg', 7.99, 1, 'SKU-R001', 2.56,
        22, 10, 10, 15, 720,
        1, 1, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burritos';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Burrito Stack', N'Loaded with rice, beans, salsa and grilled steak.'),
        (@pid, 'es', N'Burrito Stack', N'Con arroz, frijoles, salsa y arrachera a la parrilla.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 1, 1 FROM dbo.Ingredients WHERE Name = N'Rice';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Black beans';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Guacamole';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Salsa';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Sour cream';

    -- Chicken Burrito
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Chicken Burrito', N'Grilled chicken, beans and creamy chipotle sauce.', N'/menu/chicken-burrito.jpg', 8.49, 1, 'SKU-R002', 2.72,
        8, 10, 10, 15, 690,
        1, 1, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burritos';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Chicken Burrito', N'Grilled chicken, beans and creamy chipotle sauce.'),
        (@pid, 'es', N'Burrito de Pollo', N'Pollo a la parrilla, frijoles y cremosa salsa chipotle.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 1, 1 FROM dbo.Ingredients WHERE Name = N'Rice';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Black beans';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Guacamole';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Salsa';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Sour cream';

    -- Spicy Beef Burrito
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Spicy Beef Burrito', N'Seasoned beef, pepper jack and fiery salsa roja.', N'/menu/spicy-beef-burrito.jpg', 8.99, 1, 'SKU-R003', 2.88,
        40, 10, 10, 15, 740,
        1, 0, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burritos';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Spicy Beef Burrito', N'Seasoned beef, pepper jack and fiery salsa roja.'),
        (@pid, 'es', N'Burrito de Res Picante', N'Res sazonada, queso pepper jack y salsa roja picosa.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 1, 1 FROM dbo.Ingredients WHERE Name = N'Rice';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Black beans';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Guacamole';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Salsa';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Sour cream';

    -- Veggie Burrito
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Veggie Burrito', N'Grilled peppers, beans, rice and fresh guacamole.', N'/menu/veggie-burrito.jpg', 7.49, 1, 'SKU-R004', 2.40,
        40, 10, 10, 15, 610,
        1, 0, 1, 'active'
    FROM dbo.Categories WHERE Slug = 'burritos';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Veggie Burrito', N'Grilled peppers, beans, rice and fresh guacamole.'),
        (@pid, 'es', N'Burrito Vegetariano', N'Pimientos asados, frijoles, arroz y guacamole fresco.');
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 1, 1 FROM dbo.Ingredients WHERE Name = N'Rice';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 2, 1, 2, 1 FROM dbo.Ingredients WHERE Name = N'Black beans';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 3, 1 FROM dbo.Ingredients WHERE Name = N'Guacamole';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 1, 3, 1, 4, 1 FROM dbo.Ingredients WHERE Name = N'Salsa';
    INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order, Status)
        SELECT @pid, Id, 0, 2, 1, 5, 1 FROM dbo.Ingredients WHERE Name = N'Sour cream';

    -- Cheese Bites
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Cheese Bites', N'Golden, crunchy bites with melty cheese inside.', N'/menu/cheese-bites.jpg', 4.79, 1, 'SKU-S001', 1.53,
        0, 10, 6, 8, 450,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'sides';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Cheese Bites', N'Golden, crunchy bites with melty cheese inside.'),
        (@pid, 'es', N'Bocados de Queso', N'Bocados dorados y crujientes con queso derretido.');

    -- Fries
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Fries', N'Crispy fries with sea salt.', N'/menu/fries.jpg', 3.49, 1, 'SKU-S002', 1.12,
        40, 10, 5, 7, 380,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'sides';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Fries', N'Crispy fries with sea salt.'),
        (@pid, 'es', N'Papas a la Francesa', N'Papas crujientes con sal de mar.');

    -- Onion Rings
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Onion Rings', N'Thick-cut rings in a golden beer batter.', N'/menu/onion-rings.jpg', 4.29, 1, 'SKU-S003', 1.37,
        40, 10, 6, 8, 410,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'sides';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Onion Rings', N'Thick-cut rings in a golden beer batter.'),
        (@pid, 'es', N'Aros de Cebolla', N'Aros gruesos en un dorado rebozado de cerveza.');

    -- Nachos
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Nachos', N'Tortilla chips with queso, jalapeños and pico de gallo.', N'/menu/nachos.jpg', 5.49, 1, 'SKU-S004', 1.76,
        40, 10, 6, 9, 520,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'sides';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Nachos', N'Tortilla chips with queso, jalapeños and pico de gallo.'),
        (@pid, 'es', N'Nachos', N'Totopos con queso, jalapeños y pico de gallo.');

    -- Iced Horchata
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Iced Horchata', N'Sweet cinnamon rice milk served over ice.', N'/menu/iced-horchata.jpg', 3.49, 1, 'SKU-D001', 1.12,
        90, 10, 1, 2, 260,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'beverages';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Iced Horchata', N'Sweet cinnamon rice milk served over ice.'),
        (@pid, 'es', N'Horchata Helada', N'Dulce leche de arroz con canela servida con hielo.');

    -- Classic Milkshake
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Classic Milkshake', N'Vanilla bean shake topped with whipped cream.', N'/menu/classic-milkshake.jpg', 4.99, 1, 'SKU-D002', 1.60,
        30, 10, 4, 5, 540,
        1, 1, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'beverages';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Classic Milkshake', N'Vanilla bean shake topped with whipped cream.'),
        (@pid, 'es', N'Malteada Clásica', N'Malteada de vainilla con crema batida.');

    -- Lemonade
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Lemonade', N'Fresh-squeezed lemonade over ice.', N'/menu/lemonade.jpg', 2.99, 1, 'SKU-D003', 0.96,
        40, 10, 1, 2, 120,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'beverages';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Lemonade', N'Fresh-squeezed lemonade over ice.'),
        (@pid, 'es', N'Limonada', N'Limonada recién exprimida con hielo.');

    -- Iced Tea
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Iced Tea', N'Black tea, brewed daily and lightly sweetened.', N'/menu/iced-tea.jpg', 2.79, 1, 'SKU-D004', 0.89,
        40, 10, 1, 2, 90,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'beverages';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Iced Tea', N'Black tea, brewed daily and lightly sweetened.'),
        (@pid, 'es', N'Té Helado', N'Té negro preparado a diario, ligeramente dulce.');

    -- Soda
    INSERT INTO dbo.Products (Category_Id, Name, Description, Image, Price, Status, Sku, Cost, Stock, Low_Stock_Threshold,
        Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, Is_Featured, Allow_Customization, Publish_Status)
    SELECT Id, N'Soda', N'Ice-cold fountain soda.', N'/menu/soda.jpg', 2.49, 1, 'SKU-D005', 0.80,
        40, 10, 1, 1, 150,
        1, 0, 0, 'active'
    FROM dbo.Categories WHERE Slug = 'beverages';
    SET @pid = SCOPE_IDENTITY();
    INSERT INTO dbo.Product_Translations (Product_Id, Lang, Name, Description) VALUES
        (@pid, 'en', N'Soda', N'Ice-cold fountain soda.'),
        (@pid, 'es', N'Refresco', N'Refresco de fuente bien frío.');

    COMMIT TRANSACTION;
END
GO
