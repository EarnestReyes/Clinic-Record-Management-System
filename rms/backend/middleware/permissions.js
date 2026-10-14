import { ApiError } from './errors.js';
import {
    specialtyByKey,
    specialtyKeyOf
} from '../config/specialties.js';

// Compute permissions using the authenticated database account.
export function permissionsFor(user) {
    const key = specialtyKeyOf(user);
    const spec = specialtyByKey(key);

    const administrator = user ?.role === 'Administrator';
    const intake = spec ?.kind === 'intake';
    const clinical = spec ?.kind === 'clinical';

    return {
        specialty: key,
        manageUsers: administrator,

        // Only clinical practitioners can create consultations.
        createConsultation: clinical,

        // Nurses may view records without being allowed to write them.
        viewRecords: !intake || key === 'nurse',

        // Keep existing reporting and audit restrictions.
        viewReports: !intake,
        viewAuditLogs: !intake,
        intake
    };
}

// Only clinical professionals may create consultation records.
export function practitioner(req, res, next) {
    if (!permissionsFor(req.user).createConsultation) {
        return next(
            new ApiError(
                403,
                'Only assigned medical professionals can create consultation records.'
            )
        );
    }

    next();
}

// Prevent intake-only staff from accessing clinical routes.
// Nurses are exempted from the view restriction, not the write restriction.
export function clinicalAccess(req, res, next) {
    const permissions = permissionsFor(req.user);

    if (permissions.intake && !permissions.viewRecords) {
        return next(
            new ApiError(
                403,
                'Your role does not have access to clinical records.'
            )
        );
    }

    next();
}