import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryData } from '../controllers/directoryController.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import Session from '../models/Session.js';
import { createApp } from '../app.js';
import jwt from 'jsonwebtoken';

const admin = { id: 'admin', role: 'Administrator', name: 'Synthetic Admin', active: true };
function query(value) { return { select() { return this; }, sort() { return this; }, then(resolve,reject) { return Promise.resolve(value).then(resolve,reject); } }; }
function fixture(t) {
  const doctors = [{ id:'ortho',name:'Synthetic Orthopedist',role:'Clinic Staff',specialty:'orthopedist',active:true },
    { id:'derm',name:'Synthetic Dermatologist',role:'Clinic Staff',specialty:'dermatologist',active:true },
    { id:'same',name:'Same Specialty Doctor',role:'Clinic Staff',specialty:'orthopedist',active:true },
    { id:'inactive',name:'Inactive Doctor',role:'Clinic Staff',specialty:'cardiologist',active:false }];
  const patients = ['shared','cancelled','noshow','routed','unassigned','archived','completed-only','inactive-patient'].map(id => ({ id,name:'Synthetic '+id,status:id === 'archived'?'Archived':'Active',assignedStaffId:id === 'routed'?'ortho':'',notes:'PRIVATE PATIENT NOTE' }));
  const appointment = (id,patientId,staffId,status) => ({ id,patientId,staffId,status,specialty:doctors.find(doctor=>doctor.id===staffId).specialty,date:'2099-01-05',time:'10:00',duration:15,notes:'PRIVATE APPOINTMENT NOTE' });
  const appointments = [appointment('first','shared','ortho','Scheduled'),appointment('second','shared','ortho','Scheduled'),
    appointment('cancel-one','shared','ortho','Cancelled'),appointment('no-show-one','shared','ortho','No Show'),
    appointment('other-specialty','shared','derm','Scheduled'),appointment('cancel-only','cancelled','ortho','Cancelled'),
    appointment('no-show-only','noshow','ortho','No Show'),appointment('archive-legacy','archived','ortho','Scheduled'),
    appointment('completed-only','completed-only','ortho','Completed'),appointment('inactive-doctor','inactive-patient','inactive','Scheduled'),
    { ...appointment('legacy','unassigned','ortho','Scheduled'),specialty:undefined }];
  const consultations = [{ patientId:'shared',staffId:'ortho',specialty:'orthopedist',date:'2026-01-01',diagnosis:'PRIVATE DIAGNOSIS',treatment:'PRIVATE PRESCRIPTION' },
    { patientId:'archived',staffId:'ortho',specialty:'orthopedist',date:'2026-01-02' },
    { patientId:'shared',staffId:'ortho',specialty:undefined,date:'2026-01-01' }];
  for (const [Model, rows] of [[User,doctors],[Patient,patients],[Appointment,appointments],[Consultation,consultations]]) {
    t.mock.method(Model,'find',()=>query(rows));
    for (const method of ['create','updateMany','deleteMany']) t.mock.method(Model,method,()=>{ throw new Error('Directory must never write'); });
  }
  return { doctors,patients,appointments,consultations };
}
const doctor = (data,id) => data.groups.flatMap(group=>group.doctors).find(item=>item.id===id);

test('directory groups shared patients without duplication and distinguishes active, historical and appointment-only evidence', async t => {
  const values = fixture(t);
  const result = await directoryData(admin);
  const ortho = doctor(result,'ortho'), derm = doctor(result,'derm');
  assert.equal(ortho.activeCount,1);
  assert.equal(derm.activeCount,1);
  assert.equal(result.totals.activePatients,1,'one unique clinic patient, despite two active doctors');
  assert.equal(result.totals.activeRelationships,2);
  assert.equal(result.totals.patients,values.patients.length);
  assert.equal(ortho.patients.filter(item=>item.id==='shared').length,1);
  assert.equal(derm.patients[0].id,'shared');
  assert.equal(ortho.historicalCount,2);
  const shared = ortho.patients.find(item=>item.id==='shared');
  assert.equal(shared.active,true); assert.equal(shared.historical,true);
  assert.deepEqual(shared.appointmentCounts,{ Scheduled:2,Completed:0,Cancelled:1,'No Show':1 });
  for (const id of ['cancelled','noshow','completed-only','routed','archived']) assert.equal(ortho.patients.find(item=>item.id===id).active,false,id);
  for (const id of ['cancelled','noshow','completed-only']) assert.equal(ortho.patients.find(item=>item.id===id).historical,false,id);
  assert.equal(ortho.patients.find(item=>item.id==='routed').routingOnly,true);
  assert.equal(ortho.patients.find(item=>item.id==='archived').historical,true);
  assert.equal(doctor(result,'inactive').activeCount,0);
  assert.equal(doctor(result,'same').patients.length,0,'matching specialty alone grants no relationship');
  assert(result.unassigned.some(item=>item.id==='routed' && item.routingNeedsReview));
  assert(result.unassigned.some(item=>item.id==='unassigned'));
  assert(!result.unassigned.some(item=>item.id==='shared' || item.id==='archived'));
  assert.equal(result.review.uncertainAppointments,1);
  assert.equal(result.review.uncertainConsultations,1);
  assert(!JSON.stringify(result).includes('PRIVATE'));
});

test('directory recomputes relationships after cancellation, rescheduling, completion and recorded consultation', async t => {
  const { appointments,consultations } = fixture(t);
  appointments.find(item=>item.id==='first').status='Cancelled';
  assert.equal(doctor(await directoryData(admin),'ortho').activeCount,1,'another Scheduled booking keeps the patient active');
  appointments.find(item=>item.id==='second').status='No Show';
  assert.equal(doctor(await directoryData(admin),'ortho').activeCount,0);
  const rescheduled = appointments.find(item=>item.id==='first');
  Object.assign(rescheduled,{status:'Scheduled',staffId:'same',specialty:'orthopedist'});
  assert.equal(doctor(await directoryData(admin),'same').activeCount,1);
  rescheduled.status='Completed';
  let result = await directoryData(admin);
  assert.equal(doctor(result,'same').activeCount,0);
  assert.equal(doctor(result,'same').historicalCount,0,'completed appointment alone is not a consultation');
  consultations.push({patientId:'shared',staffId:'same',specialty:'orthopedist',date:'2026-10-15'});
  result=await directoryData(admin);
  assert.equal(doctor(result,'same').historicalCount,1);
});

test('directory API is administrator-only, denies staff direct requests and exposes metadata only', async t => {
  const { doctors }=fixture(t);
  const users=[admin,...doctors,{id:'nurse',role:'Clinic Staff',specialty:'general-nurse',active:true}].map(user=>new User({...user,_id:user.id}));
  t.mock.method(User,'findById',id=>query(users.find(user=>user.id===id)));
  t.mock.method(Session,'findById',async id=>({userId:id,version:0,csrf:'synthetic',expiresAt:new Date(Date.now()+60000)}));
  const key='synthetic-directory-test-secret-32-characters';
  const server=createApp({jwtSecret:key,clients:['http://localhost:5173'],production:false}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/doctor-patient-directory`;
  assert.equal((await fetch(url)).status,401);
  for(const id of ['ortho','derm','same','nurse','admin']) {
    const token=jwt.sign({jti:id},key,{subject:id,issuer:'careline',audience:'careline-web',expiresIn:'1m'});
    const response=await fetch(url,{headers:{Cookie:`careline_session=${token}`}});
    assert.equal(response.status,id==='admin'?200:403,id);
    if(id==='admin') assert(!JSON.stringify(await response.json()).includes('PRIVATE'));
  }
  await assert.rejects(directoryData({id:'nurse',role:'Clinic Staff',specialty:'general-nurse'}),error=>error.status===403);
});
