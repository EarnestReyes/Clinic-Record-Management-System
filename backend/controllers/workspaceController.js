import Patient from '../models/Patient.js';
import { withAppointmentPatients } from './appointmentPatients.js';
import { ApiError } from '../middleware/errors.js';
import { validateBooking, overlaps } from '../config/availability.js';
import Consultation from '../models/Consultation.js';
import Appointment from '../models/Appointment.js';
import Document from '../models/Document.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

import { permissionsFor } from '../middleware/permissions.js';
import { patientScope, consultationScope, appointmentScope, documentScope, auditScope, notificationScope } from '../middleware/accessScopes.js';

import {
    publicSpecialties
} from '../config/specialties.js';

import { clinicSettings } from './settingsController.js';
import { patientView } from './patientController.js';

import {
    clinicToday,
    date,
    choice,
    text,
    escapeRegex
} from '../middleware/validation.js';


/* =========================================================
   CLINIC DATE AND TIME
   Uses the clinic's local timezone.
========================================================= */



/* =========================================================
   APPOINTMENT STATUS RECONCILIATION
   Read endpoints never reconcile status. Attendance must be
   confirmed by an authorized write, not inferred from the clock.
========================================================= */

/* =========================================================
   APPOINTMENT ACCESS
   Administrators and General Nurses can view all appointments.
   Other personnel can view their assigned appointments only.
========================================================= */



/* =========================================================
   CONSULTATION ACCESS
========================================================= */



/* =========================================================
   DASHBOARD DATA
========================================================= */

export async function dashboardData(user = null, query = {}) {
    const today = clinicToday();
    const to = date(query.to || today);
    const from = date(query.from || new Date(Date.parse(to + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10));
    if (from > to || Date.parse(to) - Date.parse(from) > 365 * 86400000) throw new ApiError(400, 'Choose a date range of up to 366 days, with the start before the end.');
    const status = query.status ? choice(query.status, ['Scheduled', 'Completed', 'Cancelled', 'No Show'], 'Appointment status') : '';
    const permissions = permissionsFor(user);
    const administrator = user?.role === 'Administrator';
    const scheduling = administrator || permissions.intake;
    const [patients, records, logs, notices] = await Promise.all([patientScope(user), consultationScope(user), auditScope(user), notificationScope(user)]);
    const appointments = appointmentScope(user);
    const range = { $gte: from, $lte: to };
    const clinicalKeys = publicSpecialties().filter(item => item.kind === 'clinical').map(item => item.key);
    const doctorFilter = { active: true, role: { $in: ['Administrator', 'Clinic Staff'] }, specialty: { $in: clinicalKeys }, ...(!scheduling ? { id: user?.id || '' } : {}) };
    const appointmentFields = 'id patientId date time duration type staffId staff specialty status';
    const [totalPatients, activePatients, newPatients, archivedRecords, todaysAppointments, todaysConsultations,
        visits, todayRows, rangeRows, upcomingAppointments, upcomingRows, recentActivity, doctors, staffCount, unreadNotifications, notifications] = await Promise.all([
        Patient.countDocuments(patients),
        Patient.countDocuments({ ...patients, status: 'Active' }),
        Patient.countDocuments({ ...patients, created: today }),
        Patient.countDocuments({ ...patients, status: 'Archived' }),
        Appointment.countDocuments({ ...appointments, date: today }),
        Consultation.countDocuments({ ...records, date: today }),
        Consultation.aggregate([
            { $match: { ...records, date: range } },
            { $group: { _id: { date: '$date', type: '$type' }, count: { $sum: 1 } } },
            { $sort: { '_id.date': 1 } }
        ]),
        Appointment.find({ ...appointments, date: today }).select(appointmentFields).sort({ time: 1 }),
        Appointment.find({ ...appointments, date: range }).select(appointmentFields).sort({ date: 1, time: 1 }),
        Appointment.countDocuments({ ...appointments, status: 'Scheduled', date: { $gte: today } }),
        Appointment.find({ ...appointments, status: 'Scheduled', date: { $gte: today } }).select(appointmentFields).sort({ date: 1, time: 1 }).limit(5),
        AuditLog.find(logs).sort({ date: -1 }).limit(5),
        User.find(doctorFilter).select('id name role active specialty availability').sort({ name: 1 }),
        administrator ? User.countDocuments({ role: 'Clinic Staff', active: true }) : Promise.resolve(null),
        Notification.countDocuments({ ...notices, read: false }),
        Notification.find(notices).select('id title text route read createdAt').sort({ createdAt: -1 }).limit(5)
    ]);
    const statuses = ['Scheduled', 'Completed', 'Cancelled', 'No Show'];
    const statusCounts = Object.fromEntries(statuses.map(status => [status, rangeRows.filter(item => item.status === status).length]));
    const scheduledToday = todayRows.filter(item => item.status === 'Scheduled').length;
    const conflicts = [];
    if (administrator) {
        const scheduled = rangeRows.filter(item => item.status === 'Scheduled');
        const byDoctorDay = new Map();
        for (const item of scheduled) {
            const key = `${item.staffId}|${item.date}`;
            if (!byDoctorDay.has(key)) byDoctorDay.set(key, []);
            byDoctorDay.get(key).push(item);
        }
        for (const item of scheduled) {
            const doctor = doctors.find(doctor => doctor.id === item.staffId);
            let reason = '';
            try {
                if (!doctor || doctor.specialty !== item.specialty) throw new Error('assignment');
                validateBooking(doctor.availability, item.date, item.time, item.duration);
            } catch { reason = 'Assignment or availability needs review'; }
            const clash = byDoctorDay.get(`${item.staffId}|${item.date}`).some(other => {
                if (other.id === item.id) return false;
                try { return overlaps(item.time, item.duration, other); } catch { return false; }
            });
            if (clash) reason = reason ? reason + '; overlapping booking' : 'Overlapping booking';
            if (reason) conflicts.push({ id: item.id, staffId: item.staffId, staff: item.staff, date: item.date, time: item.time, reason });
        }
    }
    return {
        today, from, to, timezone: 'Asia/Manila', generatedAt: new Date().toISOString(),
        totalPatients, activePatients, newPatients, archivedRecords, todaysAppointments, scheduledToday, todaysConsultations,
        visits, appointments: todayRows, rangeAppointments: rangeRows.filter(item => !status || item.status === status).slice(0, 50), rangeAppointmentTotal: rangeRows.length,
        filteredAppointmentTotal: rangeRows.filter(item => !status || item.status === status).length, status,
        statusCounts, upcomingAppointments, upcoming: upcomingRows,
        routingTasks: scheduling ? rangeRows.filter(item => item.status === 'Scheduled' && !doctors.some(doctor => doctor.id === item.staffId && doctor.specialty === item.specialty)).length : null,
        recentActivity, doctors: doctors.map(doctor => ({ id: doctor.id, name: doctor.name, specialty: doctor.specialty, availability: doctor.availability || null })), staffCount, conflicts, unreadNotifications, notifications
    };
}

/* =========================================================
   DASHBOARD ENDPOINT
========================================================= */





/* =========================================================
   WORKSPACE ENDPOINT
========================================================= */


export const dashboard = async(req, res) => res.json(await dashboardData(req.user, req.query));

export const workspace = async(req, res) => {
    const user = req.user;

    const appointmentFilter = appointmentScope(user);
    const recordFilter = await consultationScope(user);


    const [
        patients,
        consultations,
        appointments,
        documents,
        logs,
        users,
        notifications,
        settings,
        dashboard
    ] = await Promise.all([
        Patient.find(await patientScope(user))
        .sort({ name: 1 }),

        Consultation.find(recordFilter).sort({ date: -1 }),

        Appointment.find(appointmentFilter)
        .sort({
            date: 1,
            time: 1
        }),

        permissionsFor(user).viewRecords ? Document.find(await documentScope(user))
        .sort({ date: -1 }) : Promise.resolve([]),

        AuditLog.find(await auditScope(user)).sort({ date: -1 }).limit(500),

        user.role === 'Administrator' ?
        User.find()
        .sort({ name: 1 }) :
        User.find({
            active: true
        }).select('id name role active specialty'),

        Notification.find(await notificationScope(user))
        .sort({ createdAt: -1 })
        .limit(100),

        clinicSettings(user),

        dashboardData(user)
    ]);

    res.json({
        patients: patients.map(patient => patientView(patient, user)),
        consultations,
        appointments: await withAppointmentPatients(appointments),
        documents,
        logs,
        users,
        notifications,
        settings,
        dashboard,
        specialties: publicSpecialties(),
        permissions: permissionsFor(user)
    });
};



/* =========================================================
   GLOBAL SEARCH ENDPOINT
========================================================= */

export const search = async(req, res) => {
    const q = text(req.query.q, 'Search', {
        required: true,
        max: 100
    });

    const regex = new RegExp(
        escapeRegex(q),
        'i'
    );

    const patients = await Patient.find({
        ...await patientScope(req.user),
        $and: [{ $or: [
            { id: regex },
            { name: regex },
            { phone: regex }
        ] }]
    }).limit(10);

    const ids = patients.map(patient => patient.id);

    const appointmentFilter = appointmentScope(req.user);
    const recordFilter = await consultationScope(req.user);

    const consultationSearch = recordFilter === null ?
        null : {
            $and: [
                recordFilter,
                {
                    $or: [
                        { id: regex },
                        { diagnosis: regex },
                        { patientId: { $in: ids } }
                    ]
                }
            ]
        };

    const appointmentSearch = {
        $and: [
            appointmentFilter,
            {
                $or: [
                    { id: regex },
                    { type: regex },
                    { patientId: { $in: ids } }
                ]
            }
        ]
    };

    const [
        consultations,
        appointments
    ] = await Promise.all([
        consultationSearch ?
        Consultation.find(consultationSearch).limit(10) :
        Promise.resolve([]),

        Appointment.find(appointmentSearch).limit(10)
    ]);

    res.json({
        patients: patients.map(patient => patientView(patient, req.user)),
        consultations,
        appointments
    });
};
