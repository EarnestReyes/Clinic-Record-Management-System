export function filterDirectory(groups, { search = '', specialty = '', relationship = 'all', patientStatus = '', activity = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  const includes = value => String(value || '').toLocaleLowerCase().includes(query);
  return groups.filter(group => !specialty || group.key === specialty).map(group => ({ ...group, doctors: group.doctors.map(doctor => {
    const doctorMatches = includes(doctor.name) || includes(group.label);
    const patients = doctor.patients.filter(patient => (!patientStatus || patient.status === patientStatus) && (!activity || patient.activity?.status === activity)
      && (relationship === 'all' || (relationship === 'active' && patient.active) || (relationship === 'historical' && patient.historical)
        || (relationship === 'appointments' && !patient.active && !patient.historical && !patient.routingOnly)
        || (relationship === 'routing' && patient.routingOnly))
      && (!query || doctorMatches || includes(patient.name) || includes(patient.id)));
    return { ...doctor, patients };
  }).filter(doctor => doctor.patients.length || (relationship === 'all' && !patientStatus && !activity && (!query || includes(doctor.name) || includes(group.label)))) }))
    .filter(group => group.doctors.length);
}
