import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchProducts, fetchFeaturedProducts } from '../api/products';
import ProductCard from '../components/ProductCard';
import Pagination from '../components/Pagination';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';
import PromoCarousel from '../components/PromoCarousel';

export default function Home() {
  const [params, setParams] = useState({ page: 1, limit: 40, q: '', category: '' });
  // Keep track of which page the data was fetched for to avoid showing stale responses
  const [data, setData] = useState({ items: [], total: 0, pageTag: 1 });
  const [isLoading, setIsLoading] = useState(false);
  // Retry tag to re-trigger fetching when login finishes and token becomes available
  const [reloadTag, setReloadTag] = useState(0);
  const retryRef = useRef(0);
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
    combinedTotals: new Map(), // key: page number, value: total count used when building that page
  });

  useEffect(() => {
    const requestId = Date.now();
    const pageAtStart = params.page;
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        if (isFeaturedMode) {
          // 1) Load curated featured (fixed order)
          let featured = cacheRef.current.featured;
          if (!featured) {
            const fd = await fetchFeaturedProducts();
            featured = Array.isArray(fd.items) ? fd.items : [];
            cacheRef.current.featured = featured;
            cacheRef.current.featuredIds = featured.map(p => p.id);
            for (const p of featured) cacheRef.current.productById.set(p.id, p);
          }
          const featuredIds = cacheRef.current.featuredIds;

          // 2) Remaining products (excluding featured), plus deterministic combined paging
          const limit = params.limit;
          const page = params.page;
          let items = [];
          let total = 0;

          // Early serve from combined cache for stability and to avoid recompute
          const cachedSlice = cacheRef.current.combinedPages.get(page);
          const cachedTotal = cacheRef.current.combinedTotals.get(page);
          if (cachedSlice && cachedTotal != null) {
            items = cachedSlice;
            total = cachedTotal;
          } else {
            // Fetch first remaining page to know totals
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
            total = (cacheRef.current.featured?.length || 0) + (cacheRef.current.remainingTotal || 0);

            // Deterministically build combined list up to requested page, de-duped
            const ensureCombinedUpTo = async (targetPage) => {
              const combined = [];
              const seen = new Set();
              // add featured first
              for (const f of cacheRef.current.featured || []) {
                if (!seen.has(f.id)) { combined.push(f); seen.add(f.id); }
              }
              // then append remaining pages sequentially
              let remPage = 1;
              while (combined.length < targetPage * limit) {
                let part = cacheRef.current.remainingPages.get(remPage);
                if (!part) {
                  try {
                    const resp = await fetchProducts({ ...remainingParams, page: remPage });
                    part = resp.items || [];
                  } catch {
                    part = [];
                  }
                  cacheRef.current.remainingPages.set(remPage, part);
                  for (const p of part) cacheRef.current.productById.set(p.id, p);
                }
                if (!part.length) break;
                for (const it of part) {
                  if (!seen.has(it.id)) { combined.push(it); seen.add(it.id); }
                }
                remPage += 1;
              }
              // Cache slices and totals up to targetPage
              for (let p = 1; p <= targetPage; p++) {
                const start = (p - 1) * limit;
                const slice = combined.slice(start, start + limit).map(x => cacheRef.current.productById.get(x.id) || x);
                cacheRef.current.combinedPages.set(p, slice);
                cacheRef.current.combinedTotals.set(p, total);
              }
            };

            await ensureCombinedUpTo(page);
            items = cacheRef.current.combinedPages.get(page) || [];
            total = cacheRef.current.combinedTotals.get(page) ?? total;
          }

          if (isMounted && pageAtStart === params.page && requestId) {
            setData(prev => {
              const same = prev.total === total && prev.items.length === items.length && prev.items.every((x, i) => x.id === items[i].id) && prev.pageTag === pageAtStart;
              return same ? prev : { items, total, pageTag: pageAtStart };
            });
            retryRef.current = 0; // reset retry counter on success
            setIsLoading(false);
          }
        } else {
          let pd;
          try {
            pd = await fetchProducts(params);
          } catch {
            // keep previous data on error
            pd = { items: (data?.items||[]), total: (data?.total||0) };
          }
          if (isMounted && pageAtStart === params.page && requestId) {
            setData(prev => {
              const items = pd.items || [];
              const total = pd.total || 0;
              const same = prev.total === total && prev.items.length === items.length && prev.items.every((x, i) => x.id === items[i].id) && prev.pageTag === pageAtStart;
              return same ? prev : { items, total, pageTag: pageAtStart };
            });
            retryRef.current = 0; // reset retry counter on success
            setIsLoading(false);
          }
        }
      } catch (e) {
        // Keep previous data on transient errors to avoid empty flashes
        setIsLoading(false);
      }
      // If after this run the list is still empty and we recently logged in,
      // retry a few times to pick up the new token without requiring a full refresh.
      try {
        const stillEmpty = (!data?.items || data.items.length === 0);
        const hasToken = !!localStorage.getItem('token');
        if (stillEmpty && hasToken && retryRef.current < 6 && isMounted) {
          retryRef.current += 1;
          setTimeout(() => setReloadTag(t => t + 1), 500);
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [params, isFeaturedMode, reloadTag]);

  // Always reset scroll to top when changing page, query, or category
  useLayoutEffect(() => {
    try {
      // Use instant scroll to avoid white flashes on some devices
      window.scrollTo(0, 0);
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
    // Only use freshly fetched data if it matches the current page; otherwise fall back to cache
    if (data.items && data.items.length && data.pageTag === params.page) return data.items;
    const cached = isFeaturedMode ? cacheRef.current.combinedPages.get(params.page) : null;
    return cached || [];
  }, [isFeaturedMode, params.page, data.items, data.items?.length, data.pageTag]);

  // Derive a stable total for pagination (avoid disabling controls when data lags)
  const effectiveTotal = useMemo(() => {
    if (isFeaturedMode) {
      const t = cacheRef.current.combinedTotals.get(params.page);
      if (typeof t === 'number' && t > 0) return t;
    }
    return data.total || 0;
  }, [isFeaturedMode, params.page, data.total]);

  return (
    <div>
      <PromoCarousel className="full-viewport" mode="compact" />
      <SearchBar onSearch={(q)=>setParams(p=>({ ...p, q, page:1 }))} />
      <CategoryFilter onChange={(category)=>setParams(p=>({ ...p, category, page:1 }))} />
      <div className="grid" style={{ willChange:'transform', transform:'translateZ(0)', backfaceVisibility:'hidden', contain:'layout paint' }}>
        {(itemsToRender.length === 0 && isLoading) ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={`sk-${i}`} className="card" aria-hidden style={{ position:'relative' }}>
              <div style={{ width:'100%', aspectRatio:'4 / 3', background:'rgba(128,128,128,0.12)', overflow:'hidden' }}>
                <div style={{ width:'60%', height:8, background:'rgba(255,255,255,0.5)', margin:'12px', borderRadius:4 }} />
              </div>
              <div className="body" style={{ padding:'8px 4px' }}>
                <div style={{ height:12, background:'rgba(128,128,128,0.12)', borderRadius:4, marginBottom:6 }} />
                <div style={{ height:10, width:'70%', background:'rgba(128,128,128,0.1)', borderRadius:4 }} />
              </div>
            </div>
          ))
        ) : (
          itemsToRender.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
        )}
      </div>
      {((effectiveTotal || 0) > params.limit) && (
        <Pagination page={params.page} total={effectiveTotal} limit={params.limit}
          onPageChange={(page)=>setParams(p=>({ ...p, page }))} />
      )}
    </div>
  );
}

