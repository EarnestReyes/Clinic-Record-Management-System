import React from "react";
import Badge from "../common/Badge.jsx";
import { UserRound, Sun, LogOut, Bell, FileText, CalendarDays } from "lucide-react";
import Empty from "../common/Empty.jsx";
export default function WorkspacePanels({
  panel,
  setPanel,
  user,
  go,
  setTab,
  setDark,
  dark,
  setData,
  log,
  setUser,
  unread,
  notify,
  data,
  globalSearch,
  personCell,
  patient,
  setModal
}) {
  return panel && <><div className="panel-dismiss" onClick={() => setPanel('')} /><div className={`dropdown-panel ${panel === 'search' ? 'search-panel' : ''}`}>
      {panel === 'user' ? <><div className="dropdown-heading">
          <strong>
            {user.name}
          </strong>
          <small>
            {user.email}
          </small>
          <Badge>
            {user.role}
          </Badge>
        </div><button onClick={() => {
          go('settings');
          setTab('Account');
        }}><UserRound size={16} />My account</button><button onClick={() => setDark(!dark)}><Sun size={16} />Switch to {dark ? 'light' : 'dark'} mode</button><button className="danger-text" onClick={() => {
          setData(d => ({
            ...d,
            logs: [log('Logout', user.email), ...d.logs]
          }));
          setUser(null);
          setPanel('');
          window.location.hash = 'login';
        }}><LogOut size={16} />Log out</button></> : panel === 'notifications' ? <><div className="row-between dropdown-heading">
          <strong>Notifications <Badge>
              {unread}
            </Badge></strong>
          <button className="text-button" onClick={() => {
            setData(d => ({
              ...d,
              notifications: d.notifications.map(n => ({
                ...n,
                read: true
              }))
            }));
            notify('All notifications marked as read');
          }}>Mark all read</button>
        </div>{data.notifications.map(n => <button key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={() => {
          setData(d => ({
            ...d,
            notifications: d.notifications.map(x => x.id === n.id ? {
              ...x,
              read: true
            } : x)
          }));
          go(n.id === 2 ? 'appointments' : 'dashboard');
        }}>
          <span className="notification-symbol">
            <Bell size={17} />
          </span>
          <div>
            <strong>
              {n.title}
            </strong>
            <p>
              {n.text}
            </p>
          </div>
        </button>)}</> : <><div className="dropdown-heading">
          <strong>Search results</strong>
          <small>Patients, medical records, and appointments</small>
        </div>{globalSearch.trim() ? <>{data.patients.filter(p => `${p.name} ${p.id}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 5).map(p => <button key={p.id} onClick={() => go('patients/' + p.id)}>
            {personCell(p)}
            <Badge>
              {p.status}
            </Badge>
          </button>)}{data.consultations.filter(r => `${r.id} ${r.diagnosis} ${patient(r.patientId)?.name}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 3).map(r => <button key={r.id} onClick={() => {
            setModal({
              type: 'record',
              item: r
            });
            setPanel('');
          }}>
            <FileText size={18} />
            <div>
              <strong>
                {r.diagnosis}
              </strong>
              <small>{r.id} · {patient(r.patientId)?.name}</small>
            </div>
          </button>)}{data.appointments.filter(a => `${a.id} ${a.type} ${patient(a.patientId)?.name}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 3).map(a => <button key={a.id} onClick={() => {
            setModal({
              type: 'appointment-detail',
              item: a
            });
            setPanel('');
          }}>
            <CalendarDays size={18} />
            <div>
              <strong>
                {a.type}
              </strong>
              <small>{patient(a.patientId)?.name} · {a.date}</small>
            </div>
          </button>)}{!JSON.stringify([...data.patients, ...data.consultations, ...data.appointments]).toLowerCase().includes(globalSearch.toLowerCase()) && <Empty />}</> : <p className="dropdown-heading muted">Start typing to find a patient or record.</p>}</>}
    </div></>;
}
