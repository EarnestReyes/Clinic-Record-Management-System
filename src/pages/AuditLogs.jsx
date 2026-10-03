import React from "react";
import Card from "../components/common/Card.jsx";
import { exportCSV } from "../utils/helpers";
import { ArrowDownToLine, Search } from "lucide-react";
import AuditTable from "../components/common/AuditTable.jsx";
export default function AuditLogs({
  data,
  query,
  setQuery
}) {
  return <Card title="Workspace activity" subtitle="Actions are logged automatically as you work" action={<button className="btn secondary" onClick={() => exportCSV('audit-logs', data.logs)}><ArrowDownToLine size={15} />Export</button>}>
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
    <AuditTable logs={data.logs.filter(l => `${l.action} ${l.actor} ${l.detail}`.toLowerCase().includes(query.toLowerCase()))} />
  </Card>;
}
