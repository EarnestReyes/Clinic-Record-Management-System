import Appointment from '../models/Appointment.js';
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
import {
    activePatient,
    attending,
    audit,
    existing,
    uuid
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

function appointmentScope(user) {
    if (canManageClinicAppointments(user)) {
        return {};
    }

    return { staffId: user.id };
}

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

function hasAppointmentTimePassed(appointment) {
    const now = clinicDateTime();

    if (appointment.date < now.date) return true;
    if (appointment.date > now.date) return false;

    return appointment.time <= now.time;
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
        'staff'
    ].filter(key =>
        body[key] !== undefined &&
        !sameValue(body[key], appointment[key])
    );
}

function canAccessAppointment(user, appointment) {
    return (
        canManageClinicAppointments(user) ||
        sameValue(appointment.staffId, user.id)
    );
}

// GET /appointments
// Administrators and intake nurses: all appointments.
// Clinical professionals: appointments assigned to themselves.
export const listAppointments = async(req, res) => {
    const now = clinicDateTime();

    // Reconcile appointments from previous dates.
    const previousDayAppointments = await Appointment.find({
        status: 'Scheduled',
        date: { $lt: now.date }
    }).select('_id id patientId');

    for (const item of previousDayAppointments) {
        const updated = await Appointment.findOneAndUpdate({
            _id: item._id,
            status: 'Scheduled'
        }, {
            $set: {
                status: 'No Show',
                reserved: false,
                updatedBy: req.user.id
            }
        }, { new: true });

        if (updated) {
            await audit(
                req.user,
                'Appointment marked No Show',
                'Patient',
                updated.patientId
            );
        }
    }

    // Reconcile today's appointments whose start time has passed.
    const overdueToday = await Appointment.find({
        status: 'Scheduled',
        date: now.date,
        time: { $lte: now.time }
    }).select('_id id patientId');

    for (const item of overdueToday) {
        const updated = await Appointment.findOneAndUpdate({
            _id: item._id,
            status: 'Scheduled'
        }, {
            $set: {
                status: 'No Show',
                reserved: false,
                updatedBy: req.user.id
            }
        }, { new: true });

        if (updated) {
            await audit(
                req.user,
                'Appointment marked No Show',
                'Patient',
                updated.patientId
            );
        }
    }

    // TEMPORARY DEBUG LOGS: remove after troubleshooting.
    console.log('APPOINTMENT DEBUG:', {
        userId: req.user ?.id,
        role: req.user ?.role,
        specialty: req.user ?.specialty,
        permissions: permissionsFor(req.user)
    });

    const filter = appointmentScope(req.user);

    console.log('APPOINTMENT FILTER:', filter);

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

    console.log('APPOINTMENT RESULTS:', {
        filter,
        skip,
        limit,
        returnedItems: items.length,
        total
    });

    res.json({ items, total });
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

    res.json(appointment);
};

async function values(body, previous, user) {
    const b = pick(body, [
        'patientId',
        'date',
        'time',
        'duration',
        'type',
        'staffId',
        'staff',
        'status',
        'notes'
    ]);

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
        'staff'
    ].some(key =>
        b[key] !== undefined && !sameValue(b[key], previous[key])
    );

    if (scheduling) {
        await activePatient(v.patientId);
    }

    v.date = date(v.date);

    v.time = text(v.time, 'Time', {
        required: true,
        max: 5
    });

    v.duration = Number(v.duration ?? 30);
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
                await attending({ staffId: user.id })
            );
        } else {
            const selection =
                b.staffId !== undefined ?
                { staffId: b.staffId } :
                b.staff !== undefined ?
                { staff: b.staff } :
                {
                    staffId: v.staffId,
                    staff: v.staff
                };

            Object.assign(v, await attending(selection));
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
    const id = uuid('APT');

    const appointment = await Appointment.create({
        ...v,
        _id: id,
        id,
        createdBy: req.user.id,
        updatedBy: req.user.id
    });

    await audit(
        req.user,
        'Appointment scheduled',
        'Patient',
        appointment.patientId
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
        'staff',
        'status',
        'notes'
    ]);

    let currentStatus = appointment.status;

    // Convert an overdue Scheduled appointment to No Show first.
    // Do not return early: a valid rescheduling request may continue.
    if (
        currentStatus === 'Scheduled' &&
        hasAppointmentTimePassed(appointment)
    ) {
        await markNoShow(appointment, req.user);
        currentStatus = 'No Show';
    }

    const changedFields = scheduleChangedFields(body, appointment);
    const scheduleChanged = changedFields.length > 0;
    const requestedStatus = body.status;

    // No Show and Cancelled appointments may only be rescheduled.
    if (['Cancelled', 'No Show'].includes(currentStatus)) {
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
            appointment.patientId
        );

        return res.json(appointment);
    }

    if (currentStatus !== 'Scheduled') {
        throw new ApiError(
            409,
            'This appointment status cannot be changed.'
        );
    }

    // Validate requested status before performing any changes.
    if (
        requestedStatus !== undefined &&
        !statuses.includes(requestedStatus)
    ) {
        throw new ApiError(
            400,
            'Invalid appointment status.'
        );
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

        if (hasAppointmentTimePassed(appointment)) {
            throw new ApiError(
                409,
                'This appointment has passed its scheduled time and is now marked No Show.'
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
            appointment.patientId
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
            appointment.patientId
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
            appointment.patientId
        );

        return res.json(appointment);
    }

    throw new ApiError(
        409,
        'Use Reschedule to change the appointment schedule.'
    );
};

// Helper used by updateAppointment.
async function markNoShow(appointment, user) {
    appointment.status = 'No Show';
    appointment.reserved = false;
    appointment.updatedBy = user.id;

    await appointment.save();

    await audit(
        user,
        'Appointment marked No Show',
        'Patient',
        appointment.patientId
    );
}