import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client.js';

// A reusable promotional carousel with auto-scroll, swipe, infinite loop, and dots
export default function PromoCarousel({ items, className, mode }) {
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
          const { data } = await api.get('/ribbon');
          if (mounted) setServerItems(Array.isArray(data) ? data : []);
        } catch {
          if (mounted) setServerItems([]);
        }
      })();
    }
    return () => { mounted = false; };
  }, [items]);

  const data = items?.length ? items : (serverItems && serverItems.length ? serverItems : defaultItems);

  // Group items into slides
  // - compact mode: 1 item per slide (1-at-a-time)
  // - default: up to 4 per slide [hero, tile, tile, tile]
  const groups = useMemo(() => {
    if (!data.length) return [];
    const out = [];
    const groupSize = (mode === 'compact') ? 1 : 4;
    for (let i = 0; i < data.length; i += groupSize) out.push(data.slice(i, i + groupSize));
    return out;
  }, [data, mode]);

  // Infinite loop technique: clone first and last
  const extended = useMemo(() => {
    if (!groups.length) return [];
    const first = groups[0];
    const last = groups[groups.length - 1];
    return [last, ...groups, first];
  }, [groups]);

  const trackRef = useRef(null);
  const [index, setIndex] = useState(1); // start at the first real slide
  // start with transitions off to avoid initial flash/jump
  const [transition, setTransition] = useState(false);
  const [isHover, setIsHover] = useState(false);

  // Responsive: consider narrow screens
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth <= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
    if (!groups.length) return 0;
    let i = index - 1;
    if (i < 0) i = groups.length - 1;
    if (i >= groups.length) i = 0;
    return i;
  }, [index, groups.length]);

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
          {extended.map((group, idx) => {
            const hero = group[0];
            const tiles = group.slice(1);

            const titleDesktop = hero?.title || hero?.heading || 'Promotion';
            const titleMobile = hero?.title_mobile || titleDesktop;
            const title = isNarrow ? titleMobile : titleDesktop;
            const bodyDesktop = hero?.body || hero?.text || '';
            const bodyMobile = hero?.body_mobile || bodyDesktop;
            const body = isNarrow ? bodyMobile : bodyDesktop;
            const ctaDesktop = hero?.cta_label || hero?.cta || '';
            const ctaMobile = hero?.cta_label_mobile || ctaDesktop;
            const ctaLabel = isNarrow ? ctaMobile : ctaDesktop;
            const ctaUrl = hero?.cta_url || hero?.link || '#';
            const mediaUrl = hero?.media_url || hero?.image || null;
            const mediaType = hero?.media_type || (mediaUrl && mediaUrl.match(/\.mp4|\.webm|\.ogg/i) ? 'video' : (mediaUrl ? 'image' : ''));
            // Prefer explicit CSS background (e.g., gradient), then bg, then bg_color. Fallback to any item in the group.
            let bgStyle = hero?.background || hero?.bg || hero?.bg_color || '';
            if (!bgStyle) {
              const carrier = group.find(it => it && (it.background || it.bg || it.bg_color));
              bgStyle = carrier?.background || carrier?.bg || carrier?.bg_color || '';
            }
            if (!bgStyle) bgStyle = 'linear-gradient(135deg, #5b7cfa 0%, #4058d8 100%)';

            // Consider only tiles that actually have media; text-only tiles are ignored to avoid empty layouts
            const mediaTiles = tiles.filter(t => {
              const u = t?.media_url || t?.image || null;
              return !!u;
            });
            // For compact mode, pick a single media to show on the right: prefer hero media, else first media tile
            const compactMediaUrl = mediaUrl || (mediaTiles[0]?.media_url || mediaTiles[0]?.image || null);
            const compactMediaType = (() => {
              const u = compactMediaUrl;
              if (!u) return '';
              return (u.match(/\.mp4|\.webm|\.ogg/i) ? 'video' : 'image');
            })();
            // Determine if this slide should be a thin compact ribbon (minimal content)
            // If there is no hero media and no media-bearing tiles, render compact (even if body exists)
            const isMinimal = (!mediaUrl && mediaTiles.length === 0);
            const forceCompact = (mode === 'compact');

            return (
              <div className="pc-slide" key={idx}>
                <div className={"pc-card" + ((isMinimal || forceCompact) ? " compact" : "")} style={{ background: bgStyle }}>
                  {(isMinimal || forceCompact) ? (
                    <div style={{ height:'100%', display:'grid', gridTemplateColumns:'minmax(80px, 1fr) 2fr minmax(72px, 14%) auto', alignItems:'center', gap: isNarrow ? 10 : 20, padding: isNarrow ? '0 14px' : '0 40px' }}>
                      {/* Title (left) */}
                      <div className="pc-title" style={{ fontWeight:800, fontSize: isNarrow ? 14 : 18, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
                      {/* Body (middle) */}
                      <div className="pc-text" style={{ fontSize: isNarrow ? 13 : 16, fontWeight:800, opacity:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{body}</div>
                      {/* Media (right but slightly inset) */}
                      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'flex-end', overflow:'hidden', marginRight: isNarrow ? 8 : 24, background:'transparent' }}>
                        {compactMediaUrl ? (
                          compactMediaType === 'video' ? (
                            <video src={compactMediaUrl} style={{ height:'100%', width:'auto', maxWidth:'100%', objectFit:'contain', background:'transparent' }} muted playsInline autoPlay loop preload="metadata" />
                          ) : (
                            <img src={compactMediaUrl} alt={title} loading="lazy" decoding="async" style={{ height:'100%', width:'auto', maxWidth:'100%', objectFit:'contain', background:'transparent' }} />
                          )
                        ) : null}
                      </div>
                      {/* CTA label (far right as plain text) */}
                      <div className="pc-cta" style={{ fontWeight:800, fontSize: isNarrow ? 13 : 16, whiteSpace:'nowrap' }}>{ctaLabel}</div>
                    </div>
                  ) : (
                    <div className="pc-split" style={{ display:'grid', gridTemplateColumns: isNarrow ? '1fr' : '1.4fr 1fr', gap: isNarrow ? 16 : 28, alignItems:'stretch', width:'100%', height:'100%' }}>
                      {/* Left: Hero */}
                      <div className="pc-split-left" style={{ padding: isNarrow ? '12px 16px' : '20px 40px', display:'grid', gridTemplateRows:'auto 1fr auto', minHeight: isNarrow ? 160 : 220 }}>
                        <div className="pc-title" style={{ marginBottom:8, fontSize: isNarrow ? undefined : 20, fontWeight:800 }}>{title}</div>
                        {body && <div className="pc-text" style={{ marginBottom:14, fontSize: isNarrow ? undefined : 16, fontWeight:800 }}>{body}</div>}
                        {ctaLabel && (
                          <a href={ctaUrl} className="button" style={{ textDecoration:'none', alignSelf:'start' }}>
                            {ctaLabel}
                          </a>
                        )}
                      </div>
                      {/* Right: stacked tiles */}
                      <div className="pc-split-right" style={ isNarrow
                        ? { display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12, padding:'8px 12px' }
                        : { display:'grid', gridTemplateRows:`repeat(${Math.max(mediaTiles.length, 1)}, 1fr)`, gap:12, padding:'16px 40px' }
                      }>
                        {mediaTiles.length === 0 && null}
                        {mediaTiles.map((t, i) => {
                          const tTitle = t.title || t.heading || '';
                          const tMediaUrl = t.media_url || t.image || null;
                          const tType = t.media_type || (tMediaUrl && tMediaUrl.match(/\.mp4|\.webm|\.ogg/i) ? 'video' : (tMediaUrl ? 'image' : ''));
                          return (
                            <div key={i} className="pc-tile" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignItems:'center', borderRadius:8, background:'transparent', overflow:'hidden' }}>
                              <div style={{ padding:'8px 10px' }}>
                                <div className="pc-tile-title" style={{ fontWeight:600, fontSize:14, lineHeight:1.2 }}>{tTitle}</div>
                                {t.body && <div className="small muted" style={{ marginTop:4, fontSize:12, lineHeight:1.2 }}>{t.body}</div>}
                              </div>
                              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:6, overflow:'hidden', background:'transparent' }}>
                                {tMediaUrl ? (
                                  tType === 'video' ? (
                                    <video src={tMediaUrl} style={{ width:'100%', height:'100%', objectFit:'contain', background:'transparent' }} muted playsInline autoPlay loop preload="metadata" />
                                  ) : (
                                    <img src={tMediaUrl} alt={tTitle} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', background:'transparent' }} />
                                  )
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
      {groups.length > 1 && (
        <div className="pc-dots">
          {groups.map((_, i) => (
            <button
              key={i}
              className={"pc-dot" + (i === currentDot ? ' active' : '')}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
