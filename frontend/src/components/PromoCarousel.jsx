import { useEffect, useMemo, useRef, useState } from 'react';

// A reusable promotional carousel with auto-scroll, swipe, infinite loop, and dots
export default function PromoCarousel({ items, className }) {
  const defaultItems = useMemo(() => (
    [
      { id: 'p1', title: 'Mega Sale • Up to 50% Off', image: null, bg: 'linear-gradient(135deg,#5b7cfa,#7f53ac)', text: 'Shop now and save big on top categories', link: '#' },
      { id: 'p2', title: 'Free Delivery • Orders over $50', image: null, bg: 'linear-gradient(135deg,#00c6ff,#0072ff)', text: 'Fast, reliable shipping on thousands of items', link: '#' },
      { id: 'p3', title: 'New Arrivals • Fresh Picks', image: null, bg: 'linear-gradient(135deg,#ff9966,#ff5e62)', text: 'Discover the latest products for you', link: '#' },
    ]
  ), []);

  // Fetch from public API if items not provided
  const [serverItems, setServerItems] = useState(null);
  useEffect(() => {
    let mounted = true;
    if (!items) {
      (async () => {
        try {
          const res = await fetch('/api/ribbon', { credentials: 'same-origin' });
          if (!res.ok) throw new Error('Failed to load ribbon');
          const data = await res.json();
          if (mounted) setServerItems(Array.isArray(data) ? data : []);
        } catch {
          if (mounted) setServerItems([]);
        }
      })();
    }
    return () => { mounted = false; };
  }, [items]);

  const data = items?.length ? items : (serverItems && serverItems.length ? serverItems : defaultItems);

  // Infinite loop technique: clone first and last
  const extended = useMemo(() => {
    if (!data.length) return [];
    const first = data[0];
    const last = data[data.length - 1];
    return [last, ...data, first];
  }, [data]);

  const trackRef = useRef(null);
  const [index, setIndex] = useState(1); // start at the first real slide
  // start with transitions off to avoid initial flash/jump
  const [transition, setTransition] = useState(false);
  const [isHover, setIsHover] = useState(false);

  // Autoplay
  useEffect(() => {
    if (!extended.length) return;
    const id = setInterval(() => {
      if (!isHover) next();
    }, 4000);
    return () => clearInterval(id);
  }, [extended.length, isHover]);

  const onTransitionEnd = () => {
    if (!extended.length) return;
    if (index === extended.length - 1) {
      // jumped to cloned last -> snap to real first
      setTransition(false);
      setIndex(1);
    } else if (index === 0) {
      // jumped to cloned first -> snap to real last
      setTransition(false);
      setIndex(extended.length - 2);
    }
  };

  useEffect(() => {
    if (!transition) {
      const t = setTimeout(() => setTransition(true), 20);
      return () => clearTimeout(t);
    }
  }, [transition]);

  const next = () => setIndex(i => Math.min(i + 1, extended.length ? extended.length - 1 : i));
  const prev = () => setIndex(i => Math.max(i - 1, 0));

  // Swipe support
  const startX = useRef(0);
  const lastX = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (e) => {
    dragging.current = true;
    startX.current = e.touches[0].clientX;
    lastX.current = startX.current;
  };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    lastX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    if (!dragging.current) return;
    const dx = lastX.current - startX.current;
    dragging.current = false;
    if (Math.abs(dx) > 50) {
      if (dx < 0) next(); else prev();
    }
  };

  // Normalize current dot (exclude clones)
  const currentDot = useMemo(() => {
    if (!data.length) return 0;
    let i = index - 1;
    if (i < 0) i = data.length - 1;
    if (i >= data.length) i = 0;
    return i;
  }, [index, data.length]);

  return (
    <div className={(className ? `promo-carousel ${className}` : 'promo-carousel')} onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <div className="pc-viewport" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div
          className="pc-track"
          ref={trackRef}
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: transition ? 'transform .35s ease' : 'none'
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {extended.map((item, idx) => {
            const title = item.title || item.heading || 'Promotion';
            const body = item.body || item.text || '';
            const ctaLabel = item.cta_label || item.cta || '';
            const ctaUrl = item.cta_url || item.link || '#';
            const mediaUrl = item.media_url || item.image || null;
            const mediaType = item.media_type || (mediaUrl && mediaUrl.match(/\.mp4|\.webm|\.ogg/i) ? 'video' : (mediaUrl ? 'image' : ''));

            return (
              <div className="pc-slide" key={idx}>
                <div className="pc-card" style={{ background: item.bg || 'var(--surface-2)' }}>
                  <div className="pc-split" style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16, alignItems:'center', width:'100%', height:'100%' }}>
                    <div className="pc-split-left" style={{ padding:'12px 16px' }}>
                      <div className="pc-title" style={{ marginBottom:6 }}>{title}</div>
                      {body && <div className="pc-text" style={{ marginBottom:10 }}>{body}</div>}
                      {ctaLabel && (
                        <a href={ctaUrl} className="button" style={{ textDecoration:'none' }}>
                          {ctaLabel}
                        </a>
                      )}
                    </div>
                    <div className="pc-split-right" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'8px 12px' }}>
                      {mediaUrl ? (
                        mediaType === 'video' ? (
                          <video
                            src={mediaUrl}
                            className="pc-media"
                            style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:8 }}
                            muted
                            playsInline
                            autoPlay
                            loop
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={mediaUrl}
                            alt={title}
                            loading="lazy"
                            decoding="async"
                            className="pc-media"
                            style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:8, opacity:0, transition:'opacity .18s ease' }}
                            onLoad={(e)=>{ e.currentTarget.style.opacity = '1'; }}
                          />
                        )
                      ) : (
                        <div className="pc-media-placeholder" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-2)' }}>
                          No media
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* nav buttons (optional on desktop) */}
        <button className="pc-nav pc-prev" aria-label="Previous" onClick={prev}>
          ‹
        </button>
        <button className="pc-nav pc-next" aria-label="Next" onClick={next}>
          ›
        </button>
      </div>
      <div className="pc-dots">
        {data.map((_, i) => (
          <button
            key={i}
            className={"pc-dot" + (i === currentDot ? ' active' : '')}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i + 1)}
          />
        ))}
      </div>
    </div>
  );
}
