
import React from "react";
import { createPortal } from "react-dom";
import "./ConsultationDecisionModal.css";

function getPatientName(appointment) {
  const patient = appointment?.patient;

  if (typeof patient === "string") return patient;

  return (
    patient?.fullName ||
    patient?.name ||
    [patient?.firstName, patient?.middleName, patient?.lastName]
      .filter(Boolean)
      .join(" ") ||
    "Selected patient"
  );
}

function getAppointmentDate(appointment) {
  return appointment?.date || appointment?.appointmentDate || "Not specified";
}

function getAppointmentTime(appointment) {
  return appointment?.time || appointment?.appointmentTime || "Not specified";
}

function getAppointmentReference(appointment) {
  return appointment?.displayReference || "Not available";
}

export default function ConsultationDecisionModal({
  appointment,
  record,
  confirming = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  if (!appointment || !record || typeof document === "undefined") {
    return null;
  }

  const status = String(appointment.status || "").toLowerCase();
  const isScheduled = status === "scheduled";
  const isCompleted = status === "completed";

  if (!isScheduled && !isCompleted) {
    return null;
  }

  const title = isScheduled
    ? "Save and complete appointment?"
    : "Save consultation?";

  const description = isScheduled
    ? "Saving this consultation will also mark the linked appointment as Completed. Review the details before confirming."
    : "This appointment is already Completed. Saving this consultation will not change the appointment status.";

  const confirmLabel = isScheduled ? "Save and Complete" : "Confirm and Save";

  return createPortal(
    <div className="consultation-decision-backdrop">
      <section
        className="consultation-decision-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consultation-decision-title"
        aria-describedby="consultation-decision-description"
      >
        <div
          className={`consultation-decision-icon ${
            isScheduled ? "is-warning" : "is-success"
          }`}
          aria-hidden="true"
        >
          {isScheduled ? "!" : "✓"}
        </div>

        <h2 id="consultation-decision-title">{title}</h2>

        <p
          id="consultation-decision-description"
          className="consultation-decision-description"
        >
          {description}
        </p>

        <div className="consultation-decision-details">
          <div className="consultation-decision-detail">
            <span>Patient</span>
            <strong>{getPatientName(appointment)}</strong>
          </div>

          <div className="consultation-decision-detail">
            <span>Appointment reference</span>
            <strong className="consultation-decision-reference">
              {getAppointmentReference(appointment)}
            </strong>
          </div>

          <div className="consultation-decision-detail">
            <span>Appointment date</span>
            <strong>{getAppointmentDate(appointment)}</strong>
          </div>

          <div className="consultation-decision-detail">
            <span>Appointment time</span>
            <strong>{getAppointmentTime(appointment)}</strong>
          </div>

          <div className="consultation-decision-detail">
            <span>Appointment status</span>
            <strong
              className={`consultation-decision-status ${
                isScheduled ? "is-scheduled" : "is-completed"
              }`}
            >
              {appointment.status}
            </strong>
          </div>

          <div className="consultation-decision-detail">
            <span>Consultation type</span>
            <strong>{record.type || "Consultation"}</strong>
          </div>
        </div>

        {isScheduled && (
          <div className="consultation-decision-notice">
            <strong>Before you continue</strong>
            <p>
              Saving this consultation will also attempt to mark the linked
              appointment as Completed. Please review the details before
              continuing.
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="consultation-decision-notice is-info">
            <strong>Appointment already completed</strong>
            <p>
              Only the consultation record will be saved. The appointment will
              remain Completed.
            </p>
          </div>
        )}

        {error && (
          <div className="consultation-decision-error" role="alert">
            {error}
          </div>
        )}

        <div className="consultation-decision-actions">
          <button
            type="button"
            className="consultation-decision-cancel"
            onClick={onCancel}
            disabled={confirming}
          >
            Cancel
          </button>

          <button
            type="button"
            className="consultation-decision-confirm"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
