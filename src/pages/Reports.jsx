import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { dateLabel } from "../utils/helpers";
import { getReport, exportReport, reportTypeId } from '../services/api.js';
import { reportTitles } from '../../shared/reportAnalytics.js';
import Card from "../components/common/Card.jsx";
import ReportBars from "../components/reports/ReportBars.jsx";
import RecordExplorer from "../components/reports/RecordExplorer.jsx";
import ExportButton from "../components/common/ExportButton.jsx";
import useTableSort from '../utils/useTableSort.jsx';
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
  const table = useTableSort('date', 'desc');
  const [analytics, setAnalytics] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [retry, setRetry] = useState(0);
  const [selection, setSelection] = useState(null);
  const total = analytics?.total || 0;
  const contextKey = JSON.stringify([reportType, from, to]);
  const selected = selection?.contextKey === contextKey ? selection : null;
  useEffect(() => { setSelection(null); }, [contextKey]);
  const validRange = Boolean(from && to && from <= to);
  useEffect(() => {
    let active = true;
    const controller = new AbortController(); setLoading(true); setError('');
    if (!validRange) { setAnalytics(null); setGeneratedAt(''); setError('Choose a valid start and end date.'); setLoading(false); return () => controller.abort(); }
    getReport(reportType, from, to, controller.signal, { mode: 'summary' }).then(report => { if (!active) return; if (!report.analytics || !Number.isInteger(report.analytics.total)) throw new Error('Report data is incomplete. Please retry.'); setAnalytics(report.analytics); setGeneratedAt(report.generatedAt || new Date().toISOString()); setLoading(false); }).catch(error => { if (active && error.name !== 'AbortError') { setError(error.message); setAnalytics(null); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [reportType, from, to, data, retry, validRange]);
  const title = reportTitles[reportTypeId(reportType)];
  const generated = generatedAt ? new Date(generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '';
  return <div className="analytical-report-page" aria-busy={loading}>
    <div className="report-dashboard-heading"><div><h2>Reports &amp; Analytics</h2><p>Clinic operations | Asia/Manila</p></div><span className="report-updated">{!loading && !error && generated ? 'Generated ' + generated : 'Authorized clinic records'}</span></div>
    <nav className="report-categories" aria-label="Report categories">{[['Patients', 'Patient Analytics'], ['Appointments', 'Appointment Analytics'], ['Consultations', 'Consultations & Medical Records'], ['Clinic Activity', 'Clinic Activity & Audit']].map(([value, label]) => <button type="button" key={value} aria-current={reportType === value ? 'page' : undefined} onClick={() => setReportType(value)}>{label}</button>)}</nav>
    <header className="report-print-header"><strong>{data.settings?.clinic || 'Clinic'}</strong><p>Record Management System</p><h2>{title}</h2><p>{dateLabel(from)} to {dateLabel(to)}</p><p>Generated: {generated} | Asia/Manila | Total Records: {total}</p><p>Confidential - Authorized Personnel Only</p></header><section className="card report-controls">
      <div>
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
        <button className="btn secondary" disabled={loading || !!error || !total} onClick={() => window.print()}><Printer size={16} />Print</button>
        <ExportButton title={`${reportType} report`} recordCount={total} disabled={loading || !!error} onExport={async format => { await exportReport(reportType, from, to, format, table.sorting); notify('Report exported'); }} />
      </div>
    </section><Card title="Executive summary" subtitle={`${reportType} · ${dateLabel(from)} — ${dateLabel(to)}`}>
      {loading ? <p className="report-state muted" role="status">Loading authorized report records...</p> : error ? <div className="report-state" role="alert"><p className="form-error">{error}</p>{validRange && <button type="button" className="btn secondary" onClick={() => setRetry(value => value + 1)}>Retry report</button>}</div> : <ReportBars analytics={analytics} type={reportType} from={from} to={to} onDrill={value => setSelection({ ...value, contextKey })} />}
    </Card>{!loading && !error && <RecordExplorer key={contextKey + JSON.stringify(selected)} reportType={reportType} from={from} to={to} selection={selected} onBack={() => setSelection(null)} notify={notify} />}<footer className="report-print-footer">Generated by Careline Record Management System | {generated} | Asia/Manila<br />Confidential - Authorized Personnel Only</footer></div>;
}
