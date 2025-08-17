import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { adminList, adminCreate, adminUpdate, adminEnable, adminReorder, adminDelete, adminUploadMedia, upload } from '../controllers/ribbon.controller.js';

const r = Router();

// Admin: list all
r.get('/', authRequired, requireRole('admin'), adminList);
// Create item (text-only initially; media uploaded via /:id/media)
r.post('/', authRequired, requireRole('admin'), adminCreate);
// Update fields
r.put('/:id', authRequired, requireRole('admin'), adminUpdate);
// Enable/disable
r.patch('/:id/enable', authRequired, requireRole('admin'), adminEnable);
// Reorder: body { items: [{id, position}, ...] }
r.patch('/reorder', authRequired, requireRole('admin'), adminReorder);
// Upload/replace media
r.post('/:id/media', authRequired, requireRole('admin'), upload, adminUploadMedia);
// Delete
r.delete('/:id', authRequired, requireRole('admin'), adminDelete);

export default r;
