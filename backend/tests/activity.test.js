import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyActivity, monthsBefore, clinicCalendar, patientActivityData } from '../controllers/activityController.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import Session from '../models/Session.js';
import { createApp } from '../app.js';
import jwt from 'jsonwebtoken';

const now=new Date('2026-10-15T04:00:00Z'); // noon Manila
const doctors=[{id:'a',role:'Clinic Staff',specialty:'orthopedist',active:true},{id:'b',role:'Clinic Staff',specialty:'dermatologist',active:true}];
const record=date=>({patientId:'patient',staffId:'a',specialty:'orthopedist',date});
const booking=(date,status='Scheduled',time='13:00')=>({...record(date),status,time,duration:30});
const classify=values=>classifyActivity({doctors,now,...values});

test('calendar-month thresholds include exact three/six-month boundaries and Manila date rollover',()=>{
  assert.equal(monthsBefore('2026-05-31',3),'2026-02-28');
  assert.equal(monthsBefore('2024-05-31',3),'2024-02-29');
  assert.equal(monthsBefore('2026-01-31',6),'2025-07-31');
  assert.equal(clinicCalendar(new Date('2026-10-14T16:01:00Z')).today,'2026-10-15');
  for(const [date,status]of[['2026-07-16','Active'],['2026-07-15','At Risk'],['2026-04-16','At Risk'],['2026-04-15','Inactive'],['2025-01-01','Inactive']])assert.equal(classify({consultations:[record(date)]}).status,status,date);
});

test('only current/future matched Scheduled appointments override inactivity; attendance is never inferred',()=>{
  const consultations=[record('2025-01-01')];
  assert.equal(classify({consultations,appointments:[booking('2026-10-16')]}).status,'Active');
  assert.equal(classify({consultations,appointments:[booking('2026-10-15','Scheduled','11:45')]}).status,'Active','appointment in progress');
  assert.equal(classify({consultations,appointments:[booking('2026-10-15','Scheduled','09:00')]}).status,'Inactive','past unresolved appointment is not clinical activity');
  assert.equal(classify({consultations,appointments:[booking('2026-10-14')]}).status,'Inactive');
  for(const status of ['Cancelled','No Show'])assert.equal(classify({consultations,appointments:[booking('2026-10-16',status)]}).status,'Inactive');
  assert.equal(classify({appointments:[booking('2026-10-01','Completed')]}).status,'Unknown');
  assert.equal(classify({consultations,appointments:[booking('2026-10-01','Completed')]}).status,'Unknown','newer completion has no attendance proof');
  assert.equal(classify({consultations:[record('2026-10-01')],appointments:[booking('2026-10-01','Completed')]}).status,'Active');
  assert.equal(classify({appointments:[{...booking('2026-10-16'),specialty:'dermatologist'}]}).status,'Unknown');
});

test('unknown evidence fails conservatively; Archived remains a separate lifecycle without appointment override',()=>{
  assert.equal(classify({}).status,'Unknown');
  assert.equal(classify({consultations:[record('not-a-date')]}).status,'Unknown');
  assert.equal(classify({consultations:[record('2099-01-01')]}).status,'Unknown');
  assert.equal(classify({consultations:[record('2025-01-01'),record('unknown')]}).status,'Unknown');
  const archived=classify({patientStatus:'Archived',consultations:[record('2025-01-01')],appointments:[booking('2099-01-01')]});
  assert.equal(archived.status,'Inactive');assert.equal(archived.currentAppointment,false);
});

function matches(row,filter={}){return Object.entries(filter).every(([key,value])=>{
  if(key==='$and')return value.every(item=>matches(row,item));
  if(key==='$or')return value.some(item=>matches(row,item));
  if(value&&typeof value==='object')return Object.entries(value).every(([op,arg])=>op==='$in'?arg.includes(row[key]):op==='$exists'?(row[key]!==undefined)===arg:false);
  return row[key]===value;
});}
function query(value){return{select(){return this;},then(resolve,reject){return Promise.resolve(value).then(resolve,reject);}};}

test('activity APIs separate clinic and doctor evidence, exclude archived counts, and reject unauthorized roles/parameters',async t=>{
  const today=clinicCalendar().today,old=monthsBefore(today,7);
  const users=[...doctors,{id:'c',role:'Clinic Staff',specialty:'orthopedist',active:true},{id:'admin',role:'Administrator',active:true},{id:'nurse',role:'Clinic Staff',specialty:'general-nurse',active:true}].map(user=>new User({...user,_id:user.id,name:user.id}));
  const patients=[{_id:'shared',id:'shared',name:'Synthetic shared',status:'Active',assignedStaffId:'a'},
    {_id:'other',id:'other',name:'Other doctor patient',status:'Active',assignedStaffId:'c'},
    {_id:'unknown',id:'unknown',name:'Needs review',status:'Active',assignedStaffId:'a'},
    {_id:'archived',id:'archived',name:'Archived synthetic',status:'Archived',assignedStaffId:'a'}];
  const consultations=[{...record(old),patientId:'shared',_id:'old',diagnosis:'PRIVATE'},
    {_id:'recent',patientId:'shared',staffId:'b',specialty:'dermatologist',date:today,diagnosis:'PRIVATE OTHER SPECIALTY'},
    {...record(old),_id:'archive',patientId:'archived'}];
  const appointments=[{...booking('2099-01-01'),_id:'future',patientId:'shared',staffId:'b',specialty:'dermatologist'},
    {...booking('2099-01-01'),_id:'private',patientId:'other',staffId:'c'}];
  for(const [Model,rows]of[[Patient,patients],[Consultation,consultations],[Appointment,appointments],[User,users]]){
    t.mock.method(Model,'find',filter=>query(rows.filter(row=>matches(row,filter))));
    t.mock.method(Model,'distinct',async(field,filter)=>[...new Set(rows.filter(row=>matches(row,filter)).map(row=>row[field]))]);
    for(const method of ['create','updateMany','deleteMany'])t.mock.method(Model,method,()=>{throw new Error('Activity reads must not write');});
  }
  const a=await patientActivityData(users[0]);
  assert.deepEqual(a.patients.map(patient=>patient.id),['shared','unknown','archived']);
  assert.equal(a.patients[0].activity.status,'Inactive');
  assert.equal(a.counts.Inactive,1,'archived profile excluded');
  assert.equal(a.counts.Unknown,1);
  const b=await patientActivityData(users[1]);assert.equal(b.patients[0].activity.status,'Active');
  const admin=await patientActivityData(users.find(user=>user.id==='admin'));
  assert.equal(admin.patients.find(patient=>patient.id==='shared').activity.status,'Active');
  assert(!JSON.stringify(admin).includes('PRIVATE'));
  await assert.rejects(patientActivityData(users.find(user=>user.id==='nurse')),error=>error.status===403);
  t.mock.method(User,'findById',id=>query(users.find(user=>user.id===id)));
  t.mock.method(Session,'findById',async id=>({userId:id,version:0,csrf:'synthetic',expiresAt:new Date(Date.now()+60000)}));
  const key='synthetic-activity-test-secret-32-characters';
  const server=createApp({jwtSecret:key,clients:['http://localhost:5173'],production:false}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/patient-activity?doctorId=b&patientId=other`;
  assert.equal((await fetch(url)).status,401);
  for(const id of ['a','nurse']){
    const token=jwt.sign({jti:id},key,{subject:id,issuer:'careline',audience:'careline-web',expiresIn:'1m'});
    const response=await fetch(url,{headers:{Cookie:`careline_session=${token}`}});assert.equal(response.status,id==='a'?200:403);
    if(id==='a')assert(!(await response.text()).includes('Other doctor patient'));
  }
});
