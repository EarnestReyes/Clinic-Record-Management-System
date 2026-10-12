import Patient from '../models/Patient.js';
import Consultation from '../models/Consultation.js';
import Appointment from '../models/Appointment.js';
import Document from '../models/Document.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { clinicSettings } from './settingsController.js';
import { clinicToday,text,escapeRegex } from '../middleware/validation.js';
export async function dashboardData(){
  const today=clinicToday();const week=new Date(today+'T12:00:00');week.setDate(week.getDate()-6);const from=week.toLocaleDateString('en-CA');
  const [totalPatients,activePatients,newPatients,archivedRecords,todaysAppointments,todaysConsultations,visits,appointments,recentActivity]=await Promise.all([
    Patient.countDocuments(),Patient.countDocuments({status:'Active'}),Patient.countDocuments({created:today}),Patient.countDocuments({status:'Archived'}),Appointment.countDocuments({date:today}),Consultation.countDocuments({date:today}),
    Consultation.aggregate([{$match:{date:{$gte:from,$lte:today}}},{$group:{_id:{date:'$date',type:'$type'},count:{$sum:1}}},{$sort:{'_id.date':1}}]),Appointment.find({date:today}).sort({time:1}),AuditLog.find().sort({date:-1}).limit(10)
  ]);
  return{totalPatients,activePatients,newPatients,archivedRecords,todaysAppointments,todaysConsultations,visits,appointments,recentActivity};
}
export const dashboard=async(req,res)=>res.json(await dashboardData());
export const workspace=async(req,res)=>{
  // Existing pages share searchable in-memory views; the server remains the source of truth.
  // Dedicated collection endpoints expose bounded pagination for future larger-clinic views.
  const [patients,consultations,appointments,documents,logs,users,notifications,settings,dashboard]=await Promise.all([
    Patient.find().sort({name:1}),Consultation.find().sort({date:-1}),Appointment.find().sort({date:1,time:1}),Document.find().sort({date:-1}),AuditLog.find().sort({date:-1}).limit(500),
    req.user.role==='Administrator'?User.find().sort({name:1}):User.find({active:true}).select('id name role active'),Notification.find({userId:req.user.id}).sort({createdAt:-1}).limit(100),clinicSettings(req.user),dashboardData()
  ]);
  res.json({patients,consultations,appointments,documents,logs,users,notifications,settings,dashboard});
};
export const search=async(req,res)=>{const q=text(req.query.q,'Search',{required:true,max:100}),regex=new RegExp(escapeRegex(q),'i');const patients=await Patient.find({$or:[{id:regex},{name:regex},{phone:regex}]}).limit(10);const ids=patients.map(p=>p.id);const[consultations,appointments]=await Promise.all([Consultation.find({$or:[{id:regex},{diagnosis:regex},{patientId:{$in:ids}}]}).limit(10),Appointment.find({$or:[{id:regex},{type:regex},{patientId:{$in:ids}}]}).limit(10)]);res.json({patients,consultations,appointments});};
