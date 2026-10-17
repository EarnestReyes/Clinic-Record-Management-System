import Appointment from '../models/Appointment.js';
import { nextDisplayReference } from '../utils/displayReference.js';
import { withAppointmentPatients } from './appointmentPatients.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { scheduleSlots, validateBooking, validateAvailability, overlaps } from '../config/availability.js';
import AuditLog from '../models/AuditLog.js';
import { statuses } from '../models/shared.js';
import {
    pick,
    text,
    date,
    choice,
    appointmentSlots,
    pagination,
    clinicToday
} from '../middleware/validation.js';
import { ApiError } from '../middleware/errors.js';
import { permissionsFor } from '../middleware/permissions.js';
import { appointmentScope as scopedAppointments } from '../middleware/accessScopes.js';
import {
    activePatient,
    attending,
    audit,
    existing,
    uuid,
    notifyAudit
} from './shared.js';

function isIntakeNurse(user) {
    return permissionsFor(user).intake === true;
}

function isAdministrator(user) {
    return user.role === 'Administrator';
}

function canManageClinicAppointments(user) {
    return isAdministrator(user) || isIntakeNurse(user);
}

export const appointmentScope = scopedAppointments;

export const availableSlots = async(req, res) => {
    if (!canManageClinicAppointments(req.user) && !permissionsFor(req.user).createConsultation) throw new ApiError(403, 'Scheduling access is required.');
    if (!canManageClinicAppointments(req.user) && req.params.id !== req.user.id) throw new ApiError(403, 'You can only view your own scheduling availability.');
    const doctor = await existing(User, req.params.id);
    await attending({ staffId: doctor.id });
    const day = date(req.query.date);
    const bookings = await Appointment.find({ staffId: doctor.id, date: day, status: 'Scheduled' });
    let excluded;
    if (req.query.exclude) {
        excluded = await existing(Appointment, text(req.query.exclude, 'Appointment ID', { max: 100 }));
        if (!canAccessAppointment(req.user, excluded)) throw new ApiError(403, 'You cannot access this appointment.');
    }
    const current = clinicDateTime();
    const slots = scheduleSlots(doctor.availability, day).map(slot => ({...slot,
        booked: bookings.some(item => item.id !== excluded ?.id && overlaps(slot.time, slot.duration, item)),
        past: day < current.date || (day === current.date && slot.time <= current.time)
    }));
    res.json({ timezone: 'Asia/Manila', availability: doctor.availability || null, slots });
};

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

function validateFutureSchedule(appointmentDate, appointmentTime) {
    const current = clinicDateTime();

    if (appointmentDate < current.date) {
        throw new ApiError(
            400,
            'Appointments cannot be scheduled for a past date.'
        );
    }

    if (
        appointmentDate === current.date &&
        appointmentTime <= current.time
    ) {
        throw new ApiError(
            400,
            'Appointments must be scheduled for a future time.'
        );
    }
}


function sameValue(a, b) {
    return String(a ?? '') === String(b ?? '');
}

function scheduleChangedFields(body, appointment) {
    return [
        'patientId',
        'date',
        'time',
        'duration',
        'staffId',
        'specialty',
        'staff'
    ].filter(key =>
        body[key] !== undefined &&
        !sameValue(body[key], appointment[key])
    );
}

function canAccessAppointment(user, appointment) {
    return (
        canManageClinicAppointments(user) ||
        (permissionsFor(user).createConsultation && sameValue(appointment.staffId, user.id) && appointment.specialty === permissionsFor(user).specialty)
    );
}

// GET /appointments
// Administrators and intake nurses: all appointments.
// Clinical professionals: appointments assigned to themselves.
export const listAppointments = async(req, res) => {
    const filter = appointmentScope(req.user);

    if (req.query.patientId) {
        filter.patientId = text(req.query.patientId, 'Patient ID', {
            max: 100
        });
    }

    if (req.query.date) {
        filter.date = date(req.query.date);
    }

    if (req.query.status) {
        filter.status = choice(req.query.status, statuses, 'Status');
    }

    const { skip, limit } = pagination(req.query);

    const [items, total] = await Promise.all([
        Appointment.find(filter)
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(limit),
        Appointment.countDocuments(filter)
    ]);

    res.json({ items: await withAppointmentPatients(items), total });
};

// GET /appointments/:id
export const getAppointment = async(req, res) => {
    const appointment = await existing(Appointment, req.params.id);

    if (!canAccessAppointment(req.user, appointment)) {
        throw new ApiError(
            403,
            'You cannot access this appointment.'
        );
    }

    res.json((await withAppointmentPatients([appointment]))[0]);
};

async function values(body, previous, user) {
    if (!canManageClinicAppointments(user) && !permissionsFor(user).createConsultation) {
        throw new ApiError(403, 'Your account cannot schedule appointments.');
    }
    const b = pick(body, [
        'patientId',
        'date',
        'time',
        'duration',
        'type',
        'staffId',
        'specialty',
        'staff',
        'status',
        'notes'
    ]);

    if (!canManageClinicAppointments(user)) {
        if (b.staffId !== undefined && !sameValue(b.staffId, user.id)) {
            throw new ApiError(403, 'You can only schedule appointments assigned to yourself.');
        }
        const assignment = await attending({ staffId: user.id });
        const account = await User.findById(user.id);
        if (!account ?.availability ?.weekdays ?.length) throw new ApiError(400, 'Your doctor availability is not configured. Ask an administrator to configure it.');
        validateAvailability(account.availability);
        Object.assign(b, assignment);
    }
    if (!previous && b.status !== undefined && b.status !== 'Scheduled') {
        throw new ApiError(400, 'New appointments must have Scheduled status.');
    }
    if (!previous && (!b.staffId || !b.specialty)) {
        throw new ApiError(400, 'Select a specialty and assigned doctor.');
    }
    const v = {...previous, ...b };
    const clinicManager = canManageClinicAppointments(user);
    const selfOnly = !clinicManager;

    v.patientId = text(v.patientId, 'Patient', {
        required: true,
        max: 100
    });

    const scheduling = !previous || [
        'patientId',
        'date',
        'time',
        'duration',
        'staffId',
        'specialty',
        'staff'
    ].some(key =>
        b[key] !== undefined && !sameValue(b[key], previous[key])
    );

    if (scheduling) {
        await activePatient(v.patientId, user);
    }

    v.date = date(v.date);

    v.time = text(v.time, 'Time', {
        required: true,
        max: 5
    });

    const doctor = scheduling ? await User.findById(v.staffId) : null;
    v.duration = Number(v.duration ?? doctor ?.availability ?.duration ?? 30);
    v.slots = appointmentSlots(v.time, v.duration);

    if (scheduling) {
        validateFutureSchedule(v.date, v.time);

        if (selfOnly) {
            if (
                b.staffId !== undefined &&
                !sameValue(b.staffId, user.id)
            ) {
                throw new ApiError(
                    403,
                    'You can only schedule appointments assigned to yourself.'
                );
            }

            if (
                b.staff !== undefined &&
                b.staff !== user.name &&
                b.staff !== `Dr. ${user.name}` &&
                b.staff !== previous ?.staff
            ) {
                throw new ApiError(
                    403,
                    'You can only schedule appointments assigned to yourself.'
                );
            }

            Object.assign(
                v,
                await attending({ staffId: user.id }, v.specialty)
            );
        } else {
            const selection =
                b.staffId !== undefined ? { staffId: b.staffId } :
                b.staff !== undefined ? { staff: b.staff } : {
                    staffId: v.staffId,
                    staff: v.staff
                };

            Object.assign(v, await attending(selection, v.specialty));
        }
        const selectedDoctor = await User.findById(v.staffId);
        validateBooking(selectedDoctor ?.availability, v.date, v.time, v.duration);
        // Include legacy Scheduled records even if reservation metadata is missing.
        for (const [field, label] of [['patientId', 'patient'], ['staffId', 'doctor']]) {
            const bookings = await Appointment.find({ [field]: v[field], date: v.date, status: 'Scheduled' });
            const conflict = bookings.find(item => item.id !== previous?.id && overlaps(v.time, v.duration, item));
            if (conflict) {
                let detail = '';
                if (canAccessAppointment(user, conflict)) {
                    const start = conflict.time.split(':').map(Number);
                    const end = start[0] * 60 + start[1] + Number(conflict.duration ?? 30);
                    const endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
                    detail = ` on ${conflict.date}, ${conflict.time}–${endTime} (Asia/Manila), ${conflict.staff}${conflict.specialty ? ` / ${conflict.specialty}` : ''}`;
                }
                throw new ApiError(409, `This ${label} already has an overlapping appointment${detail}. Choose another time.`);
            }
        }
        if (!await Appointment.collection.indexExists('staffId_1_date_1_slots_1') ||
            !await Appointment.collection.indexExists('patientId_1_date_1_slots_1')) {
            throw new ApiError(503, 'Booking protection is unavailable. Ask an administrator to verify the appointment index.');
        }
    }

    v.type = text(v.type, 'Appointment type', {
        required: true,
        max: 120
    });

    v.notes = text(v.notes, 'Notes');

    v.status = previous ?
        choice(v.status ?? previous.status, statuses, 'Status') :
        'Scheduled';

    v.reserved = ![
        'Cancelled',
        'No Show',
        'Completed'
    ].includes(v.status);

    return pick(v, [
        'patientId',
        'date',
        'time',
        'duration',
        'type',
        'staffId',
        'specialty',
        'staff',
        'status',
        'notes',
        'slots',
        'reserved'
    ]);
}

// POST /appointments

export const createAppointment = async(req, res) => {
    const v = await values(req.body, null, req.user);

    // Keep the existing permanent appointment ID.
    const id = uuid('APT');

    // Resolve the actual assigned clinician.
    const assignedDoctor = await User.findById(v.staffId);

    if (!assignedDoctor) {
        throw new ApiError(400, 'The assigned doctor could not be found.');
    }

    // Generate the display reference using the assigned doctor's specialty.
    const displayReference = await nextDisplayReference(
        'APT',
        assignedDoctor.specialty,
        assignedDoctor.role
    );

    const appointment = await Appointment.create({
        ...v,
        _id: id,
        id,
        displayReference,
        createdBy: req.user.id,
        updatedBy: req.user.id
    });

    await audit(
        req.user,
        'Appointment scheduled',
        'Patient',
        appointment.patientId,
        appointment
    );

    res.status(201).json(appointment);
};


// PATCH /appointments/:id
export const updateAppointment = async(req, res) => {
    const appointment = await existing(Appointment, req.params.id);

    const administrator = isAdministrator(req.user);
    const intakeNurse = isIntakeNurse(req.user);

    if (!canAccessAppointment(req.user, appointment)) {
        throw new ApiError(
            403,
            'You cannot modify this appointment.'
        );
    }

    if (appointment.status === 'Completed') {
        throw new ApiError(
            409,
            'Completed appointments cannot be changed or rescheduled.'
        );
    }

    const body = pick(req.body, [
        'patientId',
        'date',
        'time',
        'duration',
        'type',
        'staffId',
        'specialty',
        'staff',
        'status',
        'notes'
    ]);

    const currentStatus = appointment.status;
    const requestedStatus = body.status;
    if (intakeNurse && requestedStatus === 'Completed') {
        throw new ApiError(403, 'General Nurses cannot complete appointments.');
    }
    if (requestedStatus !== undefined && !statuses.includes(requestedStatus)) {
        throw new ApiError(400, 'Invalid appointment status.');
    }

    const changedFields = scheduleChangedFields(body, appointment);
    const scheduleChanged = changedFields.length > 0;

    // No Show and Cancelled appointments may only be rescheduled.
    if (['Cancelled', 'No Show'].includes(currentStatus)) {
        if (requestedStatus !== undefined && requestedStatus !== 'Scheduled') {
            throw new ApiError(409, 'This appointment can only be rescheduled.');
        }
        if (!scheduleChanged || !body.date || !body.time) {
            throw new ApiError(
                409,
                'This appointment can only be rescheduled. Choose a new date and time.'
            );
        }

        const newDate = date(body.date);
        validateFutureSchedule(newDate, body.time);

        const updated = await values({
                ...appointment.toObject(),
                ...body,
                date: newDate,
                status: 'Scheduled'
            },
            appointment.toObject(),
            req.user
        );

        Object.assign(appointment, updated, {
            status: 'Scheduled',
            reserved: true,
            updatedBy: req.user.id
        });

        await appointment.save();

        await audit(
            req.user,
            'Appointment rescheduled',
            'Patient',
            appointment.patientId,
            appointment
        );

        return res.json(appointment);
    }

    if (currentStatus !== 'Scheduled') {
        throw new ApiError(
            409,
            'This appointment status cannot be changed.'
        );
    }

    // No reliable arrival tracking exists: staff must explicitly attest absence.
    if (requestedStatus === 'No Show' && !scheduleChanged) {
        if (req.body.confirmNoAttendance !== true) {
            throw new ApiError(400, 'Confirm that this appointment was confirmed and the patient did not arrive or attend.');
        }
        const start = Date.parse(appointment.date + 'T' + appointment.time + ':00+08:00');
        if (!Number.isFinite(start) || Date.now() < start + 10 * 60 * 1000) {
            throw new ApiError(409, 'No Show can only be confirmed after the 10-minute grace period.');
        }
        await mongoose.connection.transaction(async session => {
            appointment.status = 'No Show';
            appointment.reserved = false;
            appointment.updatedBy = req.user.id;
            await appointment.save({ session });
            const id = uuid('LOG');
            await AuditLog.create([{
                _id: id,
                id,
                action: 'Appointment marked No Show',
                detail: `Patient · ${appointment.patientId}`,
                actor: req.user.name,
                actorId: req.user.id,
                recordType: 'Patient',
                recordId: appointment.patientId
            }], { session });
        });
        await notifyAudit('Appointment marked No Show', 'Patient', appointment.patientId, appointment);
        return res.json(appointment);
    }

    // Completion is only available to administrators and clinical
    // professionals assigned to this appointment, on its scheduled day.
    if (requestedStatus === 'Completed' && !scheduleChanged) {
        if (intakeNurse && !administrator) {
            throw new ApiError(
                403,
                'Only clinical professionals or administrators can complete appointments.'
            );
        }

        if (appointment.date !== clinicToday()) {
            throw new ApiError(
                409,
                'Only appointments scheduled for today can be completed.'
            );
        }

        appointment.status = 'Completed';
        appointment.reserved = false;
        appointment.updatedBy = req.user.id;

        await appointment.save();

        await audit(
            req.user,
            'Appointment completed',
            'Patient',
            appointment.patientId,
            appointment
        );

        return res.json(appointment);
    }

    // Cancellation does not change the appointment schedule.
    if (requestedStatus === 'Cancelled' && !scheduleChanged) {
        appointment.status = 'Cancelled';
        appointment.reserved = false;
        appointment.updatedBy = req.user.id;

        await appointment.save();

        await audit(
            req.user,
            'Appointment cancelled',
            'Patient',
            appointment.patientId,
            appointment
        );

        return res.json(appointment);
    }

    // Other status-only changes are not permitted.
    if (
        requestedStatus !== undefined &&
        requestedStatus !== 'Scheduled'
    ) {
        throw new ApiError(
            409,
            'Invalid appointment status transition.'
        );
    }

    // Rescheduling requires a new date and time.
    if (scheduleChanged) {
        if (!body.date || !body.time) {
            throw new ApiError(
                400,
                'A new date and time are required to reschedule.'
            );
        }

        const newDate = date(body.date);
        validateFutureSchedule(newDate, body.time);

        const updated = await values({
                ...appointment.toObject(),
                ...body,
                date: newDate,
                status: 'Scheduled'
            },
            appointment.toObject(),
            req.user
        );

        Object.assign(appointment, updated, {
            status: 'Scheduled',
            reserved: true,
            updatedBy: req.user.id
        });

        await appointment.save();

        await audit(
            req.user,
            'Appointment rescheduled',
            'Patient',
            appointment.patientId,
            appointment
        );

        return res.json(appointment);
    }

    throw new ApiError(
        409,
        'Use Reschedule to change the appointment schedule.'
    );
};
