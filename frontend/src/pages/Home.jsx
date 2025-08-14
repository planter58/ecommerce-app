import { useEffect, useState } from 'react';
import { fetchProducts, fetchFeaturedProducts } from '../api/products';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';

export default function Home() {
  const [params, setParams] = useState({ page: 1, limit: 80, q: '', category: '' });
  const [data, setData] = useState({ items: [], total: 0 });
  const isFeaturedMode = !params.q && !params.category;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (isFeaturedMode) {
          // 1) Load curated featured (fixed order)
          const fd = await fetchFeaturedProducts();
          const featured = Array.isArray(fd.items) ? fd.items : [];
          const featuredIds = featured.map(p => p.id);

          // 2) Load the remaining products excluding featured, with pagination math
          const limit = params.limit;
          const page = params.page;
          // Effective index in the combined list (0-based)
          const startIndex = (page - 1) * limit;
          let items = [];
          let total = 0;

          // Count remaining total (via first call) and build page slice
          const remainingParams = { ...params, q: '', category: '', page: 1, exclude_ids: featuredIds.join(',') };
          const firstPage = await fetchProducts(remainingParams);
          const remainingTotal = firstPage.total || 0;
          total = featured.length + remainingTotal;

          if (page === 1) {
            // Page 1 starts with all featured, followed by remaining
            const restNeed = Math.max(0, limit - featured.length);
            let rest = firstPage.items || [];
            if (restNeed > rest.length) {
              // fetch next page to fill
              const nextPage = await fetchProducts({ ...remainingParams, page: 2 });
              rest = rest.concat(nextPage.items || []);
            }
            items = featured.concat(rest.slice(0, restNeed));
          } else {
            // Subsequent pages show only remaining, offset by featured.length
            const remainingStart = startIndex - featured.length; // may be >= 0
            if (remainingStart < 0) {
              // Still within featured range: show tail of featured + some remaining
              const featuredTail = featured.slice(startIndex, featured.length);
              const need = Math.max(0, limit - featuredTail.length);
              let bucketPage = 1;
              if (need > 0) {
                // fetch the first remaining page(s)
                let rest = firstPage.items || [];
                if (need > rest.length) {
                  const nextPage = await fetchProducts({ ...remainingParams, page: 2 });
                  rest = rest.concat(nextPage.items || []);
                }
                items = featuredTail.concat(rest.slice(0, need));
              } else {
                items = featuredTail;
              }
            } else {
              // Fully in remaining range. Compute which remaining page(s) to request.
              const remainingPage = Math.floor(remainingStart / limit) + 1;
              const indexInPage = remainingStart % limit;
              const pageA = await fetchProducts({ ...remainingParams, page: remainingPage });
              let pool = pageA.items || [];
              if (indexInPage + limit > pool.length) {
                const pageB = await fetchProducts({ ...remainingParams, page: remainingPage + 1 });
                pool = pool.concat(pageB.items || []);
              }
              items = pool.slice(indexInPage, indexInPage + limit);
            }
          }

          if (isMounted) setData({ items, total });
        } else {
          const pd = await fetchProducts(params);
          if (isMounted) setData(pd);
        }
      } catch (e) {
        if (isMounted) setData({ items: [], total: 0 });
      }
    })();
    return () => { isMounted = false; };
  }, [params, isFeaturedMode]);

  return (
    <div>
      <SearchBar onSearch={(q)=>setParams(p=>({ ...p, q, page:1 }))} />
      <CategoryFilter onChange={(category)=>setParams(p=>({ ...p, category, page:1 }))} />
      <div className="grid">
        {data.items.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
      {!isFeaturedMode && (
        <Pagination page={params.page} total={data.total} limit={params.limit}
          onPageChange={(page)=>setParams(p=>({ ...p, page }))} />
      )}
    </div>
  );
}

