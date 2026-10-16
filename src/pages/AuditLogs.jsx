import React from "react";
import useTableSort, { sortDate } from "../utils/useTableSort.jsx";
import Card from "../components/common/Card.jsx";
import ExportButton from "../components/common/ExportButton.jsx";
import { Search } from "lucide-react";
import AuditTable from "../components/common/AuditTable.jsx";
export default function AuditLogs({
  data,
  query,
  setQuery
}) {
  const table = useTableSort('date', 'desc');
  const rows = table.sort(data.logs.filter(l => `${l.action} ${l.actor} ${l.detail}`.toLowerCase().includes(query.toLowerCase())), (row, key) => key === 'date' ? sortDate(row.date) : row[key]);
  return <Card title="Workspace activity" subtitle="Actions are logged automatically as you work" action={<ExportButton title="Audit logs" type="activity" records={rows} clinic={data.settings} subtitle={query ? `Search: ${query}` : 'All loaded authorized activity'} />}>
    <div className="list-toolbar">
      <div className="search-input">
        <Search size={16} />
        <input 
          aria-label="Search audit logs" 
          placeholder="Search action, person, or details..." 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
        />
      </div>
    </div>
    <AuditTable sortingTable={table} logs={rows} />
  </Card>;
}
