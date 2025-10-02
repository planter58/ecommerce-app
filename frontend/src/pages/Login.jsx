import { useContext, useState } from 'react';
import { login as apiLogin } from '../api/auth';
import { AuthContext } from '../context/AuthContext.jsx';
import { CartContext } from '../context/CartContext.jsx';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { login } = useContext(AuthContext);
  const { mergeGuestToServer } = useContext(CartContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { user, token } = await apiLogin({ email, password });
      login(user, token);
      await mergeGuestToServer();
      if (user.role === 'super_admin') navigate('/super-admin');
      else if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'admin2') navigate('/admin2');
      else if (user.role === 'vendor') navigate('/vendor');
      else navigate('/');
    } catch (e) {
      setError(e?.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="page-center">
      <form onSubmit={submit} className="form wide">
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div className="row">
          <label>Password</label>
          <div style={{ display:'flex', gap:8 }}>
            <input className="input" style={{ flex:1 }} type={showPwd? 'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} />
            <button type="button" className="button ghost" onClick={()=>setShowPwd(s=>!s)}>{showPwd? 'Hide':'Show'}</button>
          </div>
        </div>
        <div className="actions">
          <button className="button" type="submit">Login</button>
          <span className="help">No account? <Link className="link" to="/register">Register</Link></span>
        </div>
      </form>
    </div>
  );
}

