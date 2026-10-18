
import React, { useMemo, useState } from "react";
import Form from "../common/Form.jsx";
import ConsultationDecisionModal from "./ConsultationDecisionModal.jsx";

const VITAL_FIELDS = [
  { key: "bp", label: "Blood Pressure", placeholder: "e.g. 120/80" },
  { key: "pulse", label: "Pulse Rate", placeholder: "e.g. 72 bpm" },
  { key: "temperature", label: "Temperature", placeholder: "e.g. 36.5 °C" },
  { key: "oxygen", label: "Oxygen Saturation", placeholder: "e.g. 98%" },
  { key: "weight", label: "Weight", placeholder: "e.g. 65 kg" },
  { key: "height", label: "Height", placeholder: "e.g. 170 cm" },
];

function getId(value) {
  if (value && typeof value === "object") {
    return value._id || value.id || "";
  }

  return value || "";
}

function sameId(first, second) {
  const a = String(getId(first));
  const b = String(getId(second));

  return Boolean(a && b && a === b);
}

function getPatientName(patient) {
  if (!patient) return "Unknown patient";
  if (typeof patient === "string") return patient;

  return (
    patient.fullName ||
    patient.name ||
    [
      patient.firstName,
      patient.middleName,
      patient.lastName,
    ].filter(Boolean).join(" ") ||
    "Unnamed patient"
  );
}

function getAppointmentDate(appointment) {
  return appointment?.date || appointment?.appointmentDate || "";
}

function getAppointmentTime(appointment) {
  return appointment?.time || appointment?.appointmentTime || "";
}

function getAppointmentPatientId(appointment) {
  return (
    appointment?.patientId?._id ||
    appointment?.patientId?.id ||
    appointment?.patientId ||
    appointment?.patient?._id ||
    appointment?.patient?.id ||
    ""
  );
}

function getAppointmentStaffId(appointment) {
  return (
    appointment?.staffId?._id ||
    appointment?.staffId?.id ||
    appointment?.staffId ||
    appointment?.clinicianId?._id ||
    appointment?.clinicianId?.id ||
    appointment?.clinicianId ||
    ""
  );
}

function getConsultationAppointmentId(consultation) {
  return (
    consultation?.appointmentId?._id ||
    consultation?.appointmentId?.id ||
    consultation?.appointmentId ||
    ""
  );
}



//

function appointmentLabel(appointment) {
  const reference =
    appointment.displayReference || "Appointment";
  const date = getAppointmentDate(appointment);
  const time = getAppointmentTime(appointment);
  const status = String(appointment.status || "")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());

  return [
    reference,
    date || "No date",
    time || "No time",
    status,
  ].join("  |  ");
}




function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toFormField(field) {
  const name = field.name || field.key;

  return {
    ...field,
    name,
    label: field.label || name,
    type: field.type || "text",
  };
}

export default function ConsultationForm({
  active = [],
  modal,
  user,
  setModal,
  notify,
  data = {},
  saveConsultation,
}) {
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");

  const specialty = useMemo(
    () =>
      (data.specialties || []).find(
        (item) => item.key === user?.permissions?.specialty
      ),
    [data.specialties, user?.permissions?.specialty]
  );

  const today = localDateString();

  
console.log("Logged-in user:", user);
console.log("Assigned specialty:", specialty);
console.log("All appointments:", data.appointments);
console.log(
  "Appointments for selected staff and specialty:",
  (data.appointments || []).map((appointment) => ({
    id: appointment._id || appointment.id,
    patientId: getAppointmentPatientId(appointment),
    staffId: getAppointmentStaffId(appointment),
    appointmentSpecialty: appointment.specialty,
    status: appointment.status,
    date: getAppointmentDate(appointment),
  }))
);

  // Keep only appointments assigned to this staff member,
  // matching their specialty and an eligible status.
  const appointments = useMemo(() => {
    return (data.appointments || [])
      .filter((appointment) => {
        const status = String(appointment.status || "").toLowerCase();

        return (
          sameId(
            getAppointmentStaffId(appointment),
            user?._id || user?.id
          ) &&
          appointment.specialty === specialty?.key &&
          ["scheduled", "completed"].includes(status)
        );
      })
      .sort((a, b) => {
        const dateA =
          `${getAppointmentDate(a)} ${getAppointmentTime(a)}`;
        const dateB =
          `${getAppointmentDate(b)} ${getAppointmentTime(b)}`;

        return dateB.localeCompare(dateA);
      });
  }, [data.appointments, user, specialty]);

  const patientOptions = useMemo(
    () =>
      active.map((patient) => ({
        value: String(getId(patient._id || patient.id)),
        label: getPatientName(patient),
      })),
    [active]
  );

  // Build options from the selected patient.
  // The Form component passes current form values to optionsFor.
  const getAppointmentOptions = (formValues) => {

    
console.log(
  "Patient options:",
  patientOptions
);

console.log(
  "Appointment patient IDs:",
  appointments.map((appointment) => ({
    appointmentId: appointment.id,
    patientId: getAppointmentPatientId(appointment),
  }))
);

    const selectedPatientId = getId(formValues.patientId);

    if (!selectedPatientId) return [];

    return appointments
      .filter((appointment) =>
        sameId(
          getAppointmentPatientId(appointment),
          selectedPatientId
        )
      )
      .map((appointment) => ({
        value: String(getId(appointment._id || appointment.id)),
        label: appointmentLabel(appointment),
      }));
  };

  const specialtyFields = useMemo(
    () => (specialty?.fields || []).map(toFormField),
    [specialty]
  );

  if (!user?.permissions?.createConsultation || !specialty) {
    return (
      <div className="consultation-form">
        <p>
          You do not have permission to create a consultation
          for an assigned specialty.
        </p>
      </div>
    );
  }

  const closeConfirmation = () => {
    if (confirming) return;

    setPendingConfirmation(null);
    setConfirmationError("");
  };

  const confirmAndSave = async () => {
    if (!pendingConfirmation || confirming) return;

    const { record, appointment } = pendingConfirmation;
    const status = String(appointment.status || "").toLowerCase();

    if (!["scheduled", "completed"].includes(status)) {
      setConfirmationError(
        "This appointment is no longer Scheduled or Completed. Refresh and try again."
      );
      return;
    }

    setConfirming(true);
    setConfirmationError("");

    try {
      const result = await saveConsultation(
        record,
        appointment,
        { completeAppointment: status === "scheduled" }
      );

      if (result === false) {
        setConfirmationError(
          "The consultation was not saved. Review the error notification before trying again."
        );
        return;
      }

      setPendingConfirmation(null);
    } catch (error) {
      setConfirmationError(
        error?.message ||
          "An error occurred while saving the consultation."
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleFormSave = (values) => {
    const patientId = getId(values.patientId);
    const appointmentId = getId(values.appointmentId);

    if (!patientId) {
      notify?.("Please select a patient.", "error");
      return false;
    }

    if (!appointmentId) {
      notify?.("Please select an appointment.", "error");
      return false;
    }

    const patient = active.find((item) =>
      sameId(item._id || item.id, patientId)
    );

    const appointment = appointments.find((item) =>
      sameId(item._id || item.id, appointmentId)
    );

    if (!patient || !appointment) {
      notify?.(
        "The selected patient or appointment could not be found. Refresh and try again.",
        "error"
      );
      return false;
    }

    if (
      !sameId(getAppointmentPatientId(appointment), patientId)
    ) {
      notify?.(
        "The selected appointment does not belong to this patient.",
        "error"
      );
      return false;
    }

    if (
      !sameId(
        getAppointmentStaffId(appointment),
        user?._id || user?.id
      )
    ) {
      notify?.("You are not assigned to this appointment.", "error");
      return false;
    }

    if (appointment.specialty !== specialty.key) {
      notify?.(
        "This appointment does not match your assigned specialty.",
        "error"
      );
      return false;
    }

    // Prevent duplicate consultation records.
    const existingConsultation = (data.consultations || []).find(
      (consultation) =>
        sameId(
          getConsultationAppointmentId(consultation),
          appointmentId
        )
    );

    if (existingConsultation) {
      notify?.(
        `A consultation already exists for this appointment (Record ID: ${
          existingConsultation.displayReference ||
          existingConsultation.id ||
          existingConsultation._id ||
          "existing record"
        }). Open Medical Records to review it instead.`,
        "error"
      );
      return false;
    }

    const status = String(appointment.status || "").toLowerCase();
    const appointmentDate = getAppointmentDate(appointment);

    if (!["scheduled", "completed"].includes(status)) {
      notify?.(
        "Only Scheduled or Completed appointments can be linked to a consultation.",
        "error"
      );
      return false;
    }

    if (status === "scheduled" && appointmentDate > today) {
      notify?.(
        "You cannot create a consultation for a future appointment.",
        "error"
      );
      return false;
    }

    const consultationType =
      String(values.type || "").trim() ||
      "General consultation";

    const record = {
      patientId,
      appointmentId,
      date: today,
      appointmentDate,
      type: consultationType,
      specialty: specialty.key,
      details: {},
    };

    Object.entries(values).forEach(([key, value]) => {
      if (
        ["patientId", "appointmentId", "date", "type"].includes(key) ||
        value === undefined
      ) {
        return;
      }

      if (key.startsWith("detail_")) {
        record.details[key.slice("detail_".length)] = value;
      } else {
        record[key] = value;
      }
    });

    setConfirmationError("");
    setPendingConfirmation({ record, appointment });

    return true;
  };

  const fields = [
      {
      name: "patientId",
      label: "Patient",
      type: "select",
      required: true,
      options: patientOptions,
      placeholder: "Select a patient",
    },
    {
      name: "appointmentId",
      label: "Appointment",
      type: "select",
      required: true,
      dependsOn: "patientId",
      optionsFor: getAppointmentOptions,
      placeholder: "Select an appointment",
    },
    {
      name: "type",
      label: "Visit Type",
      type: "select",
      required: true,
      options: [
        "General consultation",
        "Follow-up",
        "Routine examination",
        "Urgent visit",
      ],
      defaultValue: "General consultation",
    },

    ...VITAL_FIELDS.map((field) => ({
      name: `detail_${field.key}`,
      label: field.label,
      type: "text",
      placeholder: field.placeholder,
    })),

    ...specialtyFields.map((field) => ({
      ...field,
      name: field.name.startsWith("detail_")
        ? field.name
        : `detail_${field.name}`,
    })),

    {
      name: "complaint",
      label: "Chief Complaint",
      type: "textarea",
      required: true,
    },
    {
      name: "symptoms",
      label: "Symptoms",
      type: "textarea",
    },
    {
      name: "diagnosis",
      label: "Clinical Findings / Diagnosis",
      type: "textarea",
      required: true,
    },
    {
      name: "treatment",
      label: "Treatment / Management Plan",
      type: "textarea",
    },
    {
      name: "followUp",
      label: "Follow-up Instructions",
      type: "textarea",
    },
    {
      name: "notes",
      label: "Additional Notes",
      type: "textarea",
    },
  ];

  return (
    <div className="consultation-form">
      <Form
        key={modal?.key || "consultation-form"}
        fields={fields}
        values={{ type: "General consultation" }}
        onSave={handleFormSave}
        onCancel={() => setModal(null)}
        submit="Review Consultation"
      />

      {pendingConfirmation && (
        <ConsultationDecisionModal
          appointment={pendingConfirmation.appointment}
          record={pendingConfirmation.record}
          confirming={confirming}
          error={confirmationError}
          onConfirm={confirmAndSave}
          onCancel={closeConfirmation}
        />
      )}
    </div>
  );
}
