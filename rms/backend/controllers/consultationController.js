import Consultation from '../models/Consultation.js';
import { ApiError } from '../middleware/errors.js';
import { pick,text,date,number,clinicToday,pagination } from '../middleware/validation.js';
import { activePatient,attending,audit,existing,uuid } from './shared.js';
export const listConsultations = async(req,res) => { const filter={}; if(req.query.patientId)filter.patientId=text(req.query.patientId,'Patient ID',{max:100}); const {skip,limit}=pagination(req.query);res.json({items:await Consultation.find(filter).sort({date:-1}).skip(skip).limit(limit),total:await Consultation.countDocuments(filter)}); };
export const getConsultation = async(req,res) => res.json(await existing(Consultation,req.params.id));
export const createConsultation = async(req,res) => {
  const b=pick(req.body,['patientId','date','type','complaint','symptoms','diagnosis','treatment','notes','staffId','staff','bp','pulse','temperature','weight','height','oxygen']);
  const patientId=text(b.patientId,'Patient',{required:true,max:100}); await activePatient(patientId);
  const values={patientId,date:date(b.date),...await attending(b)};if(values.date>clinicToday())throw new ApiError(400,'Consultation date cannot be in the future.');
  for(const k of ['type','complaint','symptoms','diagnosis','treatment','notes'])values[k]=text(b[k],k,{required:['type','complaint','diagnosis','treatment'].includes(k)});
  values.bp=text(b.bp,'Blood pressure',{max:20}); if(values.bp&&!/^\d{2,3}\/\d{2,3}$/.test(values.bp))throw new ApiError(400,'Use systolic/diastolic blood pressure, for example 120/80.');
  for(const [k,min,max] of [['pulse',0,300],['temperature',20,50],['weight',0,600],['height',0,300],['oxygen',0,100]])values[k]=number(b[k],k,min,max);
  const id=uuid('MR');const record=await Consultation.create({...values,_id:id,id,createdBy:req.user.id});await audit(req.user,'Consultation created','Patient',patientId);res.status(201).json(record);
};
