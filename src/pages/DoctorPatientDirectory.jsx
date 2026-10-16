import { displayIdentity } from '../../shared/displayIdentity.js';
﻿import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Users, CalendarCheck, Link2, Archive, ChevronDown, Info, X } from 'lucide-react';
import { request } from '../services/api.js';
import { filterDirectory } from '../utils/directory.js';
import { clinicTimeLabel } from '../utils/clinicTime.js';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import './DoctorPatientDirectory.css';
import useTableSort, { sortDate } from '../utils/useTableSort.jsx';
import SortControls from '../components/common/SortControls.jsx';

const patientSortOptions = [['name', 'Name'], ['id', 'Patient ID'], ['status', 'Status'], ['lastActivity', 'Last qualifying consultation']];
const activityLabel = value => value === 'Unknown' ? 'Unknown / Needs Review' : value || 'Unknown / Needs Review';

function DirectoryPatients({ doctor, sorting, patientValue, go }) {
  return <div className="directory-expanded">
    <div className="directory-patient-toolbar"><span>{doctor.patients.length} matching patient relationship(s)</span>
      <SortControls table={sorting} label={`Sort patients for Dr. ${doctor.name}`} options={patientSortOptions} />
    </div>
    {doctor.patients.length ? <div className="table-scroll bounded-table directory-patient-scroll" tabIndex={0} role="region" aria-label={`Patients for Dr. ${doctor.name}`}>
      <table className="directory-patient-table">
        <thead><tr><th>Patient</th><th>Relationship</th><th>Activity</th><th>Last clinical activity</th><th>Next appointment / history</th><th>Details</th></tr></thead>
        <tbody>{sorting.sort(doctor.patients, patientValue).map(patient => <tr key={patient.id}>
          <td data-label="Patient"><button className="text-button directory-patient-link" onClick={() => go(`patients/${encodeURIComponent(patient.id)}`)}>{patient.name} · {patient.id}</button><Badge>{patient.status}</Badge></td>
          <td data-label="Relationship"><div className="directory-relationship-labels">
            {patient.active && <span className="directory-active">Scheduled assignment</span>}
            {patient.historical && <span>Historical · {patient.consultationCount} consultation(s)</span>}
            {patient.routingOnly && <span>Routing needs verification</span>}
            {!patient.active && !patient.historical && !patient.routingOnly && <span>Appointment history only</span>}
          </div></td>
          <td data-label="Activity"><strong>{activityLabel(patient.activity?.status)}</strong>
            {patient.activity?.needsReview && <small className="cell-sub">Evidence needs review</small>}
            {patient.clinicActivity && <small className="cell-sub">Clinic: {activityLabel(patient.clinicActivity.status)} · Last qualifying consultation: {patient.clinicActivity.lastActivity || 'Unknown'}</small>}
          </td>
          <td data-label="Last clinical activity">{patient.activity?.lastActivity || 'Unknown'}
            {patient.lastConsultation && <small className="cell-sub">Last recorded consultation: {patient.lastConsultation}</small>}
          </td>
          <td data-label="Next appointment / history">
            {patient.upcoming ? <p>Next Scheduled appointment: {patient.upcoming.date} · {clinicTimeLabel(patient.upcoming.time)} · Asia/Manila{patient.status === 'Archived' || !doctor.active ? ' · Needs administrator review' : ''}</p> : <span className="muted">No upcoming appointment</span>}
            <div className="directory-status-counts">{Object.entries(patient.appointmentCounts).filter(([,count]) => count > 0).map(([status,count]) => <span key={status}>{status}: {count}</span>)}</div>
            {patient.appointments.length > 0 && <details className="directory-history"><summary>Appointment history ({patient.appointments.length})</summary><ul>{[...patient.appointments].sort((a,b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).map(appointment => <li key={appointment.id}>{displayIdentity(appointment)} | {appointment.date} · {clinicTimeLabel(appointment.time)} · <Badge>{appointment.status}</Badge></li>)}</ul></details>}
          </td>
          <td data-label="Details"><button className="text-button" aria-label={`View details for ${patient.name}`} onClick={() => go(`patients/${encodeURIComponent(patient.id)}`)}>View details</button></td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="directory-feedback">No matching patient relationships for this doctor.</p>}
  </div>;
}

export default function DoctorPatientDirectory({ user, go, revision }) {
  const patientSort = useTableSort('name');
  const doctorSort = useTableSort('name');
  const patientValue = (patient, key) => key === 'lastActivity' ? sortDate(patient.activity?.lastActivity) : patient[key];
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
  const filtersApplied = !!(search || specialty || activity || patientStatus || relationship !== 'all');
  const clearFilters = () => { setSearch(''); setSpecialty(''); setActivity(''); setPatientStatus(''); setRelationship('all'); };
  return <div className="doctor-patient-directory">
    <div className="directory-intro"><p>Doctor assignments and patient relationships across the clinic.</p>
      <button className="btn secondary" onClick={() => setReload(value => value + 1)} disabled={state.loading}><RefreshCw size={15} />Refresh directory</button></div>
    {state.loading ? <p className="directory-feedback" role="status">Loading doctor–patient directory…</p> : state.error ? <div className="directory-feedback" role="alert"><p>{state.error}</p><button className="btn secondary" onClick={() => setReload(value => value + 1)}>Retry directory</button></div> : data && <>
      <div className="directory-totals" aria-label="Clinic-wide directory totals">
        {[[Users, data.totals.patients, 'Unique patient profiles', 'One count per clinic patient ID, across all doctor relationships.'],
          [CalendarCheck, data.totals.activePatients, 'Patients with active appointments', 'Unique patients with a verified active Scheduled appointment relationship.'],
          [Link2, data.totals.activeRelationships, 'Active doctor-patient relationships', 'Each active doctor-patient relationship counts separately; one patient may have several.'],
          [Archive, data.totals.archivedPatients, 'Archived patient profiles', 'Archived profiles retain their linked medical and appointment history.']].map(([Icon, count, label, description]) => <div key={label}>
            <span className="directory-stat-icon"><Icon size={18} aria-hidden="true" /></span><div className="directory-stat-content"><strong>{count}</strong><span>{label}</span></div>
            <details className="directory-stat-definition"><summary aria-label={`About ${label}`} title={description}><Info size={14} aria-hidden="true" /></summary><p>{description}</p></details>
          </div>)}
      </div>
      <div className="directory-filters">
        <label className="directory-search">Search doctor, specialty or patient<div className="search-input"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search directory" placeholder="Doctor, specialty, patient name or ID" /></div></label>
        <label>Doctor activity<select value={activity} onChange={event => setActivity(event.target.value)} aria-label="Directory activity classification"><option value="">All activity</option>{['Active','At Risk','Inactive','Unknown'].map(value => <option key={value} value={value}>{value === 'Unknown' ? 'Unknown / Needs Review' : value}</option>)}</select></label>
        <label>Specialty<select value={specialty} onChange={event => setSpecialty(event.target.value)} aria-label="Directory specialty"><option value="">All specialties</option>{data.groups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>
        <label>Relationship<select value={relationship} onChange={event => setRelationship(event.target.value)} aria-label="Directory relationship"><option value="all">All relationships</option><option value="active">Active patients</option><option value="historical">Historical patients</option><option value="appointments">Appointment history only</option><option value="routing">Routing needs verification</option></select></label>
        <label>Patient profile<select value={patientStatus} onChange={event => setPatientStatus(event.target.value)} aria-label="Directory patient status"><option value="">All profiles</option><option value="Active">Active profiles</option><option value="Archived">Archived profiles</option></select></label>
      </div>
      <div className="directory-filter-feedback"><span>Filters affect displayed relationships; clinic totals remain unchanged.</span>{filtersApplied && <button className="text-button" onClick={clearFilters}><X size={14} />Clear filters</button>}</div>
      <details className="directory-help"><summary><Info size={15} aria-hidden="true" />How patient assignments work<ChevronDown size={15} className="directory-chevron" aria-hidden="true" /></summary>
        <div><p>One clinic patient ID can have separate relationships with several doctors. Cancelled and No Show appointments do not establish active care or completed treatment.</p>
          <p>Doctor counts cover all their relationships; filters control the patients displayed. An active relationship requires an active patient profile, an active doctor and a matched Scheduled appointment. Unresolved past Scheduled bookings remain active until resolved through the appointment workflow.</p>
          {data.activityCounts && <p>Clinic-wide activity (non-archived profiles): {Object.entries(data.activityCounts).map(([status,count]) => `${activityLabel(status)}: ${count}`).join(' | ')}. Activity classification does not change assignments, access or archive status.</p>}
          <p>Direct routing has no stored active-care status and is excluded from active counts. {data.review.uncertainAppointments} appointment(s) and {data.review.uncertainConsultations} consultation(s) have incomplete or mismatched relationship metadata and are excluded from verified relationships. No records were changed.</p>
        </div>
      </details>
      <div className="directory-section-heading"><div><h2>Doctor directory</h2><p>Expand a doctor to view matching patient relationships.</p></div>
        <SortControls table={doctorSort} label="Sort doctors" options={[['name', 'Name'], ['activeCount', 'Assigned patients'], ['historicalCount', 'Historical patients']]} />
      </div>
      <div className="directory-results" role="region" aria-label="Doctor and patient relationships">{groups.length ? groups.map(group => <section className="directory-specialty" key={group.key}>
        <div className="directory-specialty-heading"><h3>{group.label}</h3><span>{group.doctors.length} doctor(s) shown</span></div>
        {doctorSort.sort(group.doctors).map(doctor => <details className="directory-doctor" key={doctor.id}>
          <summary><span className="directory-doctor-identity"><span className="directory-doctor-icon"><Users size={18} aria-hidden="true" /></span><span><strong>Dr. {doctor.name}</strong><small>{displayIdentity(doctor)} | {group.label}{!doctor.active && ' | Inactive doctor'}</small></span></span>
            <span className="directory-doctor-counts"><span><strong>{doctor.activeCount}</strong>Assigned</span><span><strong>{doctor.historicalCount}</strong>Historical</span><span><strong>{doctor.activityCounts?.Inactive ?? '\u2014'}</strong>Activity inactive</span><span><strong>{doctor.patients.length}</strong>Shown</span></span>
            <ChevronDown size={18} className="directory-chevron" aria-hidden="true" />
          </summary>
          <DirectoryPatients doctor={doctor} sorting={patientSort} patientValue={patientValue} go={go} />
        </details>)}
      </section>) : <p className="directory-feedback" role="status">No matching doctor–patient relationships.</p>}</div>
      <Card title="Unassigned / no verified active doctor" action={<SortControls table={patientSort} label="Sort unassigned patients" options={patientSortOptions} />} subtitle="Active patient profiles without a verified active appointment relationship. Historical care and unverified routing may still exist.">
        {specialty || relationship !== 'all' ? <p className="directory-feedback">Clear specialty and relationship filters to review unassigned patients across the clinic.</p> : reviewPatients.length ? <ul className="directory-review">{patientSort.sort(reviewPatients, patientValue).map(patient => <li key={patient.id}><button className="text-button" onClick={() => go(`patients/${encodeURIComponent(patient.id)}`)}>{patient.name} · {patient.id}</button><span>{patient.routingNeedsReview ? `Routing needs verification${patient.routedDoctor ? ': Dr. ' + patient.routedDoctor : ''}` : 'No current routing recorded'}</span></li>)}</ul> : <p className="directory-feedback">No matching active patients need assignment review.</p>}
      </Card>
    </>}
  </div>;
}
