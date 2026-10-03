import React from "react";
import Card from "../components/common/Card.jsx";
import Form from "../components/common/Form.jsx";
import { CheckCircle2, ShieldCheck } from "lucide-react";
export default function Settings({
  tab,
  setTab,
  data,
  notify,
  commit,
  user,
  setUser,
  dark,
  setDark,
  setData
}) {
  return <><div className="tabs">
      {['Clinic Profile', 'Account', 'Appearance', 'Notifications', 'Record Settings'].map(t => <button key={t} className={(tab === 'Overview' ? 'Clinic Profile' : tab) === t ? 'active' : ''} onClick={() => setTab(t)}>
        {t}
      </button>)}
    </div><Card title={tab === 'Overview' ? 'Clinic Profile' : tab} subtitle="Your workspace, your preferences">
      <div className="settings-content">
        {['Overview', 'Clinic Profile'].includes(tab) && <Form 
          fields={[{
          name: 'clinic',
          label: 'Clinic name',
          required: true
        }, {
          name: 'email',
          label: 'Clinic email',
          type: 'email',
          required: true
        }, {
          name: 'phone',
          label: 'Phone number'
        }, {
          name: 'address',
          label: 'Clinic address'
        }]} 
          values={data.settings} 
          onCancel={() => notify('No changes saved')} 
          onSave={v => commit('settings', {
          ...data.settings,
          ...v
        }, 'Clinic settings updated', v.clinic)} 
        />}
        {tab === 'Account' && <Form 
          fields={[{
          name: 'name',
          label: 'Full name',
          required: true
        }, {
          name: 'email',
          label: 'Email address',
          type: 'email',
          required: true
        }, {
          name: 'password',
          label: 'New mock password',
          type: 'password',
          placeholder: 'Leave empty to keep your password'
        }]} 
          values={{
          name: user.name,
          email: user.email
        }} 
          onCancel={() => notify('No changes saved')} 
          onSave={v => {
          if (data.users.some(u => u.id !== user.id && u.email.toLowerCase() === v.email.toLowerCase())) return notify('This email address is already in use');
          const u = {
            ...user,
            ...v,
            password: v.password || user.password
          };
          setUser(u);
          commit('users', data.users.map(x => x.id === u.id ? u : x), 'Account updated', u.name);
        }} 
        />}
        {tab === 'Appearance' && <div className="appearance-options">
          {['Light', 'Dark'].map(t => <button key={t} className={(dark ? 'Dark' : 'Light') === t ? 'selected' : ''} onClick={() => {
            setDark(t === 'Dark');
            notify(t + ' appearance enabled');
          }}>
            <div className={`theme-preview ${t.toLowerCase()}`}>
              <div />
              <div>
                <span />
                <span />
                <span />
              </div>
            </div>
            <strong>{t} appearance</strong>
            {(dark ? 'Dark' : 'Light') === t && <CheckCircle2 size={18} />}
          </button>)}
        </div>}
        {tab === 'Notifications' && <div>
          {[['reminders', 'Appointment reminders', 'Keep your team informed of upcoming visits.'], ['activityAlerts', 'Workspace activity', 'Receive alerts for changes to clinic records.']].map(([k, title, desc]) => <div className="setting-row" key={k}>
            <div>
              <strong>
                {title}
              </strong>
              <p>
                {desc}
              </p>
            </div>
            <button 
              role="switch" 
              aria-checked={data.settings[k]} 
              aria-label={title} 
              className={`switch ${data.settings[k] ? 'on' : ''}`} 
              onClick={() => {
              setData(d => ({
                ...d,
                settings: {
                  ...d.settings,
                  [k]: !d.settings[k]
                }
              }));
              notify('Notification preference saved');
            }}
            >
              <span />
            </button>
          </div>)}
        </div>}
        {tab === 'Record Settings' && <><div className="info-banner">
            <ShieldCheck size={20} />
            <p>Patient records are never permanently deleted. Archiving preserves the complete patient history. Retention is a mock policy setting.</p>
          </div><Form 
            fields={[{
            name: 'retention',
            label: 'Retention policy',
            options: ['7 years', '10 years', 'Indefinite']
          }]} 
            values={data.settings} 
            onCancel={() => notify('No changes saved')} 
            onSave={v => commit('settings', {
            ...data.settings,
            ...v
          }, 'Record settings updated', v.retention)} 
          /><p className="muted">Patient IDs are generated automatically using P-{new Date().getFullYear()}-0001.</p></>}
      </div>
    </Card></>;
}
