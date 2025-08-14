import { useEffect, useState } from 'react';
import api from '../api/client';

export default function CategoryFilter({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('');
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)); }, []);
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
  return (
    <div>
      {/* Desktop select */}
      <div className="category-select">
        <select
          className="select"
          value={selected}
          onChange={(e)=>{setSelected(e.target.value); onChange?.(e.target.value);}}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      {/* Mobile chips (curated) */}
      <div className="category-chips" role="tablist" aria-label="Categories">
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
      </div>
    </div>
  );
}
