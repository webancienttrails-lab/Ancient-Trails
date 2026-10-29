const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
class ApiError extends Error { constructor(statusCode, message) { super(message); this.statusCode = statusCode; } }
function load(file, imports = {}) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, Error, require: name => imports[name] || require(name), Date, Intl });
  return exports;
}
const booking = { id:'booking-fixture', bookingStatus:'confirmed', paymentCurrency:'INR' };
const estimate = { daysBeforeDeparture:45,chargePercentage:10,amountPaid:20000,cancellationCharge:4000,
  nonRefundableGst:2000,estimatedRefund:14000,policyRows:[{days:'30 and above',charge:'10%'}],notes:['Estimate only; manual team review required.'] };
const quote = { canRequest:true,existingRequest:null,estimate,quoteHash:'a'.repeat(64),policyHref:'/terms-and-conditions#cancellation-policy' };
function mount({ send, preview } = {}) {
  const slots = [], calls = { preview:0, submit:[] }; let cursor=0;
  const hooks = {
    useState(value) { const index=cursor++; if(!(index in slots))slots[index]=value; return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}]; },
    useRef(value) { const index=cursor++; if(!(index in slots))slots[index]={current:value}; return slots[index]; },
  };
  const { BookingCancellationRequestControl: Component } = load('components/booking-cancellation-request.tsx', {
    react:hooks, 'next/link':{__esModule:true,default:'a'}, '@/components/ui/button':{Button:'button'}, '@/lib/api':{ApiError},
    '@/lib/booking-cancellation':{
      getCancellationPreview:async id=>{calls.preview++;assert.equal(id,booking.id);return{data:preview?preview(calls.preview):quote};},
      requestBookingCancellation:async(...args)=>{calls.submit.push(args);return send?send(...args):{data:{request:{status:'requested',estimate}},message:'Request recorded for manual review'};},
    },
  });
  return { calls, render(changes={}){cursor=0;return Component({booking,departureDate:'2040-12-13',...changes});} };
}
function all(node,predicate){
  if(!node||typeof node!=='object')return[];
  const children=node.props?.children;
  return(predicate(node)?[node]:[]).concat((Array.isArray(children)?children:[children]).flatMap(child=>all(child,predicate)));
}
function text(node){if(node===null||node===undefined||typeof node==='boolean')return'';if(typeof node!=='object')return String(node);return(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).map(text).join(' ');}
const button=(tree,label)=>all(tree,node=>node.type==='button'&&text(node)===label)[0];
const event={preventDefault(){}};

test('opening the cancellation control shows a server estimate and policy without sending a request',async()=>{
  const page=mount();button(page.render(),'Request cancellation').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  const tree=page.render();
  assert.equal(page.calls.preview,1);assert.equal(page.calls.submit.length,0);
  assert.match(text(tree),/Estimated refund:.*\u20b914,000/);
  assert.match(text(tree),/does not cancel your booking automatically/);
  assert.ok(all(tree,node=>node.type==='a'&&node.props.href==='/terms-and-conditions#cancellation-policy').length);
  button(tree,'Keep my booking').props.onClick();
  assert.equal(all(page.render(),node=>node.props?.role==='dialog').length,0);
  assert.equal(page.calls.submit.length,0);
});

test('explicit confirmation sends the server quote and reason once, even with rapid duplicate submissions',async()=>{
  let finish;const page=mount({send:()=>new Promise(resolve=>{finish=resolve;})});
  button(page.render(),'Request cancellation').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  all(page.render(),node=>node.type==='textarea')[0].props.onChange({target:{value:'Please cancel my upcoming trip'}});
  const form=all(page.render(),node=>node.type==='form')[0];
  const first=form.props.onSubmit(event),second=form.props.onSubmit(event);
  assert.equal(page.calls.submit.length,1);
  assert.deepEqual(page.calls.submit[0],[booking.id,'Please cancel my upcoming trip',quote.quoteHash]);
  finish({data:{request:{status:'requested',estimate}},message:'Request recorded for manual review'});
  await Promise.all([first,second]);
  assert.match(text(page.render()),/awaiting team review/);
  assert.equal(button(page.render(),'Cancellation requested').props.disabled,true);
});

test('stale estimates are refreshed for review and never submitted automatically',async()=>{
  const page=mount({preview:count=>count===1?quote:{...quote,quoteHash:'b'.repeat(64),estimate:{...estimate,estimatedRefund:6000}},
    send:async()=>{throw new ApiError(409,'The estimate changed. Review the updated amount.');}});
  button(page.render(),'Request cancellation').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  all(page.render(),node=>node.type==='textarea')[0].props.onChange({target:{value:'Please cancel my trip'}});
  await all(page.render(),node=>node.type==='form')[0].props.onSubmit(event);
  assert.equal(page.calls.submit.length,1);assert.equal(page.calls.preview,2);
  assert.match(text(page.render()),/updated amount/);
  assert.match(text(page.render()),/Estimated refund:.*\u20b96,000/);
});

test('past and cancelled bookings do not offer online cancellation',()=>{
  const page=mount();
  assert.equal(page.render({departureDate:'2000-01-01'}),null);
  assert.equal(page.render({booking:{...booking,bookingStatus:'cancelled'}}),null);
});

test('cancellation requests use the signed-in session and never send a customer-supplied refund amount',async()=>{
  let session={sessionId:'fixture-session'};const calls=[];
  const api=load('lib/booking-cancellation.ts',{
    '@/lib/api':{ApiError,apiRequest:async(url,options)=>{calls.push({url,options});return{};}},
    '@/lib/auth':{getTravellerSession:()=>session},
  });
  await api.getCancellationPreview('booking-fixture');
  await api.requestBookingCancellation('booking-fixture','Please cancel',quote.quoteHash);
  assert.equal(calls[1].url,'/api/bookings/booking-fixture/cancel-request');
  assert.equal(calls[1].options.headers.Authorization,'Bearer fixture-session');
  assert.deepEqual(JSON.parse(calls[1].options.body),{reason:'Please cancel',quoteHash:quote.quoteHash});
  session=null;assert.throws(()=>api.getCancellationPreview('booking-fixture'),e=>e.statusCode===401);
});
