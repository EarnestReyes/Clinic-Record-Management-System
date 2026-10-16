import React, { useEffect, useState } from 'react';
import { Camera, Upload, Trash2 } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import { prepareProfileImage } from '../../utils/profileImage.js';

export default function ImageEditor({ name, src, label = 'Profile picture', onUpload, onRemove, ask, onDirty }) {
  const [file, setFile] = useState(null), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => { onDirty(!!file); return () => onDirty(false); }, [file, onDirty]);
  return <div className="settings-image-editor">
    <Avatar name={name} size="large" src={preview || src} />
    <div><strong>{label}</strong><p className="muted">Choose from gallery or files · Up to 20 MB · Automatically resized for upload</p>
      <div className="row"><label className="btn secondary small"><Camera size={15} />{src ? 'Change image' : 'Upload image'}<input className="image-picker" aria-label={`Choose ${label.toLowerCase()}`} type="file" accept="image/*,.heic,.heif" disabled={busy} onChange={async event => {
        const chosen = event.target.files[0]; event.target.value = ''; if (!chosen) return;
        setError(''); setBusy(true);
        try { setFile(await prepareProfileImage(chosen)); }
        catch (error) { setError(error.message); }
        finally { setBusy(false); }
      }} /></label>
      {file && <><button className="btn primary small" disabled={busy} onClick={async () => { setError(''); setBusy(true); try { if (await onUpload(file) !== false) setFile(null); else setError('The image could not be saved. Please retry.'); } catch (error) { setError(error.message || 'The image could not be saved. Please retry.'); } finally { setBusy(false); } }}><Upload size={15} />{busy ? 'Please wait…' : 'Save image'}</button><button className="text-button" disabled={busy} onClick={() => setFile(null)}>Cancel</button></>}
      {src && !file && <button className="text-button danger-text" disabled={busy} onClick={async () => { if (!await ask(`Remove ${label.toLowerCase()}?`)) return; setBusy(true); try { await onRemove(); } finally { setBusy(false); } }}><Trash2 size={15} />Remove</button>}
      </div>{busy && <p className="muted" role="status">Preparing or uploading your image...</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>;
}
