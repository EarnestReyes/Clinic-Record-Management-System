import React from "react";
import Badge from "../common/Badge.jsx";
import { dateLabel } from "../../utils/helpers";
import { CalendarDays } from "lucide-react";
import { statuses } from "../../data/formFields.js";
export default function AppointmentDetails({
  personCell,
  patient,
  modal,
  addAppointment,
  setModal,
  updateAppointment
}) {
  return <div className="modal-body">
    <div className="row-between">
      {personCell(patient(modal.item.patientId))}
      <Badge>
        {modal.item.status}
      </Badge>
    </div>
    <div className="detail-grid">
      {[['Appointment', modal.item.type], ['Date', dateLabel(modal.item.date)], ['Time', modal.item.time], ['Attending staff', modal.item.staff], ['Notes', modal.item.notes || 'No additional notes']].map(([k, v]) => <div key={k}>
        <small>
          {k}
        </small>
        <strong>
          {v}
        </strong>
      </div>)}
    </div>
    <div className="appointment-detail-actions">
      <button className="btn secondary" onClick={() => addAppointment(modal.item.patientId, modal.item)}><CalendarDays size={15} />Reschedule / edit</button>
      {statuses.filter(s => s !== modal.item.status).map(s => <button key={s} className={`btn ${s === 'Cancelled' ? 'danger' : 'secondary'}`} onClick={() => s === 'Cancelled' ? setModal({
        type: 'confirm',
        title: 'Cancel appointment?',
        text: 'The appointment will remain in the patient’s history.',
        action: () => updateAppointment(modal.item, s)
      }) : updateAppointment(modal.item, s)}>
        {s === 'Confirmed' ? 'Confirm' : s === 'Completed' ? 'Complete' : s === 'Cancelled' ? 'Cancel appointment' : s === 'No Show' ? 'Mark no show' : 'Mark pending'}
      </button>)}
    </div>
  </div>;
}
