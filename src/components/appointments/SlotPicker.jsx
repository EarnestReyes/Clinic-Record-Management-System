import React, { useEffect, useRef, useState } from 'react';
import { request } from '../../services/api.js';
import { clinicTimeRange } from '../../utils/clinicTime.js';
import './scheduling.css';

export default function SlotPicker({ doctorId, date, value, onChange, appointmentId, hideSchedule = false }) {
  const [state, setState] = useState({ loading: true });
  const change = useRef(onChange);
  change.current = onChange;
  const selection = useRef(value);
  selection.current = value;
  const key = `${doctorId}|${date}|${appointmentId || ''}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ loading: true, key });
    if (!doctorId || !date) {
      setState({ key, message: 'Select a doctor and date to view availability.' });
      if (selection.current) change.current('');
      return () => { active = false; controller.abort(); };
    }
    const query = new URLSearchParams({ date, ...(appointmentId ? { exclude: appointmentId } : {}) });
    request(`/doctors/${encodeURIComponent(doctorId)}/slots?${query}`, { signal: controller.signal })
      .then(result => {
        if (!active) return;
        setState({ ...result, key });
        if (selection.current && !result.slots?.some(slot => slot.time === selection.current && !slot.booked && !slot.past)) change.current('');
      }).catch(error => {
        if (active && error.name !== 'AbortError') {
          setState({ key, message: error.message, error: true });
          if (selection.current) change.current('');
        }
      });
    return () => { active = false; controller.abort(); };
  }, [doctorId, date, appointmentId, key]);
  const loading = state.loading || state.key !== key;
  const slots = loading ? [] : state.slots || [];
  const selected = slots.find(slot => slot.time === value && !slot.booked && !slot.past);
  const available = slots.filter(slot => !slot.booked && !slot.past);
  const past = slots.filter(slot => slot.past);
  const schedule = state.availability;
  const renderSlots = items => <div className="slot-grid">{items.map(slot => {
    const status = slot.past ? 'Past' : slot.booked ? 'Booked' : selected?.time === slot.time ? 'Selected' : 'Available';
    return <button key={slot.time} type="button" className={`slot-card ${status.toLowerCase()}`}
      aria-pressed={status === 'Selected'} disabled={slot.booked || slot.past}
      aria-label={`${clinicTimeRange(slot.time, slot.end)}, ${status}`} onClick={() => change.current(slot.time)}>
      <strong>{clinicTimeRange(slot.time, slot.end)}</strong><span>{status}</span>
    </button>;
  })}</div>;
  return <section className="slot-picker" aria-label="Appointment time slots" aria-busy={loading}>
    <input type="hidden" name="time" value={selected?.time || ''} />
    <input type="hidden" name="duration" value={selected?.duration || ''} />
    {loading ? <p className="schedule-feedback" role="status">Loading doctor availability…</p> : state.message ?
      <p className={`schedule-feedback ${state.error ? 'error' : ''}`} role={state.error ? 'alert' : 'status'}>{state.message}</p> : <>
      {!hideSchedule && schedule && <div className="schedule-guide"><strong>{clinicTimeRange(schedule.start, schedule.end)}</strong>
        <span>{schedule.duration} minutes per appointment · Asia/Manila</span>
        <small>{schedule.weekdays.map(day => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(', ')}</small>
      </div>}
      {!available.length && <p className="schedule-feedback" role="status">{!schedule ? 'No schedule configured. Ask an administrator to configure availability.' : 'No available slots on this date. Choose another date or doctor.'}</p>}
      {['Morning', 'Afternoon'].map((label, index) => {
        const group = slots.filter(slot => !slot.past && (Number(slot.time.slice(0, 2)) < 12 ? 0 : 1) === index);
        return group.length > 0 && <div className="slot-period" role="group" aria-label={label} key={label}><h4>{label}</h4>{renderSlots(group)}</div>;
      })}
      {past.length > 0 && <details className="past-slots"><summary>Past slots ({past.length})</summary>{renderSlots(past)}</details>}
      <p className={`slot-selection ${selected ? 'selected' : ''}`} role="status">
        {selected ? `Selected: ${clinicTimeRange(selected.time, selected.end)} · Asia/Manila` : 'Select an available time slot to continue.'}
      </p>
    </>}
  </section>;
}
