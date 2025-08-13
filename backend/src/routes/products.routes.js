import { Router } from 'express';
import * as ctrl from '../controllers/products.controller.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { upload } from '../middleware/upload.js';

const r = Router();

r.get('/', ctrl.listProducts);
r.get('/:id', ctrl.getProduct);

r.post('/', authRequired, requireRole('admin'), upload.array('images', 8), ctrl.createProduct);
r.put('/:id', authRequired, requireRole('admin'), upload.array('images', 8), ctrl.updateProduct);
r.delete('/:id', authRequired, requireRole('admin'), ctrl.deleteProduct);

export default r;
