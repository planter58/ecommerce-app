import { useEffect, useRef, useState } from 'react';
import { fetchProducts, fetchFeaturedProducts } from '../api/products';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';

export default function Home() {
  const [params, setParams] = useState({ page: 1, limit: 40, q: '', category: '' });
  const [data, setData] = useState({ items: [], total: 0 });
  const isFeaturedMode = !params.q && !params.category;
  // Cache featured list and remaining pages to avoid refetching when navigating back
  const cacheRef = useRef({
    featured: null,
    featuredIds: [],
    remainingTotal: 0,
    remainingPages: new Map(), // key: page number, value: items[]
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (isFeaturedMode) {
          // 1) Load curated featured (fixed order)
          let featured = cacheRef.current.featured;
          if (!featured) {
            const fd = await fetchFeaturedProducts();
            featured = Array.isArray(fd.items) ? fd.items : [];
            cacheRef.current.featured = featured;
            cacheRef.current.featuredIds = featured.map(p => p.id);
          }
          const featuredIds = cacheRef.current.featuredIds;

          // 2) Load the remaining products excluding featured, with pagination math
          const limit = params.limit;
          const page = params.page;
          // Effective index in the combined list (0-based)
          const startIndex = (page - 1) * limit;
          let items = [];
          let total = 0;

          // Count remaining total (via first call) and build page slice
          const remainingParams = { ...params, q: '', category: '', page: 1, exclude_ids: featuredIds.join(',') };
          let firstPage = cacheRef.current.remainingPages.get(1);
          let remainingTotal = cacheRef.current.remainingTotal;
          if (!firstPage || !remainingTotal) {
            const resp = await fetchProducts(remainingParams);
            firstPage = resp.items || [];
            remainingTotal = resp.total || 0;
            cacheRef.current.remainingPages.set(1, firstPage);
            cacheRef.current.remainingTotal = remainingTotal;
          }
          total = featured.length + remainingTotal;

          if (page === 1) {
            // Page 1 starts with all featured, followed by remaining
            const restNeed = Math.max(0, limit - featured.length);
            let rest = firstPage || [];
            if (restNeed > rest.length) {
              // fetch next page to fill
              let page2 = cacheRef.current.remainingPages.get(2);
              if (!page2) {
                const nextPage = await fetchProducts({ ...remainingParams, page: 2 });
                page2 = nextPage.items || [];
                cacheRef.current.remainingPages.set(2, page2);
              }
              rest = rest.concat(page2);
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
                let rest = firstPage || [];
                if (need > rest.length) {
                  let page2 = cacheRef.current.remainingPages.get(2);
                  if (!page2) {
                    const nextPage = await fetchProducts({ ...remainingParams, page: 2 });
                    page2 = nextPage.items || [];
                    cacheRef.current.remainingPages.set(2, page2);
                  }
                  rest = rest.concat(page2);
                }
                items = featuredTail.concat(rest.slice(0, need));
              } else {
                items = featuredTail;
              }
            } else {
              // Fully in remaining range. Compute which remaining page(s) to request.
              const remainingPage = Math.floor(remainingStart / limit) + 1;
              const indexInPage = remainingStart % limit;
              let pageAItems = cacheRef.current.remainingPages.get(remainingPage);
              if (!pageAItems) {
                const pageA = await fetchProducts({ ...remainingParams, page: remainingPage });
                pageAItems = pageA.items || [];
                cacheRef.current.remainingPages.set(remainingPage, pageAItems);
              }
              let pool = pageAItems;
              if (indexInPage + limit > pool.length) {
                let pageBItems = cacheRef.current.remainingPages.get(remainingPage + 1);
                if (!pageBItems) {
                  const pageB = await fetchProducts({ ...remainingParams, page: remainingPage + 1 });
                  pageBItems = pageB.items || [];
                  cacheRef.current.remainingPages.set(remainingPage + 1, pageBItems);
                }
                pool = pool.concat(pageBItems);
              }
              items = pool.slice(indexInPage, indexInPage + limit);
            }
          }

          if (isMounted) setData(prev => {
            const same = prev.total === total && prev.items.length === items.length && prev.items.every((x, i) => x.id === items[i].id);
            return same ? prev : { items, total };
          });
        } else {
          const pd = await fetchProducts(params);
          if (isMounted) setData(prev => {
            const items = pd.items || [];
            const total = pd.total || 0;
            const same = prev.total === total && prev.items.length === items.length && prev.items.every((x, i) => x.id === items[i].id);
            return same ? prev : { items, total };
          });
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
      {data.total > params.limit && (
        <Pagination page={params.page} total={data.total} limit={params.limit}
          onPageChange={(page)=>setParams(p=>({ ...p, page }))} />
      )}
    </div>
  );
}

