import React, { useState } from "react";
import { ArrowRight, ShieldCheck, Stethoscope } from "lucide-react";
export default function LoginForm({
  users,
  onLogin
}) {
  const [email, setEmail] = useState('admin@careline.demo'),
    [password, setPassword] = useState('Careline123!'),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  return <><form onSubmit={e => {
      e.preventDefault();
      const u = users.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password && x.active);
      if (!u) return setError('Email or password is incorrect, or your account is inactive.');
      setLoading(true);
      setTimeout(() => onLogin(u), 350);
    }}>
      <label>Email address<input 
          type="email" 
          required 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="you@clinic.com" 
        /></label>
      <label>Password<input 
          type="password" 
          required 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        /></label>
      {error && <p className="form-error" role="alert">
        {error}
      </p>}
      <button className="btn primary login-submit" disabled={loading}>
        {loading ? 'Opening your workspace...' : 'Sign in to workspace'}
        <ArrowRight size={18} />
      </button>
    </form><div className="demo-accounts">
      <span>EXPLORE WITH A DEMO ACCOUNT</span>
      <div>
        {['Administrator', 'Clinic Staff'].map(role => <button key={role} className={email === (role === 'Administrator' ? 'admin@careline.demo' : 'staff@careline.demo') ? 'selected' : ''} onClick={() => {
          setEmail(role === 'Administrator' ? 'admin@careline.demo' : 'staff@careline.demo');
          setPassword('Careline123!');
          setError('');
        }}>
          {role === 'Administrator' ? <ShieldCheck size={17} /> : <Stethoscope size={17} />} 
          {' '}{role}
        </button>)}
      </div>
      <small>Password: Careline123!</small>
    </div></>;
}
