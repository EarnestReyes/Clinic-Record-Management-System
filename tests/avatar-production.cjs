const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://clinic-record-management-system.vercel.app/'});
for(const key of ['window','document','navigator','HTMLElement'])Object.defineProperty(global,key,{configurable:true,value:key==='window'?dom.window:dom.window[key]});
global.Event=window.Event;global.IS_REACT_ACT_ENVIRONMENT=true;
const backend='https://clinic-record-management-system-api.onrender.com';
const babel=require('@babel/core');for(const ext of ['.js','.jsx']){const original=require.extensions[ext]||require.extensions['.js'];require.extensions[ext]=(mod,filename)=>{if(!filename.startsWith(path.resolve(__dirname,'../src')))return original(mod,filename);let source=fs.readFileSync(filename,'utf8');if(filename===path.resolve(__dirname,'../src/services/api.js'))source=source.replace('import.meta.env.VITE_API_URL',JSON.stringify(backend));mod._compile(babel.transformSync(source,{filename,configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs'],presets:[['@babel/preset-react',{runtime:'automatic'}]]}).code,filename);};}
const React=require('react'),{render,fireEvent,waitFor,cleanup}=require('@testing-library/react');
const Avatar=require('../src/components/common/Avatar.jsx').default;
const calls=[],revoked=[];let count=0,status=200,mime='image/png',pending;
URL.createObjectURL=()=>`blob:synthetic-${++count}`;URL.revokeObjectURL=url=>revoked.push(url);
global.fetch=async(url,options)=>{calls.push({url,options});if(pending)return new Promise(resolve=>{pending.resolve=resolve;});return new Response(status===200?'synthetic image':JSON.stringify({error:'Unavailable'}),{status,headers:{'Content-Type':mime}});};
const props=src=>({name:'Synthetic Doctor',src});
async function run(){
  const view=render(React.createElement(Avatar,props('/api/users/demo/avatar?v=1')));
  await waitFor(()=>assert.equal(document.querySelector('img')?.getAttribute('src'),'blob:synthetic-1'));
  assert.equal(calls[0].url,backend+'/api/users/demo/avatar?v=1');assert.equal(calls[0].options.credentials,'include');
  fireEvent.error(document.querySelector('img'));assert(!document.querySelector('img'));assert(document.body.textContent.includes('SD'));
  view.rerender(React.createElement(Avatar,props('/api/users/demo/avatar?v=2')));
  await waitFor(()=>assert.equal(document.querySelector('img')?.getAttribute('src'),'blob:synthetic-2'));assert(revoked.includes('blob:synthetic-1'));
  for(const failure of [403,404,500]){
    status=failure;mime='application/json';view.rerender(React.createElement(Avatar,props('/api/users/demo/avatar?v='+failure)));
    await waitFor(()=>assert.equal(calls.at(-1).url,backend+'/api/users/demo/avatar?v='+failure));
    await waitFor(()=>assert(document.body.textContent.includes('SD')));assert(!document.querySelector('img'));
  }
  status=200;mime='text/html';view.rerender(React.createElement(Avatar,props('/api/users/demo/avatar?v=html')));
  await waitFor(()=>assert(calls.at(-1).url.endsWith('v=html')));assert(!document.querySelector('img'));
  pending={};view.rerender(React.createElement(Avatar,props('/api/users/demo/avatar?v=slow')));
  await waitFor(()=>assert(pending.resolve));const oldRequest=calls.at(-1);
  view.rerender(React.createElement(Avatar,props('blob:gallery-preview')));assert(oldRequest.options.signal.aborted);assert.equal(document.querySelector('img').getAttribute('src'),'blob:gallery-preview');
  pending.resolve(new Response('late synthetic image',{headers:{'Content-Type':'image/png'}}));
  fireEvent.error(document.querySelector('img'));assert(!document.querySelector('img'));assert(document.body.textContent.includes('SD'));
  view.rerender(React.createElement(Avatar,props(undefined)));assert(!document.querySelector('img'));cleanup();
  assert(revoked.includes('blob:synthetic-2'));
  console.log('PASS: Vercel-to-Render image URL, credentialed API fetch, version refresh, decode/HTTP/HTML fallback, preview handling and object-URL cleanup.');
}
run().catch(error=>{console.error(error);process.exitCode=1;cleanup();});
