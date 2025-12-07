import { useRef } from 'react';

export default function Pagination({ page, total, limit, onPageChange }) {
  const lastFireRef = useRef(0);
  const pages = Math.ceil(total / limit) || 1;
  const canPrev = page > 1;
  const canNext = page < pages;
  const go = (next) => {
    const clamped = Math.min(pages, Math.max(1, next));
    if (clamped !== page) {
      // Let the parent component handle scroll behavior
      onPageChange?.(clamped);
    }
  };

  const handleClick = (e, newPage) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastFireRef.current < 300) return;
    lastFireRef.current = now;
    if (newPage >= 1 && newPage <= pages && newPage !== page) {
      go(newPage);
    }
  };

  return (
    <div className="pagination" style={{ display:'flex', alignItems:'center', gap:12, marginTop:24, marginBottom:24, padding:'8px 0' }}>
      <button
        type="button"
        className="button ghost"
        style={{ minWidth:44, minHeight:44, padding:'12px 16px', fontSize:16, borderRadius:12, touchAction:'manipulation', cursor: canPrev ? 'pointer' : 'not-allowed' }}
        onClick={(e) => handleClick(e, 1)}
        disabled={!canPrev}
        aria-disabled={!canPrev}
        aria-label="First page"
      >
        First
      </button>
      <button
        type="button"
        className="button ghost"
        style={{ minWidth:44, minHeight:44, padding:'12px 16px', fontSize:16, borderRadius:12, touchAction:'manipulation', cursor: canPrev ? 'pointer' : 'not-allowed' }}
        onClick={(e) => handleClick(e, page - 1)}
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
        style={{ minWidth:44, minHeight:44, padding:'12px 16px', fontSize:16, borderRadius:12, touchAction:'manipulation', cursor: canNext ? 'pointer' : 'not-allowed' }}
        onClick={(e) => handleClick(e, page + 1)}
        disabled={!canNext}
        aria-disabled={!canNext}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}
