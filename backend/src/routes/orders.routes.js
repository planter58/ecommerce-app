import { Router } from 'express';
import * as ctrl from '../controllers/orders.controller.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();
r.post('/', authRequired, ctrl.createOrderFromCart);
r.get('/me', authRequired, ctrl.listMyOrders);
r.get('/', authRequired, requireRole('admin'), ctrl.listAllOrders);
r.put('/:id/status', authRequired, requireRole('admin'), ctrl.updateOrderStatus);
export default r;
