import { Link, useLocation } from 'react-router-dom';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { CartContext } from '../context/CartContext.jsx';
import MobileNav from './MobileNav.jsx';
import SearchBar from './SearchBar.jsx';
import api from '../api/client';
import LogoWallet from './LogoWallet.jsx';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const { items } = useContext(CartContext);
  const { pathname } = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [hideMobileNav, setHideMobileNav] = useState(false);
  const lastYRef = useRef(window.scrollY || 0);
  const tickingRef = useRef(false);
  const idleTimerRef = useRef(null);
  const touchLastYRef = useRef(null);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Ensure browser does not restore previous scroll on navigation
  useEffect(() => {
    try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch {}
  }, []);

  // Global: on any route change, jump to top before paint to avoid retaining scroll position
  useLayoutEffect(() => {
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // Fallback after layout
      requestAnimationFrame(() => {
        try {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        } catch {}
      });
    } catch {}
  }, [pathname]);

  // Hide/show mobile footer on scroll (down hides, up shows) with rAF + idle reveal
  useEffect(() => {
    const threshold = 2; // pixels to consider downward intent
    const onScroll = () => {
      if (window.innerWidth > 768) return; // only mobile (<=768px)
      const schedule = () => {
        if (tickingRef.current) return;
        tickingRef.current = true;
        requestAnimationFrame(() => {
          const y = window.scrollY || 0;
          const maxY = document.documentElement.scrollHeight - window.innerHeight;
          const delta = y - lastYRef.current;
          const goingDown = delta > threshold;
          const anyUp = delta < 0; // override: any upward movement shows footer
          lastYRef.current = y;

          // Always show only at extremes (top or bottom)
          if (y <= 0 || y >= maxY - 1) {
            setHideMobileNav(false);
          } else if (goingDown) {
            setHideMobileNav(true);
          } else if (anyUp) {
            setHideMobileNav(false);
          }

          // Auto-show after user stops scrolling for a moment
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          idleTimerRef.current = setTimeout(() => {
            setHideMobileNav(false);
          }, 8000);

          tickingRef.current = false;
        });
      };
      schedule();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Also handle touch gestures directly (useful when scrollY updates late with sticky headers/ribbon)
  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.innerWidth > 768) return;
      if (e.touches && e.touches.length) {
        touchLastYRef.current = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e) => {
      if (window.innerWidth > 768) return;
      if (!(e.touches && e.touches.length)) return;
      const y = e.touches[0].clientY;
      if (touchLastYRef.current == null) {
        touchLastYRef.current = y;
        return;
      }
      const delta = y - touchLastYRef.current; // positive when finger moves down (page tends to scroll up)
      touchLastYRef.current = y;
      // We want: page scrolling down => hide; page scrolling up => show.
      // Finger moving up (delta < 0) generally means page scrolls down.
      if (delta < -2) {
        setHideMobileNav(true);
      } else if (delta > 0) {
        setHideMobileNav(false);
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setHideMobileNav(false), 8000);
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);
  useEffect(() => {
    let timer;
    const loadPending = async () => {
      try {
        if (user && (user.role === 'admin' || user.role === 'admin2' || user.role === 'super_admin')) {
          const { data } = await api.get('/admin/vendors/pending-count');
          setPendingCount(data.count || 0);
        } else {
          setPendingCount(0);
        }
      } catch {}
    };
    loadPending();
    // refresh periodically while logged in as admin
    if (user && (user.role === 'admin' || user.role === 'admin2' || user.role === 'super_admin')) {
      timer = setInterval(loadPending, 30000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [user]);
  const cartCount = items.reduce((a, b) => a + b.quantity, 0);
  const displayName = (() => {
    if (!user) return null;
    const name = user.name && String(user.name).trim();
    const email = user.email && String(user.email).trim();
    // Heuristic: if name looks like a UUID, ignore it
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (name && !uuidLike.test(name)) return name;
    if (email) return email;
    return 'User';
  })();
  return (
    <div className={pathname === '/' ? 'home' : undefined}>
      <div className="header">
        <div className="header-inner container">
          {/* Desktop header */}
          <div className="brand desktop-only">
            <Link to="/" className="link" style={{ display:'inline-flex', alignItems:'center', gap:10, fontSize:20 }}>
              <LogoWallet size={32} />
              <span>NeoShop</span>
            </Link>
          </div>
          <nav className="nav desktop-only">
            <Link className="link" to="/" style={{ fontWeight: pathname==='/'?700:undefined, borderBottom: pathname==='/'?'2px solid var(--primary)': '2px solid transparent' }}>Home</Link>
            <Link className="link cart-link" to="/cart" style={{ fontWeight: pathname==='/cart'?700:undefined, borderBottom: pathname==='/cart'?'2px solid var(--primary)': '2px solid transparent' }}>Cart <span className="badge">{cartCount}</span></Link>
            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <Link className="link" to="/admin" style={{ fontWeight: pathname.startsWith('/admin')?700:undefined, borderBottom: pathname.startsWith('/admin')?'2px solid var(--primary)': '2px solid transparent', position:'relative' }}>
                Admin {pendingCount>0 && <span className="badge" style={{ marginLeft:6 }}>{pendingCount}</span>}
              </Link>
            )}
            {(user?.role === 'admin2' || user?.role === 'super_admin') && (
              <Link className="link" to="/admin2" style={{ fontWeight: pathname.startsWith('/admin2')?700:undefined, borderBottom: pathname.startsWith('/admin2')?'2px solid var(--primary)': '2px solid transparent', position:'relative' }}>
                Admin2 {pendingCount>0 && <span className="badge" style={{ marginLeft:6 }}>{pendingCount}</span>}
              </Link>
            )}
            {user?.role === 'super_admin' && (
              <Link className="link" to="/super-admin" style={{ fontWeight: pathname.startsWith('/super-admin')?700:undefined, borderBottom: pathname.startsWith('/super-admin')?'2px solid var(--primary)': '2px solid transparent', position:'relative' }}>
                Super Admin
              </Link>
            )}
            {user?.role === 'vendor' && <Link className="link" to="/vendor" style={{ fontWeight: pathname.startsWith('/vendor')?700:undefined, borderBottom: pathname.startsWith('/vendor')?'2px solid var(--primary)': '2px solid transparent' }}>Vendor</Link>}
            {user && <Link className="link" to="/profile" style={{ fontWeight: pathname.startsWith('/profile')?700:undefined, borderBottom: pathname.startsWith('/profile')?'2px solid var(--primary)': '2px solid transparent' }}>Profile</Link>}
          </nav>
          <div className="userbar desktop-only">
            <button 
              className="icon-btn" 
              aria-label="Toggle theme" 
              onClick={()=>setTheme(theme==='light'?'dark':'light')}
              title={theme==='light'?'Switch to dark mode':'Switch to light mode'}
            >
              {theme==='light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            {user ? (
              <>
                <span className="pill small">Hi, {displayName}</span>
                <button className="button ghost" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <Link className="button ghost" to="/login">Login</Link>
                <Link className="button" to="/register">Register</Link>
              </>
            )}
          </div>

          {/* Mobile top bar */}
          <div className="mobile-only mobile-topbar">
            <button className="icon-btn" aria-label="Menu" onClick={()=>setMobileMenuOpen(true)}>
              <div className="hamburger">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
            <div className="brand">
              <Link to="/" className="link" style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:18 }}>
                <LogoWallet size={20} />
                <span>NeoShop</span>
              </Link>
            </div>
            <div className="mobile-actions">
              <button 
                className="icon-btn theme" 
                aria-label="Toggle theme" 
                onClick={()=>setTheme(theme==='light'?'dark':'light')}
                title={theme==='light'?'Switch to dark mode':'Switch to light mode'}
              >
                {theme==='light' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
              <Link className="icon-btn" to={user ? (user.role === 'super_admin' ? '/super-admin' : (user.role === 'admin' ? '/admin' : (user.role === 'admin2' ? '/admin2' : (user.role === 'vendor' ? '/vendor' : '/')))) : '/login'} aria-label="Account">
                <span aria-hidden>👤</span>
              </Link>
              <Link className="icon-btn cart" to="/cart" aria-label="Cart">
                <span aria-hidden>🛒</span>
                {cartCount > 0 && <span className="badge sm">{cartCount}</span>}
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Page-specific search bars will render within pages (e.g., Home) */}

      {/* Mobile drawer menu */}
      {mobileMenuOpen && (
        <>
          <div className="backdrop" onClick={()=>setMobileMenuOpen(false)} />
          <aside className="mobile-drawer" role="dialog" aria-modal="true">
            <div className="drawer-header">
              <span className="brand" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <LogoWallet size={20} />
                NeoShop
              </span>
              <button className="icon-btn" aria-label="Close menu" onClick={()=>setMobileMenuOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {user && (
              <div className="drawer-user-greeting">
                <h3>Hello, {displayName}!</h3>
                <p>Welcome back to NeoShop</p>
              </div>
            )}
            <nav className="drawer-nav">
              <Link className="link" to="/" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname==='/'?700:undefined }}>Home</Link>
              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <Link className="link" to="/admin" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname.startsWith('/admin')?700:undefined }}>
                  Admin {pendingCount>0 && <span className="badge sm" style={{ marginLeft:6 }}>{pendingCount}</span>}
                </Link>
              )}
              {(user?.role === 'admin2' || user?.role === 'super_admin') && (
                <Link className="link" to="/admin2" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname.startsWith('/admin2')?700:undefined }}>
                  Admin2 {pendingCount>0 && <span className="badge sm" style={{ marginLeft:6 }}>{pendingCount}</span>}
                </Link>
              )}
              {user?.role === 'super_admin' && (
                <Link className="link" to="/super-admin" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname.startsWith('/super-admin')?700:undefined }}>
                  Super Admin
                </Link>
              )}
              {user?.role === 'vendor' && <Link className="link" to="/vendor" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname.startsWith('/vendor')?700:undefined }}>Vendor</Link>}
              {user && <Link className="link" to="/profile" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname.startsWith('/profile')?700:undefined }}>Profile</Link>}
              <Link className="link" to="/cart" onClick={()=>setMobileMenuOpen(false)} style={{ fontWeight: pathname==='/cart'?700:undefined }}>Cart</Link>
            </nav>
            <div className="drawer-actions">
              <button 
                className="button ghost" 
                onClick={()=>setTheme(theme==='light'?'dark':'light')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                {theme==='light' ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    <span>Dark mode</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    <span>Light mode</span>
                  </>
                )}
              </button>
              {user ? (
                <button className="button ghost" onClick={()=>{setMobileMenuOpen(false); logout();}}>Logout</button>
              ) : (
                <>
                  <Link className="button ghost" to="/login" onClick={()=>setMobileMenuOpen(false)}>Login</Link>
                  <Link className="button" to="/register" onClick={()=>setMobileMenuOpen(false)}>Register</Link>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      <main
        className={"container" + (pathname === '/' ? ' home-container' : '')}
        style={{ marginTop: pathname === '/' ? 0 : 16 }}
      >
        {children}
      </main>
      {/* Mobile bottom navigation */}
      <MobileNav hidden={hideMobileNav} />
    </div>
  );
}

