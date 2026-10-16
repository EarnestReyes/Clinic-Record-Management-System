import { displayIdentity } from '../../../shared/displayIdentity.js';
import React from "react";
import useTableSort, { sortDate } from "../../utils/useTableSort.jsx";
import { displayDate, exportTable } from '../../../shared/exportTables.js';
import { clinicDate } from '../../../shared/reportAnalytics.js';
import Empty from "../common/Empty.jsx";
export default function ReportTable({
  rows,
  patient,
  sortingTable,
  reportType,
  serverSide = false
}) {
  const localTable = useTableSort('date', 'desc');
  const table = sortingTable || localTable;
  const sorted = serverSide ? rows : table.sort(rows, (r, key) => key === 'date' ? sortDate(r.created || r.date)
    : key === 'person' ? r.name || r.actor || patient(r.patientId)?.name
    : key === 'details' ? r.diagnosis || r.type || r.action || r.status : key === 'id' ? displayIdentity(r) : r[key]);
  const type = { Patients: 'patients', Consultations: 'consultations', Appointments: 'appointments', 'Clinic Activity': 'activity' }[reportType];
  const printTable = type ? exportTable(type, sorted, patient) : null;
  return rows.length ? <div className="table-scroll">
    <table className={printTable ? 'report-screen-records' : ''}>
      <thead>
        <tr>
          {table.header('id', 'Record ID')}
          {table.header('person', serverSide && ['Appointments', 'Consultations'].includes(reportType) ? 'Patient ID' : 'Patient / Actor')}
          {table.header('date', 'Date')}
          {table.header('details', 'Details')}
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => <tr key={r.id}>
          <td>
            {displayIdentity(r)}
          </td>
          <td>
            {r.name || r.actor || (serverSide ? r.patientId : patient(r.patientId)?.name)}
          </td>
          <td>
            {displayDate(clinicDate(r.created || r.date))}
          </td>
          <td>
            {r.diagnosis || r.type || r.action || r.status}
          </td>
        </tr>)}
      </tbody>
    </table>
    {printTable && <table className="report-print-records"><thead><tr>{printTable.columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{printTable.rows.map((row, index) => <tr key={index}>{printTable.columns.map(column => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table>}
  </div> : <Empty />;
}
