import { useEffect, useState } from 'react';
import api from '../api/client';

export default function CategoryFilter({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('');
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)); }, []);
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
      {/* Mobile chips */}
      <div className="category-chips" role="tablist" aria-label="Categories">
        <button
          role="tab"
          aria-selected={selected === ''}
          className={`chip ${selected === '' ? 'active' : ''}`}
          onClick={()=>{ setSelected(''); onChange?.(''); }}
        >All</button>
        {categories.map(c => (
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
