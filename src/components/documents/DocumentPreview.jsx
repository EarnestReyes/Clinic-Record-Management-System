import React, { useEffect, useState } from 'react';
import Badge from '../common/Badge.jsx';
import { documents } from '../../services/api.js';
import { ArrowDownToLine } from 'lucide-react';
export default function DocumentPreview({ modal, notify }) {
  const [preview, setPreview] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true, url;
    setPreview(null); setError('');
    documents.preview(modal.item.id).then(async blob => {
      if (!active) return;
      if (blob.type.startsWith('text/')) { const text = await blob.text(); if (active) setPreview({ text }); }
      else { url = URL.createObjectURL(blob); setPreview({ url, image: blob.type.startsWith('image/') }); }
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [modal.item.id]);
  return <div className="modal-body">
    <div className="row-between"><h3>{modal.item.name}</h3><Badge>{modal.item.status}</Badge></div>
    {error ? <p className="form-error" role="alert">{error}</p> : !preview ? <p className="muted" role="status">Loading private document...</p> : preview.text !== undefined ? <pre className="document-preview">{preview.text}</pre> : preview.image ? <img className="document-preview" style={{ maxWidth: '100%', height: 'auto' }} src={preview.url} alt={modal.item.name} /> : <iframe className="document-preview" style={{ width: '100%', height: 460 }} sandbox="allow-same-origin" title={modal.item.name} src={preview.url} />}
    <button className="btn primary" onClick={async () => { try { await documents.download(modal.item); notify('Document downloaded'); } catch (error) { notify(error.message); } }}><ArrowDownToLine size={16} />Download document</button>
  </div>;
}
