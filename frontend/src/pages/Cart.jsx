import { useContext } from 'react';
import { CartContext } from '../context/CartContext.jsx';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '../utils/media';

export default function Cart() {
  const { items, updateQty, removeFromCart } = useContext(CartContext);
  const total = items.reduce((sum, it) => sum + it.price_cents * it.quantity, 0);
  return (
    <div>
      <h2>Your Cart</h2>
      {items.length === 0 && <p>Cart is empty. <Link className="link" to="/">Shop now</Link></p>}

      {items.length > 0 && (
        <div className="cart-list">
          {items.map(it => (
            <div key={it.product_id} className="cart-item">
              <img className="cart-item-thumb" src={toAbsoluteUrl(it.image_url)} alt={it.title} />
              <div className="cart-item-main">
                <div className="title" style={{ margin: 0 }}>{it.title}</div>
                <div className="price" style={{ marginTop: 4 }}>KSh {((it.price_cents * it.quantity)/100).toFixed(2)}</div>
                <div className="small muted" style={{ marginTop: 2 }}>KSh {(it.price_cents/100).toFixed(2)} x {it.quantity}</div>
              </div>
              <div className="cart-item-actions">
                <div className="qty">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => updateQty(it.product_id, Math.max(1, (it.quantity || 1) - 1))}
                  >
                    -
                  </button>
                  <div className="input qty-input" style={{ textAlign: 'center' }}>{it.quantity}</div>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => updateQty(it.product_id, (it.quantity || 1) + 1)}
                  >
                    +
                  </button>
                </div>
                <button className="button ghost remove-btn" onClick={()=>removeFromCart(it.product_id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="row" style={{ marginTop: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="price" style={{ fontSize: 18 }}>Total: KSh {(total/100).toFixed(2)}</div>
          <Link to="/checkout"><button className="button">Proceed to Checkout</button></Link>
        </div>
      )}
    </div>
  );
}

