import { useEffect, useState, useContext } from 'react';
import api from '../api/client';
import { AuthContext } from '../context/AuthContext.jsx';

export default function SuperAdminDashboard() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('admins');
  const [adminQuery, setAdminQuery] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ email:'', name:'', password:'', confirm_password:'' });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [editAdminId, setEditAdminId] = useState(null);
  const [editAdmin, setEditAdmin] = useState({ name:'', phone:'', location:'', street_address:'', delivery_preference:'', bio:'', avatar_url:'' });
  const [selectedAdmins, setSelectedAdmins] = useState([]);

  const loadAdmins = async () => {
    const { data } = await api.get('/admin/admins', { params: { q: adminQuery || undefined, status: adminStatus || undefined } });
    setAdmins(data);
  };
  useEffect(() => { loadAdmins(); }, [adminQuery, adminStatus]);

  const createAdmin = async (e) => {
    e.preventDefault();
    setCreateError(''); setCreateSuccess('');
    if (!newAdmin.email) { setCreateError('Email is required'); return; }
    if (newAdmin.password && newAdmin.password !== newAdmin.confirm_password) { setCreateError('Passwords do not match'); return; }
    try {
      await api.post('/admin/admins', newAdmin);
      setNewAdmin({ email:'', name:'', password:'', confirm_password:'' });
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
        <button className={`button ${tab==='admins'?"":"ghost"}`} onClick={()=>setTab('admins')}>Admins</button>
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
              <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button className="button" type="submit" disabled={!newAdmin.email || (newAdmin.password && !newAdmin.confirm_password)}>Create</button>
                <button className="button ghost" type="button" onClick={()=>{ setNewAdmin({ email:'', name:'', password:'', confirm_password:'' }); setCreateError(''); setCreateSuccess(''); }}>Clear</button>
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
    </div>
  );
}
