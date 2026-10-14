import React from 'react';
import { today } from '../../utils/helpers';

const VISIT_TYPES = [
  {
    key: 'consultation',
    label: 'General Consultation',
    color: '#3155A6' 
  },
  {
    key: 'followUp',
    label: 'Follow-up Visit',
    color: '#8874D8' 
  },
  {
    key: 'routine',
    label: 'Routine Examination',
    color: '#42A5D9' 
  },
  {
    key: 'urgent',
    label: 'Urgent Visit',
    color: '#26345F' 
  }
];

const normalizeType = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const getVisitType = record => {
  const type = normalizeType(record.type);

  if (['follow up', 'followup'].includes(type)) {
    return 'followUp';
  }

  if (
    ['routine examination', 'routine exam', 'routine'].includes(type)
  ) {
    return 'routine';
  }

  if (
    ['urgent visit', 'urgent', 'emergency visit'].includes(type)
  ) {
    return 'urgent';
  }

  if (
    [
      'general consultation',
      'consultation',
      'general consult'
    ].includes(type)
  ) {
    return 'consultation';
  }

  return null;
};

export default function VisitChart({ records = [] }) {
  // Generate the last seven calendar days, including today.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today()}T12:00:00`);
    date.setDate(date.getDate() - 6 + i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  });

  const normalizeDate = value => {
    if (!value) return '';

    // Preserve the calendar date in YYYY-MM-DD or ISO strings.
    if (typeof value === 'string') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  };

  // Count each visit type for each day.
  const series = VISIT_TYPES.map(type =>
    days.map(day =>
      records.filter(
        record =>
          normalizeDate(record.date) === day &&
          getVisitType(record) === type.key
      ).length
    )
  );

  // Keep the vertical scale shared by all four lines.
  const max = Math.max(4, ...series.flat()) + 1;

  const points = values =>
    values.map((value, index) => [
      index * (700 / 6),
      185 - (value / max) * 170
    ]);

  const line = values => {
    const p = points(values);

    return p.reduce(
      (result, [x, y], i) =>
        i === 0
          ? `M${x} ${y}`
          : `${result} C${(p[i - 1][0] + x) / 2} ${p[i - 1][1]} ${
              (p[i - 1][0] + x) / 2
            } ${y} ${x} ${y}`,
      ''
    );
  };

  return (
    <div className="chart">
      <div className="chart-labels">
        {[1, 0.75, 0.5, 0.25, 0].map(n => (
          <span key={n}>{Math.round(max * n)}</span>
        ))}
      </div>

      <div className="chart-plot">
        <svg
          viewBox="0 0 700 200"
          preserveAspectRatio="none"
          role="img"
          aria-label="Medical visits by type during the last seven days"
        >
          {[15, 55, 95, 135, 185].map(y => (
            <line
              key={y}
              x1="0"
              x2="700"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="4 5"
            />
          ))}

          {series.map((values, index) => {
            const type = VISIT_TYPES[index];

            return (
              <g key={type.key}>
                <path
                    d={line(values)}
                    fill="none"
                    stroke={type.color}
                    strokeWidth="3"
                    strokeDasharray={index === 1 ? '5 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                {points(values).map(([x, y], i) => (
                  <circle
                    key={`${type.key}-${days[i]}`}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={type.color}
                  >
                    <title>
                      {days[i]}: {values[i]} — {type.label}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        <div className="chart-days">
          {days.map(day => (
            <span key={day}>
              {new Date(`${day}T12:00:00`).toLocaleDateString(
                'en-US',
                { weekday: 'short' }
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}