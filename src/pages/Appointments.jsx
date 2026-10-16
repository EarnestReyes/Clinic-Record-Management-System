
import React, { useMemo, useState } from "react";
import { displayIdentity } from "../../shared/displayIdentity.js";
import { statuses } from "../data/formFields.js";
import Badge from "../components/common/Badge.jsx";
import './AppointmentsResponsive.css';

import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarClock,
  CheckCircle2,
  Ban,
  UserX
} from "lucide-react";

import { today } from "../utils/helpers";

const PERIODS = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "Custom dates", value: "custom" }
];

const STATUS_ICONS = {
  Scheduled: CalendarClock,
  Completed: CheckCircle2,
  Cancelled: Ban,
  "No Show": UserX,
  "No-show": UserX
};

function dateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function shiftDate(value, amount) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);

  return dateString(date);
}

function formatDisplayDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function getRange(period, customFrom, customTo, selectedDate) {
  if (period === "today") {
    return { from: today(), to: today() };
  }

  if (period === "7days") {
    return { from: shiftDate(today(), -6), to: today() };
  }

  if (period === "30days") {
    return { from: shiftDate(today(), -29), to: today() };
  }

  if (period === "custom") {
    return { from: customFrom, to: customTo };
  }

  return { from: selectedDate, to: selectedDate };
}

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
  const [period, setPeriod] = useState("today");
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [customFrom, setCustomFrom] = useState(() => today());
  const [customTo, setCustomTo] = useState(() => today());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);

  const appointments = data?.appointments || [];

  // Calculate the active date range BEFORE using it in headings.
  const range = useMemo(
    () => getRange(period, customFrom, customTo, selectedDate),
    [period, customFrom, customTo, selectedDate]
  );

  const rangeIsValid =
    Boolean(range.from) &&
    Boolean(range.to) &&
    range.from <= range.to;

  // Calendar-selected dates take priority over the active period.
  const rangeAppointments = useMemo(() => {
    if (calendarSelectedDate) {
      return appointments.filter(
        appointment =>
          parseDate(appointment.date) === calendarSelectedDate
      );
    }

    if (!rangeIsValid) return [];

    return appointments.filter(appointment => {
      const date = parseDate(appointment.date);

      return date && date >= range.from && date <= range.to;
    });
  }, [
    appointments,
    calendarSelectedDate,
    range.from,
    range.to,
    rangeIsValid
  ]);

  const appointmentHeading = (() => {
    if (calendarSelectedDate) {
      if (calendarSelectedDate === today()) {
        return "Today's Appointments";
      }

      return calendarSelectedDate < today()
        ? "Past Appointments"
        : "Upcoming Appointments";
    }

    if (period === "today") return "Today's Appointments";
    if (period === "7days") return "Past 7 Days";
    if (period === "30days") return "Past 30 Days";

    return "Custom Appointments";
  })();

  const appointmentDateLabel = (() => {
    if (calendarSelectedDate) {
      return formatDisplayDate(calendarSelectedDate);
    }

    if (!range.from || !range.to) return "";

    return range.from === range.to
      ? formatDisplayDate(range.from)
      : `${formatDisplayDate(range.from)} – ${formatDisplayDate(range.to)}`;
  })();

  const filteredAppointments = useMemo(() => {
    const search = (query || "").trim().toLowerCase();

    return rangeAppointments
      .filter(appointment =>
        filter === "All" || appointment.status === filter
      )
      .filter(appointment => {
        const linkedPatient =
          patient(appointment.patientId) ||
          appointment.patient ||
          {};

        const searchableText = [
          appointment.id,
          appointment._id,
          displayIdentity(appointment),
          appointment.type,
          appointment.staff,
          linkedPatient.name,
          appointment.status,
          appointment.date,
          appointment.time
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(search);
      })
      .sort((a, b) =>
        `${a.date || ""}${a.time || ""}`.localeCompare(
          `${b.date || ""}${b.time || ""}`
        )
      );
  }, [rangeAppointments, filter, query, patient]);

  const statusCounts = useMemo(() => {
    return statuses.reduce((counts, status) => {
      counts[status] = rangeAppointments.filter(
        appointment => appointment.status === status
      ).length;

      return counts;
    }, {});
  }, [rangeAppointments]);

  const changePeriod = value => {
    setCalendarSelectedDate(null);
    setPeriod(value);
    setFilter("All");
    setQuery("");

    if (value === "today" || value === "7days" || value === "30days") {
      setSelectedDate(today());
      setCalendarDate(today());
    }

    if (value === "custom") {
      setCustomFrom(today());
      setCustomTo(today());
      setSelectedDate(today());
      setCalendarDate(today());
    }
  };

  const applyCustomDates = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;

    setCalendarSelectedDate(null);
    setPeriod("custom");
    setSelectedDate(customFrom);
    setCalendarDate(customFrom);
    setFilter("All");
    setQuery("");
    setCalendar(false);
  };

  const chooseCalendarDate = date => {
    setCalendarSelectedDate(date);
    setSelectedDate(date);
    setCustomFrom(date);
    setCustomTo(date);
    setPeriod("custom");
    setCalendarDate(date);
    setFilter("All");
    setQuery("");
    setCalendar(false);
  };

  const moveMonth = amount => {
    const date = new Date(`${calendarDate}T12:00:00`);

    date.setDate(1);
    date.setMonth(date.getMonth() + amount);

    setCalendarDate(dateString(date));
  };

  const monthDate = new Date(`${calendarDate}T12:00:00`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDayString = day =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const rangeLabel = () => {
    if (calendarSelectedDate) {
      return formatDisplayDate(calendarSelectedDate);
    }

    if (period === "today") return "Today";
    if (period === "7days") return "Last 7 days";
    if (period === "30days") return "Last 30 days";

    if (period === "custom") {
      if (!range.from || !range.to) return "Custom dates";

      return range.from === range.to
        ? range.from
        : `${range.from} – ${range.to}`;
    }

    return "Selected period";
  };

  return (
    <>
      <section className="appointment-overview">
        <div className="appointment-period-row">
          <div className="appointment-period-control">
            <label htmlFor="appointment-period">
              Activity period
            </label>

            <select
              id="appointment-period"
              value={period}
              onChange={event => changePeriod(event.target.value)}
            >
              {PERIODS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {period === "custom" && !calendarSelectedDate && (
            <div className="appointment-custom-dates">
              <div className="appointment-date-field">
                <label htmlFor="appointment-from">From</label>

                <input
                  id="appointment-from"
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={event => setCustomFrom(event.target.value)}
                />
              </div>

              <div className="appointment-date-field">
                <label htmlFor="appointment-to">To</label>

                <input
                  id="appointment-to"
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={event => setCustomTo(event.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn secondary appointment-apply-dates"
                disabled={
                  !customFrom ||
                  !customTo ||
                  customFrom > customTo
                }
                onClick={applyCustomDates}
              >
                Apply dates
              </button>
            </div>
          )}
        </div>

        <div className="appointment-summary">
          {statuses.map(status => {
            const StatusIcon = STATUS_ICONS[status] || CalendarDays;

            return (
              <button
                type="button"
                key={status}
                className={
                  filter === status
                    ? "appointment-status-card selected"
                    : "appointment-status-card"
                }
                aria-pressed={filter === status}
                onClick={() =>
                  setFilter(filter === status ? "All" : status)
                }
              >
                <span className="appointment-status-heading">
                  <span
                    className={`appointment-status-icon status-${status
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    <StatusIcon size={18} strokeWidth={2} />
                  </span>

                  <span className="appointment-status-label">
                    <Badge>{status}</Badge>
                  </span>
                </span>

                <strong className="appointment-status-count">
                  {statusCounts[status] ?? 0}
                </strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card appointment-main-card">
        <div className="appointment-panel-header">
          <div>
            <h3>{appointmentHeading}</h3>
            <p className="muted">{appointmentDateLabel}</p>
          </div>
        </div>

        <div className="list-toolbar">
          <div className="search-input">
            <Search size={17} />

            <input
              placeholder="Search appointments or patients..."
              aria-label="Search appointments"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>

          <div className="view-toggle">
            <button
              type="button"
              className={calendar ? "active" : ""}
              onClick={() => setCalendar(value => !value)}
              aria-pressed={calendar}
            >
              <CalendarDays size={16} />
              Calendar
            </button>
          </div>
        </div>

        {!rangeIsValid && period === "custom" && (
          <p className="appointment-filter-error" role="alert">
            Please choose a valid date range. The From date must not be
            later than the To date.
          </p>
        )}

        {!calendar ? (
          <div className="appointment-list-view">
            {appointmentTable(filteredAppointments)}
          </div>
        ) : (
          <div className="calendar-view">
            <div className="calendar-toolbar">
              <button
                type="button"
                className="icon-button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={18} />
              </button>

              <h3>
                {monthDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric"
                })}
              </h3>

              <button
                type="button"
                className="icon-button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={18} />
              </button>

              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setCalendarDate(today());
                }}
              >
                Today
              </button>
            </div>

            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div className="calendar-day-name" key={day}>
                  {day}
                </div>
              ))}

              {Array.from({ length: firstDay }, (_, index) => (
                <div
                  className="calendar-day blank"
                  key={`blank-${index}`}
                />
              ))}

              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const date = calendarDayString(day);

                const dayAppointments = appointments
                  .filter(
                    appointment => parseDate(appointment.date) === date
                  )
                  .filter(
                    appointment =>
                      filter === "All" || appointment.status === filter
                  );

                return (
                  <div
                    key={date}
                    className={[
                      "calendar-day",
                      date === today() ? "today" : "",
                      date === (calendarSelectedDate || selectedDate)
                        ? "selected-day"
                        : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      className="calendar-date-select"
                      onClick={() => chooseCalendarDate(date)}
                      aria-label={`Show appointments for ${date}: ${dayAppointments.length} appointments`}
                      aria-current={date === today() ? 'date' : undefined}
                      aria-pressed={date === (calendarSelectedDate || selectedDate)}
                    >
                      {day}
                      <span className="calendar-mobile-count" aria-hidden="true">{dayAppointments.length || '—'}</span>
                    </button>

                    <button
                      type="button"
                      className="calendar-add"
                      aria-label={`Schedule appointment for ${date}`}
                      onClick={() => setModal({ type: "appointment", date })}
                    >
                      <Plus size={13} />
                    </button>

                    {dayAppointments.slice(0, 3).map(appointment => {
                      const linkedPatient =
                        patient(appointment.patientId) ||
                        appointment.patient ||
                        {};

                      return (
                        <button
                          type="button"
                          className="calendar-event"
                          key={appointment.id || appointment._id}
                          onClick={() =>
                            setModal({
                              type: "appointment-detail",
                              item: appointment
                            })
                          }
                          title={`${appointment.time || ""} ${
                            linkedPatient.name || "Patient"
                          }`}
                        >
                          {appointment.time || ""}{" "}
                          {linkedPatient.name
                            ? linkedPatient.name.split(" ")[0]
                            : "Appointment"}
                        </button>
                      );
                    })}

                    {dayAppointments.length > 3 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => chooseCalendarDate(date)}
                      >
                        +{dayAppointments.length - 3} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="muted calendar-instruction">
              Select a date to show its appointments in the appointment
              table.
            </p>
            <button type="button" className="btn secondary calendar-mobile-schedule" onClick={() => setModal({ type: 'appointment', date: calendarDate })}><Plus size={16} />Schedule appointment</button>
          </div>
        )}
      </section>
    </>
  );
}
