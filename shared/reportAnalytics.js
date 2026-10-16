export const reportTitles = { patients: 'Patient Analytics Report', appointments: 'Appointment Analytics Report', consultations: 'Consultation Analytics Report', activity: 'Clinic Activity Analytics Report' };

export function clinicDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return Number.isFinite(Date.parse(value)) ? String(value) : null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const reportDimensions = { patients: [['gender', 'Gender distribution'], ['status', 'Patient status']], appointments: [['status', 'Appointment status'], ['specialty', 'Specialty distribution']], consultations: [['specialty', 'Specialty distribution'], ['type', 'Consultation type']], activity: [['action', 'Event-type distribution']] };
export const unknownCategory = 'Unknown / Not recorded';

function distribution(rows, key, grouped) {
  const counts = new Map();
  for (const row of grouped || rows) {
    if (grouped) { counts.set(row._id, row.value); continue; }
    const label = String(row[key] || 'Unknown / Not recorded').trim() || 'Unknown / Not recorded';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const points = [...counts].map(([label, value]) => ({ label, value, filter: { field: key, value: label } })).sort((a,b) => b.value - a.value || a.label.localeCompare(b.label));
  if (points.length <= 10) return points;
  return [...points.slice(0, 9), { label: 'Other categories (combined)', value: points.slice(9).reduce((sum, point) => sum + point.value, 0), filter: { field: key, exclude: points.slice(0, 9).map(point => point.label) } }];
}

export function reportAnalytics(type, rows, { from, to, groups } = {}) {
  if (!reportTitles[type]) throw new Error('Unsupported analytics report type.');
  const dates = groups ? groups.dates.map(row => row._id) : rows.map(row => clinicDate(type === 'patients' ? row.created : row.date));
  const known = dates.filter(Boolean).sort();
  const start = from || known[0], end = to || known.at(-1);
  const span = start && end ? (Date.parse(end) - Date.parse(start)) / 86400000 : 0;
  const length = span <= 31 ? 10 : span <= 730 ? 7 : 4;
  const buckets = new Map();
  for (const row of groups ? groups.dates : known.map(date => ({ _id: date, value: 1 }))) { if (!row._id) continue; const key = row._id.slice(0, length); buckets.set(key, (buckets.get(key) || 0) + row.value); }
  // Add honest zero buckets for ordinary reporting periods, without iterating enormous ranges.
  if (start && end && span >= 0 && span <= 7300) {
    const cursor = new Date(start + 'T00:00:00Z');
    if (length === 7) cursor.setUTCDate(1);
    if (length === 4) cursor.setUTCMonth(0, 1);
    while (cursor.getTime() <= Date.parse(end + 'T00:00:00Z')) {
      const key = cursor.toISOString().slice(0,length);
      if (!buckets.has(key)) buckets.set(key, 0);
      if (length === 10) cursor.setUTCDate(cursor.getUTCDate() + 1);
      else if (length === 7) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
  }
  const ordered = [...buckets].sort(([a],[b]) => a.localeCompare(b));
  const size = Math.max(1, Math.ceil(ordered.length / 24)), points = [];
  for (let index = 0; index < ordered.length; index += size) {
    const chunk = ordered.slice(index, index + size);
    const first = chunk[0][0], last = chunk.at(-1)[0];
    const periodEnd = last.length === 10 ? last : last.length === 7 ? new Date(Date.UTC(Number(last.slice(0,4)), Number(last.slice(5,7)), 0)).toISOString().slice(0,10) : last + '-12-31';
    const periodStart = first.length === 10 ? first : first + (first.length === 4 ? '-01-01' : '-01');
    points.push({ label: chunk.length === 1 ? first : `${first} to ${last}`, value: chunk.reduce((sum, [,value]) => sum + value, 0), filter: { from: [start, periodStart].sort().at(-1), to: [end, periodEnd].sort()[0] } });
  }
  const charts = known.length ? [{ title: `${type === 'patients' ? 'Patient registrations' : type === 'activity' ? 'Tracked actions' : type === 'appointments' ? 'Appointments' : 'Consultations'} over time`, points, trend: true,
    note: `${length === 10 ? 'Daily' : length === 7 ? 'Monthly' : 'Yearly'} counts · Asia/Manila${size > 1 ? ' · Consecutive periods combined' : ''}${dates.length !== known.length ? ` · ${dates.length - known.length} record(s) have no reliable date and are excluded from this chart` : ''}` }] : [];
  const dimensions = reportDimensions[type];
  for (const [key, title] of dimensions) charts.push({ title, points: distribution(rows, key, groups?.[key]), note: 'Counts from included records; missing categories are shown explicitly.' });
  const total = groups ? groups.total[0]?.value || 0 : rows.length;
  const statusCount = status => groups ? groups.status?.find(row => row._id === status)?.value || 0 : rows.filter(row => row.status === status).length;
  const summary = [{ label: type === 'patients' ? 'Patient registrations' : type === 'activity' ? 'Tracked actions' : type === 'appointments' ? 'Appointments' : 'Consultations', value: total },
    ...(type === 'patients' ? [{ label: 'Active profiles', value: statusCount('Active'), filter: { field: 'status', value: 'Active' } }, { label: 'Archived profiles', value: statusCount('Archived'), filter: { field: 'status', value: 'Archived' } }]
      : type === 'appointments' ? ['Scheduled', 'Completed', 'Cancelled', 'No Show'].map(status => ({ label: status, value: statusCount(status), filter: { field: 'status', value: status } }))
        : [{ label: 'Recorded categories', value: groups ? groups[type === 'activity' ? 'action' : 'specialty'].filter(row => row._id !== unknownCategory).length : new Set(rows.map(row => row[type === 'activity' ? 'action' : 'specialty']).filter(Boolean)).size }]),
    { label: 'Days with recorded activity', value: new Set(known).size }];
  summary[0].filter = {};
  return { title: reportTitles[type], total, summary, charts: total ? charts : [], empty: !total,
    notes: dates.length !== known.length ? [`${dates.length - known.length} included record(s) have no reliable date. Trends exclude these records; distributions include them.`] : [] };
}
