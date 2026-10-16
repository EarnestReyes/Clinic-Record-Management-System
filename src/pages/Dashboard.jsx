import React, { useEffect, useState } from 'react';
import { ArrowRight, Users, Heart, CalendarDays, Stethoscope, BarChart3, RefreshCw, Bell, Clock, ShieldCheck } from 'lucide-react';
import Stat from '../components/common/Stat.jsx';
import Card from '../components/common/Card.jsx';
import VisitChart from '../components/charts/VisitChart.jsx';
import { today } from '../utils/helpers.js';
import { clinicTimeRange } from '../utils/clinicTime.js';
import { appointmentGradient } from '../utils/chartHelpers.js';
import { request } from '../services/api.js';
import './Dashboard.css';
import PatientActivitySummary from '../components/patients/PatientActivitySummary.jsx';

const statuses = ['Scheduled', 'Completed', 'Cancelled', 'No Show'];
const colors = ['#0f9985', '#f4b56a', '#b5bfc9', '#e18c8c'];
const daysBefore = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time unavailable';

export default function Dashboard({ data, user, go, appointmentTable, addPatient, addConsultation, addAppointment, onRefresh, onViewSchedule, openNotifications }) {
  const [range, setRange] = useState({ from: daysBefore(today(), 6), to: today() });
  const [draft, setDraft] = useState(range);
  const [period, setPeriod] = useState('7');
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ loading: true });
  const [rangeError, setRangeError] = useState('');
  const permissions = data.permissions || {};
  const administrator = user?.role === 'Administrator';
  const intake = user?.role === 'Clinic Staff' && permissions.intake;
  const clinical = permissions.createConsultation === true;
  const scheduling = administrator || intake || clinical;
  const profession = administrator ? 'Administrator' : data.specialties?.find(item => item.key === permissions.specialty)?.label || 'Profession not configured';
  const scope = `${user?.id || ''}:${user?.role || ''}:${permissions.specialty || ''}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(previous => ({ loading: true, scope, snapshot: previous.scope === scope ? previous.snapshot : undefined }));
    const params = new URLSearchParams({ ...range, ...(status ? { status } : {}) });
    request(`/dashboard?${params}`, { signal: controller.signal }).then(snapshot => {
      if (!active) return;
      const counts = ['totalPatients', 'activePatients', 'archivedRecords', 'newPatients', 'scheduledToday', 'todaysAppointments', 'todaysConsultations', 'upcomingAppointments', 'rangeAppointmentTotal', 'filteredAppointmentTotal', 'unreadNotifications'];
      const lists = ['visits', 'rangeAppointments', 'recentActivity', 'upcoming', 'notifications', 'doctors', 'conflicts'];
      if (counts.some(key => !Number.isFinite(snapshot[key]) || snapshot[key] < 0) || lists.some(key => !Array.isArray(snapshot[key])) || statuses.some(key => !Number.isFinite(snapshot.statusCounts?.[key]))) throw new Error('Dashboard data is incomplete. Retry loading your dashboard.');
      setState({ snapshot, scope });
    }).catch(error => { if (active && error.name !== 'AbortError') setState(previous => ({ ...previous,
      snapshot: [401, 403].includes(error.status) ? undefined : previous.snapshot,
      loading: false, error: error.message })); });
    return () => { active = false; controller.abort(); };
  }, [range.from, range.to, status, reload, data.dashboard, scope]);

  const refresh = async () => {
    setState(previous => ({ ...previous, loading: true, error: undefined }));
    if (period !== 'custom') { const next = { from: daysBefore(today(), Number(period) - 1), to: today() }; setRange(next); setDraft(next); }
    try { if (onRefresh) await onRefresh(); setReload(value => value + 1); }
    catch (error) { setState(previous => ({ ...previous, loading: false, error: error.message })); }
  };
  const actions = [
    ...(administrator || intake ? [[Users, 'Register patient', () => addPatient()]] : []),
    ...(clinical ? [[Stethoscope, 'New consultation', () => addConsultation()]] : []),
    ...(scheduling ? [[CalendarDays, 'Schedule appointment', () => addAppointment()]] : []),
    ...(permissions.viewReports ? [[BarChart3, 'View reports', () => go('reports')]] : [])
  ];
  const snapshot = state.scope === scope ? state.snapshot : undefined;
  const visits = snapshot?.visits.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return <div className="careline-dashboard">
    <section className="dashboard-intro">
      <div><span className="dashboard-role"><ShieldCheck size={14} />{profession}</span>
        <h2>{administrator ? 'Clinic operations' : intake ? 'Patient intake & scheduling' : 'Your care workspace'}</h2>
        <p>{administrator ? 'Patient registration, appointments and team availability.' : intake ? 'Register patients, check doctor schedules and route appointments.' : 'Patients and appointments assigned to your account, with your own consultation activity.'}</p>
      </div>
      <button className="btn secondary" onClick={refresh} disabled={state.loading}><RefreshCw size={15} />Refresh dashboard</button>
    </section>
    <div className="dashboard-toolbar">
      <label>Activity period<select aria-label="Dashboard activity period" value={period} onChange={event => {
        const value = event.target.value; setPeriod(value); setRangeError('');
        if (value !== 'custom') { const next = { from: daysBefore(today(), Number(value) - 1), to: today() }; setRange(next); setDraft(next); }
      }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="custom">Custom dates</option></select></label>
      {period === 'custom' && <form className="dashboard-range" onSubmit={event => {
        event.preventDefault();
        if (!draft.from || !draft.to || draft.from > draft.to || Date.parse(draft.to) - Date.parse(draft.from) > 365 * 86400000) { setRangeError('Choose a valid date range of up to 366 days.'); return; }
        setRangeError(''); setRange({ ...draft });
      }}><label>From<input aria-label="Dashboard start date" type="date" required value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
        <label>To<input aria-label="Dashboard end date" type="date" required value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label><button className="btn secondary" type="submit">Apply dates</button></form>}
      <span className="dashboard-timezone"><Clock size={14} />Asia/Manila</span>
    </div>
    {rangeError && <p className="form-error" role="alert">{rangeError}</p>}
    {state.loading && !snapshot ? <div className="dashboard-loading" role="status" aria-label="Loading dashboard"><p>Loading your authorized dashboard…</p><div className="dashboard-skeleton-grid">{[0,1,2,3].map(item => <div key={item} className="dashboard-skeleton" />)}</div></div> : state.error && !snapshot ?
      <div className="dashboard-error" role="alert"><h3>Dashboard unavailable</h3><p>{state.error}</p><button className="btn secondary" onClick={refresh}>Retry dashboard</button></div> : snapshot && <>
      <div className="stats-grid">
        <Stat neutral icon={Users} title={administrator || intake ? 'Registered patients' : 'Authorized patients'} value={snapshot.totalPatients} change="Current access" note="active and archived profiles" />
        <Stat neutral icon={Heart} title="Non-archived profiles" value={snapshot.activePatients} change={`${snapshot.archivedRecords} archived`} note="profile lifecycle, not clinical activity" color="purple" />
        <Stat neutral icon={CalendarDays} title="Scheduled today" value={snapshot.scheduledToday} change={`${snapshot.todaysAppointments} total today`} note="all statuses included in total" color="blue" />
        <Stat neutral icon={Stethoscope} title="Upcoming appointments" value={snapshot.upcomingAppointments} change="Scheduled" note="today onward, all appointment types" color="orange" />
      </div>
      <div className="dashboard-facts"><span>{snapshot.newPatients} patients registered today</span>{clinical && !administrator && <span>{snapshot.todaysConsultations} own consultations today</span>}
        {administrator && <span>{snapshot.todaysConsultations} consultations today</span>}
        {intake && <span>{snapshot.routingTasks} scheduled appointments need routing review in this period</span>}
        {administrator && <span>{snapshot.staffCount} active clinic staff · {snapshot.doctors.length} doctors</span>}
        <span>Refreshed {timestamp(snapshot.generatedAt)} · Manila</span>
      </div>
      <div className="quick-actions">{actions.length ? actions.map(([Icon, label, action]) => <button key={label} onClick={action}><Icon size={17} />{label}<ArrowRight size={15} /></button>) : <p>Your profession must be configured before clinical or scheduling actions are available.</p>}</div>
      {(administrator || clinical) && <PatientActivitySummary user={user} permissions={permissions} revision={data.dashboard} go={go} />}
      <div className="dashboard-charts">
        <Card title={intake ? 'Appointment scheduling activity' : administrator ? 'Clinic consultation activity' : 'Your consultation activity'} subtitle={`${snapshot.from} to ${snapshot.to} · Asia/Manila`}>
          {intake ? <div className="dashboard-range-summary"><strong>{snapshot.rangeAppointmentTotal}</strong><p>Appointments in the selected period</p><small>Clinical consultation details are restricted to authorized professionals.</small></div> : <><div className="dashboard-range-summary"><strong>{visits}</strong><p>Recorded consultations in the selected period</p></div><VisitChart visits={snapshot.visits} from={snapshot.from} to={snapshot.to} /></>}
        </Card>
        <Card title="Appointment status overview" subtitle="Selected activity period · all appointment types">
          <div className="donut-area"><div className="donut" style={{ background: snapshot.rangeAppointmentTotal ? appointmentGradient(snapshot.statusCounts) : 'var(--border)' }} aria-hidden="true"><div><strong>{snapshot.rangeAppointmentTotal}</strong><small>Appointments</small></div></div></div>
          <div className="donut-legend">{statuses.map((item, index) => <div key={item}><span><i style={{ background: colors[index] }} />{item}</span><strong>{snapshot.statusCounts[item]}</strong></div>)}</div>
        </Card>
      </div>
      <div className="dashboard-lower">
        <Card title="Appointments in selected period" subtitle={`Showing ${snapshot.rangeAppointments.length} of ${snapshot.filteredAppointmentTotal} matching appointments`} action={<label>Status<select aria-label="Dashboard appointment status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(item => <option key={item}>{item}</option>)}</select></label>}>
          <div className="dashboard-update-feedback" aria-live="polite">
            {state.loading ? <small role="status">Updating appointments…</small> : state.error ? <div role="alert">Could not refresh the dashboard. Displaying previous results. {state.error} <button className="text-button" onClick={refresh}>Retry dashboard</button></div> : null}
          </div>
          <div aria-busy={!!state.loading} inert={state.loading || !!state.error}>
          {snapshot.rangeAppointments.length ? appointmentTable(snapshot.rangeAppointments, false, true) : <p className="dashboard-empty">No matching appointments in this date range.</p>}
          </div>
        </Card>
        <Card title="Recent activity" subtitle="Latest activity within your access scope" action={permissions.viewAuditLogs && <button className="text-button" onClick={() => go('audit-logs')}>View activity<ArrowRight size={14} /></button>}>
          {snapshot.recentActivity.length ? <ul className="dashboard-activity">{snapshot.recentActivity.map(log => <li key={log.id}><strong>{log.action || 'Workspace activity'}</strong><small>{timestamp(log.date)} · {log.actor || 'Clinic account'}</small></li>)}</ul> : <p className="dashboard-empty">No recent activity in your authorized workspace.</p>}
        </Card>
      </div>
      <div className="dashboard-lower">
        <Card title="Upcoming scheduled appointments" subtitle="Today onward · ordered by date and time" action={<button className="text-button" onClick={() => onViewSchedule ? onViewSchedule(snapshot.today) : go('appointments')}>Open calendar<ArrowRight size={14} /></button>}>
          {snapshot.upcoming.length ? appointmentTable(snapshot.upcoming, false, true) : <p className="dashboard-empty">No upcoming scheduled appointments.</p>}
        </Card>
        <Card title="Notifications" subtitle={`${snapshot.unreadNotifications} unread within your access scope`} action={openNotifications && <button className="text-button" onClick={openNotifications}><Bell size={14} />Open notifications</button>}>
          {snapshot.notifications.length ? <ul className="dashboard-activity">{snapshot.notifications.map(item => <li key={item.id}><strong>{item.title || 'Workspace notification'}{!item.read && <span className="dashboard-unread">Unread</span>}</strong><p>{item.text}</p></li>)}</ul> : <p className="dashboard-empty">No notifications yet.</p>}
        </Card>
      </div>
      <Card title={administrator || intake ? 'Doctor availability' : 'Your weekly availability'} subtitle="Configured weekly schedules · Asia/Manila" action={administrator && <button className="text-button" onClick={() => go('user-management')}>Manage availability<ArrowRight size={14} /></button>}>
        {snapshot.doctors.length ? <ul className="dashboard-doctors">{snapshot.doctors.map(doctor => <li key={doctor.id}><div><strong>Dr. {doctor.name}</strong><span>{data.specialties?.find(item => item.key === doctor.specialty)?.label || 'Profession unavailable'}</span></div>
          <div>{doctor.availability?.weekdays?.length ? <><strong>{doctor.availability.weekdays.map(day => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(', ')}</strong><span>{clinicTimeRange(doctor.availability.start, doctor.availability.end)} · {doctor.availability.duration} min</span></> : <span>Availability not configured · new bookings disabled</span>}</div></li>)}</ul> : <p className="dashboard-empty">No active eligible doctors found.</p>}
      </Card>
      {administrator && <Card title="Scheduling review" subtitle="Scheduled appointments in the selected period; existing bookings stay unchanged">
        {snapshot.conflicts.length ? <ul className="dashboard-activity">{snapshot.conflicts.map(item => <li key={item.id}><strong>{item.id} · {item.staff || 'Unassigned doctor'}</strong><p>{item.date} {item.time} · {item.reason}</p></li>)}</ul> : <p className="dashboard-empty">No scheduling conflicts found in this period.</p>}
      </Card>}
      {administrator && <Card title="Doctor–Patient Directory" subtitle="Specialty → doctor → patients. Review active scheduling relationships and recorded consultation history."
        action={<button className="btn secondary" onClick={() => go('doctor-patient-directory')}><Users size={16} />Open directory<ArrowRight size={14} /></button>}>
        <p className="dashboard-empty">View patients across doctors using their existing clinic patient IDs. Active and historical relationships are counted separately.</p>
      </Card>}
    </>}
  </div>;
}
