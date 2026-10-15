const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(global, { window: dom.window, document: dom.window.document,
  localStorage: dom.window.localStorage, location: dom.window.location,
  HTMLElement: dom.window.HTMLElement, FormData: dom.window.FormData,
  IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
const babel = require('@babel/core');
for (const extension of ['.js', '.jsx']) {
  const original = require.extensions[extension] || require.extensions['.js'];
  require.extensions[extension] = (mod, filename) => {
    if (!filename.startsWith(path.resolve(__dirname, '../src') + path.sep)) return original(mod, filename);
    const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false,
      presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }], [require.resolve('@babel/preset-react'), { runtime: 'automatic' }]] }).code;
    mod._compile(code, filename);
  };
}
require.extensions['.css'] = () => {};
const React = require('react');
const { render, screen, fireEvent, waitFor, act, cleanup } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;
const { appointmentActions } = require('../src/utils/appointmentActions.js');
const UserForm = require('../src/components/users/UserForm.jsx').default;
const AppointmentForm = require('../src/components/appointments/AppointmentForm.jsx').default;
const SlotPicker = require('../src/components/appointments/SlotPicker.jsx').default;
const AvailabilityForm = require('../src/components/users/AvailabilityForm.jsx').default;
const AppointmentDetails = require('../src/components/appointments/AppointmentDetails.jsx').default;
const PatientForm = require('../src/components/patients/PatientForm.jsx').default;
const AppointmentTable = require('../src/components/appointments/AppointmentTable.jsx').default;
const PageHeader = require('../src/components/layout/PageHeader.jsx').default;
const group = process.argv[2] || 'components';
if (!['components', 'actions', 'routes', 'nurse', 'isolation', 'availability'].includes(group)) throw new Error('Choose components, actions, routes, nurse, isolation or availability.');
const App = ['actions', 'routes'].includes(group) ? require('../src/App.jsx').default : null;
const { emptyData } = require('../src/data/emptyData.js');
const { publicSpecialties } = require('../backend/config/specialties.js');
const { permissionsFor } = require('../backend/middleware/permissions.js');
const admin = { id: 'admin', name: 'Synthetic Admin', role: 'Administrator', active: true, preferences: { theme: 'light' } };
const staff = { id: 'staff', name: 'Synthetic Clinician', role: 'Clinic Staff', specialty: 'cardiologist', active: true };
const intake = { id: 'intake', name: 'Synthetic Intake', role: 'Clinic Staff', specialty: 'general-nurse', active: true };
for (const user of [admin, staff, intake]) user.permissions = permissionsFor(user);
const patient = { id: 'patient', name: 'Synthetic Patient' };
const visit = { id: 'visit', patientId: patient.id, date: '2030-01-01', time: '23:55', duration: 30,
  type: 'Consultation', specialty: staff.specialty, staffId: staff.id, staff: 'Dr. ' + staff.name, status: 'Scheduled', notes: '' };
const now = new Date('2030-01-02T00:05:00+08:00');
const roster = [admin, staff, intake];
let checks = 0;
const pass = label => { checks++; console.log('PASS: ' + label); };

async function run() {
  if (group === 'availability') {
    const availability = { weekdays: [1,2,5], start: '10:00', end: '17:00', duration: 15 };
    let resolveSlots;
    global.fetch = () => new Promise(resolve => { resolveSlots = resolve; });
    render(React.createElement(SlotPicker, { doctorId: staff.id, date: '2099-01-05', value: '', onChange() {} }));
    assert(screen.getByRole('status').textContent.includes('Loading'));
    await act(async () => resolveSlots({ ok: true, json: async () => ({ availability, slots: [
      { time: '10:00', end: '10:15', duration: 15, booked: true },
      { time: '10:15', end: '10:30', duration: 15, booked: false }
    ] }) }));
    assert(screen.getByRole('button', { name: /10:00 AM.*Booked/ }).disabled);
    assert.equal(screen.getByRole('button', { name: /10:15 AM.*Available/ }).disabled, false);
    assert(screen.getByText('Mon, Tue, Fri'));
    cleanup(); pass('slot picker loads availability and disables booked slots');
    global.fetch = async () => ({ ok: true, json: async () => ({ availability: null, slots: [] }) });
    render(React.createElement(SlotPicker, { doctorId: staff.id, date: '2099-01-05', value: '', onChange() {} }));
    await waitFor(() => assert(screen.getByText(/No schedule configured/)));
    assert.equal(screen.queryByRole('button'), null);
    cleanup(); pass('missing availability blocks slot selection with a helpful message');
    let saved;
    global.fetch = async (_url, options = {}) => ({ ok: true, json: async () => {
      if (options.method === 'PATCH') { saved = JSON.parse(options.body); return { availability: saved, conflicts: [{ id: 'existing', date: '2099-01-05', time: '09:00' }] }; }
      return { availability, slots: [] };
    } });
    render(React.createElement(AvailabilityForm, { doctor: staff, setModal() {} }));
    await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Monday' }).getAttribute('aria-pressed'), 'true'));
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert.deepEqual(saved.weekdays, [1,5]));
    await waitFor(() => assert(screen.getByRole('status').textContent.includes('existing')));
    assert.equal(saved.duration, 15);
    cleanup(); pass('administrator schedule editor persists weekdays and reports existing conflicts');

    const slots = [
      { time: '08:00', end: '08:20', duration: 20, past: true },
      { time: '10:00', end: '10:20', duration: 20, booked: true },
      { time: '10:20', end: '10:40', duration: 20 },
      { time: '13:00', end: '13:20', duration: 20 }
    ];
    const responses = [];
    global.fetch = url => new Promise(resolve => { responses.push({ url, resolve }); });
    const resolveResponse = async items => act(async () => responses.at(-1).resolve({ ok: true, json: async () => ({ availability: { ...availability, duration: 20 }, slots: items }) }));
    function InteractivePicker(props) {
      const [value, setValue] = React.useState('');
      return React.createElement('form', {}, React.createElement(SlotPicker, { ...props, value, onChange: setValue }));
    }
    const view = render(React.createElement(InteractivePicker, { doctorId: staff.id, date: '2099-01-05' }));
    await resolveResponse(slots);
    assert(screen.getByRole('group', { name: 'Morning' }));
    assert(screen.getByRole('group', { name: 'Afternoon' }));
    assert.equal(document.querySelector('details').open, false);
    assert(document.querySelector('.slot-card.past').disabled);
    assert.equal(document.querySelector('select'), null);
    userEvent.tab();
    assert.equal(document.activeElement, screen.getByRole('button', { name: /10:20 AM.*Available/ }));
    userEvent.keyboard('{Enter}');
    assert.equal(screen.getByRole('button', { name: /10:20 AM.*Selected/ }).getAttribute('aria-pressed'), 'true');
    assert(screen.getByText(/Selected: 10:20 AM/));
    assert.equal(new FormData(document.querySelector('form')).get('duration'), '20');
    userEvent.tab(); userEvent.keyboard(' ');
    assert.equal(new FormData(document.querySelector('form')).get('time'), '13:00');
    view.rerender(React.createElement(InteractivePicker, { doctorId: 'doctor-b', date: '2099-01-05' }));
    assert.equal(new FormData(document.querySelector('form')).get('time'), '');
    assert(responses.at(-1).url.includes('doctor-b'));
    await resolveResponse([slots[2]]);
    assert.equal(new FormData(document.querySelector('form')).get('time'), '');
    fireEvent.click(screen.getByRole('button', { name: /10:20 AM.*Available/ }));
    view.rerender(React.createElement(InteractivePicker, { doctorId: 'doctor-b', date: '2099-01-06' }));
    assert(responses.at(-1).url.includes('2099-01-06'));
    assert.equal(new FormData(document.querySelector('form')).get('time'), '');
    await resolveResponse([]);
    assert(screen.getByText(/No available slots on this date/));
    assert.equal(document.querySelectorAll('.slot-card').length, 0);
    cleanup(); pass('keyboard selection, AM/PM groups, collapsed past slots and doctor/date resets preserve dynamic durations');

    global.fetch = async (_url, options = {}) => ({ ok: true, json: async () => {
      if (options.method === 'PATCH') { saved = JSON.parse(options.body); return { availability: saved, conflicts: [] }; }
      return { availability, slots: [] };
    } });
    render(React.createElement(AvailabilityForm, { doctor: staff, setModal() {} }));
    await waitFor(() => assert(screen.getByRole('button', { name: 'Monday' })));
    for (const day of ['Monday','Tuesday','Friday']) fireEvent.click(screen.getByRole('button', { name: day }));
    assert(screen.getByText('No working days selected'));
    fireEvent.change(screen.getByLabelText(/Appointment duration/), { target: { value: '17' } });
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert(screen.getByRole('alert').textContent.includes('5-minute intervals')));
    fireEvent.change(screen.getByLabelText(/Appointment duration/), { target: { value: '20' } });
    assert(screen.getByLabelText('Schedule summary').textContent.includes('20 minutes'));
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert.deepEqual(saved.weekdays, []));
    assert.equal(saved.duration, 20);
    cleanup(); pass('empty weekdays remain supported and invalid duration shows validation feedback');
  }
  if (['nurse', 'components'].includes(group)) global.fetch = async () => ({ ok: true, json: async () => ({ timezone: 'Asia/Manila',
    availability: { weekdays: [0,1,2,3,4,5,6], start: '09:00', end: '17:00', duration: 15 },
    slots: [{ time: '09:00', end: '09:15', duration: 15, booked: false, past: false }] }) });
  if (group === 'isolation') {
    let saved;
    const owned = { ...patient, dob: '1990-01-01', gender: 'Female', phone: '09170000000', assignedStaffId: staff.id,
      conditions: 'Synthetic unattributed conditions', notes: 'Synthetic unattributed notes' };
    render(React.createElement(PatientForm, { modal: { item: owned }, user: staff,
      data: { patients: [owned], users: roster, specialties: publicSpecialties() }, setModal() {},
      commit: async (_key, rows) => { saved = rows[0]; return true; } }));
    assert.equal(screen.queryByLabelText(/Route to doctor/), null);
    assert.equal(screen.queryByLabelText(/Existing conditions/), null);
    assert.equal(screen.queryByLabelText(/Additional notes/), null);
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '09171111111' } });
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert.equal(saved.phone, '09171111111'));
    assert.equal(saved.assignedStaffId, undefined);
    assert.equal(saved.notes, undefined);
    cleanup();
    pass('doctor basic edits do not submit routing changes or unattributed clinical fields');

    const legacy = { ...staff, id: 'legacy', specialty: '', permissions: permissionsFor({ role: 'Clinic Staff', specialty: '' }) };
    render(React.createElement(UserForm, { modal: { item: legacy }, user: admin,
      data: { users: [legacy], specialties: publicSpecialties() }, setModal() {}, notify() {}, commit() {} }));
    assert.equal(screen.getByLabelText(/Profession \/ Field of Expertise/).value, '');
    assert.equal(legacy.permissions.viewRecords, false);
    cleanup();
    pass('missing legacy profession is not silently inferred as General Practitioner');

    render(React.createElement(AppointmentDetails, { modal: { item: { ...visit, status: 'No Show' } }, user: staff,
      patient: () => undefined, personCell: () => 'Restricted patient', setModal() {}, addAppointment() {}, updateAppointment() {} }));
    assert.equal(screen.queryByRole('button', { name: /Reschedule appointment/ }), null);
    assert(screen.getByText(/Ask intake to route/));
    cleanup();
    render(React.createElement(AppointmentTable, { items: [{ ...visit, status: 'Cancelled' }], data: { patients: [] },
      patient: () => undefined, personCell() { throw new Error('Restricted details must not render'); }, setModal() {}, go() {} }));
    assert(screen.getByText('Patient details restricted'));
    cleanup();
    pass('historical appointments remain visible without opening restricted patient details or rescheduling');

    render(React.createElement(PageHeader, { pageName: 'Patients', user: staff, filteredPatients: [], addPatient() {} }));
    assert.equal(screen.queryByRole('button', { name: 'Add patient' }), null);
    cleanup();
    pass('doctor navigation omits intake-only registration');
  }
  if (group === 'nurse') {
    let saved;
    const routedPatient = { ...patient, dob: '1990-01-01', gender: 'Female', phone: '09170000000',
      status: 'Active', created: '2026-01-01', assignedStaffId: staff.id,
      conditions: 'Synthetic physician finding', notes: 'Synthetic physician note' };
    const data = { users: roster, specialties: publicSpecialties(), patients: [routedPatient], appointments: [] };
    render(React.createElement(PatientForm, { modal: { item: routedPatient }, data, user: intake, setModal() {},
      commit: async (_key, rows) => { saved = rows[0]; return true; } }));
    assert.equal(screen.queryByLabelText(/Existing conditions/), null);
    assert.equal(screen.queryByLabelText(/Additional notes/), null);
    const routing = screen.getByLabelText(/Route to doctor/);
    assert.deepEqual([...routing.options].map(option => option.value), ['', staff.id]);
    assert(routing.textContent.includes('Cardiologist'));
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '09171111111' } });
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert.equal(saved.phone, '09171111111'));
    assert.equal(saved.assignedStaffId, staff.id);
    assert.equal(saved.notes, undefined);
    assert.equal(saved.conditions, undefined);
    cleanup();
    pass('nurse intake hides physician fields and supports routing to an active physician by specialty');

    render(React.createElement(PatientForm, { modal: {}, data, user: intake, setModal() {}, commit() { throw new Error('Duplicate must not save'); } }));
    for (const [label, value] of [[/Full name/, patient.name], [/Date of birth/, routedPatient.dob], [/Phone number/, routedPatient.phone]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert(screen.getByRole('alert').textContent.includes('already registered')));
    cleanup();
    pass('duplicate registration directs the nurse to the existing patient');

    render(React.createElement(AppointmentForm, { modal: { patientId: patient.id, date: '2099-01-01' }, data,
      user: intake, active: [routedPatient], patient: () => routedPatient, setModal() {}, notify() {},
      commit: async (_key, rows) => { saved = rows[0]; return true; } }));
    const selection = screen.getByLabelText(/Attending staff/);
    const specialtySelection = screen.getByLabelText(/Consultation specialty/);
    assert.equal(specialtySelection.value, 'cardiologist');
    fireEvent.change(specialtySelection, { target: { value: 'orthopedist' } });
    assert.equal(selection.value, '');
    assert.deepEqual([...selection.options].map(option => option.value), ['']);
    fireEvent.change(specialtySelection, { target: { value: 'cardiologist' } });
    fireEvent.change(selection, { target: { value: staff.id } });
    assert.equal(selection.value, staff.id);
    assert.deepEqual([...selection.options].map(option => option.value), ['', staff.id]);
    assert(selection.textContent.includes('Cardiologist'));
    await waitFor(() => assert.equal(screen.getByRole('button', { name: /9:00 AM.*Available/ }).disabled, false));
    saved = null;
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert(screen.getByRole('alert').textContent.includes('Choose an appointment time')));
    assert.equal(saved, null);
    fireEvent.click(screen.getByRole('button', { name: /9:00 AM.*Available/ }));
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert.equal(saved.staffId, staff.id));
    assert.equal(saved.specialty, 'cardiologist');
    assert.equal(saved.status, 'Scheduled');
    cleanup();
    pass('nurse appointment uses the routed doctor and saves their identifier without new statuses');
    render(React.createElement(AppointmentForm, { modal: { patientId: patient.id, date: '2099-01-01' },
      data: { ...data, appointments: [{ ...visit, date: '2099-01-01', time: '09:00' }] },
      user: intake, active: [routedPatient], patient: () => routedPatient, setModal() {}, notify() {},
      commit() { throw new Error('A conflicting appointment must not save'); } }));
    await waitFor(() => assert(screen.getByRole('button', { name: /9:00 AM.*Available/ })));
    fireEvent.click(screen.getByRole('button', { name: /9:00 AM.*Available/ }));
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => assert(screen.getByRole('alert').textContent.includes('overlapping appointment')));
    cleanup();
    pass('nurse sees an error and cannot save a known physician scheduling conflict');
  }
  if (group === 'components') {
  assert.equal(appointmentActions(visit, staff, new Date(now.getTime() - 1)).noShow, false);
  assert.equal(appointmentActions(visit, staff, now).noShow, true);
  for (const status of ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Checked-in', 'No Show']) {
    assert.equal(appointmentActions({ ...visit, status }, staff, now).noShow, false);
  }
  assert.equal(appointmentActions(visit, { ...staff, id: 'other' }, now).manage, false);
  assert.equal(appointmentActions({ ...visit, status: 'Cancelled' }, intake, now).reschedule, true);
  assert.equal(appointmentActions({ ...visit, status: 'No Show' }, staff, now).reschedule, true);
  assert.equal(appointmentActions({ ...visit, date: '2030-01-02' }, intake, now).complete, false);
  assert.equal(appointmentActions({ ...visit, date: '2030-01-02' }, admin, now).complete, true);
  pass('action permissions, existing statuses and Manila midnight grace boundary');

  let saved;
  render(React.createElement(UserForm, { modal: {}, user: admin, data: { users: roster, specialties: publicSpecialties() },
    setModal() {}, notify() {}, commit: async (_key, rows) => { saved = rows.at(-1); return true; } }));
  const profession = screen.getByLabelText(/Profession \/ Field of Expertise/);
  assert.equal(profession.options.length, publicSpecialties().length + 1);
  fireEvent.change(profession, { target: { value: 'orthopedist' } });
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Synthetic New Staff' } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'synthetic-new@example.test' } });
  fireEvent.change(screen.getByLabelText(/Password \(12/), { target: { value: 'SyntheticPassword123!' } });
  fireEvent.submit(document.querySelector('form'));
  await waitFor(() => assert.equal(saved.specialty, 'orthopedist'));
  assert.equal(saved.role, 'Clinic Staff');
  fireEvent.change(screen.getByLabelText(/System access role/), { target: { value: 'Administrator' } });
  assert.equal(screen.queryByLabelText(/Profession \/ Field of Expertise/), null);
  cleanup();
  pass('staff profession options, creation payload and role-conditional visibility');

  const practitionerAdmin = { ...admin, specialty: 'cardiologist' };
  render(React.createElement(UserForm, { modal: { item: practitionerAdmin }, user: admin,
    data: { users: [practitionerAdmin], specialties: publicSpecialties() }, setModal() {}, notify() {},
    commit: async (_key, rows) => { saved = rows[0]; return true; } }));
  assert.equal(screen.queryByLabelText(/Profession \/ Field of Expertise/), null);
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Updated Synthetic Admin' } });
  fireEvent.submit(document.querySelector('form'));
  await waitFor(() => assert.equal(saved.name, 'Updated Synthetic Admin'));
  assert.equal(saved.specialty, 'cardiologist');
  cleanup();
  pass('editing an administrator preserves the hidden existing specialty');

  render(React.createElement(AppointmentForm, { modal: { item: { ...visit, date: '2099-01-01', time: '09:00' } }, user: admin,
    active: [patient], data: { users: [...roster, { ...staff, id: 'doctor-b', name: 'Synthetic Doctor B' }], specialties: publicSpecialties(), appointments: [{ ...visit, date: '2099-01-01', time: '09:00' }] },
    patient: () => patient, setModal() {}, notify: message => { throw new Error(message); },
    commit: async (_key, rows) => { saved = rows[0]; return true; } }));
  fireEvent.change(screen.getByLabelText(/Attending staff/), { target: { value: 'doctor-b' } });
  await waitFor(() => assert(screen.getByRole('button', { name: /9:00 AM.*Available/ })));
  fireEvent.click(screen.getByRole('button', { name: /9:00 AM.*Available/ }));
  fireEvent.submit(document.querySelector('form'));
  await waitFor(() => assert.equal(saved.staffId, 'doctor-b'));
  assert.equal(saved.staff, 'Dr. Synthetic Doctor B');
  cleanup();
  pass('rescheduling updates stable staff ID and canonical display name together');

  for (const status of ['Cancelled', 'No Show']) {
    render(React.createElement(AppointmentDetails, { modal: { item: { ...visit, date: '2000-01-01', status } }, user: staff,
      patient: () => patient, personCell: () => 'Synthetic Patient', setModal() {}, addAppointment() {}, updateAppointment() {} }));
    assert(screen.getByRole('button', { name: /Reschedule appointment/ }));
    assert.equal(screen.queryByRole('button', { name: 'Complete' }), null);
    cleanup();
  }
  pass('cancelled and past No Show records expose only their valid reschedule action');
  }

  if (group === 'actions') {
  let failSave = true, reloads = 0;
  const scheduled = { ...visit, date: '2099-01-01', time: '09:00' };
  global.fetch = async (url, options = {}) => {
    if (options.method === 'PATCH') {
      if (failSave) return new Response(JSON.stringify({ error: 'Synthetic save rejected' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } });
      scheduled.status = JSON.parse(options.body).status;
    }
    if (url === '/api/workspace') reloads++;
    const data = { ...emptyData(), permissions: admin.permissions, specialties: publicSpecialties(), users: roster,
      patients: [{ ...patient, dob: '1990-01-01', gender: 'Female', status: 'Active', created: '2026-01-01' }], appointments: [scheduled] };
    return new Response(JSON.stringify(url === '/api/auth/me' ? { user: admin, csrfToken: 'synthetic' } : data),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  location.hash = 'appointments';
  render(React.createElement(App));
  await waitFor(() => assert(screen.getByRole('button', { name: 'Manage appointment visit' })));
  fireEvent.click(screen.getByRole('button', { name: 'Manage appointment visit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => assert(screen.getByRole('alert').textContent.includes('Synthetic save rejected')));
  assert(screen.getByRole('dialog'));
  assert.equal(reloads, 1);
  failSave = false;
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  await waitFor(() => assert.equal(reloads, 2));
  assert.equal(scheduled.status, 'Cancelled');
  cleanup();
  pass('failed actions retain confirmation with error feedback; successful actions reload workspace');
  }

  if (group === 'routes') {
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    const data = { ...emptyData(), permissions: intake.permissions, specialties: publicSpecialties() };
    return new Response(JSON.stringify(url === '/api/auth/me' ? { user: intake, csrfToken: 'synthetic' } : data),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  for (const route of ['reports', 'medical-records', 'audit-logs', 'user-management']) {
    location.hash = route;
    render(React.createElement(App));
    await waitFor(() => assert(screen.getByText('Access denied')));
    cleanup();
  }
  assert.equal(requests.some(url => url.startsWith('/api/reports') || url === '/api/audit-logs'), false);
  pass('manually entered denied routes neither render protected pages nor request their data');
  }
  console.log(`${checks} focused frontend checks passed.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { cleanup(); dom.window.close(); });
