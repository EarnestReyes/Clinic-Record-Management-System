import Document from '../models/Document.js';
import { ApiError } from '../middleware/errors.js';
import { text,clinicToday,choice } from '../middleware/validation.js';
import { activePatient,existing,audit,uuid } from './shared.js';
import { validateFile } from '../middleware/uploads.js';
export const listDocuments=async(req,res)=>{const filter={};if(req.query.patientId)filter.patientId=text(req.query.patientId,'Patient ID',{max:100});res.json(await Document.find(filter).sort({date:-1}));};
export const createDocument=async(req,res)=>{
  const patientId=text(req.body.patientId,'Patient',{required:true,max:100});await activePatient(patientId);
  let file=req.file;
  if(!file){const content=text(req.body.content,'Document content',{required:true,max:1000000});file={originalname:text(req.body.name,'Document name',{required:true,max:160}),buffer:Buffer.from(content),mimetype:'text/plain'};if(!/\.(txt|csv|json)$/i.test(file.originalname))file.originalname+='\.txt';}
  const {name,mime}=validateFile(file);const id=uuid('DOC');const document=await Document.create({_id:id,id,patientId,name,mime,size:file.buffer.length,type:text(req.body.type,'Category',{max:120})||'Uploaded document',date:clinicToday(),status:'Active',content:file.buffer,uploadedBy:req.user.id});await audit(req.user,'Document uploaded','Patient',patientId);res.status(201).json(document);
};
export const documentStatus=status=>async(req,res)=>{const document=await existing(Document,req.params.id);document.status=choice(status,['Active','Archived'],'Status');await document.save();await audit(req.user,status==='Active'?'Document restored':'Document archived','Patient',document.patientId);res.json(document);};
export const getDocument=async(req,res)=>res.json(await existing(Document,req.params.id));
export const documentContent=download=>async(req,res)=>{const document=await Document.findById(text(req.params.id,'Document ID',{required:true,max:100})).select('+content');if(!document)throw new ApiError(404,'Document not found.');await audit(req.user,download?'Document downloaded':'Document viewed','Patient',document.patientId);res.set({'Content-Type':document.mime,'Content-Length':String(document.size),'Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(document.name)}`});res.send(document.content);};
