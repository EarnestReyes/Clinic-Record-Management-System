import React from "react";
import { statuses } from "../data/formFields.js";
import Badge from "../components/common/Badge.jsx";
import { Search, ClipboardList, CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { today } from "../utils/helpers";
export default function Appointments({
  filter,
  setFilter,
  data,
  query,
  setQuery,
  calendar,
  setCalendar,
  calendarDate,
  setCalendarDate,
  patient,
  setModal,
  appointmentTable
}) {
  return <><div className="appointment-summary">
      {statuses.map(s => <button key={s} className={filter === s ? 'selected' : ''} onClick={() => setFilter(filter === s ? 'All' : s)}>
        <Badge>
          {s}
        </Badge>
        <strong>
          {data.appointments.filter(a => a.status === s).length}
        </strong>
      </button>)}
    </div><section className="card">
      <div className="list-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input 
            placeholder="Search appointments or patients..." 
            aria-label="Search appointments" 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
          />
        </div>
        <div className="view-toggle">
          <button className={!calendar ? 'active' : ''} onClick={() => setCalendar(false)}><ClipboardList size={16} />List</button>
          <button className={calendar ? 'active' : ''} onClick={() => setCalendar(true)}><CalendarDays size={16} />Calendar</button>
        </div>
      </div>
      {calendar ? <><div className="calendar-toolbar">
          <button className="icon-button" aria-label="Previous month" onClick={() => {
            const d = new Date(calendarDate + 'T12:00:00');
            d.setDate(1);
            d.setMonth(d.getMonth() - 1);
            setCalendarDate(d.toLocaleDateString('en-CA'));
          }}>
            <ChevronLeft size={18} />
          </button>
          <h3>
            {new Date(calendarDate + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric'
            })}
          </h3>
          <button className="icon-button" aria-label="Next month" onClick={() => {
            const d = new Date(calendarDate + 'T12:00:00');
            d.setDate(1);
            d.setMonth(d.getMonth() + 1);
            setCalendarDate(d.toLocaleDateString('en-CA'));
          }}>
            <ChevronRight size={18} />
          </button>
          <button className="btn secondary" onClick={() => setCalendarDate(today())}>Today</button>
        </div><div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div className="calendar-day-name" key={d}>
            {d}
          </div>)}
          {Array.from({
            length: new Date(new Date(calendarDate + 'T12:00:00').getFullYear(), new Date(calendarDate + 'T12:00:00').getMonth(), 1).getDay()
          }, (_, i) => <div className="calendar-day blank" key={'blank' + i} />)}
          {Array.from({
            length: new Date(new Date(calendarDate + 'T12:00:00').getFullYear(), new Date(calendarDate + 'T12:00:00').getMonth() + 1, 0).getDate()
          }, (_, i) => {
            const d = calendarDate.slice(0, 7) + '-' + String(i + 1).padStart(2, '0');
            const items = data.appointments.filter(a => a.date === d && (filter === 'All' || a.status === filter) && `${a.type} ${patient(a.patientId)?.name}`.toLowerCase().includes(query.toLowerCase()));
            return <div className={`calendar-day ${d === today() ? 'today' : ''}`} key={d}>
            <span>
              {i + 1}
            </span>
            <button className="calendar-add" aria-label={'Schedule for ' + d} onClick={() => setModal({
                type: 'appointment',
                date: d
              })}>
              <Plus size={13} />
            </button>
            {items.slice(0, 3).map(a => <button className="calendar-event" key={a.id} onClick={() => setModal({
                type: 'appointment-detail',
                item: a
              })}>
              {a.time}{' '}
              {patient(a.patientId)?.name.split(' ')[0]}
            </button>)}
            {items.length > 3 && <button className="text-button" onClick={() => {
                setCalendar(false);
                setQuery(patient(items[3].patientId)?.name || '');
              }}>+{items.length - 3} more</button>}
          </div>;
          })}
        </div></> : appointmentTable(data.appointments.filter(a => (filter === 'All' || a.status === filter) && `${a.id} ${a.type} ${patient(a.patientId)?.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))}
    </section></>;
}
