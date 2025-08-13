import api from './client';

export const getMyVendor = () => api.get('/vendor/me').then(r => r.data);
export const updateMyVendor = (data) => api.put('/vendor/me', data).then(r => r.data);

export const listMyProducts = () => api.get('/vendor/products').then(r => r.data);
export const createMyProduct = (data) => api.post('/vendor/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const updateMyProduct = (id, data) => api.put(`/vendor/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const deleteMyProduct = (id) => api.delete(`/vendor/products/${id}`).then(r => r.data);

export const listMyOrderItems = () => api.get('/vendor/orders').then(r => r.data);
export const markItemShipped = (id, payload) => api.put(`/vendor/order-items/${id}/ship`, payload).then(r => r.data);
export const handleReturn = (id, payload) => api.put(`/vendor/order-items/${id}/return`, payload).then(r => r.data);
