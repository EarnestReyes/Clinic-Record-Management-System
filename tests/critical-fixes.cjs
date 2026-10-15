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
const { render, screen, fireEvent, waitFor, act, cleanup, within } = require('@testing-library/react');
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
const Patients = require('../src/pages/Patients.jsx').default;
const PatientProfile = require('../src/pages/PatientProfile.jsx').default;
const Dashboard = require('../src/pages/Dashboard.jsx').default;
const VisitChart = require('../src/components/charts/VisitChart.jsx').default;
const { calendarDays, visitSeries } = require('../src/utils/dashboard.js');
const { appointmentGradient } = require('../src/utils/chartHelpers.js');
const DoctorPatientDirectory = require('../src/pages/DoctorPatientDirectory.jsx').default;
const { filterDirectory } = require('../src/utils/directory.js');
const PatientActivitySummary = require('../src/components/patients/PatientActivitySummary.jsx').default;
const WorkspacePanels = require('../src/components/layout/WorkspacePanels.jsx').default;
const group = process.argv[2] || 'components';
if (!['components', 'actions', 'routes', 'nurse', 'isolation', 'availability', 'archive', 'dashboard', 'dashboard-states', 'directory', 'activity', 'dashboard-review'].includes(group)) throw new Error('Unknown focused test group.');
const App = ['actions', 'routes', 'archive', 'dashboard-review'].includes(group) ? require('../src/App.jsx').default : null;
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
  if(group==='dashboard-review'){
    let modal=null, fail=true, rescheduled, saved;
    const full={...visit,date:'2099-01-01',time:'09:00',notes:'Synthetic note that must be preserved'};
    const summary={...full};delete summary.notes;
    global.fetch=async url=>{
      assert.equal(url,'/api/appointments/visit');
      return new Response(JSON.stringify(fail?{error:'Appointment access rejected'}:full),{status:fail?403:200,headers:{'Content-Type':'application/json'}});
    };
    render(React.createElement(AppointmentTable,{items:[summary],loadDetails:true,go(){},personCell:()=>patient.name,patient:()=>patient,setModal:value=>{modal=value;}}));
    fireEvent.click(screen.getByRole('button',{name:'Manage appointment visit'}));
    await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('Appointment access rejected')));
    assert.equal(modal,null);
    fail=false;fireEvent.click(screen.getByRole('button',{name:'Manage appointment visit'}));
    await waitFor(()=>assert.equal(modal?.item.notes,full.notes));cleanup();
    render(React.createElement(AppointmentDetails,{modal,user:admin,patient:()=>patient,personCell:()=>patient.name,setModal(){},addAppointment:(_id,item)=>{rescheduled=item;},updateAppointment(){}}));
    fireEvent.click(screen.getByRole('button',{name:'Reschedule appointment'}));assert.equal(rescheduled.notes,full.notes);cleanup();
    global.fetch=async()=>new Response(JSON.stringify({availability:{weekdays:[0,1,2,3,4,5,6],start:'09:00',end:'17:00',duration:15},slots:[{time:'09:00',end:'09:15',duration:15}]}),{status:200,headers:{'Content-Type':'application/json'}});
    render(React.createElement(AppointmentForm,{modal:{item:rescheduled},user:admin,active:[patient],data:{users:roster,specialties:publicSpecialties(),appointments:[full]},patient:()=>patient,setModal(){},commit:async(_key,rows)=>{saved=rows[0];return true;}}));
    await waitFor(()=>assert(screen.getByRole('button',{name:/9:00 AM.*Selected/})));
    fireEvent.submit(document.querySelector('form'));await waitFor(()=>assert.equal(saved?.notes,full.notes));cleanup();
    pass('dashboard actions authorize full detail loads, show failures, and preserve notes through rescheduling');
    for(const invalid of [null,{counts:{Active:0,'At Risk':0,Inactive:0,Unknown:0},patients:[{id:'bad',status:'Active'}]}]){
      global.fetch=async()=>new Response(JSON.stringify(invalid),{status:200,headers:{'Content-Type':'application/json'}});
      render(React.createElement(PatientActivitySummary,{user:admin,permissions:admin.permissions,go(){}}));
      await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('incomplete')));
      assert.equal(screen.queryByRole('table'),null);cleanup();
    }
    pass('malformed activity rows fail safely instead of crashing dashboard rendering');
    let destination,readId,notice,allowRead=false;
    const panelProps={panel:'notifications',data:{notifications:[{id:'notice',title:'Synthetic notice',text:'Synthetic update',route:'appointments',read:false}]},unread:1,
      setPanel(){},go:route=>{destination=route;},onReadNotifications:async id=>{readId=id;return allowRead;},notify:message=>{notice=message;}};
    render(React.createElement(WorkspacePanels,panelProps));
    fireEvent.click(screen.getByRole('button',{name:/Synthetic notice/}));
    await act(async()=>{});assert.equal(readId,'notice');assert.equal(destination,undefined);
    allowRead=true;fireEvent.click(screen.getByRole('button',{name:/Synthetic notice/}));
    await waitFor(()=>assert.equal(destination,'appointments'));
    fireEvent.click(screen.getByRole('button',{name:'Mark all read'}));await waitFor(()=>assert.equal(readId,'all'));assert.equal(notice,'All notifications marked as read');cleanup();
    render(React.createElement(WorkspacePanels,{...panelProps,data:{notifications:[]},unread:0}));
    assert(screen.getByRole('button',{name:'Mark all read'}).disabled);assert(screen.getByText('No notifications'));cleanup();
    pass('notification navigation waits for successful read updates and empty notifications have clear feedback');
    let allRead=false;
    global.fetch=async(url,options={})=>{
      if(url==='/api/notifications/all/read'&&options.method==='PATCH'){allRead=true;return new Response(JSON.stringify({success:true}),{status:200,headers:{'Content-Type':'application/json'}});}
      const snapshot={...emptyData(),permissions:admin.permissions,specialties:publicSpecialties(),users:roster,patients:[],
        dashboard:{unreadNotifications:allRead?0:7},notifications:[{id:'notice',title:'Synthetic notice',read:allRead,route:'patients'}]};
      return new Response(JSON.stringify(url==='/api/auth/me'?{user:admin,csrfToken:'synthetic'}:snapshot),{status:200,headers:{'Content-Type':'application/json'}});
    };
    location.hash='patients';render(React.createElement(App));
    await waitFor(()=>assert(screen.getByRole('button',{name:'Notifications, 7 unread'})));
    fireEvent.click(screen.getByRole('button',{name:'Notifications, 7 unread'}));
    fireEvent.click(screen.getByRole('button',{name:'Mark all read'}));
    await waitFor(()=>assert(screen.getByRole('button',{name:'Notifications, 0 unread'})));
    cleanup();pass('notification badge uses the complete authorized total and refreshes after mark-all-read');
  }
  const activitySnapshot = () => ({scope:'doctor',counts:{Active:0,'At Risk':0,Inactive:1,Unknown:0},patients:[
    {id:'patient',name:'Synthetic inactive',status:'Active',activity:{status:'Inactive',lastActivity:'2025-01-01',currentAppointment:false,needsReview:false}},
    {id:'archived',name:'Synthetic archived',status:'Archived',activity:{status:'Inactive',lastActivity:'2025-01-02',currentAppointment:false,needsReview:false}}
  ]});
  if(group==='activity'){
    let calls=0,navigated;
    global.fetch=async()=>{calls++;return new Response(JSON.stringify(activitySnapshot()),{status:200,headers:{'Content-Type':'application/json'}});};
    render(React.createElement(PatientActivitySummary,{user:intake,permissions:intake.permissions,go(){}}));
    assert.equal(calls,0);assert.equal(screen.queryByText('Clinic patient activity'),null);cleanup();
    render(React.createElement(PatientActivitySummary,{user:staff,permissions:staff.permissions,go:route=>{navigated=route;}}));
    await waitFor(()=>assert(screen.getByRole('button',{name:'Synthetic inactive · patient'})));
    assert(screen.getByText('2025-01-01'));assert.equal(screen.queryByText('Synthetic archived · archived'),null);
    fireEvent.change(screen.getByLabelText('Patient activity classification'),{target:{value:'Inactive'}});
    fireEvent.click(screen.getByRole('button',{name:'Synthetic inactive · patient'}));assert.equal(navigated,'patients/patient');
    fireEvent.click(screen.getByRole('checkbox',{name:'Include archived profiles in the table'}));assert(screen.getByRole('button',{name:'Synthetic archived · archived'}));
    fireEvent.change(screen.getByLabelText('Patient activity classification'),{target:{value:'At Risk'}});assert(screen.getByText('No matching patient activity.'));
    cleanup();pass('activity filters, last clinical dates, authorized navigation and Archived separation work without nurse requests');
    const groups=[{key:'orthopedist',label:'Orthopedist',doctors:[{id:'a',name:'A',patients:[{id:'patient',name:'Synthetic',status:'Active',activity:{status:'Inactive'},clinicActivity:{status:'Active'}}]}]}];
    assert.equal(filterDirectory(groups,{activity:'Inactive'})[0].doctors[0].patients.length,1);
    assert.equal(filterDirectory(groups,{activity:'Active'}).length,0,'doctor filter must not use another doctor’s clinic-wide activity');
    pass('directory filters use doctor-specific activity independently of clinic activity');
    let finish;global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    render(React.createElement(PatientActivitySummary,{user:admin,permissions:admin.permissions,go(){}}));
    assert(screen.getByRole('status').textContent.includes('Calculating'));
    await act(async()=>finish(new Response(JSON.stringify({error:'Synthetic activity failure'}),{status:503,headers:{'Content-Type':'application/json'}})));
    assert(screen.getByRole('alert').textContent.includes('Synthetic activity failure'));
    global.fetch=async()=>new Response(JSON.stringify(activitySnapshot()),{status:200,headers:{'Content-Type':'application/json'}});
    fireEvent.click(screen.getByRole('button',{name:'Retry activity'}));await waitFor(()=>assert(screen.getByRole('button',{name:'Synthetic inactive · patient'})));
    cleanup();pass('activity loading and error/retry states do not fabricate counts');
  }
  if (group === 'directory') {
    const row = { id: 'patient', name: 'Synthetic Patient', status: 'Active', active: true, historical: true, routingOnly: false, consultationCount: 1,
      lastConsultation: '2026-10-01', appointments: [{ id: 'visit', status: 'Scheduled', date: '2099-01-05', time: '10:00' }],
      upcoming: { date: '2099-01-05', time: '10:00' }, appointmentCounts: { Scheduled: 1, Completed: 0, Cancelled: 0, 'No Show': 0 } };
    const directory = { groups: [{ key: 'orthopedist', label: 'Orthopedist', doctors: [{ id: 'ortho', name: 'Synthetic Doctor', specialty: 'orthopedist', active: true, activeCount: 1, historicalCount: 1, patients: [row] }] },
      { key: 'dermatologist', label: 'Dermatologist', doctors: [{ id: 'derm', name: 'Other Doctor', specialty: 'dermatologist', active: true, activeCount: 1, historicalCount: 0, patients: [{ ...row, historical: false }] }] }],
      totals: { patients: 2, activePatients: 1, activeRelationships: 2, archivedPatients: 0, doctors: 2 },
      unassigned: [{ id: 'unassigned', name: 'Synthetic Unassigned', status: 'Active', routedDoctor: 'Synthetic Doctor', routingNeedsReview: true }],
      review: { uncertainAppointments: 0, uncertainConsultations: 0, routingHasActiveState: false } };
    let calls = 0;
    global.fetch = async () => { calls++; return new Response(JSON.stringify(directory), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    for (const actor of [staff,intake]) {
      render(React.createElement(DoctorPatientDirectory, { user: actor, go() {} }));
      assert(screen.getByRole('alert').textContent.includes('Administrator access'));
      cleanup();
    }
    assert.equal(calls,0); pass('non-administrators cannot render or request directory data');
    let navigated;
    render(React.createElement(DoctorPatientDirectory, { user: admin, go: route => { navigated = route; } }));
    await waitFor(() => assert(screen.getByLabelText('Search directory')));
    assert(screen.getByLabelText('Clinic-wide directory totals').textContent.includes('Unique patient profiles'));
    fireEvent.click(screen.getByText('Dr. Synthetic Doctor').closest('summary'));
    const doctorGroup = screen.getByText('Dr. Synthetic Doctor').closest('details');
    assert.equal(doctorGroup.open,true);
    fireEvent.click(within(doctorGroup).getByRole('button', { name: 'Synthetic Patient · patient' }));
    assert.equal(navigated,'patients/patient');
    assert(within(doctorGroup).getByText('Next Scheduled appointment: 2099-01-05 · 10:00 AM · Asia/Manila'));
    fireEvent.change(screen.getByLabelText('Directory specialty'), { target: { value: 'orthopedist' } });
    fireEvent.change(screen.getByLabelText('Search directory'), { target: { value: 'Synthetic Patient' } });
    fireEvent.change(screen.getByLabelText('Directory relationship'), { target: { value: 'historical' } });
    assert(screen.getByText('Dr. Synthetic Doctor'));
    assert.equal(screen.queryByText('Dr. Other Doctor'),null);
    fireEvent.change(screen.getByLabelText('Directory patient status'), { target: { value: 'Archived' } });
    assert(screen.getByText('No matching doctor–patient relationships.'));
    const before=calls;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh directory' }));
    await waitFor(() => assert(calls>before));
    cleanup(); pass('expandable groups, patient routes, combined search/filters and refresh work');
    assert.equal(filterDirectory(directory.groups,{search:'Other Doctor',specialty:'orthopedist'}).length,0);
    assert.equal(filterDirectory(directory.groups,{search:'Orthopedist',relationship:'active'})[0].doctors[0].patients.length,1);
    assert.equal(filterDirectory(directory.groups,{relationship:'historical'}).length,1);
    pass('search by doctor/specialty/patient combines with relationship filters');
    let finish;
    global.fetch=()=>new Promise(resolve=>{finish=resolve;});
    render(React.createElement(DoctorPatientDirectory,{user:admin,go(){}}));
    assert(screen.getByRole('status').textContent.includes('Loading'));
    await act(async()=>finish(new Response(JSON.stringify({error:'Synthetic directory unavailable'}),{status:503,headers:{'Content-Type':'application/json'}})));
    assert(screen.getByRole('alert').textContent.includes('Synthetic directory unavailable'));
    global.fetch=async()=>new Response(JSON.stringify({...directory,groups:[],unassigned:[]}),{status:200,headers:{'Content-Type':'application/json'}});
    fireEvent.click(screen.getByRole('button',{name:'Retry directory'}));
    await waitFor(()=>assert(screen.getByText('No matching doctor–patient relationships.')));
    cleanup(); pass('directory loading, failure/retry and empty states are explicit');
  }
  const dashboardSnapshot = () => ({ today: '2026-10-15', from: '2026-10-09', to: '2026-10-15', timezone: 'Asia/Manila', generatedAt: '2026-10-15T01:00:00Z',
    totalPatients: 2, activePatients: 1, archivedRecords: 1, newPatients: 1, scheduledToday: 1, todaysAppointments: 2, todaysConsultations: 1,
    upcomingAppointments: 1, rangeAppointmentTotal: 2, filteredAppointmentTotal: 2, unreadNotifications: 0, routingTasks: 0,
    statusCounts: { Scheduled: 1, Completed: 0, Cancelled: 1, 'No Show': 0 },
    visits: [{ _id: { date: '2026-10-15', type: 'Specialty review' }, count: 1 }],
    rangeAppointments: [{ ...visit, id: 'own', date: '2026-10-15' }], upcoming: [], recentActivity: [], notifications: [], doctors: [], conflicts: [], staffCount: 1 });
  const dashboardProps = actor => ({ user: actor, data: { ...emptyData(), permissions: actor.permissions, specialties: publicSpecialties() },
    go() {}, addPatient() {}, addConsultation() {}, addAppointment() {}, appointmentTable: (rows,_compact,loadDetails) => { assert.equal(loadDetails,true); return React.createElement('p', {}, rows.map(row => row.id).join(', ')); } });
  if (group === 'dashboard') {
    const clinicians = publicSpecialties().filter(item => item.kind === 'clinical').map(item => ({ ...staff, id: item.key, specialty: item.key, permissions: permissionsFor({ ...staff, specialty: item.key }) }));
    for (const actor of [admin, intake, ...clinicians]) {
      const snapshot = dashboardSnapshot();
      let navigated, action;
      global.fetch = async url => new Response(JSON.stringify(url === '/api/patient-activity' ? activitySnapshot() : snapshot), { status: 200, headers: { 'Content-Type': 'application/json' } });
      render(React.createElement(Dashboard, { ...dashboardProps(actor), go: route => { navigated = route; },
        addPatient: () => { action = 'patient'; }, addConsultation: () => { action = 'consultation'; }, addAppointment: () => { action = 'appointment'; } }));
      await waitFor(() => assert(screen.getByText('Scheduled today')));
      assert.equal(Boolean(screen.queryByRole('button', { name: 'Register patient' })), actor.role === 'Administrator' || actor.permissions.intake);
      assert.equal(Boolean(screen.queryByRole('button', { name: 'New consultation' })), actor.permissions.createConsultation);
      assert.equal(Boolean(screen.queryByRole('button', { name: 'Manage availability' })), actor.role === 'Administrator');
      assert.equal(Boolean(screen.queryByRole('button', { name: /Open directory/ })), actor.role === 'Administrator');
      assert.equal(Boolean(screen.queryByRole('button', { name: 'View activity' })), actor.permissions.viewAuditLogs);
      fireEvent.click(screen.getByRole('button', { name: 'Schedule appointment' })); assert.equal(action, 'appointment');
      if(actor.role==='Administrator'||actor.permissions.intake){fireEvent.click(screen.getByRole('button',{name:'Register patient'}));assert.equal(action,'patient');}
      if(actor.permissions.createConsultation){fireEvent.click(screen.getByRole('button',{name:'New consultation'}));assert.equal(action,'consultation');}
      if(actor.role==='Administrator'){
        fireEvent.click(screen.getByRole('button',{name:'Manage availability'}));assert.equal(navigated,'user-management');
        fireEvent.click(screen.getByRole('button',{name:/Open directory/}));assert.equal(navigated,'doctor-patient-directory');
      }
      if(actor.permissions.viewAuditLogs){fireEvent.click(screen.getByRole('button',{name:/View activity/}));assert.equal(navigated,'audit-logs');}
      fireEvent.click(screen.getByRole('button', { name: 'Open calendar' })); assert.equal(navigated, 'appointments');
      if (actor.permissions.viewReports) { fireEvent.click(screen.getByRole('button', { name: 'View reports' })); assert.equal(navigated, 'reports'); }
      assert.equal(document.querySelector('.sparkline'), null);
      assert.equal(document.querySelectorAll('.careline-dashboard .card-heading h3').length, actor.role === 'Administrator' ? 10 : actor.permissions.createConsultation ? 8 : 7);
      cleanup();
    }
    pass('administrator, nurse and every configured clinical profession receive permitted dashboard actions');
    const requests = [];
    global.fetch = async url => { if(url === '/api/patient-activity') return new Response(JSON.stringify(activitySnapshot()), {status:200,headers:{'Content-Type':'application/json'}}); requests.push(url); const params = new URLSearchParams(url.split('?')[1]); const snapshot = dashboardSnapshot(); snapshot.from = params.get('from'); snapshot.to = params.get('to');
      return new Response(JSON.stringify(snapshot), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    let date, opened = false;
    const dashboardView = render(React.createElement(Dashboard, { ...dashboardProps(staff), onViewSchedule: value => { date = value; }, openNotifications: () => { opened = true; } }));
    await waitFor(() => assert(screen.getByText('Scheduled today')));
    const helpers = require('../src/utils/helpers.js');
    const originalToday = helpers.today;
    try {
      helpers.today = () => '2099-01-02';
      fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    } finally { helpers.today = originalToday; }
    await waitFor(() => assert(requests.at(-1).includes('to=2099-01-02')));
    await waitFor(() => assert(screen.getByText('Scheduled today')));
    fireEvent.change(screen.getByLabelText('Dashboard activity period'), { target: { value: '30' } });
    await waitFor(() => assert(screen.getByText('Scheduled today')));
    assert.equal((Date.parse(new URLSearchParams(requests.at(-1).split('?')[1]).get('to')) - Date.parse(new URLSearchParams(requests.at(-1).split('?')[1]).get('from'))) / 86400000, 29);
    fireEvent.change(screen.getByLabelText('Dashboard appointment status'), { target: { value: 'Cancelled' } });
    await waitFor(() => assert(screen.getByText('Scheduled today')));
    assert(requests.at(-1).includes('status=Cancelled'));
    fireEvent.change(screen.getByLabelText('Dashboard activity period'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Dashboard start date'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Dashboard end date'), { target: { value: '2026-10-15' } });
    const invalidBefore = requests.length;
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    assert(screen.getByRole('alert').textContent.includes('valid date range'));
    assert.equal(requests.length, invalidBefore);
    fireEvent.change(screen.getByLabelText('Dashboard start date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Dashboard end date'), { target: { value: '2026-10-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() => assert(screen.getByText('Scheduled today')));
    assert(requests.at(-1).includes('from=2026-10-01'));
    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' })); assert.equal(date, '2026-10-15');
    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' })); assert.equal(opened, true);
    const before = requests.length;
    screen.getByRole('button', { name: 'Refresh dashboard' }).focus();
    userEvent.keyboard('{Enter}');
    await waitFor(() => assert(requests.length > before));
    const beforeMutation = requests.length;
    dashboardView.rerender(React.createElement(Dashboard, { ...dashboardProps(staff), data: { ...dashboardProps(staff).data, dashboard: { generatedAt: 'updated-after-mutation' } } }));
    await waitFor(() => assert(requests.length > beforeMutation));
    cleanup(); pass('date/status controls, calendar, notifications and refresh perform their supported actions');
    assert.deepEqual(calendarDays('2026-09-30','2026-10-02'), ['2026-09-30','2026-10-01','2026-10-02']);
    const mapped = visitSeries([{ _id: { date: '2026-10-01', type: 'Unmapped specialty type' }, count: 3 }], '2026-09-30','2026-10-02');
    assert.deepEqual(mapped.series[0].values, [0,3,0]);
    assert.equal(appointmentGradient({ Scheduled: 1, Completed: 1 }), appointmentGradient([{ status: 'Scheduled' },{ status: 'Completed' }]));
    render(React.createElement(VisitChart, { visits: [{ _id: { date: '2026-10-01', type: 'Unmapped specialty type' }, count: 3 }], from: '2026-09-30', to: '2026-10-02' }));
    assert(screen.getByRole('img', { name: /3 total/ }));
    assert(screen.getByText('Unmapped specialty type', { selector: 'span' }));
    assert(screen.getByText('View chart data'));
    cleanup(); pass('date boundaries, arbitrary consultation types and appointment chart counts map accurately');
  }
  if (group === 'dashboard-states') {
    let resolve;
    global.fetch = () => new Promise(done => { resolve = done; });
    render(React.createElement(Dashboard, dashboardProps(intake)));
    assert(screen.getByRole('status', { name: 'Loading dashboard' }));
    assert.equal(screen.queryByText('Registered patients'), null);
    await act(async () => resolve(new Response(JSON.stringify({ error: 'Synthetic network failure' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    assert(screen.getByRole('alert').textContent.includes('Synthetic network failure'));
    assert.equal(screen.queryByText('Registered patients'), null);
    global.fetch = async () => new Response(JSON.stringify(dashboardSnapshot()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry dashboard' }));
    await waitFor(() => assert(screen.getByText('Registered patients')));
    cleanup(); pass('loading and network errors show no fabricated zero counts and support retry');
    for (const response of [new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
      new Response(JSON.stringify({ totalPatients: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })]) {
      global.fetch = async () => response;
      render(React.createElement(Dashboard, dashboardProps(staff)));
      await waitFor(() => assert(screen.getByRole('alert')));
      assert.equal(screen.queryByText('Authorized patients'), null);
      cleanup();
    }
    pass('unauthorized and incomplete responses fail closed without misleading dashboard cards');
    const snapshot = dashboardSnapshot();
    for (const key of ['totalPatients','activePatients','archivedRecords','newPatients','scheduledToday','todaysAppointments','todaysConsultations','upcomingAppointments','rangeAppointmentTotal','filteredAppointmentTotal']) snapshot[key] = 0;
    snapshot.statusCounts = { Scheduled: 0, Completed: 0, Cancelled: 0, 'No Show': 0 }; snapshot.visits = []; snapshot.rangeAppointments = [];
    global.fetch = async () => new Response(JSON.stringify(snapshot), { status: 200, headers: { 'Content-Type': 'application/json' } });
    render(React.createElement(Dashboard, dashboardProps(staff)));
    await waitFor(() => assert(screen.getByText('No consultations recorded in this date range.')));
    assert(screen.getByText('No matching appointments in this date range.'));
    assert(screen.getByText('No upcoming scheduled appointments.'));
    assert(screen.getByText('No recent activity in your authorized workspace.'));
    cleanup(); pass('successful empty responses show section-specific empty states');
  }
  if (group === 'archive') {
    const activePatient = { ...patient, dob: '1990-01-01', gender: 'Female', status: 'Active', created: '2026-01-01' };
    for (const actor of [admin, staff, intake]) for (const status of ['Active', 'Archived']) {
      const row = { ...activePatient, status };
      render(React.createElement(Patients, { pageName: status === 'Active' ? 'Patients' : 'Archived Patients',
        active: status === 'Active' ? [row] : [], data: { patients: [row], permissions: actor.permissions },
        filteredPatients: [row], query: '', filter: 'All', sort: 'name', personCell: item => item.name,
        go() {}, addPatient() {}, archivePatient() {}, setQuery() {}, setFilter() {}, setSort() {} }));
      assert.equal(Boolean(screen.queryByTitle(status === 'Active' ? 'Archive patient' : 'Restore patient')), actor.role === 'Administrator');
      cleanup();
    }
    pass('patient archive and restore controls are visible only to administrators');
    const docs = [{ id: 'active-doc', patientId: patient.id, status: 'Active', name: 'Active Synthetic Document', date: '2026-01-01' },
      { id: 'archived-doc', patientId: patient.id, status: 'Archived', name: 'Archived Synthetic Document', date: '2026-01-01' },
      { id: 'other-doc', patientId: 'other', status: 'Archived', name: 'Other Patient Document', date: '2026-01-01' }];
    let modal, saved;
    const props = { selected: activePatient, tab: 'Documents', data: { ...emptyData(), permissions: staff.permissions, documents: docs },
      go() {}, addPatient() {}, addAppointment() {}, addConsultation() {}, setTab() {}, recordList: () => 'Consultation history', appointmentTable() {},
      setModal: value => { modal = value; }, notify() {}, commit: (_key, rows) => { saved = rows; } };
    render(React.createElement(PatientProfile, props));
    assert(screen.getByText('Active Synthetic Document'));
    assert.equal(screen.queryByText('Archived Synthetic Document'), null);
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }));
    assert(screen.getByText('Archived Synthetic Document'));
    assert.equal(screen.queryByText('Active Synthetic Document'), null);
    assert.equal(screen.queryByText('Other Patient Document'), null);
    fireEvent.click(screen.getByTitle('Restore document'));
    await modal.action();
    assert.equal(saved.find(item => item.id === 'archived-doc').status, 'Active');
    assert.equal(docs.find(item => item.id === 'archived-doc').status, 'Archived');
    assert.equal(activePatient.status, 'Active');
    cleanup();
    render(React.createElement(PatientProfile, { ...props, tab: 'Visit History' }));
    assert(screen.getByText('Consultation history'));
    assert.equal(screen.queryByRole('group', { name: 'Document status filter' }), null);
    cleanup();
    render(React.createElement(PatientProfile, { ...props, data: { ...props.data, permissions: intake.permissions } }));
    assert.equal(screen.queryByText('Active Synthetic Document'), null);
    cleanup();
    render(React.createElement(PatientProfile, { ...props, data: { ...props.data, documents: [] } }));
    assert(screen.getByText('No active documents'));
    fireEvent.click(screen.getByRole('button', { name: 'Archived (0)' }));
    assert(screen.getByText('No archived documents'));
    cleanup();
    pass('document filters preserve restore actions, patient status, clinical-history separation and nurse restrictions');
    const snapshot = { ...emptyData(), permissions: admin.permissions, users: roster, patients: [{ ...activePatient, status: 'Archived' }] };
    global.fetch = async url => new Response(JSON.stringify(url === '/api/auth/me' ? { user: admin, csrfToken: 'synthetic' } : snapshot), { status: 200, headers: { 'Content-Type': 'application/json' } });
    for (const route of ['archived-records', 'archived-patients']) {
      location.hash = route;
      render(React.createElement(App));
      await waitFor(() => assert(screen.getByRole('heading', { name: 'Archived Patients' })));
      assert(screen.getByTitle('Restore patient'));
      assert.equal(screen.queryByText('Archived Records'), null);
      cleanup();
    }
    pass('Archived Patients heading and list work through both current and legacy archive URLs');
  }
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
  for (const route of ['reports', 'medical-records', 'audit-logs', 'user-management', 'doctor-patient-directory']) {
    location.hash = route;
    render(React.createElement(App));
    await waitFor(() => assert(screen.getByText('Access denied')));
    cleanup();
  }
  assert.equal(requests.some(url => url.startsWith('/api/reports') || url === '/api/audit-logs' || url === '/api/doctor-patient-directory'), false);
  pass('manually entered denied routes neither render protected pages nor request their data');
  }
  console.log(`${checks} focused frontend checks passed.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { cleanup(); dom.window.close(); });
