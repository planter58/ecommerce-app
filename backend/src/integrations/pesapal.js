import crypto from 'crypto';

let cachedToken = null;
let cachedTokenExp = 0;

async function ensureFetch() {
  if (typeof fetch !== 'function') {
    const mod = await import('node-fetch');
    return mod.default;
  }
  return fetch;
}

function getBaseUrl() {
  // Live default unless explicitly overridden
  return process.env.PESPAL_BASE_URL || 'https://pay.pesapal.com/v3';
}

export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExp - 5000) return cachedToken;
  const f = await ensureFetch();
  const url = `${getBaseUrl()}/api/Auth/RequestToken`;
  const resp = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESPAL_CONSUMER_SECRET
    })
  });
  if (!resp.ok) throw new Error(`Pesapal token error ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.token;
  cachedTokenExp = now + (data.expires_in ? data.expires_in * 1000 : 25 * 60 * 1000);
  return cachedToken;
}

export async function submitOrder({
  amount, currency, description, callbackUrl, notificationId,
  customer, merchantReference, redirectUrl
}) {
  const token = await getAccessToken();
  const f = await ensureFetch();
  const payload = {
    id: merchantReference, // merchant reference
    currency: currency || 'KES',
    amount: amount,
    description: description || `Order ${merchantReference}`,
    callback_url: redirectUrl, // where to redirect user after payment
    notification_id: notificationId || null, // IPN id registered on Pesapal
    branch: 'ONLINE',
    billing_address: {
      email_address: customer?.email || 'noemail@example.com',
      phone_number: customer?.phone || '',
      country_code: 'KE',
      first_name: customer?.first_name || customer?.name || 'Customer',
      middle_name: '',
      last_name: customer?.last_name || '',
      line_1: '',
      line_2: '',
      city: '',
      state: '',
      postal_code: ''
    }
  };
  const resp = await f(`${getBaseUrl()}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Pesapal submit error ${resp.status} ${data?.message || ''}`);
  // data: { redirect_url, order_tracking_id, merchant_reference }
  return data;
}

export async function getTransactionStatus({ orderTrackingId, merchantReference }) {
  const token = await getAccessToken();
  const f = await ensureFetch();
  let url;
  if (orderTrackingId) {
    url = `${getBaseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`;
  } else if (merchantReference) {
    url = `${getBaseUrl()}/api/Transactions/GetTransactionStatus?merchantReference=${encodeURIComponent(merchantReference)}`;
  } else {
    throw new Error('orderTrackingId or merchantReference is required');
  }
  const resp = await f(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Pesapal status error ${resp.status}`);
  return data; // includes status_code, payment_method, amount, confirmation_code, etc.
}
