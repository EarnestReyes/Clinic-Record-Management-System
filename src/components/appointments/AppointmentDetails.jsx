import React, { useEffect, useState } from "react";
import Badge from "../common/Badge.jsx";
import { dateLabel } from "../../utils/helpers";
import { appointmentActions } from '../../utils/appointmentActions.js';
import {
  CalendarDays,
  Check,
  X
} from "lucide-react";

export default function AppointmentDetails({
  personCell,
  patient,
  modal,
  addAppointment,
  setModal,
  updateAppointment,
  user
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  if (!modal?.item) {
    return null;
  }

  const appointment = modal.item;
  const actions = appointmentActions(appointment, user, now);
  const isCompleted = appointment.status === "Completed";

  const reschedule = () => {
    addAppointment(appointment.patientId, {
      ...appointment,
      reschedule: true
    });
  };

  const confirmAction = (title, text, status, confirmation = {}) => {
    setModal({
      type: "confirm",
      title,
      text,
      action: () => updateAppointment(appointment, status, confirmation)
    });
  };

  return (
    <div className="modal-body">
      <div className="row-between">
        {personCell(patient(appointment.patientId))}
        <Badge>{appointment.status}</Badge>
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
    ) : !actions.manage ? (
      <p className="muted">
        You do not have permission to manage this appointment.
      </p>
    ) : (
      <>
        {actions.reschedule && patient(appointment.patientId) && (
          <button
            type="button"
            className="btn secondary"
            onClick={reschedule}
          >
            <CalendarDays size={15} />
            Reschedule appointment
          </button>
        )}
        {actions.reschedule && !patient(appointment.patientId) && <p className="muted">Ask intake to route this patient before rescheduling.</p>}

        {actions.complete && (
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

        {actions.cancel && (
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
        {appointment.status === 'Scheduled' && <button
          type="button"
          className="btn secondary"
          disabled={!actions.noShow}
          title={!actions.noShow ? 'Available after the 10-minute grace period' : undefined}
          onClick={() => confirmAction(
            'Confirm No Show?',
            'Confirm that this appointment was confirmed and the patient did not arrive, check in, or attend. Do not confirm No Show if attendance is uncertain.',
            'No Show',
            { confirmNoAttendance: true }
          )}
        >Confirm No Show</button>}
      </>
    )}
      </div>
    </div>
  );
}
