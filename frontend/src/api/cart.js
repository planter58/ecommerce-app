import api from './client';
export const getCart = () => api.get('/cart').then(r => r.data);
export const addToCart = (payload) => api.post('/cart/items', payload).then(r => r.data);
export const updateQty = (productId, quantity) => api.put(`/cart/items/${productId}`, { quantity }).then(r => r.data);
export const removeFromCart = (productId) => api.delete(`/cart/items/${productId}`).then(r => r.data);
