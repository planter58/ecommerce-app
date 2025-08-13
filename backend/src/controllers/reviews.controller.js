import { query } from '../config/db.js';

export async function listProductReviews(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT r.*, u.name AS user_name
       FROM reviews r
       JOIN users u ON u.id=r.user_id
       WHERE r.product_id=$1
       ORDER BY r.created_at DESC`, [req.params.productId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

export async function addProductReview(req, res, next) {
  try {
    const { rating, comment } = req.body;
    // ensure user purchased item
    const { rows: owns } = await query(
      `SELECT 1
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id=$1 AND oi.product_id=$2
       LIMIT 1`, [req.user.id, req.params.productId]
    );
    if (!owns[0]) return res.status(403).json({ message: 'You can only review items you purchased' });
    const { rows } = await query(
      `INSERT INTO reviews (user_id, product_id, rating, comment)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, product_id) DO UPDATE SET
         rating=EXCLUDED.rating,
         comment=EXCLUDED.comment,
         created_at=NOW()
       RETURNING *`, [req.user.id, req.params.productId, rating, comment || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}
