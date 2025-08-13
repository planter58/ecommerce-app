import { useContext, useState } from 'react';
import { register as apiRegister } from '../api/auth';
import { AuthContext } from '../context/AuthContext.jsx';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const { login } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('customer');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (password !== confirm) {
        setError('Passwords do not match');
        return;
      }
      const payload = { name, email, password, role };
      if (role === 'vendor') payload.business_name = businessName;
      const { user, token } = await apiRegister(payload);
      login(user, token);
      navigate('/');
    } catch (e) {
      setError(e?.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <form onSubmit={submit} className="form">
      <h2>Register</h2>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <label>Name</label>
        <input className="input" value={name} onChange={(e)=>setName(e.target.value)} />
      </div>
      <div className="row">
        <label>Email</label>
        <input className="input" value={email} onChange={(e)=>setEmail(e.target.value)} />
      </div>
      {role === 'vendor' && (
        <div className="row">
          <label>Business Name</label>
          <input className="input" value={businessName} onChange={(e)=>setBusinessName(e.target.value)} />
        </div>
      )}
      <div className="row">
        <label>Password</label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input className="input" type={showPassword? 'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button type="button" className="button ghost" onClick={()=>setShowPassword(s=>!s)}>{showPassword? 'Hide':'Show'}</button>
        </div>
      </div>
      <div className="row">
        <label>Confirm Password</label>
        <input className="input" type={showPassword? 'text':'password'} value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
      </div>
      <div className="row">
        <label>Register as</label>
        <select className="select" value={role} onChange={(e)=>setRole(e.target.value)}>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>
      <div className="actions">
        <button className="button" type="submit">Create account</button>
        <span className="help">Have an account? <Link className="link" to="/login">Login</Link></span>
      </div>
    </form>
  );
}

