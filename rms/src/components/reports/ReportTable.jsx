import React from "react";
import { dateLabel } from "../../utils/helpers";
import Empty from "../common/Empty.jsx";
export default function ReportTable({
  rows,
  patient
}) {
  return rows.length ? <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Record ID</th>
          <th>Patient / Actor</th>
          <th>Date</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => <tr key={r.id}>
          <td>
            {r.id}
          </td>
          <td>
            {r.name || r.actor || patient(r.patientId)?.name}
          </td>
          <td>
            {dateLabel((r.created || r.date).slice(0, 10))}
          </td>
          <td>
            {r.diagnosis || r.type || r.action || r.status}
          </td>
        </tr>)}
      </tbody>
    </table>
  </div> : <Empty />;
}
