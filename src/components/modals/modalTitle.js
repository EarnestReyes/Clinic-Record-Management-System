export function modalTitle(m) {
  return {
    patient: m.item ? 'Edit patient' : 'Add a new patient',
    consultation: 'New consultation',
    appointment: m.item ? 'Update appointment' : 'Schedule appointment',
    'appointment-detail': 'Appointment details',
    record: 'Consultation record',
    user: m.item ? 'Edit team member' : 'Add team member',
    upload: 'Upload document',
    document: 'Document preview',
    help: 'Help & resources'
  }[m.type] || m.title;
}
