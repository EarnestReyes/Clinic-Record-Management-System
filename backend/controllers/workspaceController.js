import Patient from '../models/Patient.js';
import Consultation from '../models/Consultation.js';
import Appointment from '../models/Appointment.js';
import Document from '../models/Document.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

import { permissionsFor } from '../middleware/permissions.js';

import {
    publicSpecialties,
    specialtyKeyOf
} from '../config/specialties.js';

import { clinicSettings } from './settingsController.js';

import {
    clinicToday,
    text,
    escapeRegex
} from '../middleware/validation.js';


/* =========================================================
   CLINIC DATE AND TIME
   Uses the clinic's local timezone.
========================================================= */

function clinicDateTime() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    );

    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}`
    };
}


/* =========================================================
   APPOINTMENT STATUS RECONCILIATION
   Scheduled appointments whose start time has passed become
   No Show. Completed and Cancelled appointments are untouched.
========================================================= */

/* =========================================================
   APPOINTMENT ACCESS
   Administrators and General Nurses can view all appointments.
   Other personnel can view their assigned appointments only.
========================================================= */

function appointmentScope(user) {
    const permissions = permissionsFor(user);

    if (
        user.role === 'Administrator' ||
        permissions.intake === true
    ) {
        return {};
    }

    return {
        staffId: user.id
    };
}


/* =========================================================
   CONSULTATION ACCESS
========================================================= */

function consultationScope(user) {
    if (user.role === 'Administrator') {
        return {};
    }

    if (permissionsFor(user).intake) {
        return null;
    }

    const key = specialtyKeyOf(user);

    if (key === 'general-practitioner') {
        return {
            staffId: user.id,
            $or: [
                { specialty: key },
                { specialty: { $exists: false } },
                { specialty: '' }
            ]
        };
    }

    return {
        staffId: user.id,
        specialty: key
    };
}


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
        consultationScope(user) : {};

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
        Patient.countDocuments(),

        Patient.countDocuments({
            status: 'Active'
        }),

        Patient.countDocuments({
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
        AuditLog.find()
        .sort({ date: -1 })
        .limit(10) :
        user ?
        AuditLog.find({
            actorId: user.id
        })
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


async function reconcileOverdueAppointments(user) {
    const now = clinicDateTime();

    const gracePeriodMinutes = 10;
    const [hour, minute] = now.time.split(':').map(Number);

    const currentMinutes = hour * 60 + minute;
    const cutoffMinutes = currentMinutes - gracePeriodMinutes;

    const cutoffTime = `${String(
        Math.floor((cutoffMinutes + 1440) % 1440 / 60)
    ).padStart(2, '0')}:${String(
        (cutoffMinutes + 1440) % 60
    ).padStart(2, '0')}`;

    const overdueAppointments = await Appointment.find({
        status: 'Scheduled',
        $or: [
            { date: { $lt: now.date } },
            {
                date: now.date,
                time: { $lte: cutoffTime }
            }
        ]
    }).select('_id patientId');

    for (const item of overdueAppointments) {
        const updated = await Appointment.findOneAndUpdate({
            _id: item._id,
            status: 'Scheduled'
        }, {
            $set: {
                status: 'No Show',
                reserved: false,
                updatedBy: user.id
            }
        }, { new: true });

        if (updated) {
            await AuditLog.create({
                id: `AUD-${Date.now()}-${Math.random()
                    .toString(36).slice(2, 8)}`,
                actorId: user.id,
                actor: user.name,
                action: 'Appointment marked No Show',
                entity: 'Patient',
                entityId: updated.patientId,
                date: new Date().toISOString()
            });
        }
    }
}



/* =========================================================
   WORKSPACE ENDPOINT
========================================================= */


export const workspace = async(req, res) => {
    const user = req.user;

    // Save overdue statuses before fetching workspace appointments.
    await reconcileOverdueAppointments(user);

    const appointmentFilter = appointmentScope(user);
    const recordFilter = consultationScope(user);


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
        Patient.find()
        .sort({ name: 1 }),

        // TEMPORARY CONSULTATION DIAGNOSTICS
        (async() => {
            if (recordFilter === null) {
                console.log(
                    '[Consultation Results]',
                    'No consultations returned: recordFilter is null.'
                );

                return [];
            }

            const records = await Consultation.find(recordFilter)
                .sort({ date: -1 })
                .limit(5)
                .select('id staffId specialty type date')
                .lean();

            console.log('[Consultation Results]', {
                count: records.length,
                records: records.map(record => ({
                    id: record.id,
                    staffId: record.staffId,
                    specialty: record.specialty,
                    type: record.type,
                    date: record.date
                }))
            });

            // Fetch the full records for the actual workspace.
            return Consultation.find(recordFilter)
                .sort({ date: -1 });
        })(),

        Appointment.find(appointmentFilter)
        .sort({
            date: 1,
            time: 1
        }),

        Document.find()
        .sort({ date: -1 }),

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

        Notification.find({
            userId: user.id
        })
        .sort({ createdAt: -1 })
        .limit(100),

        clinicSettings(user),

        dashboardData(user)
    ]);

    res.json({
        patients,
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
    await reconcileOverdueAppointments(req.user);

    const q = text(req.query.q, 'Search', {
        required: true,
        max: 100
    });

    const regex = new RegExp(
        escapeRegex(q),
        'i'
    );

    const patients = await Patient.find({
        $or: [
            { id: regex },
            { name: regex },
            { phone: regex }
        ]
    }).limit(10);

    const ids = patients.map(patient => patient.id);

    const appointmentFilter = appointmentScope(req.user);
    const recordFilter = consultationScope(req.user);

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
        patients,
        consultations,
        appointments
    });
};