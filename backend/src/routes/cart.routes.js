import { Router } from 'express';
import * as ctrl from '../controllers/cart.controller.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();
r.get('/', authRequired, ctrl.getCart);
r.post('/items', authRequired, ctrl.addToCart);
r.put('/items/:productId', authRequired, ctrl.updateQty);
r.delete('/items/:productId', authRequired, ctrl.removeFromCart);
export default r;
