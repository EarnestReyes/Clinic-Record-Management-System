import multer from 'multer';
import { ApiError } from './errors.js';
const allowed=new Set(['.txt','.csv','.json','.pdf','.png','.jpg','.jpeg']);
export function validateFile(file){
  const name=file.originalname.replaceAll('\\','/').split('/').pop().replace(/[\x00-\x1f\x7f]/g,'').slice(0,160);
  const extension=name.slice(name.lastIndexOf('.')).toLowerCase();const buffer=file.buffer;
  if(!allowed.has(extension)||!buffer?.length||buffer.length>5*1024*1024)throw new ApiError(400,'Use a text, CSV, JSON, PDF, PNG, or JPEG file under 5 MB.');
  let mime;
  if(extension==='.pdf'){if(!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw new ApiError(400,'Invalid PDF file.');mime='application/pdf';}
  else if(extension==='.png'){if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new ApiError(400,'Invalid PNG file.');mime='image/png';}
  else if(['.jpg','.jpeg'].includes(extension)){if(!buffer.subarray(0,3).equals(Buffer.from([255,216,255])))throw new ApiError(400,'Invalid JPEG file.');mime='image/jpeg';}
  else {if(buffer.includes(0)||!Buffer.from(buffer.toString('utf8')).equals(buffer))throw new ApiError(400,'Text documents must contain valid UTF-8 text.');if(extension==='.json'){try{JSON.parse(buffer.toString('utf8'));}catch{throw new ApiError(400,'Invalid JSON document.');}}mime='text/plain; charset=utf-8';}
  return{name,mime};
}
export const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:5},fileFilter(req,file,cb){const extension=file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();cb(allowed.has(extension)?null:new ApiError(400,'Unsupported file type.'),allowed.has(extension));}}).single('file');
