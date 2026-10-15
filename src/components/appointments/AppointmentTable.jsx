import React, { useState } from "react";
import { request } from '../../services/api.js';
import { dateLabel } from "../../utils/helpers";
import { Clock, MoreHorizontal } from "lucide-react";
import Badge from "../common/Badge.jsx";
import Empty from "../common/Empty.jsx";

function normalizeDate(value) {
if (!value) return "";

const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);

return match ? match[1] : "";
}


export default function AppointmentTable({
items,
compact,
go,
personCell,
patient,
setModal,
loadDetails = false
}) {
const [opening, setOpening] = useState('');
const [error, setError] = useState(null);
const openAppointment = async appointment => {
  if (opening) return;
  if (!loadDetails) { setModal({ type: 'appointment-detail', item: appointment }); return; }
  setOpening(appointment.id); setError(null);
  try {
    const detail = await request(`/appointments/${encodeURIComponent(appointment.id)}`);
    if (detail.id !== appointment.id) throw new Error('Appointment details are incomplete. Refresh and try again.');
    setModal({ type: 'appointment-detail', item: detail });
  } catch (failure) { setError({ id: appointment.id, message: failure.message }); }
  finally { setOpening(''); }
};

return items.length ? (
<div className="table-scroll">
<table>
<thead>
<tr>
<th>Patient</th>
<th>{compact ? "Time" : "Date & time"}</th>
<th>Appointment type</th>
{!compact && <th>Attending staff</th>}
<th>Status</th>
<th></th>
</tr>
</thead>

    <tbody>
      {items.map(a => {
        const appointmentDate = normalizeDate(a.date);
        const linkedPatient = patient(a.patientId);

        return (
          <tr key={a.id || a._id}>
            <td>
              {linkedPatient ? <button
                className="unstyled"
                onClick={() => go("patients/" + a.patientId)}
              >
                {personCell(linkedPatient)}
              </button> : <span className="muted">Patient details restricted</span>}
            </td>

            <td>
              <div className="time-cell">
                {!compact && (
                  <small>
                    {appointmentDate
                      ? dateLabel(appointmentDate)
                      : "Date unavailable"}
                  </small>
                )}

                <span>
                  <Clock size={13} />
                  {a.time || "Time unavailable"}
                </span>
              </div>
            </td>

            <td>{a.type || "Not specified"}</td>

            {!compact && <td>{a.staff || "Not assigned"}</td>}

            <td>
              <Badge>
                {a.status}
              </Badge>
            </td>

            <td>
              <button
                className="icon-button"
                aria-label={"Manage appointment " + (a.id || a._id)}
                disabled={Boolean(opening)}
                onClick={() => openAppointment(a)}
              >
                <MoreHorizontal size={18} />
              </button>
              {opening === a.id && <small role="status">Loading appointment…</small>}
              {error?.id === a.id && <small role="alert">{error.message}</small>}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>

) : (
<Empty
   title="No appointments"
   text="Schedule an appointment to get started."
 />
);
}
