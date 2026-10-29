const test = require('node:test');
const assert = require('node:assert/strict');
const jsonwebtoken = require('jsonwebtoken');
const { User } = require('../dist/models/user.model');
const { Booking } = require('../dist/models/booking.model');
const { Tour } = require('../dist/models/tour.model');
const { TourDeparture } = require('../dist/models/tourDeparture.model');
const { Destination } = require('../dist/models/destination.model');
const { AuthSession, RevokedAccessToken } = require('../dist/models/authSession.model');
const { issueAuthSession, authTokenHash } = require('../dist/services/auth-session.service');
const { signAuthToken, verifyAuthToken } = require('../dist/utils/jwt');
const app = require('../dist/app').default;
let server, origin;
test.before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
function setup(t, roles=['traveller']) {
  const previous=process.env.JWT_SECRET;process.env.JWT_SECRET='auth-session-fixture-secret';
  t.after(()=>{if(previous===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previous;});
  t.mock.method(console,'error',()=>{});
  const user=new User({firstName:'Test',lastName:'Traveller',email:'fixture@example.test',mobileNumber:'919000000000',roles,status:'active',isMobileVerified:true});
  const sessions=new Map(),revoked=new Map();
  const active=(row)=>row&&!row.revokedAt&&row.expiresAt>new Date();
  t.mock.method(AuthSession,'create',async values=>{const row=new AuthSession(values);sessions.set(row.id,row);return row;});
  t.mock.method(AuthSession,'exists',async filter=>active(sessions.get(filter._id))&&sessions.get(filter._id).userId===filter.userId?{_id:filter._id}:null);
  t.mock.method(AuthSession,'findOne',async filter=>[...sessions.values()].find(row=>active(row)&&row.refreshHash===filter.refreshHash&&row.audience===filter.audience)||null);
  t.mock.method(AuthSession,'updateOne',async(filter,update)=>{const row=sessions.get(filter._id);if(row&&row.userId===filter.userId)row.revokedAt=update.$set.revokedAt;return{};});
  t.mock.method(RevokedAccessToken,'exists',async filter=>revoked.has(filter._id)?{_id:filter._id}:null);
  t.mock.method(RevokedAccessToken,'updateOne',async(filter,update)=>{revoked.set(filter._id,update.$setOnInsert);return{};});
  t.mock.method(User,'findById',async()=>user);
  t.mock.method(Booking,'find',()=>({sort(){return this;},limit:async()=>[]}));
  for(const model of [Tour,TourDeparture,Destination])t.mock.method(model,'find',()=>({exec:async()=>[]}));
  async function issue(scope='traveller') {
    const cookies=[];
    const token=await issueAuthSession(user,{}, {cookie(name,value,options){cookies.push({name,value,options});},setHeader(){}},scope);
    const cookie=cookies.find(item=>item.name.endsWith('_refresh')),access=cookies.find(item=>item.name.endsWith('_access'));
    return{token,cookie,access,sessionId:verifyAuthToken(token).sid,header:cookie.name+'='+cookie.value};
  }
  const me=token=>fetch(origin+'/api/bookings/me',{headers:{Authorization:'Bearer '+token}});
  const logout=(token,body={})=>fetch(origin+'/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  const refresh=(header,scope='traveller',customHeader=true)=>fetch(origin+'/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json',Cookie:header,...customHeader?{'X-Requested-With':'XMLHttpRequest'}:{}},body:JSON.stringify({audience:scope})});
  return{user,sessions,revoked,issue,me,logout,refresh};
}

test('new sessions use unique one-hour access tokens and store only a refresh-token hash',async t=>{
  const f=setup(t),first=await f.issue(),second=await f.issue();
  const claims=jsonwebtoken.decode(first.token);
  assert.equal(claims.exp-claims.iat,3600);assert.ok(claims.jti);assert.ok(claims.sid);
  assert.notEqual(first.token,second.token);
  assert.equal(first.cookie.options.httpOnly,true);
  assert.equal(first.cookie.options.path,'/api/auth');
  assert.ok(!JSON.stringify([...f.sessions.values()]).includes(first.cookie.value));
  assert.equal(f.sessions.get(claims.sid).refreshHash,authTokenHash(first.cookie.value));
});
test('a copied token returns 401 from the actual bookings endpoint immediately after logout',async t=>{
  const f=setup(t),session=await f.issue();
  assert.equal((await f.me(session.token)).status,200);
  const result=await f.logout(session.token);assert.equal(result.status,200);
  assert.match(result.headers.get('set-cookie'),/Expires=/i);
  assert.equal((await f.me(session.token)).status,401);
  assert.equal((await f.refresh(session.header)).status,401);
});
test('all access tokens refreshed from the same session are revoked together',async t=>{
  const f=setup(t),session=await f.issue(),refreshed=await f.refresh(session.header);
  assert.equal(refreshed.status,200);
  const body=await refreshed.json();assert.equal(body.data.token,undefined);assert.equal(body.data.sessionId,session.sessionId);
  const token=decodeURIComponent(refreshed.headers.getSetCookie().find(value=>value.startsWith('ancient_trails_access=')).split(';')[0].split('=')[1]);
  assert.notEqual(token,session.token);assert.equal(verifyAuthToken(token).sid,verifyAuthToken(session.token).sid);
  assert.equal((await f.me(token)).status,200);
  await f.logout(session.token);
  assert.equal((await f.me(token)).status,401);
});
test('legacy seven-day tokens without jti or session rows are revoked by fingerprint',async t=>{
  const f=setup(t),legacy=jsonwebtoken.sign({userId:f.user.id,roles:f.user.roles},process.env.JWT_SECRET,{expiresIn:'7d'});
  assert.equal(jsonwebtoken.decode(legacy).jti,undefined);
  assert.equal((await f.me(legacy)).status,200);
  assert.equal((await f.logout(legacy)).status,200);
  assert.equal((await f.me(legacy)).status,401);
  assert.equal(f.revoked.size,1);
  assert.match([...f.revoked.keys()][0],/^[a-f0-9]{64}$/);
});
test('repeated logout is idempotent and does not end another device session',async t=>{
  const f=setup(t),first=await f.issue(),other=await f.issue();
  assert.equal((await f.logout(first.token)).status,200);
  assert.equal((await f.logout(first.token)).status,200);
  assert.equal((await f.me(other.token)).status,200);
});
test('an expired access token can still revoke its live refresh session',async t=>{
  const f=setup(t),session=await f.issue(),claims=verifyAuthToken(session.token);
  const expired=jsonwebtoken.sign({userId:f.user.id,roles:f.user.roles,sid:claims.sid},process.env.JWT_SECRET,{expiresIn:-1});
  assert.equal((await f.logout(expired)).status,200);
  assert.equal((await f.refresh(session.header)).status,401);
});
test('refresh is rejected for missing cookies, cross-site form requests, and expired sessions',async t=>{
  const f=setup(t),session=await f.issue();
  assert.equal((await f.refresh('')).status,401);
  assert.equal((await f.refresh(session.header,'traveller',false)).status,403);
  f.sessions.get(verifyAuthToken(session.token).sid).expiresAt=new Date(Date.now()-1);
  assert.equal((await f.refresh(session.header)).status,401);
});
test('blocked accounts cannot refresh or use an active token',async t=>{
  const f=setup(t),session=await f.issue();f.user.status='blocked';
  assert.equal((await f.refresh(session.header)).status,401);
  assert.equal((await f.me(session.token)).status,403);
});
test('admin and traveller refresh cookies cannot be exchanged across audiences',async t=>{
  const f=setup(t,['staff']),session=await f.issue('admin');
  assert.equal(session.cookie.name,'ancient_trails_admin_refresh');
  assert.equal((await f.refresh(session.header,'traveller')).status,401);
  assert.equal((await f.refresh(session.header,'admin')).status,200);
  assert.equal((await f.logout(session.token,{audience:'admin'})).status,200);
  assert.equal((await f.refresh(session.header,'admin')).status,401);
});
test('database failures cannot bypass the per-request session check',async t=>{
  const f=setup(t),session=await f.issue();
  t.mock.method(AuthSession,'exists',async()=>{throw Error('Session database unavailable');});
  assert.equal((await f.me(session.token)).status,503);
});
test('tampered access tokens cannot access bookings or log out another session',async t=>{
  const f=setup(t),session=await f.issue();
  const tampered=session.token.slice(0,-10)+'aaaaaaaaaa';
  assert.equal((await f.me(tampered)).status,401);
  assert.equal((await f.logout(tampered)).status,401);
  assert.equal((await f.me(session.token)).status,200);
});
