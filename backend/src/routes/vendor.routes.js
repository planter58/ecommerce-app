import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { upload } from '../middleware/upload.js';
import * as v from '../controllers/vendor.controller.js';

const r = Router();

// vendor profile
r.get('/me', authRequired, requireRole('vendor','admin','super_admin'), v.getMyVendor);
r.put('/me', authRequired, requireRole('vendor','admin','super_admin'), v.updateMyVendor);

// products
r.get('/products', authRequired, requireRole('vendor','admin','super_admin'), v.listMyProducts);
r.post('/products', authRequired, requireRole('vendor','admin','super_admin'), upload.array('images', 8), v.createMyProduct);
r.put('/products/:id', authRequired, requireRole('vendor','admin','super_admin'), upload.array('images', 8), v.updateMyProduct);
r.delete('/products/:id', authRequired, requireRole('vendor','admin','super_admin'), v.deleteMyProduct);

// orders
r.get('/orders', authRequired, requireRole('vendor','admin','super_admin'), v.listMyOrderItems);
r.put('/order-items/:id/ship', authRequired, requireRole('vendor','admin','super_admin'), v.markItemShipped);
r.put('/order-items/:id/return', authRequired, requireRole('vendor','admin','super_admin'), v.handleReturn);

export default r;
