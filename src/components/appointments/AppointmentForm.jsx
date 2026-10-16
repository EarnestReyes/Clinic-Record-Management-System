import React from "react";
import Form from "../common/Form.jsx";
import AvailabilitySchedule from './AvailabilitySchedule.jsx';
import SlotPicker from './SlotPicker.jsx';
import { doctorsFor, doctorLabel } from '../../utils/doctors.js';

function toMinutes(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return NaN;
  }

  return hours * 60 + minutes;
}

function getClinicDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`
  };
}

export default function AppointmentForm({
  active,
  modal,
  setModal,
  notify,
  data,
  commit,
  patient,
  user
}) {
  const original = modal.item;

  const isReschedule =
    Boolean(modal.reschedule || original?.reschedule) ||
    ["Cancelled", "No Show"].includes(original?.status);

  const isAdministrator = user?.role === "Administrator";

  const isIntakeNurse =
    user?.permissions?.intake === true;

  const canSelectStaff = isAdministrator || isIntakeNurse;

  const doctors = doctorsFor(data);
  const routedDoctor = doctors.find(doctor => doctor.id === patient(modal.patientId)?.assignedStaffId);
  const defaultStaff = routedDoctor;
  const specialtyOf = doctor => doctor?.specialty || '';
  const eligibleDoctors = canSelectStaff ? doctors : doctors.filter(doctor => doctor.id === user?.id);
  const initialDoctor = original ? doctors.find(doctor => doctor.id === original.staffId) : (canSelectStaff ? defaultStaff : user);
  const specialtyOptions = [{ value: '', label: 'Select a specialty' }, ...(data.specialties || [])
    .filter(item => item.kind === 'clinical' && (canSelectStaff || item.key === specialtyOf(user)))
    .map(item => ({ value: item.key, label: item.label }))];

  const staffOptions = [{ value: '', label: 'Select a doctor' }, ...eligibleDoctors
    .map(item => ({ value: item.id, label: doctorLabel(item, data.specialties) }))];

  const fields = [
    {
      name: "patientId",
      label: "Patient",
      wide: true,
      required: true,
      options: active.map(p => ({
        value: p.id,
        label: `${p.name} · ${p.id}`
      }))
    },
    { name: 'specialty', label: 'Consultation specialty', required: true, options: specialtyOptions },
    {
      name: "staffId",
      label: "Attending staff",
      required: true,
      options: staffOptions,
      dependsOn: 'specialty',
      optionsFor: values => staffOptions.filter(option => !option.value
        || eligibleDoctors.some(doctor => doctor.id === option.value && specialtyOf(doctor) === values.specialty))
    },
    { name: 'availability', label: 'Doctor availability schedule', wide: true,
      render: values => <AvailabilitySchedule doctorId={values.staffId} /> },
    {
      name: 'date', label: 'Date', wide: true, type: 'date', required: true, min: getClinicDateTime().date
    },
    {
      name: 'time', label: 'Time slot', required: true, wide: true,
      dependsOn: ['staffId', 'date', 'specialty'],
      render: (values, change) => <SlotPicker key={`${values.staffId}-${values.date}`} doctorId={values.staffId} date={values.date} value={values.time}
        appointmentId={original?.id} hideSchedule onChange={value => change('time', value)} />
    },
    {
      name: "type",
      label: "Appointment type",
      required: true,
      options: [
        "General check-up",
        "Follow-up",
        "Consultation",
        "Vaccination",
        "Laboratory review"
      ]
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      wide: true
    }
  ];

  if (!canSelectStaff) {
    fields.splice(1, 2, { name: 'assignment', label: 'Assigned doctor', wide: true,
      render: () => <div className="schedule-guide"><strong>Assigned to: {doctorLabel(user, data.specialties)}</strong>
        <input type="hidden" name="staffId" value={user?.id || ''} />
        <input type="hidden" name="specialty" value={specialtyOf(user)} />
        {!specialtyOptions.some(option => option.value && option.value === specialtyOf(user)) && <p role="alert">Your account needs a valid clinical specialty before booking.</p>}
      </div> });
  }
  const initialValues = original
    ? {
        ...original,
        staffId: canSelectStaff ? original.staffId : user?.id,
        specialty: original.specialty || specialtyOf(initialDoctor),
        status: "Scheduled"
      }
    : {
        patientId: modal.patientId || active[0]?.id,
        date: modal.date || getClinicDateTime().date,
        time: "",
        staffId: canSelectStaff ? defaultStaff?.id : user?.id,
        specialty: specialtyOf(initialDoctor),
        status: "Scheduled",
        notes: ""
      };

  return (
    <Form
      fields={fields}
      values={initialValues}
      submit={
        isReschedule
          ? "Save Rescheduled Appointment"
          : original
            ? "Save Appointment Changes"
            : "Schedule Appointment"
      }
      onCancel={() => setModal(null)}
      onSave={v => {
        if (!active.length) {
          throw new Error("Add an active patient first.");
        }

        if (!patient(v.patientId)) {
          throw new Error("Select a valid patient.");
        }

        const current = getClinicDateTime();

        if (!v.date || v.date < current.date) {
          throw new Error("Choose today or a future date.");
        }

        if (!v.time) {
          throw new Error("Choose an appointment time.");
        }

        if (
          v.date === current.date &&
          v.time <= current.time
        ) {
          throw new Error(
            "Choose a future time. Appointments cannot be scheduled in the past."
          );
        }

        const start = toMinutes(v.time);
        const duration = Number(
          v.duration ?? original?.duration ?? 30
        );

        if (
          !Number.isFinite(start) ||
          !Number.isFinite(duration) ||
          duration <= 0 ||
          start + duration > 24 * 60
        ) {
          throw new Error(
            "Enter a valid appointment time and duration."
          );
        }

        const selectedStaffId = canSelectStaff ? v.staffId : user?.id;
        const selectedAccount = doctors.find(item => item.id === selectedStaffId);
        if (!v.specialty || !selectedAccount || specialtyOf(selectedAccount) !== v.specialty) {
          throw new Error('Select a specialty and a matching doctor.');
        }
        const selectedStaff = selectedAccount ? `Dr. ${selectedAccount.name}` : '';

        if (!selectedStaff) {
          throw new Error(
            canSelectStaff
              ? "Select an attending staff member."
              : "Your account does not have a staff name assigned."
          );
        }

        const appointmentValues = {
          ...v,
          staffId: selectedStaffId,
          staff: selectedStaff
        };

        const overlaps = data.appointments.some(a => {
          if (a.id === original?.id) return false;
          if (a.date !== appointmentValues.date) return false;
          if (a.status !== 'Scheduled') return false;

          if (
            a.staffId !== selectedStaffId
          ) {
            return false;
          }

          const otherStart = toMinutes(a.time);
          const otherDuration = Number(a.duration ?? 30);

          if (
            !Number.isFinite(otherStart) ||
            !Number.isFinite(otherDuration)
          ) {
            return false;
          }

          return (
            start < otherStart + otherDuration &&
            otherStart < start + duration
          );
        });

        if (overlaps) {
          throw new Error(
            "This staff member already has an overlapping appointment."
          );
        }

        const appointment = {
          ...original,
          ...appointmentValues,
          duration,
          status: "Scheduled",
          id: original?.id || `APT-${Date.now()}`
        };

        const nextAppointments = original
          ? data.appointments.map(a =>
              a.id === original.id ? appointment : a
            )
          : [...data.appointments, appointment];

        return commit(
          "appointments",
          nextAppointments,
          isReschedule
            ? "Appointment rescheduled"
            : original
              ? "Appointment changed"
              : "Appointment scheduled",
          `${patient(appointmentValues.patientId)?.name || "Patient"} · ${appointment.id}`
        );
      }}
    />
  );
}
