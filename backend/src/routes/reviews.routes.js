import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import * as r from '../controllers/reviews.controller.js';

const router = Router({ mergeParams: true });

// GET product reviews
router.get('/product/:productId', r.listProductReviews);
// POST/UPSERT review for a product (auth required)
router.post('/product/:productId', authRequired, r.addProductReview);

export default router;
