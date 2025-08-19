import { useEffect, useState, useContext } from 'react';
import api from '../api/client';
import { toAbsoluteUrl } from '../utils/media';
import { AuthContext } from '../context/AuthContext.jsx';

export default function Admin2Dashboard() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('products');

  // Products state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [productVendorId, setProductVendorId] = useState('');
  const [form, setForm] = useState({ title: '', price_ksh: 0, compare_ksh: '', stock: 0, category_id: '', image_url: '', description: '', images: [] });
  const [categoryInput, setCategoryInput] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title:'', price_ksh:0, compare_ksh:'', stock:0, category_id:'', image_url:'', description:'', images:[], remove_image_ids:[], clear_images:false, cover_image_id:null });
  const [editCategoryInput, setEditCategoryInput] = useState('');
  // Categories state
  const [catForm, setCatForm] = useState({ name:'', slug:'' });
  const [catEditingId, setCatEditingId] = useState(null);
  const [catEdit, setCatEdit] = useState({ name:'', slug:'' });

  // Vendors state
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorStatus, setVendorStatus] = useState('pending');
  const [vendors, setVendors] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Ribbon manager state
  const [ribbonItems, setRibbonItems] = useState([]);
  const [ribbonForm, setRibbonForm] = useState({ title:'', title_mobile:'', body:'', body_mobile:'', cta_label:'', cta_label_mobile:'', media_type:'', bg_color:'', background:'' });
  const [ribbonEditingId, setRibbonEditingId] = useState(null);
  const [ribbonUploadFile, setRibbonUploadFile] = useState(null);
  const [ribbonUploadError, setRibbonUploadError] = useState('');
  const [ribbonUploadSuccess, setRibbonUploadSuccess] = useState('');
  const [ribbonCreateError, setRibbonCreateError] = useState('');
  const [ribbonCreateSuccess, setRibbonCreateSuccess] = useState('');
  const [ribbonDragIndex, setRibbonDragIndex] = useState(null);

  // Public ribbon preview state
  const [publicRibbon, setPublicRibbon] = useState([]);
  const [publicRibbonLoading, setPublicRibbonLoading] = useState(false);
  const [publicRibbonError, setPublicRibbonError] = useState('');

  const load = async () => {
    const [prod, { data: cats }] = await Promise.all([
      api.get('/products', { params: { q: productQuery || undefined, vendor_id: productVendorId || undefined, limit: 500, page: 1 } }).then(r => r.data),
      api.get('/categories')
    ]);
    setProducts(prod.items || []);
    setCategories(cats || []);
  };

  // Move selected enabled item so it starts a NEW slide boundary (enabled index -> next multiple of 4)
  const startNewSlideHere = (item) => {
    setRibbonItems(list => {
      const byPos = [...list].sort((a,b)=>(a.position||0)-(b.position||0));
      const enabled = byPos.filter(x=>x.enabled);
      const disabled = byPos.filter(x=>!x.enabled);
      const idxEnabled = enabled.findIndex(x=>x.id===item.id);
      if (idxEnabled === -1) return list; // only for enabled
      const remainder = idxEnabled % 4;
      const targetIdx = remainder === 0 ? idxEnabled : idxEnabled + (4 - remainder);
      const enabledCopy = [...enabled];
      const [moved] = enabledCopy.splice(idxEnabled, 1);
      // clamp target to end
      const insertAt = Math.min(targetIdx, enabledCopy.length);
      enabledCopy.splice(insertAt, 0, moved);
      // rebuild full order preserving relative order of disabled
      const rebuilt = [];
      let e = 0; let d = 0;
      for (const it of byPos) {
        if (it.enabled) rebuilt.push({ ...enabledCopy[e++] });
        else rebuilt.push({ ...disabled[d++] });
      }
      const withPos = rebuilt.map((it,i)=>({ ...it, position: i+1 }));
      reorderRibbon(withPos);
      return withPos;
    });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'products') load(); }, [tab, productQuery, productVendorId]);
  // Load categories when Categories tab is opened
  const loadCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data || []);
    } catch {}
  };
  useEffect(() => { if (tab === 'categories') loadCategories(); }, [tab]);

  const loadPending = async () => {
    try { const { data } = await api.get('/admin/vendors/pending-count'); setPendingCount(data.count || 0); } catch {}
  };
  useEffect(() => { if (tab === 'vendors') loadPending(); }, [tab]);
  useEffect(() => { if (tab === 'vendors') loadPending(); }, [vendors]);

  // Ribbon loader and DnD helpers
  const loadRibbon = async () => {
    try {
      const { data } = await api.get('/admin/ribbon');
      setRibbonItems(data || []);
    } catch { setRibbonItems([]); }
  };
  useEffect(() => { if (tab === 'ribbon') loadRibbon(); }, [tab]);
  const loadPublicRibbon = async () => {
    setPublicRibbonError(''); setPublicRibbonLoading(true);
    try {
      const { data } = await api.get('/ribbon');
      setPublicRibbon(Array.isArray(data) ? data : []);
    } catch (e) {
      setPublicRibbon([]);
      setPublicRibbonError(e?.response?.data?.message || e?.message || 'Failed to load public ribbon');
    } finally {
      setPublicRibbonLoading(false);
    }
  };
  useEffect(() => { if (tab === 'ribbon') loadPublicRibbon(); }, [tab]);
  // Refresh public preview whenever the admin list changes (enable/disable/reorder)
  useEffect(() => { if (tab === 'ribbon') loadPublicRibbon(); }, [ribbonItems]);
  const onRibbonDragStart = (idx) => setRibbonDragIndex(idx);
  const onRibbonDragOver = (e, idx) => { e.preventDefault(); if (ribbonDragIndex === null || ribbonDragIndex === idx) return; };
  const onRibbonDrop = (_e, idx) => {
    if (ribbonDragIndex === null || ribbonDragIndex === idx) return;
    setRibbonItems(list => {
      const copy = [...list];
      const [moved] = copy.splice(ribbonDragIndex, 1);
      copy.splice(idx, 0, moved);
      const withPos = copy.map((it,i)=>({ ...it, position:i+1 }));
      reorderRibbon(withPos);
      return withPos;
    });
    setRibbonDragIndex(null);
  };

  // Make selected item the hero of its current 4-item group (enabled-order based)
  const makeRibbonHero = (item) => {
    setRibbonItems(list => {
      const byPos = [...list].sort((a,b)=> (a.position||0)-(b.position||0));
      const enabled = byPos.filter(x=>x.enabled);
      const disabled = byPos.filter(x=>!x.enabled);
      const idxEnabled = enabled.findIndex(x=>x.id===item.id);
      if (idxEnabled === -1) return list; // can't promote disabled
      const groupStart = Math.floor(idxEnabled / 4) * 4;
      if (idxEnabled === groupStart) return list; // already hero
      // reorder within enabled: move item to groupStart
      const enabledCopy = [...enabled];
      const [moved] = enabledCopy.splice(idxEnabled, 1);
      enabledCopy.splice(groupStart, 0, moved);
      // rebuild full order: interleave disabled in original relative positions
      const rebuilt = [];
      let e = 0; let d = 0;
      for (const it of byPos) {
        if (it.enabled) rebuilt.push({ ...enabledCopy[e++]});
        else rebuilt.push({ ...disabled[d++]});
      }
      const withPos = rebuilt.map((it,i)=>({ ...it, position: i+1 }));
      reorderRibbon(withPos);
      return withPos;
    });
  };

  const createRibbon = async (e) => {
    e.preventDefault();
    try {
      setRibbonCreateError(''); setRibbonCreateSuccess('');
      const { data } = await api.post('/admin/ribbon', { ...ribbonForm });
      // Auto-enable so it shows up on the public homepage ribbon immediately
      try { await api.patch(`/admin/ribbon/${data.id}/enable`, { enabled: true }); } catch {}
      setRibbonForm({ title:'', title_mobile:'', body:'', body_mobile:'', cta_label:'', cta_label_mobile:'', media_type:'', bg_color:'', background:'' });
      await loadRibbon();
      setRibbonCreateSuccess('Ribbon item created');
      if (ribbonUploadFile) {
        try {
          await uploadRibbonMedia(data.id, ribbonUploadFile);
          setRibbonUploadSuccess('Media uploaded');
        } catch (err) {
          setRibbonUploadError(err?.response?.data?.message || err?.message || 'Failed to upload media');
        } finally {
          setRibbonUploadFile(null);
          await loadRibbon();
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create ribbon item';
      setRibbonCreateError(msg);
      console.error('Create ribbon failed:', err);
    }
  };
  const saveRibbon = async (id) => { try { await api.put(`/admin/ribbon/${id}`, ribbonForm); setRibbonEditingId(null); setRibbonForm({ title:'', title_mobile:'', body:'', body_mobile:'', cta_label:'', cta_label_mobile:'', media_type:'', bg_color:'', background:'' }); await loadRibbon(); } catch {} };
  const editRibbon = (it) => { setRibbonEditingId(it.id); setRibbonForm({ title: it.title||'', title_mobile: it.title_mobile||'', body: it.body||'', body_mobile: it.body_mobile||'', cta_label: it.cta_label||'', cta_label_mobile: it.cta_label_mobile||'', media_type: it.media_type||'', bg_color: it.bg_color || '', background: it.background || it.bg || '' }); };
  const cancelRibbonEdit = () => { setRibbonEditingId(null); setRibbonForm({ title:'', title_mobile:'', body:'', body_mobile:'', cta_label:'', cta_label_mobile:'', media_type:'', bg_color:'', background:'' }); };
  const toggleRibbon = async (id, enabled) => { try { await api.patch(`/admin/ribbon/${id}/enable`, { enabled }); await loadRibbon(); } catch {} };
  const deleteRibbon = async (id) => { try { await api.delete(`/admin/ribbon/${id}`); await loadRibbon(); } catch {} };
  const reorderRibbon = async (items) => { try { await api.patch('/admin/ribbon/reorder', { items: items.map((x,i)=>({ id:x.id, position: i+1 })) }); await loadRibbon(); } catch {} };
  const moveRibbonUp = async (idx) => { if (idx <= 0) return; setRibbonItems(list => { const copy = [...list]; [copy[idx-1], copy[idx]] = [copy[idx], copy[idx-1]]; const withPos = copy.map((it,i)=>({ ...it, position:i+1 })); reorderRibbon(withPos); return withPos; }); };
  const moveRibbonDown = async (idx) => { setRibbonItems(list => { if (idx >= list.length - 1) return list; const copy = [...list]; [copy[idx+1], copy[idx]] = [copy[idx], copy[idx+1]]; const withPos = copy.map((it,i)=>({ ...it, position:i+1 })); reorderRibbon(withPos); return withPos; }); };
  const uploadRibbonMedia = async (id, file) => {
    if (!file) throw new Error('No file selected');
    const fd = new FormData();
    fd.append('media', file);
    await api.post(`/admin/ribbon/${id}/media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  // Reviews moderation state
  const [allReviews, setAllReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewDeleteError, setReviewDeleteError] = useState('');
  const [reviewDeleteSuccess, setReviewDeleteSuccess] = useState('');
  const loadReviews = async () => {
    setReviewsError(''); setReviewsLoading(true);
    try { const { data } = await api.get('/admin/reviews', { params: { limit: 500 } }); setAllReviews(Array.isArray(data)?data:[]); }
    catch (e) { setReviewsError(e?.response?.data?.message || e?.message || 'Failed to load reviews'); setAllReviews([]); }
    finally { setReviewsLoading(false); }
  };
  useEffect(() => { if (tab === 'reviews') loadReviews(); }, [tab]);

  const deleteReview = async (id) => {
    setReviewDeleteError('');
    setReviewDeleteSuccess('');
    const ok = window.confirm('Delete this review? This action cannot be undone.');
    if (!ok) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      setReviewDeleteSuccess('Review deleted');
      await loadReviews();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete review';
      setReviewDeleteError(msg);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setCreateError(''); setCreateSuccess('');
    try {
      const fd = new FormData();
      const price_cents = Math.round(Number(form.price_ksh || 0) * 100);
      if (!Number.isNaN(price_cents)) fd.append('price_cents', String(price_cents));
      if (form.compare_ksh !== '' && form.compare_ksh !== null && form.compare_ksh !== undefined) {
        const compare_cents = Math.round(Number(form.compare_ksh || 0) * 100);
        if (!Number.isNaN(compare_cents)) fd.append('compare_at_price_cents', String(compare_cents));
      }
      for (const k of ['title','stock','image_url','description']) if (form[k] !== '' && form[k] !== null && form[k] !== undefined) fd.append(k, form[k]);
      if (form.category_id) {
        fd.append('category_id', form.category_id);
      } else if (categoryInput && String(categoryInput).trim()) {
        const trimmed = String(categoryInput).trim();
        const match = categories.find(c => String(c.name).toLowerCase() === trimmed.toLowerCase());
        if (match) fd.append('category_id', match.id); else fd.append('category_name', trimmed);
      }
      if (form.images && form.images.length) for (const file of form.images) fd.append('images', file);
      await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ title: '', price_ksh: 0, compare_ksh: '', stock: 0, category_id: '', image_url: '', description: '', images: [] });
      setCategoryInput('');
      setCreateSuccess('Product created');
      await load();
    } catch (err) {
      setCreateError(err?.response?.data?.message || err?.message || 'Failed to create product');
    }
  };

  const remove = async (id) => { await api.delete(`/products/${id}`); await load(); };

  const startEdit = (p) => {
    setEditing(p.id);
    setEditForm({
      title: p.title,
      price_ksh: (p.price_cents || 0) / 100,
      compare_ksh: p.compare_at_price_cents ? (p.compare_at_price_cents/100) : '',
      stock: p.stock,
      category_id: p.category_id || '',
      image_url: p.image_url || '',
      description: p.description || '',
      images: [],
      remove_image_ids: [],
      clear_images: false,
      cover_image_id: null
    });
    setEditCategoryInput((p.category_name || '').trim());
  };
  const saveEdit = async (id) => {
    const fd = new FormData();
    const price_cents = Math.round(Number(editForm.price_ksh || 0) * 100);
    if (!Number.isNaN(price_cents)) fd.append('price_cents', String(price_cents));
    if (editForm.compare_ksh !== '' && editForm.compare_ksh !== null && editForm.compare_ksh !== undefined) {
      const compare_cents = Math.round(Number(editForm.compare_ksh || 0) * 100);
      if (!Number.isNaN(compare_cents)) fd.append('compare_at_price_cents', String(compare_cents));
    }
    for (const k of ['title','stock','image_url','description']) if (editForm[k] !== '' && editForm[k] !== null && editForm[k] !== undefined) fd.append(k, editForm[k]);
    if (editForm.category_id) {
      fd.append('category_id', editForm.category_id);
    } else if (editCategoryInput && String(editCategoryInput).trim()) {
      const trimmed = String(editCategoryInput).trim();
      const match = categories.find(c => String(c.name).toLowerCase() === trimmed.toLowerCase());
      if (match) fd.append('category_id', match.id); else fd.append('category_name', trimmed);
    }
    if (editForm.clear_images) fd.append('clear_images','true');
    if (editForm.remove_image_ids && editForm.remove_image_ids.length) fd.append('remove_image_ids', JSON.stringify(editForm.remove_image_ids));
    if (editForm.cover_image_id) fd.append('cover_image_id', String(editForm.cover_image_id));
    if (editForm.images && editForm.images.length) for (const f of editForm.images) fd.append('images', f);
    await api.put(`/products/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setEditing(null);
    await load();
  };
  const cancelEdit = () => setEditing(null);

  // Vendors
  const searchVendors = async (e) => {
    e?.preventDefault?.();
    const { data } = await api.get('/admin/vendors', { params: { q: vendorQuery || undefined, status: vendorStatus || undefined } });
    setVendors(data);
  };
  useEffect(() => { if (tab === 'vendors') searchVendors(); }, [tab, vendorStatus]);

  const onApprove = async (id) => { await api.put(`/admin/vendors/${id}/status`, { status: 'approved' }); await searchVendors(); };
  const onSuspend = async (id) => { await api.put(`/admin/vendors/${id}/status`, { status: 'suspended' }); await searchVendors(); };
  const onSetPending = async (id) => { await api.put(`/admin/vendors/${id}/status`, { status: 'pending' }); await searchVendors(); };
  const viewVendorProducts = (vendorId) => {
    setProductVendorId(String(vendorId));
    setTab('products');
  };

  return (
    <div>
      <h2>Admin2 Dashboard</h2>
      <div className="tabs" style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button className={`button ${tab==='products'?"":"ghost"}`} onClick={()=>setTab('products')}>Products</button>
        <button className={`button ${tab==='vendors'?"":"ghost"}`} onClick={()=>setTab('vendors')}>Vendors {pendingCount>0 && <span className="badge" style={{ marginLeft:6 }}>{pendingCount}</span>}</button>
        <button className={`button ${tab==='categories'?"":"ghost"}`} onClick={()=>setTab('categories')}>Categories</button>
        <button className={`button ${tab==='ribbon'?"":"ghost"}`} onClick={()=>setTab('ribbon')}>Ribbon</button>
        <button className={`button ${tab==='reviews'?"":"ghost"}`} onClick={()=>setTab('reviews')}>Reviews</button>
      </div>

      {tab === 'products' && (
        <>
          <section className="card" style={{ padding: 16 }}>
            <h3 className="title" style={{ marginTop: 0 }}>Create Product</h3>
            {createError && <div className="error" role="alert">{createError}</div>}
            {createSuccess && <div className="success" role="status">{createSuccess}</div>}
            <form onSubmit={create} className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({ ...form, title: e.target.value })} />
              <input className="input" placeholder="Image URL" value={form.image_url} onChange={e=>setForm({ ...form, image_url: e.target.value })} />
              <input className="input" min="0" type="number" placeholder="Now Price (KSh)" value={form.price_ksh} onChange={e=>setForm({ ...form, price_ksh: Math.max(0, Number(e.target.value)) })} />
              <div className="small muted">Current selling price in KSh. Cannot be negative.</div>
              <input className="input" min="0" type="number" placeholder="Original Price (KSh, optional)" value={form.compare_ksh} onChange={e=>setForm({ ...form, compare_ksh: Math.max(0, Number(e.target.value)) })} />
              <div className="small muted">Leave blank if not discounted.</div>
              <input className="input" min="0" type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm({ ...form, stock: Math.max(0, Number(e.target.value)) })} />
              <div className="small muted">Stock quantity must be non-negative.</div>
              <input className="input" list="admin2-category-options" placeholder="Type or choose category" value={categoryInput}
                     onChange={e=>{ setCategoryInput(e.target.value); setForm(f=>({ ...f, category_id:'' })); }} />
              <datalist id="admin2-category-options">
                {categories.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              <div className="small muted">Pick an existing category or type a new one.</div>
              <textarea className="input" placeholder="Description" value={form.description} onChange={e=>setForm({ ...form, description: e.target.value })} />
              <div style={{ gridColumn:'1 / -1' }}>
                <label>Upload Images</label>
                <input className="input" type="file" accept="image/*" multiple onChange={(e)=>setForm(f=>({ ...f, images: Array.from(e.target.files||[]) }))} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="button" type="submit">Create</button>
              </div>
            </form>
          </section>

          <section>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <h3 style={{ margin:0 }}>Products {productVendorId ? <span className="small muted">• Filtering by vendor</span> : null}</h3>
              <form className="row" style={{ gap:8 }} onSubmit={async (e)=>{ e.preventDefault(); await load(); }}>
                <input className="input" placeholder="Search products" value={productQuery} onChange={e=>setProductQuery(e.target.value)} />
                {productVendorId && <button type="button" className="button ghost" onClick={()=>{ setProductVendorId(''); load(); }}>Clear vendor filter</button>}
                <button className="button" type="submit">Search</button>
              </form>
            </div>
            <div className="products-grid" style={{ marginTop:12 }}>
              {products.map(p => (
                <div key={p.id} className={`card ${editing===p.id ? 'editing' : ''}`} style={{ padding:12 }}>
                  <img src={toAbsoluteUrl(p.image_url || (p.images && p.images[0]?.url) || '')} alt={p.title} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} />
                  <div style={{ marginTop:8 }}>
                    {editing === p.id ? (
                      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <input className="input" value={editForm.title} onChange={e=>setEditForm(f=>({ ...f, title:e.target.value }))} />
                        <input className="input" value={editForm.image_url} onChange={e=>setEditForm(f=>({ ...f, image_url:e.target.value }))} />
                        <input className="input" min="0" type="number" value={editForm.price_ksh} onChange={e=>setEditForm(f=>({ ...f, price_ksh: Math.max(0, Number(e.target.value)) }))} />
                        <input className="input" min="0" type="number" value={editForm.compare_ksh} onChange={e=>setEditForm(f=>({ ...f, compare_ksh: Math.max(0, Number(e.target.value)) }))} />
                        <input className="input" type="number" value={editForm.stock} onChange={e=>setEditForm(f=>({ ...f, stock:Number(e.target.value) }))} />
                        <input className="input" list="admin2-category-options" placeholder="Type or choose category" value={editForm.category_id ? (categories.find(c=>c.id===editForm.category_id)?.name || '') : editCategoryInput}
                               onChange={e=>{
                                 const val = e.target.value;
                                 const match = categories.find(c => c.name.toLowerCase() === String(val).toLowerCase());
                                 if (match) { setEditForm(f=>({ ...f, category_id: match.id })); setEditCategoryInput(match.name); }
                                 else { setEditForm(f=>({ ...f, category_id: '' })); setEditCategoryInput(val); }
                               }}
                        />
                        <textarea className="input" value={editForm.description} onChange={e=>setEditForm(f=>({ ...f, description:e.target.value }))} />
                        <div style={{ gridColumn:'1 / -1' }}>
                          <label>Add Images</label>
                          <input className="input" type="file" accept="image/*" multiple onChange={(e)=>setEditForm(f=>({ ...f, images: Array.from(e.target.files||[]) }))} />
                        </div>
                        {Array.isArray(p.images) && p.images.length > 0 && (
                          <div style={{ gridColumn:'1 / -1' }}>
                            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                              <strong>Existing Images</strong>
                              <label className="row" style={{ gap:6 }}>
                                <input type="checkbox" checked={!!editForm.clear_images} onChange={e=>setEditForm(f=>({ ...f, clear_images:e.target.checked }))} />
                                <span>Clear all images</span>
                              </label>
                            </div>
                            <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
                              {p.images.map(img => {
                                const marked = editForm.remove_image_ids.includes(img.id);
                                const cover = editForm.cover_image_id ? (editForm.cover_image_id === img.id) : (p.image_url === img.url);
                                return (
                                  <div key={img.id} className="card" style={{ padding:6 }}>
                                    <img src={toAbsoluteUrl(img.url)} alt="img" style={{ width:80, height:80, objectFit:'cover', borderRadius:6, opacity: marked?0.4:1 }} />
                                    <div className="row" style={{ gap:8, marginTop:6, alignItems:'center' }}>
                                      <label className="row" style={{ gap:6 }}>
                                        <input type="checkbox" checked={marked} disabled={editForm.clear_images}
                                          onChange={(e)=>setEditForm(f=>({
                                            ...f,
                                            remove_image_ids: e.target.checked? [...f.remove_image_ids, img.id] : f.remove_image_ids.filter(id=>id!==img.id)
                                          }))}
                                        />
                                        <span className="small">Remove</span>
                                      </label>
                                      <label className="row" style={{ gap:6 }}>
                                        <input type="radio" name={`cover-${p.id}`} checked={cover}
                                          onChange={()=>setEditForm(f=>({ ...f, cover_image_id: img.id }))}
                                        />
                                        <span className="small">Cover</span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div style={{ gridColumn:'1 / -1', display:'flex', gap:8, justifyContent:'flex-end' }}>
                          <button className="button" onClick={()=>saveEdit(p.id)}>Save</button>
                          <button className="button ghost" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="row" style={{ gap:8, alignItems:'center', justifyContent:'space-between' }}>
                        <div>
                          <div><strong>{p.title}</strong></div>
                          {(() => {
                            const now = (p.price_cents||0)/100;
                            const cmp = (p.compare_at_price_cents||0)/100;
                            const nowStr = `KSh ${now.toLocaleString('en-KE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
                            const cmpStr = `KSh ${cmp.toLocaleString('en-KE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
                            return (
                              <>
                                <div className="small muted">{nowStr}</div>
                                {p.compare_at_price_cents ? <div className="small muted"><s>{cmpStr}</s></div> : null}
                                <div className="small muted">Stock: {p.stock}</div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="row" style={{ gap:6 }}>
                          <button className="button" onClick={()=>startEdit(p)}>Edit</button>
                          <button className="button ghost" onClick={()=>remove(p.id)}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === 'vendors' && (
        <section>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
            <h3 style={{ margin:0 }}>Vendors</h3>
          </div>
          <div className="row" style={{ gap:12, flexWrap:'wrap', margin:'8px 0' }}>
            <button type="button" className={`button ${vendorStatus==='approved'?'':'ghost'}`} onClick={()=>setVendorStatus('approved')}>Approved</button>
            <button type="button" className={`button ${vendorStatus==='pending'?'':'ghost'}`} onClick={()=>setVendorStatus('pending')}>Pending</button>
            <button type="button" className={`button ${vendorStatus==='suspended'?'':'ghost'}`} onClick={()=>setVendorStatus('suspended')}>Suspended</button>
            <button type="button" className={`button ${vendorStatus===''?'':'ghost'}`} onClick={()=>setVendorStatus('')}>All</button>
          </div>
          <form className="row" style={{ gap:8 }} onSubmit={searchVendors}>
            <input className="input" placeholder="Search by business name, vendor name or email" value={vendorQuery} onChange={e=>setVendorQuery(e.target.value)} />
            <button className="button" type="submit">Search</button>
          </form>
          <div className="stack" style={{ gap:8, marginTop:12 }}>
            {vendors.map(v => (
              <div key={v.id} className="card" style={{ padding:12 }}>
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div>
                    <div><strong>{v.business_name}</strong></div>
                    <div className="small muted">{v.user_email} • Products: {v.product_count || 0}</div>
                    <div className="small">Status: {v.status}</div>
                  </div>
                  <div className="row" style={{ gap:6 }}>
                    <button className="button" onClick={()=>viewVendorProducts(v.id)}>View Products</button>
                    {v.status !== 'approved' && <button className="button" onClick={()=>onApprove(v.id)}>Approve</button>}
                    {v.status !== 'suspended' && <button className="button ghost" onClick={()=>onSuspend(v.id)}>Suspend</button>}
                    {v.status !== 'pending' && <button className="button ghost" onClick={()=>onSetPending(v.id)}>Set Pending</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'categories' && (
        <section>
          <h3>Categories</h3>
          <form className="row" style={{ gap:12, marginBottom:16, flexWrap:'wrap' }} onSubmit={async (e)=>{
            e.preventDefault();
            await api.post('/categories', catForm);
            setCatForm({ name:'', slug:'' });
            await loadCategories();
          }}>
            <input className="input" placeholder="Name" value={catForm.name} onChange={e=>setCatForm(f=>({ ...f, name:e.target.value }))} style={{ minWidth:220 }} />
            <div style={{ width:12, flex:'0 0 12px' }} />
            <input className="input" placeholder="Slug" value={catForm.slug} onChange={e=>setCatForm(f=>({ ...f, slug:e.target.value }))} style={{ minWidth:220 }} />
            <button className="button" type="submit" style={{ marginLeft:4 }}>Add</button>
          </form>
          <div className="stack" style={{ gap:10 }}>
            {categories.map(c => (
              <div key={c.id} className="row" style={{ gap:12, alignItems:'center', flexWrap:'wrap' }}>
                {catEditingId === c.id ? (
                  <>
                    <input className="input" value={catEdit.name} onChange={e=>setCatEdit(f=>({ ...f, name:e.target.value }))} style={{ minWidth:220 }} />
                    <div style={{ width:12, flex:'0 0 12px' }} />
                    <input className="input" value={catEdit.slug} onChange={e=>setCatEdit(f=>({ ...f, slug:e.target.value }))} style={{ minWidth:220 }} />
                    <button className="button" style={{ marginRight:4 }} onClick={async ()=>{
                      await api.put(`/categories/${c.id}`, catEdit);
                      setCatEditingId(null);
                      await loadCategories();
                    }}>Save</button>
                    <button className="button ghost" onClick={()=>setCatEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{ minWidth:160 }}><strong>{c.name}</strong></div>
                    <div className="small" style={{ flex:1 }}>{c.slug}</div>
                    <div className="row" style={{ gap:10 }}>
                      <button className="button" onClick={()=>{ setCatEditingId(c.id); setCatEdit({ name:c.name, slug:c.slug }); }}>Edit</button>
                      <button className="button ghost" onClick={async ()=>{ await api.delete(`/categories/${c.id}`); await loadCategories(); }}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'ribbon' && (
        <section>
          <h3>Homepage Ribbon</h3>
          <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="card" style={{ padding:12 }}>
              <h4 style={{ marginTop:0 }}>{ribbonEditingId? 'Edit Item' : 'Create Item'}</h4>
              {ribbonCreateError && <div className="error" role="alert">{ribbonCreateError}</div>}
              {ribbonCreateSuccess && <div className="success" role="status">{ribbonCreateSuccess}</div>}
              <form className="stack" style={{ gap:8 }} onSubmit={createRibbon}>
                <input className="input" placeholder="Title (desktop/tablet)" value={ribbonForm.title} onChange={e=>setRibbonForm(f=>({ ...f, title:e.target.value }))} />
                <input className="input" placeholder="Title (mobile)" value={ribbonForm.title_mobile} onChange={e=>setRibbonForm(f=>({ ...f, title_mobile:e.target.value }))} />
                <textarea className="input" placeholder="Body (desktop/tablet)" value={ribbonForm.body} onChange={e=>setRibbonForm(f=>({ ...f, body:e.target.value }))} />
                <textarea className="input" placeholder="Body (mobile)" value={ribbonForm.body_mobile} onChange={e=>setRibbonForm(f=>({ ...f, body_mobile:e.target.value }))} />
                <input className="input" placeholder="CTA Label (desktop/tablet)" value={ribbonForm.cta_label} onChange={e=>setRibbonForm(f=>({ ...f, cta_label:e.target.value }))} />
                <input className="input" placeholder="CTA Label (mobile)" value={ribbonForm.cta_label_mobile} onChange={e=>setRibbonForm(f=>({ ...f, cta_label_mobile:e.target.value }))} />
                <select className="input" value={ribbonForm.media_type} onChange={e=>setRibbonForm(f=>({ ...f, media_type:e.target.value }))}>
                  <option value="">No Media</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
                <label className="small" htmlFor="ribbon-bg-color">Background color</label>
                <div className="row" style={{ gap:8, alignItems:'center' }}>
                  <input id="ribbon-bg-color" type="color" className="input" value={ribbonForm.bg_color || '#5b7cfa'} onChange={e=>setRibbonForm(f=>({ ...f, bg_color: e.target.value }))} style={{ width:56, padding:0, height:36 }} />
                  <input className="input" placeholder="#5b7cfa (optional)" value={ribbonForm.bg_color || ''} onChange={e=>setRibbonForm(f=>({ ...f, bg_color:e.target.value }))} />
                </div>
                <label className="small" htmlFor="ribbon-bg-advanced">Background (advanced CSS — e.g., linear-gradient(135deg,#5b7cfa,#7f53ac))</label>
                <input id="ribbon-bg-advanced" className="input" placeholder="linear-gradient(135deg,#5b7cfa,#7f53ac)" value={ribbonForm.background || ''} onChange={e=>setRibbonForm(f=>({ ...f, background:e.target.value }))} />
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <div className="row" style={{ gap:8, alignItems:'center' }}>
                    <input className="input" type="file" accept="image/*,video/*" onChange={e=>setRibbonUploadFile(e.target.files?.[0]||null)} />
                    {ribbonEditingId && (
                      <button className="button" type="button" onClick={async ()=>{
                        setRibbonUploadError(''); setRibbonUploadSuccess('');
                        try {
                          if (!ribbonUploadFile) throw new Error('Select a file first');
                          await uploadRibbonMedia(ribbonEditingId, ribbonUploadFile);
                          setRibbonUploadSuccess('Media uploaded');
                        } catch (err) {
                          setRibbonUploadError(err?.response?.data?.message || err?.message || 'Failed to upload media');
                        } finally {
                          setRibbonUploadFile(null);
                          await loadRibbon();
                        }
                      }}>Upload Media</button>
                    )}
                  </div>
                  {ribbonEditingId ? (
                    <div className="row" style={{ gap:8 }}>
                      <button className="button" type="button" onClick={()=>saveRibbon(ribbonEditingId)}>Save</button>
                      <button className="button ghost" type="button" onClick={cancelRibbonEdit}>Cancel</button>
                    </div>
                  ) : (
                    <button className="button" type="submit">Create</button>
                  )}
                </div>
                {(ribbonUploadError || ribbonUploadSuccess) && (
                  <div>
                    {ribbonUploadError && <div className="error" role="alert">{ribbonUploadError}</div>}
                    {ribbonUploadSuccess && <div className="success" role="status">{ribbonUploadSuccess}</div>}
                  </div>
                )}
              </form>
            </div>
            <div>
              <h4 style={{ marginTop:0 }}>Items</h4>
              <div className="stack" style={{ gap:8 }}>
                {ribbonItems.map((it, idx) => (
                  <div key={it.id} className="card" style={{ padding:12 }} draggable onDragStart={()=>onRibbonDragStart(idx)} onDragOver={(e)=>onRibbonDragOver(e, idx)} onDrop={(e)=>onRibbonDrop(e, idx)}>
                    <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                      <div className="row" style={{ gap:8, alignItems:'center' }}>
                        <strong>#{it.position}</strong>
                        <span>{it.title || 'Untitled'}</span>
                        {(() => {
                          const enabledSorted = [...ribbonItems].filter(x=>x.enabled).sort((a,b)=> (a.position||0)-(b.position||0));
                          const idxEnabled = enabledSorted.findIndex(x=>x.id===it.id);
                          if (idxEnabled === -1) return <span className="badge muted">Disabled</span>;
                          const roleInGroup = idxEnabled % 4;
                          return (
                            <span className="badge" style={{ background: roleInGroup===0 ? 'var(--accent-1)' : 'var(--surface-3)', color: roleInGroup===0 ? '#fff' : 'inherit' }}>
                              {roleInGroup===0 ? 'Hero' : `Tile ${roleInGroup}`}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="small muted">Pos {it.position}</div>
                      </div>
                      <div className="row" style={{ gap:6 }}>
                        <button className="button" onClick={()=>editRibbon(it)}>Edit</button>
                        <button className="button ghost" onClick={()=>toggleRibbon(it.id, !it.enabled)}>{it.enabled? 'Disable':'Enable'}</button>
                        <button className="button ghost" onClick={()=>deleteRibbon(it.id)}>Delete</button>
                        <button className="button ghost" onClick={()=>moveRibbonUp(idx)}>Up</button>
                        <button className="button ghost" onClick={()=>moveRibbonDown(idx)}>Down</button>
                        {it.enabled && <button className="button ghost" onClick={()=>makeRibbonHero(it)}>Make Hero</button>}
                        {it.enabled && <button className="button ghost" onClick={()=>startNewSlideHere(it)}>Start New Slide Here</button>}
                      </div>
                    {/* Media upload removed from Items: media can only be set during Create Item */}
                  </div>
                ))}
                {ribbonItems.length === 0 && <div className="small muted">No items</div>}
              </div>
              <div className="card" style={{ padding:12, marginTop:12 }}>
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                  <h4 style={{ margin:0 }}>Public Preview (/api/ribbon)</h4>
                  <button className="button ghost" type="button" onClick={loadPublicRibbon}>Reload</button>
                </div>
                {publicRibbonLoading && <div className="small muted" style={{ marginTop:8 }}>Loading…</div>}
                {publicRibbonError && <div className="error" style={{ marginTop:8 }}>{publicRibbonError}</div>}
                {!publicRibbonLoading && !publicRibbonError && (
                  <div className="stack" style={{ gap:12, marginTop:8 }}>
                    {publicRibbon.length === 0 && <div className="small muted">No public items</div>}
                    {/* Thin Ribbon preview (compact mode) */}
                    {publicRibbon.length > 0 && (() => {
                      const group = publicRibbon.slice(0, 4);
                      const hero = group[0] || {};
                      const tiles = group.slice(1);
                      const title = hero.title || hero.heading || 'Promotion';
                      const ctaLabel = hero.cta_label || hero.cta || '';
                      const body = hero.body || hero.text || '';
                      const mediaUrl = hero.media_url || hero.image || null;
                      const mediaTiles = tiles.filter(t => (t?.media_url || t?.image));
                      const compactMediaUrl = mediaUrl || (mediaTiles[0]?.media_url || mediaTiles[0]?.image || null);
                      const bgStyle = (hero.background || hero.bg || hero.bg_color || (() => {
                        const carrier = group.find(it => it && (it.background || it.bg || it.bg_color));
                        return (carrier?.background || carrier?.bg || carrier?.bg_color || 'var(--surface-2)');
                      })());
                      return (
                        <div className="card" style={{ padding:0, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <div style={{ background:bgStyle, height:44, minHeight:40, maxHeight:48, display:'grid', gridTemplateColumns:'minmax(80px,1fr) 2fr minmax(72px,14%) auto', alignItems:'center', gap:10, padding:'0 12px' }}>
                            <div style={{ fontWeight:800, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
                            <div className="small" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{body}</div>
                            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'flex-end', overflow:'hidden', marginRight:8 }}>
                              {compactMediaUrl ? <img src={compactMediaUrl} alt={title} style={{ height:'100%', width:'auto', maxWidth:'100%', objectFit:'contain' }} /> : null}
                            </div>
                            <div style={{ fontWeight:700, whiteSpace:'nowrap' }}>{ctaLabel}</div>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      // Group public items into slides of up to 4: [hero, tile, tile, tile]
                      const groups = [];
                      for (let i=0; i<publicRibbon.length; i+=4) groups.push(publicRibbon.slice(i, i+4));
                      return groups.map((group, gi) => {
                        const hero = group[0];
                        const tiles = group.slice(1);
                        const title = hero?.title || hero?.heading || 'Promotion';
                        const body = hero?.body || hero?.text || '';
                        const ctaLabel = hero?.cta_label || hero?.cta || '';
                        const ctaUrl = hero?.cta_url || hero?.link || '#';
                        const mediaUrl = hero?.media_url || hero?.image || null;
                        const mediaType = hero?.media_type || (mediaUrl && mediaUrl.match(/\.mp4|\.webm|\.ogg/i) ? 'video' : (mediaUrl ? 'image' : ''));
                        return (
                          <div key={gi} className="card" style={{ padding:0, overflow:'hidden', border:'1px solid var(--border)' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:12, alignItems:'stretch' }}>
                              {/* Hero left */}
                              <div style={{ padding:'12px 16px', display:'grid', gridTemplateRows:'auto 1fr auto', minHeight:200 }}>
                                <div style={{ fontWeight:700 }}>{title}</div>
                                {body && <div className="small muted" style={{ marginTop:6 }}>{body}</div>}
                                {ctaLabel && <a href={ctaUrl} className="button ghost" style={{ justifySelf:'start', marginTop:8 }}>{ctaLabel}</a>}
                              </div>
                              {/* Tiles right */}
                              <div style={{ display:'grid', gridTemplateRows:`repeat(${Math.max(tiles.length,1)},1fr)`, gap:8, padding:'8px 12px' }}>
                                {tiles.length === 0 && (
                                  <div className="small muted" style={{ display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed var(--border)', borderRadius:8 }}>Empty tile slot</div>
                                )}
                                {tiles.map((t, ti) => (
                                  <div key={t.id ?? ti} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignItems:'center', background:'var(--surface-1)', borderRadius:8, overflow:'hidden' }}>
                                    <div style={{ padding:'8px 10px' }}>
                                      <div style={{ fontWeight:600, fontSize:14 }}>{t.title || t.heading || ''}</div>
                                      {t.body && <div className="small muted" style={{ marginTop:4 }}>{t.body}</div>}
                                    </div>
                                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:6, overflow:'hidden' }}>
                                      {(() => {
                                        const tu = t.media_url || t.image || null;
                                        const tt = t.media_type || (tu && tu.match(/\.mp4|\.webm|\.ogg/i) ? 'video' : (tu ? 'image' : ''));
                                        if (!tu) return <div className="small muted">No media</div>;
                                        return tt==='video' ? <video src={tu} style={{ width:'100%', height:'100%', objectFit:'contain' }} muted playsInline autoPlay loop preload="metadata" /> : <img src={tu} alt={t.title||''} style={{ width:'100%', height:'100%', objectFit:'contain' }} />;
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'reviews' && (
        <section>
          <h3>Reviews</h3>
          {reviewsLoading && <div>Loading...</div>}
          {reviewsError && <div className="error">{reviewsError}</div>}
          {reviewDeleteError && <div className="error">{reviewDeleteError}</div>}
          {reviewDeleteSuccess && <div className="success">{reviewDeleteSuccess}</div>}
          {!reviewsLoading && !reviewsError && (
            <div className="stack" style={{ gap:8 }}>
              {allReviews.map(rv => (
                <div key={rv.id} className="card" style={{ padding:12 }}>
                  <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div>
                      <div><strong>{rv.product_title || 'Product'}</strong></div>
                      <div className="small muted">By {rv.user_name || rv.user_email} • Rating: {rv.rating}</div>
                      <div className="small">{rv.comment}</div>
                    </div>
                    <div className="row" style={{ gap:6 }}>
                      <button className="button ghost" onClick={()=>deleteReview(rv.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {allReviews.length === 0 && <div className="small muted">No reviews</div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
