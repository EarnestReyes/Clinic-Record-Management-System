import { displayIdentity } from '../../shared/displayIdentity.js';
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
import Setting from '../models/Setting.js';
import { wordDocument, wordMime } from '../../shared/wordDocument.js';
import { exportTable, displayDate, sortReportRecords } from '../../shared/exportTables.js';
import { reportAnalytics } from '../../shared/reportAnalytics.js';
import { explorerQuery, summaryPipeline, recordsPipeline } from '../utils/reportExplorer.js';
import { permissionsFor } from '../middleware/permissions.js';
import { ApiError } from '../middleware/errors.js';
const reports={patients:{model:Patient,date:'created',columns:['id','name','dob','gender','phone','email','status','created']},consultations:{model:Consultation,date:'date',columns:['id','patientId','date','type','complaint','diagnosis','treatment','staff']},appointments:{model:Appointment,date:'date',columns:['id','patientId','date','time','type','staff','status']},activity:{model:AuditLog,date:'date',columns:['id','action','recordType','recordId','actor','date']}};
export async function report(req,res){
  const type=choice(req.params.type,Object.keys(reports),'Report type'),definition=reports[type];
  if (req.query.format) choice(req.query.format, ['csv', 'docx'], 'Export format');
  if (req.query.mode) {
    choice(req.query.mode, ['summary', 'records'], 'Report mode');
    if (!permissionsFor(req.user).viewReports) throw new ApiError(403, 'Your role does not have permission to access reports.');
    const scope = type === 'appointments' ? appointmentScope(req.user) : type === 'patients' ? await patientScope(req.user) : type === 'consultations' ? await consultationScope(req.user) : await auditScope(req.user);
    const config = explorerQuery(type, req.query, scope);
    if (req.query.mode === 'summary') {
      if (req.query.format) throw new ApiError(400, 'Use the record export for document downloads.');
      const [groups] = await definition.model.aggregate(summaryPipeline(type, config.match)).option({ maxTimeMS: 10000 });
      return res.json({ analytics: reportAnalytics(type, [], { from: config.from, to: config.to, groups }), from: config.from, to: config.to, generatedAt: new Date().toISOString() });
    }
    const [result] = await definition.model.aggregate(recordsPipeline(type, config, !!req.query.format)).option({ maxTimeMS: 10000 });
    const items = result.items, total = result.total[0]?.value || 0;
    if (!req.query.format) return res.json({ items, total, page: config.page, limit: config.limit, from: config.from, to: config.to, generatedAt: new Date().toISOString() });
    if (total > 10000) throw new ApiError(400, 'Export is limited to 10,000 records. Narrow the report dates or filters.');
    const table = exportTable(type, items);
    if (req.query.format === 'csv') {
      await audit(req.user, 'Report exported', 'Report', type);
      return res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-report.csv"` }).send(csv(table.rows, table.columns.map(column => column.key)));
    }
    const clinic = await Setting.findById('clinic');
    const subtitle = `${config.from} to ${config.to} | Filter: ${JSON.stringify(config.filter)} | Search: ${config.search || 'None'} | Operational fields only`;
    const document = wordDocument({ title: `${type} records`, clinic: clinic || {}, subtitle, ...table });
    await audit(req.user, 'Report exported', 'Report', type);
    return res.set({ 'Content-Type': wordMime, 'Content-Disposition': `attachment; filename="${type}-report.docx"` }).send(Buffer.from(document));
  }
  const from=date(req.query.from||'1970-01-01'),to=date(req.query.to||'9999-12-31');if(from>to)return res.status(400).json({error:'The start date must be before the end date.'});
  const range=type==='activity'?{$gte:new Date(from+'T00:00:00+08:00'),$lte:new Date(to+'T23:59:59.999+08:00')}:{$gte:from,$lte:to};
  const scope=type==='appointments'?appointmentScope(req.user):type==='patients'?await patientScope(req.user):type==='consultations'?await consultationScope(req.user):await auditScope(req.user);
  const rows=await definition.model.find({...scope,[definition.date]:range}).sort({[definition.date]:-1});
  let items=type==='patients'?rows.map(row=>patientView(row,req.user)):rows;
  const sort = req.query.sort ? choice(req.query.sort, ['id', 'person', 'date', 'details'], 'Sort column') : 'date';
  const direction = req.query.direction ? choice(req.query.direction, ['asc', 'desc'], 'Sort direction') : 'desc';
  let names = new Map();
  if (req.query.format && ['consultations', 'appointments'].includes(type) && (req.query.format === 'docx' || sort === 'person')) {
    const patients = await Patient.find({ id: { $in: [...new Set(items.map(item => item.patientId))] } }).select('id name');
    names = new Map(patients.map(patient => [patient.id, patient]));
  }
  if (req.query.format && req.query.sort) items = sortReportRecords(items, sort, direction, id => names.get(id));
  if(req.query.format==='csv'){await audit(req.user,'Report exported','Report',type);res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${type}-report.csv"`}).send(csv(items.map(r=>{const value=r.toJSON?r.toJSON():r;return {...value,displayReference:displayIdentity(value)};}),['appointments','consultations'].includes(type)?['displayReference',...definition.columns]:definition.columns));}
  else if (req.query.format === 'docx') {
    const clinic = await Setting.findById('clinic');
    const table = exportTable(type, items, id => names.get(id));
    const analytics = reportAnalytics(type, items, { from, to });
    const document = wordDocument({ title: analytics.title, analytics, clinic: clinic || {}, subtitle: `${displayDate(from)} – ${displayDate(to)}`, ...table });
    await audit(req.user, 'Report exported', 'Report', type);
    res.set({ 'Content-Type': wordMime, 'Content-Disposition': `attachment; filename="${type}-report.docx"` }).send(Buffer.from(document));
  }
  else res.json({items,total:items.length,from,to,generatedAt:new Date().toISOString()});
}
export const auditLogs=async(req,res)=>{const filter=await auditScope(req.user);if(req.query.recordId)filter.$and=[{recordId:text(req.query.recordId,'Record ID',{max:100})}];const{skip,limit}=pagination(req.query);res.json({items:await AuditLog.find(filter).sort({date:-1}).skip(skip).limit(limit),total:await AuditLog.countDocuments(filter)});};
