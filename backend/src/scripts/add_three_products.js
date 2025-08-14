import { loadEnv } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';

loadEnv();

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function ensureCategoryByName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const { rows: exist } = await query('SELECT id FROM categories WHERE LOWER(name)=LOWER($1) LIMIT 1', [trimmed]);
  if (exist[0]) return exist[0].id;
  const baseSlug = slugify(trimmed);
  let slug = baseSlug || `cat-${Date.now()}`;
  let attempt = 1;
  while (true) {
    const { rows: s } = await query('SELECT 1 FROM categories WHERE slug=$1 LIMIT 1', [slug]);
    if (!s[0]) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  const { rows } = await query('INSERT INTO categories (name, slug) VALUES ($1,$2) RETURNING id', [trimmed, slug]);
  return rows[0]?.id || null;
}

async function addProduct({ title, description, price_ksh, stock, categoryName, images }) {
  const price_cents = Math.round(Number(price_ksh) * 100);
  const category_id = await ensureCategoryByName(categoryName);
  const image_url = images[0];
  const { rows } = await query(
    `INSERT INTO products (title, description, price_cents, currency, stock, category_id, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [title, description, price_cents, 'kes', stock, category_id, image_url]
  );
  const pid = rows[0].id;
  try {
    for (let idx = 0; idx < images.length; idx++) {
      await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [pid, images[idx], idx]);
    }
  } catch {}
  return pid;
}

async function run() {
  try {
    const result = await withTransaction(async () => {
      const ids = [];
      ids.push(await addProduct({
        title: 'Samsung Galaxy A15',
        description: 'A15 with long battery life, vibrant AMOLED display, and dual cameras — great value daily driver.',
        price_ksh: 18999,
        stock: 20,
        categoryName: 'Electronics',
        images: [
          'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
          'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5'
        ]
      }));
      ids.push(await addProduct({
        title: 'Nonstick Pan 28cm',
        description: 'Durable nonstick surface, even heat distribution, and easy cleanup for everyday cooking.',
        price_ksh: 3200,
        stock: 35,
        categoryName: 'Kitchenware',
        images: [
          'https://images.unsplash.com/photo-1519681393784-d120267933ba',
          'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0'
        ]
      }));
      ids.push(await addProduct({
        title: 'Yoga Mat Pro 6mm',
        description: 'High-density mat with grippy surface for comfortable home and studio practice.',
        price_ksh: 2900,
        stock: 40,
        categoryName: 'Sports',
        images: [
          'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
          'https://images.unsplash.com/photo-1552196563-55cd4e45efb3'
        ]
      }));
      return ids;
    });
    console.log('Inserted product IDs:', result.join(', '));
    process.exit(0);
  } catch (e) {
    console.error('Add three products failed:', e);
    process.exit(1);
  }
}

run();
