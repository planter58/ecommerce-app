import { useEffect, useState } from 'react';
import api from '../api/client';

export default function CategoryFilter({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('');
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)); }, []);
  // Only show a curated set on mobile chips
  const allowedNames = ['electronics', 'clothings', 'kitchenware'];
  const mobileCats = categories.filter(c => allowedNames.includes(String(c.name || '').toLowerCase()));
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
          >{c.name}</button>
        ))}
      </div>
    </div>
  );
}
