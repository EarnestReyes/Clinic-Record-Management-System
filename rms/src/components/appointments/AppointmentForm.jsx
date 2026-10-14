import React from "react";
import Form from "../common/Form.jsx";
import { today } from "../../utils/helpers";

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
    user?.specialty === "general-nurse" ||
    user?.permissions?.specialty === "general-nurse";

  const canSelectStaff = isAdministrator || isIntakeNurse;

  const currentStaffName = user?.name
    ? `Dr. ${user.name}`
    : "";

  const defaultStaff = data.users.find(item => item.active);

  const staffOptions = data.users
    .filter(item => item.active)
    .map(item => `Dr. ${item.name}`);

  const fields = [
    {
      name: "patientId",
      label: "Patient",
      required: true,
      options: active.map(p => ({
        value: p.id,
        label: `${p.name} · ${p.id}`
      }))
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
      name: "date",
      label: "Date",
      type: "date",
      required: true,
      min: today()
    },
    {
      name: "time",
      label: "Time",
      type: "time",
      required: true
    },
    ...(canSelectStaff
      ? [
          {
            name: "staff",
            label: "Attending staff",
            required: true,
            options: staffOptions
          }
        ]
      : []),
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      wide: true
    }
  ];

  const initialValues = original
    ? {
        ...original,
        ...(canSelectStaff ? {} : { staff: currentStaffName }),
        status: "Scheduled"
      }
    : {
        patientId: modal.patientId || active[0]?.id,
        date: modal.date || today(),
        time: "09:00",
        duration: 30,
        staff: canSelectStaff
          ? `Dr. ${defaultStaff?.name || ""}`.trim()
          : currentStaffName,
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
          return notify("Add an active patient first.");
        }

        if (!patient(v.patientId)) {
          return notify("Select a valid patient.");
        }

        const current = getClinicDateTime();

        if (!v.date || v.date < current.date) {
          return notify("Choose today or a future date.");
        }

        if (!v.time) {
          return notify("Choose an appointment time.");
        }

        if (
          v.date === current.date &&
          v.time <= current.time
        ) {
          return notify(
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
          return notify(
            "Enter a valid appointment time and duration."
          );
        }

        const selectedStaff = canSelectStaff
          ? String(v.staff || "").trim()
          : currentStaffName;

        if (!selectedStaff) {
          return notify(
            canSelectStaff
              ? "Select an attending staff member."
              : "Your account does not have a staff name assigned."
          );
        }

        const appointmentValues = {
          ...v,
          staff: selectedStaff
        };

        const staffKey = selectedStaff.toLowerCase();

        const overlaps = data.appointments.some(a => {
          if (a.id === original?.id) return false;
          if (a.date !== appointmentValues.date) return false;
          if (["Cancelled", "No Show"].includes(a.status)) return false;

          if (
            String(a.staff || "").trim().toLowerCase() !== staffKey
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
          return notify(
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