from peewee import *
import os

# Database path
DB_PATH = 'cafeteria.db'
db = SqliteDatabase(DB_PATH)

class BaseModel(Model):
    class Meta:
        database = db

class User(BaseModel):
    username = CharField(unique=True)
    password = CharField()
    is_admin = BooleanField(default=False)

class MenuItem(BaseModel):
    name = CharField()
    price = FloatField()
    ingredients = TextField()
    stock_count = IntegerField(default=0)
    image_url = CharField(null=True)
    is_available = BooleanField(default=True)

class Order(BaseModel):
    customer = ForeignKeyField(User, backref='orders')
    cafe_name = CharField(null=True) # Tracks which cafe the order was placed at
    status = CharField(default='pending') # pending, ready, picked_up
    created_at = DateTimeField(constraints=[SQL('DEFAULT CURRENT_TIMESTAMP')])

class OrderItem(BaseModel):
    order = ForeignKeyField(Order, backref='items')
    menu_item = ForeignKeyField(MenuItem)
    quantity = IntegerField(default=1)

def init_db():
    db.connect()
    db.create_tables([User, MenuItem, Order, OrderItem])
    
    # Create a default admin if none exists
    if not User.select().where(User.username == 'admin').exists():
        User.create(username='admin', password='password123', is_admin=True)
    
    # Create a default customer if none exists
    if not User.select().where(User.username == 'student').exists():
        User.create(username='student', password='password123', is_admin=False)

if __name__ == '__main__':
    init_db()
