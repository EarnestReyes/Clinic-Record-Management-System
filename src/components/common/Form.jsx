import React from "react";
import { ChevronRight } from "lucide-react";
export default function Form({
  fields,
  values = {},
  onSave,
  submit = 'Save changes',
  onCancel
}) {
  return <form onSubmit={e => {
    e.preventDefault();
    onSave(Object.fromEntries(new FormData(e.currentTarget)));
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
    <footer className="modal-footer">
      <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      <button className="btn primary" type="submit">
        {submit}
        <ChevronRight size={16} />
      </button>
    </footer>
  </form>;
}
