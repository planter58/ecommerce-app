import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { adminList, adminCreate, adminUpdate, adminEnable, adminReorder, adminDelete, adminUploadMedia, upload } from '../controllers/ribbon.controller.js';

const r = Router();

// Admin, Admin2 & Super Admin: list all
r.get('/', authRequired, requireRole('admin','admin2','super_admin'), adminList);
// Create item (text-only initially; media uploaded via /:id/media)
r.post('/', authRequired, requireRole('admin','admin2','super_admin'), adminCreate);
// Update fields
r.put('/:id', authRequired, requireRole('admin','admin2','super_admin'), adminUpdate);
// Enable/disable
r.patch('/:id/enable', authRequired, requireRole('admin','admin2','super_admin'), adminEnable);
// Reorder: body { items: [{id, position}, ...] }
r.patch('/reorder', authRequired, requireRole('admin','admin2','super_admin'), adminReorder);
// Upload/replace media
r.post('/:id/media', authRequired, requireRole('admin','admin2','super_admin'), upload, adminUploadMedia);
// Delete
r.delete('/:id', authRequired, requireRole('admin','admin2','super_admin'), adminDelete);

export default r;
