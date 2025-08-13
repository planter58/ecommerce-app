export default function SearchBar({ onSearch }) {
  let inputRef;
  const submit = (e) => { e.preventDefault(); onSearch?.(inputRef.value); };
  return (
    <form onSubmit={submit} className="toolbar searchbar">
      <span className="search-icon" aria-hidden>🔎</span>
      <input
        ref={(r)=>inputRef=r}
        className="input search-input"
        placeholder="Search for products, brands and more"
        aria-label="Search products"
      />
      <button type="submit" className="button search-btn">Search</button>
    </form>
  );
}
