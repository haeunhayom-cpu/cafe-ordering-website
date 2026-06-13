from fastapi import FastAPI, Request, Form, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import db, User, MenuItem, Order, OrderItem, init_db
from peewee import fn
import os
import shutil
import uuid

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc)},
    )

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Function to seed the database
def seed_data():
    if MenuItem.select().count() == 0:
        print("Seeding database...")
        cafes = ['Forum Café', 'Social Sciences Vitamin', 'Humanities Vitamin', 'Rothberg Forum Café']
        default_items = [
            {"name": "Hot Americano", "price": 10.0, "ingredients": "Espresso, Water", "stock_count": 100},     
            {"name": "Iced Latte", "price": 15.0, "ingredients": "Espresso, Milk, Ice", "stock_count": 50},     
            {"name": "Cappuccino", "price": 14.0, "ingredients": "Espresso, Milk", "stock_count": 80},
            {"name": "Butter Croissant", "price": 12.0, "ingredients": "Flour, Butter", "stock_count": 20},     
            {"name": "Chocolate Muffin", "price": 11.0, "ingredients": "Cocoa, Flour, Egg", "stock_count": 15}, 
            {"name": "Almond Danish", "price": 13.0, "ingredients": "Almonds, Flour, Syrup", "stock_count": 10},
            {"name": "Tuna Sandwich", "price": 22.0, "ingredients": "Tuna, Veggies", "stock_count": 30},        
            {"name": "Omelet Bagel", "price": 20.0, "ingredients": "Egg, Cheese", "stock_count": 25},
            {"name": "Healthy Salad", "price": 25.0, "ingredients": "Greens, Nuts", "stock_count": 40}
        ]
        # Distribute items across all cafes
        for cafe in cafes:
            for item in default_items:
                item_copy = item.copy()
                item_copy['cafe_name'] = cafe
                MenuItem.create(**item_copy)
        print("Seeding complete.")

@app.on_event("startup")
def startup():
    init_db()
    seed_data()

# --- Auth Helper ---
# ... (rest of auth remains)

def get_current_user(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return None
    return User.get_or_none(User.username == username)

# --- Auth API ---

@app.post("/api/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = User.get_or_none(User.username == username, User.password == password)
    if not user:
        return JSONResponse(content={"error": "Invalid credentials"}, status_code=401)

    response = JSONResponse(content={
        "status": "success",
        "user": {
            "username": user.username,
            "is_admin": user.is_admin,
            "assigned_cafe": user.assigned_cafe
        }
    })
    response.set_cookie(key="session_user", value=username, httponly=True)
    return response

@app.post("/api/register")
async def register(username: str = Form(...), password: str = Form(...)):
    if not username or not password:
        return JSONResponse(content={"error": "Username and password required"}, status_code=400)
    if User.select().where(User.username == username).exists():
        return JSONResponse(content={"error": "Username already exists"}, status_code=400)

    User.create(username=username, password=password, is_admin=False)

    response = JSONResponse(content={"status": "success"})
    response.set_cookie(key="session_user", value=username, httponly=True)
    return response

@app.get("/api/me")
async def get_me(request: Request):
    user = get_current_user(request)
    if not user:
        return JSONResponse(content={"error": "Not logged in"}, status_code=401)
    
    # Auto-populate menu for cafe if empty (ensures every cafe has a base menu)
    if user.is_admin and user.assigned_cafe:
        if MenuItem.select().where(MenuItem.cafe_name == user.assigned_cafe).count() == 0:
            default_items = [
                {"name": "Hot Americano", "price": 10.0, "ingredients": "Espresso, Water", "stock_count": 100},     
                {"name": "Iced Latte", "price": 15.0, "ingredients": "Espresso, Milk, Ice", "stock_count": 50},     
                {"name": "Cappuccino", "price": 14.0, "ingredients": "Espresso, Milk", "stock_count": 80},
                {"name": "Butter Croissant", "price": 12.0, "ingredients": "Flour, Butter", "stock_count": 20},     
                {"name": "Chocolate Muffin", "price": 11.0, "ingredients": "Cocoa, Flour, Egg", "stock_count": 15}, 
                {"name": "Almond Danish", "price": 13.0, "ingredients": "Almonds, Flour, Syrup", "stock_count": 10},
                {"name": "Tuna Sandwich", "price": 22.0, "ingredients": "Tuna, Veggies", "stock_count": 30},        
                {"name": "Omelet Bagel", "price": 20.0, "ingredients": "Egg, Cheese", "stock_count": 25},
                {"name": "Healthy Salad", "price": 25.0, "ingredients": "Greens, Nuts", "stock_count": 40}
            ]
            for item in default_items:
                item_copy = item.copy()
                item_copy['cafe_name'] = user.assigned_cafe
                MenuItem.create(**item_copy)

    return {
        "username": user.username,
        "is_admin": user.is_admin,
        "assigned_cafe": user.assigned_cafe
    }

@app.post("/api/logout")
async def logout():
    response = JSONResponse(content={"status": "success"})
    response.delete_cookie("session_user")
    return response

# --- Data API ---

@app.get("/api/menu")
async def get_menu():
    # Return all items so frontend can show "Out of Stock" rather than hiding them
    items = MenuItem.select()
    result = list(items.dicts())
    return result

@app.post("/api/order")
async def place_order(request: Request, order_data: dict):
    user = get_current_user(request)
    if not user:
        user = User.get_or_none(User.username == 'student')

    item_ids = order_data.get("item_ids", [])
    cafe_name = order_data.get("cafe_name")

    with db.atomic():
        # Resetting Cafe-Specific Queue Logic
        active_count = Order.select().where(Order.cafe_name == cafe_name, Order.status == 'pending').count()
        next_q = active_count + 1

        new_order = Order.create(customer=user, cafe_name=cafe_name, queue_number=next_q)
        for item_id in item_ids:
            item = MenuItem.get_by_id(item_id)
            if not item.is_available or item.stock_count <= 0:
                raise HTTPException(status_code=400, detail=f"Item {item.name} is currently unavailable")
            item.stock_count -= 1
            item.save()
            OrderItem.create(order=new_order, menu_item=item)

    return {"order_id": new_order.id, "queue_number": new_order.queue_number, "status": new_order.status}

@app.get("/api/order/{order_id}")
async def get_order_status(order_id: int):
    order = Order.get_or_none(Order.id == order_id)
    if not order:
        raise HTTPException(status_code=404)
    return {"id": order.id, "queue_number": order.queue_number, "status": order.status}

# --- User Profile & History API ---

@app.get("/api/user/orders")
async def get_user_orders(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401)
    
    orders = Order.select().where(Order.customer == user).order_by(Order.created_at.desc())
    result = []
    for o in orders:
        items = [{"id": i.menu_item.id, "name": i.menu_item.name, "price": i.menu_item.price} for i in o.items]
        result.append({
            "id": o.id,
            "cafe_name": o.cafe_name,
            "status": o.status,
            "items": items,
            "created_at": o.created_at.isoformat(),
            "queue_number": o.queue_number
        })
    return result

@app.get("/api/user/favorites")
async def get_user_favorites(request: Request):
    user = get_current_user(request)
    if not user:
        return []
    from database import UserFavorite
    favorites = UserFavorite.select().where(UserFavorite.user == user)
    return [f.menu_item.id for f in favorites]

@app.post("/api/user/favorites/toggle")
async def toggle_favorite(request: Request, item_data: dict):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401)
    
    from database import UserFavorite, MenuItem
    item_id = item_data.get("item_id")
    item = MenuItem.get_by_id(item_id)
    
    fav = UserFavorite.get_or_none(UserFavorite.user == user, UserFavorite.menu_item == item)
    if fav:
        fav.delete_instance()
        return {"status": "removed"}
    else:
        UserFavorite.create(user=user, menu_item=item)
        return {"status": "added"}

@app.get("/admin/api/orders")
async def get_all_orders(request: Request):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401, detail="Admin access required")

    # Only show 'pending' orders in the 'Live Orders' section
    query = Order.select().where(Order.status == 'pending')
    # Apply filtering based on assigned cafe
    if user.assigned_cafe:
        query = query.where(Order.cafe_name == user.assigned_cafe)

    orders = query.order_by(Order.created_at.desc())
    result = []
    for o in orders:
        items = [i.menu_item.name for i in o.items]
        result.append({
            "id": o.id,
            "queue_number": o.queue_number,
            "customer": o.customer.username,
            "cafe_name": o.cafe_name,
            "status": o.status,
            "items": items,
            "created_at": o.created_at.isoformat()
        })
    return result

@app.post("/admin/api/order/{order_id}/ready")
async def mark_order_ready(order_id: int, request: Request):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401)

    order = Order.get_by_id(order_id)
    # Security check: Does this admin manage this cafe?
    if user.assigned_cafe and order.cafe_name != user.assigned_cafe:
        raise HTTPException(status_code=403, detail="Not authorized for this cafe")

    order.status = "ready"
    order.save()
    return {"status": "success"}

@app.post("/admin/api/menu")
async def add_menu_item(request: Request, name: str = Form(...), price: float = Form(...), ingredients: str = Form(...), image: UploadFile = File(None)):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401)
    
    image_url = None
    if image and image.filename:
        ext = image.filename.split('.')[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join("uploads", filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{filename}"

    MenuItem.create(
        name=name,
        price=price,
        ingredients=ingredients,
        image_url=image_url,
        cafe_name=user.assigned_cafe,
        stock_count=100
    )
    return {"status": "success"}

@app.post("/admin/api/menu/{item_id}")
async def update_menu_item(item_id: int, request: Request, name: str = Form(...), price: float = Form(...), ingredients: str = Form(...), image: UploadFile = File(None)):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401)
    
    item = MenuItem.get_by_id(item_id)
    if user.assigned_cafe and item.cafe_name != user.assigned_cafe:
        raise HTTPException(status_code=403)

    item.name = name
    item.price = price
    item.ingredients = ingredients
    if image and image.filename:
        ext = image.filename.split('.')[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join("uploads", filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        item.image_url = f"/uploads/{filename}"
    item.save()
    return {"status": "success"}

@app.post("/admin/api/menu/{item_id}/availability")
async def toggle_item_availability(item_id: int, request: Request):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401)
    
    item = MenuItem.get_by_id(item_id)
    if user.assigned_cafe and item.cafe_name != user.assigned_cafe:
        raise HTTPException(status_code=403)

    item.is_available = not item.is_available
    item.save()
    return {"status": "success", "is_available": item.is_available}

@app.delete("/admin/api/menu/{item_id}")
async def delete_menu_item(item_id: int, request: Request):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401)
    
    item = MenuItem.get_by_id(item_id)
    if user.assigned_cafe and item.cafe_name != user.assigned_cafe:
        raise HTTPException(status_code=403)

    item.delete_instance()
    return {"status": "success"}

# --- Static File Serving ---

if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

@app.get("/{path:path}")
async def serve_react(path: str):
    for base in ["frontend/dist", "frontend/public"]:
        full_path = os.path.join(base, path)
        if os.path.isfile(full_path):
            return FileResponse(full_path)

    index_file = "frontend/dist/index.html"
    if os.path.exists(index_file):
        return FileResponse(index_file)

    return HTMLResponse(content="Backend running.", status_code=404)
