import React from 'react';
import { today } from '../../utils/helpers';
export default function VisitChart({ records }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today() + 'T12:00:00'); d.setDate(d.getDate() - 6 + i); return d.toLocaleDateString('en-CA'); });
  const series = ['General consultation', 'Follow-up'].map(type => days.map(day => records.filter(r => r.date === day && (type === 'Follow-up' ? r.type === type : r.type !== 'Follow-up')).length));
  const max = Math.max(4, ...series.flat()) + 1;
  const points = values => values.map((n, i) => [i * 700 / 6, 185 - n / max * 170]);
  const line = values => { const p = points(values); return p.reduce((result, [x, y], i) => i === 0 ? `M${x} ${y}` : `${result} C${(p[i - 1][0] + x) / 2} ${p[i - 1][1]} ${(p[i - 1][0] + x) / 2} ${y} ${x} ${y}`, ''); };
  return <div className="chart">
    <div className="chart-labels">
      {[1, .75, .5, .25, 0].map(n => <span key={n}>
        {Math.round(max * n)}
      </span>)}
    </div>
    <div className="chart-plot">
      <svg 
        viewBox="0 0 700 200" 
        preserveAspectRatio="none" 
        role="img" 
        aria-label="Consultations and follow-up visits during the last seven days"
      >
        <defs>
          <linearGradient 
            id="visit-fill" 
            x1="0" 
            y1="0" 
            x2="0" 
            y2="1"
          >
            <stop offset="0%" stopColor="#12a18d" stopOpacity=".22"/>
            <stop offset="100%" stopColor="#12a18d" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[15, 55, 95, 135, 185].map(y => <line 
          key={y} 
          x1="0" 
          x2="700" 
          y1={y} 
          y2={y} 
          stroke="var(--border)" 
          strokeDasharray="4 5"
        />)}
        <path d={line(series[0]) + ' L700 200 L0 200Z'} fill="url(#visit-fill)"/>
        {series.map((values, index) => <g key={index}>
          <path 
            d={line(values)} 
            fill="none" 
            stroke={index ? '#a2a4ef' : '#0f9e88'} 
            strokeWidth="3" 
            strokeDasharray={index ? '5 5' : undefined}
          />
          {points(values).map(([x, y], i) => <circle 
            key={i} 
            cx={x} 
            cy={y} 
            r="3" 
            fill={index ? '#a2a4ef' : '#0f9e88'}
          >
            <title>{days[i]}: {values[i]} {index ? 'follow-ups' : 'consultations'}</title>
          </circle>)}
        </g>)}
      </svg>
      <div className="chart-days">
        {days.map(d => <span key={d}>
          {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
        </span>)}
      </div>
    </div>
  </div>;
}
