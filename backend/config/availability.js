import { ApiError } from '../middleware/errors.js';
import { date, appointmentSlots } from '../middleware/validation.js';

export const minutes = time => {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ApiError(400, 'Use a valid HH:mm clinic time.');
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function validateAvailability(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Doctor availability is required.');
  const { weekdays, start, end, duration } = value;
  if (!Array.isArray(weekdays) || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(weekdays).size !== weekdays.length) throw new ApiError(400, 'Choose valid, distinct weekdays.');
  const first = minutes(start), last = minutes(end), interval = Number(duration);
  appointmentSlots(start, interval);
  if (last <= first || last % 5 || first + interval > last) throw new ApiError(400, 'Working hours must contain at least one complete appointment slot.');
  return { weekdays, start, end, duration: interval };
}
export function scheduleSlots(availability, appointmentDate) {
  date(appointmentDate);
  if (!availability || !availability.weekdays?.length) return [];
  const schedule = validateAvailability(availability);
  // A date-only value represents the Manila clinic calendar, independent of server timezone.
  if (!schedule.weekdays.includes(new Date(`${appointmentDate}T00:00:00Z`).getUTCDay())) return [];
  const slots = [];
  for (let time = minutes(schedule.start); time + schedule.duration <= minutes(schedule.end); time += schedule.duration) {
    slots.push({ time: clock(time), end: clock(time + schedule.duration), duration: schedule.duration });
  }
  return slots;
}
export function validateBooking(availability, appointmentDate, time, duration) {
  const slot = scheduleSlots(availability, appointmentDate).find(slot => slot.time === time && slot.duration === Number(duration));
  if (!slot) throw new ApiError(400, 'Choose a fixed slot within the configured doctor availability.');
  return slot;
}
export function overlaps(time, duration, booking) {
  const start = minutes(time), other = minutes(booking.time);
  return start < other + Number(booking.duration ?? 30) && other < start + Number(duration);
}
