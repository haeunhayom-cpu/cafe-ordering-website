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

# Function to seed the database
def seed_data():
    if MenuItem.select().count() == 0:
        print("Seeding database...")
        items = [
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
        for item in items:
            MenuItem.create(**item)
        print("Seeding complete.")

@app.on_event("startup")
def startup():
    init_db()
    seed_data()

# --- Auth Helper ---

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
    # Use a single session cookie for simplicity
    response.set_cookie(key="session_user", value=username, httponly=True)
    return response

@app.post("/api/register")
async def register(username: str = Form(...), password: str = Form(...)):
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
    items = MenuItem.select().where(MenuItem.stock_count > 0, MenuItem.is_available == True)
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
        # Continuous Cafe-Specific Queue Logic
        max_q = Order.select(fn.MAX(Order.queue_number)).where(Order.cafe_name == cafe_name).scalar() or 0
        next_q = max_q + 1

        new_order = Order.create(customer=user, cafe_name=cafe_name, queue_number=next_q)
        for item_id in item_ids:
            item = MenuItem.get_by_id(item_id)
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

@app.get("/admin/api/orders")
async def get_all_orders(request: Request):
    user = get_current_user(request)
    if not user or not user.is_admin:
        raise HTTPException(status_code=401, detail="Admin access required")

    query = Order.select()
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
