from database import MenuItem, init_db

def seed():
    init_db()
    # Clear existing items to avoid duplicates
    MenuItem.delete().execute()
    
    # Drinks
    MenuItem.create(name="Hot Americano", price=10.0, ingredients="Espresso, Water", stock_count=100)
    MenuItem.create(name="Iced Latte", price=15.0, ingredients="Espresso, Milk, Ice", stock_count=50)
    MenuItem.create(name="Cappuccino", price=14.0, ingredients="Espresso, Steamed Milk, Foam", stock_count=80)
    # Pastries
    MenuItem.create(name="Butter Croissant", price=12.0, ingredients="Flour, Butter", stock_count=20)
    MenuItem.create(name="Chocolate Muffin", price=11.0, ingredients="Cocoa, Flour, Egg", stock_count=15)
    MenuItem.create(name="Almond Danish", price=13.0, ingredients="Almonds, Flour, Syrup", stock_count=10)
    # Sandwiches & Meals
    MenuItem.create(name="Tuna Sandwich", price=22.0, ingredients="Tuna, Mayo, Veggies", stock_count=30)
    MenuItem.create(name="Omelet Bagel", price=20.0, ingredients="Egg, Cheese, Bagel", stock_count=25)
    MenuItem.create(name="Healthy Salad", price=25.0, ingredients="Greens, Nuts, Vinaigrette", stock_count=40)
    
    print("Database deduplicated and seeded with a unique variety of items.")

if __name__ == "__main__":
    seed()
