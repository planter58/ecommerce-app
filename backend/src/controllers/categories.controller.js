import { query } from '../config/db.js';

export async function listCategories(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM categories ORDER BY name ASC');
    res.json(rows);
  } catch (e) { next(e); }
}
export async function createCategory(req, res, next) {
  try {
    const { name, slug } = req.body;
    const { rows } = await query(
      'INSERT INTO categories (name, slug) VALUES ($1,$2) RETURNING *', [name, slug]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}
export async function updateCategory(req, res, next) {
  try {
    const { name, slug } = req.body;
    const { rows } = await query(
      'UPDATE categories SET name=COALESCE($2,name), slug=COALESCE($3,slug), updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id, name, slug]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}
export async function deleteCategory(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
  } catch (e) { next(e); }
}
