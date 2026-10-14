
import React from "react";
import {
  ArrowRight,
  Heart,
  Activity,
  Users,
  CalendarDays,
  Stethoscope,
  FileText,
  BarChart3
} from "lucide-react";

import Stat from "../components/common/Stat.jsx";
import { today } from "../utils/helpers";
import Card from "../components/common/Card.jsx";
import VisitChart from "../components/charts/VisitChart.jsx";
import { appointmentGradient } from "../utils/chartHelpers.js";
import ArrowUpRightIcon from "../components/common/ArrowUpRightIcon.jsx";

const APPOINTMENT_STATUSES = [
  "Scheduled",
  "Completed",
  "Cancelled",
  "No Show"
];

const STATUS_COLORS = {
  Scheduled: "#0f9985",
  Completed: "#f4b56a",
  Cancelled: "#b5bfc9",
  "No Show": "#e18c8c"
};

export default function Dashboard({
  todays,
  go,
  data,
  active,
  appointmentTable,
  addPatient,
  addConsultation,
  addAppointment
}) {
  const scheduledToday = todays.filter(
    appointment => appointment.status === "Scheduled"
  ).length;

 const activeToday = todays.filter(
  appointment => appointment.status === "Scheduled"
).length;

 // All upcoming scheduled appointments, regardless of date or appointment type.
const upcomingConsultations = data.appointments.filter(
  appointment =>
    appointment.status === "Scheduled" &&
    appointment.date >= today()
).length;

// Consultations recorded during the current month.
const consultationsThisMonth = data.consultations.filter(
  record => record.date?.slice(0, 7) === today().slice(0, 7)
).length;
  const newPatientsToday = data.patients.filter(
    patient => patient.created === today()
  ).length;

  const archivedPatients = data.patients.filter(
    patient => patient.status === "Archived"
  ).length;
console.log('Today:', today());
console.log('Consultation records:', data.consultations);
console.log('Consultation count:', data.consultations.length);
console.log(
  'Consultation dates:',
  data.consultations.map(record => ({
    date: record.date,
    type: record.type
  }))
);
console.log('Monthly total:', consultationsThisMonth);
  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="banner-tag">
            <span className="live-dot" /> A GOOD DAY TO MAKE A DIFFERENCE
          </span>

          <h2>Your patients. Your practice. In harmony.</h2>

          <p>
            You have <strong>{activeToday} active appointments</strong> today.
            Let’s make every visit count.
          </p>

          <button onClick={() => go("appointments")}>
            View today’s schedule <ArrowRight size={15} />
          </button>
        </div>

        <div className="banner-art">
          <div className="art-ring" />
          <div className="art-ring inner" />
          <Heart className="art-heart" size={105} strokeWidth={1.1} />
          <Activity className="art-pulse" size={130} strokeWidth={1.3} />
          <span className="art-plus plus-one">+</span>
          <span className="art-plus plus-two">+</span>
          <span className="art-dot" />
        </div>
      </div>

      <div className="stats-grid">
        <Stat
          icon={Users}
          title="Total patients"
          value={data.patients.length}
          change="All records"
          note="in your workspace"
        />

        <Stat
          icon={Heart}
          title="Active patients"
          value={active.length}
          change={`${
            data.patients.length
              ? Math.round(active.length / data.patients.length * 100)
              : 0
          }%`}
          color="purple"
          note="of total patients"
        />

        <Stat
          icon={CalendarDays}
          title="Today's appointments"
          value={scheduledToday}
          change="Scheduled"
          color="blue"
          note="appointments scheduled for today"
        />

        <Stat
          icon={Stethoscope}
          title="Upcoming consultations"
          value={upcomingConsultations}
          change="Scheduled"
          color="orange"
          note="all appointment types, today onward"
        />
      </div>

      <div className="mini-stats">
        <span>
          <span className="mini-dot teal-dot" />
          <strong>{newPatientsToday}</strong> new patients today
        </span>

        <span>
          <span className="mini-dot purple-dot" />
          <strong>{archivedPatients}</strong> archived records
        </span>

        <span className="sync">
          <span className="live-dot" />
          All records up to date
        </span>
      </div>

      <div className="dashboard-charts">
        <Card
    title="Medical Visits"
    subtitle="An overview of your clinic’s medical activity"
    action={
      <span className="date-pill small">Last 7 days</span>
    }
  >
    <div className="chart-summary">
      <strong>
        {consultationsThisMonth}
        <small>medical visits this month</small>
      </strong>

      <div className="chart-legend">
        <span>
          <i className="consultation-legend" />
          General Consultation
        </span>

        <span>
          <i className="purple-legend" />
          Follow-up Visit
        </span>

        <span>
          <i className="routine-legend" />
          Routine Examination
        </span>

        <span>
          <i className="urgent-legend" />
          Urgent Visit
        </span>
      </div>
    </div>

    <VisitChart records={data.consultations} />

    <p className="chart-disclaimer">
      Live medical record totals · Last seven days
    </p>
  </Card>

  <Card
    // Keep the props of your existing second Card here.
  >
    {/* Keep your existing second card content here. */}
  </Card>

        <Card
          title="Appointment overview"
          subtitle="Today's appointments, by status"
        >
          <div className="donut-area">
            <div
              className="donut"
              style={{
                background: appointmentGradient(todays)
              }}
            >
              <div>
                <strong>{todays.length}</strong>
                <small>Appointments</small>
              </div>
            </div>
          </div>

          <div className="donut-legend">
            {APPOINTMENT_STATUSES.map(status => (
              <div key={status}>
                <span>
                  <i
                    style={{ background: STATUS_COLORS[status] }}
                  />
                  {status}
                </span>

                <strong>
                  {
                    todays.filter(
                      appointment => appointment.status === status
                    ).length
                  }
                </strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="dashboard-lower">
        <Card
          title="Today's appointments"
          subtitle="Your next moments of care"
          action={
            <button
              className="text-button"
              onClick={() => go("appointments")}
            >
              View all <ArrowRight size={15} />
            </button>
          }
        >
          {appointmentTable(todays.slice(0, 5), true)}
        </Card>

        <Card
          title="Recent activity"
          subtitle="What's new in your workspace"
          action={
            <button
              className="icon-button"
              aria-label="View all activity"
              onClick={() => go("audit-logs")}
            >
              <ArrowUpRightIcon />
            </button>
          }
        >
          <div className="activity-list">
            {data.logs.slice(0, 4).map((log, index) => (
              <div key={log.id}>
                <span className={`activity-icon tone-${index % 5}`}>
                  {index % 2
                    ? <Stethoscope size={16} />
                    : <FileText size={16} />}
                </span>

                <div>
                  <strong>{log.action}</strong>
                  <p>{log.detail}</p>
                  <small>
                    {new Date(log.date).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}{" "}
                    · {log.actor}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="quick-actions">
        <span>Make your next move</span>

        {[
          [Users, "Add a patient", () => addPatient()],
          [
            Stethoscope,
            "New consultation",
            data?.permissions?.createConsultation === true
              ? () => addConsultation()
              : null
          ],
          [CalendarDays, "Schedule a visit", () => addAppointment()],
          [
            BarChart3,
            "Explore reports",
            data?.permissions?.viewReports === true
              ? () => go("reports")
              : null
          ]
        ]
          .filter(item => typeof item[2] === "function")
          .map(([Icon, label, action]) => (
            <button key={label} onClick={action}>
              <Icon size={18} />
              {label}
              <ArrowRight size={15} />
            </button>
          ))}
      </div>
    </>
  );
}
