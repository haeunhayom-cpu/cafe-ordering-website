from fastapi import FastAPI, Request, Form, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
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
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs("static", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

# Mount static and uploads
app.mount("/static", StaticFiles(directory="static"), name="static")
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

# --- Auth Routes ---

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    with open("static/login.html", "r") as f:
        return f.read()

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = User.get_or_none(User.username == username, User.password == password, User.is_admin == False)
    if not user:
        return RedirectResponse(url="/login?error=invalid", status_code=status.HTTP_303_SEE_OTHER)
    response = RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(key="customer_session", value=username)
    return response

@app.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page():
    with open("static/admin_login.html", "r") as f:
        return f.read()

@app.post("/admin/login")
async def admin_login(username: str = Form(...), password: str = Form(...)):
    user = User.get_or_none(User.username == username, User.password == password, User.is_admin == True)
    if not user:
        return RedirectResponse(url="/admin/login?error=invalid", status_code=status.HTTP_303_SEE_OTHER)
    response = RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(key="admin_session", value=username)
    return response

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login")
    response.delete_cookie("customer_session")
    return response

@app.get("/admin/logout")
async def admin_logout():
    response = RedirectResponse(url="/admin/login")
    response.delete_cookie("admin_session")
    return response

# --- Customer Routes ---

@app.get("/", response_class=HTMLResponse)
async def index(user: User = Depends(get_current_user)):
    if not user:
        return RedirectResponse(url="/login")
    with open("static/index.html", "r") as f:
        return f.read()

@app.get("/api/menu")
async def get_menu():
    items = MenuItem.select().where(MenuItem.stock_count > 0, MenuItem.is_available == True)
    return list(items.dicts())

@app.post("/api/order")
async def place_order(order_data: dict, user: User = Depends(get_current_user)):
    # Expecting order_data = {"item_ids": [1, 2], "cafe_name": "Forum Cafe"}
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

# --- Admin Routes ---

@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(admin: User = Depends(get_current_admin)):
    if not admin:
        return RedirectResponse(url="/admin/login")
    with open("static/admin_dashboard.html", "r") as f:
        return f.read()

@app.post("/admin/api/menu")
async def add_menu_item(
    name: str = Form(...), 
    price: float = Form(...), 
    ingredients: str = Form(...), 
    stock_count: int = Form(...),
    image: UploadFile = File(None),
    admin: User = Depends(get_current_admin)
):
    if not admin:
        raise HTTPException(status_code=401)
    
    image_url = None
    if image:
        file_ext = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_ext}"
        filepath = os.path.join("uploads", filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{filename}"
    
    MenuItem.create(
        name=name, 
        price=price, 
        ingredients=ingredients, 
        stock_count=stock_count, 
        image_url=image_url
    )
    return RedirectResponse(url="/admin", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/admin/api/orders")
async def get_all_orders(admin: User = Depends(get_current_admin)):
    # Note: In production, check admin auth here.
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
    # For MVP simplicity, we'll allow this endpoint from the local frontend
    order = Order.get_or_none(Order.id == order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "ready"
    order.save()
    return {"status": "success", "order_id": order_id}
