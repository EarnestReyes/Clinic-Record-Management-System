import React from "react";
import { Printer, ArrowDownToLine, Users, Stethoscope, CalendarDays, Activity } from "lucide-react";
import { exportCSV, dateLabel } from "../utils/helpers";
import { reportRows } from "../utils/reports.js";
import Stat from "../components/common/Stat.jsx";
import Card from "../components/common/Card.jsx";
import ReportBars from "../components/reports/ReportBars.jsx";
import ReportTable from "../components/reports/ReportTable.jsx";
export default function Reports({
  reportType,
  setReportType,
  from,
  to,
  setFrom,
  setTo,
  data,
  patient
}) {
  return <><section className="card report-controls">
      <div>
        <label>Report type<select value={reportType} onChange={e => setReportType(e.target.value)}>
            {['Patients', 'Consultations', 'Appointments', 'Clinic Activity'].map(t => <option key={t}>
              {t}
            </option>)}
          </select></label>
        <label>From<input 
            type="date" 
            value={from} 
            max={to} 
            onChange={e => setFrom(e.target.value)} 
          /></label>
        <label>To<input 
            type="date" 
            value={to} 
            min={from} 
            onChange={e => setTo(e.target.value)} 
          /></label>
      </div>
      <div>
        <button className="btn secondary" onClick={() => window.print()}><Printer size={16} />Print</button>
        <button className="btn primary" onClick={() => exportCSV(reportType.toLowerCase().replaceAll(' ', '-'), reportRows(data, reportType, from, to))}><ArrowDownToLine size={16} />Export CSV</button>
      </div>
    </section><div className="stats-grid">
      <Stat 
        icon={Users} 
        title="Patient registrations" 
        value={data.patients.filter(p => p.created >= from && p.created <= to).length} 
        change="Selected" 
        note="date range" 
      />
      <Stat 
        icon={Stethoscope} 
        title="Consultations" 
        value={data.consultations.filter(r => r.date >= from && r.date <= to).length} 
        change="Selected" 
        note="date range" 
        color="purple" 
      />
      <Stat 
        icon={CalendarDays} 
        title="Appointments" 
        value={data.appointments.filter(a => a.date >= from && a.date <= to).length} 
        change="Selected" 
        note="date range" 
        color="blue" 
      />
      <Stat 
        icon={Activity} 
        title="Clinic activity" 
        value={data.logs.filter(l => l.date.slice(0, 10) >= from && l.date.slice(0, 10) <= to).length} 
        change="Tracked" 
        note="actions in range" 
        color="orange" 
      />
    </div><Card title="Report breakdown" subtitle={`${reportType} · ${dateLabel(from)} — ${dateLabel(to)}`}>
      <ReportBars rows={reportRows(data, reportType, from, to)} type={reportType} />
    </Card><Card title={`${reportType} report`} subtitle={`${reportRows(data, reportType, from, to).length} records in the selected date range`}>
      <ReportTable rows={reportRows(data, reportType, from, to)} patient={patient} />
    </Card></>;
}
