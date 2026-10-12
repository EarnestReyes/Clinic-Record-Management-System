import React from "react";
import { dateLabel } from "../../utils/helpers";
import { Clock, MoreHorizontal } from "lucide-react";
import Badge from "../common/Badge.jsx";
import Empty from "../common/Empty.jsx";
export default function AppointmentTable({
  items,
  compact,
  go,
  personCell,
  patient,
  setModal
}) {
  return items.length ? <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Patient</th>
          <th>
            {compact ? 'Time' : 'Date & time'}
          </th>
          <th>Appointment type</th>
          {!compact && <th>Attending staff</th>}
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map(a => <tr key={a.id}>
          <td>
            <button className="unstyled" onClick={() => go('patients/' + a.patientId)}>
              {personCell(patient(a.patientId))}
            </button>
          </td>
          <td>
            <div className="time-cell">
              {!compact && <small>
                {dateLabel(a.date)}
              </small>}
              <span>
                <Clock size={13} />
                {a.time}
              </span>
            </div>
          </td>
          <td>
            {a.type}
          </td>
          {!compact && <td>
            {a.staff}
          </td>}
          <td>
            <Badge>
              {a.status}
            </Badge>
          </td>
          <td>
            <button className="icon-button" aria-label={'Manage appointment ' + a.id} onClick={() => setModal({
              type: 'appointment-detail',
              item: a
            })}>
              <MoreHorizontal size={18} />
            </button>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div> : <Empty title="No appointments" text="Schedule an appointment to get started." />;
}
