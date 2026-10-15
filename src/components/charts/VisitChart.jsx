import React from 'react';
import { visitSeries } from '../../utils/dashboard.js';
const colors = ['var(--teal)', '#a99ae8', '#68b6e7', '#e5af73', '#d995b6', '#7db9a0'];
export default function VisitChart({ visits = [], from, to }) {
  const { days, series } = visitSeries(visits, from, to);
  const total = series.reduce((sum, item) => sum + item.values.reduce((a, b) => a + b, 0), 0);
  if (!days.length || !total) return <p className="dashboard-empty">No consultations recorded in this date range.</p>;
  const max = Math.max(2, Math.ceil(Math.max(...series.flatMap(item => item.values)) / 2) * 2);
  const point = (value, index) => [20 + index * (660 / Math.max(1, days.length - 1)), 180 - value / max * 155];
  return <div className="dashboard-visit-chart">
    <div className="dashboard-chart-legend">{series.map((item, index) => <span key={item.type}><i style={{ background: colors[index % colors.length] }} />{item.type}</span>)}</div>
    <svg viewBox="0 0 700 210" role="img" aria-label={`Consultation counts from ${from} to ${to}; ${total} total`}>
      {[0, .5, 1].map(part => <g key={part}><line x1="20" x2="680" y1={180 - part * 155} y2={180 - part * 155} stroke="var(--border)" strokeDasharray="4 5" /><text x="2" y={175 - part * 155} fill="var(--muted)" fontSize="11">{Math.round(max * part)}</text></g>)}
      {series.map((item, index) => <g key={item.type}><polyline points={item.values.map((value, day) => point(value, day).join(',')).join(' ')} fill="none" stroke={colors[index % colors.length]} strokeWidth="2.5" strokeDasharray={index % 2 ? '6 3' : undefined} />
        {item.values.map((value, day) => <circle key={days[day]} cx={point(value, day)[0]} cy={point(value, day)[1]} r="3" fill={colors[index % colors.length]}><title>{days[day]}: {value} {item.type}</title></circle>)}
      </g>)}
    </svg>
    <div className="dashboard-chart-dates">{[0, Math.floor((days.length - 1) / 2), days.length - 1].filter((item, index, all) => all.indexOf(item) === index).map(index => <span key={index}>{days[index]}</span>)}</div>
    <details><summary>View chart data</summary><div className="table-scroll"><table><caption>Authorized consultation counts</caption><thead><tr><th>Date</th>{series.map(item => <th key={item.type}>{item.type}</th>)}</tr></thead><tbody>{days.map((day, index) => <tr key={day}><th>{day}</th>{series.map(item => <td key={item.type}>{item.values[index]}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
