import { query } from '../config/db.js';

function slugify(input) {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s;
}

export async function listCategories(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM categories ORDER BY name ASC');
    res.json(rows);
  } catch (e) { next(e); }
}
export async function createCategory(req, res, next) {
  try {
    let { name, slug } = req.body || {};
    const nameTrim = (name && String(name).trim()) || '';
    let slugTrim = (slug && String(slug).trim()) || '';
    if (!nameTrim) return res.status(400).json({ message: 'Name is required' });
    if (!slugTrim) slugTrim = slugify(nameTrim);
    if (!slugTrim) return res.status(400).json({ message: 'Slug cannot be empty' });
    const { rows } = await query(
      'INSERT INTO categories (name, slug) VALUES ($1,$2) RETURNING *', [nameTrim, slugTrim]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    // unique_violation
    if (e && e.code === '23505') {
      return res.status(409).json({ message: 'Category with this slug already exists' });
    }
    next(e);
  }
}
export async function updateCategory(req, res, next) {
  try {
    let { name, slug } = req.body || {};
    const nameVal = (name !== undefined) ? ((String(name).trim() === '') ? null : String(name).trim()) : undefined;
    let slugVal;
    if (slug !== undefined) {
      const s = String(slug).trim();
      slugVal = s === '' ? null : s; // null will keep existing via COALESCE
    }
    const { rows } = await query(
      'UPDATE categories SET name=COALESCE($2,name), slug=COALESCE($3,slug), updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id, nameVal, slugVal]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e && e.code === '23505') {
      return res.status(409).json({ message: 'Category with this slug already exists' });
    }
    next(e);
  }
}
export async function deleteCategory(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
  } catch (e) { next(e); }
}
