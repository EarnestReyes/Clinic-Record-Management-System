// Confirmation, arrival and attendance are not reliably stored by the current model.
// Do not infer No Show from the clock. Preserve server.js lifecycle exports while
// authorized staff confirm absence through PATCH /appointments/:id instead.
export async function reconcileOverdueAppointments() {
    return 0;
}

export function startAppointmentScheduler() {
    console.info('[Appointment Scheduler] Automatic No Show disabled; staff confirmation is required.');
    return null;
}
