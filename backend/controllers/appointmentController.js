import Appointment from '../models/Appointment.js';
import { statuses } from '../models/shared.js';
import { pick,text,date,choice,appointmentSlots,pagination } from '../middleware/validation.js';
import { activePatient,attending,audit,existing,uuid } from './shared.js';
export const listAppointments=async(req,res)=>{const filter={};if(req.query.patientId)filter.patientId=text(req.query.patientId,'Patient ID',{max:100});if(req.query.date)filter.date=date(req.query.date);if(req.query.status)filter.status=choice(req.query.status,statuses,'Status');const {skip,limit}=pagination(req.query);res.json({items:await Appointment.find(filter).sort({date:1,time:1}).skip(skip).limit(limit),total:await Appointment.countDocuments(filter)});};
export const getAppointment=async(req,res)=>res.json(await existing(Appointment,req.params.id));
async function values(body,previous) {
  const b=pick(body,['patientId','date','time','duration','type','staffId','staff','status','notes']);
  const v={...previous,...b};
  v.patientId=text(v.patientId,'Patient',{required:true,max:100});
  const scheduling=!previous||['patientId','date','time','duration','staffId','staff'].some(k=>b[k]!==undefined&&b[k]!==previous[k]);
  if(scheduling)await activePatient(v.patientId);
  v.date=date(v.date);v.time=text(v.time,'Time',{required:true,max:5});v.duration=Number(v.duration??30);v.slots=appointmentSlots(v.time,v.duration);
  if(scheduling){ const selection=b.staff!==undefined&&b.staff!==previous?.staff&&b.staffId===undefined?{staff:b.staff}:v;Object.assign(v,await attending(selection)); }
  v.type=text(v.type,'Appointment type',{required:true,max:120});v.notes=text(v.notes,'Notes');v.status=choice(v.status||'Pending',statuses,'Status');v.reserved=!['Cancelled','No Show'].includes(v.status);
  return pick(v,['patientId','date','time','duration','type','staffId','staff','status','notes','slots','reserved']);
}
export const createAppointment=async(req,res)=>{const v=await values(req.body),id=uuid('APT');const appointment=await Appointment.create({...v,_id:id,id,createdBy:req.user.id,updatedBy:req.user.id});await audit(req.user,'Appointment scheduled','Patient',appointment.patientId);res.status(201).json(appointment);};
export const updateAppointment=async(req,res)=>{const appointment=await existing(Appointment,req.params.id);Object.assign(appointment,await values(req.body,appointment.toObject()),{updatedBy:req.user.id});await appointment.save();await audit(req.user,'Appointment changed','Patient',appointment.patientId);res.json(appointment);};
