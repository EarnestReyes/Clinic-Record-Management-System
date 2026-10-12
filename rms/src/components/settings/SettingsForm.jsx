import React, { useEffect, useState } from 'react';
import PasswordInput from '../common/PasswordInput.jsx';

export default function SettingsForm({ fields, values = {}, onSave, onDirty, submit = 'Save changes', children, validate }) {
  const signature = JSON.stringify(values);
  const [draft, setDraft] = useState(values), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setDraft(JSON.parse(signature)); setError(''); }, [signature]);
  const dirty = JSON.stringify(draft) !== signature;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const invalid = validate?.(draft);
  function reset() { setDraft(JSON.parse(signature)); setError(''); }
  return <form className="settings-form" onSubmit={async event => {
    event.preventDefault(); if (busy || invalid) return;
    setBusy(true); setError('');
    try { if (await onSave(draft) !== false) reset(); } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }}>
    <div className="form-grid">{fields.map(field => <label key={field.name} className={field.wide ? 'span-2' : ''}>
      {field.label}{field.required && <span className="required"> *</span>}
      {React.createElement(field.type === 'password' ? PasswordInput : field.options ? 'select' : field.type === 'textarea' ? 'textarea' : 'input', {
        name: field.name, type: field.type === 'password' ? undefined : field.type || 'text', value: draft[field.name] ?? '', required: field.required,
        maxLength: field.maxLength || 1000, autoComplete: field.autoComplete, disabled: busy, readOnly: field.readOnly,
        onChange: event => setDraft(previous => ({ ...previous, [field.name]: event.target.value }))
      }, field.options ? field.options.map(option => <option key={option}>{option}</option>) : undefined)}
      {field.help && <small className="field-help">{field.help}</small>}
    </label>)}</div>
    {children?.(draft)}
    {(error || invalid) && <p className="form-error" role="alert">{error || invalid}</p>}
    <footer className="modal-footer"><span className="muted">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span><button type="button" className="btn secondary" onClick={reset} disabled={busy}>Cancel</button><button className="btn primary" disabled={busy || !dirty || !!invalid}>{busy ? 'Saving…' : submit}</button></footer>
  </form>;
}
