import api from './client';
export const fetchProducts = (params) => api.get('/products', { params }).then(r => r.data);
export const fetchProduct = (id) => api.get(`/products/${id}`).then(r => r.data);
export const fetchFeaturedProducts = () => api.get('/products/featured').then(r => r.data);
