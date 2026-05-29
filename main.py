from fastapi import FastAPI, Request, Form, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import db, User, MenuItem, Order, OrderItem, init_db
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

# --- Auth API ---

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = User.get_or_none(User.username == username, User.password == password, User.is_admin == False)
    if not user:
        return JSONResponse(content={"error": "invalid"}, status_code=401)
    response = JSONResponse(content={"status": "success"})
    response.set_cookie(key="customer_session", value=username)
    return response

@app.post("/admin/login")
async def admin_login(username: str = Form(...), password: str = Form(...)):
    user = User.get_or_none(User.username == username, User.password == password, User.is_admin == True)
    if not user:
        return JSONResponse(content={"error": "invalid"}, status_code=401)
    response = JSONResponse(content={"status": "success"})
    response.set_cookie(key="admin_session", value=username)
    return response

# --- Data API ---

@app.get("/api/menu")
async def get_menu():
    items = MenuItem.select().where(MenuItem.stock_count > 0, MenuItem.is_available == True)
    result = list(items.dicts())
    print(f"Returning {len(result)} menu items")
    return result

@app.post("/api/order")
async def place_order(order_data: dict):
    item_ids = order_data.get("item_ids", [])
    cafe_name = order_data.get("cafe_name")
    
    # Default to 'student' for simplicity in MVP
    current_user = User.get_or_none(User.username == 'student')
    
    with db.atomic():
        new_order = Order.create(customer=current_user, cafe_name=cafe_name)
        for item_id in item_ids:
            item = MenuItem.get_by_id(item_id)
            item.stock_count -= 1
            item.save()
            OrderItem.create(order=new_order, menu_item=item)
            
    return {"order_id": new_order.id, "status": new_order.status}

@app.get("/api/order/{order_id}")
async def get_order_status(order_id: int):
    order = Order.get_or_none(Order.id == order_id)
    if not order:
        raise HTTPException(status_code=404)
    return {"id": order.id, "status": order.status}

@app.get("/admin/api/orders")
async def get_all_orders():
    orders = Order.select().order_by(Order.created_at.desc())
    result = []
    for o in orders:
        items = [i.menu_item.name for i in o.items]
        result.append({
            "id": o.id,
            "customer": o.customer.username,
            "cafe_name": o.cafe_name,
            "status": o.status,
            "items": items,
            "created_at": o.created_at.isoformat()
        })
    return result

@app.post("/admin/api/order/{order_id}/ready")
async def mark_order_ready(order_id: int):
    order = Order.get_by_id(order_id)
    order.status = "ready"
    order.save()
    return {"status": "success"}

# --- Static File Serving ---

if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

@app.get("/{path:path}")
async def serve_react(path: str):
    # Check if the requested path is a file in 'dist' or 'public'
    for base in ["frontend/dist", "frontend/public"]:
        full_path = os.path.join(base, path)
        if os.path.isfile(full_path):
            return FileResponse(full_path)
            
    # Fallback to React index.html for SPA routing
    index_file = "frontend/dist/index.html"
    if os.path.exists(index_file):
        return FileResponse(index_file)
    
    return HTMLResponse(content="Backend running. Frontend not found.", status_code=404)
