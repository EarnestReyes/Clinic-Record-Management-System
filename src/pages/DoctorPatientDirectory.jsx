import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Users } from 'lucide-react';
import { request } from '../services/api.js';
import { filterDirectory } from '../utils/directory.js';
import { clinicTimeLabel } from '../utils/clinicTime.js';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import './DoctorPatientDirectory.css';

export default function DoctorPatientDirectory({ user, go, revision }) {
  const [state, setState] = useState({ loading: true });
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [relationship, setRelationship] = useState('all');
  const [patientStatus, setPatientStatus] = useState('');
  const [activity, setActivity] = useState('');
  const administrator = user?.role === 'Administrator';
  useEffect(() => {
    if (!administrator) return;
    const controller = new AbortController();
    let active = true;
    setState({ loading: true });
    request('/doctor-patient-directory', { signal: controller.signal }).then(data => {
      if (!active) return;
      if (!Array.isArray(data.groups) || !Array.isArray(data.unassigned) || !data.totals || !data.review) throw new Error('Directory response is incomplete. Try refreshing.');
      setState({ data });
    }).catch(error => { if (active && error.name !== 'AbortError') setState({ error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [administrator, reload, revision]);
  if (!administrator) return <p role="alert">Administrator access is required for the Doctor–Patient Directory.</p>;
  const data = state.data;
  const groups = data ? filterDirectory(data.groups, { search, specialty, relationship, patientStatus, activity }) : [];
  const reviewPatients = data?.unassigned.filter(patient => (!patientStatus || patient.status === patientStatus) && (!activity || patient.activity?.status === activity)
    && `${patient.name} ${patient.id} ${patient.routedDoctor}`.toLowerCase().includes(search.trim().toLowerCase())) || [];
  return <div className="doctor-patient-directory">
    <div className="directory-intro"><p>One clinic patient ID, with separate relationships for each doctor. Cancelled and No Show appointments do not establish active care or completed treatment.</p>
      <button className="btn secondary" onClick={() => setReload(value => value + 1)} disabled={state.loading}><RefreshCw size={15} />Refresh directory</button></div>
    {state.loading ? <p className="directory-feedback" role="status">Loading doctor–patient directory…</p> : state.error ? <div className="directory-feedback" role="alert"><p>{state.error}</p><button className="btn secondary" onClick={() => setReload(value => value + 1)}>Retry directory</button></div> : data && <>
      <div className="directory-totals" aria-label="Clinic-wide directory totals">
        <div><strong>{data.totals.patients}</strong><span>Unique patient profiles</span></div>
        <div><strong>{data.totals.activePatients}</strong><span>Unique patients with active appointments</span></div>
        <div><strong>{data.totals.activeRelationships}</strong><span>Active doctor–patient relationships</span></div>
        <div><strong>{data.totals.archivedPatients}</strong><span>Archived patient profiles</span></div>
      </div>
      <div className="directory-filters">
        <label>Doctor activity<select value={activity} onChange={event => setActivity(event.target.value)} aria-label="Directory activity classification"><option value="">All activity</option>{['Active','At Risk','Inactive','Unknown'].map(value => <option key={value} value={value}>{value === 'Unknown' ? 'Unknown / Needs Review' : value}</option>)}</select></label>
        <label>Search doctor, specialty or patient<div className="search-input"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search directory" placeholder="Doctor, specialty, patient name or ID" /></div></label>
        <label>Specialty<select value={specialty} onChange={event => setSpecialty(event.target.value)} aria-label="Directory specialty"><option value="">All specialties</option>{data.groups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>
        <label>Relationship<select value={relationship} onChange={event => setRelationship(event.target.value)} aria-label="Directory relationship"><option value="all">All relationships</option><option value="active">Active patients</option><option value="historical">Historical patients</option><option value="appointments">Appointment history only</option><option value="routing">Routing needs verification</option></select></label>
        <label>Patient profile<select value={patientStatus} onChange={event => setPatientStatus(event.target.value)} aria-label="Directory patient status"><option value="">All profiles</option><option value="Active">Active profiles</option><option value="Archived">Archived profiles</option></select></label>
      </div>
      {data.activityCounts && <p className="directory-note">Clinic-wide activity (non-archived profiles): {Object.entries(data.activityCounts).map(([status,count]) => `${status === 'Unknown' ? 'Unknown / Needs Review' : status}: ${count}`).join(' · ')}. Activity classification does not change assignments, access, or archive status.</p>}
      <p className="directory-note">Doctor counts cover all their relationships; filters control the patients displayed. “Active patient” requires an active patient profile, an active doctor account and a matched Scheduled appointment. Unresolved past Scheduled bookings remain active until resolved through the existing workflow.</p>
      {groups.length ? groups.map(group => <section className="directory-specialty" key={group.key}><h2>{group.label}</h2>{group.doctors.map(doctor => <details className="directory-doctor" key={doctor.id}>
        <summary><span><Users size={17} /><strong>Dr. {doctor.name}</strong>{!doctor.active && <Badge>Inactive doctor</Badge>}</span><span>{doctor.activeCount} assigned · {doctor.historicalCount} historical · {doctor.activityCounts?.Inactive ?? '—'} activity inactive · {doctor.patients.length} shown</span></summary>
        {doctor.patients.length ? <ul className="directory-patients">{doctor.patients.map(patient => <li key={patient.id}>
          <div className="directory-patient-heading"><button className="text-button" onClick={() => go(`patients/${encodeURIComponent(patient.id)}`)}>{patient.name} · {patient.id}</button><Badge>{patient.status}</Badge></div>
          {patient.activity && <p>Doctor activity: <strong>{patient.activity.status === 'Unknown' ? 'Unknown / Needs Review' : patient.activity.status}</strong> · Last qualifying consultation: {patient.activity.lastActivity || 'Unknown'}{patient.activity.needsReview && ' · Evidence needs review'}</p>}
          {patient.clinicActivity && <p>Clinic activity: <strong>{patient.clinicActivity.status === 'Unknown' ? 'Unknown / Needs Review' : patient.clinicActivity.status}</strong> · Last qualifying consultation: {patient.clinicActivity.lastActivity || 'Unknown'}</p>}
          <div className="directory-relationship-labels">{patient.active && <span className="directory-active">Scheduled assignment · existing workflow</span>}{patient.historical && <span>Historical · {patient.consultationCount} recorded consultation(s)</span>}{patient.routingOnly && <span>Routing recorded · active care not verified</span>}{!patient.active && !patient.historical && !patient.routingOnly && <span>Appointment history only · no verified active care</span>}</div>
          {patient.lastConsultation && <p>Last recorded consultation: {patient.lastConsultation}</p>}
          {patient.upcoming && <p>Next Scheduled appointment: {patient.upcoming.date} · {clinicTimeLabel(patient.upcoming.time)} · Asia/Manila{patient.status === 'Archived' || !doctor.active ? ' · Needs administrator review' : ''}</p>}
          <p className="directory-status-counts">{Object.entries(patient.appointmentCounts).filter(([,count]) => count > 0).map(([status,count]) => <span key={status}>{status}: {count}</span>)}</p>
          {patient.appointments.length > 0 && <details className="directory-history"><summary>Appointment history ({patient.appointments.length})</summary><ul>{[...patient.appointments].sort((a,b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).map(appointment => <li key={appointment.id}>{appointment.date} · {clinicTimeLabel(appointment.time)} · <Badge>{appointment.status}</Badge></li>)}</ul></details>}
        </li>)}</ul> : <p className="directory-feedback">No matching patient relationships for this doctor.</p>}
      </details>)}</section>) : <p className="directory-feedback" role="status">No matching doctor–patient relationships.</p>}
      <Card title="Unassigned / no verified active doctor" subtitle="Active patient profiles without a verified active appointment relationship. Historical care and unverified routing may still exist.">
        {specialty || relationship !== 'all' ? <p className="directory-feedback">Clear specialty and relationship filters to review unassigned patients across the clinic.</p> : reviewPatients.length ? <ul className="directory-review">{reviewPatients.map(patient => <li key={patient.id}><button className="text-button" onClick={() => go(`patients/${encodeURIComponent(patient.id)}`)}>{patient.name} · {patient.id}</button><span>{patient.routingNeedsReview ? `Routing needs verification${patient.routedDoctor ? ': Dr. ' + patient.routedDoctor : ''}` : 'No current routing recorded'}</span></li>)}</ul> : <p className="directory-feedback">No matching active patients need assignment review.</p>}
      </Card>
      <div className="directory-note"><strong>Routing and legacy records</strong><p>Direct routing has no stored active-care status and is excluded from active counts. {data.review.uncertainAppointments} appointment(s) and {data.review.uncertainConsultations} consultation(s) have incomplete or mismatched relationship metadata and are excluded from verified relationships. No records were changed.</p></div>
    </>}
  </div>;
}
