export default function Pagination({ page, total, limit, onPageChange }) {
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
  return (
    <div className="pagination">
      <button type="button" className="button ghost" onClick={(e)=>{e.preventDefault(); go(1);}} disabled={!canPrev}>First</button>
      <button type="button" className="button ghost" onClick={(e)=>{e.preventDefault(); go(page - 1);}} disabled={!canPrev}>Prev</button>
      <span className="small">Page {page} of {pages}</span>
      <button type="button" className="button ghost" onClick={(e)=>{e.preventDefault(); go(page + 1);}} disabled={!canNext}>Next</button>
    </div>
  );
}
