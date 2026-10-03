import React from "react";
import { Menu, ChevronRight, Search, Sun, Moon, Bell, ChevronDown } from "lucide-react";
import Avatar from "../common/Avatar.jsx";
export default function Navbar({
  setSidebar,
  sidebar,
  setCollapsed,
  collapsed,
  pageName,
  globalSearch,
  setGlobalSearch,
  setPanel,
  setDark,
  dark,
  unread,
  panel,
  user
}) {
  return <header className="topbar">
    <div className="topbar-left">
      <button className="icon-button sidebar-toggle" aria-label="Toggle sidebar" onClick={() => window.innerWidth < 1000 ? setSidebar(!sidebar) : setCollapsed(!collapsed)}>
        <Menu size={20} />
      </button>
      <span className="breadcrumb">Workspace<ChevronRight size={13} /><strong>
          {pageName}
        </strong></span>
    </div>
    <div className="topbar-actions">
      <div className="global-search">
        <Search size={17} />
        <input 
          placeholder="Search anything..." 
          aria-label="Global search" 
          value={globalSearch} 
          onChange={e => {
          setGlobalSearch(e.target.value);
          setPanel('search');
        }} 
        />
        <kbd>⌘ K</kbd>
      </div>
      <button className="icon-button theme-toggle" aria-label="Toggle dark mode" onClick={() => setDark(!dark)}>
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <button className="icon-button notification-button" aria-label={`Notifications, ${unread} unread`} onClick={() => setPanel(panel === 'notifications' ? '' : 'notifications')}>
        <Bell size={20} />
        {unread > 0 && <span className="notification-dot" />}
      </button>
      <span className="topbar-divider" />
      <button className="topbar-avatar unstyled" aria-label="User menu" onClick={() => setPanel(panel === 'user' ? '' : 'user')}>
        <Avatar name={user.name} />
        <ChevronDown size={13} />
      </button>
    </div>
  </header>;
}
