import React from "react";
import { ArrowRight, Heart, Activity, Users, CalendarDays, Stethoscope, FileText, BarChart3 } from "lucide-react";
import Stat from "../components/common/Stat.jsx";
import { today } from "../utils/helpers";
import Card from "../components/common/Card.jsx";
import VisitChart from "../components/charts/VisitChart.jsx";
import { appointmentGradient } from "../utils/chartHelpers.js";
import ArrowUpRightIcon from "../components/common/ArrowUpRightIcon.jsx";
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
  return <><div className="welcome-banner">
      <div>
        <span className="banner-tag"><span className="live-dot" /> A GOOD DAY TO MAKE A DIFFERENCE</span>
        <h2>Your patients. Your practice. In harmony.</h2>
        <p>You have <strong>{todays.filter(a => !['Cancelled', 'No Show'].includes(a.status)).length} appointments</strong> today. Let’s make every visit count.</p>
        <button onClick={() => go('appointments')}>View today’s schedule<ArrowRight size={15} /></button>
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
    </div><div className="stats-grid">
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
        change={`${Math.round(active.length / data.patients.length * 100)}%`} 
        color="purple" 
        note="of total patients" 
      />
      <Stat 
        icon={CalendarDays} 
        title="Today’s appointments" 
        value={todays.length} 
        change={`${todays.filter(a => a.status === 'Confirmed').length} confirmed`} 
        color="blue" 
        note="ready for today" 
      />
      <Stat 
        icon={Stethoscope} 
        title="Today’s consultations" 
        value={data.consultations.filter(r => r.date === today()).length} 
        change="Updated live" 
        color="orange" 
        note="in your workspace" 
      />
    </div><div className="mini-stats">
      <span><span className="mini-dot teal-dot" /><strong>
          {data.patients.filter(p => p.created === today()).length}
        </strong> new patients today</span>
      <span><span className="mini-dot purple-dot" /><strong>
          {data.patients.filter(p => p.status === 'Archived').length}
        </strong> archived records</span>
      <span className="sync"><span className="live-dot" />All records up to date</span>
    </div><div className="dashboard-charts">
      <Card title="Patient visits" subtitle="A little perspective on your clinic’s week" action={<span className="date-pill small">Last 7 days</span>}>
        <div className="chart-summary">
          <strong>
            {data.consultations.filter(r => r.date.slice(0, 7) === today().slice(0, 7)).length}
            <small>visits this month</small>
          </strong>
          <span className="chart-legend"><i />Consultations<i className="purple-legend" />Follow-ups</span>
        </div>
        <VisitChart records={data.consultations} />
        <p className="chart-disclaimer">Live record totals · Last seven days</p>
      </Card>
      <Card title="Appointment overview" subtitle="Today’s schedule, by status">
        <div className="donut-area">
          <div className="donut" style={{
            background: appointmentGradient(todays)
          }}>
            <div>
              <strong>
                {todays.length}
              </strong>
              <small>Appointments</small>
            </div>
          </div>
        </div>
        <div className="donut-legend">
          {['Confirmed', 'Pending', 'Completed', 'Cancelled', 'No Show'].map((s, i) => <div key={s}>
            <span>
              <i style={{
                background: ['#0f9985', '#9b91ea', '#f4b56a', '#b5bfc9', '#e18c8c'][i]
              }} />
              {s}
            </span>
            <strong>
              {todays.filter(a => a.status === s).length}
            </strong>
          </div>)}
        </div>
      </Card>
    </div><div className="dashboard-lower">
      <Card title="Today’s appointments" subtitle="Your next moments of care" action={<button className="text-button" onClick={() => go('appointments')}>View all<ArrowRight size={15} /></button>}>
        {appointmentTable(todays.slice(0, 5), true)}
      </Card>
      <Card title="Recent activity" subtitle="What’s new in your workspace" action={<button className="icon-button" aria-label="View all activity" onClick={() => go('audit-logs')}>
          <ArrowUpRightIcon />
        </button>}>
        <div className="activity-list">
          {data.logs.slice(0, 4).map((l, i) => <div key={l.id}>
            <span className={`activity-icon tone-${i % 5}`}>
              {i % 2 ? <Stethoscope size={16} /> : <FileText size={16} />}
            </span>
            <div>
              <strong>
                {l.action}
              </strong>
              <p>
                {l.detail}
              </p>
              <small>{new Date(l.date).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })} · {l.actor}</small>
            </div>
          </div>)}
        </div>
      </Card>
    </div><div className="quick-actions">
      <span>Make your next move</span>
      {[[Users, 'Add a patient', () => addPatient()], [Stethoscope, 'New consultation', () => addConsultation()], [CalendarDays, 'Schedule a visit', () => addAppointment()], [BarChart3, 'Explore reports', () => go('reports')]].map(([Icon, n, f]) => <button key={n} onClick={f}>
        <Icon size={18} />
        {n}
        <ArrowRight size={15} />
      </button>)}
    </div></>;
}
