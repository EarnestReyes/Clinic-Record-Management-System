import React from "react";
import Brand from "./Brand.jsx";
import { Stethoscope, ChevronDown, Heart, ArrowRight, MoreHorizontal } from "lucide-react";
import { navigation } from "../../data/navigation.js";
import Avatar from "../common/Avatar.jsx";
export default function Sidebar({
  sidebar,
  setSidebar,
  data,
  user,
  pageName,
  selected,
  go,
  todays,
  setModal,
  setPanel,
  panel
}) {
  return <><div className={`sidebar-overlay ${sidebar ? 'visible' : ''}`} onClick={() => setSidebar(false)} /><aside className={`sidebar ${sidebar ? 'open' : ''}`}>
      <Brand />
      <div className="workspace-label">
        <span className="clinic-mark">
          <Stethoscope size={17} />
        </span>
        <div>
          <strong>
            {data.settings.clinic}
          </strong>
          <small>Clinic workspace</small>
        </div>
        <ChevronDown size={14} />
      </div>
      <nav>
        {navigation.map(g => <div className="nav-group" key={g.label}>
          <span className="nav-label">
            {g.label}
          </span>
          {g.items.filter(([n]) => n !== 'User Management' || user.role === 'Administrator').map(([n, Icon]) => <button 
            key={n} 
            title={n} 
            className={`nav-link ${pageName === n || (selected && n === 'Patients') ? 'active' : ''}`} 
            onClick={() => go(n.toLowerCase().replaceAll(' ', '-'))}
          >
            <Icon size={19} />
            <span>
              {n}
            </span>
            {n === 'Appointments' && <span className="nav-count">
              {todays.filter(a => a.status === 'Pending').length}
            </span>}
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="support-card">
          <span className="support-icon">
            <Heart size={18} />
          </span>
          <strong>A little help, anytime.</strong>
          <p>Make the most of your workspace.</p>
          <button onClick={() => setModal({
            type: 'help'
          })}>Help & resources<ArrowRight size={14} /></button>
        </div>
        <button className="sidebar-user" onClick={() => setPanel(panel === 'user' ? '' : 'user')}>
          <Avatar name={user.name} />
          <div>
            <strong>
              {user.name}
            </strong>
            <small>
              {user.role}
            </small>
          </div>
          <MoreHorizontal size={18} />
        </button>
      </div>
    </aside></>;
}
