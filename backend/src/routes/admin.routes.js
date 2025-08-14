import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { listVendors, updateVendorStatus, pendingVendorCount, promoteUserRole, listAdmins, createAdmin, updateAdminStatus, deleteAdmin, updateAdminProfile, demoteAdminRole, bulkAdminsAction, getFeaturedProductsAdmin, setFeaturedProducts } from '../controllers/admin.controller.js';
import { suggestFeaturedProducts } from '../controllers/products.controller.js';

const r = Router();

r.get('/vendors', authRequired, requireRole('admin'), listVendors);
r.put('/vendors/:id/status', authRequired, requireRole('admin'), updateVendorStatus);
// pending vendors count badge
r.get('/vendors/pending-count', authRequired, requireRole('admin'), pendingVendorCount);
// super admin only: promote a user to admin
r.put('/users/:id/role', authRequired, requireRole('super_admin'), promoteUserRole);

// super admin: manage admins
r.get('/admins', authRequired, requireRole('super_admin'), listAdmins);
r.post('/admins', authRequired, requireRole('super_admin'), createAdmin);
r.put('/admins/:id/status', authRequired, requireRole('super_admin'), updateAdminStatus);
r.put('/admins/:id/profile', authRequired, requireRole('super_admin'), updateAdminProfile);
r.delete('/admins/:id', authRequired, requireRole('super_admin'), deleteAdmin);
r.put('/admins/:id/demote', authRequired, requireRole('super_admin'), demoteAdminRole);
r.post('/admins/bulk', authRequired, requireRole('super_admin'), bulkAdminsAction);

// super admin: featured products management (homepage order 1..30)
r.get('/featured', authRequired, requireRole('super_admin'), getFeaturedProductsAdmin);
r.put('/featured', authRequired, requireRole('super_admin'), setFeaturedProducts);
r.get('/featured/suggest', authRequired, requireRole('super_admin'), suggestFeaturedProducts);

export default r;
