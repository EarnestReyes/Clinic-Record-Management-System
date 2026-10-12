import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { environment } from '../config/environment.js';
import { connectDatabase } from '../config/database.js';
import { password,appointmentSlots } from '../middleware/validation.js';
import { initialData } from './fixtures.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Consultation from '../models/Consultation.js';
import Appointment from '../models/Appointment.js';
import Document from '../models/Document.js';
import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
try {
  const config=environment();if(config.production)throw new Error('Development seeding is disabled in production.');
  const hash=await bcrypt.hash(password(process.env.SEED_PASSWORD),12);await connectDatabase(config.mongoUri);
  if(await User.countDocuments()||await Patient.countDocuments())throw new Error('Seeding requires an empty clinic database; existing records will not be overwritten.');
  const seed=initialData();
  for(const u of seed.users){const {password:unused,...values}=u;await User.create({...values,_id:u.id,passwordHash:hash});}
  for(const p of seed.patients)await Patient.create({...p,_id:p.id,createdBy:'U-1',updatedBy:'U-1'});
  for(const r of seed.consultations)await Consultation.create({...r,_id:r.id,staffId:'U-1',createdBy:'U-1'});
  for(const a of seed.appointments)await Appointment.create({...a,_id:a.id,staffId:a.staff.includes('Michael')?'U-3':'U-1',slots:appointmentSlots(a.time),duration:30,reserved:!['Cancelled','No Show'].includes(a.status),createdBy:'U-1'});
  for(const d of seed.documents){const content=Buffer.from(d.content);await Document.create({...d,_id:d.id,name:d.name.replace(/\.pdf$/,'.txt'),content,mime:'text/plain; charset=utf-8',size:content.length,uploadedBy:'U-1'});}
  const {reminders,activityAlerts,...settings}=seed.settings;await Setting.create({...settings,_id:'clinic'});
  for(const u of seed.users)for(const [i,n] of seed.notifications.entries()){const id=`N-${u.id}-${i}`;await Notification.create({...n,_id:id,id,userId:u.id,route:i===1?'appointments':'dashboard'});}
  for(const [i,log] of seed.logs.entries()){const id=`SEED-LOG-${i}`;await AuditLog.create({_id:id,id,action:log.action,detail:`Patient · ${seed.patients[i].id}`,actor:log.actor,actorId:i===0?'U-2':'U-1',recordType:'Patient',recordId:seed.patients[i].id,date:log.date});}
  const years=[...new Set(seed.patients.map(p=>p.id.split('-')[1]))];for(const year of years){const max=Math.max(...seed.patients.filter(p=>p.id.split('-')[1]===year).map(p=>Number(p.id.split('-')[2])));await Counter.updateOne({_id:`patient-${year}`},{$max:{value:max}},{upsert:true});}
  console.info('Fictional clinic records seeded. Sign in as admin@careline.demo or staff@careline.demo using your SEED_PASSWORD.');
}catch(error){console.error(['Seeding requires','Development seeding','Password must'].some(prefix=>error.message.startsWith(prefix))?error.message:'Seed failed. Verify dependencies, MongoDB, backend/.env, and the required SEED_PASSWORD.');process.exitCode=1;}finally{await mongoose.disconnect();}
