const BASE = '/api';
let csrfToken = '';
export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
export async function request(path, { method = 'GET', body, signal, binary = false } = {}) {
  const headers = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (!['GET','HEAD'].includes(method)) headers['X-CSRF-Token'] = csrfToken;
  let response;
  try { response = await fetch(BASE + path, { method, headers, credentials: 'include', signal, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) }); }
  catch (error) { if (error.name === 'AbortError') throw error; throw new ApiError('Cannot reach the clinic API. Check that the backend and MongoDB are running.', 0); }
  if (!response.ok) {
    const jsonResponse = response.headers.get('content-type')?.includes('application/json');
    const data = jsonResponse ? await response.json().catch(() => ({})) : {};
    if (response.status === 401 && !['/auth/me','/auth/login'].includes(path)) window.dispatchEvent(new Event('careline:session-expired'));
    const connectionError = !jsonResponse && [500,502,503,504].includes(response.status)
      ? 'Cannot reach the clinic API. Start the backend on port 5000 and verify its MongoDB connection.'
      : `Request failed (${response.status}).`;
    throw new ApiError(data.error || connectionError, response.status);
  }
  if (binary) return response.blob();
  const data = await response.json();
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
export const auth = {
  login: credentials => request('/auth/login', { method: 'POST', body: credentials }),
  me: () => request('/auth/me'),
  logout: async () => { await request('/auth/logout', { method: 'POST', body: {} }); csrfToken = ''; },
  updateProfile: values => request('/auth/profile', { method: 'PATCH', body: values })
};
export const workspace = () => request('/workspace');
export const savePreferences = values => request('/preferences', { method: 'PATCH', body: values });
export const markNotifications = id => request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} });
export const reportTypeId = type => ({ Patients: 'patients', Consultations: 'consultations', Appointments: 'appointments', 'Clinic Activity': 'activity' })[type];
export const getReport = (type, from, to, signal) => request(`/reports/${reportTypeId(type)}?${new URLSearchParams({ from, to })}`, { signal });
export async function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export const exportReport = async (type, from, to) => saveBlob(await request(`/reports/${reportTypeId(type)}?${new URLSearchParams({ from, to, format: 'csv' })}`, { binary: true }), `${reportTypeId(type)}-report.csv`);
export const documents = {
  upload: (patientId, file, type = 'Uploaded document') => { const body = new FormData(); body.append('patientId', patientId); body.append('type', type); body.append('file', file); return request('/documents', { method: 'POST', body }); },
  preview: id => request(`/documents/${encodeURIComponent(id)}/preview`, { binary: true }),
  download: async document => saveBlob(await request(`/documents/${encodeURIComponent(document.id)}/download`, { binary: true }), document.name)
};

export const profileApi = {
  system: () => request('/settings/system'),
  activity: () => request('/auth/activity'),
  revokeOthers: () => request('/auth/revoke-others', { method: 'POST', body: {} }),
  uploadImage: (file, clinic = false) => { const body = new FormData(); body.append('file', file); return request(clinic ? '/settings/logo' : '/auth/avatar', { method: 'POST', body }); },
  removeImage: (clinic = false) => request(clinic ? '/settings/logo/remove' : '/auth/avatar/remove', { method: 'POST', body: {} }),
  clinic: values => request('/settings', { method: 'PATCH', body: values })
};
