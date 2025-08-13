import { useEffect, useState } from 'react';
import { fetchProducts } from '../api/products';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';

export default function Home() {
  const [params, setParams] = useState({ page: 1, limit: 40, q: '', category: '' });
  const [data, setData] = useState({ items: [], total: 0 });

  useEffect(() => { fetchProducts(params).then(setData); }, [params]);

  return (
    <div>
      <SearchBar onSearch={(q)=>setParams(p=>({ ...p, q, page:1 }))} />
      <CategoryFilter onChange={(category)=>setParams(p=>({ ...p, category, page:1 }))} />
      <div className="grid">
        {data.items.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
      <Pagination page={params.page} total={data.total} limit={params.limit}
        onPageChange={(page)=>setParams(p=>({ ...p, page }))} />
    </div>
  );
}

