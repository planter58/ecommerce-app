import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  // Step 1: Verify JWT signature/claims
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
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
    return res.status(401).json({ message: 'Invalid token' });
  }

  // Step 2: Load user from DB; treat DB errors separately
  try {
    const { rows } = await query('SELECT id, email, name, role, status FROM users WHERE id=$1', [payload.id]);
    const u = rows[0];
    if (!u) return res.status(401).json({ message: 'User not found' });
    if (u.status && u.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended', status: u.status });
    }
    req.user = { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status };
    next();
  } catch (e) {
    try {
      const debug = process.env.DEBUG_AUTH === 'true';
      if (debug) {
        console.error('[authRequired] DB lookup failed', {
          path: req.path,
          method: req.method,
          origin: req.headers.origin,
          error: e?.name || 'Error',
          message: e?.message || 'db error',
        });
      }
    } catch {}
    res.status(500).json({ message: 'Authentication lookup failed' });
  }
}
