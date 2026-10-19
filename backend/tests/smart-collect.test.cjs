const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { Booking } = require("../dist/models/booking.model");
const { SmartCollectAccount: Accounts, SmartCollectTransfer: Transfers } = require("../dist/models/smartCollect.model");
const { verifySmartCollectSignature, smartCollectContext } = require("../dist/services/smart-collect/gateway");
const { paise, requiredInitialPayment, paymentDecision } = require("../dist/services/smart-collect/policy");
const { processBankPayment, createIdentifier, closeCompletedIdentifier } = require("../dist/services/smart-collect/collection");
const { recordAirfareCollection, assertNoSmartCollectIdentifier } = require("../dist/controllers/booking.controller");

function query(value) {
  return { then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
    session() { return Promise.resolve(value); }, select() { return this; }, lean() { return Promise.resolve(value); } };
}
function fixture(t, changes = {}) {
  const context = smartCollectContext("rzp_test_dummy");
  const booking = new Booking({
    tourId: "TOURTEST", bookingReference: "AT-D0001", departureId: "DEPTEST", totalGuest: 2, adultCount: 2, childCount: 0,
    childDetails: [], guestDetails: [], travellers: [], accommodationDetails: {},
    paymentMode: "bank_transfer", paymentStatus: "pending", bookingStatus: "payment_pending",
    paymentOption: "advance", grandTotal: 1000, subtotal: 950, gstAmount: 50, depositAmount: 400,
    amountPaid: 0, balanceAmount: 1000, heldSeatCount: 0,
    recoveryExpiresAt: new Date(Date.now() + 3600000), ...changes,
  });
  const account = new Accounts({ bookingId: booking._id, bookingReference: booking.bookingReference,
    ...context, activeKey: booking.id + ":" + context.scope, virtualAccountId: "va_dummy",
    amountRequested: 40000, expiresAt: new Date(Date.now() + 3600000), status: "active" });
  const records = new Map();
  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  let reserves = 0, restores = 0, confirmations = 0, available = true;
  let current = { id: "pay_dummy", amount: 40000, currency: "INR", status: "captured", captured: true,
    method: "bank_transfer", amount_refunded: 0, created_at: Math.floor(Date.now()/1000) };
  const remote = () => ({ id: account.virtualAccountId, status: "active", notes: {
    local_id: String(account._id), booking_id: booking.id, scope: context.scope,
  }, receivers: [{ entity: "bank_account", name: "Ancient Trails", account_number: "1234567890", ifsc: "TEST0000001" }] });
  const gateway = { ...context, async payment() { return current; },
    async transfer() { return { payment_id: current.id, virtual_account_id: account.virtualAccountId, amount: current.amount, mode: "NEFT", bank_reference: "UTR123" }; },
    async fetch() { return remote(); }, async close() { return { ...remote(), status: "closed", closed_at: Math.floor(Date.now()/1000) }; },
  };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Accounts, "createIndexes", async () => []);
  t.mock.method(Transfers, "createIndexes", async () => []);
  t.mock.method(Accounts, "findOne", filter => query(filter.scope !== context.scope ? null : account));
  t.mock.method(Accounts, "findById", () => query(account));
  t.mock.method(Booking, "findById", () => query(booking));
  t.mock.method(Transfers, "findById", id => query(records.get(id) || null));
  t.mock.method(booking, "save", async options => { assert.equal(options.session, session); return booking; });
  t.mock.method(account, "save", async () => account);
  function put(data) {
    const record = new Transfers(data);
    t.mock.method(record, "save", async () => { records.set(record.id, record); return record; });
    records.set(record.id, record);
    return record;
  }
  t.mock.method(Transfers, "create", async (items, options) => { assert.equal(options.session, session); return items.map(put); });
  t.mock.method(Transfers, "updateOne", async (filter, update) => {
    const existing = records.get(filter._id);
    if (!existing) put({ _id: filter._id, ...update.$setOnInsert, ...update.$set });
    return {};
  });
  const hooks = {
    async reserveSeats(_, count, s) { assert.equal(count, 2); assert.equal(s, session); reserves++; return available ? {} : null; },
    async restoreSeats(_, count, s) { assert.equal(s, session); restores += count; },
    recordCollection: recordAirfareCollection, notifyConfirmation() { confirmations++; },
  };
  return { booking, account, records, gateway, hooks,
    payment(values) { current = { ...current, ...values }; },
    soldOut() { available = false; },
    counts() { return { reserves, restores, confirmations }; },
    process() { return processBankPayment(String(account._id), current.id, gateway, hooks); },
  };
}

test("raw webhook signatures reject altered JSON, malformed signatures, and missing secrets", () => {
  const raw = Buffer.from('{"event":"virtual_account.credited"}'), secret = "dummy-secret";
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  verifySmartCollectSignature(raw, signature, secret);
  for (const [body, sig, key] of [[Buffer.from("{}"),signature,secret],[{},signature,secret],[raw,"bad",secret],[raw,signature,""]]) {
    assert.throws(() => verifySmartCollectSignature(body,sig,key));
  }
});
test("test/live and different merchant keys have separate scopes", () => {
  const a = smartCollectContext("rzp_test_dummy"), b = smartCollectContext("rzp_live_dummy"), c = smartCollectContext("rzp_test_other");
  assert.equal(a.environment,"test"); assert.equal(b.environment,"live");
  assert.notEqual(a.scope,b.scope); assert.notEqual(a.scope,c.scope);
  assert.throws(()=>smartCollectContext("invalid"));
});
test("pricing uses existing deposit or full total without recomputing GST or airfare", () => {
  assert.equal(requiredInitialPayment({grandTotal:1050,depositAmount:420,paymentOption:"advance"}),42000);
  assert.equal(requiredInitialPayment({grandTotal:1050,depositAmount:420,paymentOption:"full"}),105000);
  assert.equal(paise(12.34),1234); assert.throws(()=>paise(-1));
});
test("advance confirms only after accumulated partial transfers reach the required amount", async t => {
  const f=fixture(t);
  f.payment({id:"pay_first",amount:10000}); await f.process();
  assert.equal(f.booking.amountPaid,100); assert.equal(f.booking.balanceAmount,900);
  assert.equal(f.booking.bookingStatus,"payment_pending"); assert.equal(f.counts().reserves,0);
  f.payment({id:"pay_second",amount:30000}); await f.process();
  assert.equal(f.booking.amountPaid,400); assert.equal(f.booking.balanceAmount,600);
  assert.equal(f.booking.bookingStatus,"confirmed"); assert.equal(f.counts().reserves,1);
  assert.equal(f.booking.paymentStatus,"paid"); assert.ok(f.booking.confirmationToken);
  assert.equal(f.account.amountReceived,40000); assert.equal(f.records.size,2);
  assert.equal(f.booking.subtotal,950); assert.equal(f.booking.gstAmount,50);
});
test("full payment option does not confirm at just the advance threshold", async t => {
  const f=fixture(t,{paymentOption:"full"});
  await f.process(); assert.equal(f.booking.bookingStatus,"payment_pending"); assert.equal(f.counts().reserves,0);
  f.payment({id:"pay_final",amount:60000}); await f.process();
  assert.equal(f.booking.bookingStatus,"confirmed"); assert.equal(f.booking.balanceAmount,0);
});
test("replayed credits are applied and notified once", async t => {
  const f=fixture(t); await f.process(); await f.process();
  assert.equal(f.booking.amountPaid,400); assert.equal(f.account.amountReceived,40000);
  assert.equal(f.records.size,1); assert.equal(f.counts().reserves,1); assert.equal(f.counts().confirmations,1);
});
test("overpayments are tracked for review without over-crediting the booking", async t => {
  const f=fixture(t); f.payment({amount:150000}); await f.process();
  assert.equal(f.booking.amountPaid,1000); assert.equal(f.booking.balanceAmount,0);
  assert.equal(f.account.amountReceived,150000); assert.equal(f.account.amountReview,50000);
  assert.equal([...f.records.values()][0].status,"review");
});
for(const status of ["expired","cancelled"]) {
  test("funds for "+status+" bookings require review and do not reserve seats",async t=>{
    const f=fixture(t,{bookingStatus:status}); await f.process();
    assert.equal(f.booking.amountPaid,0); assert.equal(f.booking.bookingStatus,status);
    assert.equal(f.account.amountReview,40000); assert.equal(f.counts().reserves,0);
  });
}
test("payments arriving after identifier expiry are flagged for review",async t=>{
  const f=fixture(t); f.account.expiresAt=new Date(Date.now()-10000); await f.process();
  assert.equal(f.booking.amountPaid,0); assert.equal(f.account.amountReview,40000);
});
test("sold-out departures cannot be confirmed by a received bank transfer",async t=>{
  const f=fixture(t); f.soldOut(); await f.process();
  assert.equal(f.booking.bookingStatus,"payment_pending"); assert.equal(f.booking.amountPaid,0);
  assert.equal(f.account.amountReview,40000); assert.match([...f.records.values()][0].reason,/Seats unavailable/);
});
test("final and dynamic airfare credits reuse airfare history without changing totals or GST",async t=>{
  const f=fixture(t,{bookingStatus:"confirmed",paymentStatus:"paid",amountPaid:1000,grandTotal:1200,
    airFlightCharges:200,balanceAmount:200,paymentOption:"full"});
  f.payment({amount:20000}); await f.process();
  assert.equal(f.booking.grandTotal,1200); assert.equal(f.booking.gstAmount,50);
  assert.equal(f.booking.amountPaid,1200); assert.equal(f.booking.balanceAmount,0);
  assert.equal(f.counts().reserves,0); assert.equal(f.booking.collectionHistory.length,1);
  await f.process(); assert.equal(f.booking.collectionHistory.length,1);
});
test("failed transfers do not credit money or confirm a booking, and can later reconcile captured",async t=>{
  const f=fixture(t); f.payment({status:"failed",captured:false}); await f.process();
  assert.equal(f.booking.amountPaid,0); assert.equal(f.account.amountReceived,0);
  f.payment({status:"captured",captured:true}); await f.process();
  assert.equal(f.booking.amountPaid,400); assert.equal(f.records.size,1);
});
test("mismatched identifiers, amounts, ownership or environments are rejected",async t=>{
  const f=fixture(t);
  f.gateway.transfer=async()=>({payment_id:"pay_dummy",virtual_account_id:"va_wrong",amount:40000});
  await assert.rejects(f.process(),/does not match/);
  f.gateway.transfer=async()=>({payment_id:"pay_dummy",virtual_account_id:"va_dummy",amount:1});
  await assert.rejects(f.process(),/does not match/);
  await assert.rejects(processBankPayment(String(f.account._id),"pay_dummy",{...f.gateway,scope:"wrong"},f.hooks),/environment/);
  assert.equal(f.booking.amountPaid,0);
});
test("fully settled identifiers are closed at Razorpay",async t=>{
  const f=fixture(t,{bookingStatus:"confirmed",paymentStatus:"paid",amountPaid:1000,balanceAmount:0});
  await closeCompletedIdentifier(String(f.account._id),f.gateway);
  assert.equal(f.account.status,"closed"); assert.equal(f.account.activeKey,undefined);
});
test("live identifiers prevent switching checkout or changing booking prices",async t=>{
  t.mock.method(Accounts,"exists",async()=>({_id:"active"}));
  await assert.rejects(assertNoSmartCollectIdentifier("booking"),/Close and reconcile/);
});
test("ambiguous identifier creation is recovered by notes without a duplicate API POST",async t=>{
  const context=smartCollectContext("rzp_test_dummy");
  const booking=new Booking({tourId:"TOURTEST",bookingReference:"AT-D0002",grandTotal:1000,amountPaid:0,
    paymentStatus:"pending",recoveryExpiresAt:new Date(Date.now()+3600000)});
  let local, remote, creates=0;
  t.mock.method(Accounts,"createIndexes",async()=>[]);
  t.mock.method(Transfers,"createIndexes",async()=>[]);
  t.mock.method(Accounts,"findOne",async()=>local||null);
  t.mock.method(Accounts,"create",async data=>{
    local=new Accounts(data); t.mock.method(local,"save",async()=>local); return local;
  });
  const gateway={...context,
    async create(data) {creates++;remote={id:"va_recovered",status:"active",notes:data.notes,receivers:[
      {entity:"bank_account",name:"Ancient Trails",account_number:"10000001",ifsc:"TEST0000001"}]};throw Error("Connection dropped after create");},
    async list(){return[remote];}
  };
  await assert.rejects(createIdentifier(booking,40000,gateway),/unknown/);
  assert.equal(local.status,"creation_unknown");
  const recovered=await createIdentifier(booking,40000,gateway);
  assert.equal(recovered.virtualAccountId,"va_recovered"); assert.equal(creates,1);
});
test("requested bank-transfer amount cannot exceed the saved outstanding balance",async t=>{
  const f=fixture(t);
  await assert.rejects(createIdentifier(f.booking,100001,f.gateway),/outstanding/);
});

test("unexpected paise transfers are preserved for review and never rounded into booking credits",async t=>{
  const f=fixture(t); f.payment({amount:40001}); await f.process();
  assert.equal(f.booking.amountPaid,0);
  assert.equal(f.account.amountReceived,40001);
  assert.equal(f.account.amountReview,40001);
  assert.match([...f.records.values()][0].reason,/paise/);
});
test("late webhook delivery for an on-time transfer remains reconcilable after identifier closure",async t=>{
  const f=fixture(t);
  f.account.status="closed"; f.account.closedAt=new Date(Date.now()+5000);
  await f.process();
  assert.equal(f.booking.amountPaid,400);
});
test("a closed identifier never confirms transfers timestamped after closure",async t=>{
  const f=fixture(t);
  f.account.status="closed"; f.account.closedAt=new Date(Date.now()-5000);
  await f.process(); assert.equal(f.booking.amountPaid,0); assert.equal(f.account.amountReview,40000);
});
test("identifier generation alone does not set booking payment status or hold seats",async t=>{
  const f=fixture(t);
  t.mock.method(Accounts,"findOne",async()=>f.account);
  await createIdentifier(f.booking,40000,f.gateway);
  assert.equal(f.booking.paymentStatus,"pending");
  assert.equal(f.booking.bookingStatus,"payment_pending");
  assert.equal(f.booking.heldSeatCount,0);
  assert.equal(f.counts().reserves,0);
});

test("gateway errors never expose Basic Auth secrets to application logging",t=>{
  const axios=require("axios");
  const { createSmartCollectGateway, SmartCollectGatewayError }=require("../dist/services/smart-collect/gateway");
  let reject;
  t.mock.method(axios,"create",()=>({interceptors:{response:{use(_ok,error){reject=error;}}}}));
  createSmartCollectGateway("rzp_test_dummy","dummy-private-secret");
  let thrown;
  try { reject({isAxiosError:true,response:{status:401},config:{auth:{password:"dummy-private-secret"}}}); } catch(error){thrown=error;}
  assert.ok(thrown instanceof SmartCollectGatewayError);
  assert.equal(thrown.definitiveRejection,true);
  assert.equal(thrown.config,undefined);
  assert.ok(!JSON.stringify(thrown).includes("dummy-private-secret"));
});
test("customer bank details require the private booking token and never return it in detail payloads",async t=>{
  const f=fixture(t);
  f.booking.bankTransferToken="a".repeat(48);
  const bookingController=require("../dist/controllers/booking.controller");
  t.mock.method(bookingController,"getRazorpayCredentials",()=>({keyId:"rzp_test_dummy",keySecret:"dummy"}));
  t.mock.method(Accounts,"find",()=>({sort(){return this;},async lean(){return[];}}));
  t.mock.method(Transfers,"find",()=>({sort(){return this;},async lean(){return[];}}));
  const { getCustomerBankTransfer }=require("../dist/controllers/smartCollect.controller");
  const res={setHeader(){},json(value){this.body=value;}};
  await assert.rejects(getCustomerBankTransfer({params:{id:f.booking.id},query:{token:"b".repeat(48)}},res),/Invalid booking access token/);
  await getCustomerBankTransfer({params:{id:f.booking.id},query:{token:f.booking.bankTransferToken}},res);
  assert.equal(res.body.data.booking.bookingReference,"AT-D0001");
  assert.ok(!JSON.stringify(res.body).includes("a".repeat(48)));
});
test("bank instructions use one atomic send claim per channel",async t=>{
  const f=fixture(t);
  f.booking.bankTransferToken="a".repeat(48);
  f.booking.guestDetails.push({firstName:"Guest",lastName:"Test",email:"test@example.com",countryCode:"+91",mobileNumber:"9000000000"});
  const { Tour }=require("../dist/models/tour.model");
  t.mock.method(Tour,"findOne",async()=>({tourName:"Test Tour"}));
  t.mock.method(Accounts,"findOneAndUpdate",async(filter,update)=>{
    const field=Object.keys(update.$set)[0];
    if(f.account[field]!=="pending")return null;
    f.account[field]=update.$set[field];return f.account;
  });
  t.mock.method(Accounts,"updateOne",async(_filter,update)=>{Object.assign(f.account,update.$set);});
  const emails=require("../dist/services/booking-confirmation-email.service");
  const whatsapp=require("../dist/services/msg91-whatsapp.service");
  let emailCount=0,whatsappCount=0;
  t.mock.method(emails,"sendBankTransferEmail",async()=>{emailCount++;});
  t.mock.method(whatsapp,"sendBookingPaymentLinkWhatsapp",async()=>{whatsappCount++;});
  const before=process.env.FRONTEND_URL;process.env.FRONTEND_URL="https://example.com";
  t.after(()=>{if(before===undefined)delete process.env.FRONTEND_URL;else process.env.FRONTEND_URL=before;});
  const { notifyBankInstructions }=require("../dist/services/smart-collect/notifications");
  await notifyBankInstructions(String(f.account._id));
  await notifyBankInstructions(String(f.account._id));
  assert.equal(emailCount,1);assert.equal(whatsappCount,1);
});

test("initial bank drafts reuse existing pricing/reference logic, resist client payment overrides, and create no seat hold",async t=>{
  const { Tour }=require("../dist/models/tour.model");
  const { TourDeparture }=require("../dist/models/tourDeparture.model");
  const { generateOccupancyOptions }=require("../dist/services/accommodation/accommodation.generator");
  const { createSmartCollectBookingDraft }=require("../dist/controllers/booking.controller");
  const departure={
    departureId:"DEPTEST",tourId:"TOURTEST",destinationId:"DOMTEST",
    departureDate:"2040-12-13T00:00:00.000Z",returnDate:"2040-12-18T00:00:00.000Z",
    bookingDeadline:"2040-12-01T00:00:00.000Z",totalSeats:25,seatsAvailable:25,
    priceAdult:35500,priceExtraBed:31950,priceChildWithoutExtraBed:28400,singleOccupancy:44375,
    depositType:"percentage",depositValue:40,depositAppliesTo:"per_booking",balanceDueDaysBefore:30,
    status:"scheduled",childPricingRules:[],earlyBirdOffer:null,
  };
  const option=generateOccupancyOptions({adults:1,children:[],selectedDeparture:departure})[0];
  const guest={title:"Ms",firstName:"Test",lastName:"Traveller",countryCode:"+91",
    mobileNumber:"9000000000",email:"test@example.com",dateOfBirth:"1990-01-01",gender:"Female",address:"Test city"};
  const payload={tourId:"TOURTEST",departureId:"DEPTEST",selectedAccommodationOptionId:option.id,
    paymentOption:"advance",totalGuest:1,adultCount:1,childCount:0,childDetails:[],guestDetails:[guest],
    travellers:[{...guest,id:"adult-1",type:"adult"}],gstPercentage:5,
    amountPaid:999999,paymentMethod:"cash",airFlightCharges:999999};
  t.mock.method(Tour,"exists",async()=>true);
  t.mock.method(Tour,"findOne",async()=>({tourId:"TOURTEST",tourName:"Test Tour",inclusions:[],exclusions:[]}));
  t.mock.method(TourDeparture,"findOne",async()=>departure);
  const reserve=t.mock.method(TourDeparture,"findOneAndUpdate",()=>{throw Error("Draft creation must not reserve seats");});
  const saved=new Map();
  let created=0;
  t.mock.method(Booking,"findOne",filter=>query(saved.get(filter.pendingBookingKey)||null));
  t.mock.method(Booking,"create",async data=>{
    const booking=new Booking({...data,bookingReference:"AT-D0099"});
    await booking.validate();
    created++;
    saved.set(data.pendingBookingKey,booking);
    return booking;
  });
  const scope=smartCollectContext("rzp_test_dummy").scope;
  assert.equal(scope.length,64);
  const a=await createSmartCollectBookingDraft(payload,scope);
  const b=await createSmartCollectBookingDraft(payload,scope);
  assert.equal(a.id,b.id);assert.equal(created,1);assert.equal(a.bookingReference,"AT-D0099");
  assert.equal(a.amountPaid,0);assert.equal(a.airFlightCharges,0);assert.equal(a.paymentStatus,"pending");
  assert.equal(a.bookingStatus,"payment_pending");assert.equal(a.paymentMode,"bank_transfer");
  assert.equal(a.heldSeatCount,0);assert.equal(a.holdExpiresAt,null);assert.equal(reserve.mock.callCount(),0);
  assert.match(a.bankTransferToken,/^[a-f0-9]{48}$/);
  assert.equal(a.depositAmount,Math.round(a.grandTotal*0.4));
  assert.match(a.pendingBookingKey,/^bank:[a-f0-9]{64}$/);
  assert.ok(a.pendingBookingKey.length<=Booking.schema.path("pendingBookingKey").options.maxlength);
  const live=await createSmartCollectBookingDraft(payload,smartCollectContext("rzp_live_dummy").scope);
  assert.notEqual(a.pendingBookingKey,live.pendingBookingKey);
  assert.notEqual(a.id,live.id);
  assert.equal(created,2);
});

test("admin booking list identifies bank-transfer records in the current merchant scope only", async t => {
  const { listBookings } = require("../dist/controllers/booking.controller");
  const { Tour } = require("../dist/models/tour.model");
  const { BookingPaymentLinkRequest } = require("../dist/models/bookingPaymentLinkRequest.model");
  const f = fixture(t, { paymentMode: "online" });
  const other = new Booking({ ...f.booking.toObject(), _id: new mongoose.Types.ObjectId(), paymentMode: "offline" });
  const previousKey = process.env.RAZORPAY_KEY_ID;
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
  t.after(() => {
    if (previousKey === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKey;
  });
  t.mock.method(Booking, "find", () => ({ sort() { return this; }, limit() { return Promise.resolve([f.booking, other]); } }));
  t.mock.method(Tour, "find", () => query([]));
  t.mock.method(BookingPaymentLinkRequest, "find", async () => []);
  const lookup = t.mock.method(Accounts, "distinct", async (field, filter) => {
    assert.equal(field, "bookingId");
    assert.equal(filter.scope, smartCollectContext("rzp_test_dummy").scope);
    assert.deepEqual(filter.bookingId.$in.map(String), [f.booking.id, other.id]);
    return [f.booking._id];
  });
  let result;
  const response = { status(code) { assert.equal(code, 200); return this; }, json(body) { result = body; } };
  await listBookings({ query: {} }, response);
  assert.equal(lookup.mock.callCount(), 1);
  assert.equal(result.data.bookings[0].hasBankTransfer, true);
  assert.equal(result.data.bookings[0].paymentMode, "online");
  assert.equal(result.data.bookings[1].hasBankTransfer, false);
  assert.equal(result.data.bookings[1].paymentMode, "offline");
});

for (const mode of ["NEFT", "IMPS", "RTGS"]) {
  test("verified bank transfer records " + mode + " and queues confirmation only after credit", async t => {
    const f = fixture(t);
    const transfer = f.gateway.transfer.bind(f.gateway);
    f.gateway.transfer = async () => ({ ...await transfer(), mode });
    await f.process();
    assert.equal(f.booking.paymentMethod, mode.toLowerCase());
    assert.equal(f.booking.paymentProvider, "razorpay");
    assert.equal(f.counts().confirmations, 1);
    await f.process();
    assert.equal(f.counts().confirmations, 1);
  });
}
