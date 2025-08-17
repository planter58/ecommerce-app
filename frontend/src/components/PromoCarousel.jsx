import { useEffect, useMemo, useRef, useState } from 'react';

// A reusable promotional carousel with auto-scroll, swipe, infinite loop, and dots
export default function PromoCarousel({ items }) {
  const defaultItems = useMemo(() => (
    [
      { id: 'p1', title: 'Mega Sale • Up to 50% Off', image: null, bg: 'linear-gradient(135deg,#5b7cfa,#7f53ac)', text: 'Shop now and save big on top categories', link: '#' },
      { id: 'p2', title: 'Free Delivery • Orders over $50', image: null, bg: 'linear-gradient(135deg,#00c6ff,#0072ff)', text: 'Fast, reliable shipping on thousands of items', link: '#' },
      { id: 'p3', title: 'New Arrivals • Fresh Picks', image: null, bg: 'linear-gradient(135deg,#ff9966,#ff5e62)', text: 'Discover the latest products for you', link: '#' },
    ]
  ), []);

  const data = items?.length ? items : defaultItems;

  // Infinite loop technique: clone first and last
  const extended = useMemo(() => {
    if (!data.length) return [];
    const first = data[0];
    const last = data[data.length - 1];
    return [last, ...data, first];
  }, [data]);

  const trackRef = useRef(null);
  const [index, setIndex] = useState(1); // start at the first real slide
  const [transition, setTransition] = useState(true);
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
    <div className="promo-carousel" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <div className="pc-viewport" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div
          className="pc-track"
          ref={trackRef}
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: transition ? 'transform .45s ease' : 'none'
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {extended.map((item, idx) => (
            <div className="pc-slide" key={idx}>
              <a className="pc-card" href={item.link || '#'} style={{ background: item.bg || undefined }}>
                {item.image ? (
                  <img src={item.image} alt={item.title || 'promo'} />
                ) : (
                  <div className="pc-content">
                    <div className="pc-title">{item.title}</div>
                    {item.text && <div className="pc-text">{item.text}</div>}
                  </div>
                )}
              </a>
            </div>
          ))}
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
