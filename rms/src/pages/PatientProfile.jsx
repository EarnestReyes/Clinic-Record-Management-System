import { documents } from '../services/api.js';
import React from "react";
import { ArrowLeft, Pencil, CalendarDays, Plus, ArrowRight, Upload, FileText, Eye, ArrowDownToLine, RotateCcw, Archive } from "lucide-react";
import Avatar from "../components/common/Avatar.jsx";
import Badge from "../components/common/Badge.jsx";
import { age, dateLabel} from "../utils/helpers";
import Card from "../components/common/Card.jsx";
import Empty from "../components/common/Empty.jsx";
import AuditTable from "../components/common/AuditTable.jsx";
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
  return <><button className="text-button back-button" onClick={() => go(selected.status === 'Archived' ? 'archived-records' : 'patients')}><ArrowLeft size={15} />Back to patients</button><div className="profile-banner">
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
        <button className="btn secondary" onClick={() => addPatient(selected)}><Pencil size={15} />Edit patient</button>
        {selected.status === 'Active' && <><button className="btn secondary" onClick={() => addAppointment(selected.id)}><CalendarDays size={15} />Schedule</button><button className="btn primary" onClick={() => addConsultation(selected.id)}><Plus size={15} />Consultation</button></>}
      </div>
    </div><div className="tabs">
      {['Overview', 'Visit History', 'Medical Records', 'Appointments', 'Documents', 'Activity History'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
        {t}
      </button>)}
    </div>{tab === 'Overview' && <div className="profile-grid">
      <div>
        <Card title="Personal information" subtitle="The essentials for thoughtful care">
          <div className="detail-grid">
            {[['Date of birth', dateLabel(selected.dob)], ['Gender', selected.gender], ['Email', selected.email || 'Not provided'], ['Phone', selected.phone], ['Address', selected.address || 'Not provided'], ['Blood group', selected.blood], ['Emergency contact', selected.emergencyName || 'Not provided'], ['Emergency phone', selected.emergencyPhone || 'Not provided']].map(([k, v]) => <div key={k}>
              <small>
                {k}
              </small>
              <strong>
                {v}
              </strong>
            </div>)}
          </div>
        </Card>
        <Card title="Recent visits" action={<button className="text-button" onClick={() => setTab('Visit History')}>View history<ArrowRight size={15} /></button>}>
          {recordList(data.consultations.filter(r => r.patientId === selected.id).slice(0, 3))}
        </Card>
      </div>
      <div>
        <Card title="Health overview">
          <div className="health-note">
            <span>ALLERGIES</span>
            <p>
              {selected.allergies || 'None known'}
            </p>
          </div>
          <div className="health-note">
            <span>EXISTING CONDITIONS</span>
            <p>
              {selected.conditions || 'None recorded'}
            </p>
          </div>
          <div className="health-note neutral">
            <span>NOTES</span>
            <p>
              {selected.notes || 'No additional notes'}
            </p>
          </div>
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
    </div>}{['Visit History', 'Medical Records'].includes(tab) && <Card title={tab} subtitle="A continuous story of patient care">
      {recordList(data.consultations.filter(r => r.patientId === selected.id).sort((a, b) => b.date.localeCompare(a.date)))}
    </Card>}{tab === 'Appointments' && <Card title="Patient appointments" action={selected.status === 'Active' && <button className="btn primary" onClick={() => addAppointment(selected.id)}><Plus size={15} />Schedule</button>}>
      {appointmentTable(data.appointments.filter(a => a.patientId === selected.id))}
    </Card>}{tab === 'Documents' && <Card title="Patient documents" subtitle="Private patient documents, stored securely in your clinic database" action={<button className="btn primary" onClick={() => setModal({
      type: 'upload',
      patientId: selected.id
    })}><Upload size={15} />Upload document</button>}>
      <div className="document-grid">
        {data.documents.filter(d => d.patientId === selected.id).map(d => <div className="document-card" key={d.id}>
          <span className="document-icon">
            <FileText size={25} />
          </span>
          <Badge>
            {d.status}
          </Badge>
          <h3>
            {d.name}
          </h3>
          <p>{d.type} · {dateLabel(d.date)}</p>
          <div className="row">
            <button className="text-button" onClick={() => setModal({
              type: 'document',
              item: d
            })}><Eye size={15} />Preview</button>
            <button className="icon-button" title="Download document" onClick={async () => {
              try { await documents.download(d); notify('Document downloaded'); } catch (error) { notify(error.message); }
            }}>
              <ArrowDownToLine size={16} />
            </button>
            <button className="icon-button" title={d.status === 'Archived' ? 'Restore document' : 'Archive document'} onClick={() => setModal({
              type: 'confirm',
              title: d.status === 'Archived' ? 'Restore document?' : 'Archive document?',
              text: d.name + ' will be preserved in this patient’s document history.',
              action: () => commit('documents', data.documents.map(x => x.id === d.id ? {
                ...x,
                status: d.status === 'Active' ? 'Archived' : 'Active'
              } : x), 'Document ' + (d.status === 'Active' ? 'archived' : 'restored'), selected.name + ' · ' + d.name)
            })}>
              {d.status === 'Archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
            </button>
          </div>
        </div>)}
      </div>
      {!data.documents.some(d => d.patientId === selected.id) && <Empty title="No documents yet" />}
    </Card>}{tab === 'Activity History' && <AuditTable logs={data.logs.filter(l => l.detail.includes(selected.name) || l.detail.includes(selected.id))} />}</>;
}
