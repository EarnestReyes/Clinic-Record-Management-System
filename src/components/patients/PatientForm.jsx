import React from "react";
import Form from "../common/Form.jsx";
import { patientFields } from "../../data/formFields.js";
import { today } from "../../utils/helpers";
export default function PatientForm({
  modal,
  setModal,
  data,
  commit
}) {
  return <Form 
    fields={patientFields} 
    values={modal.item} 
    submit={modal.item ? 'Save patient' : 'Create patient'} 
    onCancel={() => setModal(null)} 
    onSave={v => {
    const year = new Date().getFullYear();
    const id = modal.item?.id || `P-${year}-${String(Math.max(0, ...data.patients.filter(p => p.id.startsWith(`P-${year}-`)).map(p => Number(p.id.split('-')[2]))) + 1).padStart(4, '0')}`;
    const p = {
      ...modal.item,
      ...v,
      id,
      status: modal.item?.status || 'Active',
      created: modal.item?.created || today()
    };
    return commit('patients', modal.item ? data.patients.map(x => x.id === id ? p : x) : [...data.patients, p], modal.item ? 'Patient edited' : 'Patient created', p.name + ' · ' + id);
  }} 
  />;
}
