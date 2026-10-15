export function appointmentGradient(appointments) {
    let end = 0;

    const statuses = [
        { name: "Scheduled", color: "#0f9985" },
        { name: "Completed", color: "#f4b56a" },
        { name: "Cancelled", color: "#b5bfc9" },
        { name: "No Show", color: "#e18c8c" }
    ];

    const total = appointments.length;

    if (total === 0) {
        return "#e1e7e9";
    }

    const slices = statuses.map(({ name, color }) => {
        const start = end;

        end += (
            appointments.filter(appointment => appointment.status === name).length /
            total
        ) * 100;

        return `${color} ${start}% ${end}%`;
    });

    return `conic-gradient(${slices.join(", ")})`;
}