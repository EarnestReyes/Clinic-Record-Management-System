import React from "react";
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
setModal
}) {

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
                onClick={() =>
                  setModal({
                    type: "appointment-detail",
                    item: a
                  })
                }
              >
                <MoreHorizontal size={18} />
              </button>
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
