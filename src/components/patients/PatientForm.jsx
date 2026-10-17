
import React from "react";
import Form from "../common/Form.jsx";
import { patientFields } from "../../data/formFields.js";
import { today } from "../../utils/helpers";

export default function PatientForm({
  modal,
  setModal,
  data,
  commit,
  user
}) {
  const intake = user?.role === 'Clinic Staff' && user?.permissions?.intake === true;
  const fields = patientFields.filter(field => user?.role === 'Administrator' || !['conditions', 'notes'].includes(field.name));

  return (
    <>
    {intake && <p className="info-banner">Search Patient Management before registering a new patient. Register intake details here. Choose the department and attending doctor when scheduling an appointment.</p>}
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
        // Legacy fields stay on existing records; new registrations never assign a doctor.
        if (!modal.item) { delete p.assignedStaffId; delete p.assignedStaff; }

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
