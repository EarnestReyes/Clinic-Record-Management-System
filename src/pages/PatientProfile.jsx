import React from "react";
import { ArrowLeft, Pencil, CalendarDays, Plus, ArrowRight } from "lucide-react";
import Avatar from "../components/common/Avatar.jsx";
import Badge from "../components/common/Badge.jsx";
import { age, dateLabel} from "../utils/helpers";
import Card from "../components/common/Card.jsx";
import AuditTable from "../components/common/AuditTable.jsx";
import PatientDocuments from "../components/documents/PatientDocuments.jsx";
export default function PatientProfile({
  go,
  selected,
  addPatient,
  addAppointment,
  addConsultation,
  tab,
  setTab,
  recordList,
  data,
  appointmentTable,
  setModal,
  notify,
  commit
}) {
  return <><button className="text-button back-button" onClick={() => go(selected.status === 'Archived' ? 'archived-patients' : 'patients')}><ArrowLeft size={15} />{selected.status === 'Archived' ? 'Back to archived patients' : 'Back to patients'}</button><div className="profile-banner">
      <Avatar name={selected.name} size="large" />
      <div className="profile-identity">
        <div className="row">
          <h2>
            {selected.name}
          </h2>
          <Badge>
            {selected.status}
          </Badge>
        </div>
        <p>{selected.id} <span>·</span> {age(selected.dob)} years <span>·</span> {selected.gender} <span>·</span> Blood group {selected.blood}</p>
        <small>Patient since {dateLabel(selected.created)}</small>
      </div>
      <div className="profile-actions">
        {selected.status === 'Active' && <button className="btn secondary" onClick={() => addPatient(selected)}><Pencil size={15} />Edit patient</button>}
        {selected.status === 'Active' && <><button className="btn secondary" onClick={() => addAppointment(selected.id)}><CalendarDays size={15} />Schedule</button>{data.permissions.createConsultation && <button className="btn primary" onClick={() => addConsultation(selected.id)}><Plus size={15} />Consultation</button>}</>}
      </div>
    </div><div className="tabs">
      {['Overview', 'Visit History', 'Medical Records', 'Appointments', 'Documents', 'Activity History'].filter(t => data.permissions.viewRecords || !['Visit History', 'Medical Records', 'Documents'].includes(t)).map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
        {t}
      </button>)}
    </div>{tab === 'Overview' && <div className="profile-grid">
      <div>
        <Card title="Personal information" subtitle="The essentials for thoughtful care">
          <div className="detail-grid">
            {[['Date of birth', dateLabel(selected.dob)], ['Gender', selected.gender], ['Email', selected.email || 'Not provided'], ['Phone', selected.phone], ['Address', selected.address || 'Not provided'], ['Blood group', selected.blood], ['Emergency contact', selected.emergencyName || 'Not provided'], ['Emergency phone', selected.emergencyPhone || 'Not provided'], ['Intake complaint', selected.intakeComplaint || 'Not recorded'], ['Forwarded to', selected.assignedStaff ? 'Dr. ' + selected.assignedStaff : 'Not forwarded yet']].map(([k, v]) => <div key={k}>
              <small>
                {k}
              </small>
              <strong>
                {v}
              </strong>
            </div>)}
          </div>
        </Card>
        {data.permissions.viewRecords && <Card title="Recent visits" action={<button className="text-button" onClick={() => setTab('Visit History')}>View history<ArrowRight size={15} /></button>}>
          {recordList(data.consultations.filter(r => r.patientId === selected.id).slice(0, 3))}
        </Card>}
      </div>
      <div>
        <Card title="Health overview">
          <div className="health-note">
            <span>ALLERGIES</span>
            <p>
              {selected.allergies || 'None known'}
            </p>
          </div>
          {data.permissions.manageUsers && <div className="health-note">
            <span>EXISTING CONDITIONS</span>
            <p>
              {selected.conditions || 'None recorded'}
            </p>
          </div>}
          {data.permissions.manageUsers && <div className="health-note neutral">
            <span>NOTES</span>
            <p>
              {selected.notes || 'No additional notes'}
            </p>
          </div>}
        </Card>
        <Card title="Record summary">
          <div className="summary-rows">
            {[['Consultations', data.consultations.filter(r => r.patientId === selected.id).length], ['Appointments', data.appointments.filter(a => a.patientId === selected.id).length], ['Documents', data.documents.filter(d => d.patientId === selected.id && d.status === 'Active').length]].map(([k, v]) => <div key={k}>
              <span>
                {k}
              </span>
              <strong>
                {v}
              </strong>
            </div>)}
          </div>
        </Card>
      </div>
    </div>}{data.permissions.viewRecords && ['Visit History', 'Medical Records'].includes(tab) && <Card title={tab} subtitle="A continuous story of patient care">
      {recordList(data.consultations.filter(r => r.patientId === selected.id).sort((a, b) => b.date.localeCompare(a.date)))}
    </Card>}{tab === 'Appointments' && <Card title="Patient appointments" action={selected.status === 'Active' && <button className="btn primary" onClick={() => addAppointment(selected.id)}><Plus size={15} />Schedule</button>}>
      {appointmentTable(data.appointments.filter(a => a.patientId === selected.id))}
    </Card>}{data.permissions.viewRecords && tab === 'Documents' && <PatientDocuments key={selected.id} selected={selected} data={data} setModal={setModal} notify={notify} commit={commit} />}{tab === 'Activity History' && <AuditTable logs={data.logs.filter(l => l.detail.includes(selected.name) || l.detail.includes(selected.id))} />}</>;
}
