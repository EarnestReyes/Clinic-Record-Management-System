import Setting from '../models/Setting.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { pick,text,email,boolean,choice } from '../middleware/validation.js';
import { audit } from './shared.js';
import { notificationScope } from '../middleware/accessScopes.js';
export async function clinicSettings(user) { const settings=await Setting.findById('clinic');return {...(settings?.toJSON()||{clinic:'Careline Clinic',email:'',phone:'',address:'',retention:'7 years',prefix:'P',autoArchive:false}),...user.toObject().preferences}; }
export const getSettings=async(req,res)=>res.json(await clinicSettings(req.user));
export const updateSettings=async(req,res)=>{const b=pick(req.body,['clinic','email','phone','address','retention','operatingHours']);const values={};for(const k of ['clinic','phone','address','operatingHours'])if(b[k]!==undefined)values[k]=text(b[k],k,{required:k==='clinic',max:1000});if(b.email!==undefined)values.email=email(b.email,false);if(b.retention!==undefined)values.retention=choice(b.retention,['7 years','10 years','Indefinite'],'Retention policy');await Setting.findOneAndUpdate({_id:'clinic'},{$set:values},{upsert:true,new:true,runValidators:true});await audit(req.user,'Clinic settings updated','Settings','clinic');res.json(await clinicSettings(req.user));};
export const updatePreferences=async(req,res)=>{const b=pick(req.body,['theme','density','reminders','activityAlerts','announcements']),user=await User.findById(req.user.id);for(const k of ['reminders','activityAlerts','announcements'])if(b[k]!==undefined)user.preferences[k]=boolean(b[k],k);if(b.theme!==undefined)user.preferences.theme=choice(b.theme,['light','dark','system'],'Theme');if(b.density!==undefined)user.preferences.density=choice(b.density,['comfortable','compact'],'Density');await user.save();res.json(user.preferences);};
export const notifications=async(req,res)=>res.json(await Notification.find(await notificationScope(req.user)).sort({createdAt:-1}).limit(100));
export const markNotifications=async(req,res)=>{const filter=await notificationScope(req.user);if(req.params.id!=='all')filter.id=text(req.params.id,'Notification ID',{required:true,max:100});await Notification.updateMany(filter,{$set:{read:true}});res.json({success:true});};
