import { Router } from 'express';
import * as ctrl from '../controllers/categories.controller.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();
r.get('/', authRequired, requireRole('admin','admin2','super_admin'), ctrl.listCategories);
r.post('/', authRequired, requireRole('admin','admin2','super_admin'), ctrl.createCategory);
r.put('/:id', authRequired, requireRole('admin','admin2','super_admin'), ctrl.updateCategory);
r.delete('/:id', authRequired, requireRole('admin','admin2','super_admin'), ctrl.deleteCategory);
export default r;
