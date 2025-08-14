import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { getMyVendor, listMyProducts, createMyProduct, updateMyProduct, deleteMyProduct, listMyOrderItems, markItemShipped } from '../api/vendor';
import { toAbsoluteUrl } from '../utils/media';

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [vendorGate, setVendorGate] = useState({ blocked:false, message:'' });
  const [form, setForm] = useState({ title:'', description:'', price_cents:'', compare_at_price:'', stock:'', category_id:'', images:[] });
  const [createTempFiles, setCreateTempFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title:'', description:'', price_cents:'', compare_at_price:'', stock:'', category_id:'', images:[], remove_image_ids:[], clear_images:false, cover_image_id:null });
  const [editCategoryInput, setEditCategoryInput] = useState('');
  // temp holder for files before user clicks "Okay" to stage them
  const [editTempFiles, setEditTempFiles] = useState([]);
  const [editPreviewApplied, setEditPreviewApplied] = useState(false);
  const [editHiddenIds, setEditHiddenIds] = useState([]);
  // responsive columns for create/list section
  const [gridCols, setGridCols] = useState('1fr');
  useEffect(() => {
    const updateCols = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
      setGridCols(w < 768 ? '1fr' : '1fr 1fr');
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const load = async () => {
    setError('');
    try {
      const [v, p, cats] = await Promise.all([
        getMyVendor(),
        listMyProducts(),
        api.get('/categories').then(r=>r.data)
      ]);
      setVendor(v); setProducts(p); setCategories(cats); setVendorGate({ blocked:false, message:'' });
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to load';
      setError(msg);
      if (e?.response?.status === 403) {
        // Gate vendor dashboard but keep user on site
        const status = e?.response?.data?.status || 'pending';
        const text = status === 'pending' ? 'Waiting for approval' : (msg || 'Request access from the Admin');
        setVendorGate({ blocked:true, message:text });
        return;
      }
    }
  };
  const loadOrders = async () => {
    try { setOrders(await listMyOrderItems()); } catch (e) { /* ignore */ }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab]);

  const onCreate = async (e) => {
    e.preventDefault(); setError('');
    // Require at least one image
    if (!form.images || form.images.length === 0) {
      setError('Please add at least one image before saving.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      for (const k of ['title','description','stock']) if (form[k] !== '') fd.append(k, form[k]);
      if (form.price_cents !== '') {
        const cents = Math.round(Number(form.price_cents || 0) * 100);
        fd.append('price_cents', String(cents));
      }
      if (form.compare_at_price !== '') {
        const cents = Math.round(Number(form.compare_at_price || 0) * 100);
        fd.append('compare_at_price_cents', String(cents));
      }
      // category: map input to id if matches, otherwise send category_name
      const trimmedCat = String(categoryInput || '').trim();
      if (form.category_id) {
        fd.append('category_id', form.category_id);
      } else if (trimmedCat) {
        const match = categories.find(c => String(c.name).toLowerCase() === trimmedCat.toLowerCase());
        if (match) fd.append('category_id', match.id); else fd.append('category_name', trimmedCat);
      }
      if (form.images && form.images.length) {
        for (const file of form.images) fd.append('images', file);
      }
      await createMyProduct(fd);
      setForm({ title:'', description:'', price_cents:'', compare_at_price:'', stock:'', category_id:'', images:[] });
      setCategoryInput('');
      await load();
    } catch (e) { setError(e?.response?.data?.message || 'Create failed'); }
    finally { setBusy(false); }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    try { await deleteMyProduct(id); await load(); } catch {}
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      title: p.title || '',
      description: p.description || '',
      price_cents: (typeof p.price_cents === 'number' ? (p.price_cents/100) : '') || '',
      compare_at_price: (typeof p.compare_at_price_cents === 'number' && p.compare_at_price_cents>0 ? (p.compare_at_price_cents/100) : '') || '',
      stock: p.stock ?? '',
      category_id: p.category_id ?? '',
      images: [],
      remove_image_ids: [],
      clear_images: false,
      cover_image_id: null
    });
    setEditCategoryInput((p.category_name || '').trim());
    setEditTempFiles([]);
    setEditPreviewApplied(false);
    setEditHiddenIds([]);
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({ title:'', description:'', price_cents:'', compare_at_price:'', stock:'', category_id:'', images:[], remove_image_ids:[], clear_images:false, cover_image_id:null }); };
  const saveEdit = async (id) => {
    setError('');
    // Prevent ending with zero images
    const product = products.find(x => x.id === id) || {};
    const existing = Array.isArray(product.images) ? product.images : [];
    const clearAll = !!editForm.clear_images;
    const markedToRemove = Array.isArray(editForm.remove_image_ids) ? editForm.remove_image_ids : [];
    const newCount = (editForm.images && editForm.images.length) ? editForm.images.length : 0;
    const remaining = clearAll ? 0 : (existing.length - markedToRemove.length);
    if ((remaining + newCount) <= 0) {
      setError('You must keep at least one image or upload a new one.');
      return;
    }
    setBusy(true);
    try {
      if (editForm.clear_images && editForm.cover_image_id) {
        alert('You cannot clear all images and also set a cover. Uncheck Clear all or remove the cover selection.');
        return;
      }
      if (editForm.cover_image_id && editForm.remove_image_ids.includes(editForm.cover_image_id)) {
        alert('Selected cover is marked for removal. Choose a different cover or unmark removal.');
        return;
      }
      const fd = new FormData();
      for (const k of ['title','description','stock','category_id']) if (editForm[k] !== '') fd.append(k, editForm[k]);
      // category: if no category_id but input provided, map to id or send category_name
      if (!editForm.category_id) {
        const trimmed = String(editCategoryInput || '').trim();
        if (trimmed) {
          const match = categories.find(c => String(c.name).toLowerCase() === trimmed.toLowerCase());
          if (match) fd.append('category_id', match.id); else fd.append('category_name', trimmed);
        }
      }
      if (editForm.price_cents !== '') {
        const cents = Math.round(Number(editForm.price_cents || 0) * 100);
        fd.append('price_cents', String(cents));
      }
      if (editForm.compare_at_price !== '') {
        const cents = Math.round(Number(editForm.compare_at_price || 0) * 100);
        fd.append('compare_at_price_cents', String(cents));
      }
      if (editForm.clear_images) fd.append('clear_images', 'true');
      if (editForm.remove_image_ids && editForm.remove_image_ids.length) fd.append('remove_image_ids', JSON.stringify(editForm.remove_image_ids));
      if (editForm.cover_image_id) fd.append('cover_image_id', String(editForm.cover_image_id));
      if (editForm.images && editForm.images.length) {
        for (const file of editForm.images) fd.append('images', file);
      }
      await updateMyProduct(id, fd);
      setEditingId(null);
      await load();
    } catch {}
    finally { setBusy(false); }
  };

  const onShip = async (itemId) => {
    const tn = prompt('Enter tracking number (optional)') || undefined;
    try { await markItemShipped(itemId, { tracking_number: tn }); await loadOrders(); } catch {}
  };

  if (vendorGate.blocked) {
    return (
      <div>
        <h2>Vendor Dashboard</h2>
        {error && <div className="error">{error}</div>}
        <div className="card" style={{ padding:16 }}>
          <h3 style={{ marginTop:0 }}>{vendorGate.message}</h3>
          <div className="small muted">Your vendor account is not yet approved. You can continue shopping while waiting for admin approval.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Vendor Dashboard</h2>
      {error && <div className="error">{error}</div>}
      {vendor ? (
        <div className="card" style={{ padding:12, marginBottom:16 }}>
          <div><strong>Business:</strong> {vendor.business_name}</div>
          {vendor.phone && <div><strong>Phone:</strong> {vendor.phone}</div>}
          {vendor.address && <div><strong>Address:</strong> {vendor.address}</div>}
        </div>
      ) : (
        <div className="small">Loading vendor...</div>
      )}

      <div className="tabs" style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button className={`button ${tab==='products'?'':'ghost'}`} onClick={()=>setTab('products')}>Products</button>
        <button className={`button ${tab==='orders'?'':'ghost'}`} onClick={()=>setTab('orders')}>Orders</button>
      </div>

      {tab === 'products' && (
        <div className="grid" style={{ gap:16, gridTemplateColumns: gridCols }}>
          <form className="form" onSubmit={onCreate}>
            <h3>Create Product</h3>
            <label>Title</label>
            <input className="input" value={form.title} onChange={(e)=>setForm(f=>({...f, title:e.target.value}))} />
            <label>Description</label>
            <textarea className="input" value={form.description} onChange={(e)=>setForm(f=>({...f, description:e.target.value}))} />
            <label>Now Price (KSh)</label>
            <input className="input" min="0" type="number" value={form.price_cents} onChange={(e)=>setForm(f=>({...f, price_cents: Math.max(0, Number(e.target.value))}))} />
            <div className="small muted">Current selling price in KSh. Cannot be negative.</div>
            <label>Original Price (KSh, optional)</label>
            <input className="input" min="0" type="number" value={form.compare_at_price} onChange={(e)=>setForm(f=>({...f, compare_at_price: Math.max(0, Number(e.target.value))}))} />
            <div className="small muted">Leave blank if not discounted.</div>
            <label>Stock</label>
            <input className="input" min="0" type="number" value={form.stock} onChange={(e)=>setForm(f=>({...f, stock: Math.max(0, Number(e.target.value))}))} />
            <div className="small muted">Units in stock. Cannot be negative.</div>
            <label>Category</label>
            <input className="input" list="category-options" placeholder="Type or choose..." value={categoryInput} onChange={(e)=>{ setCategoryInput(e.target.value); setForm(f=>({...f, category_id:''})); }} />
            <datalist id="category-options">
              {categories.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
            <div className="small muted">Pick an existing category or type a new one.</div>
            <label>Images</label>
            <div className="row" style={{ gap:8, alignItems:'center' }}>
              <input className="input" type="file" accept="image/*" multiple onChange={(e)=>setCreateTempFiles(Array.from(e.target.files||[]))} />
              <button type="button" className="button" disabled={!createTempFiles.length} onClick={()=>{
                if (!createTempFiles.length) return; setForm(f=>({ ...f, images:[...(f.images||[]), ...createTempFiles] })); setCreateTempFiles([]);
              }}>Okay</button>
            </div>
            {form.images && form.images.length > 0 && (
              <div className="mt-8">
                <h5 style={{ margin:'0 0 6px 0' }}>Pending Uploads</h5>
                <div className="small muted">These will be added when you Save/Publish</div>
                <div className="row" style={{ gap:8, flexWrap:'wrap', marginTop:8 }}>
                  {form.images.map((file, idx) => (
                    <div key={idx} className="card" style={{ padding:6, position:'relative' }}>
                      <img src={URL.createObjectURL(file)} alt="pending" style={{ width:80, height:80, objectFit:'cover', borderRadius:6 }} />
                      <button type="button" aria-label="Remove pending image" className="button ghost" style={{ position:'absolute', top:4, right:4, padding:'2px 6px' }} onClick={()=>setForm(f=>({ ...f, images:f.images.filter((_,i)=>i!==idx) }))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="button mt-12" disabled={busy} type="submit">{busy? 'Saving...':'Save'}</button>
          </form>

          <div>
            <h3>My Products</h3>
            {products.length === 0 && <div className="small">No products yet.</div>}
              <div className="products-grid" style={{ gap:12 }}>
                {products.map(p => (
                <div key={p.id} className={`card ${editingId===p.id ? 'editing' : ''}`} style={{ padding:12 }}>
                  <div className="product-item">
                    <img
                      src={toAbsoluteUrl((() => {
                        if (editingId === p.id) {
                          const imgs = Array.isArray(p.images) ? p.images : [];
                          const hiddenSet = editPreviewApplied ? new Set(editHiddenIds) : new Set();
                          const pickVisibleById = (id) => {
                            const found = imgs.find(i => i.id === id);
                            if (!found) return undefined;
                            if (hiddenSet.has(found.id)) return undefined;
                            return found.url;
                          };
                          let url = undefined;
                          if (editForm.cover_image_id) url = pickVisibleById(editForm.cover_image_id);
                          if (!url) {
                            const currentCover = imgs.find(i => i.url === p.image_url && !hiddenSet.has(i.id));
                            url = currentCover?.url || imgs.find(i => !hiddenSet.has(i.id))?.url || p.image_url || '';
                          }
                          return url || '';
                        }
                        return p.image_url || (p.images && p.images[0]?.url) || '';
                      })())}
                      alt={p.title}
                      style={{ width:96, height:96, objectFit:'cover', borderRadius:8 }}
                    />
                    <div style={{ flex:1 }}>
                      {editingId === p.id ? (
                        <>
                          <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            <input className="input" value={editForm.title} onChange={(e)=>setEditForm(f=>({...f, title:e.target.value}))} />
                            <input className="input" min="0" type="number" value={editForm.price_cents} onChange={(e)=>setEditForm(f=>({...f, price_cents: Math.max(0, Number(e.target.value))}))} />
                            <input className="input" min="0" type="number" value={editForm.compare_at_price} onChange={(e)=>setEditForm(f=>({...f, compare_at_price: Math.max(0, Number(e.target.value))}))} />
                            <input className="input" min="0" type="number" value={editForm.stock} onChange={(e)=>setEditForm(f=>({...f, stock: Math.max(0, Number(e.target.value))}))} />
                            <input className="input" list="category-options" placeholder="Type or choose category" value={editForm.category_id ? (categories.find(c=>c.id===editForm.category_id)?.name || '') : editCategoryInput}
                              onChange={(e)=>{
                                const val = e.target.value;
                                const match = categories.find(c => c.name.toLowerCase() === String(val).toLowerCase());
                                if (match) {
                                  setEditForm(f=>({...f, category_id: match.id}));
                                  setEditCategoryInput(match.name);
                                } else {
                                  setEditForm(f=>({...f, category_id: ''}));
                                  setEditCategoryInput(val);
                                }
                              }}
                            />
                            <textarea className="input" style={{ gridColumn:'1 / -1' }} value={editForm.description} onChange={(e)=>setEditForm(f=>({...f, description:e.target.value}))} />
                          </div>
                          <label>Add Images</label>
                          <div className="row" style={{ gap:8, alignItems:'center' }}>
                            <input
                              className="input"
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e)=>setEditTempFiles(Array.from(e.target.files||[]))}
                            />
                            <button
                              type="button"
                              className="button"
                              disabled={!editTempFiles.length}
                              onClick={()=>{
                                if (!editTempFiles.length) return;
                                setEditForm(f=>({ ...f, images: [...(f.images||[]), ...editTempFiles] }));
                                setEditTempFiles([]);
                              }}
                            >Okay</button>
                          </div>
                          {editForm.images && editForm.images.length > 0 && (
                            <div style={{ marginTop:8 }}>
                              <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                                <strong>Pending Uploads</strong>
                                <span className="small muted">These will be added when you Save/Publish</span>
                              </div>
                              <div className="row" style={{ gap:8, flexWrap:'wrap', marginTop:6 }}>
                                {editForm.images.map((file, idx) => (
                                  <div key={idx} className="card" style={{ padding:6, position:'relative' }}>
                                    <img src={URL.createObjectURL(file)} alt="pending" style={{ width:80, height:80, objectFit:'cover', borderRadius:6 }} />
                                    <button
                                      type="button"
                                      className="button ghost"
                                      style={{ position:'absolute', top:4, right:4, padding:'2px 6px' }}
                                      title="Remove from pending"
                                      onClick={()=>setEditForm(f=>({ ...f, images: f.images.filter((_,i)=>i!==idx) }))}
                                    >x</button>
                                    <div className="small muted" style={{ marginTop:4 }}>Cover can be set after save</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                            {Array.isArray(p.images) && p.images.length > 0 && (
                          <div style={{ gridColumn:'1 / -1' }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <strong>Existing Images</strong>
                              <label className="row" style={{ gap:6 }}>
                                <input type="checkbox" checked={!!editForm.clear_images} onChange={e=>setEditForm(f=>({...f, clear_images:e.target.checked}))} />
                                <span>Clear all images</span>
                              </label>
                            </div>
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                              {p.images.filter(img => !(editPreviewApplied && editHiddenIds.includes(img.id))).map(img => {
                                const marked = editForm.remove_image_ids.includes(img.id);
                                const cover = editForm.cover_image_id ? (editForm.cover_image_id === img.id) : (p.image_url === img.url);
                                return (
                                  <div key={img.id} className="card" style={{ padding:6 }}>
                                    <img src={toAbsoluteUrl(img.url)} alt="img" style={{ width:80, height:80, objectFit:'cover', borderRadius:6, opacity: marked? 0.4:1 }} />
                                    <div className="row" style={{ gap:8, marginTop:6, alignItems:'center' }}>
                                      <label className="row" style={{ gap:6, alignItems:'center' }}>
                                        <input type="checkbox" checked={marked} disabled={editForm.clear_images}
                                          onChange={(e)=>setEditForm(f=>({
                                            ...f,
                                            remove_image_ids: e.target.checked? [...f.remove_image_ids, img.id] : f.remove_image_ids.filter(id=>id!==img.id)
                                          }))}
                                        />
                                        <span className="small">Remove</span>
                                      </label>
                                      <label className="row" style={{ gap:6, alignItems:'center' }}>
                                        <input type="radio" name={`cover-${p.id}`} checked={cover} disabled={editForm.clear_images || editForm.remove_image_ids.includes(img.id)}
                                          onChange={()=>setEditForm(f=>({ ...f, cover_image_id: img.id }))}
                                        />
                                        <span className="small">Cover</span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="row" style={{ gap:8, marginTop:8 }}>
                              <button type="button" className="button ghost" onClick={()=>{ setEditPreviewApplied(true); setEditHiddenIds(editForm.remove_image_ids.slice()); }}>Okay</button>
                              {editPreviewApplied && (
                                <button type="button" className="button ghost" onClick={()=>{ setEditPreviewApplied(false); setEditHiddenIds([]); }}>Reset Preview</button>
                              )}
                            </div>
                            <div className="small muted" style={{ marginTop:6 }}>Cover can be set after save</div>
                            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
                              <button type="button" className="button" onClick={()=>saveEdit(p.id)} disabled={busy}>{busy? 'Saving...':'Save'}</button>
                              <button type="button" className="button ghost" onClick={cancelEdit}>Cancel</button>
                            </div>
                          </div>
                        )}
                        </>
                      ) : (
                        <>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                            <strong>{p.title}</strong>
                            <div>
                              <span>KSh {(p.price_cents/100).toFixed(2)}</span>
                              {typeof p.compare_at_price_cents==='number' && p.compare_at_price_cents>p.price_cents && (
                                <span className="small muted" style={{ marginLeft:8, textDecoration:'line-through', opacity:0.6 }}>KSh {(p.compare_at_price_cents/100).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          <div className="small">Stock: {p.stock}</div>
                          <div className="small">Updated: {new Date(p.updated_at).toLocaleString()}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-8" style={{ display:'flex', gap:8 }}>
                    {editingId === p.id ? null : (
                      <>
                        <button className="button" onClick={()=>startEdit(p)}>Edit</button>
                        <button className="button ghost" onClick={()=>onDelete(p.id)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div>
          <h3>Order Items</h3>
          {orders.length === 0 && <div className="small">No orders yet.</div>}
          <div className="stack" style={{ gap:12 }}>
            {orders.map(o => (
              <div key={o.id} className="card" style={{ padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                  <div>
                    <div><strong>{o.product_title}</strong> × {o.quantity}</div>
                    <div className="small">Order: {o.order_id.slice(0,8)} • {new Date(o.order_created_at).toLocaleString()}</div>
                    <div className="small">Status: {o.vendor_item_status}</div>
                    {o.tracking_number && <div className="small">Tracking: {o.tracking_number}</div>}
                  </div>
                  {o.vendor_item_status !== 'shipped' && (
                    <button className="button" onClick={()=>onShip(o.id)}>Mark Shipped</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
