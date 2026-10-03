import React from "react";
import Empty from "../common/Empty.jsx";
export default function ReportBars({
  rows,
  type
}) {
  const key = {
    Patients: 'gender',
    Consultations: 'type',
    Appointments: 'status',
    'Clinic Activity': 'action'
  }[type];
  const groups = rows.reduce((acc, r) => ({
    ...acc,
    [r[key]]: (acc[r[key]] || 0) + 1
  }), {});
  return rows.length ? <div className="report-bars">
    {Object.entries(groups).map(([k, n], i) => <div key={k}>
      <span>
        {k}
      </span>
      <div>
        <i style={{
          width: Math.max(n / rows.length * 100, 3) + '%',
          background: ['#0f9985', '#9b91ea', '#6a9de6', '#f4b56a'][i % 4]
        }} />
      </div>
      <strong>
        {n}
      </strong>
    </div>)}
  </div> : <Empty title="No data in this date range" />;
}
