import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { loadEnv } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import cartRoutes from './routes/cart.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import adminRoutes from './routes/admin.routes.js';
import ribbonRoutes from './routes/ribbon.routes.js';
import ribbonAdminRoutes from './routes/ribbon.admin.routes.js';
import pesapalRoutes from './routes/pesapal.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import path from 'path';
import profileRoutes from './routes/profile.routes.js';
import { query } from './config/db.js';

loadEnv();

const app = express();
// Allow loading images-z from this server on different origins (e.g., Vite dev server)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// CORS: allow configured origin and common localhost/127.0.0.1 dev origins
// Normalize CLIENT_ORIGIN to avoid trailing-slash mismatches
const clientOriginRaw = process.env.CLIENT_ORIGIN || '';
const clientOrigin = clientOriginRaw ? clientOriginRaw.replace(/\/+$/, '') : '';
const allowedOrigins = new Set([
  clientOrigin || undefined,
  clientOrigin ? `${clientOrigin}/` : undefined,
  process.env.CLIENT_ORIGIN, // keep original as-is just in case
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean));
const corsDevCheck = (origin, callback) => {
  if (!origin) return callback(null, true); // allow non-browser or same-origin
  try {
    const u = new URL(origin);
    const isLocalhost = (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    if (allowedOrigins.has(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
      return callback(null, true);
    }
  } catch {}
  return callback(null, false);
};
app.use(cors({ origin: corsDevCheck, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Root route: API info
app.get('/', (_req, res) => {
  res.json({
    name: 'E-Commerce API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      categories: '/api/categories',
      cart: '/api/cart',
      orders: '/api/orders',
      payments: '/api/payments',
      vendor: '/api/vendor',
      reviews: '/api/reviews',
      admin: '/api/admin',
      profile: '/api/profile',
      ribbon: '/api/ribbon'
    },
    documentation: 'https://github.com/yourusername/ecommerce-app'
  });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
// Health check without /api prefix for monitoring services
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/pesapal', pesapalRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
// Ribbon routes: public and admin
app.use('/api/ribbon', ribbonRoutes);
app.use('/api/admin/ribbon', ribbonAdminRoutes);

// static uploads (enable CORS for image assets)
app.use('/uploads', cors({ origin: corsDevCheck, credentials: true }), express.static(path.join(process.cwd(), 'uploads')));

app.use(notFound);
app.use(errorHandler);

export default app;

// Best-effort bootstrap: create/update super admin users
import { hashPassword } from './utils/password.js';
(async () => {
  try {
    // Add/update johnsonmbuguamuhabi@gmail.com as super_admin
    const email1 = 'johnsonmbuguamuhabi@gmail.com';
    const password1 = 'Admin@0010';
    const { rows: rows1 } = await query('SELECT id, role FROM users WHERE email=$1', [email1]);
    if (rows1[0]) {
      // User exists, update password and role
      const hash = await hashPassword(password1);
      await query('UPDATE users SET password_hash=$1, role=$2, updated_at=NOW() WHERE id=$3', 
        [hash, 'super_admin', rows1[0].id]);
      console.log('Updated johnsonmbuguamuhabi@gmail.com to super_admin');
    } else {
      // Create new user
      const hash = await hashPassword(password1);
      await query('INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)', 
        [email1, hash, 'Super Admin', 'super_admin']);
      console.log('Created super_admin: johnsonmbuguamuhabi@gmail.com');
    }

    // Keep existing admin@example.com promotion logic
    const email2 = 'admin@example.com';
    const { rows: rows2 } = await query('SELECT id, role FROM users WHERE email=$1', [email2]);
    if (rows2[0] && rows2[0].role !== 'super_admin') {
      await query('UPDATE users SET role=$2 WHERE id=$1', [rows2[0].id, 'super_admin']);
      console.log('Promoted admin@example.com to super_admin');
    }
  } catch (e) {
    // ignore bootstrap errors
    console.error('Bootstrap error:', e.message);
  }
})();
