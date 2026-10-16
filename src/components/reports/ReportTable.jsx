import React from "react";
import useTableSort, { sortDate } from "../../utils/useTableSort.jsx";
import { dateLabel } from "../../utils/helpers";
import Empty from "../common/Empty.jsx";
export default function ReportTable({
  rows,
  patient,
  sortingTable
}) {
  const localTable = useTableSort('date', 'desc');
  const table = sortingTable || localTable;
  const sorted = table.sort(rows, (r, key) => key === 'date' ? sortDate(r.created || r.date)
    : key === 'person' ? r.name || r.actor || patient(r.patientId)?.name
    : key === 'details' ? r.diagnosis || r.type || r.action || r.status : r[key]);
  return rows.length ? <div className="table-scroll">
    <table>
      <thead>
        <tr>
          {table.header('id', 'Record ID')}
          {table.header('person', 'Patient / Actor')}
          {table.header('date', 'Date')}
          {table.header('details', 'Details')}
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => <tr key={r.id}>
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
