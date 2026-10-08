import React, { useState } from "react";
import { ArrowRight, ShieldCheck, Stethoscope } from "lucide-react";
import PasswordInput from '../common/PasswordInput.jsx';
export default function LoginForm({
  connectionError,
  onLogin
}) {
  const [email, setEmail] = useState('admin@clinic.local'),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  return <><form onSubmit={async e => {
      e.preventDefault(); setError(''); setLoading(true);
      try { await onLogin({ email: email.trim(), password }); }
      catch (error) { setError(error.message); }
      finally { setLoading(false); }
    }}>
      <label>Email address<input 
          type="email" 
          name="email"
          autoComplete="username"
          required 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="you@clinic.com" 
        /></label>
      <label>Password<PasswordInput
          name="password"
          autoComplete="current-password"
          required 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        /></label>
      {(error || connectionError) && <p className="form-error" role="alert">
        {error || connectionError}
      </p>}
      <button className="btn primary login-submit" disabled={loading}>
        {loading ? 'Opening your workspace...' : 'Sign in to workspace'}
        <ArrowRight size={18} />
      </button>
    </form><div className="demo-accounts">
      <span>SIGN IN WITH YOUR CLINIC ACCOUNT</span>
      <div>
        {['Administrator', 'Clinic Staff'].map(role => <button key={role} className={email === (role === 'Administrator' ? 'admin@clinic.local' : 'staff@careline.demo') ? 'selected' : ''} onClick={() => {
          setEmail(role === 'Administrator' ? 'admin@clinic.local' : 'staff@careline.demo');
          setPassword('');
          setError('');
        }}>
          {role === 'Administrator' ? <ShieldCheck size={17} /> : <Stethoscope size={17} />} 
          {' '}{role}
        </button>)}
      </div>
      <small>Use the password assigned by your administrator.</small>
    </div></>;
}
