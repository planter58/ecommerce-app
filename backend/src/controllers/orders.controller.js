import { query, withTransaction } from '../config/db.js';

export async function createOrderFromCart(req, res, next) {
  const { shipping_address, billing_address } = req.body;
  try {
    const order = await withTransaction(async (client) => {
      const q = (t, p) => client.query(t, p);
      const { rows: cartRows } = await q(
        `SELECT c.id AS cart_id, ci.product_id, ci.quantity, p.price_cents, p.vendor_id
         FROM carts c
         JOIN cart_items ci ON ci.cart_id=c.id
         JOIN products p ON p.id=ci.product_id
         WHERE c.user_id=$1`, [req.user.id]);
      if (!cartRows.length) throw new Error('Cart is empty');

      let total = 0;
      for (const item of cartRows) {
        total += item.price_cents * item.quantity;
        const { rows: stockRows } = await q('SELECT stock FROM products WHERE id=$1 FOR UPDATE', [item.product_id]);
        if (stockRows[0].stock < item.quantity) throw new Error('Insufficient stock');
        await q('UPDATE products SET stock = stock - $2 WHERE id=$1', [item.product_id, item.quantity]);
      }

      const { rows: orderRows } = await q(
        `INSERT INTO orders (user_id, status, total_cents, currency, shipping_address, billing_address)
         VALUES ($1,'pending',$2,'kes',$3,$4) RETURNING *`,
        [req.user.id, total, shipping_address || null, billing_address || null]
      );

      const orderId = orderRows[0].id;
      for (const item of cartRows) {
        await q(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, vendor_id, vendor_item_status)
           VALUES ($1,$2,$3,$4,$5,'pending')`,
          [orderId, item.product_id, item.quantity, item.price_cents, item.vendor_id]
        );
      }

      // Do not clear the cart here. We will clear it after successful payment
      // in the payment webhook/callback to allow retrying alternative methods.
      return orderRows[0];
    });
    res.status(201).json(order);
  } catch (e) { next(e); }
}

export async function listMyOrders(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
}

export async function listAllOrders(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { next(e); }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { rows } = await query('UPDATE orders SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id, status]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}
