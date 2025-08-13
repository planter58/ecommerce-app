import Stripe from 'stripe';
import { query } from '../config/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createPaymentIntent(req, res, next) {
  try {
    const { order_id } = req.body;
    const { rows } = await query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [order_id, req.user.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const intent = await stripe.paymentIntents.create({
      amount: order.total_cents,
      currency: order.currency,
      metadata: { order_id: order.id, user_id: req.user.id }
    });

    await query(
      `INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status, raw_response)
       VALUES ($1,'stripe',$2,$3,$4,$5,$6)`,
      [order.id, intent.id, order.total_cents, order.currency, intent.status, intent]
    );

    res.json({ clientSecret: intent.client_secret });
  } catch (e) { next(e); }
}

export async function webhook(req, res) {
  const event = req.body;
  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderId = pi.metadata?.order_id;
      if (orderId) {
        await query('UPDATE orders SET status=$2 WHERE id=$1', [orderId, 'paid']);
        await query('UPDATE payments SET status=$2, raw_response=$3 WHERE provider_payment_id=$1',
          [pi.id, 'succeeded', pi]);
        // Clear the user's cart after successful payment
        const { rows: ord } = await query('SELECT user_id FROM orders WHERE id=$1', [orderId]);
        if (ord[0]?.user_id) {
          await query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id=$1)', [ord[0].user_id]);
        }
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error(e);
    res.status(400).send('Webhook Error');
  }
}

// ---- M-Pesa STK Push ----
function nowTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function ensureFetch() {
  if (typeof fetch !== 'function') {
    const mod = await import('node-fetch');
    return mod.default;
  }
  return fetch;
}

async function getMpesaAccessToken() {
  const f = await ensureFetch();
  const base = process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const url = `${base}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const resp = await f(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!resp.ok) throw new Error(`M-Pesa token error ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

export async function initiateMpesaStk(req, res, next) {
  try {
    const { order_id, phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });
    const { rows } = await query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [order_id, req.user.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const amount = Math.max(1, Math.round(order.total_cents / 100));
    const timestamp = nowTimestamp();
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    const token = await getMpesaAccessToken();
    const base = process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: `ORDER-${order.id}`,
      TransactionDesc: `Order ${order.id}`
    };
    const f = await ensureFetch();
    const resp = await f(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();

    await query(
      `INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status, raw_response)
       VALUES ($1,'mpesa',$2,$3,$4,$5,$6)`,
      [order.id, data.CheckoutRequestID || data.MerchantRequestID || null, order.total_cents, order.currency, data.ResponseCode === '0' ? 'pending' : 'failed', data]
    );

    res.json({ ok: true, response: data });
  } catch (e) { next(e); }
}

export async function mpesaCallback(req, res) {
  try {
    const body = req.body;
    const stk = body?.Body?.stkCallback;
    if (!stk) return res.json({ received: true });
    const id = stk.CheckoutRequestID;
    const resultCode = stk.ResultCode;
    const status = resultCode === 0 ? 'succeeded' : 'failed';
    await query('UPDATE payments SET status=$2, raw_response=$3 WHERE provider=$4 AND provider_payment_id=$1', [id, status, body, 'mpesa']);
    if (status === 'succeeded') {
      const amountItem = stk.CallbackMetadata?.Item?.find?.(i => i.Name === 'Amount');
      // Mark order paid if we can infer it from AccountReference
      const accRef = stk.CallbackMetadata?.Item?.find?.(i => i.Name === 'AccountReference')?.Value;
      const orderId = accRef?.toString().replace('ORDER-','');
      if (orderId) {
        await query('UPDATE orders SET status=$2 WHERE id=$1', [orderId, 'paid']);
        const { rows: ord } = await query('SELECT user_id FROM orders WHERE id=$1', [orderId]);
        if (ord[0]?.user_id) {
          await query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id=$1)', [ord[0].user_id]);
        }
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error(e);
    res.status(400).send('Callback error');
  }
}
