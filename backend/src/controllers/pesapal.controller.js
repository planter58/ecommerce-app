import { query } from '../config/db.js';
import { submitOrder, getTransactionStatus } from '../integrations/pesapal.js';

function centsToMajor(cents) { return Math.max(1, Math.round(cents / 100)); }

export async function initiate(req, res, next) {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ message: 'order_id is required' });
    const { rows } = await query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [order_id, req.user.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const amount = centsToMajor(order.total_cents);
    const notificationId = process.env.PESPAL_IPN_ID || null; // optional if already configured in dashboard
    const redirectUrl = process.env.PESPAL_RETURN_URL || `${process.env.APP_PUBLIC_URL || ''}/payment/return`;

    const resp = await submitOrder({
      amount,
      currency: order.currency || 'KES',
      description: `Order ${order.id}`,
      callbackUrl: process.env.PESPAL_IPN_URL, // IPN endpoint (server-to-server notifications)
      notificationId,
      merchantReference: order.id,
      redirectUrl,
      customer: { email: req.user.email, name: req.user.name }
    });

    // Persist payment record with provider_payment_id = order_tracking_id
    await query(
      `INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status, raw_response)
       VALUES ($1,'pesapal',$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [order.id, resp.order_tracking_id, order.total_cents, order.currency || 'KES', 'pending', resp]
    );

    res.json({
      redirect_url: resp.redirect_url,
      order_tracking_id: resp.order_tracking_id,
      merchant_reference: resp.merchant_reference || order.id
    });
  } catch (e) { next(e); }
}

// Pesapal IPN notifies that a transaction changed; we verify by querying GetTransactionStatus
export async function ipn(req, res) {
  try {
    const { orderTrackingId, OrderTrackingId, merchantReference, MerchantReference } = req.body || {};
    const order_tracking_id = orderTrackingId || OrderTrackingId || null;
    const merchant_reference = merchantReference || MerchantReference || null;

    // Acknowledge quickly
    res.status(200).json({ received: true });

    try {
      const status = await getTransactionStatus({ orderTrackingId: order_tracking_id, merchantReference: merchant_reference });
      const code = (status?.status_code || '').toString().toUpperCase();
      const succeeded = code === 'COMPLETED' || code === 'PAID' || code === 'SUCCESS' || code === '200';
      const failed = code === 'FAILED' || code === 'CANCELLED' || code === '0';
      const orderId = status?.merchant_reference || merchant_reference;

      if (orderId) {
        if (succeeded) {
          await query('UPDATE orders SET status=$2 WHERE id=$1', [orderId, 'paid']);
          await query('UPDATE payments SET status=$2, raw_response=$3 WHERE provider=$4 AND (provider_payment_id=$1 OR order_id=$5)', [order_tracking_id, 'succeeded', status, 'pesapal', orderId]);
          // Clear the user's cart after successful payment
          const { rows: ord } = await query('SELECT user_id FROM orders WHERE id=$1', [orderId]);
          if (ord[0]?.user_id) {
            await query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id=$1)', [ord[0].user_id]);
          }
        } else if (failed) {
          await query('UPDATE payments SET status=$2, raw_response=$3 WHERE provider=$4 AND (provider_payment_id=$1 OR order_id=$5)', [order_tracking_id, 'failed', status, 'pesapal', orderId]);
        } else {
          await query('UPDATE payments SET status=$2, raw_response=$3 WHERE provider=$4 AND (provider_payment_id=$1 OR order_id=$5)', [order_tracking_id, 'pending', status, 'pesapal', orderId]);
        }
      }
    } catch (e) {
      // swallow errors in background processing
      console.error('Pesapal IPN verify error', e);
    }
  } catch (e) {
    console.error('Pesapal IPN error', e);
    // best-effort acknowledge to prevent retries storm
    try { res.status(200).json({ received: true }); } catch {}
  }
}

export async function status(req, res, next) {
  try {
    const { orderTrackingId, merchantReference } = req.query;
    if (!orderTrackingId && !merchantReference) return res.status(400).json({ message: 'orderTrackingId or merchantReference is required' });
    const st = await getTransactionStatus({ orderTrackingId, merchantReference });
    res.json(st);
  } catch (e) { next(e); }
}
