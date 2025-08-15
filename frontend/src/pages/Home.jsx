import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchProducts, fetchFeaturedProducts } from '../api/products';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';

export default function Home() {
  const [params, setParams] = useState({ page: 1, limit: 40, q: '', category: '' });
  const [data, setData] = useState({ items: [], total: 0 });
  const isFeaturedMode = !params.q && !params.category;
  // Cache featured list, remaining pages, and combined page slices to avoid refetching
  // and recomputation when navigating between pages. Also preserve stable identity
  // to prevent unnecessary re-renders.
  const cacheRef = useRef({
    featured: null,
    featuredIds: [],
    remainingTotal: 0,
    remainingPages: new Map(), // key: page number, value: items[]
    productById: new Map(),    // stable object identity map for products
    combinedPages: new Map(),  // key: page number, value: items[] (featured-first)
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
            // seed productById for stable identities
            for (const p of featured) cacheRef.current.productById.set(p.id, p);
          }
          const featuredIds = cacheRef.current.featuredIds;

          // 2) Load the remaining products excluding featured, with pagination math
          const limit = params.limit;
          const page = params.page;
          // Effective index in the combined list (0-based)
          const startIndex = (page - 1) * limit;
          let items = [];
          let total = 0;

          // If page 1 and we don't yet have combined cache, pre-render featured immediately
          if (page === 1) {
            const combinedCached = cacheRef.current.combinedPages.get(1);
            if (!combinedCached) {
              const prelim = featured.map(p => cacheRef.current.productById.get(p.id) || p);
              if (isMounted && prelim.length) {
                setData(prev => {
                  const same = prev.items.length === prelim.length && prev.items.every((x, i) => x.id === prelim[i].id);
                  return same ? prev : { items: prelim, total: prelim.length };
                });
                cacheRef.current.combinedPages.set(1, prelim);
              }
            }
          }

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
            for (const p of firstPage) cacheRef.current.productById.set(p.id, p);
          }
          total = featured.length + remainingTotal;

          // Serve from combined cache if present
          const combinedCached = cacheRef.current.combinedPages.get(page);
          if (combinedCached) {
            items = combinedCached;
          } else if (page === 1) {
            // Page 1 starts with all featured, followed by remaining
            const restNeed = Math.max(0, limit - featured.length);
            let rest = firstPage || [];
            if (restNeed > rest.length) {
              // fetch next page to fill
              let page2 = cacheRef.current.remainingPages.get(2);
              if (!page2) {
                try {
                  const nextPage = await fetchProducts({ ...remainingParams, page: 2 });
                  page2 = nextPage.items || [];
                } catch {
                  page2 = [];
                }
                cacheRef.current.remainingPages.set(2, page2);
                for (const p of page2) cacheRef.current.productById.set(p.id, p);
              }
              rest = rest.concat(page2);
            }
            const list = featured.concat(rest.slice(0, restNeed));
            // remap to stable objects
            items = list.map(p => cacheRef.current.productById.get(p.id) || p);
            // Keep stable reference for page 1 combined array
            const existing = cacheRef.current.combinedPages.get(1);
            if (existing) {
              existing.length = 0;
              existing.push(...items);
              items = existing; // reuse stable ref
            } else {
              cacheRef.current.combinedPages.set(1, items);
            }
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
                    try {
                      const nextPage = await fetchProducts({ ...remainingParams, page: 2 });
                      page2 = nextPage.items || [];
                    } catch {
                      page2 = [];
                    }
                    cacheRef.current.remainingPages.set(2, page2);
                    for (const p of page2) cacheRef.current.productById.set(p.id, p);
                  }
                  rest = rest.concat(page2);
                }
                const list = featuredTail.concat(rest.slice(0, need));
                items = list.map(p => cacheRef.current.productById.get(p.id) || p);
              } else {
                items = featuredTail.map(p => cacheRef.current.productById.get(p.id) || p);
              }
            } else {
              // Fully in remaining range. Compute which remaining page(s) to request.
              const remainingPage = Math.floor(remainingStart / limit) + 1;
              const indexInPage = remainingStart % limit;
              let pageAItems = cacheRef.current.remainingPages.get(remainingPage);
              if (!pageAItems) {
                try {
                  const pageA = await fetchProducts({ ...remainingParams, page: remainingPage });
                  pageAItems = pageA.items || [];
                } catch {
                  pageAItems = [];
                }
                cacheRef.current.remainingPages.set(remainingPage, pageAItems);
                for (const p of pageAItems) cacheRef.current.productById.set(p.id, p);
              }
              let pool = pageAItems;
              if (indexInPage + limit > pool.length) {
                let pageBItems = cacheRef.current.remainingPages.get(remainingPage + 1);
                if (!pageBItems) {
                  try {
                    const pageB = await fetchProducts({ ...remainingParams, page: remainingPage + 1 });
                    pageBItems = pageB.items || [];
                  } catch {
                    pageBItems = [];
                  }
                  cacheRef.current.remainingPages.set(remainingPage + 1, pageBItems);
                  for (const p of pageBItems) cacheRef.current.productById.set(p.id, p);
                }
                pool = pool.concat(pageBItems);
              }
              const slice = pool.slice(indexInPage, indexInPage + limit);
              items = slice.map(p => cacheRef.current.productById.get(p.id) || p);
            }
            cacheRef.current.combinedPages.set(page, items);
          }

          if (isMounted) setData(prev => {
            const same = prev.total === total && prev.items.length === items.length && prev.items.every((x, i) => x.id === items[i].id);
            return same ? prev : { items, total };
          });
        } else {
          let pd;
          try {
            pd = await fetchProducts(params);
          } catch {
            // keep previous data on error
            pd = { items: (data?.items||[]), total: (data?.total||0) };
          }
          if (isMounted) setData(prev => {
            const items = pd.items || [];
            const total = pd.total || 0;
            const same = prev.total === total && prev.items.length === items.length && prev.items.every((x, i) => x.id === items[i].id);
            return same ? prev : { items, total };
          });
        }
      } catch (e) {
        // Keep previous data on transient errors to avoid empty flashes
      }
    })();
    return () => { isMounted = false; };
  }, [params, isFeaturedMode]);

  // Always reset scroll to top when changing page, query, or category
  useLayoutEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      // no-op
    }
  }, [params.page, params.q, params.category]);

  // After initial paint, prefetch remainder page 2 (featured mode, page 1 only) during idle time
  useEffect(() => {
    if (!isFeaturedMode || params.page !== 1) return;
    const featured = cacheRef.current.featured || [];
    const featuredIds = cacheRef.current.featuredIds || [];
    const remainingParams = { ...params, q: '', category: '', page: 2, exclude_ids: featuredIds.join(',') };
    // If we already have page 2 cached, skip
    if (cacheRef.current.remainingPages.get(2)) return;
    const prefetch = async () => {
      try {
        const resp = await fetchProducts(remainingParams);
        const page2 = resp.items || [];
        cacheRef.current.remainingPages.set(2, page2);
        for (const p of page2) cacheRef.current.productById.set(p.id, p);
      } catch {
        // ignore prefetch errors
      }
    };
    const schedule = (cb) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => cb(), { timeout: 1500 });
      } else {
        setTimeout(cb, 0);
      }
    };
    schedule(prefetch);
  }, [isFeaturedMode, params.page, params.limit, params.q, params.category]);

  // Fallback to cached combined slice to avoid blank flashes during fast transitions
  const itemsToRender = useMemo(() => {
    const primary = (data.items && data.items.length) ? data.items : null;
    if (primary) return primary;
    const cached = isFeaturedMode ? cacheRef.current.combinedPages.get(params.page) : null;
    return cached || [];
  }, [isFeaturedMode, params.page, data.items, data.items?.length]);

  return (
    <div>
      <SearchBar onSearch={(q)=>setParams(p=>({ ...p, q, page:1 }))} />
      <CategoryFilter onChange={(category)=>setParams(p=>({ ...p, category, page:1 }))} />
      <div className="grid" style={{ willChange:'transform', transform:'translateZ(0)', backfaceVisibility:'hidden', contain:'layout paint' }}>
        {itemsToRender.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </div>
      {((data.total || 0) > params.limit) && (
        <Pagination page={params.page} total={data.total} limit={params.limit}
          onPageChange={(page)=>setParams(p=>({ ...p, page }))} />
      )}
    </div>
  );
}

