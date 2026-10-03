import React from "react";
import { Search, ArrowDownToLine, ArrowRight } from "lucide-react";
import { exportCSV, dateLabel } from "../utils/helpers";
import Empty from "../components/common/Empty.jsx";
export default function MedicalRecords({
  query,
  setQuery,
  data,
  patient,
  go,
  personCell,
  setModal
}) {
  return <section className="card">
    <div className="list-toolbar">
      <div className="search-input">
        <Search size={17} />
        <input 
          aria-label="Search medical records" 
          placeholder="Search patient, diagnosis, or record ID..." 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
        />
      </div>
      <button className="btn secondary" onClick={() => exportCSV('consultations', data.consultations.filter(r => `${r.id} ${r.diagnosis} ${patient(r.patientId)?.name}`.toLowerCase().includes(query.toLowerCase())))}><ArrowDownToLine size={16} />Export records</button>
    </div>
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Visit date</th>
            <th>Assessment / Diagnosis</th>
            <th>Attending staff</th>
            <th>Record</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.consultations.filter(r => `${r.id} ${r.diagnosis} ${patient(r.patientId)?.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)).map(r => <tr key={r.id}>
            <td>
              <button className="unstyled" onClick={() => go('patients/' + r.patientId)}>
                {personCell(patient(r.patientId))}
              </button>
            </td>
            <td>
              {dateLabel(r.date)}
              <small className="cell-sub">
                {r.type}
              </small>
            </td>
            <td>
              {r.diagnosis}
            </td>
            <td>
              {r.staff}
            </td>
            <td>
              <span className="record-id">
                {r.id}
              </span>
            </td>
            <td>
              <button className="text-button" onClick={() => setModal({
                type: 'record',
                item: r
              })}>View<ArrowRight size={14} /></button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {!data.consultations.some(r => `${r.id} ${r.diagnosis} ${patient(r.patientId)?.name}`.toLowerCase().includes(query.toLowerCase())) && <Empty />}
  </section>;
}
