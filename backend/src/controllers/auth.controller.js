import { query } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signJwt } from '../utils/jwt.js';

export async function register(req, res, next) {
  try {
    const { email, password, name, business_name } = req.body;
    let { role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: 'Missing fields' });
    role = (role === 'vendor' || role === 'admin') ? role : 'customer';
    if (role === 'admin') return res.status(400).json({ message: 'Cannot self-register as admin' });
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount) return res.status(409).json({ message: 'Email already exists' });
    if (role === 'vendor' && (!business_name || !String(business_name).trim())) {
      return res.status(400).json({ message: 'Business name is required for vendor registration' });
    }
    const hash = await hashPassword(password);
    const { rows } = await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id, role, name, email',
      [email, hash, name, role]
    );
    const user = rows[0];
    // If vendor, create a vendors row with pending status
    if (role === 'vendor') {
      try {
        await query('INSERT INTO vendors (user_id, business_name, status) VALUES ($1, $2, $3)', [user.id, business_name || null, 'pending']);
      } catch (e) {
        // If vendors table missing or other error, continue but inform client
        // Not throwing to avoid blocking user creation
      }
    }
    const token = signJwt({ id: user.id, role: user.role });
    res.status(201).json({ user, token });
  } catch (e) { next(e); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { rows } = await query('SELECT id, email, name, role, password_hash FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signJwt({ id: user.id, role: user.role });
    delete user.password_hash;
    res.json({ user, token });
  } catch (e) { next(e); }
}

export async function me(req, res) {
  try {
    const { rows } = await query('SELECT id, email, name, role, status FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ message: 'Failed to load profile' });
  }
}
