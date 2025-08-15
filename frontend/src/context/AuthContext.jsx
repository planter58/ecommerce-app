import { createContext, useEffect, useState } from 'react';
import { me } from '../api/auth';

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    me()
      .then(d => { setUser(d.user); localStorage.setItem('user', JSON.stringify(d.user)); })
      .catch(() => { setUser(null); localStorage.removeItem('user'); localStorage.removeItem('token'); })
      .finally(() => setLoading(false));
  }, []);
  const login = (u, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    // Merge guest cart into the authenticated cart, then refresh
    try { window.dispatchEvent(new Event('cart:merge')); } catch {}
    try { window.dispatchEvent(new Event('cart:refresh')); } catch {}
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    // Clear any in-memory and guest cart to prevent carry-over to next account
    try { window.dispatchEvent(new Event('cart:clear')); } catch {}
  };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
