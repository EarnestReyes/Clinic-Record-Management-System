import React, { useState } from "react";
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
  const [sorting, setSorting] = useState({ key: 'date', direction: 'desc' });
  const recordType = record => record.recordType || data.specialties?.find(s => s.key === 'general-practitioner')?.recordType || 'General consultation';
  const rows = data.consultations.filter(r => `${r.id} ${r.diagnosis} ${patient(r.patientId)?.name}`.toLowerCase().includes(query.toLowerCase()))
    .map((record, index) => ({ record, index })).sort((a, b) => {
      const value = record => sorting.key === 'date' ? (Number.isFinite(Date.parse(record.date)) ? Date.parse(record.date) : null)
        : String((sorting.key === 'recordType' ? recordType(record) : record[sorting.key]) ?? '').toLowerCase();
      const av = value(a.record), bv = value(b.record);
      const result = av === bv ? 0 : av == null || av === '' ? 1 : bv == null || bv === '' ? -1
        : (typeof av === 'number' ? av - bv : av.localeCompare(bv, undefined, { numeric: true })) * (sorting.direction === 'asc' ? 1 : -1);
      return result || a.index - b.index;
    }).map(item => item.record);
  const header = (key, label) => <th aria-sort={sorting.key === key ? (sorting.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button className="table-sort" onClick={() => setSorting(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))}>
      {label}<span aria-hidden="true">{sorting.key === key ? sorting.direction === 'asc' ? ' \u2191' : ' \u2193' : ' \u2195'}</span>
    </button></th>;
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
    <div className="table-scroll bounded-table" tabIndex={0} role="region" aria-label="Medical records table">
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            {header('date', 'Visit date')}
            {header('recordType', 'Record type')}
            <th>Assessment / Diagnosis</th>
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