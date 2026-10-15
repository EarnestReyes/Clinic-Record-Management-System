export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
export const dateLabel = (value) => new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('');
export const age = (dob) => Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
export function exportCSV(name, rows) { const keys = Object.keys(rows[0] || {}); const csv = [keys, ...rows.map(r => keys.map(k => typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]))].map(r => r.map(v => { let value = String(v ?? ''); if (/^\s*[=+\-@]/.test(value)) value = "'" + value; return '"' + value.replaceAll('"', '""') + '"'; }).join(',')).join('\n'); download(name + '.csv', csv, 'text/csv'); }
export function download(name, text, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
