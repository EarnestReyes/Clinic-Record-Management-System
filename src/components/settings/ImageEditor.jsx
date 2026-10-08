import React, { useEffect, useState } from 'react';
import { Camera, Upload, Trash2 } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';

export default function ImageEditor({ name, src, label = 'Profile picture', onUpload, onRemove, ask, onDirty }) {
  const [file, setFile] = useState(null), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => { onDirty(!!file); return () => onDirty(false); }, [file, onDirty]);
  return <div className="settings-image-editor">
    <Avatar name={name} size="large" src={preview || src} />
    <div><strong>{label}</strong><p className="muted">PNG or JPEG · Up to 2 MB</p>
      <div className="row"><label className="btn secondary small"><Camera size={15} />{src ? 'Change image' : 'Upload image'}<input className="image-picker" aria-label={`Choose ${label.toLowerCase()}`} type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => {
        const chosen = event.target.files[0]; event.target.value = ''; if (!chosen) return;
        if (!['image/png','image/jpeg'].includes(chosen.type) || chosen.size > 2 * 1024 * 1024) { setError('Choose a PNG or JPEG under 2 MB.'); return; }
        setError(''); setFile(chosen);
      }} /></label>
      {file && <><button className="btn primary small" disabled={busy} onClick={async () => { setBusy(true); try { if (await onUpload(file) !== false) setFile(null); } finally { setBusy(false); } }}><Upload size={15} />{busy ? 'Uploading…' : 'Save image'}</button><button className="text-button" disabled={busy} onClick={() => setFile(null)}>Cancel</button></>}
      {src && !file && <button className="text-button danger-text" disabled={busy} onClick={async () => { if (!await ask(`Remove ${label.toLowerCase()}?`)) return; setBusy(true); try { await onRemove(); } finally { setBusy(false); } }}><Trash2 size={15} />Remove</button>}
      </div>{error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>;
}
