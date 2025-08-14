import { useEffect, useState, useContext } from 'react';
import api from '../api/client';
import { toAbsoluteUrl } from '../utils/media';
import { AuthContext } from '../context/AuthContext.jsx';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [productVendorId, setProductVendorId] = useState('');
  const [form, setForm] = useState({ title: '', price_ksh: 0, compare_ksh: '', stock: 0, category_id: '', image_url: '', description: '', images: [] });
  const [categoryInput, setCategoryInput] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title:'', price_ksh:0, compare_ksh:'', stock:0, category_id:'', image_url:'', description:'', images:[], remove_image_ids:[], clear_images:false, cover_image_id:null });
  const [editCategoryInput, setEditCategoryInput] = useState('');
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorStatus, setVendorStatus] = useState('pending');
  const [vendors, setVendors] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [catForm, setCatForm] = useState({ name:'', slug:'' });
  const [catEditingId, setCatEditingId] = useState(null);
  const [catEdit, setCatEdit] = useState({ name:'', slug:'' });
  const [promoteUserId, setPromoteUserId] = useState('');
  // super_admin: admins management
  const [admins, setAdmins] = useState([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [adminStatus, setAdminStatus] = useState(''); // '', 'active', 'suspended'
  const [newAdmin, setNewAdmin] = useState({ email:'', name:'', password:'' });
  const [editAdminId, setEditAdminId] = useState(null);
  const [editAdmin, setEditAdmin] = useState({ name:'', phone:'', location:'', street_address:'', delivery_preference:'', bio:'', avatar_url:'' });
  const [selectedAdmins, setSelectedAdmins] = useState([]);

  // Featured products state (super_admin only)
  const [featured, setFeatured] = useState([]); // [{position, product_id, title, image_url}]
  const [suggestions, setSuggestions] = useState([]); // [{id, title, image_url}]
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  const load = async () => {
    const [prod, { data: cats }] = await Promise.all([
      api.get('/products', { params: { q: productQuery || undefined, vendor_id: productVendorId || undefined, limit: 500, page: 1 } }).then(r => r.data),
      api.get('/categories')
    ]);
    setProducts(prod.items);
    setCategories(cats);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'products') load(); }, [tab, productQuery, productVendorId]);
  const loadPending = async () => {
    try { const { data } = await api.get('/admin/vendors/pending-count'); setPendingCount(data.count || 0); } catch {}
  };
  useEffect(() => { if (tab === 'vendors') loadPending(); }, [tab]);
  useEffect(() => { if (tab === 'admins' && user?.role === 'super_admin') loadAdmins(); }, [tab, adminQuery, adminStatus]);

  // Load featured and suggestions when Featured tab opens
  useEffect(() => {
    if (tab !== 'featured' || user?.role !== 'super_admin') return;
    let mounted = true;
    (async () => {
      try {
        const [f, s] = await Promise.all([
          api.get('/admin/featured'),
          api.get('/admin/featured/suggest')
        ]);
        if (!mounted) return;
        setFeatured(f.data || []);
        setSuggestions(s.data || []);
      } catch (e) {
        if (!mounted) return;
        setFeatured([]); setSuggestions([]);
      }
    })();
    return () => { mounted = false; };
  }, [tab, user?.role]);

  const moveUp = (idx) => {
    if (idx <= 0) return;
    setFeatured(list => {
      const copy = [...list];
      [copy[idx-1], copy[idx]] = [copy[idx], copy[idx-1]];
      return copy.map((it, i) => ({ ...it, position: i+1 }));
    });
  };
  const moveDown = (idx) => {
    setFeatured(list => {
      if (idx >= list.length - 1) return list;
      const copy = [...list];
      [copy[idx+1], copy[idx]] = [copy[idx], copy[idx+1]];
      return copy.map((it, i) => ({ ...it, position: i+1 }));
    });
  };
  const removeFeatured = (product_id) => {
    setFeatured(list => list.filter(it => it.product_id !== product_id).map((it, i) => ({ ...it, position: i+1 })));
  };
  const addFeatured = (item) => {
    setFeatured(list => {
      if (list.find(x => x.product_id === item.id)) return list;
      if (list.length >= 30) return list;
      return [...list, { position: list.length + 1, product_id: item.id, title: item.title, image_url: item.image_url }];
    });
  };
  const saveFeatured = async () => {
    setSaveMsg(''); setSaveErr('');
    try {
      const items = featured.map(f => f.product_id);
      await api.put('/admin/featured', { items });
      setSaveMsg('Featured products saved');
    } catch (e) {
      setSaveErr(e?.response?.data?.message || 'Failed to save');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    // Convert KSh to cents
    const price_cents = Math.round(Number(form.price_ksh || 0) * 100);
    if (!Number.isNaN(price_cents)) fd.append('price_cents', String(price_cents));
    if (form.compare_ksh !== '' && form.compare_ksh !== null && form.compare_ksh !== undefined) {
      const compare_cents = Math.round(Number(form.compare_ksh || 0) * 100);
      if (!Number.isNaN(compare_cents)) fd.append('compare_at_price_cents', String(compare_cents));
    }
    for (const k of ['title','stock','image_url','description']) if (form[k] !== '' && form[k] !== null && form[k] !== undefined) fd.append(k, form[k]);
    // category: if category_id selected use it; else try to map input name to id, or send category_name
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
    await load();
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
    // Convert KSh to cents
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

  const searchVendors = async (e) => {
    e?.preventDefault?.();
    const { data } = await api.get('/admin/vendors', { params: { q: vendorQuery || undefined, status: vendorStatus || undefined } });
    setVendors(data);
  };
  useEffect(() => { if (tab === 'vendors') searchVendors(); }, [tab, vendorStatus]);

  const onApprove = async (id) => { await api.put(`/admin/vendors/${id}/status`, { status: 'approved' }); await searchVendors(); };
  const onSuspend = async (id) => { await api.put(`/admin/vendors/${id}/status`, { status: 'suspended' }); await searchVendors(); };
  const onSetPending = async (id) => { await api.put(`/admin/vendors/${id}/status`, { status: 'pending' }); await searchVendors(); };
  useEffect(() => { if (tab === 'vendors') loadPending(); }, [vendors]);

  // super_admin: admins management
  const loadAdmins = async () => {
    const { data } = await api.get('/admin/admins', { params: { q: adminQuery || undefined, status: adminStatus || undefined } });
    setAdmins(data);
  };
  const createAdmin = async (e) => {
    e.preventDefault();
    await api.post('/admin/admins', newAdmin);
    setNewAdmin({ email:'', name:'', password:'' });
    await loadAdmins();
  };
  const setAdminActive = async (id) => { await api.put(`/admin/admins/${id}/status`, { status:'active' }); await loadAdmins(); };
  const setAdminSuspended = async (id) => { await api.put(`/admin/admins/${id}/status`, { status:'suspended' }); await loadAdmins(); };
  const removeAdmin = async (id) => { await api.delete(`/admin/admins/${id}`); await loadAdmins(); };
  const startEditAdmin = (a) => { setEditAdminId(a.id); setEditAdmin({ name:a.name||'', phone:a.phone||'', location:a.location||'', street_address:a.street_address||'', delivery_preference:a.delivery_preference||'', bio:a.bio||'', avatar_url:a.avatar_url||'' }); };
  const saveEditAdmin = async (id) => { await api.put(`/admin/admins/${id}/profile`, editAdmin); setEditAdminId(null); await loadAdmins(); };
  const demoteAdmin = async (id) => { await api.put(`/admin/admins/${id}/demote`); await loadAdmins(); };
  const toggleSelectAdmin = (id, checked) => {
    setSelectedAdmins(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
  };
  const bulkAction = async (action) => {
    if (!selectedAdmins.length) return;
    await api.post('/admin/admins/bulk', { action, ids: selectedAdmins });
    setSelectedAdmins([]);
    await loadAdmins();
  };

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <div className="tabs" style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button className={`button ${tab==='products'?"":"ghost"}`} onClick={()=>setTab('products')}>Products</button>
        <button className={`button ${tab==='vendors'?"":"ghost"}`} onClick={()=>setTab('vendors')}>Vendors {pendingCount>0 && <span className="badge" style={{ marginLeft:6 }}>{pendingCount}</span>}</button>
        <button className={`button ${tab==='categories'?"":"ghost"}`} onClick={()=>setTab('categories')}>Categories</button>
        {user?.role === 'super_admin' && (
          <button className={`button ${tab==='admins'?"":"ghost"}`} onClick={()=>setTab('admins')}>Admins</button>
        )}
        {user?.role === 'super_admin' && (
          <button className={`button ${tab==='featured'?"":"ghost"}`} onClick={()=>setTab('featured')}>Featured</button>
        )}
      </div>
      {tab === 'products' && (
      <>
      <section className="card" style={{ padding: 16 }}>
        <h3 className="title" style={{ marginTop: 0 }}>Create Product</h3>
        <form onSubmit={create} className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({ ...form, title: e.target.value })} />
          <input className="input" placeholder="Image URL" value={form.image_url} onChange={e=>setForm({ ...form, image_url: e.target.value })} />
          <input className="input" min="0" type="number" placeholder="Now Price (KSh)" value={form.price_ksh} onChange={e=>setForm({ ...form, price_ksh: Math.max(0, Number(e.target.value)) })} />
          <div className="small muted">Current selling price in KSh. Cannot be negative.</div>
          <input className="input" min="0" type="number" placeholder="Original Price (KSh, optional)" value={form.compare_ksh} onChange={e=>setForm({ ...form, compare_ksh: Math.max(0, Number(e.target.value)) })} />
          <div className="small muted">Leave blank if not discounted.</div>
          <input className="input" min="0" type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm({ ...form, stock: Math.max(0, Number(e.target.value)) })} />
          <div className="small muted">Stock quantity must be non-negative.</div>
          <input className="input" list="admin-category-options" placeholder="Type or choose category" value={categoryInput}
                 onChange={e=>{ setCategoryInput(e.target.value); setForm(f=>({ ...f, category_id:'' })); }} />
          <datalist id="admin-category-options">
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
                  <input className="input" list="admin-category-options" placeholder="Type or choose category" value={editForm.category_id ? (categories.find(c=>c.id===editForm.category_id)?.name || '') : editCategoryInput}
                         onChange={e=>{
                           const val = e.target.value;
                           const match = categories.find(c => c.name.toLowerCase() === String(val).toLowerCase());
                           if (match) { setEditForm(f=>({ ...f, category_id: match.id })); setEditCategoryInput(match.name); }
                           else { setEditForm(f=>({ ...f, category_id: '' })); setEditCategoryInput(val); }
                         }}
                  />
                  <datalist id="admin-category-options">
                    {categories.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                  <textarea className="input" value={editForm.description} onChange={e=>setEditForm(f=>({ ...f, description:e.target.value }))} />
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

      {tab === 'admins' && user?.role === 'super_admin' && (
        <section>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
            <h3 style={{ margin:0 }}>Admins</h3>
            <div className="row" style={{ gap:6 }}>
              <button className={`button ${adminStatus===''?'':'ghost'}`} onClick={()=>setAdminStatus('')}>All</button>
              <button className={`button ${adminStatus==='active'?'':'ghost'}`} onClick={()=>setAdminStatus('active')}>Active</button>
              <button className={`button ${adminStatus==='suspended'?'':'ghost'}`} onClick={()=>setAdminStatus('suspended')}>Suspended</button>
            </div>
          </div>
          <form className="row" style={{ gap:8, margin: '12px 0' }} onSubmit={async (e)=>{ e.preventDefault(); await loadAdmins(); }}>
            <input className="input" placeholder="Search by email or name" value={adminQuery} onChange={e=>setAdminQuery(e.target.value)} />
            <button className="button" type="submit">Search</button>
          </form>

          <div className="card" style={{ padding:12, marginBottom:12 }}>
            <h4 style={{ marginTop:0 }}>Create Admin</h4>
            <form className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }} onSubmit={createAdmin}>
              <input className="input" placeholder="Email" value={newAdmin.email} onChange={e=>setNewAdmin(f=>({ ...f, email:e.target.value }))} />
              <input className="input" placeholder="Name (optional)" value={newAdmin.name} onChange={e=>setNewAdmin(f=>({ ...f, name:e.target.value }))} />
              <input className="input" placeholder="Password" type="password" value={newAdmin.password} onChange={e=>setNewAdmin(f=>({ ...f, password:e.target.value }))} />
              <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end' }}>
                <button className="button" type="submit">Create</button>
              </div>
            </form>
          </div>

          {admins.length > 0 && (
            <div className="row" style={{ gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <button className="button" onClick={()=>bulkAction('activate')} disabled={!selectedAdmins.length}>Bulk Activate</button>
              <button className="button ghost" onClick={()=>bulkAction('suspend')} disabled={!selectedAdmins.length}>Bulk Suspend</button>
              <button className="button ghost" onClick={()=>bulkAction('demote')} disabled={!selectedAdmins.length}>Bulk Demote</button>
              <button className="button ghost" onClick={()=>bulkAction('delete')} disabled={!selectedAdmins.length}>Bulk Delete</button>
              <span className="small muted">Selected: {selectedAdmins.length}</span>
            </div>
          )}

          <div className="stack" style={{ gap:8 }}>
            {admins.map(a => (
              <div key={a.id} className="card" style={{ padding:12 }}>
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div>
                    <div className="row" style={{ alignItems:'center', gap:8 }}>
                      <input type="checkbox" checked={selectedAdmins.includes(a.id)} onChange={e=>toggleSelectAdmin(a.id, e.target.checked)} />
                      <div><strong>{a.email}</strong> {a.name ? <span className="small muted">• {a.name}</span> : null}</div>
                    </div>
                    <div className="small">Status: {a.status || 'active'}</div>
                  </div>
                  <div className="row" style={{ gap:6 }}>
                    {a.status !== 'active' && <button className="button" onClick={()=>setAdminActive(a.id)}>Activate</button>}
                    {a.status !== 'suspended' && <button className="button ghost" onClick={()=>setAdminSuspended(a.id)}>Suspend</button>}
                    <button className="button ghost" onClick={()=>demoteAdmin(a.id)}>Demote</button>
                    <button className="button ghost" onClick={()=>removeAdmin(a.id)}>Delete</button>
                    <button className="button" onClick={()=>startEditAdmin(a)}>Edit Profile</button>
                  </div>
                </div>
                {editAdminId === a.id && (
                  <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                    <input className="input" placeholder="Name" value={editAdmin.name} onChange={e=>setEditAdmin(f=>({ ...f, name:e.target.value }))} />
                    <input className="input" placeholder="Phone" value={editAdmin.phone} onChange={e=>setEditAdmin(f=>({ ...f, phone:e.target.value }))} />
                    <input className="input" placeholder="Location" value={editAdmin.location} onChange={e=>setEditAdmin(f=>({ ...f, location:e.target.value }))} />
                    <input className="input" placeholder="Street address" value={editAdmin.street_address} onChange={e=>setEditAdmin(f=>({ ...f, street_address:e.target.value }))} />
                    <input className="input" placeholder="Delivery preference" value={editAdmin.delivery_preference} onChange={e=>setEditAdmin(f=>({ ...f, delivery_preference:e.target.value }))} />
                    <input className="input" placeholder="Avatar URL" value={editAdmin.avatar_url} onChange={e=>setEditAdmin(f=>({ ...f, avatar_url:e.target.value }))} />
                    <textarea className="input" placeholder="Bio" value={editAdmin.bio} onChange={e=>setEditAdmin(f=>({ ...f, bio:e.target.value }))} />
                    <div style={{ gridColumn:'1 / -1', display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button className="button" onClick={()=>saveEditAdmin(a.id)}>Save</button>
                      <button className="button ghost" onClick={()=>setEditAdminId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'featured' && user?.role === 'super_admin' && (
        <section className="stack" style={{ gap:12 }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Homepage Featured (1–30)</h3>
            <div className="row" style={{ gap:8 }}>
              <button className="button" onClick={saveFeatured}>Save</button>
            </div>
          </div>
          {saveMsg && <div className="success" role="status">{saveMsg}</div>}
          {saveErr && <div className="error" role="alert">{saveErr}</div>}

          <div className="grid" style={{ gridTemplateColumns:'2fr 1fr', gap:12 }}>
            <div className="card" style={{ padding:12 }}>
              <h4 style={{ marginTop:0 }}>Current Order</h4>
              {featured.length === 0 && <div className="small muted">No featured products yet.</div>}
              <div className="stack" style={{ gap:8 }}>
                {featured.map((f, idx) => (
                  <div key={f.product_id} className="row" style={{ alignItems:'center', gap:8, border:'1px solid rgba(0,0,0,0.08)', borderRadius:8, padding:8 }}>
                    <span className="pill">{idx+1}</span>
                    {f.image_url && <img src={f.image_url} alt="thumb" style={{ width:40, height:40, objectFit:'cover', borderRadius:6 }} />}
                    <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title || f.product_id}</div>
                    <div className="row" style={{ gap:6 }}>
                      <button className="button ghost" onClick={()=>moveUp(idx)} disabled={idx===0}>Up</button>
                      <button className="button ghost" onClick={()=>moveDown(idx)} disabled={idx===featured.length-1}>Down</button>
                      <button className="button ghost" onClick={()=>removeFeatured(f.product_id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding:12 }}>
              <h4 style={{ marginTop:0 }}>Suggestions</h4>
              <div className="stack" style={{ gap:8, maxHeight:420, overflowY:'auto' }}>
                {suggestions.map(s => (
                  <div key={s.id} className="row" style={{ alignItems:'center', gap:8 }}>
                    {s.image_url && <img src={s.image_url} alt="s" style={{ width:40, height:40, objectFit:'cover', borderRadius:6 }} />}
                    <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
                    <button className="button" disabled={!!featured.find(x=>x.product_id===s.id) || featured.length>=30} onClick={()=>addFeatured(s)}>Add</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'categories' && (
        <section>
          <h3>Categories</h3>
          <form className="row" style={{ gap:8, marginBottom:12 }} onSubmit={async (e)=>{
            e.preventDefault();
            await api.post('/categories', catForm);
            setCatForm({ name:'', slug:'' });
            const { data } = await api.get('/categories');
            setCategories(data);
          }}>
            <input className="input" placeholder="Name" value={catForm.name} onChange={e=>setCatForm(f=>({ ...f, name:e.target.value }))} />
            <input className="input" placeholder="Slug" value={catForm.slug} onChange={e=>setCatForm(f=>({ ...f, slug:e.target.value }))} />
            <button className="button" type="submit">Add</button>
          </form>
          <div className="stack" style={{ gap:8 }}>
            {categories.map(c => (
              <div key={c.id} className="row" style={{ gap:8, alignItems:'center' }}>
                {catEditingId === c.id ? (
                  <>
                    <input className="input" value={catEdit.name} onChange={e=>setCatEdit(f=>({ ...f, name:e.target.value }))} />
                    <input className="input" value={catEdit.slug} onChange={e=>setCatEdit(f=>({ ...f, slug:e.target.value }))} />
                    <button className="button" onClick={async ()=>{
                      await api.put(`/categories/${c.id}`, catEdit);
                      setCatEditingId(null);
                      const { data } = await api.get('/categories');
                      setCategories(data);
                    }}>Save</button>
                    <button className="button ghost" onClick={()=>setCatEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{ minWidth:140 }}><strong>{c.name}</strong></div>
                    <div className="small" style={{ flex:1 }}>{c.slug}</div>
                    <button className="button" onClick={()=>{ setCatEditingId(c.id); setCatEdit({ name:c.name, slug:c.slug }); }}>Edit</button>
                    <button className="button ghost" onClick={async ()=>{ await api.delete(`/categories/${c.id}`); const { data } = await api.get('/categories'); setCategories(data); }}>Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
                  <div style={{ gridColumn:'1 / -1' }}>
                    <label>Add Images</label>
                    <input className="input" type="file" accept="image/*" multiple onChange={(e)=>setEditForm(f=>({ ...f, images: Array.from(e.target.files||[]) }))} />
                  </div>
                  <div style={{ gridColumn:'1 / -1', display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button className="button" onClick={()=>saveEdit(p.id)}>Save</button>
                    <button className="button ghost" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="title" style={{ margin: 0 }}>{p.title}</div>
                  <small className="meta">
                    KSh {(p.price_cents/100).toFixed(2)}
                    {p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents ? (
                      <>
                        {' '}
                        <span className="muted" style={{ textDecoration:'line-through' }}>KSh {(p.compare_at_price_cents/100).toFixed(2)}</span>
                      </>
                    ) : null}
                    {' '}• Stock: {p.stock}
                  </small>
                </>
              )}
            </div>
            {editing === p.id ? null : (
              <div className="row" style={{ gap:8, marginTop:8 }}>
                <button className="button" onClick={()=>startEdit(p)}>Edit</button>
                <button className="button ghost" onClick={()=>remove(p.id)}>Delete</button>
              </div>
            )}
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
            <div className="row" style={{ gap:6 }}>
              <button className={`button ${vendorStatus==='pending'?'':'ghost'}`} onClick={()=>setVendorStatus('pending')}>Pending</button>
              <button className={`button ${vendorStatus==='approved'?'':'ghost'}`} onClick={()=>setVendorStatus('approved')}>Approved</button>
              <button className={`button ${vendorStatus==='suspended'?'':'ghost'}`} onClick={()=>setVendorStatus('suspended')}>Suspended</button>
            </div>
          </div>
          <form onSubmit={searchVendors} className="row" style={{ gap:8, margin: '12px 0' }}>
            <input className="input" placeholder="Search by business name, vendor name, or email" value={vendorQuery} onChange={e=>setVendorQuery(e.target.value)} />
            <button className="button" type="submit">Search</button>
          </form>
          <div className="stack" style={{ gap:8 }}>
            {vendors.map(v => (
              <div key={v.id} className="card" style={{ padding:12 }}>
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div>
                    <div><strong>{v.business_name}</strong></div>
                    <div className="small">Owner: {v.user_name} ({v.user_email})</div>
                    <div className="small">Status: {v.status || 'pending'} • Products: {v.product_count}</div>
                  </div>
                  <div className="row" style={{ gap:6 }}>
                    <button className="button ghost" onClick={()=>{ setProductQuery(''); setProductVendorId(v.id); setTab('products'); }}>View products</button>
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
    </div>
  );
}

