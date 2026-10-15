export function reportRows(data, type, from, to) {
  const rows = {
    Patients: data.patients,
    Consultations: data.consultations,
    Appointments: data.appointments,
    'Clinic Activity': data.logs
  }[type];
  return rows.filter(r => (r.created || r.date).slice(0, 10) >= from && (r.created || r.date).slice(0, 10) <= to);
}
