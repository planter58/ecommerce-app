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
import { notFound, errorHandler } from './middleware/errorHandler.js';
import path from 'path';
import profileRoutes from './routes/profile.routes.js';
import { query } from './config/db.js';

loadEnv();

const app = express();
// Allow loading images from this server on different origins (e.g., Vite dev server)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// CORS: allow configured origin and common localhost/127.0.0.1 dev origins
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN,
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);

// static uploads (enable CORS for image assets)
app.use('/uploads', cors({ origin: corsDevCheck, credentials: true }), express.static(path.join(process.cwd(), 'uploads')));

app.use(notFound);
app.use(errorHandler);

export default app;

// Best-effort bootstrap: promote admin@example.com to super_admin if user exists
(async () => {
  try {
    const email = 'admin@example.com';
    const { rows } = await query('SELECT id, role FROM users WHERE email=$1', [email]);
    if (rows[0] && rows[0].role !== 'super_admin') {
      await query('UPDATE users SET role=$2 WHERE id=$1', [rows[0].id, 'super_admin']);
      console.log('Promoted admin@example.com to super_admin');
    }
  } catch (e) {
    // ignore bootstrap errors
  }
})();
