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
    const intake = user?.role === 'Clinic Staff' && spec ?.kind === 'intake';
    const clinical = (administrator || user?.role === 'Clinic Staff') && spec ?.kind === 'clinical';

    return {
        specialty: key,
        manageUsers: administrator,

        // Only clinical practitioners can create consultations.
        createConsultation: clinical,

        viewRecords: administrator || clinical,

        // Keep existing reporting and audit restrictions.
        viewReports: administrator || clinical,
        viewAuditLogs: administrator || clinical,
        intake
    };
}

// Reuse existing permission flags; this does not define additional roles.
export const requirePermission = permission => (req, res, next) => {
    if (permissionsFor(req.user)[permission] !== true) {
        return next(new ApiError(403, 'Your role does not have permission to access this resource.'));
    }
    next();
};

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
// Unknown professions and intake-only staff cannot read clinical records.
export function clinicalAccess(req, res, next) {
    const permissions = permissionsFor(req.user);

    if (!permissions.viewRecords) {
        return next(
            new ApiError(
                403,
                'Your role does not have access to clinical records.'
            )
        );
    }

    next();
}
