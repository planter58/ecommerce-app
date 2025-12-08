import { query } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';

export async function getProfile(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, email, name, role, phone, location, street_address, delivery_preference, bio, avatar_url, extras
       FROM users WHERE id=$1`, [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function updateProfile(req, res, next) {
  try {
    const { name, phone, location, street_address, delivery_preference, bio, avatar_url, extras } = req.body;
    const { rows } = await query(
      `UPDATE users SET
         name=COALESCE($2,name),
         phone=COALESCE($3,phone),
         location=COALESCE($4,location),
         street_address=COALESCE($5,street_address),
         delivery_preference=COALESCE($6,delivery_preference),
         bio=COALESCE($7,bio),
         avatar_url=COALESCE($8,avatar_url),
         extras=COALESCE($9,extras),
         updated_at=NOW()
       WHERE id=$1
       RETURNING id, email, name, role, phone, location, street_address, delivery_preference, bio, avatar_url, extras`,
      [req.user.id, name, phone, location, street_address, delivery_preference, bio, avatar_url, extras]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password) return res.status(400).json({ message: 'New password required' });
    const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    if (current_password) {
      const ok = await comparePassword(current_password, rows[0].password_hash);
      if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    }
    const hash = await hashPassword(new_password);
    await query('UPDATE users SET password_hash=$2, updated_at=NOW() WHERE id=$1', [req.user.id, hash]);
    res.json({ ok: true });
  } catch (e) { next(e); }
}
