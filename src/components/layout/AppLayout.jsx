import React from "react";
import Sidebar from "./Sidebar.jsx";
import Navbar from "./Navbar.jsx";
import WorkspacePanels from "./WorkspacePanels.jsx";
import PageHeader from "./PageHeader.jsx";
import AppFooter from "./AppFooter.jsx";
import ModalHost from "../modals/ModalHost.jsx";
import Toast from "../common/Toast.jsx";
export default function AppLayout({
  collapsed,
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
  panel,
  setCollapsed,
  globalSearch,
  setGlobalSearch,
  setDark,
  dark,
  unread,
  setTab,
  setData,
  log,
  setUser,
  notify,
  personCell,
  patient,
  addPatient,
  filteredPatients,
  addAppointment,
  addConsultation,
  children,
  modal,
  commit,
  active,
  updateAppointment,
  toast,
  setToast
}) {
  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <Sidebar 
      sidebar={sidebar} 
      setSidebar={setSidebar} 
      data={data} 
      user={user} 
      pageName={pageName} 
      selected={selected} 
      go={go} 
      todays={todays} 
      setModal={setModal} 
      setPanel={setPanel} 
      panel={panel} 
    />
    <div className="main-shell">
      <Navbar 
        setSidebar={setSidebar} 
        sidebar={sidebar} 
        setCollapsed={setCollapsed} 
        collapsed={collapsed} 
        pageName={pageName} 
        globalSearch={globalSearch} 
        setGlobalSearch={setGlobalSearch} 
        setPanel={setPanel} 
        setDark={setDark} 
        dark={dark} 
        unread={unread} 
        panel={panel} 
        user={user} 
      />
  
      {<WorkspacePanels 
        panel={panel} 
        setPanel={setPanel} 
        user={user} 
        go={go} 
        setTab={setTab} 
        setDark={setDark} 
        dark={dark} 
        setData={setData} 
        log={log} 
        setUser={setUser} 
        unread={unread} 
        notify={notify} 
        data={data} 
        globalSearch={globalSearch} 
        personCell={personCell} 
        patient={patient} 
        setModal={setModal} 
      />}
  
      <main>
        <PageHeader 
          pageName={pageName} 
          user={user} 
          addPatient={addPatient} 
          filteredPatients={filteredPatients} 
          addAppointment={addAppointment} 
          addConsultation={addConsultation} 
          setModal={setModal} 
        />
        {children}

  

  

  

        <AppFooter />
      </main>
    </div>
  
    {<ModalHost 
      modal={modal} 
      setModal={setModal} 
      data={data} 
      commit={commit} 
      active={active} 
      user={user} 
      notify={notify} 
      patient={patient} 
      personCell={personCell} 
      addAppointment={addAppointment} 
      updateAppointment={updateAppointment} 
      setUser={setUser} 
    />}
    {<Toast toast={toast} setToast={setToast} />}
  </div>;
}
