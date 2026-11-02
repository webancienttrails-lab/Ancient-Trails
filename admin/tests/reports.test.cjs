const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(imports){
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/reports.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>imports[name]});return exports;
}
test('reports use the current admin session, selected range and abort signal',async()=>{
  const calls=[];const signal={fixture:true};
  class ApiError extends Error{}
  const reports=load({'@/lib/api':{ApiError,apiRequest:async(...args)=>{calls.push(args);return{data:{days:90}};}},'@/lib/admin-auth':{getAdminSession:()=>({sessionId:'report-session'})}});
  await reports.getAdminReport(90,signal);
  assert.equal(calls[0][0],'/api/admin/dashboard/reports?days=90');
  assert.equal(calls[0][1].headers['X-Session-Id'],'report-session');
  assert.equal(calls[0][1].signal,signal);
});
test('CSV exports the selected live report and safely escapes user-entered tour/category names',()=>{
  const {createReportCsv}=load({});
  const metric={value:20,previous:10,change:100};
  const csv=createReportCsv({days:30,generatedAt:'2026-10-30',currency:'INR',period:{start:'2026-10-01',end:'2026-10-31'},metrics:{revenue:metric,bookings:metric,openEnquiries:metric,travellers:metric},trend:[{label:'1 Oct',bookings:2,revenue:20000}],categories:[{name:'=unsafe',revenue:20000,percentage:100}],topTours:[{name:'Tour, "A"',category:'+unsafe',bookings:2,revenue:20000,fillRate:75}],pipeline:[{status:'New',count:4}]});
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Verified revenue","20","10"'));
  assert.ok(csv.includes('"1 Oct","2","20000"'));
  assert.ok(csv.includes('"\'=unsafe"'));
  assert.ok(csv.includes('"\'+unsafe"'));
  assert.ok(csv.includes('"Tour, ""A"""'));
  assert.ok(csv.includes('"New","4"'));
});

test('missing admin sessions reject before making a report request',async()=>{
  let calls=0;
  class ApiError extends Error {constructor(statusCode,message){super(message);this.statusCode=statusCode;}}
  const reports=load({'@/lib/api':{ApiError,apiRequest:async()=>{calls++;}},'@/lib/admin-auth':{getAdminSession:()=>null}});
  await assert.rejects(reports.getAdminReport(30),error=>error.statusCode===401);
  assert.equal(calls,0);
});

test('Reports renders empty, loading and failure states without presenting invented totals or enabling export',()=>{
  const React=require('react');
  const {renderToStaticMarkup}=require('react-dom/server');
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/reports/page.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const emptyMetric={value:0,previous:0,change:0};
  const empty={days:30,currency:'INR',period:{start:'2026-10-01',end:'2026-10-31'},metrics:{revenue:emptyMetric,bookings:emptyMetric,openEnquiries:emptyMetric,travellers:emptyMetric},trend:[],categories:[],topTours:[],pipeline:[],enquiryTotal:0,closedPercentage:0,excludedCurrencyBookings:0};
  for(const [name,result] of [['loading',{days:30,data:null,error:''}],['error',{days:30,data:null,error:'Connection failed'}],['empty',{days:30,data:empty,error:''}]]){
    let cursor=0;const exports={};
    vm.runInNewContext(code,{exports,Intl,Date,require:module=>module==='react'?{...React,useEffect(){},useState:initial=>[cursor++===2?result:initial,()=>{}]}:module==='@/components/admin-dashboard/admin-dashboard-shell'?{AdminDashboardShell:({children})=>React.createElement('main',null,children)}:module==='@/lib/reports'?{reportPeriods:[{days:30,label:'Last 30 days'}]}:module.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:require(module)});
    const html=renderToStaticMarkup(React.createElement(exports.default));
    if(name==='loading'){assert.match(html,/Loading reports/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/₹0/);}
    if(name==='error'){assert.match(html,/Connection failed/);assert.match(html,/Retry/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/₹0/);}
    if(name==='empty'){assert.match(html,/₹0/);assert.match(html,/No bookings or verified revenue/);assert.match(html,/No enquiries/);assert.doesNotMatch(html,/disabled=""/);}
  }
});
