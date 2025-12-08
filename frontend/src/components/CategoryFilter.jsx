import { useEffect, useState } from 'react';
import api from '../api/client';

export default function CategoryFilter({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)); }, []);
  
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Only show curated set on mobile chips; robust matching (name or slug)
  const norm = (s) => String(s || '').trim().toLowerCase();
  const curated = [
    { patterns: ['electronic', 'electronics', 'gadgets'], label: 'Electronics' },
    { patterns: ['clothing', 'cloth', 'clothings', 'clothes', 'apparel', 'fashion'], label: 'Clothings' },
    { patterns: ['kitchenware', 'kitchen', 'kitchen-items', 'kitchen_items', 'kitchen & dining', 'kitchen-dining'], label: 'Kitchenware' },
  ];
  const findCat = (patterns) => categories.find(c => {
    const n = norm(c.name);
    const s = norm(c.slug);
    return patterns.some(p => n === p || s === p || n.includes(p) || s.includes(p));
  });
  const mobileCats = curated
    .map(({ patterns, label }) => {
      const c = findCat(patterns);
      return c ? { ...c, __label: label } : null;
    })
    .filter(Boolean);
  
  // Calculate how many additional categories to show on larger screens
  const getDesktopCategoryCount = () => {
    if (viewportWidth < 768) return 0; // Mobile: show only curated
    if (viewportWidth < 1024) return 3; // Tablet: add 3 more
    if (viewportWidth < 1440) return 4; // Desktop: add 4 more
    return 5; // Large desktop: add 5 more
  };
  
  const additionalCount = getDesktopCategoryCount();
  const curatedSlugs = new Set(mobileCats.map(c => c.slug));
  const additionalCats = categories
    .filter(c => !curatedSlugs.has(c.slug))
    .slice(0, additionalCount);
  return (
    <div>
      {/* Desktop select with limited height (shows 10 items, rest scrollable) */}
      <div className="category-select">
        <select
          className="select"
          value={selected}
          onChange={(e)=>{setSelected(e.target.value); onChange?.(e.target.value);}}
          size={Math.min(categories.length + 1, 10)}
          style={{ 
            width: '100%',
            minHeight: '40px',
            maxHeight: '300px',
            overflowY: 'auto',
            display: viewportWidth >= 768 ? 'block' : 'none'
          }}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      {/* Mobile chips (curated only) + Desktop chips (curated + additional) */}
      <div className="category-chips" role="tablist" aria-label="Categories" style={{ maxWidth: '75vw', overflowX: 'auto', flexWrap: viewportWidth < 768 ? 'wrap' : 'nowrap' }}>
        <button
          role="tab"
          aria-selected={selected === ''}
          className={`chip ${selected === '' ? 'active' : ''}`}
          onClick={()=>{ setSelected(''); onChange?.(''); }}
        >All</button>
        {mobileCats.map(c => (
          <button
            key={c.id}
            role="tab"
            aria-selected={selected === c.slug}
            className={`chip ${selected === c.slug ? 'active' : ''}`}
            onClick={()=>{ setSelected(c.slug); onChange?.(c.slug); }}
          >{c.__label || c.name}</button>
        ))}
        {viewportWidth >= 768 && additionalCats.map(c => (
          <button
            key={c.id}
            role="tab"
            aria-selected={selected === c.slug}
            className={`chip ${selected === c.slug ? 'active' : ''}`}
            onClick={()=>{ setSelected(c.slug); onChange?.(c.slug); }}
          >{c.name}</button>
        ))}
      </div>
    </div>
  );
}
