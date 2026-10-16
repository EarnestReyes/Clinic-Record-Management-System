import React, { useEffect, useState } from 'react';
import { request } from '../../services/api.js';
import { clinicTimeRange } from '../../utils/clinicTime.js';
import { today } from '../../utils/helpers.js';
export default function AvailabilitySchedule({ doctorId }) {
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    setState({});
    if (doctorId) request('/doctors/' + encodeURIComponent(doctorId) + '/slots?date=' + today(), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ doctorId, schedule: result.availability }); })
      .catch(error => { if (!controller.signal.aborted) setState({ doctorId, error: error.message }); });
    return () => controller.abort();
  }, [doctorId]);
  const schedule = state.doctorId === doctorId ? state.schedule : null;
  return <div className="schedule-guide" aria-label="Doctor availability schedule">
    {schedule?.weekdays?.length ? <><strong>{clinicTimeRange(schedule.start, schedule.end)}</strong><span>{schedule.duration} minutes per appointment / Asia/Manila</span><small>{schedule.weekdays.map(day => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(', ')}</small></>
      : <p role={state.error || state.doctorId ? 'alert' : 'status'}>{!doctorId ? 'Select a doctor to view availability.' : state.error || (state.doctorId ? 'No schedule configured. Ask an administrator to configure availability.' : 'Loading doctor availability...')}</p>}
  </div>;
}
