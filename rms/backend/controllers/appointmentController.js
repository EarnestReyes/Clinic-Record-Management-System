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
    return permissionsFor(user).intake;
}

function appointmentScope(user) {
    return user.role === 'Administrator' || isIntakeNurse(user) ? {} : { staffId: user.id };
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

    res.json({ items, total });
};

export const getAppointment = async(req, res) => {
    const appointment = await existing(Appointment, req.params.id);

    if (
        req.user.role !== 'Administrator' &&
        !isIntakeNurse(req.user) &&
        appointment.staffId !== req.user.id
    ) {
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
    const intakeNurse = isIntakeNurse(user);
    const selfOnly =
        user.role !== 'Administrator' && !intakeNurse;

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
        b[key] !== undefined &&
        String(b[key]) !== String(previous[key] ?? '')
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

    // Enforce the future-date/time rule on the server.
    // This runs for new appointments and schedule changes.
    if (scheduling) {
        validateFutureSchedule(v.date, v.time);

        if (selfOnly) {
            if (
                b.staffId !== undefined &&
                b.staffId !== user.id
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

            // Clinical professionals are always assigned to themselves.
            Object.assign(v, await attending({ staffId: user.id }));
        } else {
            // Administrators and intake nurses may choose an active attendee.
            const selection =
                b.staffId !== undefined ? { staffId: b.staffId } :
                b.staff !== undefined ? { staff: b.staff } : {
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

    v.reserved = !['Cancelled', 'No Show'].includes(v.status);

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

export const updateAppointment = async(req, res) => {
    const appointment = await existing(Appointment, req.params.id);

    if (
        req.user.role !== 'Administrator' &&
        !isIntakeNurse(req.user) &&
        appointment.staffId !== req.user.id
    ) {
        throw new ApiError(
            403,
            'You cannot modify this appointment.'
        );
    }

    const currentStatus = appointment.status;
    const today = clinicToday();
    const currentDate = appointment.date;

    // Completed appointments are permanently locked.
    if (currentStatus === 'Completed') {
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

    const scheduleFields = [
        'patientId',
        'date',
        'time',
        'duration',
        'staffId',
        'staff'
    ];

    const scheduleChanged = scheduleFields.some(key =>
        body[key] !== undefined &&
        String(body[key]) !== String(appointment[key] ?? '')
    );

    const requestedStatus = body.status;

    // Past scheduled appointments become No Show when reconciled.
    if (currentStatus === 'Scheduled' && currentDate < today) {
        appointment.status = 'No Show';
        appointment.reserved = false;
        appointment.updatedBy = req.user.id;

        await appointment.save();

        await audit(
            req.user,
            'Appointment marked No Show',
            'Patient',
            appointment.patientId
        );

        return res.json(appointment);
    }

    // Cancelled and No Show appointments can only be rescheduled.
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

    // Future appointments can only be rescheduled or cancelled.
    if (currentDate > today) {
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

        if (!scheduleChanged || !body.date || !body.time) {
            throw new ApiError(
                409,
                'Future appointments can only be rescheduled or cancelled.'
            );
        }
    }

    // Today's appointments may be completed or cancelled.
    if (currentDate === today) {
        if (requestedStatus === 'Completed' && !scheduleChanged) {
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

        if (
            requestedStatus &&
            !['Scheduled', 'Completed', 'Cancelled'].includes(requestedStatus)
        ) {
            throw new ApiError(
                409,
                'Invalid appointment status transition.'
            );
        }
    }

    // Reschedule a Scheduled appointment.
    if (scheduleChanged) {
        if (!body.date || !body.time) {
            throw new ApiError(
                400,
                'A new date and time are required to reschedule.'
            );
        }

        const newDate = date(body.date);

        validateFutureSchedule(newDate, body.time);

        if (
            requestedStatus &&
            requestedStatus !== 'Scheduled'
        ) {
            throw new ApiError(
                409,
                'Rescheduling keeps the appointment status as Scheduled.'
            );
        }

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