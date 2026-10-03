export function appointmentGradient(appointments) {
  let end = 0;
  const colors = ["#0f9985", "#9b91ea", "#f4b56a", "#b5bfc9", "#e18c8c"];
  const slices = ["Confirmed", "Pending", "Completed", "Cancelled", "No Show"].map((status, i) => {
    const start = end;
    end += appointments.filter(a => a.status === status).length / Math.max(appointments.length, 1) * 100;
    return `${colors[i]} ${start}% ${end}%`;
  });
  return appointments.length ? `conic-gradient(${slices.join(", ")})` : "#e1e7e9";
}
