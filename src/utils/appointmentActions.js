// These actions mirror existing backend roles; professional labels never grant RBAC.
export function appointmentActions(appointment, user, now = new Date()) {
  const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const administrator = user?.role === 'Administrator';
  const intake = user?.role === 'Clinic Staff' && user?.permissions?.intake === true;
  const assigned = user?.role === 'Clinic Staff' && user?.permissions?.createConsultation === true
    && appointment.staffId === user.id && appointment.specialty === user.permissions.specialty;
  const manage = administrator || intake || assigned;
  const scheduled = appointment.status === 'Scheduled';
  const start = Date.parse(appointment.date + 'T' + appointment.time + ':00+08:00');
  return {
    manage,
    reschedule: manage && ['Scheduled', 'Cancelled', 'No Show'].includes(appointment.status),
    complete: manage && scheduled && appointment.date === date && (administrator || !intake),
    cancel: manage && scheduled,
    noShow: manage && scheduled && Number.isFinite(start) && now.getTime() >= start + 10 * 60 * 1000
  };
}
