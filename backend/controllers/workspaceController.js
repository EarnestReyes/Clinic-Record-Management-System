import Patient from '../models/Patient.js';
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

export async function dashboardData(user = null) {
    const today = clinicToday();

    const week = new Date(today + 'T12:00:00');
    week.setDate(week.getDate() - 6);

    const from = week.toLocaleDateString('en-CA');

    const appointmentFilter = user ?
        appointmentScope(user) : {};

    const recordFilter = user ?
        await consultationScope(user) : { _id: { $exists: false } };

    const safeRecordFilter = recordFilter === null ? { _id: { $exists: false } } :
        recordFilter;

    const [
        totalPatients,
        activePatients,
        newPatients,
        archivedRecords,
        todaysAppointments,
        todaysConsultations,
        visits,
        appointments,
        recentActivity
    ] = await Promise.all([
        Patient.countDocuments(await patientScope(user)),

        Patient.countDocuments({
            ...await patientScope(user),
            status: 'Active'
        }),

        Patient.countDocuments({
            ...await patientScope(user),
            created: today
        }),

        Patient.countDocuments({
            status: 'Archived'
        }),

        Appointment.countDocuments({
            ...appointmentFilter,
            date: today
        }),

        Consultation.countDocuments({
            ...safeRecordFilter,
            date: today
        }),

        Consultation.aggregate([{
                $match: {
                    ...safeRecordFilter,
                    date: {
                        $gte: from,
                        $lte: today
                    }
                }
            },
            {
                $group: {
                    _id: {
                        date: '$date',
                        type: '$type'
                    },
                    count: {
                        $sum: 1
                    }
                }
            },
            {
                $sort: {
                    '_id.date': 1
                }
            }
        ]),

        Appointment.find({
            ...appointmentFilter,
            date: today
        }).sort({
            time: 1
        }),

        user ?.role === 'Administrator' ?
        AuditLog.find(await auditScope(user))
        .sort({ date: -1 })
        .limit(10) :
        user ?
        AuditLog.find(await auditScope(user))
        .sort({ date: -1 })
        .limit(10) :
        Promise.resolve([])
    ]);

    return {
        totalPatients,
        activePatients,
        newPatients,
        archivedRecords,
        todaysAppointments,
        todaysConsultations,
        visits,
        appointments,
        recentActivity
    };
}


/* =========================================================
   DASHBOARD ENDPOINT
========================================================= */





/* =========================================================
   WORKSPACE ENDPOINT
========================================================= */


export const dashboard = async(req, res) => res.json(await dashboardData(req.user));

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

        user.role === 'Administrator' ?
        AuditLog.find()
        .sort({ date: -1 })
        .limit(500) :
        AuditLog.find({
            actorId: user.id
        })
        .sort({ date: -1 })
        .limit(500),

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
        appointments,
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
