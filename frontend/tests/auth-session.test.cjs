const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.join(__dirname,'../..');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
class ApiError extends Error{constructor(statusCode,message){super(message);this.statusCode=statusCode;}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function authClient(folder,role,cap,request){
  const keys={sessionId:'ancient_trails_'+(role==='admin'?'admin_':'')+'session_id',user:'ancient_trails_'+(role==='admin'?'admin_':'')+'user'};
  const store=new Map(),calls=[],events=[];
  const user={id:'fixture-user',firstName:'Test',lastName:'User',roles:[role],status:'active'};
  store.set(keys.sessionId,'session-one');store.set(keys.user,JSON.stringify(user));
  const exports={};
  const source=fs.readFileSync(path.join(root,folder,'lib',role==='admin'?'admin-auth.ts':'auth.ts'),'utf8');
  vm.runInNewContext(compile(source),{exports,Error,Event,
    window:{localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},dispatchEvent:event=>events.push(event.type)},
    require(name){if(name==='@/lib/api')return{ApiError,apiRequest:async(url,options)=>{calls.push({url,options});return request?request(url,options):{data:{}};}};
      if(name==='@/lib/notification-push')return{disableBrowserPush:async()=>{}};throw Error(name);},
  });
  return{exports,calls,events,user,store,keys,logout:()=>exports['logout'+cap+'Session'](),refresh:token=>exports['refresh'+cap+'Session'](token),get:()=>exports['get'+cap+'Session'](),save:value=>exports['save'+cap+'Session'](value)};
}

for(const[folder,role,cap]of[['frontend','traveller','Traveller'],['admin','admin','Admin']]){
 test(role+': logout revokes on the server before clearing browser data and combines repeat clicks',async()=>{
  let finish;const page=authClient(folder,role,cap,()=>new Promise(resolve=>{finish=resolve;}));
  const first=page.logout(),second=page.logout();
  assert.equal(page.calls.length,1);assert.equal(page.get().sessionId,'session-one');assert.equal(page.events.length,0);
  assert.equal(page.calls[0].url,'/api/auth/logout');assert.equal(page.calls[0].options.headers['X-Session-Id'],'session-one');
  finish({data:{}});await Promise.all([first,second]);
  assert.equal(page.get(),null);assert.equal(page.events.length,1);
 });
 test(role+': failed server logout keeps the session available for another attempt',async()=>{
  const page=authClient(folder,role,cap,async()=>{throw new ApiError(503,'Server unavailable');});
  await assert.rejects(page.logout(),/Server unavailable/);
  assert.equal(page.get().sessionId,'session-one');assert.equal(page.events.length,0);
 });
 test(role+': a late logout cannot clear a newly signed-in account',async()=>{
  let finish;const page=authClient(folder,role,cap,()=>new Promise(resolve=>{finish=resolve;}));
  const pending=page.logout();page.save({sessionId:'new-login',user:{...page.user,id:'new-user'}});
  finish({data:{}});await pending;assert.equal(page.get().sessionId,'new-login');
 });
 test(role+': concurrent refreshes use one cookie-authenticated request and update the profile once',async()=>{
  let finish;const page=authClient(folder,role,cap,()=>new Promise(resolve=>{finish=resolve;}));
  const first=page.refresh('session-one'),second=page.refresh('session-one');
  assert.equal(page.calls.length,1);assert.equal(page.calls[0].options.headers['X-Requested-With'],'XMLHttpRequest');
  finish({data:{sessionId:'session-one',user:page.user}});await Promise.all([first,second]);
  assert.equal(page.get().sessionId,'session-one');assert.equal(page.events.length,1);
  assert.equal(page.calls.length,1);
 });
 test(role+': a refresh finishing after logout cannot restore the session',async()=>{
  let finishRefresh;const page=authClient(folder,role,cap,url=>url.endsWith('/refresh')?new Promise(resolve=>{finishRefresh=resolve;}):Promise.resolve({data:{}}));
  const refresh=page.refresh('session-one');await page.logout();
  finishRefresh({data:{sessionId:'session-one',user:page.user}});assert.equal(await refresh,null);assert.equal(page.get(),null);
 });
 test(role+': refresh cannot replace the current user with another account from a cookie',async()=>{
  const page=authClient(folder,role,cap,async()=>({data:{sessionId:'other-session',user:{id:'other-user'}}}));
  assert.equal(await page.refresh('session-one'),null);assert.equal(page.get().sessionId,'session-one');
 });
 test(role+': rejected refresh ends local access while temporary server errors preserve it',async()=>{
  for(const status of [401,503]){
   const page=authClient(folder,role,cap,async()=>{throw new ApiError(status,'Refresh failed');});
   await assert.rejects(page.refresh('session-one'),/Refresh failed/);
   assert.equal(Boolean(page.get()),status===503);
  }
 });
}

function apiClient(folder,cap,{always401=false,refreshError=false}={}){
  const authHeaders=[],requests=[];let refreshes=0,session={sessionId:'session-one'},clears=0;
  const exports={};
  const auth={};auth['get'+cap+'Session']=()=>session;auth['clear'+cap+'Session']=()=>{session=null;clears++;};
  auth['refresh'+cap+'Session']=async()=>{refreshes++;if(refreshError)throw new exports.ApiError(503,'Refresh unavailable');session={sessionId:'session-one'};return session;};
  vm.runInNewContext(compile(fs.readFileSync(path.join(root,folder,'lib/api.ts'),'utf8')),{
    exports,Error,Headers,AbortController,setTimeout,clearTimeout,process:{env:{}},
    require:()=>auth,
    fetch:async(_url,options)=>{
      requests.push(options);
      const authorization=new Headers(options.headers).get('X-Session-Id');authHeaders.push(authorization);
      const status=always401||refreshes===0?401:200;
      return new Response(JSON.stringify(status===200?{success:true,message:'OK',data:{bookings:[]}}:{message:'Session expired'}),{status,headers:{'Content-Type':'application/json'}});
    },
  });
  return{exports,authHeaders,requests,get refreshes(){return refreshes;},get clears(){return clears;}};
}
for(const[folder,cap]of[['frontend','Traveller'],['admin','Admin']]){
 test(folder+': upload refresh preserves multipart content and retries only once',async()=>{
  const page=apiClient(folder,cap);
  const body=new FormData();body.append('document','fixture');
  const response=await page.exports.sessionFetch('http://localhost:5000/api/bookings/fixture/kyc',{
   method:'POST',headers:{'X-Session-Id':'session-one'},body,credentials:'include',
  });
  assert.equal(response.status,200);assert.equal(page.refreshes,1);
  assert.deepEqual(page.authHeaders,['session-one','session-one']);
  for(const request of page.requests){assert.equal(request.body,body);assert.equal(request.credentials,'include');assert.equal(new Headers(request.headers).has('Content-Type'),false);}
  const denied=apiClient(folder,cap,{always401:true});
  assert.equal((await denied.exports.sessionFetch('http://localhost:5000/api/upload',{headers:{'X-Session-Id':'session-one'}})).status,401);
  assert.equal(denied.refreshes,1);assert.equal(denied.authHeaders.length,2);
 });
 test(folder+': expired access refreshes and retries the original request using its HttpOnly cookie',async()=>{
  const page=apiClient(folder,cap);
  const result=await page.exports.apiRequest('/api/bookings/me',{headers:{'X-Session-Id':'session-one'}});
  assert.equal(result.success,true);assert.equal(page.refreshes,1);
  assert.deepEqual(page.authHeaders,['session-one','session-one']);
 });
 test(folder+': repeated 401 is retried only once',async()=>{
  const page=apiClient(folder,cap,{always401:true});
  await assert.rejects(page.exports.apiRequest('/api/bookings/me',{headers:{'X-Session-Id':'session-one'}}),e=>e.statusCode===401);
  assert.equal(page.refreshes,1);assert.equal(page.authHeaders.length,2);
 });
 test(folder+': logout never triggers refresh and a refresh outage is not reported as successful logout',async()=>{
  const page=apiClient(folder,cap,{always401:true});
  await assert.rejects(page.exports.apiRequest('/api/auth/logout',{method:'POST',headers:{'X-Session-Id':'session-one'}}),e=>e.statusCode===401);
  assert.equal(page.refreshes,0);
  const outage=apiClient(folder,cap,{refreshError:true});
  await assert.rejects(outage.exports.apiRequest('/api/bookings/me',{headers:{'X-Session-Id':'session-one'}}),e=>e.statusCode===503);
 });
}

for(const file of ['frontend/components/layout/header.tsx','frontend/components/user-dashboard/dashboard-top-bar.tsx','frontend/components/user-dashboard/user-sidebar.tsx']){
 const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let handler;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='handleSignOut')handler=node.initializer;ts.forEachChild(node,visit);}
 visit(source);assert.ok(handler);
 for(const fails of [false,true])test(file+': '+(fails?'failed logout does not report success':'success is shown only after server logout'),async()=>{
  let finish,fail;const successes=[],errors=[],routes=[];
  const run=vm.runInNewContext(compile('const run='+handler.getText(source)+';run;'),{
   logoutTravellerSession:()=>new Promise((resolve,reject)=>{finish=resolve;fail=reject;}),
   toast:{success:(...args)=>successes.push(args),error:(...args)=>errors.push(args)},
   router:{push:value=>routes.push(value)},pathname:'/me',setTravellerUser(){},setIsAccountMenuOpen(){},setIsMobileMenuOpen(){},
  });
  const pending=run();assert.equal(successes.length,0);assert.equal(routes.length,0);
  if(fails)fail(Error('Network unavailable'));else finish();await pending;
  assert.equal(successes.length,fails?0:1);assert.equal(routes.length,fails?0:1);assert.equal(errors.length,fails?1:0);
 });
}
