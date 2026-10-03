import React from "react";
import Empty from "./Empty.jsx";
export default function AuditTable({
  logs
}) {
  return logs.length ? <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>Details</th>
          <th>Performed by</th>
          <th>Date & time</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(l => <tr key={l.id}>
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
