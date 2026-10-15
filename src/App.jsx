import React, { useState, useEffect, useRef } from "react";
import { emptyData } from "./data/emptyData.js";
import { auth, workspace, savePreferences, markNotifications } from './services/api.js';
import { persistChange } from './services/records.js';
import { today } from "./utils/helpers";
import { navigation } from "./data/navigation.js";
import PatientCell from "./components/patients/PatientCell.jsx";
import AppointmentTable from "./components/appointments/AppointmentTable.jsx";
import VisitTimeline from "./components/patients/VisitTimeline.jsx";
import Login from "./pages/Login.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DoctorPatientDirectory from './pages/DoctorPatientDirectory.jsx';
import Patients from "./pages/Patients.jsx";
import ArchivedRecords from "./pages/ArchivedRecords.jsx";
import PatientProfile from "./pages/PatientProfile.jsx";
import Appointments from "./pages/Appointments.jsx";
import MedicalRecords from "./pages/MedicalRecords.jsx";
import Reports from "./pages/Reports.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import Settings from "./pages/Settings.jsx";
import Empty from "./components/common/Empty.jsx";
const archiveRoute = value => value === 'archived-records' ? 'archived-patients' : value;
export default function App() {
  const [data, setData] = useState(emptyData),
    [user, setUser] = useState(null),
    [route, setRoute] = useState(archiveRoute(window.location.hash.slice(1) || 'dashboard'));
  const [dark, setDark] = useState(localStorage.getItem('careline-theme') === 'dark'),
    [sidebar, setSidebar] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(''),
    [panel, setPanel] = useState(''),
    [globalSearch, setGlobalSearch] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All'),
    [sort, setSort] = useState('name'),
    [tab, setTab] = useState('Overview'),
    [calendar, setCalendar] = useState(false),
    [calendarDate, setCalendarDate] = useState(today()),
    [reportType, setReportType] = useState('Patients'),
    [from, setFrom] = useState('2026-09-01'),
    [to, setTo] = useState(today());
  const [checkingSession, setCheckingSession] = useState(true), [connectionError, setConnectionError] = useState('');
  const [toastType, setToastType] = useState('success');
  const saving = useRef(false), settingsDirty = useRef(false), currentRoute = useRef(route);
  currentRoute.current = route;
  async function refreshWorkspace() {
    const [snapshot, session] = await Promise.all([workspace(), auth.me()]);
    setData(snapshot); setUser(session.user); setConnectionError('');
    return session.user;
  }
  useEffect(() => {
    let active = true;
    auth.me().then(async session => {
      const snapshot = await workspace();
      if (active) { setUser(session.user); setData(snapshot); setDark(session.user.preferences?.theme === 'dark'); }
    }).catch(error => { if (active && error.status !== 401) setConnectionError(error.message); }).finally(() => { if (active) setCheckingSession(false); });
    const expired = () => { setUser(null); setData(emptyData()); setModal(null); setPanel(''); setConnectionError('Your session expired. Please sign in again.'); };
    window.addEventListener('careline:session-expired', expired);
    return () => { active = false; window.removeEventListener('careline:session-expired', expired); };
  }, []);
  useEffect(() => {
    const preference = user?.preferences?.theme;
    if (!preference) return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => setDark(preference === 'system' ? !!media?.matches : preference === 'dark');
    apply(); media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [user?.preferences?.theme]);
  useEffect(() => { document.documentElement.dataset.density = user?.preferences?.density || 'comfortable'; }, [user?.preferences?.density]);
  useEffect(() => {
    const handle = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && user) {
        e.preventDefault();
        document.querySelector('.global-search input')?.focus();
        setPanel('search');
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [user]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('careline-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const handler = () => {
      const next = archiveRoute(window.location.hash.slice(1) || 'dashboard');
      if (next === currentRoute.current) return;
      if (settingsDirty.current && next !== currentRoute.current && !window.confirm('Discard unsaved settings changes?')) { window.location.hash = currentRoute.current; return; }
      settingsDirty.current = false;
      setRoute(next);
      setQuery('');
      setFilter('All');
      setPanel('');
      setSidebar(false);
      setTab('Overview');
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const notify = (text, type = 'success') => { setToastType(type); setToast(text); };
  const go = path => {
    if (settingsDirty.current && !window.confirm('Discard unsaved settings changes?')) return false;
    settingsDirty.current = false;
    window.location.hash = path;
    setPanel('');
    setGlobalSearch('');
    return true;
  };
  const patient = id => data.patients.find(p => p.id === id);
  const commit = async (key, items, action) => {
    if (saving.current) return false;
    saving.current = true;
    try {
      await persistChange(key, items, data[key], action);
      setModal(null);
      try { await refreshWorkspace(); notify(action); }
      catch (error) { setConnectionError(error.message); notify('Change saved, but records could not refresh. Please retry loading.', 'error'); }
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
    finally { saving.current = false; }
  };
  const handleLogin = async credentials => { await auth.login(credentials); const account = await refreshWorkspace(); setDark(account.preferences?.theme === 'dark'); go('dashboard'); notify('Welcome back, ' + account.name.split(' ')[0]); };
  const handleLogout = async () => { if (settingsDirty.current && !window.confirm('Discard unsaved settings changes and log out?')) return; settingsDirty.current = false; try { await auth.logout(); setUser(null); setData(emptyData()); setModal(null); setPanel(''); go('login'); } catch (error) { notify(error.message); } };
  const changeTheme = async value => { if (!user) { setDark(value); return; } try { await savePreferences({ theme: value ? 'dark' : 'light' }); setUser(previous => ({ ...previous, preferences: { ...previous.preferences, theme: value ? 'dark' : 'light' } })); setDark(value); return true; } catch (error) { notify(error.message); return false; } };
  const readNotifications = async (id = 'all') => { try { await markNotifications(id); await refreshWorkspace(); return true; } catch (error) { notify(error.message); return false; } };
  const active = data.patients.filter(p => p.status === 'Active'),
    todays = data.appointments.filter(a => a.date === today()),
    selected = route.startsWith('patients/') ? patient(route.split('/')[1]) : null;
  const pageName = selected ? 'Patient Profile' : navigation.flatMap(g => g.items).find(([n]) => n.toLowerCase().replaceAll(' ', '-') === route)?.[0] || 'Dashboard';
  const addPatient = p => setModal({
    type: 'patient',
    item: p
  });
  const addConsultation = id => setModal({
    type: 'consultation',
    patientId: id
  });
  const addAppointment = (id, item) => setModal({
    type: 'appointment',
    patientId: id,
    item
  });
  const archivePatient = p => user.role === 'Administrator' && setModal({
    type: 'confirm',
    title: p.status === 'Archived' ? 'Restore patient record?' : 'Archive patient record?',
    text: `${p.name} will appear in ${p.status === 'Archived' ? 'the active patient list' : 'Archived Patients'}. Medical history and documents stay linked and unchanged. Scheduled appointments must be resolved before archiving.`,
    action: () => commit('patients', data.patients.map(x => x.id === p.id ? {
      ...x,
      status: p.status === 'Archived' ? 'Active' : 'Archived'
    } : x), p.status === 'Archived' ? 'Patient restored' : 'Patient archived', p.name)
  });
  const updateAppointment = (a, status, confirmation = {}) => commit('appointments', data.appointments.map(x => x.id === a.id ? {
    ...x,
    status,
    ...confirmation
  } : x), 'Appointment ' + status.toLowerCase(), `${patient(a.patientId)?.name} · ${a.id}`);
  const unread = data.dashboard?.unreadNotifications ?? data.notifications.filter(n => !n.read).length;
  const personCell = p => <PatientCell p={p} data={data} />;
  const appointmentTable = (items, compact = false, loadDetails = false) => <AppointmentTable
    loadDetails={loadDetails}
    items={items} 
    compact={compact} 
    go={go} 
    personCell={personCell} 
    patient={patient} 
    setModal={setModal} 
  />;
  const recordList = records => <VisitTimeline records={records} setModal={setModal} />;
  const filteredPatients = data.patients.filter(p => p.status === (route === 'archived-patients' ? 'Archived' : 'Active')).filter(p => `${p.name} ${p.id} ${p.phone} ${p.email}`.toLowerCase().includes(query.toLowerCase())).filter(p => filter === 'All' || p.gender === filter).sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
  if (checkingSession) return <Empty title="Opening your clinic workspace..." text="Checking your secure session." />;
  if (!user) return <Login 
    setDark={changeTheme}
    dark={dark} 
    onLogin={handleLogin}
    connectionError={connectionError}
  />;
  const deniedPage = (pageName === 'Reports' && data.permissions?.viewReports !== true)
    || (pageName === 'Audit Logs' && data.permissions?.viewAuditLogs !== true)
    || (pageName === 'Medical Records' && data.permissions?.viewRecords !== true)
    || (['User Management', 'Doctor Patient Directory'].includes(pageName) && user.role !== 'Administrator');
  return <AppLayout 
    collapsed={collapsed} 
    sidebar={sidebar} 
    setSidebar={setSidebar} 
    data={data} 
    user={user} 
    pageName={pageName} 
    selected={selected} 
    go={go} 
    todays={todays} 
    setModal={setModal} 
    setPanel={setPanel} 
    panel={panel} 
    setCollapsed={setCollapsed} 
    globalSearch={globalSearch} 
    setGlobalSearch={setGlobalSearch} 
    setDark={changeTheme}
    dark={dark} 
    unread={unread} 
    setTab={setTab} 

    onLogout={handleLogout}
    onReadNotifications={readNotifications}

    notify={notify} 
    personCell={personCell} 
    patient={patient} 
    addPatient={addPatient} 
    filteredPatients={filteredPatients} 
    addAppointment={addAppointment} 
    addConsultation={addConsultation} 
    modal={modal} 
    commit={commit} 
    active={active} 
    updateAppointment={updateAppointment} 
    toast={toast}
    toastType={toastType}
    setToast={setToast}
  >
    {user.role === 'Clinic Staff' && !data.permissions?.specialty && <div className="info-banner" role="status">An administrator must assign your approved profession before clinical access is available.</div>}
    {connectionError && <div className="info-banner" role="alert"><span>{connectionError}</span><button className="btn secondary" onClick={() => refreshWorkspace().catch(error => notify(error.message))}>Retry loading</button></div>}
    {deniedPage && <Empty title="Access denied" text="Your account does not have permission to open this page." />}
    {!deniedPage && <>
    {pageName === 'Doctor Patient Directory' && <DoctorPatientDirectory user={user} go={go} revision={data.dashboard} />}
    {pageName === 'Dashboard' && <Dashboard 
      user={user}
      onRefresh={refreshWorkspace}
      openNotifications={() => setPanel('notifications')}
      onViewSchedule={day => { go('appointments'); setCalendar(true); setCalendarDate(day); }}
      todays={todays} 
      go={go} 
      data={data} 
      active={active} 
      appointmentTable={appointmentTable} 
      addPatient={addPatient} 
      addConsultation={addConsultation} 
      addAppointment={addAppointment} 
    />}
    {pageName === "Patients" && <Patients 
      pageName={pageName} 
      active={active} 
      data={data} 
      query={query} 
      setQuery={setQuery} 
      filter={filter} 
      setFilter={setFilter} 
      sort={sort} 
      setSort={setSort} 
      filteredPatients={filteredPatients} 
      go={go} 
      personCell={personCell} 
      addPatient={addPatient} 
      archivePatient={archivePatient} 
    />}
    {pageName === "Archived Patients" && <ArchivedRecords
      pageName={pageName} 
      active={active} 
      data={data} 
      query={query} 
      setQuery={setQuery} 
      filter={filter} 
      setFilter={setFilter} 
      sort={sort} 
      setSort={setSort} 
      filteredPatients={filteredPatients} 
      go={go} 
      personCell={personCell} 
      addPatient={addPatient} 
      archivePatient={archivePatient} 
    />}
    {selected && <PatientProfile 
      go={go} 
      selected={selected} 
      addPatient={addPatient} 
      addAppointment={addAppointment} 
      addConsultation={addConsultation} 
      tab={tab} 
      setTab={setTab} 
      recordList={recordList} 
      data={data} 
      appointmentTable={appointmentTable} 
      setModal={setModal} 
      notify={notify} 
      commit={commit} 
    />}
    {pageName === 'Appointments' && <Appointments 
      filter={filter} 
      setFilter={setFilter} 
      data={data} 
      query={query} 
      setQuery={setQuery} 
      calendar={calendar} 
      setCalendar={setCalendar} 
      calendarDate={calendarDate} 
      setCalendarDate={setCalendarDate} 
      patient={patient} 
      setModal={setModal} 
      appointmentTable={appointmentTable} 
    />}
    {pageName === 'Medical Records' && <MedicalRecords 
      query={query} 
      setQuery={setQuery} 
      data={data} 
      patient={patient} 
      go={go} 
      personCell={personCell} 
      setModal={setModal} 
    />}
    {pageName === 'Reports' && <Reports 
      reportType={reportType} 
      setReportType={setReportType} 
      from={from} 
      to={to} 
      setFrom={setFrom} 
      setTo={setTo} 
      data={data} 
      patient={patient}
      notify={notify}
    />}
    {pageName === 'Audit Logs' && <AuditLogs data={data} query={query} setQuery={setQuery} />}
    {pageName === 'User Management' && <UserManagement 
      user={user} 
      data={data} 
      setModal={setModal} 
      commit={commit} 
    />}
    {pageName === 'Settings' && <Settings 
      tab={tab} 
      setTab={setTab} 
      data={data} 
      notify={notify} 
      commit={commit} 
      user={user} 

      dark={dark} 
      setDark={changeTheme}
      onRefresh={refreshWorkspace}
      onUserChange={setUser}
      onDirtyChange={value => { settingsDirty.current = value; }}
      go={go}
    />}
    {!selected && route.startsWith('patients/') && <Empty title="Patient not found" text="Return to Patients to choose an available record." />}
    </>}
  </AppLayout>;
}
