const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminReport, getReportPeriod } = require('../dist/services/reports.service');
const now = new Date('2026-10-30T10:00:00Z');
const booking = (changes = {}) => ({ tourId:'A', departureId:'D1', createdAt:new Date('2026-10-10T10:00:00Z'), bookingStatus:'confirmed', paymentStatus:'paid', paymentCurrency:'INR', amountPaid:20000, totalGuest:2, ...changes });
const fixture = changes => ({ days:30, now, bookings:[], tours:[], departures:[], enquiries:[], ...changes });

test('reports use verified payments, actual booking dates, real categories and current seat counts', () => {
  const report = buildAdminReport(fixture({
    bookings:[booking(),booking({amountPaid:5000,totalGuest:1}),booking({tourId:'B',departureId:'D2',paymentStatus:'pending',amountPaid:0,totalGuest:3,grandTotal:900000}),booking({tourId:'B',paymentCurrency:'USD',amountPaid:100,totalGuest:1}),booking({bookingStatus:'cancelled',amountPaid:999999}),booking({bookingStatus:'draft'}),booking({paymentStatus:'refunded'}),booking({paymentStatus:'failed'}),booking({createdAt:new Date('2026-09-10T10:00:00Z'),amountPaid:10000,totalGuest:1})],
    tours:[{tourId:'A',tourName:'Heritage tour',category:'Heritage',tourType:'Long Trails'},{tourId:'B',tourName:'Custom tour',category:'Customised',tourType:'Long Trails'}],
    departures:[{departureId:'D1',tourId:'A',totalSeats:20,seatsAvailable:5}],
    enquiries:['New','In Progress','In Progress','Replied','Closed'].map(status=>({status,createdAt:new Date('2026-10-10')})),
  }));
  assert.equal(report.metrics.revenue.value,25000);
  assert.equal(report.metrics.revenue.previous,10000);
  assert.equal(report.metrics.revenue.change,150);
  assert.equal(report.metrics.bookings.value,4);
  assert.equal(report.metrics.travellers.value,7);
  assert.equal(report.metrics.openEnquiries.value,4);
  assert.equal(report.enquiryTotal,5);
  assert.equal(report.closedPercentage,20);
  assert.deepEqual(report.pipeline.map(item=>[item.status,item.count]),[['New',1],['In Progress',2],['Replied',1],['Closed',1]]);
  assert.equal(report.categories.length,1);
  assert.equal(report.categories[0].name,'Heritage');
  assert.equal(report.categories[0].percentage,100);
  assert.equal(report.categories[0].revenue,25000);
  assert.equal(report.excludedCurrencyBookings,1);
  assert.equal(report.topTours[0].bookings,2);
  assert.equal(report.topTours[0].fillRate,75, 'A departure capacity is counted only once across its bookings');
  assert.equal(report.topTours[1].fillRate,null);
  assert.equal(report.trend.reduce((sum,point)=>sum+point.bookings,0),4);
  assert.equal(report.trend.reduce((sum,point)=>sum+point.revenue,0),25000);
});

test('IST period boundaries do not double count bookings or include records beyond the period',()=>{
  const period=getReportPeriod(30,now);
  assert.equal(period.start.toISOString(),'2026-09-30T18:30:00.000Z');
  assert.equal(period.end.toISOString(),'2026-10-30T18:30:00.000Z');
  const report=buildAdminReport(fixture({bookings:[booking({createdAt:period.start,amountPaid:10}),booking({createdAt:new Date(period.start-1),amountPaid:20}),booking({createdAt:period.end,amountPaid:30})]}));
  assert.equal(report.metrics.bookings.value,1);
  assert.equal(report.metrics.revenue.value,10);
  assert.equal(report.metrics.revenue.previous,20);
});

test('every date range covers its period with contiguous buckets and honest empty states',()=>{
  for(const days of [30,90,180,365]){
    const report=buildAdminReport(fixture({days}));
    assert.equal(report.trend[0].start,report.period.start);
    assert.equal(report.trend.at(-1).end,report.period.end);
    report.trend.forEach((point,index)=>{assert.equal(point.bookings,0);assert.equal(point.revenue,0);if(index)assert.equal(point.start,report.trend[index-1].end);});
    assert.equal(report.metrics.revenue.change,0);
    assert.deepEqual(report.categories,[]);
    assert.deepEqual(report.topTours,[]);
    assert.equal(report.closedPercentage,0);
  }
  const report=buildAdminReport(fixture({bookings:[booking({tourId:'missing'})]}));
  assert.equal(report.categories[0].name,'Uncategorised');
  assert.equal(report.metrics.revenue.change,null,'No percentage is invented for a zero baseline');
});

test('report endpoint rejects invalid ranges before reading data and remains protected by admin middleware',async t=>{
  const {Booking}=require('../dist/models/booking.model');
  const {getAdminReport}=require('../dist/controllers/reports.controller');
  const find=t.mock.method(Booking,'find',()=>{throw Error('Unexpected read');});
  for(const days of ['0','31','100000','abc',['30','90']])await assert.rejects(getAdminReport({query:{days}},{}),error=>error.statusCode===400);
  assert.equal(find.mock.callCount(),0);
  const router=require('../dist/routes/dashboard.routes').default;
  const {requireAdmin}=require('../dist/middleware/adminAuth');
  assert.equal(router.stack[0].handle,requireAdmin);
  assert.ok(router.stack.some(layer=>layer.route?.path==='/reports'));
});

test('report endpoint projects report-only fields and returns non-cacheable live data',async t=>{
  const {Booking}=require('../dist/models/booking.model');
  const {Tour}=require('../dist/models/tour.model');
  const {TourDeparture}=require('../dist/models/tourDeparture.model');
  const {Enquiry}=require('../dist/models/enquiry.model');
  const {getAdminReport}=require('../dist/controllers/reports.controller');
  const projections=[];
  for(const model of [Booking,Tour,TourDeparture,Enquiry])t.mock.method(model,'find',()=>({select(fields){projections.push(fields);return{lean:async()=>[]};}}));
  const response={setHeader(key,value){assert.equal(key,'Cache-Control');assert.equal(value,'private, no-store');},status(code){assert.equal(code,200);return this;},json(body){this.body=body;}};
  await getAdminReport({query:{days:'90'}},response);
  assert.equal(response.body.success,true);
  assert.equal(response.body.data.days,90);
  assert.ok(projections.every(fields=>!/(email|phone|guestDetails|message)/.test(fields)));
});
