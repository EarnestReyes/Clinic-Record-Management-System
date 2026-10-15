export function appointmentGradient(appointments) {
    let end = 0;

    const statuses = [
        { name: "Scheduled", color: "#0f9985" },
        { name: "Completed", color: "#f4b56a" },
        { name: "Cancelled", color: "#b5bfc9" },
        { name: "No Show", color: "#e18c8c" }
    ];

    const count = status => Array.isArray(appointments) ? appointments.filter(appointment => appointment.status === status).length : Number(appointments[status] || 0);
    const total = statuses.reduce((sum, status) => sum + count(status.name), 0);

    if (total === 0) {
        return "#e1e7e9";
    }

    const slices = statuses.map(({ name, color }) => {
        const start = end;

        end += (
            count(name) /
            total
        ) * 100;

        return `${color} ${start}% ${end}%`;
    });

    return `conic-gradient(${slices.join(", ")})`;
}
