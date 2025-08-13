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
    res.status(401).json({ message: 'Invalid token' });
  }
}
