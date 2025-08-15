import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { fetchProduct, fetchProducts } from '../api/products';
import { CartContext } from '../context/CartContext.jsx';
import { Link } from 'react-router-dom';
import { fetchProductReviews } from '../api/reviews';
import { toAbsoluteUrl, toCoverUrl } from '../utils/media';
import ProductCard from '../components/ProductCard.jsx';

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const { addToCart } = useContext(CartContext);
  const [activeImage, setActiveImage] = useState(null);
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

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
    // Ensure we start from top when navigating to a new similar product
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
  }, [id]);

  // Track viewport width to drive responsive columns (JS-based to avoid CSS edits)
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    try { window.addEventListener('resize', onResize); } catch {}
    return () => { try { window.removeEventListener('resize', onResize); } catch {} };
  }, []);
  if (!product) return <div>Loading...</div>;

  const add = async () => {
    await addToCart({ product_id: product.id, quantity: Math.max(1, qty), product });
    setAdded(true);
  };

  const hasCompare = typeof product.compare_at_price_cents === 'number' && product.compare_at_price_cents > 0 && product.compare_at_price_cents > product.price_cents;
  const discountPct = hasCompare ? Math.round((1 - (product.price_cents / product.compare_at_price_cents)) * 100) : 0;
  const topGridCols = vw >= 1024 ? '1fr 1fr' : '1fr';
  const similarCols = vw >= 1024 ? 4 : 2; // phone/tablet: 2 per row, desktop: 4 per row
  return (
    <div className="product">
      {/* Top row: Selected product (media) + Details in a single bordered card; 1 col on phone, 2 cols on desktop */}
      <div className="card" style={{ border:'1px solid rgba(0,0,0,0.06)', borderRadius:10, padding:16 }}>
        <div style={{ display:'grid', gap:16, gridTemplateColumns: topGridCols }}>
          <div className="media">
            {/* Main image on the left, thumbnails on the right for ALL viewports */}
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ position:'relative', flex:1 }}>
                {hasCompare && <div style={{ position:'absolute', top:8, left:8, background:'crimson', color:'#fff', padding:'4px 8px', borderRadius:4, fontSize:12, fontWeight:700, zIndex:2 }}>{discountPct}%</div>}
                <img src={toAbsoluteUrl(activeImage || product.image_url)} alt={product.title} style={{ width:'100%', borderRadius:8, objectFit:'contain', maxHeight: '70vh', background:'var(--card-bg, #f7f8fb)' }} />
              </div>
              {product.images && product.images.length > 0 && (
                <div className="thumbs-vert" style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:'70vh', overflowY:'auto', width:84 }}>
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
        </div>
      </div>
      </div>
      {similar.length > 0 && (
        <div className="mt-24">
          <h4 style={{ margin: '0 0 12px 0' }}>Similar Products</h4>
          {/* Responsive grid: 1 per row on small screens, 2+ on larger; use ProductCard for full details */}
          <div className="products-grid" style={{ display:'grid', gap:12, width:'100%', gridTemplateColumns:`repeat(${similarCols}, 1fr)` }}>
            {similar.map((sp, idx) => (
              <ProductCard key={sp.id} product={sp} index={idx} />
            ))}
          </div>
        </div>
      )}
      {vw < 1024 && (
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
      )}
    </div>
  );
}

