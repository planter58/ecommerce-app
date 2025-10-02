import { createContext, useEffect, useState } from 'react';
import { getCart, addToCart as apiAdd, updateQty as apiUpdate, removeFromCart as apiRemove } from '../api/cart';

export const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const token = () => localStorage.getItem('token');

  // Guest cart helpers
  const readGuest = () => {
    try { return JSON.parse(localStorage.getItem('guest_cart') || '[]'); } catch { return []; }
  };
  const writeGuest = (arr) => localStorage.setItem('guest_cart', JSON.stringify(arr));
  const refresh = () => {
    if (token()) {
      return getCart().then(d => setItems(d.items)).catch(() => setItems([]));
    } else {
      setItems(readGuest());
      return Promise.resolve();
    }
  };
  useEffect(() => { refresh(); }, []);

  // React to auth changes: login/logout triggers cart merge/refresh/clear
  useEffect(() => {
    const onRefresh = () => { refresh(); };
    const onMerge = () => { mergeGuestToServer(); };
    const onClear = () => { setItems([]); try { localStorage.removeItem('guest_cart'); } catch {} };
    try {
      window.addEventListener('cart:refresh', onRefresh);
      window.addEventListener('cart:merge', onMerge);
      window.addEventListener('cart:clear', onClear);
    } catch {}
    return () => {
      try {
        window.removeEventListener('cart:refresh', onRefresh);
        window.removeEventListener('cart:merge', onMerge);
        window.removeEventListener('cart:clear', onClear);
      } catch {}
    };
  }, []);

  const addToCart = async (payload) => {
    if (token()) {
      await apiAdd(payload); await refresh();
    } else {
      const { product_id, quantity = 1, product } = payload;
      if (!product) return; // require product info for guest cart
      const current = readGuest();
      const idx = current.findIndex(i => i.product_id === product_id);
      if (idx >= 0) current[idx].quantity += quantity; else current.push({
        product_id,
        quantity,
        title: product.title,
        price_cents: product.price_cents,
        image_url: product.image_url
      });
      writeGuest(current);
      setItems(current);
    }
  };
  const updateQty = async (productId, quantity) => {
    if (token()) {
      // Optimistic update: update UI immediately
      const prev = items;
      const next = prev.map(i => i.product_id === productId ? { ...i, quantity } : i);
      setItems(next);
      try {
        await apiUpdate(productId, quantity);
        // Sync from server to ensure authoritative totals/validations
        await refresh();
      } catch (e) {
        // Rollback on failure
        setItems(prev);
      }
    } else {
      const current = readGuest();
      const idx = current.findIndex(i => i.product_id === productId);
      if (idx >= 0) { current[idx].quantity = quantity; writeGuest(current); setItems(current); }
    }
  };
  const removeFromCart = async (productId) => {
    if (token()) {
      await apiRemove(productId); await refresh();
    } else {
      const next = readGuest().filter(i => i.product_id !== productId);
      writeGuest(next); setItems(next);
    }
  };

  const mergeGuestToServer = async () => {
    if (!token()) return;
    const guest = readGuest();
    if (guest.length === 0) return;
    for (const g of guest) {
      await apiAdd({ product_id: g.product_id, quantity: g.quantity });
    }
    localStorage.removeItem('guest_cart');
    await refresh();
  };

  return (
    <CartContext.Provider value={{ items, refresh, addToCart, updateQty, removeFromCart, mergeGuestToServer }}>
      {children}
    </CartContext.Provider>
  );
}
