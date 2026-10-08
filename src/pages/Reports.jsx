import React, { useEffect, useState } from "react";
import { Printer, ArrowDownToLine, Users, Stethoscope, CalendarDays, Activity } from "lucide-react";
import { dateLabel } from "../utils/helpers";
import { getReport, exportReport } from '../services/api.js';
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
  patient,
  notify
}) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getReport(reportType, from, to, controller.signal).then(report => { setRows(report.items); setLoading(false); }).catch(error => { if (error.name !== 'AbortError') { setError(error.message); setRows([]); setLoading(false); } });
    return () => controller.abort();
  }, [reportType, from, to, data]);
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
        <button className="btn primary" disabled={loading || !!error} onClick={async () => { try { await exportReport(reportType, from, to); notify('Report exported'); } catch (error) { notify(error.message); } }}><ArrowDownToLine size={16} />Export CSV</button>
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
      {loading ? <p className="muted" role="status">Loading report...</p> : error ? <p className="form-error" role="alert">{error}</p> : <ReportBars rows={rows} type={reportType} />}
    </Card><Card title={`${reportType} report`} subtitle={`${rows.length} records in the selected date range`}>
      {!loading && !error && <ReportTable rows={rows} patient={patient} />}
    </Card></>;
}
