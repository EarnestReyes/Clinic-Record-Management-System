export function calendarDays(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end - start > 365 * 86400000) return [];
  return Array.from({ length: Math.round((end - start) / 86400000) + 1 }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10));
}
export function visitSeries(visits = [], from, to) {
  const days = calendarDays(from, to);
  const types = [...new Set(visits.map(item => item._id?.type || 'Unspecified'))].sort();
  return { days, series: types.map(type => ({ type, values: days.map(day => visits.filter(item => item._id?.date === day && (item._id?.type || 'Unspecified') === type).reduce((sum, item) => sum + Number(item.count || 0), 0)) })) };
}
