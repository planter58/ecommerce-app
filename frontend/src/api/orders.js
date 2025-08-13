import api from './client';
export const createOrder = (payload) => api.post('/orders', payload).then(r => r.data);
export const myOrders = () => api.get('/orders/me').then(r => r.data);
