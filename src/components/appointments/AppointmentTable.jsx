import React from "react";
import { dateLabel } from "../../utils/helpers";
import { Clock, MoreHorizontal } from "lucide-react";
import Badge from "../common/Badge.jsx";
import Empty from "../common/Empty.jsx";

function clinicNow() {
const parts = new Intl.DateTimeFormat("en-CA", {
timeZone: "Asia/Manila",
year: "numeric",
month: "2-digit",
day: "2-digit",
hour: "2-digit",
minute: "2-digit",
hourCycle: "h23"
}).formatToParts(new Date());

const values = Object.fromEntries(
parts.map(part => [part.type, part.value])
);

return {
  date: `${values.year}-${values.month}-${values.day}`,
  time: `${values.hour}:${values.minute}`
};
}

function normalizeDate(value) {
if (!value) return "";

const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);

return match ? match[1] : "";
}

function appointmentHasPassed(appointment, now) {
const appointmentDate = normalizeDate(appointment.date);

if (!appointmentDate) return false;
if (appointmentDate < now.date) return true;
if (appointmentDate > now.date) return false;

return String(appointment.time || "").slice(0, 5) <= now.time;
}

export default function AppointmentTable({
items,
compact,
go,
personCell,
patient,
setModal
}) {
const now = clinicNow();

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
        const hasPassed =
          a.status === "Scheduled" &&
          appointmentHasPassed(a, now);

        const appointmentDate = normalizeDate(a.date);

        return (
          <tr key={a.id || a._id}>
            <td>
              <button
                className="unstyled"
                onClick={() => go("patients/" + a.patientId)}
              >
                {personCell(patient(a.patientId))}
              </button>
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
                {hasPassed ? "No Show" : a.status}
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