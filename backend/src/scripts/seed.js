import { loadEnv } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

loadEnv();

async function upsertUser(email, name, password, role) {
  const { rows } = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (rows[0]) {
    await query('UPDATE users SET role=$2, name=$3, updated_at=NOW() WHERE id=$1', [rows[0].id, role, name]);
    return rows[0].id;
  }
  const hash = await hashPassword(password);
  const ins = await query(
    'INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id',
    [email, hash, name, role]
  );
  return ins.rows[0].id;
}

async function upsertCategory(name, slug) {
  const { rows } = await query('SELECT id FROM categories WHERE slug=$1', [slug]);
  if (rows[0]) return rows[0].id;
  const ins = await query('INSERT INTO categories (name, slug) VALUES ($1,$2) RETURNING id', [name, slug]);
  return ins.rows[0].id;
}

async function upsertVendor(userId, businessName) {
  const { rows } = await query('SELECT id FROM vendors WHERE user_id=$1', [userId]);
  if (rows[0]) return rows[0].id;
  const ins = await query('INSERT INTO vendors (user_id, business_name) VALUES ($1,$2) RETURNING id', [userId, businessName]);
  return ins.rows[0].id;
}

async function upsertProduct(title, categoryId, vendorId) {
  const { rows } = await query('SELECT id FROM products WHERE title=$1', [title]);
  if (rows[0]) return rows[0].id;
  const ins = await query(
    `INSERT INTO products (title, description, price_cents, currency, stock, category_id, image_url, vendor_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      title,
      'A great sample product to test the storefront.',
      129999,
      'kes',
      25,
      categoryId,
      'https://via.placeholder.com/600x400.png?text=Sample+Product',
      vendorId
    ]
  );
  return ins.rows[0].id;
}

async function run() {
  try {
    const result = await withTransaction(async () => {
      const adminId = await upsertUser('admin@example.com', 'Admin', 'Admin@123', 'admin');
      const vendorUserId = await upsertUser('vendor@example.com', 'Vendor', 'Vendor@123', 'vendor');
      const vendorId = await upsertVendor(vendorUserId, 'Acme Supplies');
      const categoryId = await upsertCategory('Electronics', 'electronics');
      const productId = await upsertProduct('Sample Phone X', categoryId, vendorId);
      return { adminId, vendorUserId, vendorId, categoryId, productId };
    });
    console.log('Seed complete:', result);
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e);
    process.exit(1);
  }
}

run();
