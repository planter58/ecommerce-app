import { query } from '../config/db.js';

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
  // Try find existing by name (case-insensitive)
  const { rows: exist } = await query('SELECT id FROM categories WHERE LOWER(name)=LOWER($1) LIMIT 1', [trimmed]);
  if (exist[0]) return exist[0].id;
  // Insert new
  const baseSlug = slugify(trimmed);
  let slug = baseSlug || `cat-${Date.now()}`;
  // ensure slug unique (basic attempt)
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
import { parsePagination } from '../utils/pagination.js';

export async function listProducts(req, res, next) {
  try {
    const { q, category, vendor_id, exclude_id } = req.query;
    const { limit, offset, page } = parsePagination(req.query);

    const where = [];
    const params = [];
    let i = 1;

    if (q) {
      where.push(`(p.title ILIKE $${i} OR p.description ILIKE $${i})`);
      params.push(`%${q}%`); i++;
    }
    if (category) {
      where.push(`c.slug = $${i}`); params.push(category); i++;
    }
    if (vendor_id) {
      where.push(`p.vendor_id = $${i}`); params.push(vendor_id); i++;
    }
    if (exclude_id) {
      where.push(`p.id <> $${i}`); params.push(exclude_id); i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ${whereSql}
    `;
    const dataSql = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug,
             v.business_name AS vendor_name,
             COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating,
             COUNT(r.id)::int AS rating_count,
             COALESCE(
               (
                 SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url, 'position', pi.position) ORDER BY pi.position ASC)
                 FROM product_images pi WHERE pi.product_id = p.id
               ), '[]'::json
             ) AS images
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN vendors v ON v.id = p.vendor_id
      LEFT JOIN reviews r ON r.product_id = p.id
      ${whereSql}
      GROUP BY p.id, c.name, c.slug, v.business_name
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ rows: countRows }, { rows }] = await Promise.all([query(countSql, params), query(dataSql, params)]);
    res.json({ items: rows, page, limit, total: countRows[0].count });
  } catch (e) { next(e); }
}

export async function getProduct(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              v.business_name AS vendor_name,
              COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating,
              COUNT(r.id)::int AS rating_count,
              COALESCE(
                (
                  SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url, 'position', pi.position) ORDER BY pi.position ASC)
                  FROM product_images pi WHERE pi.product_id = p.id
                ), '[]'::json
              ) AS images
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN reviews r ON r.product_id = p.id
       WHERE p.id=$1
       GROUP BY p.id, c.name, c.slug, v.business_name`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function createProduct(req, res, next) {
  try {
    const { title, description, price_cents, currency='kes', stock=0, category_id, category_name, compare_at_price_cents } = req.body;
    const files = (req.files && Array.isArray(req.files) && req.files.length) ? req.files : (req.file ? [req.file] : []);
    const mainUrl = files[0] ? `/uploads/${files[0].filename}` : (req.body.image_url || null);
    let finalCategoryId = category_id || null;
    if (!finalCategoryId && category_name) {
      finalCategoryId = await ensureCategoryByName(category_name);
    }
    const { rows } = await query(
      `INSERT INTO products (title, description, price_cents, compare_at_price_cents, currency, stock, category_id, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description, price_cents, compare_at_price_cents, currency, stock, finalCategoryId, mainUrl]
    );
    const product = rows[0];
    try {
      for (let idx = 0; idx < files.length; idx++) {
        const f = files[idx];
        await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [product.id, `/uploads/${f.filename}`, idx]);
      }
    } catch (imgErr) { /* best effort */ }
    res.status(201).json(product);
  } catch (e) { next(e); }
}

export async function updateProduct(req, res, next) {
  try {
    const { title, description, price_cents, compare_at_price_cents, currency, stock } = req.body;
    let category_id = req.body.category_id;
    const category_name = req.body.category_name;
    if (!category_id && category_name) {
      category_id = await ensureCategoryByName(category_name);
    }
    const files = (req.files && Array.isArray(req.files) && req.files.length) ? req.files : (req.file ? [req.file] : []);
    let image_url = req.body.image_url;
    // allow cover_image_id to dictate image_url later after we may insert files
    const { rows } = await query(
      `UPDATE products SET
         title=COALESCE($2,title),
         description=COALESCE($3,description),
         price_cents=COALESCE($4,price_cents),
         compare_at_price_cents=COALESCE($5,compare_at_price_cents),
         currency=COALESCE($6,currency),
         stock=COALESCE($7,stock),
         category_id=COALESCE($8,category_id),
         image_url=COALESCE($9,image_url),
         updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, title, description, price_cents, compare_at_price_cents, currency, stock, category_id || null, image_url]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    const product = rows[0];
    try {
      const rawRemove = req.body.remove_image_ids;
      const clearImages = String(req.body.clear_images || '').toLowerCase() === 'true';
      let removeIds = [];
      if (rawRemove) {
        try {
          const parsed = typeof rawRemove === 'string' && rawRemove.trim().startsWith('[')
            ? JSON.parse(rawRemove) : String(rawRemove).split(',');
          removeIds = parsed.map(x => String(x).trim()).filter(Boolean);
        } catch {}
      }
      if (clearImages) {
        await query('DELETE FROM product_images WHERE product_id=$1', [product.id]);
        await query('UPDATE products SET image_url=NULL, updated_at=NOW() WHERE id=$1', [product.id]);
        product.image_url = null;
      } else if (removeIds.length) {
        await query('DELETE FROM product_images WHERE product_id=$1 AND id = ANY($2::uuid[])', [product.id, removeIds]);
        // If current cover no longer exists, set to first remaining
        if (product.image_url) {
          const { rows: exists } = await query('SELECT 1 FROM product_images WHERE product_id=$1 AND url=$2 LIMIT 1', [product.id, product.image_url]);
          if (!exists[0]) {
            const { rows: first } = await query('SELECT url FROM product_images WHERE product_id=$1 ORDER BY position ASC LIMIT 1', [product.id]);
            const newUrl = first[0]?.url || null;
            await query('UPDATE products SET image_url=$2, updated_at=NOW() WHERE id=$1', [product.id, newUrl]);
            product.image_url = newUrl;
          }
        }
      }
      if (files.length) {
        const { rows: maxPosRows } = await query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM product_images WHERE product_id=$1', [product.id]);
        let pos = (maxPosRows[0]?.maxpos ?? -1) + 1;
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [product.id, `/uploads/${f.filename}`, pos++]);
        }
      }
      // cover image handling via cover_image_id
      const coverId = req.body.cover_image_id ? String(req.body.cover_image_id).trim() : '';
      if (coverId) {
        const { rows: imgRows } = await query('SELECT url FROM product_images WHERE id=$1 AND product_id=$2', [coverId, product.id]);
        if (imgRows[0]) {
          await query('UPDATE products SET image_url=$2, updated_at=NOW() WHERE id=$1', [product.id, imgRows[0].url]);
          product.image_url = imgRows[0].url;
        }
      } else if (!product.image_url) {
        // if no explicit cover set and none exists, set to first image if available
        const { rows: firstImg } = await query('SELECT url FROM product_images WHERE product_id=$1 ORDER BY position ASC LIMIT 1', [product.id]);
        if (firstImg[0]) {
          await query('UPDATE products SET image_url=$2 WHERE id=$1', [product.id, firstImg[0].url]);
          product.image_url = firstImg[0].url;
        }
      }
    } catch (imgErr) { /* best effort */ }
    res.json(product);
  } catch (e) { next(e); }
}

export async function deleteProduct(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM products WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
  } catch (e) { next(e); }
}
