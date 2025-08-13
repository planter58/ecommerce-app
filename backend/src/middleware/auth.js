import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Load latest role/status in case they changed after token issuance
    const { rows } = await query('SELECT id, email, name, role, status FROM users WHERE id=$1', [payload.id]);
    const u = rows[0];
    if (!u) return res.status(401).json({ message: 'User not found' });
    if (u.status && u.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended', status: u.status });
    }
    req.user = { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status };
    next();
  } catch (e) {
    // Safe debug output to help diagnose 401s in production without leaking secrets
    try {
      const debug = process.env.DEBUG_AUTH === 'true';
      if (debug) {
        console.warn('[authRequired] JWT verify failed', {
          path: req.path,
          method: req.method,
          origin: req.headers.origin,
          error: e?.name || 'Error',
          message: e?.message || 'verify failed',
        });
      }
    } catch {}
    res.status(401).json({ message: 'Invalid token' });
  }
}
