import { useEffect, useRef, useState, useContext, memo } from 'react';
import api from '../api/client';
import { AuthContext } from '../context/AuthContext.jsx';
import Pagination from '../components/Pagination.jsx';
import Admin2Dashboard from './Admin2Dashboard.jsx';

export default function SuperAdminDashboard() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('admins');
  const [adminQuery, setAdminQuery] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ email:'', name:'', password:'', confirm_password:'', role:'admin' });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [editAdminId, setEditAdminId] = useState(null);
  const [editAdmin, setEditAdmin] = useState({ name:'', phone:'', location:'', street_address:'', delivery_preference:'', bio:'', avatar_url:'' });
  const [selectedAdmins, setSelectedAdmins] = useState([]);

  // Featured products state
  const [featured, setFeatured] = useState([]); // [{position, product_id, title, image_url}]
  const [suggestions, setSuggestions] = useState([]); // [{id, title, image_url}]
  const [suggQuery, setSuggQuery] = useState('');
  const [suggPage, setSuggPage] = useState(1);
  const [suggLimit, setSuggLimit] = useState(15);
  const [suggTotal, setSuggTotal] = useState(0);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const featuredCacheRef = useRef({
    featured: null,
    suggestionsPages: new Map(), // key: `${q}|${page}|${limit}` => items
    suggestionsTotals: new Map(), // key: `${q}` => total
  });

  // Reviews moderation state (super_admin)
  const [allReviews, setAllReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');

  const loadAdmins = async () => {
    const { data } = await api.get('/admin/admins', { params: { q: adminQuery || undefined, status: adminStatus || undefined } });
    setAdmins(data);
  };
  useEffect(() => { loadAdmins(); }, [adminQuery, adminStatus]);

  // Load featured when tab opens
  useEffect(() => {
    if (tab !== 'featured') return;
    (async () => {
      try {
        if (featuredCacheRef.current.featured) {
          setFeatured(featuredCacheRef.current.featured);
          return;
        }
        const { data } = await api.get('/admin/featured');
        const list = Array.isArray(data) ? data : [];
        featuredCacheRef.current.featured = list;
        setFeatured(list);
      } catch {
        // keep previous featured on error
      }
    })();
  }, [tab]);

  // Load suggestions with search + pagination
  useEffect(() => {
    if (tab !== 'featured') return;
    (async () => {
      try {
        const key = `${suggQuery}|${suggPage}|${suggLimit}`;
        const cached = featuredCacheRef.current.suggestionsPages.get(key);
        const cachedTotal = featuredCacheRef.current.suggestionsTotals.get(suggQuery || '__all__');
        if (cached) {
          setSuggestions(cached);
          setSuggTotal(typeof cachedTotal === 'number' ? cachedTotal : 0);
          return;
        }
        const { data } = await api.get('/admin/featured/suggest', { params: { q: suggQuery || undefined, page: suggPage, limit: suggLimit } });
        const items = Array.isArray(data?.items) ? data.items : [];
        const total = Number(data?.total || 0);
        featuredCacheRef.current.suggestionsPages.set(key, items);
        featuredCacheRef.current.suggestionsTotals.set(suggQuery || '__all__', total);
        setSuggestions(items);
        setSuggTotal(total);
      } catch {
        // keep previous suggestions on error
      }
    })();
  }, [tab, suggQuery, suggPage, suggLimit]);

  // Load all reviews when Reviews tab opens
  const loadReviews = async () => {
    setReviewsError('');
    setReviewsLoading(true);
    try {
      const { data } = await api.get('/admin/reviews', { params: { limit: 500 } });
      setAllReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      setReviewsError(e?.response?.data?.message || e?.message || 'Failed to load reviews');
      setAllReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };
  useEffect(() => { if (tab === 'reviews') loadReviews(); }, [tab]);
  const deleteReview = async (id) => { try { await api.delete(`/admin/reviews/${id}`); await loadReviews(); } catch {} };

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
    setFeatured(list => {
      const next = list.filter(it => it.product_id !== product_id).map((it, i) => ({ ...it, position: i+1 }));
      featuredCacheRef.current.featured = next;
      return next;
    });
  };
  const addFeatured = (item) => {
    setFeatured(list => {
      if (list.find(x => x.product_id === item.id)) return list;
      if (list.length >= 30) return list;
      const next = [...list, { position: list.length + 1, product_id: item.id, title: item.title, image_url: item.image_url }];
      featuredCacheRef.current.featured = next;
      return next;
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

  // Drag and drop reorder (HTML5 DnD)
  const [dragIndex, setDragIndex] = useState(null);
  const onDragStart = (idx) => setDragIndex(idx);
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (idx) => {
    setFeatured(list => {
      if (dragIndex === null || dragIndex === idx) return list;
      const copy = [...list];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(idx, 0, moved);
      const next = copy.map((it, i) => ({ ...it, position: i+1 }));
      featuredCacheRef.current.featured = next;
      return next;
    });
    setDragIndex(null);
  };

  // Memoized row components to avoid re-renders
  const FeaturedRow = memo(function FeaturedRow({ f, idx, onUp, onDown, onRemove, onDragStart, onDragOver, onDrop }) {
    return (
      <div
        className="row"
        draggable
        onDragStart={() => onDragStart(idx)}
        onDragOver={onDragOver}
        onDrop={(e) => { e.preventDefault(); onDrop(idx); }}
        style={{ alignItems:'center', gap:8, border:'1px solid rgba(0,0,0,0.08)', borderRadius:8, padding:8, background:'#fff' }}
      >
        <span className="pill">{idx+1}</span>
        {f.image_url && <img loading="lazy" decoding="async" src={f.image_url} alt="thumb" style={{ width:40, height:40, objectFit:'cover', borderRadius:6 }} />}
        <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title || f.product_id}</div>
        <div className="row" style={{ gap:6 }}>
          <button type="button" className="button ghost" onClick={()=>onUp(idx)} disabled={idx===0}>Up</button>
          <button type="button" className="button ghost" onClick={()=>onDown(idx)} disabled={idx===featured.length-1}>Down</button>
          <button type="button" className="button ghost" onClick={()=>onRemove(f.product_id)}>Remove</button>
        </div>
      </div>
    );
  });

  const SuggestionRow = memo(function SuggestionRow({ s, disabled, onSend }) {
    return (
      <div className="row" style={{ alignItems:'center', gap:8 }}>
        {s.image_url && <img loading="lazy" decoding="async" src={s.image_url} alt={s.title} style={{ width:40, height:40, objectFit:'cover', borderRadius:6 }} />}
        <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
        <button type="button" className="button" disabled={disabled} onClick={onSend}>Send</button>
      </div>
    );
  });

  const createAdmin = async (e) => {
    e.preventDefault();
    setCreateError(''); setCreateSuccess('');
    if (!newAdmin.email) { setCreateError('Email is required'); return; }
    if (newAdmin.password && newAdmin.password !== newAdmin.confirm_password) { setCreateError('Passwords do not match'); return; }
    try {
      await api.post('/admin/admins', newAdmin);
      setNewAdmin({ email:'', name:'', password:'', confirm_password:'', role:'admin' });
      setCreateSuccess('Admin created');
      await loadAdmins();
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Failed to create admin');
    }
  };
  const setAdminActive = async (id) => { await api.put(`/admin/admins/${id}/status`, { status:'active' }); await loadAdmins(); };
  const setAdminSuspended = async (id) => { await api.put(`/admin/admins/${id}/status`, { status:'suspended' }); await loadAdmins(); };
  const demoteAdmin = async (id) => { await api.put(`/admin/admins/${id}/demote`); await loadAdmins(); };
  const removeAdmin = async (id) => { await api.delete(`/admin/admins/${id}`); await loadAdmins(); };
  const startEditAdmin = (a) => { setEditAdminId(a.id); setEditAdmin({ name:a.name||'', phone:a.phone||'', location:a.location||'', street_address:a.street_address||'', delivery_preference:a.delivery_preference||'', bio:a.bio||'', avatar_url:a.avatar_url||'' }); };
  const saveEditAdmin = async (id) => { await api.put(`/admin/admins/${id}/profile`, editAdmin); setEditAdminId(null); await loadAdmins(); };

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
      <h2>Super Admin</h2>
      <div className="tabs" style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button type="button" className={`button ${tab==='admins'?"":"ghost"}`} onClick={()=>setTab('admins')}>Admins</button>
        <button type="button" className={`button ${tab==='featured'?"":"ghost"}`} onClick={()=>setTab('featured')}>Featured</button>
        <button type="button" className={`button ${tab==='reviews'?"":"ghost"}`} onClick={()=>setTab('reviews')}>Reviews</button>
        <button type="button" className={`button ${tab==='admin2'?"":"ghost"}`} onClick={()=>setTab('admin2')}>Admin2</button>
      </div>

      {tab === 'admins' && (
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
            <div className="small muted" style={{ marginBottom:8 }}>
              Tip: Enter an existing user's email (customer or vendor) to promote them to admin. Password is optional for existing users, but required for new users.
            </div>
            {createError && <div className="error" role="alert">{createError}</div>}
            {createSuccess && <div className="success" role="status">{createSuccess}</div>}
            <form className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }} onSubmit={createAdmin}>
              <input className="input" placeholder="Email" value={newAdmin.email} onChange={e=>setNewAdmin(f=>({ ...f, email:e.target.value }))} />
              <input className="input" placeholder="Name (optional)" value={newAdmin.name} onChange={e=>setNewAdmin(f=>({ ...f, name:e.target.value }))} />
              <div className="row" style={{ gap:6 }}>
                <input className="input" placeholder="Password (required for new users)" type={showPwd?'text':'password'} value={newAdmin.password} onChange={e=>setNewAdmin(f=>({ ...f, password:e.target.value }))} />
                <button className="button ghost" type="button" onClick={()=>setShowPwd(s=>!s)} aria-label="Toggle password visibility">{showPwd?'Hide':'Show'}</button>
              </div>
              <div className="row" style={{ gap:6 }}>
                <input className="input" placeholder="Confirm Password" type={showPwd2?'text':'password'} value={newAdmin.confirm_password} onChange={e=>setNewAdmin(f=>({ ...f, confirm_password:e.target.value }))} />
                <button className="button ghost" type="button" onClick={()=>setShowPwd2(s=>!s)} aria-label="Toggle confirm password visibility">{showPwd2?'Hide':'Show'}</button>
              </div>
              <div className="row" style={{ gap:6, alignItems:'center' }}>
                <label className="small">Role</label>
                <select className="input" value={newAdmin.role} onChange={e=>setNewAdmin(f=>({ ...f, role:e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="admin2">Admin2</option>
                </select>
              </div>
              <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button className="button" type="submit" disabled={!newAdmin.email || (newAdmin.password && !newAdmin.confirm_password)}>Create</button>
                <button className="button ghost" type="button" onClick={()=>{ setNewAdmin({ email:'', name:'', password:'', confirm_password:'', role:'admin' }); setCreateError(''); setCreateSuccess(''); }}>Clear</button>
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
                    {a.role === 'admin' ? (
                      <>
                        <button className="button ghost" onClick={()=>demoteAdmin(a.id)}>Demote</button>
                        <button className="button ghost" onClick={()=>removeAdmin(a.id)}>Delete</button>
                        <button className="button" onClick={()=>startEditAdmin(a)}>Edit Profile</button>
                      </>
                    ) : (
                      <>
                        {a.was_admin && <button className="button" onClick={async ()=>{ try { await api.put(`/admin/users/${a.id}/role`, { role:'admin' }); await loadAdmins(); } catch {} }}>Promote</button>}
                      </>
                    )}
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

      {tab === 'featured' && (
        <section className="stack" style={{ gap:12 }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Homepage Featured (1–30)</h3>
            <div className="row" style={{ gap:8 }}>
              <button type="button" className="button" onClick={saveFeatured} disabled={featured.length === 0}>Save</button>
            </div>
          </div>
          {saveMsg && <div className="success" role="status">{saveMsg}</div>}
          {saveErr && <div className="error" role="alert">{saveErr}</div>}

          {/* Current Order - first row */}
          <div className="card" style={{ padding:12 }}>
            <h4 style={{ marginTop:0 }}>Current Order</h4>
            {featured.length === 0 && <div className="small muted">No featured products yet.</div>}
            <div className="stack" style={{ gap:8 }}>
              {featured.map((f, idx) => (
                <FeaturedRow
                  key={f.product_id}
                  f={f}
                  idx={idx}
                  onUp={moveUp}
                  onDown={moveDown}
                  onRemove={removeFeatured}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                />
              ))}
            </div>
          </div>

          {/* Suggestions - second row */}
          <div className="card" style={{ padding:12 }}>
            <h4 style={{ marginTop:0 }}>Suggestions</h4>
            <form className="row" style={{ gap:8, marginBottom:8 }} onSubmit={(e)=>{ e.preventDefault(); setSuggPage(1); }}>
              <input className="input" placeholder="Search products" value={suggQuery} onChange={e=>{ setSuggQuery(e.target.value); setSuggPage(1); }} />
            </form>
            <div className="stack" style={{ gap:8 }}>
              {suggestions.map(s => (
                <SuggestionRow
                  key={s.id}
                  s={s}
                  disabled={!!featured.find(x=>x.product_id===s.id) || featured.length>=30}
                  onSend={()=>addFeatured(s)}
                />
              ))}
            </div>
            <div style={{ marginTop:8 }}>
              <Pagination page={suggPage} total={suggTotal} limit={suggLimit} onPageChange={setSuggPage} />
            </div>
          </div>
        </section>
      )}

      {tab === 'reviews' && (
        <section className="stack" style={{ gap:12 }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Product Reviews</h3>
            <button type="button" className="button ghost" onClick={loadReviews} disabled={reviewsLoading}>Reload</button>
          </div>
          {reviewsError && <div className="card" style={{ padding:10, color:'crimson' }}>{reviewsError}</div>}
          {reviewsLoading && <div className="card" style={{ padding:10 }}>Loading...</div>}
          {!reviewsLoading && !reviewsError && (
            <div className="stack" style={{ gap:8 }}>
              {allReviews.length === 0 && <div className="small muted">No reviews found.</div>}
              {allReviews.map(rv => (
                <div key={rv.id} className="card" style={{ padding:12 }}>
                  <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div>
                      <div><strong>{rv.product_title}</strong> <span className="small muted">• by {rv.user_name || rv.user_email || 'User'}</span></div>
                      <div className="small" style={{ marginTop:4 }}>Rating: <strong>{rv.rating}</strong></div>
                      {rv.comment && <div style={{ marginTop:6 }}>{rv.comment}</div>}
                      <div className="small muted" style={{ marginTop:6 }}>{new Date(rv.created_at).toLocaleString()}</div>
                    </div>
                    <div className="row" style={{ gap:6 }}>
                      <button type="button" className="button ghost" onClick={()=>deleteReview(rv.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'admin2' && (
        <section className="stack" style={{ gap:12 }}>
          <Admin2Dashboard />
        </section>
      )}
    </div>
  );
}
