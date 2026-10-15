import React, { useEffect, useState } from 'react';
import Form from '../common/Form.jsx';
import { request } from '../../services/api.js';
import { clinicTimeRange } from '../../utils/clinicTime.js';
import '../appointments/scheduling.css';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function AvailabilityForm({ doctor, setModal }) {
  const [state, setState] = useState(null);
  const [days, setDays] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(null); setError(''); setSaved(null);
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    request(`/doctors/${encodeURIComponent(doctor.id)}/slots?date=${date}`, { signal: controller.signal })
      .then(result => { if (active) { setState(result.availability || {}); setDays(result.availability?.weekdays || []); } })
      .catch(error => { if (active && error.name !== 'AbortError') setError(error.message); });
    return () => { active = false; controller.abort(); };
  }, [doctor.id]);
  if (error || !state) return <div className="availability-editor"><p className={`schedule-feedback ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || 'Loading doctor availability…'}</p>
    <button className="btn secondary" onClick={() => setModal(null)}>Cancel</button></div>;
  return <div className="availability-editor" onChangeCapture={() => setSaved(null)}>
    <div className="availability-heading"><strong>{doctor.name}</strong><span>Weekly availability · Asia/Manila</span></div>
    <p className="schedule-hint">Choose working days and a daily time window. Existing appointments stay unchanged.</p>
    {saved && <div className="schedule-feedback success" role="status"><strong>Availability saved</strong><p>{saved.conflicts.length ? `${saved.conflicts.length} existing appointment(s) need schedule review.` : 'No existing appointments need schedule review.'}</p>
      {saved.conflicts.length > 0 && <details><summary>Review scheduling conflicts</summary><ul>{saved.conflicts.map(item => <li key={item.id}>{item.id} · {item.date} · {item.time}</li>)}</ul></details>}</div>}
    <Form values={{ start: state.start || '09:00', end: state.end || '17:00', duration: state.duration || 15 }}
      fields={[
        { name: 'weekdays', label: '', wide: true, render: () => <fieldset className="weekday-fieldset"><legend>Available weekdays</legend><div className="weekday-grid">{weekdays.map((label, day) => <button key={day} type="button" className={`weekday-chip ${days.includes(day) ? 'selected' : ''}`} aria-label={label} aria-pressed={days.includes(day)} onClick={() => {
          setDays(previous => previous.includes(day) ? previous.filter(item => item !== day) : [...previous, day].sort()); setSaved(null);
        }}>{label.slice(0, 3)}<span>{days.includes(day) ? 'On' : 'Off'}</span></button>)}</div></fieldset> },
        { name: 'start', label: 'Start time', type: 'time', step: 300, required: true },
        { name: 'end', label: 'End time', type: 'time', step: 300, required: true },
        { name: 'duration', label: 'Appointment duration (minutes)', type: 'number', min: 5, max: 240, step: 5, required: true, wide: true },
        { name: 'summary', label: '', wide: true, render: values => <div className="schedule-summary" aria-label="Schedule summary"><strong>{days.length ? days.map(day => weekdays[day].slice(0, 3)).join(', ') : 'No working days selected'}</strong>
          <span>{clinicTimeRange(values.start, values.end)} · {values.duration || '—'} minutes per appointment</span>
          <small>{days.length ? 'All times are in Asia/Manila.' : 'New bookings will be disabled. Existing appointments stay unchanged.'}</small></div> }
      ]}
      onCancel={() => setModal(null)} submit="Save availability" onSave={async values => {
        setSaved(null);
        const duration = Number(values.duration);
        const toMinutes = time => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
        const start = toMinutes(values.start), end = toMinutes(values.end);
        if (!Number.isInteger(duration) || duration < 5 || duration > 240 || duration % 5) throw new Error('Use a duration from 5 to 240 minutes in 5-minute intervals.');
        if (!Number.isFinite(start) || !Number.isFinite(end) || start % 5 || end % 5 || start + duration > end) throw new Error('Choose working hours in 5-minute intervals with room for at least one complete appointment.');
        const result = await request(`/users/${encodeURIComponent(doctor.id)}/availability`, { method: 'PATCH', body: { weekdays: days, start: values.start, end: values.end, duration } });
        setSaved(result);
      }} />
  </div>;
}
