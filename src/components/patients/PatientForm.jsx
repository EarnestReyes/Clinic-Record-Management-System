
import React from "react";
import Form from "../common/Form.jsx";
import { patientFields } from "../../data/formFields.js";
import { today } from "../../utils/helpers";
import { doctorsFor, doctorLabel } from '../../utils/doctors.js';

export default function PatientForm({
  modal,
  setModal,
  data,
  commit,
  user
}) {
  const intake = user?.role === 'Clinic Staff' && user?.permissions?.intake === true;
  const routing = user?.role === 'Administrator' || intake;
  const fields = patientFields.filter(field => user?.role === 'Administrator' || !['conditions', 'notes'].includes(field.name)).concat(routing ? [{
    name: 'assignedStaffId', label: 'Route to doctor',
    options: [{ value: '', label: 'Not assigned yet' }, ...doctorsFor(data).map(doctor => ({
      value: doctor.id, label: doctorLabel(doctor, data.specialties)
    }))]
  }] : []);

  return (
    <>
    {intake && <p className="info-banner">Search Patient Management before registering a new patient. Save intake and routing here, then use Schedule on the patient profile to confirm an appointment with the doctor.</p>}
    <Form
      fields={fields}
      values={modal.item}
      submit={modal.item ? "Save patient" : "Create patient"}
      onCancel={() => setModal(null)}
      onSave={v => {
        const duplicate = data.patients.find(patient => patient.id !== modal.item?.id
          && patient.name.trim().toLowerCase() === v.name.trim().toLowerCase() && patient.dob === v.dob);
        if (duplicate) throw new Error(`This patient is already registered (${duplicate.id}). Open the existing record instead.`);
        const year = new Date().getFullYear();

        const id =
          modal.item?.id ||
          `P-${year}-${String(
            Math.max(
              0,
              ...data.patients
                .filter(p => p.id.startsWith(`P-${year}-`))
                .map(p => Number(p.id.split("-")[2]))
            ) + 1
          ).padStart(4, "0")}`;

        const p = {
          ...modal.item,
          ...v,
          id,
          status: modal.item?.status || "Active",
          created: modal.item?.created || today()
        };
        if (user?.role !== 'Administrator') { delete p.conditions; delete p.notes; }
        if (!routing) { delete p.assignedStaffId; delete p.assignedStaff; }

        return commit(
          "patients",
          modal.item
            ? data.patients.map(x => x.id === id ? p : x)
            : [...data.patients, p],
          modal.item ? "Patient edited" : "Patient created",
          p.name + " · " + id
        );
      }}
    />
    </>
  );
}
