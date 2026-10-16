import React, { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import ExportButton from "../common/ExportButton.jsx";

function DashboardDateTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="date-pill dashboard-date-time" title="Asia/Manila">
    <span className="dashboard-clock-glow" aria-hidden="true" />
    <CalendarDays size={16} aria-hidden="true" />
    <span>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}</span>
    <time className="dashboard-live-time" dateTime={now.toISOString()} aria-label="Current time in Asia/Manila">
      {now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}
    </time>
    <span className="dashboard-clock-zone">Manila</span>
  </span>;
}
export default function PageHeader({
  pageName,
  exportSubtitle,
  data,
  user,
  addPatient,
  filteredPatients,
  addAppointment,
  addConsultation,
  setModal
}) {
  const intakeAccess = user.role === 'Administrator' || user.permissions?.intake === true;
  const clinicHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return <div className="page-heading">
    <div>
      <div className="eyebrow">
        {pageName === 'Dashboard' ? 'YOUR CLINIC AT A GLANCE' : 'CARELINE WORKSPACE'}
      </div>
      <h1>
        {pageName === 'Dashboard' ? `Good ${clinicHour < 12 ? 'morning' : clinicHour < 18 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]} ` : pageName}
        {pageName === 'Dashboard' && <span className="wave">✦</span>}
      </h1>
      <p>
        {{
          Dashboard: 'Here’s what’s happening at your clinic today.',
          Patients: 'A complete picture of every patient, all in one place.',
          Appointments: 'Keep your schedule organized and your care on track.',
          'Medical Records': 'Every consultation. Every detail. Connected to your patients.',
          'Archived Patients': 'Inactive patient profiles with their medical history preserved.',
          Reports: 'Turn your clinic’s activity into meaningful insights.',
          'Audit Logs': 'A clear trail of every action in your workspace.',
          'User Management': 'The people behind your care. Manage your team and access.',
          'Doctor Patient Directory': 'Doctor assignments and consultation history, organized by specialty.',
          Settings: 'Make Careline work the way your clinic does.',
          'Archived Patient Profile': 'Archived Patients / Patient details ? preserved medical history.',
          'Patient Profile': 'Connected records for a more personal approach to care.'
        }[pageName]}
      </p>
    </div>
    <div className="heading-actions">
      {pageName === 'Dashboard' ? <><DashboardDateTime />{intakeAccess && <button className="btn primary" onClick={() => addPatient()}><Plus size={17} />Add patient</button>}</> : ['Patients', 'Archived Patients'].includes(pageName) ? <><ExportButton title={pageName} type="patients" records={filteredPatients} clinic={data?.settings} subtitle={exportSubtitle} />{pageName === 'Patients' && intakeAccess && <button className="btn primary" onClick={() => addPatient()}><Plus size={16} />Add patient</button>}</> : pageName === 'Appointments' ? <button className="btn primary" onClick={() => addAppointment()}><Plus size={16} />Schedule appointment</button> : pageName === 'Medical Records' && user.permissions?.createConsultation ? <button className="btn primary" onClick={() => addConsultation()}><Plus size={16} />New consultation</button> : pageName === 'User Management' && user.role === 'Administrator' ? <button className="btn primary" onClick={() => setModal({
        type: 'user'
      })}><Plus size={16} />Add user</button> : null}
    </div>
  </div>;
}
