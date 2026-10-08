import { request, auth, savePreferences, documents } from './api.js';
const paths = { patients: 'patients', consultations: 'consultations', appointments: 'appointments', documents: 'documents', users: 'users' };
export async function persistChange(key, next, current, action) {
  if (key === 'settings') {
    if (action === 'Notification preference saved') return savePreferences({ reminders: next.reminders, activityAlerts: next.activityAlerts });
    return request('/settings', { method: 'PATCH', body: next });
  }
  const path = paths[key]; if (!path || !Array.isArray(next)) throw new Error('Unsupported record change.');
  const added = next.filter(item => !current.some(old => old.id === item.id));
  const modified = next.filter(item => { const old = current.find(old => old.id === item.id); return old && JSON.stringify(old) !== JSON.stringify(item); });
  if (!added.length && !modified.length && next.length === current.length) throw new Error('No changes to save.');
  if (added.length + modified.length !== 1 || next.length < current.length) throw new Error('Save one record at a time. Records cannot be permanently deleted.');
  const item = added[0] || modified[0];
  if (key === 'documents' && added.length && item.file) return documents.upload(item.patientId, item.file, item.type);
  if (key === 'users' && action === 'Account updated') return auth.updateProfile(item);
  if (!added.length && ['patients','documents'].includes(key)) {
    const old = current.find(old => old.id === item.id);
    if (old.status !== item.status) return request(`/${path}/${encodeURIComponent(item.id)}/${item.status === 'Archived' ? 'archive' : 'restore'}`, { method: 'POST', body: {} });
  }
  return request(`/${path}${added.length ? '' : '/' + encodeURIComponent(item.id)}`, { method: added.length ? 'POST' : 'PATCH', body: item });
}
