import React from "react";
import { CalendarDays, Plus, ArrowDownToLine } from "lucide-react";
import { exportCSV } from "../../utils/helpers";
export default function PageHeader({
  pageName,
  user,
  addPatient,
  filteredPatients,
  addAppointment,
  addConsultation,
  setModal
}) {
  return <div className="page-heading">
    <div>
      <div className="eyebrow">
        {pageName === 'Dashboard' ? 'YOUR CLINIC AT A GLANCE' : 'CARELINE WORKSPACE'}
      </div>
      <h1>
        {pageName === 'Dashboard' ? `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user.name.split(' ')[0]} ` : pageName}
        {pageName === 'Dashboard' && <span className="wave">✦</span>}
      </h1>
      <p>
        {{
          Dashboard: 'Here’s what’s happening at your clinic today.',
          Patients: 'A complete picture of every patient, all in one place.',
          Appointments: 'Keep your schedule organized and your care on track.',
          'Medical Records': 'Every consultation. Every detail. Connected to your patients.',
          'Archived Records': 'Safely preserved records, ready whenever you need them.',
          Reports: 'Turn your clinic’s activity into meaningful insights.',
          'Audit Logs': 'A clear trail of every action in your workspace.',
          'User Management': 'The people behind your care. Manage your team and access.',
          Settings: 'Make Careline work the way your clinic does.',
          'Patient Profile': 'Connected records for a more personal approach to care.'
        }[pageName]}
      </p>
    </div>
    <div className="heading-actions">
      {pageName === 'Dashboard' ? <><span className="date-pill">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Manila'
          })}
        </span><button className="btn primary" onClick={() => addPatient()}><Plus size={17} />Add patient</button></> : pageName === 'Patients' ? <><button className="btn secondary" onClick={() => exportCSV('patients', filteredPatients)}><ArrowDownToLine size={16} />Export</button><button className="btn primary" onClick={() => addPatient()}><Plus size={16} />Add patient</button></> : pageName === 'Appointments' ? <button className="btn primary" onClick={() => addAppointment()}><Plus size={16} />Schedule appointment</button> : pageName === 'Medical Records' ? <button className="btn primary" onClick={() => addConsultation()}><Plus size={16} />New consultation</button> : pageName === 'User Management' && user.role === 'Administrator' ? <button className="btn primary" onClick={() => setModal({
        type: 'user'
      })}><Plus size={16} />Add user</button> : null}
    </div>
  </div>;
}
