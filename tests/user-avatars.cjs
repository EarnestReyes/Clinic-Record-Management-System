const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','navigator','HTMLElement']) Object.defineProperty(global,key,{configurable:true,value:key==='window'?dom.window:dom.window[key]});
Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});global.IS_REACT_ACT_ENVIRONMENT=true;
const babel=require('@babel/core');for(const ext of ['.js','.jsx']){const original=require.extensions[ext]||require.extensions['.js'];require.extensions[ext]=(mod,filename)=>{if(!filename.startsWith(path.resolve(__dirname,'../src')))return original(mod,filename);mod._compile(babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs'],presets:[['@babel/preset-react',{runtime:'automatic'}]]}).code,filename);};}
require.extensions['.css']=()=>{};
const React=require('react'),{render,screen,fireEvent,waitFor,cleanup}=require('@testing-library/react');
const member={id:'synthetic-user',name:'Synthetic Doctor',email:'demo@example.test',active:true,role:'Clinic Staff',specialty:'cardiologist',hasAvatar:false,avatarVersion:0};
let latest={...member,hasAvatar:true,avatarVersion:2},calls=0,fail=false;
const apiPath=path.resolve(__dirname,'../src/services/api.js');require.cache[apiPath]={id:apiPath,filename:apiPath,loaded:true,exports:{request:async(path,options)=>{calls++;if(path!=='/users'){assert.equal(options.binary,true);assert.match(path,/^\/users\/synthetic-user\/avatar\?v=/);return new Blob(['synthetic image'],{type:'image/png'});}if(fail)throw new Error('Synthetic refresh failure');return [latest];}}};
let imageNumber=0;const revoked=[];URL.createObjectURL=()=> 'blob:synthetic-'+(++imageNumber);URL.revokeObjectURL=url=>revoked.push(url);
const Component=require('../src/pages/UserManagement.jsx').default;
const data={users:[member],specialties:[]};
async function run(){
  render(React.createElement(Component,{user:{id:'admin',role:'Administrator'},data,setModal:()=>{},commit:()=>{}}));
  await waitFor(()=>assert.equal(document.querySelector('.person img')?.getAttribute('src'),'blob:synthetic-1'));
  latest={...latest,avatarVersion:3};fireEvent(window,new window.Event('focus'));
  await waitFor(()=>assert.equal(document.querySelector('.person img')?.getAttribute('src'),'blob:synthetic-2'));
  latest={...latest,hasAvatar:false,avatarVersion:4};fireEvent(document,new window.Event('visibilitychange'));
  await waitFor(()=>assert(!document.querySelector('.person img')));assert(document.querySelector('.avatar').textContent);assert(revoked.includes('blob:synthetic-1'));assert(revoked.includes('blob:synthetic-2'));
  fail=true;fireEvent(window,new window.Event('focus'));await screen.findByText('Synthetic refresh failure');
  fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry team refresh'}));await waitFor(()=>assert(!screen.queryByRole('alert')));
  cleanup();const before=calls;
  render(React.createElement(Component,{user:member,data,setModal:()=>{},commit:()=>{}}));assert(screen.getByText('Administrator access required'));assert.equal(calls,before);cleanup();
  console.log('PASS: admin profile-photo sync, version refresh, removal fallback, refresh retry and staff restriction.');
}
run().catch(error=>{console.error(error);process.exitCode=1;cleanup();});
