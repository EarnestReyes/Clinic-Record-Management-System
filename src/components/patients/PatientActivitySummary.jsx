import React, { useEffect, useState } from 'react';
import Card from '../common/Card.jsx';
import useTableSort, { sortDate } from '../../utils/useTableSort.jsx';
import { request } from '../../services/api.js';
const classifications=['Active','At Risk','Inactive','Unknown'];
export default function PatientActivitySummary({ user, permissions, revision, go }) {
  const table = useTableSort('name');
  const [state,setState]=useState({loading:true});
  const [reload,setReload]=useState(0);
  const [filter,setFilter]=useState('');
  const [archived,setArchived]=useState(false);
  const allowed=user?.role==='Administrator'||(user?.role==='Clinic Staff'&&permissions?.createConsultation===true);
  useEffect(()=>{
    if(!allowed)return;
    const controller=new AbortController(); let active=true;
    setState({loading:true});
    request('/patient-activity',{signal:controller.signal}).then(data=>{
      if(!active)return;
      if(!data || !Array.isArray(data.patients)||classifications.some(status=>!Number.isFinite(data.counts?.[status])||data.counts[status]<0)
        || data.patients.some(patient=>!patient || typeof patient.id!=='string' || !['Active','Archived'].includes(patient.status) || !classifications.includes(patient.activity?.status)))throw new Error('Patient activity data is incomplete.');
      setState({data});
    }).catch(error=>{if(active&&error.name!=='AbortError')setState({error:error.message});});
    return()=>{active=false;controller.abort();};
  },[allowed,user?.id,revision,reload]);
  if(!allowed)return null;
  const rows=table.sort(state.data?.patients.filter(patient=>(archived||patient.status==='Active')&&(!filter||patient.activity.status===filter))||[], (p, key) => key === 'lastActivity' ? sortDate(p.activity.lastActivity) : key === 'activity' ? p.activity.status : key === 'evidence' ? (p.activity.currentAppointment ? 'Current/future appointment' : p.activity.needsReview ? 'Needs review' : 'Consultation history') : p[key]);
  return <Card title={user.role==='Administrator'?'Clinic patient activity':'Your patients’ activity'} subtitle="Current activity · Asia/Manila · independent of dashboard date filters and archive lifecycle" action={<button className="text-button" onClick={()=>setReload(value=>value+1)} disabled={state.loading}>Refresh patient activity</button>}>
    {state.loading?<p className="dashboard-empty" role="status">Calculating authorized patient activity…</p>:state.error?<div className="dashboard-empty" role="alert"><p>{state.error}</p><button className="btn secondary" onClick={()=>setReload(value=>value+1)}>Retry activity</button></div>:<>
      <div className="dashboard-facts" style={{padding:'0 22px'}}>{classifications.map(status=><span key={status}>{status==='Unknown'?'Unknown / Needs Review':status}: <strong>{state.data.counts[status]}</strong></span>)}</div>
      <div className="activity-filters"><label>Activity classification<select aria-label="Patient activity classification" value={filter} onChange={event=>setFilter(event.target.value)}><option value="">All activity</option>{classifications.map(status=><option key={status} value={status}>{status==='Unknown'?'Unknown / Needs Review':status}</option>)}</select></label>
        <label className="activity-archive-toggle"><input type="checkbox" checked={archived} onChange={event=>setArchived(event.target.checked)} /><span>Include archived profiles in the table</span></label></div>
      <p className="dashboard-empty">Counts exclude archived profiles. Inactive patients can still be scheduled through the existing authorized workflow. Routing alone and appointment completion without reliable attendance are not clinical evidence.</p>
      {rows.length?<><div className="table-scroll"><table><thead><tr>{table.header('name', 'Patient')}{table.header('status', 'Profile lifecycle')}{table.header('activity', 'Activity')}{table.header('lastActivity', 'Last qualifying consultation')}{table.header('evidence', 'Evidence')}</tr></thead><tbody>{rows.slice(0,50).map(patient=><tr key={patient.id}><td><button className="text-button" onClick={()=>go(`patients/${patient.id}`)}>{patient.name} · {patient.id}</button></td><td>{patient.status}</td><td>{patient.activity.status==='Unknown'?'Unknown / Needs Review':patient.activity.status}</td><td>{patient.activity.lastActivity||'Unknown'}</td><td>{patient.activity.currentAppointment?'Current/future appointment':patient.activity.needsReview?'Needs review':'Consultation history'}</td></tr>)}</tbody></table></div><p className="dashboard-empty">Showing {Math.min(rows.length,50)} of {rows.length} matching profiles.</p></>:<p className="dashboard-empty">No matching patient activity.</p>}
    </>}
  </Card>;
}
