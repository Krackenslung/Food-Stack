/* FoodStack catalog seed data (users are created by scripts/seed_users.py). */
USE FoodStack;
GO
IF NOT EXISTS (SELECT 1 FROM Categories)
BEGIN
    INSERT INTO Categories (Name) VALUES ('Burgers'), ('Burritos'), ('Tacos'), ('Sides'), ('Drinks');

    INSERT INTO Products (Category_Id, Name, Description, Image, Price) VALUES
    (1, 'Stack Burger',      'Signature beef burger',        'assets/images/burgers/stack-burger.jpg',      129.00),
    (1, 'Double Burger',     'Two patties, double cheese',   'assets/images/burgers/double-burger.jpg',     159.00),
    (1, 'Spicy Burger',      'Jalapeno and hot sauce',       'assets/images/burgers/spicy-burger.jpg',      139.00),
    (1, 'BBQ Bacon Burger',  'Bacon and smoky BBQ',          'assets/images/burgers/bbq-bacon-burger.jpg',  149.00),
    (2, 'Burrito Stack',     'Rice, beans and beef',         'assets/images/burritos/burrito-stack.jpg',    119.00),
    (2, 'Chicken Burrito',   'Grilled chicken burrito',      'assets/images/burritos/chicken-burrito.jpg',  115.00),
    (3, 'Taco Supreme',      'Loaded taco',                  'assets/images/tacos/taco-supreme.png',         59.00),
    (3, 'Classic Taco',      'Traditional taco',             'assets/images/tacos/taco-classic.png',         45.00),
    (4, 'Fries',             'Crispy fries',                 'assets/images/sides/fries.png',                45.00),
    (4, 'Nachos',            'Nachos with cheese',           'assets/images/sides/nachos.png',               65.00),
    (5, 'Soda',              'Cold soda',                    'assets/images/drinks/soda.png',                30.00),
    (5, 'Milkshake',         'Creamy milkshake',             'assets/images/drinks/milkshake.png',           55.00);

    INSERT INTO Ingredients (Name, Extra_Price) VALUES
    ('Cheese', 10), ('Bacon', 20), ('Lettuce', 0), ('Tomato', 0), ('Jalapeno', 5), ('Onion', 0);

    INSERT INTO Product_Ingredients (Product_Id, Ingredient_Id, Max_Ingredients, Default_Ingredients)
    SELECT p.Id, i.Id, 2, CASE WHEN i.Name IN ('Lettuce','Tomato') THEN 1 ELSE 0 END
    FROM Products p CROSS JOIN Ingredients i
    WHERE p.Category_Id IN (1, 2, 3);
END
GO
