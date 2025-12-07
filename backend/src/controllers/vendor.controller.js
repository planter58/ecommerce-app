import { query } from '../config/db.js';
import { isCloudEnabled, uploadBuffer } from '../utils/cloudinary.js';

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

export async function getMyVendor(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not a vendor' });
    const v = rows[0];
    // Allow access if vendor is approved OR if user is any type of admin
    const role = String(req.user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'admin1' || role === 'admin2' || role === 'super_admin' || role === 'administrator';
    if (v.status && v.status !== 'approved' && !isAdmin) {
      const msg = v.status === 'suspended'
        ? 'Your vendor account is suspended. Request access from the Admin.'
        : 'Your vendor account is pending approval. Request access from the Admin.';
      return res.status(403).json({ message: msg, status: v.status });
    }
    res.json(v);
  } catch (e) { next(e); }
}

export async function updateMyVendor(req, res, next) {
  try {
    const { business_name, phone, address } = req.body;
    const { rows } = await query(
      `UPDATE vendors SET
         business_name=COALESCE($2,business_name),
         phone=COALESCE($3,phone),
         address=COALESCE($4,address),
         updated_at=NOW()
       WHERE user_id=$1 RETURNING *`,
      [req.user.id, business_name, phone, address]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not a vendor' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

// Products owned by vendor
export async function listMyProducts(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              COALESCE(
                (
                  SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url, 'position', pi.position) ORDER BY pi.position ASC)
                  FROM product_images pi WHERE pi.product_id = p.id
                ), '[]'::json
              ) AS images
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.vendor_id=(SELECT id FROM vendors WHERE user_id=$1)
       ORDER BY p.updated_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
}

export async function createMyProduct(req, res, next) {
  try {
    const { rows: vRows } = await query('SELECT id FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!vRows[0]) return res.status(403).json({ message: 'Not a vendor' });
    const vendorId = vRows[0].id;
    const { title, description, price_cents, compare_at_price_cents, currency='kes', stock=0 } = req.body;
    let category_id = req.body.category_id;
    const category_name = req.body.category_name;
    if (!category_id && category_name) {
      category_id = await ensureCategoryByName(category_name);
    }
    const files = (req.files && Array.isArray(req.files) && req.files.length) ? req.files : (req.file ? [req.file] : []);
    let uploadedUrls = [];
    if (isCloudEnabled() && files.length && files[0].buffer) {
      for (const f of files) {
        const up = await uploadBuffer(f.buffer, { folder: 'ecommerce-app/products' });
        uploadedUrls.push(up.secure_url);
      }
    }
    const mainUrl = uploadedUrls[0]
      ? uploadedUrls[0]
      : (files[0] ? `/uploads/${files[0].filename}` : (req.body.image_url || null));
    if (!mainUrl) {
      return res.status(400).json({ message: 'At least one image is required.' });
    }
    const { rows } = await query(
      `INSERT INTO products (title, description, price_cents, compare_at_price_cents, currency, stock, category_id, image_url, vendor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, description, price_cents, compare_at_price_cents || null, currency, stock, category_id || null, mainUrl, vendorId]
    );
    const product = rows[0];
    // insert product_images for uploaded files (best-effort)
    try {
      if (uploadedUrls.length) {
        for (let idx = 0; idx < uploadedUrls.length; idx++) {
          await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [product.id, uploadedUrls[idx], idx]);
        }
      } else {
        for (let idx = 0; idx < files.length; idx++) {
          const f = files[idx];
          await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [product.id, `/uploads/${f.filename}`, idx]);
        }
      }
    } catch (imgErr) {
      // If product_images table missing or other error, proceed with product created
      // console.error('Image insert failed:', imgErr);
    }
    res.status(201).json(product);
  } catch (e) { next(e); }
}

export async function updateMyProduct(req, res, next) {
  try {
    const { rows: vRows } = await query('SELECT id FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!vRows[0]) return res.status(403).json({ message: 'Not a vendor' });
    const vendorId = vRows[0].id;
    const { title, description, price_cents, compare_at_price_cents, currency, stock } = req.body;
    let category_id = req.body.category_id;
    const category_name = req.body.category_name;
    if (!category_id && category_name) {
      category_id = await ensureCategoryByName(category_name);
    }
    const files = (req.files && Array.isArray(req.files) && req.files.length) ? req.files : (req.file ? [req.file] : []);
    let uploadedUrls = [];
    if (isCloudEnabled() && files.length && files[0].buffer) {
      for (const f of files) {
        const up = await uploadBuffer(f.buffer, { folder: 'ecommerce-app/products' });
        uploadedUrls.push(up.secure_url);
      }
    }
    const image_url = uploadedUrls[0] ? uploadedUrls[0] : (files[0] ? `/uploads/${files[0].filename}` : req.body.image_url);
    const { rows } = await query(
      `UPDATE products SET
         title=COALESCE($3,title), description=COALESCE($4,description),
         price_cents=COALESCE($5,price_cents), compare_at_price_cents=COALESCE($6,compare_at_price_cents), currency=COALESCE($7,currency),
         stock=COALESCE($8,stock), category_id=COALESCE($9,category_id),
         image_url=COALESCE($10,image_url), updated_at=NOW()
       WHERE id=$1 AND vendor_id=$2 RETURNING *`,
      [req.params.id, vendorId, title, description, price_cents, compare_at_price_cents, currency, stock, category_id || null, image_url]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    const product = rows[0];
    // parse removal and ordering
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
        await query(`DELETE FROM product_images WHERE product_id=$1 AND id = ANY($2::uuid[])`, [product.id, removeIds]);
        // if current cover no longer exists in product_images, reset to first remaining
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
      // insert any new files appended
      if (files.length || uploadedUrls.length) {
        // set next position to max existing + 1
        const { rows: maxPosRows } = await query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM product_images WHERE product_id=$1', [product.id]);
        let pos = (maxPosRows[0]?.maxpos ?? -1) + 1;
        if (uploadedUrls.length) {
          for (let i = 0; i < uploadedUrls.length; i++) {
            await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [product.id, uploadedUrls[i], pos++]);
          }
        } else {
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [product.id, `/uploads/${f.filename}`, pos++]);
          }
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
        const { rows: firstImg } = await query('SELECT url FROM product_images WHERE product_id=$1 ORDER BY position ASC LIMIT 1', [product.id]);
        if (firstImg[0]) {
          await query('UPDATE products SET image_url=$2 WHERE id=$1', [product.id, firstImg[0].url]);
          product.image_url = firstImg[0].url;
        }
      }
    } catch (imgErr) {
      // console.error('Update images failed:', imgErr);
    }
    res.json(product);
  } catch (e) { next(e); }
}

export async function deleteMyProduct(req, res, next) {
  try {
    const { rows: vRows } = await query('SELECT id FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!vRows[0]) return res.status(403).json({ message: 'Not a vendor' });
    const vendorId = vRows[0].id;
    const { rowCount } = await query('DELETE FROM products WHERE id=$1 AND vendor_id=$2', [req.params.id, vendorId]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
  } catch (e) { next(e); }
}

// Orders for vendor
export async function listMyOrderItems(req, res, next) {
  try {
    const { rows: vRows } = await query('SELECT id FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!vRows[0]) return res.status(403).json({ message: 'Not a vendor' });
    const vendorId = vRows[0].id;
    const { rows } = await query(
      `SELECT oi.*, o.status AS order_status, o.created_at AS order_created_at,
              p.title AS product_title
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       JOIN products p ON p.id=oi.product_id
       WHERE oi.vendor_id=$1
       ORDER BY o.created_at DESC`, [vendorId]);
    res.json(rows);
  } catch (e) { next(e); }
}

export async function markItemShipped(req, res, next) {
  try {
    const { rows: vRows } = await query('SELECT id FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!vRows[0]) return res.status(403).json({ message: 'Not a vendor' });
    const vendorId = vRows[0].id;
    const { tracking_number } = req.body;
    const { rows } = await query(
      `UPDATE order_items SET vendor_item_status='shipped', tracking_number=COALESCE($3, tracking_number)
       WHERE id=$1 AND vendor_id=$2 RETURNING *`, [req.params.id, vendorId, tracking_number || null]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function handleReturn(req, res, next) {
  try {
    const { rows: vRows } = await query('SELECT id FROM vendors WHERE user_id=$1', [req.user.id]);
    if (!vRows[0]) return res.status(403).json({ message: 'Not a vendor' });
    const vendorId = vRows[0].id;
    const { reason, status } = req.body; // status: requested|approved|rejected|completed
    // Ensure item belongs to vendor
    const { rows: check } = await query('SELECT * FROM order_items WHERE id=$1 AND vendor_id=$2', [req.params.id, vendorId]);
    if (!check[0]) return res.status(404).json({ message: 'Not found' });
    // Upsert into returns table
    const { rows } = await query(
      `INSERT INTO returns (order_item_id, reason, status)
       VALUES ($1,$2,COALESCE($3,'requested'))
       ON CONFLICT (order_item_id) DO UPDATE SET
         reason=COALESCE(EXCLUDED.reason, returns.reason),
         status=COALESCE(EXCLUDED.status, returns.status),
         updated_at=NOW()
       RETURNING *`, [req.params.id, reason || null, status || 'requested']
    );
    // Mirror status on order_items
    await query('UPDATE order_items SET vendor_item_status=$2 WHERE id=$1', [req.params.id, rows[0].status]);
    res.json(rows[0]);
  } catch (e) { next(e); }
}
