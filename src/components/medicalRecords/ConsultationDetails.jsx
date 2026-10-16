import { displayIdentity } from '../../../shared/displayIdentity.js';
import React from "react";
import { dateLabel } from "../../utils/helpers";
import { saveBlob } from "../../services/api.js";
import ExportButton from "../common/ExportButton.jsx";
import { wordDocument, wordMime } from '../../../shared/wordDocument.js';
import { displayDate } from '../../../shared/exportTables.js';
import { useState } from 'react';

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
  const [exportError, setExportError] = useState('');
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
  return <div className="modal-body">
    <div className="row-between">
      {personCell(patient(record.patientId))}
      <span className="record-id">
        {displayIdentity(record)}
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
    <ExportButton title="Consultation record" label="Download record" recordCount={1} formats={['docx']} onExport={async () => {
      await saveBlob(new Blob([wordDocument({
        title: record.recordType || specialty?.recordType || 'Consultation record', clinic: data.settings, recordCount: 1,
        subtitle: `Record ${displayIdentity(record)} | ${displayDate(record.date)}`,
        sections: [['Patient', patient(record.patientId)?.name || record.patientId], ['Attending staff', record.staff],
          ...vitals.map(([key, label, unit]) => [label, record[key] == null || record[key] === '' ? 'Not recorded' : `${record[key]} ${unit}`]),
          ...sections.map(([label, value]) => [label, value == null || value === '' ? 'Not recorded' : value])]
      })], { type: wordMime }), 'consultation-record.docx');
    }} />
  </div>;
}
