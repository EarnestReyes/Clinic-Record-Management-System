import React from "react";
import Form from "../common/Form.jsx";
import { statuses } from "../../data/formFields.js";
import { today } from "../../utils/helpers";
export default function AppointmentForm({
  active,
  modal,
  setModal,
  notify,
  data,
  commit,
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
    name: 'type',
    label: 'Appointment type',
    options: ['General check-up', 'Follow-up', 'Consultation', 'Vaccination', 'Laboratory review']
  }, {
    name: 'date',
    label: 'Date',
    type: 'date',
    required: true
  }, {
    name: 'time',
    label: 'Time',
    type: 'time',
    required: true
  }, {
    name: 'staff',
    label: 'Attending staff',
    options: data.users.filter(u => u.active).map(u => 'Dr. ' + u.name),
    required: true
  }, {
    name: 'status',
    label: 'Status',
    options: statuses
  }, {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    wide: true
  }]} 
    values={modal.item || {
    patientId: modal.patientId || active[0]?.id,
    date: modal.date || today(),
    time: '09:00',
    staff: data.users.find(u => u.active) ? 'Dr. ' + data.users.find(u => u.active).name : '',
    status: 'Pending'
  }} 
    submit={modal.item ? 'Update appointment' : 'Schedule appointment'} 
    onCancel={() => setModal(null)} 
    onSave={v => {
    if (!active.length) return notify('Add an active patient first');
    const clash = data.appointments.some(a => a.id !== modal.item?.id && a.date === v.date && a.time === v.time && a.staff.trim().toLowerCase() === v.staff.trim().toLowerCase() && !['Cancelled', 'No Show'].includes(a.status));
    if (clash) return notify('This staff member already has an appointment at that time');
    const a = {
      ...v,
      id: modal.item?.id || 'APT-' + Date.now()
    };
    return commit('appointments', modal.item ? data.appointments.map(x => x.id === a.id ? a : x) : [...data.appointments, a], modal.item ? 'Appointment changed' : 'Appointment scheduled', patient(v.patientId)?.name + ' · ' + a.id);
  }} 
  />;
}
