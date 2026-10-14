
import React from "react";
import Badge from "../common/Badge.jsx";
import { dateLabel, today } from "../../utils/helpers";
import {
  CalendarDays,
  Check,
  X,
  CalendarX
} from "lucide-react";

export default function AppointmentDetails({
  personCell,
  patient,
  modal,
  addAppointment,
  setModal,
  updateAppointment
}) {
  const appointment = modal.item;
  const currentDate = today();

  const isScheduled = appointment.status === "Scheduled";
  const isCompleted = appointment.status === "Completed";
  const isCancelled = appointment.status === "Cancelled";
  const isNoShow = appointment.status === "No Show";

  const isPast = appointment.date < currentDate;
  const isFuture = appointment.date > currentDate;
  const isToday = appointment.date === currentDate;

  const displayedStatus =
    isScheduled && isPast ? "No Show" : appointment.status;

  const reschedule = () => {
    addAppointment(appointment.patientId, {
      ...appointment,
      status: "Scheduled",
      reschedule: true
    });
  };

  const confirmAction = (title, text, status) => {
    setModal({
      type: "confirm",
      title,
      text,
      action: () => updateAppointment(appointment, status)
    });
  };

  return (
    <div className="modal-body">
      <div className="row-between">
        {personCell(patient(appointment.patientId))}
        <Badge>{displayedStatus}</Badge>
      </div>

      <div className="detail-grid">
        {[
          ["Appointment", appointment.type],
          ["Date", dateLabel(appointment.date)],
          ["Time", appointment.time],
          ["Attending staff", appointment.staff],
          ["Notes", appointment.notes || "No additional notes"]
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="appointment-detail-actions">
        {isCompleted ? (
          <p className="muted">
            This appointment is completed and permanently locked.
          </p>
        ) : isScheduled && isPast ? (
          <p className="muted">
            This appointment is overdue and must be recorded as No Show.
          </p>
        ) : (
          <>
            {(isScheduled || isCancelled || isNoShow) && (
              <button
                type="button"
                className="btn secondary"
                onClick={reschedule}
              >
                <CalendarDays size={15} />
                Reschedule / edit
              </button>
            )}

            {isScheduled && isToday && (
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  confirmAction(
                    "Complete appointment?",
                    "This action permanently locks the appointment. It cannot be edited or rescheduled afterward.",
                    "Completed"
                  )
                }
              >
                <Check size={15} />
                Complete
              </button>
            )}

            {isScheduled && (isToday || isFuture) && (
              <button
                type="button"
                className="btn danger"
                onClick={() =>
                  confirmAction(
                    "Cancel appointment?",
                    "The appointment will remain in the patient's history and its reserved time slots will be released.",
                    "Cancelled"
                  )
                }
              >
                <X size={15} />
                Cancel appointment
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
