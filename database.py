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
    assigned_cafe = CharField(null=True) # For admins, which cafe they manage

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

    # Default students
    students = [
        ('student1', 'password123'),
        ('student2', 'password123'),
        ('student', 'password123'),
    ]
    for uname, pwd in students:
        if not User.select().where(User.username == uname).exists():
            User.create(username=uname, password=pwd, is_admin=False)

    # Cafe-specific admins (Matching CAFE_DATA names exactly)
    cafe_admins = [
        ('admin_forum', 'password123', 'Forum Café'),
        ('admin_social', 'password123', 'Social Sciences Vitamin'),
        ('admin_humanities', 'password123', 'Humanities Vitamin'),
        ('admin_rothberg', 'password123', 'Rothberg Forum Café'),
        ('admin', 'password123', None), # Super admin sees all
    ]
    for uname, pwd, cafe in cafe_admins:
        if not User.select().where(User.username == uname).exists():
            User.create(username=uname, password=pwd, is_admin=True, assigned_cafe=cafe)

if __name__ == '__main__':
    init_db()
