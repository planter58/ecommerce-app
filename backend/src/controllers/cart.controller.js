import { query, withTransaction } from '../config/db.js';

async function ensureCart(userId, runner = query) {
  const existing = await runner('SELECT id FROM carts WHERE user_id=$1', [userId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await runner('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
  return rows[0].id;
}

export async function getCart(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT ci.product_id, ci.quantity, p.title, p.price_cents, p.image_url
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN products p ON p.id = ci.product_id
       WHERE c.user_id=$1
       ORDER BY LOWER(p.title), p.id`, [req.user.id]);
    res.json({ items: rows });
  } catch (e) { next(e); }
}

export async function addToCart(req, res, next) {
  try {
    const { product_id, quantity = 1 } = req.body;
    await withTransaction(async (client) => {
      const q = (text, params) => client.query(text, params);
      const cartId = await ensureCart(req.user.id, (t, p) => q(t, p));
      await q(
        `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES ($1,$2,$3)
         ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
        [cartId, product_id, quantity]
      );
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
}

export async function updateQty(req, res, next) {
  try {
    const { quantity } = req.body;
    await withTransaction(async (client) => {
      const q = (t, p) => client.query(t, p);
      const { rows } = await q('SELECT id FROM carts WHERE user_id=$1', [req.user.id]);
      if (!rows[0]) return;
      await q(`UPDATE cart_items SET quantity=$3 WHERE cart_id=$1 AND product_id=$2`, [rows[0].id, req.params.productId, quantity]);
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function removeFromCart(req, res, next) {
  try {
    await withTransaction(async (client) => {
      const q = (t, p) => client.query(t, p);
      const { rows } = await q('SELECT id FROM carts WHERE user_id=$1', [req.user.id]);
      if (!rows[0]) return;
      await q(`DELETE FROM cart_items WHERE cart_id=$1 AND product_id=$2`, [rows[0].id, req.params.productId]);
    });
    res.status(204).send();
  } catch (e) { next(e); }
}
