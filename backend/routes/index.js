import * as profile from '../controllers/profileController.js';
import { imageUpload } from '../middleware/images.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, administrator } from '../middleware/auth.js';
import { asyncHandler as route } from '../middleware/errors.js';
import { authController } from '../controllers/authController.js';
import { requirePolicyAcknowledgment } from '../utils/policyAcknowledgment.js';
import { passwordResetController } from '../utils/passwordReset.js';
import * as patients from '../controllers/patientController.js';
import * as consultations from '../controllers/consultationController.js';
import * as appointments from '../controllers/appointmentController.js';
import * as documents from '../controllers/documentController.js';
import * as users from '../controllers/userController.js';
import * as settings from '../controllers/settingsController.js';
import * as workspace from '../controllers/workspaceController.js';
import { doctorPatientDirectory } from '../controllers/directoryController.js';
import { patientActivity } from '../controllers/activityController.js';
import { report, auditLogs } from '../controllers/reportController.js';
import { upload } from '../middleware/uploads.js';
import {
    practitioner,
    clinicalAccess,
    requirePermission
} from '../middleware/permissions.js';

export function apiRoutes(config) {
    const router = Router();
    const auth = authController(config);

    // Authentication
    router.post(
        '/auth/login',
        rateLimit({
            windowMs: 15 * 60 * 1000,
            limit: 10,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            skipSuccessfulRequests: true,
            message: {
                error: 'Too many login attempts. Try again in 15 minutes.'
            }
        }),
        route(auth.login)
    );

    const recovery = passwordResetController(config);
    const resetLimit = limit => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many password reset attempts. Try again in 15 minutes.' } });
    router.post('/auth/forgot-password', resetLimit(5), route(recovery.forgotPassword));
    router.post('/auth/reset-password', resetLimit(10), route(recovery.resetPassword));

    router.use(authenticate(config));

    router.get('/auth/me', route(auth.me));
    router.post('/auth/logout', route(auth.logout));
    router.post('/auth/policies/acknowledge', route(auth.acknowledgePolicies));
    // Authenticated users may review session status, accept or sign out first.
    // All workspace data and other protected actions remain gated on the server.
    router.use(requirePolicyAcknowledgment);
    router.patch('/auth/profile', route(auth.profile));
    router.get('/auth/activity', route(profile.loginActivity));
    router.post('/auth/revoke-others', route(profile.revokeOthers));

    // System settings
    router.get('/settings/system', administrator, route(profile.systemInfo));
    router.get('/auth/avatar', route(profile.imageContent('avatar')));
    router.post('/auth/avatar', imageUpload, route(profile.setAvatar));
    router.post('/auth/avatar/remove', route(profile.removeAvatar));

    router.get('/settings/logo', route(profile.imageContent('logo')));
    router.post(
        '/settings/logo',
        administrator,
        imageUpload,
        route(profile.setLogo)
    );
    router.post(
        '/settings/logo/remove',
        administrator,
        route(profile.removeLogo)
    );

    // Workspace
    router.get('/workspace', route(workspace.workspace));
    router.get('/dashboard', route(workspace.dashboard));
    router.get('/doctor-patient-directory', administrator, route(doctorPatientDirectory));
    router.get('/patient-activity', requirePermission('viewRecords'), route(patientActivity));
    router.get('/search', route(workspace.search));

    // Patients
    router.get('/patients', route(patients.listPatients));
    router.post('/patients', route(patients.createPatient));
    router.get('/patients/:id', route(patients.getPatient));
    router.patch('/patients/:id', route(patients.updatePatient));
    router.post(
        '/patients/:id/archive',
        administrator,
        route(patients.patientStatus('Archived'))
    );
    router.post(
        '/patients/:id/restore',
        administrator,
        route(patients.patientStatus('Active'))
    );

    // Medical records
    // Nurses and other authorized viewing roles can read records.
    router.get(
        '/consultations',
        clinicalAccess,
        route(consultations.listConsultations)
    );

    // Only clinical practitioners can create consultation records.
    router.post(
        '/consultations',
        practitioner,
        route(consultations.createConsultation)
    );

    router.get(
        '/consultations/:id',
        clinicalAccess,
        route(consultations.getConsultation)
    );

    // Appointments
    router.get('/doctors/:id/slots', route(appointments.availableSlots));
    router.get('/appointments', route(appointments.listAppointments));
    router.post('/appointments', route(appointments.createAppointment));
    router.get('/appointments/:id', route(appointments.getAppointment));
    router.patch('/appointments/:id', route(appointments.updateAppointment));

    // Documents
    router.get('/documents', clinicalAccess, route(documents.listDocuments));
    router.post('/documents', clinicalAccess, upload, route(documents.createDocument));
    router.get('/documents/:id', clinicalAccess, route(documents.getDocument));
    router.get(
        '/documents/:id/preview',
        clinicalAccess,
        route(documents.documentContent(false))
    );
    router.get(
        '/documents/:id/download',
        clinicalAccess,
        route(documents.documentContent(true))
    );
    router.post(
        '/documents/:id/archive',
        clinicalAccess,
        route(documents.documentStatus('Archived'))
    );
    router.post(
        '/documents/:id/restore',
        clinicalAccess,
        route(documents.documentStatus('Active'))
    );

    // Reports and audit logs
    router.get('/reports/:type', requirePermission('viewReports'), route(report));
    router.get('/audit-logs', requirePermission('viewAuditLogs'), route(auditLogs));

    // User management
    router.get('/users', administrator, route(users.listUsers));
    router.get('/users/:id/avatar', administrator, route(profile.imageContent('avatar')));
    router.post('/users', administrator, route(users.createUser));
    router.patch('/users/:id', administrator, route(users.updateUser));
    router.patch('/users/:id/availability', administrator, route(users.updateAvailability));

    // Preferences, notifications, and application settings
    router.get('/settings', route(settings.getSettings));
    router.patch('/settings', administrator, route(settings.updateSettings));
    router.patch('/preferences', route(settings.updatePreferences));
    router.get('/notifications', route(settings.notifications));
    router.patch(
        '/notifications/:id/read',
        route(settings.markNotifications)
    );

    return router;
}
