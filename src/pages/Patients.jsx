import React from "react";
import useTableSort, { sortDate } from "../utils/useTableSort.jsx";
import { Users, ShieldCheck, Search, SlidersHorizontal, Eye, Pencil, RotateCcw, Archive, CheckCircle2 } from "lucide-react";
import { age, dateLabel } from "../utils/helpers";
import Badge from "../components/common/Badge.jsx";
import Empty from "../components/common/Empty.jsx";
export default function Patients({
  pageName,
  patientTable,
  active,
  data,
  query,
  setQuery,
  filter,
  setFilter,
  sort,
  setSort,
  filteredPatients,
  go,
  personCell,
  addPatient,
  archivePatient
}) {
  const localTable = useTableSort(sort || 'name');
  const table = patientTable || localTable;
  const rows = table.sort(filteredPatients, (p, key) => key === 'created' ? sortDate(p.created)
    : key === 'age' ? (p.dob ? age(p.dob) : null) : p[key]);
  return <><div className="section-stats">
      <div>
        <span className="stat-icon teal">
          <Users size={20} />
        </span>
        <div>
          <strong>
            {pageName === 'Patients' ? active.length : data.patients.length - active.length}
          </strong>
          <small>
            {pageName === 'Patients' ? 'Active patient records' : 'Archived patient records'}
          </small>
        </div>
      </div>
      <p><ShieldCheck size={18} />Medical history is preserved. Only administrators can archive or restore patients.</p>
    </div><section className="card">
      <div className="list-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input 
            aria-label="Search patients" 
            placeholder="Search by name, ID, or phone..." 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
          />
        </div>
        <div className="toolbar-filters">
          <SlidersHorizontal size={16} />
          <select aria-label="Filter by gender" value={filter} onChange={e => setFilter(e.target.value)}>
            {['All', 'Female', 'Male', 'Other'].map(x => <option key={x} value={x}>
              {x === 'All' ? 'All genders' : x}
            </option>)}
          </select>
          <select aria-label="Sort patients" value={table.sorting.key} onChange={e => { setSort(e.target.value); table.setSorting({ key: e.target.value, direction: 'asc' }); }}>
            <option value="name">Name A–Z</option>
            <option value="id">Patient ID</option>
            <option value="created">Date registered</option>
            <option value="status">Status</option>
            <option value="age">Age</option>
            <option value="phone">Contact</option>
          </select>
        </div>
      </div>
      {filteredPatients.length ? <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {table.header('name', 'Patient')}
              {table.header('age', 'Age / Gender')}
              {table.header('phone', 'Contact')}
              {table.header('created', 'Registered')}
              {table.header('status', 'Status')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => <tr key={p.id}>
              <td>
                <button className="unstyled" onClick={() => go((pageName === 'Archived Patients' ? 'archived-patients/' : 'patients/') + p.id)}>
                  {personCell(p)}
                </button>
              </td>
              <td>{age(p.dob)} years<small className="cell-sub">
                  {p.gender}
                </small></td>
              <td>
                {p.phone}
                <small className="cell-sub">
                  {p.email}
                </small>
              </td>
              <td>
                {dateLabel(p.created)}
              </td>
              <td>
                <Badge>
                  {p.status}
                </Badge>
              </td>
              <td>
                <div className="table-actions">
                  <button className="icon-button" title="View profile" onClick={() => go((pageName === 'Archived Patients' ? 'archived-patients/' : 'patients/') + p.id)}>
                    <Eye size={16} />
                  </button>
                  <button className="icon-button" title="Edit patient" onClick={() => addPatient(p)}>
                    <Pencil size={15} />
                  </button>
                  {data.permissions?.manageUsers === true && <button className="icon-button" title={p.status === 'Archived' ? 'Restore patient' : 'Archive patient'} onClick={() => archivePatient(p)}>
                    {p.status === 'Archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
                  </button>}
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div> : <Empty />}
      <div className="table-footer">Showing {filteredPatients.length} patient records<span>All records loaded<CheckCircle2 size={14} /></span></div>
    </section></>;
}
