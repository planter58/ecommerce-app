import api from './client';

export const fetchProductReviews = (productId) =>
  api.get(`/reviews/product/${productId}`).then(r => r.data);

export const addProductReview = (productId, { rating, comment }) =>
  api.post(`/reviews/product/${productId}`, { rating, comment }).then(r => r.data);
