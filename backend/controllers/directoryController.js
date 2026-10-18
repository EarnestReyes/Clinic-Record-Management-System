import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import { publicSpecialties } from '../config/specialties.js';
import { ApiError } from '../middleware/errors.js';
import {
    clinicToday,
    date,
    appointmentSlots
} from '../middleware/validation.js';
import { statuses } from '../models/shared.js';
import {
    activityForPatients,
    activityCounts
} from './activityController.js';

// Read-only directory metadata.
// No clinical content or assignment writes belong here.
export async function directoryData(user) {
    if (user ?.role !== 'Administrator') {
        throw new ApiError(
            403,
            'Administrator access is required.'
        );
    }

    const now = new Date();

    const specialties = publicSpecialties()
        .filter(item => item.kind === 'clinical')
        .map(({ key, label }) => ({ key, label }));

    const [
        doctors,
        patients,
        appointments,
        consultations
    ] = await Promise.all([
        User.find({
            role: { $in: ['Administrator', 'Clinic Staff'] },
            specialty: { $in: specialties.map(item => item.key) }
        })
        .select('id displayReference name specialty active')
        .sort({ name: 1 }),

        Patient.find()
        .select('id name status assignedStaffId')
        .sort({ name: 1 }),

        Appointment.find()
        .select(
            'id displayReference patientId staffId specialty status date time duration'
        )
        .sort({ date: 1, time: 1 }),

        Consultation.find()
        .select('patientId staffId specialty date')
    ]);

    const patientMap = new Map(
        patients.map(patient => [patient.id, patient])
    );

    const clinicActivity = activityForPatients(
        patients,
        consultations,
        appointments,
        doctors, { now }
    );

    const doctorMap = new Map(
        doctors.map(doctor => [doctor.id, doctor])
    );

    const relationships = new Map(
        doctors.map(doctor => [doctor.id, new Map()])
    );

    const activePatients = new Set();

    let uncertainAppointments = 0;
    let uncertainConsultations = 0;

    const relationship = (doctorId, patientId) => {
        const group = relationships.get(doctorId);

        if (!group.has(patientId)) {
            const patient = patientMap.get(patientId);

            group.set(patientId, {
                id: patient.id,
                name: patient.name,
                status: patient.status,
                active: false,
                historical: false,
                routingOnly: false,
                consultationCount: 0,
                lastConsultation: '',
                appointments: []
            });
        }

        return group.get(patientId);
    };

    // Build doctor–patient relationships from valid appointments.
    for (const appointment of appointments) {
        const doctor = doctorMap.get(appointment.staffId);
        const patient = patientMap.get(appointment.patientId);

        let valid = Boolean(
            doctor &&
            patient &&
            appointment.specialty === doctor.specialty &&
            statuses.includes(appointment.status)
        );

        try {
            date(appointment.date);
            appointmentSlots(
                appointment.time,
                appointment.duration ?? 30
            );
        } catch {
            valid = false;
        }

        if (!valid) {
            uncertainAppointments++;
            continue;
        }

        const item = relationship(doctor.id, patient.id);

        item.appointments.push({
            id: appointment.id,
            displayReference: appointment.displayReference,
            status: appointment.status,
            date: appointment.date,
            time: appointment.time
        });

        // A completed appointment preserves the historical
        // relationship with this doctor.
        if (appointment.status === 'Completed') {
            item.historical = true;
        }

        // Only valid Scheduled appointments can establish
        // an active relationship.
        if (
            appointment.status === 'Scheduled' &&
            patient.status === 'Active' &&
            doctor.active === true
        ) {
            item.active = true;
            activePatients.add(patient.id);
        }
    }

    // Existing clinical consultations also preserve
    // the historical doctor–patient relationship.
    for (const consultation of consultations) {
        const doctor = doctorMap.get(consultation.staffId);
        const patient = patientMap.get(consultation.patientId);

        let valid = Boolean(
            doctor &&
            patient &&
            consultation.specialty === doctor.specialty
        );

        try {
            date(consultation.date);
        } catch {
            valid = false;
        }

        if (!valid) {
            uncertainConsultations++;
            continue;
        }

        const item = relationship(doctor.id, patient.id);

        item.historical = true;
        item.consultationCount++;

        if (consultation.date > item.lastConsultation) {
            item.lastConsultation = consultation.date;
        }
    }

    // Routing alone is not proof of active care.
    // Keep unresolved routing visible for administrator review.
    for (const patient of patients) {
        if (doctorMap.has(patient.assignedStaffId)) {
            const item = relationship(
                patient.assignedStaffId,
                patient.id
            );

            item.routingOnly = !item.active && !item.historical;
        }
    }

    const today = clinicToday();

    const groups = specialties
        .map(specialty => ({
            ...specialty,

            doctors: doctors
                .filter(doctor => doctor.specialty === specialty.key)
                .map(doctor => {
                    const allRelatedPatients = [
                        ...relationships.get(doctor.id).values()
                    ];

                    // Hide patients whose only relationship with this
                    // doctor consists of Cancelled or No Show appointments.
                    //
                    // Preserve patients who have:
                    // - a valid active Scheduled appointment;
                    // - a Completed appointment; or
                    // - an existing clinical consultation.
                    const relatedPatients = allRelatedPatients.filter(
                        item => item.active || item.historical
                    );

                    const doctorActivity = activityForPatients(
                        relatedPatients,
                        consultations,
                        appointments,
                        doctors, {
                            doctorId: doctor.id,
                            now
                        }
                    );

                    const items = relatedPatients.map(item => ({
                        ...item,

                        activity: doctorActivity.get(item.id),
                        clinicActivity: clinicActivity.get(item.id),

                        upcoming: [...item.appointments]
                            .sort((a, b) =>
                                `${a.date} ${a.time}`.localeCompare(
                                    `${b.date} ${b.time}`
                                )
                            )
                            .find(
                                appointment =>
                                appointment.status === 'Scheduled' &&
                                appointment.date >= today
                            ) || null,

                        appointmentCounts: Object.fromEntries(
                            [
                                'Scheduled',
                                'Completed',
                                'Cancelled',
                                'No Show'
                            ].map(status => [
                                status,
                                item.appointments.filter(
                                    appointment => appointment.status === status
                                ).length
                            ])
                        )
                    }));

                    return {
                        id: doctor.id,
                        displayReference: doctor.displayReference,
                        name: doctor.name,
                        active: doctor.active === true,
                        specialty: doctor.specialty,

                        activeCount: items.filter(
                            item => item.active
                        ).length,

                        historicalCount: items.filter(
                            item => item.historical
                        ).length,

                        activityCounts: activityCounts(
                            relatedPatients,
                            doctorActivity
                        ),

                        patients: items
                    };
                })
        }))
        .filter(group => group.doctors.length);

    return {
        generatedAt: new Date().toISOString(),
        timezone: 'Asia/Manila',

        activityCounts: activityCounts(
            patients,
            clinicActivity
        ),

        totals: {
            patients: patientMap.size,

            activePatients: activePatients.size,

            activeRelationships: groups.reduce(
                (sum, group) =>
                sum +
                group.doctors.reduce(
                    (count, doctor) => count + doctor.activeCount,
                    0
                ),
                0
            ),

            archivedPatients: patients.filter(
                patient => patient.status === 'Archived'
            ).length,

            doctors: doctorMap.size
        },

        groups,

        // Clinic-wide patient profiles are not deleted or removed
        // just because a doctor has no qualifying relationship.
        unassigned: patients
            .filter(
                patient =>
                patient.status === 'Active' &&
                !activePatients.has(patient.id)
            )
            .map(patient => ({
                id: patient.id,
                name: patient.name,
                status: patient.status,
                activity: clinicActivity.get(patient.id),
                routedDoctor: doctorMap.get(patient.assignedStaffId) ?.name || '',
                routingNeedsReview: Boolean(patient.assignedStaffId)
            })),

        review: {
            uncertainAppointments,
            uncertainConsultations,
            routingHasActiveState: false
        }
    };
}

export const doctorPatientDirectory = async(req, res) => {
    res.json(await directoryData(req.user));
};