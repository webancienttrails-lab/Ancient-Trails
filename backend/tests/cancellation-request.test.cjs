const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Booking } = require('../dist/models/booking.model');
const { Tour } = require('../dist/models/tour.model');
const { TourDeparture } = require('../dist/models/tourDeparture.model');
const { User } = require('../dist/models/user.model');
const { BookingCancellationRequest: Requests } = require('../dist/models/bookingCancellationRequest.model');
const { NotificationEvent, Notification, PushRegistration } = require('../dist/models/notification.model');
const { materializeNotificationEvent } = require('../dist/services/notifications/notification-worker.service');
const { cancellationEstimate } = require('../dist/services/booking/booking.cancellation-estimate');
const { getCancellationRequestPreview: preview, requestBookingCancellation: submit } = require('../dist/controllers/bookingCancellationRequest.controller');
const { mockBookingTraveller, bookingRequest, bookingResponse } = require('./helpers/booking-access.cjs');
const now = new Date('2030-01-01T06:00:00Z');
function policyBooking(overrides = {}) { return { subtotal: 40000, gstAmount: 2000, amountPaid: 20000, ...overrides }; }
function departure(days) { return new Date(now.getTime() + days * 86400000); }

for (const [days, percentage] of [[1,100],[10,100],[11,50],[20,50],[21,30],[30,30],[31,10],[120,10]]) {
  test('published policy: ' + days + ' days uses ' + percentage + '% cancellation charge', () => {
    const quote = cancellationEstimate(policyBooking(), departure(days), [], now);
    assert.equal(quote.daysBeforeDeparture, days);
    assert.equal(quote.chargePercentage, percentage);
    assert.equal(quote.estimatedRefund, Math.max(0, 20000 - 40000 * percentage / 100 - 2000));
  });
}
test('tour-specific numeric policy overrides the default policy without trusting a customer amount', () => {
  const quote = cancellationEstimate(policyBooking(), departure(40), [{ days:'30 and above', charge:'5%' }], now);
  assert.equal(quote.chargePercentage, 5);
  assert.equal(quote.estimatedRefund, 16000);
});
test('unclear policy or missing prices requires manual estimation instead of inventing a refund', () => {
  assert.equal(cancellationEstimate(policyBooking(), departure(40), [{days:'Before booking',charge:'Registration amount'}],now).estimatedRefund,null);
  assert.equal(cancellationEstimate(policyBooking({subtotal:undefined}), departure(40), [],now).estimatedRefund,null);
});
test('slab days use India calendar days rather than the browser timezone', () => {
  const quote = cancellationEstimate(policyBooking(), new Date('2030-01-31T18:00:00Z'), [], new Date('2030-01-01T18:40:00Z'));
  assert.equal(quote.daysBeforeDeparture, 29);
});

function setup(t, userChanges = {}) {
  mockBookingTraveller(t, userChanges);
  const booking = new Booking({ tourId:'TOURTEST', departureId:'DEPTEST', bookingReference:'ATTEST',
    bookingStatus:'confirmed', paymentStatus:'paid', paymentMode:'online', subtotal:40000, gstAmount:2000,
    amountPaid:20000, grandTotal:42000, balanceAmount:22000, totalGuest:1, adultCount:1, childCount:0,
    guestDetails:[{firstName:'Test',lastName:'Traveller',email:'test@example.com',mobileNumber:'9000000000',countryCode:'+91'}],
    childDetails:[],travellers:[],accommodationDetails:{} });
  const trip = { departureDate:new Date(Date.now()+45*86400000), status:'scheduled' };
  let record = null, creations = 0;
  const events = [];
  t.mock.method(Booking,'findOne',async filter=>{
    assert.equal(filter._id,booking.id);
    return filter['guestDetails.0.mobileNumber'].$in.some(regex=>regex.test('9000000000')) ? booking : null;
  });
  t.mock.method(Booking,'findById',async()=>booking);
  t.mock.method(Booking,'updateOne',()=>{throw Error('A request must not alter payments or seats');});
  t.mock.method(Booking,'findOneAndUpdate',()=>{throw Error('A request must not cancel the booking');});
  t.mock.method(Tour,'findOne',async()=>({tourName:'Test tour',cancellationPolicy:[]}));
  t.mock.method(TourDeparture,'findOne',async()=>trip);
  t.mock.method(TourDeparture,'findOneAndUpdate',()=>{throw Error('A request must not release seats');});
  t.mock.method(Requests,'findOne',async()=>record);
  t.mock.method(Requests,'createIndexes',async()=>[]);
  t.mock.method(Requests,'create',async(values,options)=>{
    assert.equal(options.session,session);
    if(record)throw Object.assign(Error('Duplicate request'),{code:11000});
    creations++; record=new Requests(values[0]); return[record];
  });
  const session={async withTransaction(fn){const before=record;try{await fn();}catch(error){record=before;throw error;}},async endSession(){}};
  t.mock.method(mongoose,'startSession',async()=>session);
  t.mock.method(NotificationEvent,'updateOne',async(filter,update,options)=>{
    assert.equal(options.session,session,'Request and notification must commit atomically');
    events.push({_id:filter._id,...update.$setOnInsert});
  });
  async function quote(){const res=bookingResponse();await preview(bookingRequest(booking.id),res);return res.body.data;}
  async function send(quoteHash,extra={}){
    const res=bookingResponse();await submit(bookingRequest(booking.id,true,{body:{quoteHash,reason:'Please cancel my upcoming trip',...extra}}),res);return res;
  }
  return{booking,trip,events,quote,send,get record(){return record;},get creations(){return creations;}};
}

test('owner reviews an estimate, records a request and queues the team notification without cancelling or refunding',async t=>{
  const f=setup(t),quote=await f.quote();
  assert.equal(quote.estimate.estimatedRefund,14000);
  const res=await f.send(quote.quoteHash,{estimatedRefund:999999,chargePercentage:0});
  assert.equal(res.statusCode,201);
  assert.equal(f.record.estimate.estimatedRefund,14000);
  assert.equal(f.record.status,'requested');
  assert.equal(f.events[0].kind,'cancellation_requested');
  assert.equal(f.events[0].payload.requestId,f.record.id);
  assert.equal(f.booking.bookingStatus,'confirmed');
  assert.equal(f.booking.amountPaid,20000);
  assert.equal(f.booking.balanceAmount,22000);
});
test('repeat and concurrent submissions record one request and one notification',async t=>{
  const f=setup(t),quote=await f.quote();
  await Promise.all([f.send(quote.quoteHash),f.send(quote.quoteHash)]);
  await f.send(quote.quoteHash);
  assert.equal(f.creations,1);assert.equal(f.events.length,1);
});
test('another account cannot preview or request cancellation even with the booking ID',async t=>{
  const f=setup(t,{mobileNumber:'919111111111'});
  await assert.rejects(f.quote(),e=>e.statusCode===404);
  await assert.rejects(f.send('a'.repeat(64)),e=>e.statusCode===404);
  assert.equal(f.creations,0);
});
test('anonymous access cannot preview or submit a cancellation request',async t=>{
  const f=setup(t);
  await assert.rejects(preview(bookingRequest(f.booking.id,false),bookingResponse()),e=>e.statusCode===401);
  await assert.rejects(submit(bookingRequest(f.booking.id,false,{body:{reason:'Cancel my trip',quoteHash:'a'.repeat(64)}}),bookingResponse()),e=>e.statusCode===401);
});
test('changed payment or policy data requires the customer to review a new estimate',async t=>{
  const f=setup(t),quote=await f.quote();f.booking.amountPaid=25000;
  await assert.rejects(f.send(quote.quoteHash),e=>e.statusCode===409);
  assert.equal(f.creations,0);assert.equal(f.events.length,0);
});
for(const status of ['cancelled','expired'])test(status+' bookings cannot create a request',async t=>{
  const f=setup(t);f.booking.bookingStatus=status;const quote=await f.quote();
  assert.equal(quote.canRequest,false);
  await assert.rejects(f.send(quote.quoteHash),e=>e.statusCode===409);
});
test('past departures cannot create a request',async t=>{
  const f=setup(t);f.trip.departureDate=new Date(Date.now()-86400000);const quote=await f.quote();
  assert.equal(quote.canRequest,false);await assert.rejects(f.send(quote.quoteHash),e=>e.statusCode===409);
});
test('notification persistence failure rolls back the request so an unnotified request is never reported as successful',async t=>{
  const f=setup(t),quote=await f.quote();
  t.mock.method(NotificationEvent,'updateOne',async()=>{throw Error('Notification store unavailable');});
  await assert.rejects(f.send(quote.quoteHash),/Notification store unavailable/);
  assert.equal(f.record,null);
});
test('team notification includes the request reason and estimated refund and is sent only to admins',async t=>{
  const f=setup(t),quote=await f.quote();await f.send(quote.quoteHash);
  const notices=[];
  t.mock.method(User,'find',async()=>[{id:'staff-fixture'}]);
  t.mock.method(User,'findOne',()=>{throw Error('Customer fanout is not part of a cancellation request');});
  t.mock.method(PushRegistration,'find',async()=>[]);
  t.mock.method(Notification,'updateOne',async(_,update)=>{notices.push(update.$setOnInsert);});
  await materializeNotificationEvent(f.events[0]);
  assert.equal(notices.length,1);
  assert.equal(notices[0].audience,'admin');
  assert.match(notices[0].body,/Please cancel my upcoming trip/);
  assert.match(notices[0].body,/14,000/);
});
