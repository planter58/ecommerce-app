import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { CartContext } from '../context/CartContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

export default function MobileNav({ hidden = false }) {
  const { items } = useContext(CartContext);
  const { user, logout } = useContext(AuthContext);
  const cartCount = items.reduce((a, b) => a + b.quantity, 0);

  const focusSearch = (e) => {
    e.preventDefault();
    const el = document.querySelector('.search-input');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
  };

  return (
    <nav className={`mobile-nav ${hidden ? 'hidden' : ''}`} aria-label="Primary">
      <Link className="item" to="/">
        <span className="icon" aria-hidden>🏠</span>
        <span className="label">Home</span>
      </Link>
      <button className="item" onClick={focusSearch} aria-label="Search">
        <span className="icon" aria-hidden>🔎</span>
        <span className="label">Search</span>
      </button>
      {(user?.role === 'vendor' || user?.role === 'admin' || user?.role === 'admin2' || user?.role === 'super_admin') && (
        <Link className="item" to={user.role === 'admin' ? '/admin' : (user.role === 'admin2' ? '/admin2' : (user.role === 'super_admin' ? '/super-admin' : '/vendor'))}>
          <span className="icon" aria-hidden>🧰</span>
          <span className="label">Dashboard</span>
        </Link>
      )}
      <Link className="item" to="/cart">
        <span className="icon" aria-hidden>🛒</span>
        <span className="label">Cart</span>
        {cartCount > 0 && <span className="badge sm">{cartCount}</span>}
      </Link>
      {user ? (
        <button className="item" onClick={logout} aria-label="Logout">
          <span className="icon" aria-hidden>🚪</span>
          <span className="label">Logout</span>
        </button>
      ) : (
        <Link className="item" to="/login">
          <span className="icon" aria-hidden>👤</span>
          <span className="label">Login</span>
        </Link>
      )}
    </nav>
  );
}
