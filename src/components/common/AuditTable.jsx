import React from "react";
import useTableSort, { sortDate } from "../../utils/useTableSort.jsx";
import Empty from "./Empty.jsx";
export default function AuditTable({
  logs, sortingTable
}) {
  const localTable = useTableSort('date', 'desc');
  const table = sortingTable || localTable;
  const rows = table.sort(logs, (row, key) => key === 'date' ? sortDate(row.date) : row[key]);
  return logs.length ? <div className="table-scroll bounded-table" tabIndex={0} role="region" aria-label="Audit log table">
    <table>
      <thead>
        <tr>
          {table.header('action', 'Action')}
          {table.header('detail', 'Details')}
          {table.header('actor', 'Performed by')}
          {table.header('date', 'Date & time')}
        </tr>
      </thead>
      <tbody>
        {rows.map(l => <tr key={l.id}>
          <td>
            <span className="audit-action">
              <span className="mini-dot teal-dot" />
              {l.action}
            </span>
          </td>
          <td>
            {l.detail}
          </td>
          <td>
            {l.actor}
          </td>
          <td>
            {new Date(l.date).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </td>
        </tr>)}
      </tbody>
    </table>
  </div> : <Empty title="No activity yet" />;
}
