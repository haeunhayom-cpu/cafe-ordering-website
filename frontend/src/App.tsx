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
  queue_number: number;
  customer: string;
  status: string;
  items: string[];
  created_at: string;
  cafe_name: string;
}

interface User {
  username: string;
  is_admin: boolean;
  assigned_cafe?: string | null;
}

function App() {
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [filter, setFilter] = useState('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [activeOrderQueueNumber, setActiveOrderQueueNumber] = useState<number | null>(null);
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
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');

  // --- API FETCHERS ---
  const loadMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMenu(data);
    } catch (err) {
      console.error("Menu fetch error:", err);
    }
  };

  const loadUserData = async () => {
    try {
      const [ordersRes, favsRes] = await Promise.all([
        fetch('/api/user/orders'),
        fetch('/api/user/favorites')
      ]);
      if (ordersRes.ok) setOrderHistory(await ordersRes.json());
      if (favsRes.ok) setFavorites(await favsRes.json());
    } catch (err) {
      console.error("Failed to load user data:", err);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        if (data.is_admin) {
          setViewMode('admin');
          if (data.assigned_cafe) setAdminSelectedCafe(data.assigned_cafe);
        } else {
          loadUserData();
        }
      }
    } catch (err) {
      console.error("Auth check failed");
    }
  };

  const loadAllOrders = async () => {
    try {
      const res = await fetch('/admin/api/orders');
      if (res.ok) setAllOrders(await res.json());
    } catch (err) {
      console.error("Admin orders fetch error:", err);
    }
  };

  useEffect(() => {
    loadMenu();
    checkAuth();
  }, []);

  useEffect(() => {
    let interval: any;
    if (user?.is_admin && viewMode === 'admin') {
      loadAllOrders();
      interval = setInterval(loadAllOrders, 5000);
    }
    return () => clearInterval(interval);
  }, [user, viewMode]);

  useEffect(() => {
    let interval: any;
    if (activeOrderId && activeOrderStatus !== 'ready') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/order/${activeOrderId}`);
          if (res.ok) {
            const data = await res.json();
            setActiveOrderStatus(data.status);
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeOrderId, activeOrderStatus]);

  // --- HANDLERS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    const formData = new FormData();
    formData.append('username', loginForm.username);
    formData.append('password', loginForm.password);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const data = await res.json();
      setUser(data.user);
      if (data.user.is_admin) {
        setViewMode('admin');
        if (data.user.assigned_cafe) setAdminSelectedCafe(data.user.assigned_cafe);
      } else {
        setViewMode('student');
        loadUserData();
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // ... (handleRegister remains same)

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setCart([]);
    setActiveOrderId(null);
    setActiveOrderStatus(null);
    setViewMode('student');
    setLoginForm({ username: '', password: '' });
    setAdminSelectedCafe(null);
    setCartCafeName(null);
    setSelectedFileName('No file chosen');
    setIsRegistering(false);
    setOrderHistory([]);
    setFavorites([]);
    setActiveTab('home');
  };

  const toggleFavorite = async (itemId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/user/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'added') setFavorites([...favorites, itemId]);
        else setFavorites(favorites.filter(id => id !== itemId));
      }
    } catch (err) {
      console.error("Toggle favorite failed:", err);
    }
  };

  const reorder = (order: any) => {
    const cafe = CAFE_DATA.find(c => c.name === order.cafe_name);
    if (!cafe) return;
    
    setCart([]);
    setCartCafeName(order.cafe_name);
    
    const newCart: CartItem[] = [];
    order.items.forEach((item: any) => {
      const menuItem = menu.find(m => m.id === item.id);
      if (menuItem) {
        const existing = newCart.find(c => c.id === menuItem.id);
        if (existing) existing.quantity += 1;
        else newCart.push({ ...menuItem, quantity: 1 });
      }
    });
    
    setCart(newCart);
    setIsCheckoutOpen(true);
    setCheckoutStep('cart');
    setActiveTab('home');
  };

  const addToCart = (item: MenuItem, cafe: Cafe) => {
    if (cartCafeName && cartCafeName !== cafe.name) {
      if (!confirm(`Clear cart from ${cartCafeName} to order from ${cafe.name}?`)) return;
      setCart([]);
    }
    setCartCafeName(cafe.name);
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    setLastAddedItem(item.name);
    setTimeout(() => setLastAddedItem(null), 2000);
  };

  const removeFromCart = (id: number) => {
    const newCart = cart.filter(c => c.id !== id);
    setCart(newCart);
    if (newCart.length === 0) setCartCafeName(null);
  };

  const updateQuantity = (id: number, delta: number) => {
    const newCart = cart.map(c => {
      if (c.id === id) {
        const newQty = Math.max(0, c.quantity + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }).filter(c => c.quantity > 0);
    setCart(newCart);
    if (newCart.length === 0) setCartCafeName(null);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const formData = new FormData();
      formData.append('username', loginForm.username);
      formData.append('password', loginForm.password);

      const res = await fetch('/api/register', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }
      await handleLogin(e);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const markReady = async (orderId: number) => {
    try {
      const res = await fetch(`/admin/api/order/${orderId}/ready`, { method: 'POST' });
      if (res.ok) {
        setAllOrders(allOrders.map(o => o.id === orderId ? { ...o, status: 'ready' } : o));
      }
    } catch (err) {
      console.error("Failed to mark order as ready:", err);
    }
  };

  const handleUpdateMenu = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/admin/menu/${editingItem.id}`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        loadMenu();
        setEditingItem(null);
      }
    } catch (err) {
      console.error("Failed to update menu:", err);
    }
  };

  const handlePayment = async () => {
    if (isPaying) return;
    setIsPaying(true);
    try {
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
      setActiveOrderQueueNumber(data.queue_number);
      setActiveOrderStatus('pending');
      setActiveOrderCafe(cafeName);
      setCheckoutStep('success');
      setCart([]);
      setPaymentMethod(null);
      setCartCafeName(null);
      loadUserData(); // Refresh history
    } catch (err: any) {
      alert(`Order Failed: Check if server is running`);
      setCheckoutStep('cart');
    } finally {
      setIsPaying(false);
    }
  };

  const locations = useMemo(() => ['All', ...new Set(CAFE_DATA.map(c => c.location))], []);
  const filteredCafes = useMemo(() => {
    return filter === 'All' ? CAFE_DATA : CAFE_DATA.filter(c => c.location === filter);
  }, [filter]);

  // --- SUB-COMPONENTS ---

  const UserProfile = () => (
    <div className="profile-section fade-in">
      <div className="profile-header">
        <div className="profile-avatar">{user?.username[0].toUpperCase()}</div>
        <div className="profile-info">
          <h2>{user?.username}</h2>
          <p>HUJI Student | Campus Explorer</p>
        </div>
      </div>

      <div className="profile-content-grid">
        <div className="history-column">
          <h3 className="section-title">Order History</h3>
          {orderHistory.length === 0 ? (
            <div className="empty-state">No past orders yet.</div>
          ) : (
            <div className="history-list">
              {orderHistory.map(order => (
                <div key={order.id} className="history-card">
                  <div className="history-card-header">
                    <div>
                      <div className="history-cafe">{order.cafe_name}</div>
                      <div className="history-date">{new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className={`status-pill ${order.status}`}>{order.status}</span>
                  </div>
                  <div className="history-items">
                    {order.items.map((it: any, idx: number) => (
                      <span key={idx}>{it.name}{idx < order.items.length - 1 ? ', ' : ''}</span>
                    ))}
                  </div>
                  <button className="reorder-btn" onClick={() => reorder(order)}>Reorder Now</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="favorites-column">
          <h3 className="section-title">Favorite Drinks</h3>
          {favorites.length === 0 ? (
            <div className="empty-state">Save your go-to drinks here.</div>
          ) : (
            <div className="favorites-list">
              {menu.filter(m => favorites.includes(m.id)).map(item => (
                <div key={item.id} className="fav-item">
                  <div style={{fontWeight: 700}}>{item.name}</div>
                  <div className="fav-actions">
                    <button className="fav-toggle-btn active" onClick={() => toggleFavorite(item.id)}>❤️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // --- RENDER LOGIC ---

  if (!user) {
    // ... (Login screen code remains same)
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-branding">
            <div className="cafe-icon-wrapper">☕</div>
            <div className="branding-line"></div>
          </div>
          <h1>{isRegistering ? 'Create Account' : (viewMode === 'admin' ? 'Staff Portal' : 'Student Access')}</h1>
          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
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
            <button type="submit" className="pay-btn">{isRegistering ? 'Sign Up' : (viewMode === 'admin' ? 'Access Dashboard' : 'Enter CAFENOW')}</button>
          </form>
          {!isRegistering && (
            <button className="text-link" onClick={() => { setViewMode(viewMode === 'student' ? 'admin' : 'student'); setAuthError(null); }}>
              Switch to {viewMode === 'student' ? 'Staff' : 'Student'} Login
            </button>
          )}
          {viewMode === 'student' && (
            <button className="text-link" onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}>
              {isRegistering ? 'Back to Login' : 'New student? Register here'}
            </button>
          )}
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
                {!user.assigned_cafe && <button className="admin-nav-btn" onClick={() => setAdminSelectedCafe(null)}>Switch Cafe</button>}
                {!user.assigned_cafe && <button className="admin-nav-btn" onClick={() => setViewMode('student')}>Exit to Student View</button>}
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
                            <span className="badge" style={{background: '#000', color: '#fff'}}>QUEUE #{order.queue_number}</span>
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
                <nav className="main-nav">
                  <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>Home</button>
                  <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>My Profile</button>
                </nav>
                <button className="logout-btn-header" onClick={handleLogout}>Logout</button>
            </div>
            <div className="title-container"><div className="main-title">CAFENOW</div><div className="sub-title">HUJI</div><p className="hero-description">Order Faster. Skip the Line. Enjoy Your Coffee.</p></div>
        </div>
      </header>

      {activeTab === 'profile' ? (
        <div className="container">
          <UserProfile />
        </div>
      ) : (
        <>
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
                      <span className="badge" style={{background: '#000', color: '#fff'}}>Queue #{activeOrderQueueNumber} (Order #{activeOrderId})</span>
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
        </>
      )}

      {selectedCafe && (
        <div className="modal-overlay" onClick={() => setSelectedCafe(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem'}}>
              <div><h2 style={{margin: 0, color: 'var(--primary)'}}>{selectedCafe.name} Menu</h2><p className="cafe-loc" style={{margin: '5px 0 0'}}>{selectedCafe.location}</p></div>
              <button className="filter-btn" onClick={() => setSelectedCafe(null)}>Close</button>
            </div>
            <div className="menu-grid-detailed">
              {menu.length > 0 ? menu.map(item => (
                <div key={item.id} style={{position: 'relative'}}>
                  <button className="menu-item-btn" onClick={() => addToCart(item, selectedCafe)}>
                    <div style={{textAlign: 'left'}}><div style={{fontWeight: '800'}}>{item.name}</div><div style={{fontSize: '0.75rem', fontWeight: 'normal', marginTop: '0.3rem', color: 'var(--text-light)'}}>{item.ingredients}</div></div>
                    <span style={{fontSize: '1.1rem'}}>₪{item.price}</span>
                  </button>
                  <button 
                    className={`fav-toggle-btn ${favorites.includes(item.id) ? 'active' : ''}`} 
                    onClick={(e) => toggleFavorite(item.id, e)}
                  >
                    {favorites.includes(item.id) ? '❤️' : '🤍'}
                  </button>
                </div>
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
                <button className="pay-btn" onClick={handlePayment}>Place Order Now →</button>
              </>
            )}
            {checkoutStep === 'payment' && (
              <div style={{textAlign: 'center', padding: '3rem 0'}}><div style={{fontSize: '4rem', marginBottom: '2rem'}}>🔒</div><h2>Processing Order</h2><p>Please wait a moment...</p><div className="spinner"></div></div>
            )}
            {checkoutStep === 'success' && (
              <div style={{textAlign: 'center', padding: '2rem 0'}}><div style={{fontSize: '5rem', marginBottom: '1.5rem'}}>🎉</div><h2>Order Placed!</h2><div style={{background: 'var(--warm-accent)', padding: '1.5rem', borderRadius: '20px', margin: '2rem 0'}}><p>QUEUE NUMBER</p><div style={{fontSize: '2.5rem', fontWeight: '900', color: 'var(--primary)'}}>#{activeOrderQueueNumber}</div><p style={{marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7}}>Order #{activeOrderId}</p></div><button className="pay-btn" onClick={() => { setIsCheckoutOpen(false); setCheckoutStep('cart'); }}>Back to Menu</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
