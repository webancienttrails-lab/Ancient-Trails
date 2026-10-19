const assert = require("node:assert/strict");
const test = require("node:test");
const { mongo } = require("mongoose");
const { Enquiry } = require("../dist/models/enquiry.model");
const { EnquiryReferenceCounter: Counter } = require("../dist/models/enquiryReferenceCounter.model");

function service() {
  const path = require.resolve("../dist/services/enquiry-reference.service");
  delete require.cache[path];
  return require(path);
}

test("references start at EN0001, remain unique concurrently, and grow beyond 9999", async t => {
  let value = 0;
  t.mock.method(Counter, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: "enquiry" });
    assert.deepEqual(update, { $inc: { value: 1 } });
    assert.equal(options.new, true);
    return { value: ++value };
  });
  const api = service();
  const ids = await Promise.all(Array.from({ length: 100 }, () => api.allocateEnquiryReference()));
  assert.equal(ids[0], "EN0001");
  assert.equal(ids[99], "EN0100");
  assert.equal(new Set(ids).size, 100);
  value = 9999;
  assert.equal(await api.allocateEnquiryReference(), "EN10000");
});

test("concurrent first counter inserts retry safely", async t => {
  let calls = 0;
  t.mock.method(Counter, "findOneAndUpdate", async (_, __, options) => {
    if (++calls === 1) throw new mongo.MongoServerError({ code: 11000, message: "Concurrent insert" });
    assert.equal(options.upsert, undefined);
    return { value: 2 };
  });
  assert.equal(await service().allocateEnquiryReference(), "EN0002");
});

test("invalid counters cannot generate invalid references", async t => {
  t.mock.method(Counter, "findOneAndUpdate", async () => ({ value: NaN }));
  await assert.rejects(service().allocateEnquiryReference(), /could not be generated/);
});

test("backfill preserves assigned IDs, orders old enquiries, and runs once for concurrent callers", async t => {
  let value = 0;
  let findCalls = 0;
  const changes = [];
  t.mock.method(Counter, "updateOne", async (_, update) => {
    value = Math.max(value, update.$max.value);
  });
  t.mock.method(Counter, "findOneAndUpdate", async () => ({ value: ++value }));
  t.mock.method(Enquiry, "find", filter => {
    findCalls++;
    const assigned = !!filter.enquiryReference;
    const records = assigned ? [{ enquiryReference: "EN0007" }] : [{ _id: "oldest" }, { _id: "newer" }];
    const query = {
      sort(order) { assert.deepEqual(order, { createdAt: 1, _id: 1 }); return query; },
      select() { return query; }, lean() { return query; },
      async *cursor() { yield* records; },
    };
    return query;
  });
  t.mock.method(Enquiry, "updateOne", async (filter, update, options) => {
    assert.equal(options.timestamps, false);
    assert.ok(filter.$or);
    changes.push([filter._id, update.$set.enquiryReference]);
  });
  const api = service();
  await Promise.all([api.ensureEnquiryReferences(), api.ensureEnquiryReferences()]);
  await api.ensureEnquiryReferences();
  assert.equal(findCalls, 2);
  assert.deepEqual(changes, [["oldest", "EN0008"], ["newer", "EN0009"]]);
  assert.equal(await api.allocateEnquiryReference(), "EN0010");
});

test("status actions persist only the selected status and reject invalid values", async t => {
  const api = require("../dist/services/enquiry-reference.service");
  t.mock.method(api, "ensureEnquiryReferences", async () => {});
  const { updateEnquiryStatus } = require("../dist/controllers/enquiry.controller");
  const { EnquiryStatus } = require("../dist/models/enquiry.model");
  let calls = 0;
  t.mock.method(Enquiry, "findByIdAndUpdate", async (id, update, options) => {
    calls++;
    assert.equal(id, "internal-id");
    assert.deepEqual(Object.keys(update.$set), ["status"]);
    assert.equal(options.runValidators, true);
    return { _id: { toString: () => id }, enquiryReference: "EN0001", status: update.$set.status };
  });
  for (const status of [EnquiryStatus.IN_PROGRESS, EnquiryStatus.REPLIED, EnquiryStatus.CLOSED]) {
    let body;
    await updateEnquiryStatus({ params: { id: "internal-id" }, body: { status } }, { json: value => { body = value; } });
    assert.equal(body.data.enquiry.status, status);
    assert.equal(body.data.enquiry.enquiryReference, "EN0001");
  }
  assert.equal(calls, 3);
  await assert.rejects(updateEnquiryStatus({ body: { status: "Unknown" } }, {}), /Invalid enquiry status/);
  await assert.rejects(updateEnquiryStatus({ body: { status: "Closed", name: "overwrite" } }, {}), /Invalid enquiry status/);
  assert.equal(calls, 3);
});

test("a status update for a missing enquiry reports not found", async t => {
  const api = require("../dist/services/enquiry-reference.service");
  t.mock.method(api, "ensureEnquiryReferences", async () => {});
  t.mock.method(Enquiry, "findByIdAndUpdate", async () => null);
  const { updateEnquiryStatus } = require("../dist/controllers/enquiry.controller");
  await assert.rejects(updateEnquiryStatus({ params: { id: "missing" }, body: { status: "Closed" } }, {}), /Enquiry not found/);
});

test("admin referral is trimmed, saved, returned, and editable", async t => {
  const api = require("../dist/services/enquiry-reference.service");
  t.mock.method(api, "ensureEnquiryReferences", async () => {});
  t.mock.method(api, "allocateEnquiryReference", async () => "EN0001");
  const { createEnquiry, updateEnquiry } = require("../dist/controllers/enquiry.controller");
  const payload = { name: "Test Guest", email: "test@example.com", phone: "1234567890",
    subject: "Tour enquiry", message: "Hello", source: "Website", status: "New",
    socialMediaReferral: "  Instagram  " };
  t.mock.method(Enquiry, "create", async data => {
    assert.equal(data.socialMediaReferral, "Instagram");
    return new Enquiry(data);
  });
  let body;
  const response = { status() { return this; }, json(value) { body = value; } };
  await createEnquiry({ body: payload }, response);
  assert.equal(body.data.enquiry.socialMediaReferral, "Instagram");
  t.mock.method(Enquiry, "findByIdAndUpdate", async (id, data) => {
    assert.equal(id, "internal-id");
    assert.equal(data.socialMediaReferral, "Facebook");
    return new Enquiry(data);
  });
  await updateEnquiry({ params: { id: "internal-id" }, body: { ...payload, socialMediaReferral: "Facebook" } }, response);
  assert.equal(body.data.enquiry.socialMediaReferral, "Facebook");
  await assert.rejects(createEnquiry({ body: { ...payload, socialMediaReferral: "x".repeat(161) } }, response), /Validation failed/);
});

test("enquiries without a referral remain compatible", async t => {
  const api = require("../dist/services/enquiry-reference.service");
  t.mock.method(api, "ensureEnquiryReferences", async () => {});
  t.mock.method(api, "allocateEnquiryReference", async () => "EN0002");
  const { createEnquiry } = require("../dist/controllers/enquiry.controller");
  t.mock.method(Enquiry, "create", async data => new Enquiry(data));
  let body;
  const response = { status() { return this; }, json(value) { body = value; } };
  await createEnquiry({ body: { name: "Guest", email: "guest@example.com", phone: "1234567890",
    subject: "Tour", message: "", source: "Website", status: "New" } }, response);
  assert.equal(body.data.enquiry.socialMediaReferral, "");
});

test("public contact messages enter the admin inbox as new website enquiries", async t => {
  const references = require("../dist/services/enquiry-reference.service");
  t.mock.method(references, "ensureEnquiryReferences", async () => {});
  t.mock.method(references, "allocateEnquiryReference", async () => "EN0123");
  const { createPublicContactEnquiry } = require("../dist/controllers/enquiry.controller");
  const { EnquirySource, EnquiryStatus } = require("../dist/models/enquiry.model");
  const submitted = { name: "  Test Traveller  ", email: "traveller@example.com", phone: "+919876543210", subject: "Booking / Payment", message: "Please help with my booking." };
  t.mock.method(Enquiry, "create", async value => {
    assert.equal(value.name, "Test Traveller");
    assert.equal(value.source, EnquirySource.WEBSITE);
    assert.equal(value.status, EnquiryStatus.NEW);
    assert.equal(value.subject, submitted.subject);
    assert.equal(value.message, submitted.message);
    return { ...value, _id: { toString: () => "contact-id" } };
  });
  const response = { status(code) { assert.equal(code, 201); return this; }, json(body) { this.body = body; } };
  await createPublicContactEnquiry({ body: submitted }, response);
  assert.equal(response.body.data.enquiry.id, "contact-id");
  assert.equal(response.body.data.enquiry.enquiryReference, "EN0123");
});

test("public contact submissions reject invalid details and admin-only fields before writing", async t => {
  const { createPublicContactEnquiry } = require("../dist/controllers/enquiry.controller");
  t.mock.method(Enquiry, "create", () => assert.fail("Invalid contact enquiry was saved"));
  const valid = { name: "Traveller", email: "test@example.com", phone: "+919876543210", subject: "General enquiry", message: "Hello" };
  for (const overrides of [{ name: " " }, { email: "invalid" }, { phone: "123" }, { message: " " }, { subject: "" }, { message: "x".repeat(3001) }, { status: "Closed" }, { source: "Admin" }]) {
    await assert.rejects(createPublicContactEnquiry({ body: { ...valid, ...overrides } }, {}), error => error.statusCode === 400);
  }
});

