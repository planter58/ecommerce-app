import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '../utils/media';

export default function ProductCard({ product }) {
  const cover = toAbsoluteUrl(product.image_url || (product.images && product.images[0]?.url) || '');
  const hasCompare = typeof product.compare_at_price_cents === 'number' && product.compare_at_price_cents > 0 && product.compare_at_price_cents > product.price_cents;
  const discountPct = hasCompare ? Math.round((1 - (product.price_cents / product.compare_at_price_cents)) * 100) : 0;
  return (
    <div className="card" style={{ position:'relative' }}>
      <Link to={`/product/${product.id}`} className="link" style={{ textDecoration: 'none' }}>
        <div style={{ position:'relative' }}>
          {hasCompare && <div style={{ position:'absolute', top:8, left:8, background:'crimson', color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:12, fontWeight:700 }}>{discountPct}%</div>}
          <img className="cover" src={cover} alt={product.title} />
        </div>
        <div className="body">
          <h4 className="title">{product.title}</h4>
          <div className="price" style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span>KSh {(product.price_cents/100).toFixed(2)}</span>
            {hasCompare && (
              <span className="muted" style={{ textDecoration:'line-through', opacity:0.6 }}>KSh {(product.compare_at_price_cents/100).toFixed(2)}</span>
            )}
          </div>
          <div className="meta" style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {product.category_name && <span>{product.category_name}</span>}
            {typeof product.stock === 'number' && <span>Stock: {product.stock}</span>}
            {typeof product.avg_rating !== 'undefined' && (
              <span>★ {Number(product.avg_rating).toFixed(1)} ({product.rating_count || 0})</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
