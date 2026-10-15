import Appointment from '../models/Appointment.js';
import { clinicToday } from '../middleware/validation.js';

export async function reconcileOverdueAppointments() {
    const today = clinicToday();

    const result = await Appointment.updateMany({
        status: 'Scheduled',
        date: { $lt: today },
    }, {
        $set: {
            status: 'No Show',
            reserved: false,
        },
    });

    return result.modifiedCount;
}

export function startAppointmentScheduler(config) {
    const settings = config.appointmentScheduler;

    if (!settings ?.enabled) {
        console.info('[Appointment Scheduler] Disabled.');
        return null;
    }

    const intervalMs = Number(settings.intervalMs);

    if (!Number.isFinite(intervalMs) || intervalMs < 10000) {
        throw new Error(
            'appointmentScheduler.intervalMs must be at least 10000.'
        );
    }

    let running = false;

    const run = async() => {
        if (running) return;

        running = true;

        try {
            const updated = await reconcileOverdueAppointments();

            if (updated > 0) {
                console.info(
                    `[Appointment Scheduler] Marked ${updated} overdue appointment(s) as No Show.`
                );
            }
        } catch (error) {
            console.error(
                '[Appointment Scheduler] Reconciliation failed:',
                error
            );
        } finally {
            running = false;
        }
    };

    void run();

    const timer = setInterval(() => {
        void run();
    }, intervalMs);

    timer.unref ?.();

    return timer;
}