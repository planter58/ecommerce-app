import api from './client';
export const createPaymentIntent = (order_id) => api.post('/payments/create-payment-intent', { order_id }).then(r => r.data);
export const initiateMpesaStk = (order_id, phone) => api.post('/payments/mpesa/stk', { order_id, phone }).then(r => r.data);
