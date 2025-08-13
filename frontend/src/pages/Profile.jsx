import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({ name:'', phone:'', location:'', street_address:'', delivery_preference:'', bio:'', avatar_url:'' });
  const [pw, setPw] = useState({ current_password:'', new_password:'', show:false });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/profile');
        setProfile({
          name: data.name || '',
          phone: data.phone || '',
          location: data.location || '',
          street_address: data.street_address || '',
          delivery_preference: data.delivery_preference || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || ''
        });
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.put('/profile', profile);
      setProfile({
        name: data.name || '',
        phone: data.phone || '',
        location: data.location || '',
        street_address: data.street_address || '',
        delivery_preference: data.delivery_preference || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || ''
      });
      alert('Profile updated');
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to update');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/profile/change-password', { current_password: pw.current_password || undefined, new_password: pw.new_password });
      alert('Password changed');
      setPw({ current_password:'', new_password:'', show:false });
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to change password');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>My Profile</h2>
      {error && <div className="error">{error}</div>}

      <section className="card" style={{ padding:16 }}>
        <h3 style={{ marginTop:0 }}>Profile Details</h3>
        <form className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }} onSubmit={save}>
          <input className="input" placeholder="Full Name" value={profile.name} onChange={e=>setProfile(p=>({ ...p, name:e.target.value }))} />
          <input className="input" placeholder="Phone" value={profile.phone} onChange={e=>setProfile(p=>({ ...p, phone:e.target.value }))} />
          <input className="input" placeholder="Location (City/Town)" value={profile.location} onChange={e=>setProfile(p=>({ ...p, location:e.target.value }))} />
          <input className="input" placeholder="Street Address" value={profile.street_address} onChange={e=>setProfile(p=>({ ...p, street_address:e.target.value }))} />
          <input className="input" placeholder="Favorable delivery location" value={profile.delivery_preference} onChange={e=>setProfile(p=>({ ...p, delivery_preference:e.target.value }))} />
          <input className="input" placeholder="Avatar URL" value={profile.avatar_url} onChange={e=>setProfile(p=>({ ...p, avatar_url:e.target.value }))} />
          <textarea className="input" placeholder="Bio (optional)" value={profile.bio} onChange={e=>setProfile(p=>({ ...p, bio:e.target.value }))} style={{ gridColumn:'1 / -1' }} />
          <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end' }}>
            <button className="button" type="submit">Save</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding:16, marginTop:12 }}>
        <h3 style={{ marginTop:0 }}>Change Password</h3>
        <form className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }} onSubmit={changePassword}>
          <input className="input" type={pw.show?'text':'password'} placeholder="Current Password (optional)" value={pw.current_password} onChange={e=>setPw(p=>({ ...p, current_password:e.target.value }))} />
          <input className="input" type={pw.show?'text':'password'} placeholder="New Password" value={pw.new_password} onChange={e=>setPw(p=>({ ...p, new_password:e.target.value }))} />
          <label className="row" style={{ gap:6 }}>
            <input type="checkbox" checked={pw.show} onChange={e=>setPw(p=>({ ...p, show:e.target.checked }))} />
            <span>Show passwords</span>
          </label>
          <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end' }}>
            <button className="button" type="submit">Update Password</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding:16, marginTop:12 }}>
        <h3 style={{ marginTop:0 }}>Extras</h3>
        <div className="small muted">Add any additional info you want us to know (e.g., preferred contact time, delivery notes, etc.).</div>
      </section>
    </div>
  );
}
