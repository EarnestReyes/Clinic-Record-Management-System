import React from "react";
import useTableSort, { sortDate } from "../utils/useTableSort.jsx";
import { Search, ArrowRight } from "lucide-react";
import { dateLabel } from "../utils/helpers";
import Empty from "../components/common/Empty.jsx";
import ExportButton from "../components/common/ExportButton.jsx";
export default function MedicalRecords({
  query,
  setQuery,
  data,
  patient,
  go,
  personCell,
  setModal
}) {
  const { sort, header } = useTableSort('date', 'desc');
  const recordType = record => record.recordType || data.specialties?.find(s => s.key === 'general-practitioner')?.recordType || 'General consultation';
  const rows = sort(data.consultations.filter(r => `${r.id} ${r.diagnosis} ${patient(r.patientId)?.name}`.toLowerCase().includes(query.toLowerCase())),
    (record, key) => key === 'date' ? sortDate(record.date) : key === 'recordType' ? recordType(record)
      : key === 'patient' ? patient(record.patientId)?.name : record[key]);
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
      <ExportButton title="Medical records" type="consultations" records={rows} patient={patient} clinic={data.settings} label="Export records" subtitle={query ? `Search: ${query}` : 'All authorized medical records'} />
    </div>
    <div className="table-scroll bounded-table" tabIndex={0} role="region" aria-label="Medical records table">
      <table>
        <thead>
          <tr>
            {header('patient', 'Patient')}
            {header('date', 'Visit date')}
            {header('recordType', 'Record type')}
            {header('diagnosis', 'Assessment / Diagnosis')}
            {header('staff', 'Attending staff')}
            {header('id', 'Record ID')}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => <tr key={r.id}>
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
              {recordType(r)}
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