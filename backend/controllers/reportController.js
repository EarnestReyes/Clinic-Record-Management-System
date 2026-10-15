import Patient from '../models/Patient.js';
import Consultation from '../models/Consultation.js';
import Appointment from '../models/Appointment.js';
import AuditLog from '../models/AuditLog.js';
import { date,choice,text,pagination } from '../middleware/validation.js';
import { csv } from '../utils/csv.js';
import { audit } from './shared.js';
import { appointmentScope } from './appointmentController.js';
import { patientScope, consultationScope, auditScope } from '../middleware/accessScopes.js';
import { patientView } from './patientController.js';
const reports={patients:{model:Patient,date:'created',columns:['id','name','dob','gender','phone','email','status','created']},consultations:{model:Consultation,date:'date',columns:['id','patientId','date','type','complaint','diagnosis','treatment','staff']},appointments:{model:Appointment,date:'date',columns:['id','patientId','date','time','type','staff','status']},activity:{model:AuditLog,date:'date',columns:['id','action','recordType','recordId','actor','date']}};
export async function report(req,res){
  const type=choice(req.params.type,Object.keys(reports),'Report type'),definition=reports[type];
  const from=date(req.query.from||'1970-01-01'),to=date(req.query.to||'9999-12-31');if(from>to)return res.status(400).json({error:'The start date must be before the end date.'});
  const range=type==='activity'?{$gte:new Date(from+'T00:00:00+08:00'),$lte:new Date(to+'T23:59:59.999+08:00')}:{$gte:from,$lte:to};
  const scope=type==='appointments'?appointmentScope(req.user):type==='patients'?await patientScope(req.user):type==='consultations'?await consultationScope(req.user):await auditScope(req.user);
  const rows=await definition.model.find({...scope,[definition.date]:range}).sort({[definition.date]:-1});
  const items=type==='patients'?rows.map(row=>patientView(row,req.user)):rows;
  if(req.query.format==='csv'){await audit(req.user,'Report exported','Report',type);res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${type}-report.csv"`}).send(csv(items.map(r=>r.toJSON?r.toJSON():r),definition.columns));}
  else res.json({items,total:items.length,from,to});
}
export const auditLogs=async(req,res)=>{const filter=await auditScope(req.user);if(req.query.recordId)filter.$and=[{recordId:text(req.query.recordId,'Record ID',{max:100})}];const{skip,limit}=pagination(req.query);res.json({items:await AuditLog.find(filter).sort({date:-1}).skip(skip).limit(limit),total:await AuditLog.countDocuments(filter)});};
