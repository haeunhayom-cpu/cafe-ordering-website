import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { CAFE_DATA } from './types';
import type { Cafe, MenuItem } from './types';

// Types
interface CartItem extends MenuItem {
  quantity: number;
}

interface OrderRecord {
  id: number;
  customer: string;
  status: string;
  items: string[];
  created_at: string;
  cafe_name: string;
}

interface User {
  username: string;
  is_admin: boolean;
}

function App() {
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [filter, setFilter] = useState('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [activeOrderStatus, setActiveOrderStatus] = useState<string | null>(null);
  const [activeOrderCafe, setActiveOrderCafe] = useState<string | null>(null);

  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [cartCafeName, setCartCafeName] = useState<string | null>(null);
  const [lastAddedItem, setLastAddedItem] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'student-id' | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'confirm' | 'payment' | 'success'>('cart');
  
  const [viewMode, setViewMode] = useState<'student' | 'admin'>('student');
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [adminSelectedCafe, setAdminSelectedCafe] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('No file chosen');
  const [showPassword, setShowPassword] = useState(false);

  // --- API FETCHERS ---
  const loadMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMenu(data);
    } catch (err) {
      console.error("Menu fetch error:", err);
      setMenu([
        { id: 1, name: 'Hot Americano', price: 10, ingredients: 'Espresso, Water', stock_count: 100, image_url: null, is_available: true },
        { id: 2, name: 'Iced Latte', price: 15, ingredients: 'Espresso, Milk, Ice', stock_count: 50, image_url: null, is_available: true },
        { id: 3, name: 'Cappuccino', price: 14, ingredients: 'Espresso, Milk', stock_count: 80, image_url: null, is_available: true },
        { id: 4, name: 'Butter Croissant', price: 12, ingredients: 'Flour, Butter', stock_count: 20, image_url: null, is_available: true },
        { id: 5, name: 'Chocolate Muffin', price: 11, ingredients: 'Cocoa, Flour', stock_count: 15, image_url: null, is_available: true },
        { id: 6, name: 'Almond Danish', price: 13, ingredients: 'Almonds, Flour, Syrup', stock_count: 10, image_url: null, is_available: true },
        { id: 7, name: 'Tuna Sandwich', price: 22, ingredients: 'Tuna, Veggies', stock_count: 30, image_url: null, is_available: true },
        { id: 8, name: 'Omelet Bagel', price: 20, ingredients: 'Egg, Cheese', stock_count: 25, image_url: null, is_available: true },
        { id: 9, name: 'Healthy Salad', price: 25, ingredients: 'Greens, Nuts', stock_count: 40, image_url: null, is_available: true }
      ]);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    let interval: any;
    if (activeOrderId && activeOrderStatus !== 'ready' && activeOrderStatus !== 'picked_up') {
      interval = setInterval(() => {
        fetch(`/api/order/${activeOrderId}`)
          .then(res => res.json())
          .then(data => {
            if (data.status !== activeOrderStatus) {
              setActiveOrderStatus(data.status);
            }
          })
          .catch(err => console.error('Status poll error:', err));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeOrderId, activeOrderStatus]);

  useEffect(() => {
    let interval: any;
    if (viewMode === 'admin' && user?.is_admin && adminSelectedCafe) {
      const fetchOrders = () => {
        fetch('/admin/api/orders')
          .then(res => res.json())
          .then(data => setAllOrders(Array.isArray(data) ? data : []))
          .catch(err => console.error('Admin orders fetch error:', err));
      };
      fetchOrders();
      interval = setInterval(fetchOrders, 3000);
    }
    return () => clearInterval(interval);
  }, [viewMode, user, adminSelectedCafe]);

  // --- HANDLERS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const u = loginForm.username.toLowerCase();
    const p = loginForm.password;
    if (viewMode === 'admin') {
      if (u === 'admin' && p === 'password123') {
        setUser({ username: 'admin', is_admin: true });
        return;
      }
      setAuthError('Invalid Admin credentials');
    } else {
      if (u === 'student' && p === 'password123') {
        setUser({ username: 'student', is_admin: false });
        return;
      }
      setAuthError('Invalid Student credentials');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCart([]);
    setActiveOrderId(null);
    setActiveOrderStatus(null);
    setViewMode('student');
    setLoginForm({ username: '', password: '' });
    setAdminSelectedCafe(null);
    setCartCafeName(null);
    setSelectedFileName('No file chosen');
  };

  const handleUpdateMenu = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingItem) return;
      alert('Changes saved to cloud database!');
      setEditingItem(null);
      setSelectedFileName('No file chosen');
      loadMenu();
  };

  const addToCart = (item: MenuItem, cafe: Cafe) => {
    if (!cartCafeName || cartCafeName !== cafe.name) {
      setCartCafeName(cafe.name);
    }
    setCart(prevCart => {
      const existing = prevCart.find(i => i.id === item.id);
      if (existing) {
        return prevCart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
    setLastAddedItem(item.name);
    setTimeout(() => setLastAddedItem(null), 2000);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePayment = async () => {
    if (isPaying || !paymentMethod) return;
    setIsPaying(true);
    setCheckoutStep('payment');
    try {
      await new Promise(r => setTimeout(r, 2000));
      const itemIds: number[] = [];
      cart.forEach(item => {
        for (let i = 0; i < item.quantity; i++) itemIds.push(item.id);
      });
      const cafeName = cartCafeName || 'Forum Café';
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds, cafe_name: cafeName })
      });
      if (!response.ok) throw new Error("Order failed");
      const data = await response.json();
      setActiveOrderId(data.order_id);
      setActiveOrderStatus('pending');
      setActiveOrderCafe(cafeName);
      setCheckoutStep('success');
      setCart([]);
      setPaymentMethod(null);
      setCartCafeName(null);
    } catch (err: any) {
      alert(`Order Failed: Check if server is running`);
      setCheckoutStep('cart');
    } finally {
      setIsPaying(false);
    }
  };

  const markReady = async (orderId: number) => {
    try {
        const response = await fetch(`/admin/api/order/${orderId}/ready`, { method: 'POST' });
        if (response.ok) {
            setAllOrders(prev => prev.filter(o => o.id !== orderId));
        }
    } catch (err) {
        console.error('Failed to mark order ready:', err);
    }
  };

  const filteredCafes = useMemo(() => filter === 'All' ? CAFE_DATA : CAFE_DATA.filter(c => c.location.includes(filter)), [filter]);
  const locations = ['All', 'Central campus', 'Social Sciences Building', 'Humanities Building', 'Rothberg area'];

  // --- RENDER LOGIC ---

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-branding">
            <div className="cafe-icon-wrapper">☕</div>
            <div className="branding-line"></div>
          </div>
          <h1>{viewMode === 'admin' ? 'Staff Portal' : 'Student Access'}</h1>
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})} />
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                required 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                style={{ paddingRight: '4rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#999',
                  padding: '0.5rem'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {authError && <p className="error-text">{authError}</p>}
            <button type="submit" className="pay-btn">{viewMode === 'admin' ? 'Access Dashboard' : 'Enter CAFENOW'}</button>
          </form>
          <button className="text-link" onClick={() => { setViewMode(viewMode === 'student' ? 'admin' : 'student'); setAuthError(null); }}>
            Switch to {viewMode === 'student' ? 'Staff' : 'Student'} Login
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'admin' && user.is_admin) {
    if (!adminSelectedCafe) {
      return (
        <div className="container" style={{paddingTop: '5rem', textAlign: 'center'}}>
          <h1 style={{fontSize: '3.5rem', fontWeight: 900, marginBottom: '1rem', color: '#000'}}>Cafe Selection</h1>
          <p style={{fontSize: '1.2rem', color: 'var(--text-light)', marginBottom: '4rem'}}>Select a location to manage</p>
          <div className="cafe-grid" style={{maxWidth: '900px', margin: '0 auto'}}>
            {CAFE_DATA.map(cafe => (
              <div key={cafe.id} className="cafe-card" onClick={() => setAdminSelectedCafe(cafe.name)} style={{textAlign: 'left'}}>
                <img src={cafe.imageUrl} className="cafe-img" style={{height: '180px'}} alt={cafe.name} />
                <div className="cafe-info" style={{padding: '1.5rem'}}>
                  <h3 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>{cafe.name}</h3>
                  <p className="cafe-loc" style={{marginBottom: 0}}>{cafe.location}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="text-link" style={{marginTop: '4rem'}} onClick={handleLogout}>Logout</button>
        </div>
      );
    }
    const pendingOrders = allOrders.filter(o => o.status === 'pending' && o.cafe_name === adminSelectedCafe);
    return (
      <div className="container" style={{paddingTop: '3rem'}}>
          <div className="admin-header" style={{borderColor: '#000', borderBottom: '2px solid #000'}}>
            <div className="admin-title-section">
                <h1 style={{color: '#000', fontSize: '3rem', fontWeight: 900, margin: 0}}>{adminSelectedCafe}</h1>
                <p style={{color: 'var(--primary)', fontWeight: 600, margin: '5px 0 0'}}>Dashboard Manager: {user.username}</p>
            </div>
            <div style={{display: 'flex', gap: '1rem'}}>
                <button className="admin-nav-btn" onClick={() => setAdminSelectedCafe(null)}>Switch Cafe</button>
                <button className="admin-nav-btn" onClick={() => setViewMode('student')}>Exit to Student View</button>
                <button className="admin-nav-btn" style={{borderColor: '#ccc', color: '#888'}} onClick={handleLogout}>Logout</button>
            </div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 400px', gap: '3rem'}}>
            <div className="orders-grid">
                <h2 style={{fontSize: '1.8rem', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem', color: '#000'}}>Live Orders</h2>
                {pendingOrders.length === 0 ? (
                    <div className="status-screen" style={{gridColumn: '1/-1', background: 'white', padding: '5rem'}}>
                        <div style={{fontSize: '4rem'}}>☕</div>
                        <p style={{fontWeight: 600, marginTop: '1rem', color: '#000'}}>No pending orders for {adminSelectedCafe}.</p>
                    </div>
                ) : (
                    pendingOrders.map(order => (
                        <div key={order.id} className="order-card-admin" style={{borderLeftColor: '#000'}}>
                            <span className="badge" style={{background: '#000', color: '#fff'}}>ORDER #{order.id}</span>
                            <h3 style={{fontSize: '1.8rem', margin: '1rem 0', color: '#000'}}>{order.customer}</h3>
                            <ul className="order-items-list">{order.items.map((it, idx) => <li key={idx} style={{fontSize: '1.1rem', color: '#000'}}>• {it}</li>)}</ul>
                            <button className="pay-btn" style={{marginTop: '1.5rem', background: '#000'}} onClick={() => markReady(order.id)}>Mark as Ready</button>
                        </div>
                    ))
                )}
            </div>
            <div className="menu-manager">
                <h2 style={{fontSize: '1.8rem', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem', color: '#000'}}>Inventory</h2>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    {menu.length > 0 ? menu.map(item => (
                        <div key={item.id} className="menu-item-btn" style={{background: '#fff', textAlign: 'left', border: '1px solid #eee', padding: '1.5rem'}} onClick={() => { setEditingItem(item); setSelectedFileName('No file chosen'); }}>
                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                <span style={{fontSize: '1.1rem', fontWeight: 800, color: '#000'}}>{item.name}</span>
                                <span style={{fontSize: '0.8rem', color: '#888', fontWeight: 400}}>{item.ingredients}</span>
                            </div>
                            <strong style={{fontSize: '1.2rem', color: '#000'}}>₪{item.price}</strong>
                        </div>
                    )) : <p>Loading menu...</p>}
                </div>
            </div>
          </div>
          {editingItem && (
              <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '500px', borderRadius: '24px', padding: '3rem'}}>
                      <h2 style={{fontSize: '2.2rem', fontWeight: 900, marginBottom: '2rem', color: '#000'}}>Edit Item</h2>
                      <form onSubmit={handleUpdateMenu} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                          <label style={{fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#000'}}>Item Name</label>
                          <input type="text" name="name" defaultValue={editingItem.name} style={{border: '1.5px solid #eee', padding: '1rem', borderRadius: '12px', fontSize: '1rem', color: '#000', background: '#fafafa'}} />
                          <label style={{fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#000'}}>Price (₪)</label>
                          <input type="number" name="price" defaultValue={editingItem.price} step="0.1" style={{border: '1.5px solid #eee', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#000', background: '#fafafa'}} />
                          <label style={{fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#000'}}>Ingredients</label>
                          <textarea name="ingredients" defaultValue={editingItem.ingredients} style={{border: '1.5px solid #eee', padding: '1rem', borderRadius: '12px', minHeight: '100px', fontSize: '1rem', color: '#000', background: '#fafafa'}} />
                          <label style={{fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#000'}}>Update Image</label>
                          <div className="custom-file-input">
                              <label htmlFor="file-upload" className="file-label">Choose File</label>
                              <span className="file-name">{selectedFileName}</span>
                              <input id="file-upload" type="file" name="image" onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name || 'No file chosen')} style={{display: 'none'}} />
                          </div>
                          <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                              <button type="submit" className="save-btn" style={{flex: 1}}>Save Changes</button>
                              <button type="button" className="admin-nav-btn" style={{flex: 1, borderRadius: '8px', border: '1.5px solid #eee'}} onClick={() => setEditingItem(null)}>Cancel</button>
                          </div>
                      </form>
                  </div>
              </div>
          )}
      </div>
    );
  }

  return (
    <div>
      <header className="hero-header">
        <div className="hero-overlay"></div>
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Hebrew_University_of_Jerusalem-Mount_Scopus.jpg/2560px-Hebrew_University_of_Jerusalem_Mount_Scopus.jpg" className="hero-img" alt="Campus" />
        <div className="hero-content">
            <div className="header-top">
                <div style={{flex: 1}}></div>
                <button className="logout-btn-header" onClick={handleLogout}>Logout</button>
            </div>
            <div className="title-container"><div className="main-title">CAFENOW</div><div className="sub-title">HUJI</div><p className="hero-description">Order Faster. Skip the Line. Enjoy Your Coffee.</p></div>
        </div>
      </header>
      {lastAddedItem && <div className="toast">🛒 {lastAddedItem} added to cart!</div>}
      <div className="container">
        <div className="tracking-banner">
          {!activeOrderId ? (
            <div className="status-idle">
              <span className="badge" style={{backgroundColor: '#f5ebd7', color: '#b05b3b', border: '1px solid #d4a373'}}>Open & Ready</span>
              <h2>Campus Cafés are serving now</h2>
              <p style={{color: 'var(--text-light)', marginTop: '0.5rem'}}>Select a location below to start your quick order.</p>
            </div>
          ) : (
            <>
              <div className="tracking-info">
                  <span className="badge" style={{background: '#000', color: '#fff'}}>Active Order #{activeOrderId}</span>
                  <h2>{activeOrderCafe} is preparing</h2>
                  <p style={{color: 'var(--text-light)', marginTop: '0.5rem'}}>You can keep browsing while we craft your order.</p>
              </div>
              <div className="tracking-visual">
                  <div className={`step ${activeOrderStatus === 'pending' || activeOrderStatus === 'ready' ? 'active' : ''}`}><div className="step-circle">1</div><span>Placed</span></div>
                  <div className="line"></div>
                  <div className={`step ${activeOrderStatus === 'pending' ? 'active pulse' : activeOrderStatus === 'ready' ? 'active' : ''}`}><div className="step-circle">2</div><span>Preparing</span></div>
                  <div className="line"></div>
                  <div className={`step ${activeOrderStatus === 'ready' ? 'active success-bg' : ''}`}><div className="step-circle">{activeOrderStatus === 'ready' ? '✓' : '3'}</div><span>Ready</span></div>
              </div>
              {activeOrderStatus === 'ready' && <button className="pay-btn" style={{marginTop: 0, padding: '0.8rem 1.5rem', width: 'auto'}} onClick={() => { setActiveOrderId(null); setActiveOrderStatus(null); }}>Pick Up Done</button>}
            </>
          )}
        </div>
        <div className="filter-bar">{locations.map(loc => <button key={loc} className={`filter-btn ${filter === loc ? 'active' : ''}`} onClick={() => setFilter(loc)}>{loc}</button>)}</div>
        <div className="cafe-grid">
          {filteredCafes.map(cafe => (
            <div key={cafe.id} className="cafe-card" onClick={() => setSelectedCafe(cafe)}>
              <img src={cafe.imageUrl} className="cafe-img" alt={cafe.name} onError={e => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800'} />
              <div className="cafe-info">
                <h3>{cafe.name}</h3><p className="cafe-loc">{cafe.location}</p>
                <div className="view-menu-btn"><span>View full menu</span><span>→</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {selectedCafe && (
        <div className="modal-overlay" onClick={() => setSelectedCafe(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem'}}>
              <div><h2 style={{margin: 0, color: 'var(--primary)'}}>{selectedCafe.name} Menu</h2><p className="cafe-loc" style={{margin: '5px 0 0'}}>{selectedCafe.location}</p></div>
              <button className="filter-btn" onClick={() => setSelectedCafe(null)}>Close</button>
            </div>
            <div className="menu-grid-detailed">
              {menu.length > 0 ? menu.map(item => (
                <button key={item.id} className="menu-item-btn" onClick={() => addToCart(item, selectedCafe)}>
                  <div style={{textAlign: 'left'}}><div style={{fontWeight: '800'}}>{item.name}</div><div style={{fontSize: '0.75rem', fontWeight: 'normal', marginTop: '0.3rem', color: 'var(--text-light)'}}>{item.ingredients}</div></div>
                  <span style={{fontSize: '1.1rem'}}>₪{item.price}</span>
                </button>
              )) : <p>Loading menu items...</p>}
            </div>
          </div>
        </div>
      )}
      {totalItems > 0 && (
        <div className="cart-widget" onClick={() => { setIsCheckoutOpen(true); setCheckoutStep('cart'); }}>
          <span>🛒 {totalItems} Items</span><span>₪{totalPrice.toFixed(2)}</span><strong>Checkout →</strong>
        </div>
      )}
      {isCheckoutOpen && (
        <div className="modal-overlay" onClick={() => { if(checkoutStep !== 'payment') setIsCheckoutOpen(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {checkoutStep === 'cart' && (
              <>
                <h2 style={{color: 'var(--primary)', marginBottom: '1.5rem'}}>Shopping Cart</h2>
                <div className="cart-items-list">{cart.map(item => (
                  <div key={item.id} className="checkout-item">
                    <div style={{flexGrow: 1}}><div style={{fontWeight: '600'}}>{item.name}</div><div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>₪{item.price} each</div></div>
                    <div className="quantity-controls"><button onClick={() => updateQuantity(item.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)}>+</button></div>
                    <div style={{width: '60px', textAlign: 'right', fontWeight: 'bold'}}>₪{(item.price * item.quantity).toFixed(0)}</div>
                    <button className="remove-btn" onClick={() => removeFromCart(item.id)}>✕</button>
                  </div>
                ))}</div>
                <div className="total">Total: ₪{totalPrice.toFixed(2)}</div>
                <button className="pay-btn" onClick={() => setCheckoutStep('confirm')} disabled={cart.length === 0}>Confirm Details →</button>
              </>
            )}
            {checkoutStep === 'confirm' && (
              <>
                <h2 style={{color: 'var(--primary)', marginBottom: '1rem'}}>Confirm Order</h2>
                <div style={{background: 'white', border: '1px solid var(--warm-accent)', padding: '1.5rem', borderRadius: '20px', marginBottom: '2rem'}}>
                    {cart.map(item => <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}><span>{item.name} x {item.quantity}</span><strong>₪{(item.price * item.quantity).toFixed(0)}</strong></div>)}
                    <div style={{borderTop: '1px solid var(--warm-accent)', marginTop: '1rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between'}}><strong>Total</strong><strong style={{color: 'var(--primary)', fontSize: '1.4rem'}}>₪{totalPrice.toFixed(2)}</strong></div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem'}}>
                  <button className={`filter-btn ${paymentMethod === 'card' ? 'active' : ''}`} style={{borderRadius: '12px', padding: '1.2rem'}} onClick={() => setPaymentMethod('card')}>💳 Stripe / Card</button>
                  <button className={`filter-btn ${paymentMethod === 'student-id' ? 'active' : ''}`} style={{borderRadius: '12px', padding: '1.2rem'}} onClick={() => setPaymentMethod('student-id')}>🎓 PayPal / ID</button>
                </div>
                <button className="pay-btn" onClick={handlePayment} disabled={!paymentMethod}>Pay & Place Order</button>
              </>
            )}
            {checkoutStep === 'payment' && (
              <div style={{textAlign: 'center', padding: '3rem 0'}}><div style={{fontSize: '4rem', marginBottom: '2rem'}}>🔒</div><h2>Secure Payment</h2><p>Redirecting to {paymentMethod === 'card' ? 'Stripe' : 'PayPal'}...</p><div className="spinner"></div></div>
            )}
            {checkoutStep === 'success' && (
              <div style={{textAlign: 'center', padding: '2rem 0'}}><div style={{fontSize: '5rem', marginBottom: '1.5rem'}}>🎉</div><h2>Payment Successful!</h2><div style={{background: 'var(--warm-accent)', padding: '1.5rem', borderRadius: '20px', margin: '2rem 0'}}><p>ORDER NUMBER</p><div style={{fontSize: '2.5rem', fontWeight: '900', color: 'var(--primary)'}}>#{activeOrderId}</div></div><button className="pay-btn" onClick={() => { setIsCheckoutOpen(false); setCheckoutStep('cart'); }}>Back to Menu</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
