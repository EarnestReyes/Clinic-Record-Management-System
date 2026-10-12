import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Notification from '../models/Notification.js';
import { ApiError } from '../middleware/errors.js';
import { roles } from '../models/shared.js';
import { pick,text,email,password,choice,boolean } from '../middleware/validation.js';
import { audit,existing,uuid } from './shared.js';
export const listUsers=async(req,res)=>res.json(await User.find().sort({name:1}));
export const createUser=async(req,res)=>{const b=pick(req.body,['name','email','password','role','active']),id=uuid('U');const user=await User.create({_id:id,id,name:text(b.name,'Name',{required:true,max:120}),email:email(b.email),passwordHash:await bcrypt.hash(password(b.password),12),role:choice(b.role,roles,'Role'),active:b.active===undefined?true:boolean(b.active,'Active')});await audit(req.user,'User created','User',id);const notificationId=uuid('N');await Notification.create({_id:notificationId,id:notificationId,userId:id,title:'Welcome to Careline',text:'Your clinic workspace is ready.',route:'dashboard'});res.status(201).json(user);};
export const updateUser=async(req,res)=>{
  const user=await existing(User,req.params.id);const b=pick(req.body,['name','email','password','role','active']);
  if(user.id===req.user.id&&((b.role!==undefined&&b.role!=='Administrator')||b.active===false))throw new ApiError(400,'You cannot remove your own administrator access.');
  if(user.active&&user.role==='Administrator'&&(b.active===false||b.role==='Clinic Staff')&&await User.countDocuments({active:true,role:'Administrator'})<=1)throw new ApiError(409,'At least one active administrator is required.');
  if(b.name!==undefined)user.name=text(b.name,'Name',{required:true,max:120});if(b.email!==undefined){user.email=email(b.email);user.pendingEmail='';}if(b.role!==undefined)user.role=choice(b.role,roles,'Role');if(b.active!==undefined)user.active=boolean(b.active,'Active');if(b.password)user.passwordHash=await bcrypt.hash(password(b.password),12);
  await user.save();if(b.password||b.active===false)await Session.deleteMany({userId:user.id});await audit(req.user,'User edited','User',user.id);res.json(user);
};
