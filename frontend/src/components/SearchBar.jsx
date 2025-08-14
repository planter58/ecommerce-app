import { useEffect, useRef, useState } from 'react';
import { fetchProducts } from '../api/products';

export default function SearchBar({ onSearch }) {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    onSearch?.(q.trim());
    setOpen(false);
  };

  // Fetch suggestions as user types (debounced)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setSuggestions([]);
        setOpen(false);
        onSearch?.(''); // cleared: reload all products
        return;
      }
      try {
        const data = await fetchProducts({ q: term, limit: 5 });
        setSuggestions(data.items || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 180);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  const onPick = (s) => {
    const title = (s.title || '').trim();
    setQ(title);
    onSearch?.(title);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <form onSubmit={submit} className="toolbar searchbar" style={{ position:'relative' }}>
      <span className="search-icon" aria-hidden>🔎</span>
      <input
        ref={inputRef}
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        onKeyDown={onKeyDown}
        className="input search-input"
        placeholder="Search for products, brands and more"
        aria-label="Search products"
        autoComplete="off"
      />
      <button type="submit" className="button search-btn">Search</button>

      {open && suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {suggestions.map(s => (
            <li key={s.id} role="option">
              <button type="button" className="suggestion" onClick={() => onPick(s)}>
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
