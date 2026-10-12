import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import PasswordInput from './PasswordInput.jsx';
export default function Form({
  fields,
  values = {},
  onSave,
  submit = 'Save changes',
  onCancel
}) {
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  return <form onSubmit={async e => {
    e.preventDefault();
    if (saving) return;
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setSaving(true); setError('');
    try { await onSave(values); } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }}>
    <div className="form-grid">
      {fields.map(f => <label key={f.name} className={f.wide ? 'span-2' : ''}>
        {f.label}
        {f.required && <span className="required"> *</span>}
        {f.options ? <select name={f.name} defaultValue={values[f.name] ?? f.options[0]?.value ?? f.options[0]} required={f.required}>
          {f.options.map(o => <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>)}
        </select> : f.type === 'textarea' ? <textarea 
          name={f.name} 
          defaultValue={values[f.name] || ''} 
          rows={3} 
          required={f.required} 
        /> : f.type === 'password' ? <PasswordInput
          name={f.name}
          defaultValue={values[f.name] ?? ''}
          required={f.required}
          placeholder={f.placeholder}
        /> : <input 
          name={f.name} 
          type={f.type || 'text'} 
          defaultValue={values[f.name] ?? ''} 
          required={f.required} 
          min={f.min} 
          max={f.max} 
          step={f.step} 
          placeholder={f.placeholder} 
        />}
      </label>)}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <footer className="modal-footer">
      <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      <button className="btn primary" type="submit" disabled={saving}>
        {saving ? 'Saving...' : submit}
        <ChevronRight size={16} />
      </button>
    </footer>
  </form>;
}
