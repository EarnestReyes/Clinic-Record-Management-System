import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import { permissionsFor } from './permissions.js';
import { specialtyKeyOf } from '../config/specialties.js';
import { ApiError } from './errors.js';

export const noRecords = () => ({ _id: { $exists: false } });
export const clinicScheduling = user => user?.role === 'Administrator' || permissionsFor(user).intake;
export async function patientScope(user) {
    if (clinicScheduling(user)) return {};
    if (!permissionsFor(user).createConsultation) return noRecords();
    const patientIds = await Appointment.distinct('patientId', { ...appointmentScope(user), status: 'Scheduled' });
    return { $or: [{ assignedStaffId: user.id }, { id: { $in: patientIds } }] };
}
export async function authorizedPatientIds(user) {
    return Patient.distinct('id', await patientScope(user));
}
export async function assertPatientAccess(user, id) {
    if (clinicScheduling(user)) return;
    if (!permissionsFor(user).createConsultation || !await Patient.exists({ ...await patientScope(user), id })) {
        throw new ApiError(403, 'This patient is not assigned to your account.');
    }
}
export function appointmentScope(user) {
    if (clinicScheduling(user)) return {};
    if (!permissionsFor(user).createConsultation) return noRecords();
    return { staffId: user.id, specialty: specialtyKeyOf(user) };
}
export async function consultationScope(user) {
    if (user?.role === 'Administrator') return {};
    if (!permissionsFor(user).createConsultation) return noRecords();
    return { staffId: user.id, specialty: specialtyKeyOf(user), patientId: { $in: await authorizedPatientIds(user) } };
}
export async function documentScope(user) {
    if (user?.role === 'Administrator') return {};
    if (!permissionsFor(user).createConsultation) return noRecords();
    return { uploadedBy: user.id, patientId: { $in: await authorizedPatientIds(user) } };
}
export async function auditScope(user) {
    if (user?.role === 'Administrator') return {};
    if (permissionsFor(user).intake) return { actorId: user.id };
    if (!permissionsFor(user).createConsultation) return noRecords();
    return { actorId: user.id, $or: [
        { recordType: 'Patient', recordId: { $in: await authorizedPatientIds(user) } },
        { recordType: 'User', recordId: user.id },
        { recordType: 'Report' }
    ] };
}
export async function notificationScope(user) {
    // Legacy broadcasts cannot prove event authorization; keep them stored but hidden.
    const base = { userId: user?.id || '', scopeVersion: 1, recipientRole: user?.role || '', recipientSpecialty: specialtyKeyOf(user) || '' };
    if (clinicScheduling(user)) return base;
    if (!permissionsFor(user).createConsultation) return { ...noRecords(), ...base };
    const ids = await Appointment.distinct('id', appointmentScope(user));
    return { ...base, $or: [{ appointmentId: { $in: ids } }, { title: 'Welcome to Careline', route: 'dashboard' }] };
}
export async function assertDocumentAccess(user, document) {
    if (user?.role === 'Administrator') return;
    if (!permissionsFor(user).createConsultation || document?.uploadedBy !== user.id) {
        throw new ApiError(403, 'This document is not owned by your account.');
    }
    await assertPatientAccess(user, document.patientId);
}
