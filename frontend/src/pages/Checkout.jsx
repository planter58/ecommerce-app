import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createOrder } from '../api/orders';
import { createPaymentIntent, initiateMpesaStk } from '../api/payments';
import { useNavigate } from 'react-router-dom';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('mpesa'); // card | paypal | mpesa
  const [phone, setPhone] = useState('');

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const ord = await createOrder({ shipping_address: {}, billing_address: {} });
        setOrder(ord);
      } catch (e) {
        const msg = e?.response?.data?.message || e.message || 'Failed to initialize checkout';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch Stripe client secret only when needed (card payments)
  useEffect(() => {
    async function fetchClientSecret() {
      if (!order || method !== 'card') { setClientSecret(null); return; }
      try {
        const { clientSecret } = await createPaymentIntent(order.id);
        setClientSecret(clientSecret);
      } catch (e) {
        const msg = e?.response?.data?.message || e.message || 'Failed to start card payment';
        if (/Invalid API Key provided/i.test(msg)) {
          setError('Stripe key invalid. Use M-Pesa or fix Stripe keys, then restart servers.');
        } else {
          setError(msg);
        }
      }
    }
    fetchClientSecret();
  }, [order, method]);

  // Clear any previous error when switching methods
  useEffect(() => { setError(''); }, [method]);

  const pay = async (e) => {
    e.preventDefault();
    if (method === 'card') {
      if (!stripe || !elements || !clientSecret) return;
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) }
      });
      if (error) setError(error.message); else alert('Payment succeeded!');
    } else if (method === 'paypal') {
      alert('PayPal checkout coming soon (backend and PayPal SDK integration required).');
    } else if (method === 'mpesa') {
      try {
        if (!phone) return setError('Enter phone number to receive STK push');
        const resp = await initiateMpesaStk(order.id, phone);
        if (resp?.response?.ResponseCode === '0') {
          alert('STK push sent. Check your phone to authorize.');
        } else {
          setError(resp?.response?.errorMessage || 'Failed to initiate STK push');
        }
      } catch (e) { setError(e?.response?.data?.message || e.message); }
    }
  };

  if (loading) return <div>Preparing checkout...</div>;

  return (
    <form onSubmit={pay} className="form">
      {error && (
        <div className="error" style={{ marginBottom: 12 }}>
          {error}
          <div className="help">You can switch payment method below and try again.</div>
        </div>
      )}
      <div className="price">Order total: KSh {(order.total_cents/100).toFixed(2)}</div>
      <div className="row">
        <label>Payment method</label>
        <div className="small" style={{ display:'flex', gap:12 }}>
          <label><input type="radio" name="pm" value="mpesa" checked={method==='mpesa'} onChange={()=>setMethod('mpesa')} /> M-Pesa (STK)</label>
          <label><input type="radio" name="pm" value="card" checked={method==='card'} onChange={()=>setMethod('card')} /> Card (Visa/Mastercard via Stripe)</label>
          <label><input type="radio" name="pm" value="paypal" checked={method==='paypal'} onChange={()=>setMethod('paypal')} /> PayPal</label>
        </div>
      </div>
      {method==='card' && (
        <div className="row" style={{ padding: 12, border: '1px dashed var(--border)', borderRadius: 8 }}>
          <CardElement options={{ hidePostalCode: true }} />
        </div>
      )}
      {method!=='card' && (
        <div className="row" style={{ padding: 12, border: '1px dashed var(--border)', borderRadius: 8 }}>
          {method==='paypal' && <div className="help">Selected: PayPal. This option requires backend integration; use Card for now.</div>}
          {method==='mpesa' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <label>Phone number (e.g., 2547XXXXXXXX)</label>
              <input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="2547XXXXXXXX" />
              <div className="help">You will receive an STK push on this number.</div>
            </div>
          )}
        </div>
      )}
      <div className="actions">
        <button className="button" disabled={(method==='card' && (!stripe || !clientSecret)) || (method==='mpesa' && !phone)}>
          {method==='mpesa' ? 'Send STK Push' : 'Pay'}
        </button>
        <a href="/cart" className="button ghost" style={{ marginLeft: 8 }}>Back to Cart</a>
      </div>
    </form>
  );
}

export default function Checkout() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}

