import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import PasswordInput from '../common/PasswordInput.jsx';
import { auth } from '../../services/api.js';
import { getResetToken, forgetResetToken } from '../../utils/passwordRecovery.js';
import './LoginRecovery.css';

export default function LoginForm({ connectionError, onLogin, onRecoveryExit, onModeChange }) {
  const [token, setToken] = useState(getResetToken);
  const [mode, setMode] = useState(() => getResetToken() ? 'reset' : 'login');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [loading, setLoading] = useState(false);
  const working = useRef(false);
  const feedback = error || (mode === 'login' && connectionError);
  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);
  function changeMode(next) { setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmPassword(''); if (mode === 'reset') { setToken(''); forgetResetToken(); onRecoveryExit?.(); } }
  async function submit(event) {
    event.preventDefault(); if (working.current) return;
    setError(''); setMessage('');
    if (mode === 'reset' && (password.length < 12 || new TextEncoder().encode(password).length > 72)) { setError('Use at least 12 characters and at most 72 UTF-8 bytes.'); return; }
    if (mode === 'reset' && password !== confirmPassword) { setError('New passwords must match.'); return; }
    working.current = true; setLoading(true);
    try {
      if (mode === 'login') await onLogin({ email: email.trim(), password });
      else if (mode === 'forgot') { const result = await auth.forgotPassword(email.trim()); setMessage(result.message); }
      else { const result = await auth.resetPassword({ token, password, confirmPassword }); setToken(''); forgetResetToken(); setPassword(''); setConfirmPassword(''); setMode('login'); setMessage(result.message); onRecoveryExit?.(); }
    } catch (failure) { setError(failure.message); }
    finally { working.current = false; setLoading(false); }
  }
  return <form className="login-auth-form" onSubmit={submit} aria-busy={loading}>
    {mode !== 'login' && <p>{mode === 'forgot' ? 'Enter your registered email to request a reset link.' : 'Set a new password. Reset links expire after 15 minutes.'}</p>}
    {mode !== 'reset' && <label>Email address<input type="email" name="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={feedback ? 'login-error' : undefined} required maxLength={254} disabled={loading} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@clinic.com" /></label>}
    {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<PasswordInput name="password" autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} aria-describedby={feedback ? 'login-error' : undefined} required disabled={loading} value={password} onChange={event => setPassword(event.target.value)} /></label>}
    {mode === 'reset' && <label>Confirm new password<PasswordInput name="confirmPassword" autoComplete="new-password" required disabled={loading} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>}
    {mode === 'login' && <button type="button" className="text-button" disabled={loading} onClick={() => changeMode('forgot')}>Forgot password?</button>}
    {feedback && <p id="login-error" className="form-error" role="alert">{feedback}</p>}
    {message && <p role="status" className="recovery-message">{message}</p>}
    <button className="btn primary login-submit" disabled={loading}>{loading ? (mode === 'login' ? 'Signing in…' : 'Please wait...') : mode === 'forgot' ? 'Request reset link' : mode === 'reset' ? 'Reset password' : 'Sign in to workspace'}<ArrowRight size={18} aria-hidden="true" /></button>
    {mode !== 'login' && <button type="button" className="text-button" disabled={loading} onClick={() => changeMode('login')}>Back to Sign In</button>}
    {mode === 'reset' && <button type="button" className="text-button" disabled={loading} onClick={() => changeMode('forgot')}>Request a new reset link</button>}
  </form>;
}
