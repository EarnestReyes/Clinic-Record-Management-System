import React, { useRef, useState } from 'react';
import Card from '../common/Card.jsx';
import Modal from '../common/Modal.jsx';
import './SettingsDetails.css';

export default function ClearCache({ disabled, onRefresh, onBusyChange }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const working = useRef(false);
  const [confirmation, setConfirmation] = useState(false);
  async function clear() {
    if (working.current || disabled) { setConfirmation(false); return; }
    setConfirmation(false);
    working.current = true; setBusy(true); onBusyChange?.(true); setError(''); setMessage('');
    try {
      // No verified cache producers exist. Re-fetch instead of deleting storage.
      await onRefresh();
      setMessage('Workspace data refreshed. No browser storage or clinic records were deleted.');
    } catch {
      setError('Workspace data could not be refreshed. Check your connection and try again.');
    } finally { working.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <><Card className="workspace-refresh-card" title="Refresh Workspace Data" subtitle="Reload current information without removing browser storage">
    <div className="settings-card-body"><div className="setting-row"><div><strong>A fresh view of your workspace</strong><p>Re-fetch current Careline information to help resolve loading or display issues. Your session, saved preferences, policy acknowledgments, drafts, offline data and clinic records are preserved.</p></div><button type="button" className="btn secondary" disabled={busy || disabled} onClick={() => setConfirmation(true)}>{busy ? 'Refreshing…' : 'Refresh Workspace Data'}</button></div>
      {disabled && !busy && <p className="muted">Finish pending operations and save or cancel unsaved changes before refreshing workspace data.</p>}
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </Card>{confirmation && <Modal title="Refresh workspace data?" onClose={() => setConfirmation(false)}><div className="modal-body"><p>Re-fetch the latest workspace information? No browser storage, session cookies, preferences, acknowledgments, drafts, offline data or saved clinic records will be deleted. This does not clear the browser’s HTTP cache.</p>{disabled && <p role="alert">Save or cancel unsaved changes first. Refresh is currently blocked.</p>}<footer className="modal-footer"><button type="button" className="btn secondary" onClick={() => setConfirmation(false)}>Cancel</button><button type="button" className="btn primary" disabled={disabled || busy} onClick={clear}>Refresh now</button></footer></div></Modal>}</>;
}
