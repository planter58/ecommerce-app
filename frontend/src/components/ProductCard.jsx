import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl, toCoverUrl } from '../utils/media';

function ProductCard({ product, index = 0 }) {
  const original = product.image_url || (product.images && product.images[0]?.url) || '';
  const cover = toAbsoluteUrl(original);
  const coverTransformed = toCoverUrl(original);
  const hasCompare = typeof product.compare_at_price_cents === 'number' && product.compare_at_price_cents > 0 && product.compare_at_price_cents > product.price_cents;
  const discountPct = hasCompare ? Math.round((1 - (product.price_cents / product.compare_at_price_cents)) * 100) : 0;
  const [loaded, setLoaded] = useState(false);
  const imgPriority = useMemo(() => ({
    loading: index < 8 ? 'eager' : 'lazy',
    fetchPriority: index < 8 ? 'high' : 'auto'
  }), [index]);
  return (
    <div className="card" style={{ position:'relative' }}>
      <Link
        to={`/product/${product.id}`}
        className="link"
        style={{ textDecoration: 'none' }}
      >
        <div
          style={{
            position:'relative',
            background:'var(--card-bg, transparent)',
            overflow:'hidden',
            width: '100%',
            aspectRatio: '4 / 3', // enforce uniform frame like Jumia
            // Improve scroll perf by skipping offscreen rendering
            contentVisibility: 'auto',
            containIntrinsicSize: '300px 225px',
          }}
        >
          {hasCompare && (
            <div style={{ position:'absolute', top:8, left:8, background:'crimson', color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:12, fontWeight:700, zIndex:3 }}>
              {discountPct}%
            </div>
          )}
          {!loaded && (
            <div aria-hidden style={{ position:'absolute', inset:0, background:'rgba(128,128,128,0.08)', zIndex:1 }} />
          )}
          <img
            className="cover"
            src={coverTransformed || cover}
            alt={product.title}
            loading={imgPriority.loading}
            decoding="async"
            fetchpriority={imgPriority.fetchPriority}
            width="400"
            height="300"
            onLoad={() => setLoaded(true)}
            style={{
              position:'absolute',
              inset:0,
              width:'100%',
              height:'100%',
              objectFit:'contain',
              display:'block',
              zIndex:2,
              opacity: loaded ? 1 : 0,
              transition:'opacity 180ms ease-out'
            }}
          />
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

const areEqual = (prev, next) => (
  prev.product.id === next.product.id &&
  prev.product.image_url === next.product.image_url &&
  prev.product.cover_image_url === next.product.cover_image_url &&
  prev.product.title === next.product.title &&
  prev.product.price_cents === next.product.price_cents &&
  prev.product.compare_at_price_cents === next.product.compare_at_price_cents
);

export default React.memo(ProductCard, areEqual);
