import { query } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

export async function listVendors(req, res, next) {
  try {
    const { q, status } = req.query;
    const params = [];
    const whereParts = [];
    let i = 1;
    if (q && q.trim()) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      whereParts.push(`(v.business_name ILIKE $${i} OR u.name ILIKE $${i+1} OR u.email ILIKE $${i+2})`);
      i += 3;
    }

    if (status && ['pending','approved','suspended'].includes(status)) {
      params.push(status);
      whereParts.push(`v.status = $${i}`);
      i += 1;
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT v.*, u.name AS user_name, u.email AS user_email,
              COALESCE(pcnt.count, 0)::int AS product_count
       FROM vendors v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN (
         SELECT vendor_id, COUNT(*) AS count FROM products GROUP BY vendor_id
       ) pcnt ON pcnt.vendor_id = v.id
       ${where}
       ORDER BY v.created_at DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
}

export async function demoteAdminRole(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: u } = await query('SELECT id, role FROM users WHERE id=$1', [id]);
    const user = u[0];
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'super_admin') return res.status(400).json({ message: 'Cannot modify super_admin' });
    if (user.role !== 'admin') return res.status(400).json({ message: 'User is not an admin' });
    const { rows } = await query('UPDATE users SET role=$2, was_admin=true, updated_at=NOW() WHERE id=$1 RETURNING id, email, name, role, status, was_admin', [id, 'customer']);
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function bulkAdminsAction(req, res, next) {
  try {
    const { action, ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: 'ids required' });
    const allowed = new Set(['activate','suspend','delete','demote']);
    if (!allowed.has(action)) return res.status(400).json({ message: 'Invalid action' });
    const results = [];
    for (const id of ids) {
      if (String(id) === String(req.user.id)) { results.push({ id, ok:false, error:'cannot-act-on-self' }); continue; }
      const { rows: u } = await query('SELECT id, role FROM users WHERE id=$1', [id]);
      const user = u[0];
      if (!user) { results.push({ id, ok:false, error:'not-found' }); continue; }
      if (user.role === 'super_admin') { results.push({ id, ok:false, error:'cannot-modify-super-admin' }); continue; }
      try {
        if (action === 'activate') {
          await query('UPDATE users SET status=$2, updated_at=NOW() WHERE id=$1', [id, 'active']);
        } else if (action === 'suspend') {
          await query('UPDATE users SET status=$2, updated_at=NOW() WHERE id=$1', [id, 'suspended']);
        } else if (action === 'delete') {
          if (user.role !== 'admin') throw new Error('not-admin');
          await query('DELETE FROM users WHERE id=$1', [id]);
        } else if (action === 'demote') {
          if (user.role !== 'admin') throw new Error('not-admin');
          await query('UPDATE users SET role=$2 WHERE id=$1', [id, 'customer']);
        }
        results.push({ id, ok:true });
      } catch (err) {
        results.push({ id, ok:false, error: err.message || 'error' });
      }
    }
    res.json({ results });
  } catch (e) { next(e); }
}

export async function updateVendorStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending','approved','suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const { rows } = await query('UPDATE vendors SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [status, id]);
    if (!rows[0]) return res.status(404).json({ message: 'Vendor not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function pendingVendorCount(req, res, next) {
  try {
    const { rows } = await query("SELECT COUNT(*)::int AS count FROM vendors WHERE status='pending'");
    res.json({ count: rows[0]?.count || 0 });
  } catch (e) { next(e); }
}

// ===== Super Admin: Admins management =====
// Only super_admin can promote a user to admin
export async function promoteUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (req.user.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' });
    if (role !== 'admin') return res.status(400).json({ message: 'Invalid role' });
    // Prevent promoting another admin or super_admin change here
    const { rows: u } = await query('SELECT id, role FROM users WHERE id=$1', [id]);
    if (!u[0]) return res.status(404).json({ message: 'User not found' });
    if (u[0].role === 'super_admin') return res.status(400).json({ message: 'Cannot modify super_admin' });
    const { rows } = await query('UPDATE users SET role=$2, was_admin=true, updated_at=NOW() WHERE id=$1 RETURNING id, email, name, role, status, was_admin', [id, 'admin']);
    res.json(rows[0]);
  } catch (e) { next(e); }
}

// ===== Super Admin: Admins management =====
export async function listAdmins(req, res, next) {
  try {
    const { q, status } = req.query;
    const params = [];
    const where = [];
    let i = 1;
    // Include current admins and any user who was ever an admin
    where.push(`(role='admin' OR was_admin=true)`);
    if (q && q.trim()) {
      params.push(`%${q}%`, `%${q}%`);
      where.push(`(email ILIKE $${i} OR name ILIKE $${i+1})`); i += 2;
    }
    if (status && ['active','suspended'].includes(status)) { params.push(status); where.push(`status=$${i}`); i++; }
    const sql = `SELECT id, email, name, role, status, phone, location, street_address, delivery_preference, bio, avatar_url, was_admin
                 FROM users ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY created_at DESC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
}

export async function createAdmin(req, res, next) {
  try {
    const { email, name, password, confirm_password } = req.body;
    if (!email) return res.status(400).json({ message: 'email is required' });
    if (password && password !== confirm_password) return res.status(400).json({ message: 'Passwords do not match' });
    const { rows: existingRows } = await query('SELECT id, role FROM users WHERE email=$1', [email]);
    const existing = existingRows[0];
    // If user exists: promote to admin; update password if provided
    if (existing) {
      if (existing.role === 'super_admin') return res.status(400).json({ message: 'Cannot modify super_admin' });
      if (existing.role === 'admin' ) return res.status(400).json({ message: 'User is already an admin' });
      if (password) {
        const hash = await hashPassword(password);
        const { rows } = await query(
          `UPDATE users SET role='admin', was_admin=true, password_hash=$2, name=COALESCE($3,name), status='active', updated_at=NOW()
           WHERE id=$1 RETURNING id, email, name, role, status, was_admin`, [existing.id, hash, name || null]
        );
        return res.status(200).json(rows[0]);
      } else {
        const { rows } = await query(
          `UPDATE users SET role='admin', was_admin=true, name=COALESCE($2,name), status='active', updated_at=NOW()
           WHERE id=$1 RETURNING id, email, name, role, status, was_admin`, [existing.id, name || null]
        );
        return res.status(200).json(rows[0]);
      }
    }
    // If user does not exist: require password and create new admin
    if (!password) return res.status(400).json({ message: 'password is required for new admin' });
    if (password !== confirm_password) return res.status(400).json({ message: 'Passwords do not match' });
    const hash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, name, password_hash, role, status, was_admin)
       VALUES ($1,$2,$3,'admin','active',true)
       RETURNING id, email, name, role, status, was_admin`, [email, name || null, hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

export async function updateAdminStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' | 'suspended'
    if (!['active','suspended'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const { rows: u } = await query('SELECT role FROM users WHERE id=$1', [id]);
    if (!u[0]) return res.status(404).json({ message: 'User not found' });
    if (u[0].role === 'super_admin') return res.status(400).json({ message: 'Cannot modify super_admin' });
    const { rows } = await query('UPDATE users SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING id, email, name, role, status', [id, status]);
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function deleteAdmin(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ message: 'Cannot delete yourself' });
    const { rows: u } = await query('SELECT role FROM users WHERE id=$1', [id]);
    if (!u[0]) return res.status(404).json({ message: 'User not found' });
    if (u[0].role !== 'admin') return res.status(400).json({ message: 'Not an admin account' });
    await query('DELETE FROM users WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function updateAdminProfile(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, location, street_address, delivery_preference, bio, avatar_url } = req.body;
    const { rows: u } = await query('SELECT role FROM users WHERE id=$1', [id]);
    if (!u[0]) return res.status(404).json({ message: 'User not found' });
    if (u[0].role !== 'admin') return res.status(400).json({ message: 'Not an admin account' });
    const { rows } = await query(
      `UPDATE users SET
         name=COALESCE($2,name), phone=COALESCE($3,phone), location=COALESCE($4,location),
         street_address=COALESCE($5,street_address), delivery_preference=COALESCE($6,delivery_preference),
         bio=COALESCE($7,bio), avatar_url=COALESCE($8,avatar_url), updated_at=NOW()
       WHERE id=$1
       RETURNING id, email, name, role, status, phone, location, street_address, delivery_preference, bio, avatar_url`,
      [id, name, phone, location, street_address, delivery_preference, bio, avatar_url]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
}
