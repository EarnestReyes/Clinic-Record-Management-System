import React from "react";
import Form from "../common/Form.jsx";
import { today } from "../../utils/helpers";

// Every vital sign the system knows. A specialty only shows the ones in its own "vitals" list.
const vitalFields = [
  { name: 'bp', label: 'Blood pressure (mmHg)', placeholder: '120/80' },
  { name: 'pulse', label: 'Pulse (bpm)', type: 'number', min: 0, max: 300 },
  { name: 'temperature', label: 'Temperature (°C)', type: 'number', min: 20, max: 50, step: '0.1' },
  { name: 'oxygen', label: 'SpO₂ (%)', type: 'number', min: 0, max: 100 },
  { name: 'weight', label: 'Weight (kg)', type: 'number', min: 0, step: '0.1' },
  { name: 'height', label: 'Height (cm)', type: 'number', min: 0, max: 300 }
];

// Turns one specialty field from the server's list into a field the shared Form component understands.
// Specialty fields are named "detail_<name>" so they can never clash with the common fields.
function toFormField(f) {
  const field = { name: 'detail_' + f.name, label: f.label, required: !!f.required, wide: true };
  if (f.type === 'textarea') field.type = 'textarea';
  if (f.type === 'date') { field.type = 'date'; field.wide = false; }
  if (f.type === 'number') { field.type = 'number'; field.wide = false; }
  if (f.type === 'select') {
    // The blank first choice makes the browser insist the user really picks one.
    field.options = [{ value: '', label: 'Select…' }].concat(f.options.map(function (o) { return { value: o, label: o }; }));
    field.wide = false;
  }
  return field;
}

export default function ConsultationForm({
  active,
  modal,
  user,
  setModal,
  notify,
  commit,
  data,
  patient
}) {
  // Which form to show comes from the logged-in account's specialty. The server decides it, not the browser.
  const specialty = data.specialties.find(function (s) { return s.key === user.permissions.specialty; });
  if (!user.permissions.createConsultation || !specialty) {
    return <p className="muted">Your account is not assigned a medical specialty that can write consultation records. Ask an administrator to assign one.</p>;
  }
  const specialtyFields = specialty.fields.filter(function (f) { return !f.computed; }).map(toFormField);
  const vitals = vitalFields.filter(function (f) { return specialty.vitals.includes(f.name); });
  const fields = [
    { name: 'patientId', label: 'Patient', required: true, options: active.map(function (p) { return { value: p.id, label: p.name + ' · ' + p.id }; }) },
    { name: 'date', label: 'Visit date', type: 'date', required: true, max: today() },
    { name: 'type', label: 'Visit type', options: ['General consultation', 'Follow-up', 'Routine examination', 'Urgent visit'] }
  ].concat(vitals, [
    { name: 'complaint', label: 'Chief complaint', required: true, wide: true },
    { name: 'symptoms', label: 'Symptoms', type: 'textarea', wide: true }
  ], specialtyFields, [
    { name: 'diagnosis', label: 'Assessment / Diagnosis', type: 'textarea', required: true, wide: true },
    { name: 'treatment', label: 'Treatment / Plan', type: 'textarea', required: true, wide: true },
    { name: 'followUp', label: 'Follow-up recommendations', type: 'textarea', wide: true },
    { name: 'notes', label: 'Clinical notes', type: 'textarea', wide: true }
  ]);
  return <Form 
    fields={fields} 
    values={{
    patientId: modal.patientId || active[0]?.id,
    date: today()
  }} 
    submit={'Save ' + specialty.recordType.toLowerCase()} 
    onCancel={() => setModal(null)} 
    onSave={v => {
    if (!active.length) return notify('Add an active patient first');
    // Split the flat form values into the normal record fields and the specialty "details".
    const record = { id: 'MR-' + Date.now(), specialty: specialty.key, details: {} };
    Object.keys(v).forEach(function (name) {
      if (name.startsWith('detail_')) record.details[name.slice(7)] = v[name];
      else record[name] = v[name];
    });
    return commit('consultations', [record].concat(data.consultations), 'Consultation created', patient(v.patientId)?.name + ' · ' + v.diagnosis);
  }} 
  />;
}