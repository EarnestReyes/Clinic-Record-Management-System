import React from "react";
import Form from "../common/Form.jsx";
import { today } from "../../utils/helpers";
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
  return <Form 
    fields={[{
    name: 'patientId',
    label: 'Patient',
    required: true,
    options: active.map(p => ({
      value: p.id,
      label: p.name + ' · ' + p.id
    }))
  }, {
    name: 'date',
    label: 'Visit date',
    type: 'date',
    required: true,
    max: today()
  }, {
    name: 'type',
    label: 'Visit type',
    options: ['General consultation', 'Follow-up', 'Routine examination', 'Urgent visit']
  }, {
    name: 'staff',
    label: 'Attending staff',
    required: true
  }, {
    name: 'bp',
    label: 'Blood pressure (mmHg)',
    placeholder: '120/80'
  }, {
    name: 'pulse',
    label: 'Pulse (bpm)',
    type: 'number',
    min: 0,
    max: 300
  }, {
    name: 'temperature',
    label: 'Temperature (°C)',
    type: 'number',
    min: 20,
    max: 50,
    step: '0.1'
  }, {
    name: 'oxygen',
    label: 'SpO₂ (%)',
    type: 'number',
    min: 0,
    max: 100
  }, {
    name: 'weight',
    label: 'Weight (kg)',
    type: 'number',
    min: 0,
    step: '0.1'
  }, {
    name: 'height',
    label: 'Height (cm)',
    type: 'number',
    min: 0,
    max: 300
  }, {
    name: 'complaint',
    label: 'Chief complaint',
    required: true,
    wide: true
  }, {
    name: 'symptoms',
    label: 'Symptoms',
    type: 'textarea',
    wide: true
  }, {
    name: 'diagnosis',
    label: 'Assessment / Diagnosis',
    type: 'textarea',
    required: true,
    wide: true
  }, {
    name: 'treatment',
    label: 'Treatment / Plan',
    type: 'textarea',
    required: true,
    wide: true
  }, {
    name: 'notes',
    label: 'Clinical notes',
    type: 'textarea',
    wide: true
  }]} 
    values={{
    patientId: modal.patientId || active[0]?.id,
    date: today(),
    staff: user.name
  }} 
    submit="Save consultation" 
    onCancel={() => setModal(null)} 
    onSave={v => {
    if (!active.length) return notify('Add an active patient first');
    commit('consultations', [{
      ...v,
      id: 'MR-' + Date.now()
    }, ...data.consultations], 'Consultation created', patient(v.patientId)?.name + ' · ' + v.diagnosis);
  }} 
  />;
}
