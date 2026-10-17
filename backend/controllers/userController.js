import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { newPasswordReset } from '../utils/passwordReset.js';
import { deliverWelcomeEmail } from '../utils/welcomeEmail.js';
import User from '../models/User.js';
import { nextDisplayReference } from '../utils/displayReference.js';
import Session from '../models/Session.js';
import Appointment from '../models/Appointment.js';
import { validateAvailability, validateBooking } from '../config/availability.js';
import { attending } from './shared.js';
import Notification from '../models/Notification.js';
import { ApiError } from '../middleware/errors.js';
import { roles } from '../models/shared.js';
import { specialtyKeys } from '../config/specialties.js';
import {
    pick,
    text,
    email,
    password,
    choice,
    boolean
} from '../middleware/validation.js';
import { audit, existing, uuid } from './shared.js';

export const listUsers = async(req, res) => {
    res.json(await User.find().sort({ name: 1 }));
};

export const updateAvailability = async (req, res) => {
    if (req.user.role !== 'Administrator') throw new ApiError(403, 'Only administrators can configure doctor schedules.');
    const user = await existing(User, req.params.id);
    await attending({ staffId: user.id });
    const availability = validateAvailability(req.body);
    const bookings = await Appointment.find({ staffId: user.id, status: 'Scheduled' });
    const conflicts = bookings.filter(item => {
        try { validateBooking(availability, item.date, item.time, item.duration); return false; }
        catch { return true; }
    }).map(item => ({ id: item.id, date: item.date, time: item.time }));
    user.availability = availability;
    await user.save();
    await audit(req.user, 'Doctor availability updated', 'User', user.id);
    res.json({ availability: user.availability, conflicts });
};

// Clinic Staff must have a valid professional specialty.
// Administrators may have a specialty or none.
const specialtyFor = (role, value) => {
    if (role === 'Administrator' && (value === undefined || value === '')) {
        return '';
    }

    if (value === undefined || value === '') {
        throw new ApiError(
            400,
            'A professional specialty is required for Clinic Staff.'
        );
    }

    return choice(value, specialtyKeys, 'Professional specialty');
};

export const createUser = async(req, res, config = {}) => {
    const b = pick(req.body, [
        'name',
        'email',
        'password',
        'role',
        'specialty',
        'active'
    ]);

    const id = uuid('U');
    const role = choice(b.role, roles, 'Role');
    const specialty = specialtyFor(role, b.specialty);
    if (b.password !== undefined) password(b.password);
    const setup = newPasswordReset();

    const user = await User.create({
        _id: id,
        id,
        displayReference: await nextDisplayReference('U', specialty, role),
        name: text(b.name, 'Name', {
            required: true,
            max: 120
        }),
        email: email(b.email),
        // No administrator-supplied credential can sign in. The recipient sets
        // their own password through the existing atomic reset endpoint.
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        ...setup.fields,
        awaitingPasswordSetup: true,
        setupEmailRequestedAt: new Date(),
        role,
        specialty,
        active: b.active === undefined ?
            true :
            boolean(b.active, 'Active')
    });

    // Only the request that wins the unique-email insert sends a welcome email.
    // SMTP failure must never turn a saved account into a retriable creation error.
    const welcomeEmailStatus = await deliverWelcomeEmail(user, setup, config);

    await audit(req.user, 'User created', 'User', id);

    const notificationId = uuid('N');

    await Notification.create({
        _id: notificationId,
        id: notificationId,
        userId: id,
        scopeVersion: 1,
        recipientRole: user.role,
        recipientSpecialty: user.specialty || '',
        title: 'Welcome to Careline',
        text: 'Your clinic workspace is ready.',
        route: 'dashboard'
    });

    res.status(201).json({ ...user.toJSON(), welcomeEmailStatus });
};

export const resendSetupEmail = async (req, res, config) => {
    if (req.user.role !== 'Administrator') throw new ApiError(403, 'Administrator access required.');
    const user = await existing(User, req.params.id);
    if (!user.active || user.awaitingPasswordSetup !== true) throw new ApiError(409, 'This account is not awaiting password setup. Use Forgot Password for existing accounts.');
    const current = await User.findById(user.id).select('+sessionVersion');
    const version = current.sessionVersion || 0;
    const setup = newPasswordReset(version);
    const claimed = await User.findOneAndUpdate({ _id: user.id, email: user.email, active: true, awaitingPasswordSetup: true,
        $expr: { $eq: [{ $ifNull: ['$sessionVersion', 0] }, version] },
        $or: [{ setupEmailRequestedAt: { $exists: false } }, { setupEmailRequestedAt: { $lte: new Date(Date.now() - 60000) } }]
    }, { $set: { ...setup.fields, setupEmailRequestedAt: new Date() } }, { new: true });
    if (!claimed) throw new ApiError(409, 'Setup email was requested recently or the account changed. Wait one minute, then refresh and retry.');
    const welcomeEmailStatus = await deliverWelcomeEmail(claimed, setup, config);
    await audit(req.user, 'Setup email requested', 'User', user.id);
    res.json({ welcomeEmailStatus });
};

export const updateUser = async(req, res) => {
    const user = await existing(User, req.params.id);

    const b = pick(req.body, [
        'name',
        'email',
        'password',
        'role',
        'specialty',
        'active'
    ]);

    const nextRole = b.role !== undefined ?
        choice(b.role, roles, 'Role') :
        user.role;

    // Prevent an administrator from removing their own access.
    if (
        user.id === req.user.id &&
        (
            (b.role !== undefined && nextRole !== 'Administrator') ||
            b.active === false
        )
    ) {
        throw new ApiError(
            400,
            'You cannot remove your own administrator access.'
        );
    }

    // Preserve the last active administrator safeguard.
    if (
        user.active &&
        user.role === 'Administrator' &&
        (
            b.active === false ||
            (b.role !== undefined && nextRole !== 'Administrator')
        ) &&
        await User.countDocuments({
            active: true,
            role: 'Administrator'
        }) <= 1
    ) {
        throw new ApiError(
            409,
            'At least one active administrator is required.'
        );
    }

    if (b.name !== undefined) {
        user.name = text(b.name, 'Name', {
            required: true,
            max: 120
        });
    }

    if (b.email !== undefined) {
        user.email = email(b.email);
        user.pendingEmail = '';
    }

    const roleChanged = b.role !== undefined && nextRole !== user.role;

    user.role = nextRole;

    // Validate an explicitly supplied specialty.
    if (b.specialty !== undefined) {
        user.specialty = specialtyFor(nextRole, b.specialty);
    } else if (nextRole === 'Clinic Staff' && roleChanged) {
        // Changing role to Clinic Staff requires a valid specialty. Unrelated
        // edits to legacy staff above preserve their existing stored value.
        user.specialty = specialtyFor(
            nextRole,
            user.specialty || undefined
        );
    } else if (roleChanged && nextRole === 'Administrator') {
        // Preserve an existing valid specialty when promoting staff.
        // Administrators may also have no specialty.
        user.specialty = user.specialty &&
            specialtyKeys.includes(user.specialty) ?
            user.specialty :
            '';
    }

    if (b.active !== undefined) {
        user.active = boolean(b.active, 'Active');
    }

    if (b.password) {
        user.awaitingPasswordSetup = false;
        user.passwordResetHash = undefined;
        user.passwordResetExpiresAt = undefined;
        user.passwordResetVersion = undefined;
        user.passwordHash = await bcrypt.hash(
            password(b.password),
            12
        );
    }

    await user.save();

    // Preserve session invalidation behavior.
    if (b.password || b.active === false) {
        await Session.deleteMany({ userId: user.id });
    }

    await audit(req.user, 'User edited', 'User', user.id);

    res.json(user);
};
