# CAFENOW HUJI - Project Overview

Welcome to the **CAFENOW HUJI** project! This is a high-end, full-stack campus café ordering and management system designed specifically for the Hebrew University of Jerusalem. It bridges the gap between students needing a quick break and café staff managing a busy kitchen.

---

## 1. Project Purpose
Students at HUJI often have only 15-20 minutes between classes. This app helps them:
- **Save Time:** Browse menus and place orders from anywhere on campus.
- **Skip the Line:** Pay digitally and only head to the café when the food is ready.
- **Visual Tracking:** See exactly where their order is in the preparation process (Placed -> Preparing -> Ready).

---

## 2. Main Features
- **Premium Minimalist UI:** Inspired by Blue Bottle and Starbucks with a warm Jerusalem terracotta and stone-beige theme.
- **Smart Student View:**
  - Secure login (`student` account).
  - 2x2 Balanced grid layout of campus cafés.
  - Full menu access with item ingredients and photos.
  - **Live Tracking Banner:** An integrated, non-intrusive banner on the homepage to track active orders in real-time.
- **Robust Staff Portal (Admin):**
  - Secure login (`admin` account).
  - **Cafe Selection:** Choose which specific location to manage.
  - **Kitchen Dashboard:** Real-time list of incoming orders for that specific cafe.
  - **Inventory Manager:** Update item names, prices, ingredients, and images instantly.
- **Simulated Payment:** Realistic Stripe/PayPal checkout flow with order number generation.

---

## 3. Folder Structure
```text
/vibe_coding
├── main.py              # Backend API Server (FastAPI)
├── database.py          # Data blueprints and rules
├── seed.py              # Script to populate the initial 9 menu items
├── cafeteria.db         # The actual data vault (SQLite)
├── requirements.txt     # List of Python libraries needed
└── frontend/            # React + TypeScript project folder
    ├── src/
    │   ├── App.tsx      # Core logic, screens, and API calls (MOST IMPORTANT)
    │   ├── App.css      # Design, colors, and layout (MOST IMPORTANT)
    │   └── types.ts     # Data definitions and cafe metadata
    └── public/
        └── images/      # Static assets like logos
```

---

## 4. How to Run the Project
To see the magic happen, you need two terminals running at the same time:

### Terminal 1: The Brain (Backend)
1. Install libraries: `pip install -r requirements.txt`
2. Prepare data: `python3 seed.py`
3. Run server: `uvicorn main:app --reload` (Starts at Port 8000)

### Terminal 2: The Face (Frontend)
1. Go to folder: `cd frontend`
2. Install tools: `npm install`
3. Run app: `npm run dev -- --force` (Starts at Port 3000)

*Open your browser and go to: **http://localhost:3000***

---

## 5. How it Works
1. **Frontend (React):** Manages the user experience. When you click "Order," it stores that info in its "State" and asks the backend to save it.
2. **Backend (FastAPI):** The middleman. It listens for requests (APIs), checks if they are valid, and talks to the database.
3. **Database (SQLite):** The permanent memory. It remembers every user, every sandwich price, and every pending order even if the power goes out.

---

## 6. Important Files for Editing
- **`App.tsx`:** Go here to change **button logic, text content, or order flow**.
- **`App.css`:** Go here to change **colors, spacing, 3D titles, or responsiveness**.
- **`main.py`:** Go here to change **how login works or how orders are saved**.

---

## 7. Future Improvements
- **Push Notifications:** Send an alert to the student's phone when the coffee is ready.
- **Map View:** A visual map of campus showing the walk-time to each café.
- **Loyalty Points:** "Buy 9 coffees, get the 10th free" digital stamp card.
- **Real Payment Integration:** Connect actual Stripe/PayPal accounts for real money transactions.

---

Happy ordering! 🚀☕️🏜️
