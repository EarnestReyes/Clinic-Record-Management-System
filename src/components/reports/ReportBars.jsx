import React from 'react';
import { reportAnalytics } from '../../../shared/reportAnalytics.js';
import Empty from '../common/Empty.jsx';
import './ReportAnalytics.css';

function Chart({ chart }) {
  const maximum = Math.max(1, ...chart.points.map(point => point.value));
  const trend = chart.trend, width = 820, height = trend ? 320 : Math.max(180, chart.points.length * 56 + 35);
  const left = trend ? 48 : 260, top = 20, plotWidth = width - left - 55, plotHeight = height - 100;
  const step = plotWidth / Math.max(1, chart.points.length);
  return <section className="analytical-chart">
    <h3>{chart.title}</h3><p>{chart.note}</p>
    <div className="analytical-chart-viewport" tabIndex={0} role="region" aria-label={`${chart.title} chart`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title + ': ' + chart.points.map(point => point.label + ': ' + point.value).join(', ')}>
      <title>{chart.title}</title>
      {trend && <>{[...new Set([0, Math.ceil(maximum / 2), maximum])].map(value => <g key={value}>
        <line x1={left} x2={width - 30} y1={top + plotHeight * (1 - value / maximum)} y2={top + plotHeight * (1 - value / maximum)} stroke="#d9e2e5" />
        <text x={left - 8} y={top + plotHeight * (1 - value / maximum) + 4} textAnchor="end">{value}</text>
      </g>)}</>}
      {chart.points.map((point, index) => {
        const bar = trend ? { x: left + index * step + step * .15, y: top + plotHeight * (1 - point.value / maximum), width: step * .7, height: plotHeight * point.value / maximum }
          : { x: left, y: top + index * 56 + 8, width: plotWidth * point.value / maximum, height: 22 };
        const lines = point.label.match(/.{1,32}(?:\s|$)|\S{1,32}/g) || [point.label];
        return <g key={point.label}><rect {...bar} fill="#168d80" rx="3"><title>{point.label}: {point.value}</title></rect>
          {trend ? <text x={left + index * step + step / 2} y={top + plotHeight + 14} transform={`rotate(-40 ${left + index * step + step / 2} ${top + plotHeight + 14})`} textAnchor="end">{point.label}</text>
            : <text x={left - 12} y={top + index * 56 + 20} textAnchor="end">{lines.slice(0,3).map((line, i) => <tspan key={i} x={left - 12} dy={i ? 13 : 0}>{line.trim()}{i === 2 && lines.length > 3 ? '…' : ''}</tspan>)}</text>}
          <text x={trend ? bar.x + bar.width / 2 : bar.x + bar.width + 8} y={trend ? Math.max(12, bar.y - 5) : bar.y + 16} textAnchor={trend ? 'middle' : 'start'}>{point.value}</text>
        </g>;
      })}
    </svg>
    </div>
    <details className="analytical-chart-data"><summary>View chart data</summary><table><thead><tr><th>Category / period</th><th>Records</th></tr></thead><tbody>{chart.points.map(point => <tr key={point.label}><td>{point.label}</td><td>{point.value}</td></tr>)}</tbody></table></details>
  </section>;
}

export default function ReportBars({ rows, type, from, to }) {
  const id = { Patients: 'patients', Consultations: 'consultations', Appointments: 'appointments', 'Clinic Activity': 'activity' }[type];
  const analytics = reportAnalytics(id, rows, { from, to });
  return <div className="report-analytics">
    <div className="analytical-summary" aria-label="Executive summary">{analytics.summary.map(metric => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>
    {analytics.notes.map(note => <p className="muted" key={note}>{note}</p>)}
    {analytics.empty ? <Empty title="No data in this date range" /> : <div className="analytical-charts">{analytics.charts.map(chart => <Chart key={chart.title} chart={chart} />)}</div>}
  </div>;
}
