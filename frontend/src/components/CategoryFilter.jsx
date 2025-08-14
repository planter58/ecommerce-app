import { useEffect, useState } from 'react';
import api from '../api/client';

export default function CategoryFilter({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('');
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)); }, []);
  // Only show curated set on mobile chips; robust matching (name or slug)
  const norm = (s) => String(s || '').trim().toLowerCase();
  const curated = [
    { keys: ['electronics'], label: 'Electronics' },
    { keys: ['clothing', 'clothings'], label: 'Clothings' },
    { keys: ['kitchenware', 'kitchen', 'kitchen-ware'], label: 'Kitchenware' },
  ];
  const findCat = (keys) => categories.find(c => {
    const n = norm(c.name);
    const s = norm(c.slug);
    return keys.includes(n) || keys.includes(s);
  });
  const mobileCats = curated
    .map(({ keys, label }) => {
      const c = findCat(keys);
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
