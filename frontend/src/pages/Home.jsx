import { useEffect, useState } from 'react';
import { fetchProducts, fetchFeaturedProducts } from '../api/products';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';

export default function Home() {
  const [params, setParams] = useState({ page: 1, limit: 80, q: '', category: '' });
  const [data, setData] = useState({ items: [], total: 0 });
  const useFeatured = params.page === 1 && !params.q && !params.category;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (useFeatured) {
          const fd = await fetchFeaturedProducts();
          if (isMounted) setData({ items: fd.items || [], total: (fd.items || []).length });
        } else {
          const pd = await fetchProducts(params);
          if (isMounted) setData(pd);
        }
      } catch (e) {
        if (isMounted) setData({ items: [], total: 0 });
      }
    })();
    return () => { isMounted = false; };
  }, [params, useFeatured]);

  return (
    <div>
      <SearchBar onSearch={(q)=>setParams(p=>({ ...p, q, page:1 }))} />
      <CategoryFilter onChange={(category)=>setParams(p=>({ ...p, category, page:1 }))} />
      {useFeatured && (
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center', margin:'8px 0 4px 0' }}>
          <h3 style={{ margin:0 }}>Featured</h3>
          <span className="small muted">Curated by Admin</span>
        </div>
      )}
      <div className="grid">
        {data.items.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
      {!useFeatured && (
        <Pagination page={params.page} total={data.total} limit={params.limit}
          onPageChange={(page)=>setParams(p=>({ ...p, page }))} />
      )}
    </div>
  );
}

