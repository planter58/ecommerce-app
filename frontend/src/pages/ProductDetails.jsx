import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { fetchProduct, fetchProducts } from '../api/products';
import { CartContext } from '../context/CartContext.jsx';
import { Link } from 'react-router-dom';
import { fetchProductReviews } from '../api/reviews';
import { toAbsoluteUrl } from '../utils/media';

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const { addToCart } = useContext(CartContext);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    fetchProduct(id).then(async (p) => {
      setProduct(p);
      const first = toAbsoluteUrl(p.image_url || (p.images && p.images[0]?.url));
      setActiveImage(first);
      // similar products from same category, excluding current
      if (p.category_slug) {
        try {
          const data = await fetchProducts({ category: p.category_slug, limit: 6, exclude_id: p.id });
          setSimilar(data.items || []);
        } catch {}
      } else {
        setSimilar([]);
      }
    });
    fetchProductReviews(id).then(setReviews);
  }, [id]);
  if (!product) return <div>Loading...</div>;

  const add = async () => {
    await addToCart({ product_id: product.id, quantity: Math.max(1, qty), product });
    setAdded(true);
  };

  const hasCompare = typeof product.compare_at_price_cents === 'number' && product.compare_at_price_cents > 0 && product.compare_at_price_cents > product.price_cents;
  const discountPct = hasCompare ? Math.round((1 - (product.price_cents / product.compare_at_price_cents)) * 100) : 0;
  return (
    <div className="product">
      <div className="media">
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ position:'relative' }}>
              {hasCompare && <div style={{ position:'absolute', top:8, left:8, background:'crimson', color:'#fff', padding:'4px 8px', borderRadius:4, fontSize:12, fontWeight:700 }}>{discountPct}%</div>}
              <img src={toAbsoluteUrl(activeImage || product.image_url)} alt={product.title} style={{ width:'100%', borderRadius:8, objectFit:'cover' }} />
            </div>
          </div>
          {product.images && product.images.length > 0 && (
            <div className="thumbs" style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto' }}>
              {product.images.map((img) => (
                <button key={img.id} type="button" className="ghost" style={{ padding:0, border:'none', background:'transparent' }} onClick={()=>setActiveImage(toAbsoluteUrl(img.url))}>
                  <img src={toAbsoluteUrl(img.url)} alt="thumb" style={{ width:72, height:72, objectFit:'cover', borderRadius:6, outline: toAbsoluteUrl(activeImage)===toAbsoluteUrl(img.url)? '2px solid var(--primary)':'none' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{product.title}</h2>
        <div className="price" style={{ fontSize: 20, display:'flex', alignItems:'baseline', gap:12 }}>
          <span>KSh {(product.price_cents/100).toFixed(2)}</span>
          {hasCompare && (
            <span className="muted" style={{ textDecoration:'line-through', opacity:0.6 }}>KSh {(product.compare_at_price_cents/100).toFixed(2)}</span>
          )}
        </div>
        <div className="meta mt-8" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {product.vendor_name && <span>Sold by: <strong>{product.vendor_name}</strong></span>}
          {typeof product.stock === 'number' && <span>Stock remaining: <strong>{product.stock}</strong></span>}
          <span>Rating: <strong>{product.avg_rating?.toFixed ? product.avg_rating.toFixed(2) : product.avg_rating}/5</strong> ({product.rating_count || 0})</span>
        </div>
        {product.category_name && <div className="meta mt-16">Category: {product.category_name}</div>}
        <div className="mt-16" style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span>Quantity:</span>
          <button type="button" className="button ghost" onClick={()=>setQty(q => Math.max(1, q-1))}>-</button>
          <div className="input" style={{ width:48, textAlign:'center' }}>{qty}</div>
          <button type="button" className="button ghost" onClick={()=>setQty(q => q+1)}>+</button>
        </div>
        <div className="mt-16">
          <h4 style={{ margin: '12px 0 8px 0' }}>Details</h4>
          <p className="mt-8" style={{ whiteSpace: 'pre-wrap' }}>{product.description || 'No description provided.'}</p>
        </div>
        {!added ? (
          <button className="button mt-16" onClick={add}>Add to Cart</button>
        ) : (
          <div className="actions mt-16" style={{ display:'flex', gap:10 }}>
            <Link to="/cart"><button className="button">Proceed to Checkout</button></Link>
            <Link className="button ghost" to="/">Continue Shopping</Link>
          </div>
        )}
        <div className="mt-24">
          <h4 style={{ margin: '16px 0 8px 0' }}>Customer Reviews ({reviews.length})</h4>
          {reviews.length === 0 && <div className="small">No reviews yet.</div>}
          <div className="stack mt-8" style={{ gap:12 }}>
            {reviews.map(r => (
              <div key={r.id} className="card" style={{ padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <strong>{r.user_name || 'Customer'}</strong>
                  <span>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <div className="mt-8">{r.comment}</div>}
                <div className="small mt-8" style={{ color:'#666' }}>{new Date(r.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
        {similar.length > 0 && (
          <div className="mt-24">
            <h4 style={{ margin: '16px 0 8px 0' }}>Similar Products</h4>
            <div className="products-grid" style={{ gap:12 }}>
              {similar.map(sp => (
                <Link key={sp.id} to={`/product/${sp.id}`} className="card link" style={{ textDecoration:'none' }}>
                  <div style={{ position:'relative' }}>
                    {typeof sp.compare_at_price_cents==='number' && sp.compare_at_price_cents>sp.price_cents && (
                      <div style={{ position:'absolute', top:8, left:8, background:'crimson', color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:12, fontWeight:700 }}>
                        {Math.round((1 - (sp.price_cents / sp.compare_at_price_cents)) * 100)}%
                      </div>
                    )}
                    <img src={toAbsoluteUrl(sp.image_url || (sp.images && sp.images[0]?.url) || '')} alt={sp.title} style={{ width:'100%', height:160, objectFit:'cover', borderRadius:8 }} />
                  </div>
                  <div className="body">
                    <div className="title" style={{ margin:0 }}>{sp.title}</div>
                    <div className="price" style={{ display:'flex', gap:8 }}>
                      <span>KSh {(sp.price_cents/100).toFixed(2)}</span>
                      {typeof sp.compare_at_price_cents==='number' && sp.compare_at_price_cents>sp.price_cents && (
                        <span className="muted" style={{ textDecoration:'line-through', opacity:0.6 }}>KSh {(sp.compare_at_price_cents/100).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

