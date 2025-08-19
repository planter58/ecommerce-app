import { useRef } from 'react';

export default function Pagination({ page, total, limit, onPageChange }) {
  const lastFireRef = useRef(0);
  const pages = Math.ceil(total / limit) || 1;
  const canPrev = page > 1;
  const canNext = page < pages;
  const go = (next) => {
    const clamped = Math.min(pages, Math.max(1, next));
    if (clamped !== page) {
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
      onPageChange?.(clamped);
    }
  };

  const debounceEvent = (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastFireRef.current < 200) return false;
    lastFireRef.current = now;
    return true;
  };

  const onFirst = (e) => { if (!debounceEvent(e)) return; if (canPrev) go(1); };
  const onPrev  = (e) => { if (!debounceEvent(e)) return; if (canPrev) go(page - 1); };
  const onNext  = (e) => { if (!debounceEvent(e)) return; if (canNext) go(page + 1); };
  return (
    <div className="pagination" style={{ display:'flex', alignItems:'center', gap:12 }}>
      <button
        type="button"
        className="button ghost"
        style={{ minWidth:44, minHeight:44, padding:'12px 16px', fontSize:16, borderRadius:12, touchAction:'manipulation' }}
        onPointerUp={onFirst}
        onClick={onFirst}
        disabled={!canPrev}
        aria-disabled={!canPrev}
        aria-label="First page"
      >
        First
      </button>
      <button
        type="button"
        className="button ghost"
        style={{ minWidth:44, minHeight:44, padding:'12px 16px', fontSize:16, borderRadius:12, touchAction:'manipulation' }}
        onPointerUp={onPrev}
        onClick={onPrev}
        disabled={!canPrev}
        aria-disabled={!canPrev}
        aria-label="Previous page"
      >
        Prev
      </button>
      <span className="small" style={{ padding:'0 4px', userSelect:'none' }}>Page {page} of {pages}</span>
      <button
        type="button"
        className="button ghost"
        style={{ minWidth:44, minHeight:44, padding:'12px 16px', fontSize:16, borderRadius:12, touchAction:'manipulation' }}
        onPointerUp={onNext}
        onClick={onNext}
        disabled={!canNext}
        aria-disabled={!canNext}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}
