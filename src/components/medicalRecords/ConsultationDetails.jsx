import React from "react";
import { dateLabel } from "../../utils/helpers";
import { download } from "../../utils/helpers";
import { ArrowDownToLine } from "lucide-react";

const vitalDefinitions = [['bp', 'Blood pressure', 'mmHg'], ['pulse', 'Pulse', 'bpm'], ['temperature', 'Temperature', '°C'], ['oxygen', 'SpO₂', '%'], ['weight', 'Weight', 'kg'], ['height', 'Height', 'cm']];

// Records made before specialties existed have no "specialty" saved. They are shown as General Practitioner records.
export function recordSpecialty(record, specialties) {
  return specialties.find(function (s) { return s.key === (record.specialty || 'general-practitioner'); });
}

export default function ConsultationDetails({
  personCell,
  patient,
  modal,
  data
}) {
  const record = modal.item;
  const specialty = recordSpecialty(record, data.specialties);
  // The record is shown with the fields of the specialty that WROTE it, even if that person's specialty changed later.
  const specialtyFields = specialty ? specialty.fields : [];
  const details = record.details || {};
  // Old records show every vital; new ones show only the vitals that specialty's form collects.
  const vitals = vitalDefinitions.filter(function (v) { return !record.specialty || !specialty || specialty.vitals.includes(v[0]); });
  const sections = [['Chief complaint', record.complaint], ['Symptoms', record.symptoms]];
  specialtyFields.forEach(function (f) { sections.push([f.label, details[f.name]]); });
  sections.push(['Assessment / Diagnosis', record.diagnosis], ['Treatment / Plan', record.treatment], ['Follow-up recommendations', record.followUp], ['Notes', record.notes]);
  const downloadText = [record.recordType || (specialty ? specialty.recordType : 'Consultation'), 'Record: ' + record.id, 'Patient: ' + (patient(record.patientId)?.name || record.patientId), 'Date: ' + record.date, 'Staff: ' + record.staff]
    .concat(vitals.map(function (v) { return v[1] + ': ' + (record[v[0]] || '—'); }))
    .concat(sections.map(function (s) { return s[0] + ': ' + (s[1] || 'Not recorded'); })).join('\n');
  return <div className="modal-body">
    <div className="row-between">
      {personCell(patient(record.patientId))}
      <span className="record-id">
        {record.id}
      </span>
    </div>
    <p className="muted">{dateLabel(record.date)} · {record.type} · {record.staff}</p>
    <p className="muted">{record.recordType || (specialty ? specialty.recordType : 'General consultation')}</p>
    {vitals.length > 0 && <div className="vitals-grid">
      {vitals.map(([k, label, unit]) => <div key={k}>
        <small>
          {label}
        </small>
        <strong>
          {record[k] || '—'} 
          <span>
            {record[k] && unit}
          </span>
        </strong>
      </div>)}
    </div>}
    {sections.map(([label, value]) => <div className="clinical-section" key={label}>
      <h4>
        {label}
      </h4>
      <p>
        {value || 'Not recorded'}
      </p>
    </div>)}
    <button className="btn secondary" onClick={() => download(record.id + '.txt', downloadText)}><ArrowDownToLine size={16} />Download record</button>
  </div>;
}