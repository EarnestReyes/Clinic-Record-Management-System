import React from "react";
import Patients from "./Patients.jsx";
export default function ArchivedRecords({
  pageName,
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
  return <Patients 
    pageName={pageName} 
    active={active} 
    data={data} 
    query={query} 
    setQuery={setQuery} 
    filter={filter} 
    setFilter={setFilter} 
    sort={sort} 
    setSort={setSort} 
    filteredPatients={filteredPatients} 
    go={go} 
    personCell={personCell} 
    addPatient={addPatient} 
    archivePatient={archivePatient} 
  />;
}
