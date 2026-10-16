import React, { useRef, useState } from 'react';
import Card from '../common/Card.jsx';
import { clearCarelineCache } from '../../utils/clearCache.js';

export default function ClearCache({ disabled, onRefresh, onBusyChange }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const working = useRef(false);
  async function clear() {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); onBusyChange?.(true); setError(''); setMessage('');
    let count;
    try {
      count = await clearCarelineCache();
      await onRefresh();
      setMessage(count ? `Cleared ${count} temporary cache item(s). Workspace data refreshed.` : 'No stored temporary caches found. Workspace data refreshed.');
    } catch {
      setError(count === undefined ? 'Some temporary caches could not be cleared. Check browser storage permissions and retry.' : 'Temporary cache clearing finished, but workspace data could not refresh. Please retry.');
    } finally { working.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <Card title="Browser cache" subtitle="Refresh temporary data on this device">
    <div className="settings-card-body"><div className="setting-row"><div><strong>Clear temporary Careline cache</strong><p>Remove Careline temporary browser caches and reload workspace data. Your sign-in, preferences, drafts and saved clinic records are preserved. Other websites and the browser's general HTTP cache are unaffected.</p></div><button type="button" className="btn secondary" disabled={busy || disabled} onClick={clear}>{busy ? 'Clearing cache...' : 'Clear Cache'}</button></div>
      {disabled && <p className="muted">Save or cancel unsaved changes before clearing cache.</p>}
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </Card>;
}
