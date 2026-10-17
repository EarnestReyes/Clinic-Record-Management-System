export function doctorsFor(data) {
  return (data.users || []).filter(user => {
    if (!user.active || !['Administrator', 'Clinic Staff'].includes(user.role)) return false;
    const key = user.specialty || '';
    return (data.specialties || []).some(specialty => specialty.key === key && specialty.kind === 'clinical');
  });
}

export function doctorLabel(user, specialties = []) {
  const key = user.specialty || '';
  return `Dr. ${user.name} — ${specialties.find(specialty => specialty.key === key)?.label || 'Physician'}`;
}
export function departmentLabel(key) {
  return key ? key.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Not recorded';
}
