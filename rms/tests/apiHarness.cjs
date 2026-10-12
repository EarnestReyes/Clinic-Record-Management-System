// Browser contract harness. This verifies frontend behavior, not MongoDB or Express.
const { initialData } = require('../../backend/scripts/fixtures.js');
module.exports = function apiHarness({ authenticated = false } = {}) {
 const db = initialData();
 db.users.forEach(user=>{user.preferences={theme:'light',density:'comfortable',reminders:true,activityAlerts:true,announcements:true};user.createdAt=new Date().toISOString();user.lastLoginAt=new Date().toISOString();});
 db.documents.forEach(d => { d.mime='text/plain'; });
 let session = authenticated ? db.users[0] : null, failure = null, counter = 9000;
 const calls = [];
 const response = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const fetch = async (url,options={}) => {
  const parsed=new URL(url,'http://localhost'),path=parsed.pathname.replace(/^\/api/,''),method=options.method||'GET';
  const body=typeof options.body==='string'?JSON.parse(options.body):options.body;
  calls.push({path,method});
  if(failure && method!=='GET'){const message=failure;failure=null;return response({error:message},500);}
  if(path==='/auth/login') {
   const found=db.users.find(u=>u.email===body.email&&u.active);
   if(!found||body.password!=='CarelineTest123!')return response({error:'Email or password is incorrect.'},401);
   session=found;return response({user:session,csrfToken:'test-csrf'});
  }
  if(!session)return response({error:'Please sign in to continue.'},401);
  if(method!=='GET'&&options.headers?.['X-CSRF-Token']!=='test-csrf')return response({error:'Missing CSRF token'},403);
  if(path==='/auth/me')return response({user:session,csrfToken:'test-csrf'});
  if(path==='/auth/logout'){session=null;return response({success:true});}
  if(path==='/workspace')return response(db);
  if(path==='/preferences'){Object.assign(session.preferences ||= {},body);Object.assign(db.settings,body);return response(session.preferences);}
  if(path==='/settings'){Object.assign(db.settings,body);return response(db.settings);}
  if(path==='/settings/system')return response({version:'1.0.0',databaseConnected:true,sessionHours:8});
  if(path==='/auth/activity')return response([{id:'test-signin',date:new Date().toISOString()}]);
  if(path==='/auth/revoke-others')return response({success:true});
  if(path==='/auth/avatar'&&method==='POST'){session.hasAvatar=true;session.avatarVersion=(session.avatarVersion||0)+1;return response(session);}
  if(path==='/auth/avatar/remove'){session.hasAvatar=false;session.avatarVersion++;return response(session);}
  if(path==='/settings/logo'&&method==='POST'){db.settings.hasLogo=true;db.settings.logoVersion=(db.settings.logoVersion||0)+1;return response({success:true});}
  if(path==='/settings/logo/remove'){db.settings.hasLogo=false;return response({success:true});}
  if(path==='/auth/profile'){const values={...body};if(values.email&&values.email!==session.email){session.pendingEmail=values.email;delete values.email;}Object.assign(session,values);delete session.password;delete session.currentPassword;delete session.confirmPassword;return response(session);}
  if(path.startsWith('/notifications/')){db.notifications.forEach(n=>{if(path.includes('/all/')||path.includes('/'+n.id+'/'))n.read=true;});return response({success:true});}
  if(path.startsWith('/reports/')) {
   const type=path.split('/')[2],key={activity:'logs'}[type]||type;
   if(parsed.searchParams.get('format')==='csv')return new Response('id,name\n1,Example',{headers:{'Content-Type':'text/csv'}});
   return response({items:db[key],total:db[key].length});
  }
  const [,key,id,operation]=path.split('/'),collection=db[key];
  if(!Array.isArray(collection))throw new Error('Unhandled contract request '+path);
  if(key==='users'&&session.role!=='Administrator')return response({error:'Administrator access is required.'},403);
  if(method==='POST'&&!id){
   const record={...body,id:key==='patients'?`P-${new Date().getFullYear()}-${++counter}`:`TEST-${++counter}`};
   collection.push(record);db.logs.unshift({id:'LOG-'+counter,action:key+' created',detail:record.id,actor:session.name,date:new Date().toISOString()});return response(record,201);
  }
  const record=collection.find(r=>r.id===id);
  if(!record)return response({error:'Record not found.'},404);
  if(key==='documents'&&['preview','download'].includes(operation))return new Response(record.content,{headers:{'Content-Type':record.mime||'text/plain'}});
  if(['archive','restore'].includes(operation)){record.status=operation==='archive'?'Archived':'Active';return response(record);}
  if(method==='PATCH'){Object.assign(record,body);delete record.password;return response(record);}
  return response(record);
 };
 return {fetch,db,calls,failNext(message='Database unavailable.'){failure=message;}};
};
