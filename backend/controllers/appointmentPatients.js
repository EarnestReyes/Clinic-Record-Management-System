import Patient from '../models/Patient.js';

// Call only after appointments have been scoped to the current user.
// Historical appointment identity does not grant access to a full patient profile.
export async function withAppointmentPatients(appointments) {
    if (!appointments.length) return [];
    const patients = await Patient.find({ id: { $in: [...new Set(appointments.map(item => item.patientId))] } })
        .select('id name status');
    const identities = new Map(patients.map(patient => [patient.id, {
        id: patient.id,
        name: patient.name,
        status: patient.status
    }]));
    return appointments.map(item => ({...(item.toJSON ? item.toJSON() : item), patient: identities.get(item.patientId) || null }));
}