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

// Admin: list all reviews with product and user info
export async function listAllReviewsAdmin(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '500', 10) || 500, 1), 2000);
    const { rows } = await query(
      `SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.created_at,
              p.title AS product_title,
              u.name AS user_name,
              u.email AS user_email
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC
       LIMIT $1`, [limit]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// Admin: delete a review by id
export async function deleteReviewAdmin(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM reviews WHERE id=$1', [id]);
    res.status(204).end();
  } catch (e) { next(e); }
}

export async function addProductReview(req, res, next) {
  try {
    const { rating, comment } = req.body;
    const rInt = parseInt(rating, 10);
    if (!rInt || rInt < 1 || rInt > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }
    const requirePurchase = process.env.REQUIRE_PURCHASE_FOR_REVIEW === 'true';
    if (requirePurchase) {
      // ensure user purchased item (optional via env flag)
      const { rows: owns } = await query(
        `SELECT 1
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.user_id=$1 AND oi.product_id=$2
         LIMIT 1`, [req.user.id, req.params.productId]
      );
      if (!owns[0]) return res.status(403).json({ message: 'You can only review items you purchased' });
    }
    const { rows } = await query(
      `INSERT INTO reviews (user_id, product_id, rating, comment)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, product_id) DO UPDATE SET
         rating=EXCLUDED.rating,
         comment=EXCLUDED.comment,
         created_at=NOW()
       RETURNING *`, [req.user.id, req.params.productId, rInt, (comment && String(comment).trim()) || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}
