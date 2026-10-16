export const displayDate = value => {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value + 'T12:00:00+08:00' : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};
const dateTime = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) + ' · Asia/Manila' : '—';
const timeLabel = value => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return '—';
  return `${Number(match[1]) % 12 || 12}:${match[2]} ${Number(match[1]) < 12 ? 'AM' : 'PM'}`;
};

// Mirrors the report table's display values, while comparing unformatted dates.
export function sortReportRecords(records, key, direction, patient = () => null) {
  const value = row => key === 'date' ? Date.parse(row.created || row.date) : key === 'person' ? row.name || row.actor || patient(row.patientId)?.name
    : key === 'details' ? row.diagnosis || row.type || row.action || row.status : row.id;
  return records.map((row, index) => ({ row, index })).sort((a, b) => {
    const av = value(a.row), bv = value(b.row);
    const missing = v => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));
    const result = missing(av) ? (missing(bv) ? 0 : 1) : missing(bv) ? -1
      : (typeof av === 'number' ? av - bv : String(av).toLowerCase().localeCompare(String(bv).toLowerCase(), undefined, { numeric: true })) * (direction === 'asc' ? 1 : -1);
    return result || a.index - b.index;
  }).map(item => item.row);
}
const definitions = {
  patients: [['id','Patient ID'],['name','Patient name',2],['gender','Gender'],['phone','Contact'],['created','Registered'],['status','Status']],
  consultations: [['id','Record ID'],['patient','Patient',2],['date','Visit date'],['recordType','Record type',2],['diagnosis','Assessment / Diagnosis',3],['staff','Attending staff',2]],
  appointments: [['id','Appointment ID'],['patient','Patient',2],['date','Date'],['time','Time'],['type','Appointment type',2],['staff','Attending staff',2],['status','Status']],
  activity: [['date','Date & time',2],['action','Action',2],['detail','Details',3],['actor','Performed by',2]]
};
export function exportTable(type, records, patient = () => null) {
  if (!definitions[type]) throw new Error('Unsupported export type.');
  const columns = definitions[type].map(([key,label,width]) => ({ key,label,width }));
  const rows = records.map(source => {
    const record = source.toJSON ? source.toJSON() : source;
    const values = { ...record, patient: patient(record.patientId)?.name || record.patient?.name || record.patientId || '—',
      recordType: record.recordType || record.type || 'General consultation',
      detail: record.detail || [record.recordType, record.recordId].filter(Boolean).join(' · ') || '—',
      time: timeLabel(record.time), created: displayDate(record.created), date: type === 'activity' ? dateTime(record.date) : displayDate(record.date) };
    return Object.fromEntries(columns.map(({ key }) => [key, values[key] ?? '—']));
  });
  return { columns, rows };
}
