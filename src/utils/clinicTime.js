export function clinicTimeLabel(time) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return '—';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
export const clinicTimeRange = (start, end) => `${clinicTimeLabel(start)} – ${clinicTimeLabel(end)}`;
