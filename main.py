from fastapi import FastAPI, Request, Form, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import db, User, MenuItem, Order, OrderItem, init_db
from peewee import IntegrityError
import shutil
import os
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

# Mount static files from React build
# React build puts assets in 'dist/assets'
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    # Also mount any public images
    if os.path.exists("frontend/dist/images"):
        app.mount("/images", StaticFiles(directory="frontend/dist/images"), name="images")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Simple session mock (for isolation rule)
def get_current_user(request: Request):
    username = request.cookies.get("customer_session")
    if not username:
        return None
    return User.get_or_none(User.username == username, User.is_admin == False)

def get_current_admin(request: Request):
    username = request.cookies.get("admin_session")
    if not username:
        return None
    return User.get_or_none(User.username == username, User.is_admin == True)

@app.on_event("startup")
def startup():
    init_db()

# --- Auth API Routes (POST only, GET is handled by React) ---

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

@app.post("/logout")
async def logout():
    response = JSONResponse(content={"status": "success"})
    response.delete_cookie("customer_session")
    return response

@app.post("/admin/logout")
async def admin_logout():
    response = JSONResponse(content={"status": "success"})
    response.delete_cookie("admin_session")
    return response

# --- Data API Routes ---

@app.get("/api/menu")
async def get_menu():
    items = MenuItem.select().where(MenuItem.stock_count > 0, MenuItem.is_available == True)
    return list(items.dicts())

@app.post("/api/order")
async def place_order(order_data: dict, user: User = Depends(get_current_user)):
    item_ids = order_data.get("item_ids", [])
    cafe_name = order_data.get("cafe_name")
    current_user = user or User.get_or_none(User.username == 'student')
    
    with db.atomic():
        new_order = Order.create(customer=current_user, cafe_name=cafe_name)
        for item_id in item_ids:
            item = MenuItem.get_by_id(item_id)
            if item.stock_count <= 0:
                raise HTTPException(status_code=400, detail=f"Item {item.name} out of stock")
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
    order = Order.get_or_none(Order.id == order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "ready"
    order.save()
    return {"status": "success", "order_id": order_id}

# --- Catch-all to serve React App ---

@app.get("/{path:path}")
async def serve_react(path: str):
    # If file exists in public/images, serve it
    public_file = os.path.join("frontend/public", path)
    if os.path.isfile(public_file):
        return FileResponse(public_file)
        
    # Otherwise serve index.html for React routing
    index_file = "frontend/dist/index.html"
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse(content="Frontend not built. Please run 'cd frontend && npm run build'", status_code=404)
