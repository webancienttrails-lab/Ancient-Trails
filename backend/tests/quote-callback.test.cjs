const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const references = require("../dist/services/enquiry-reference.service");
const { Enquiry } = require("../dist/models/enquiry.model");
const { SiteSettings } = require("../dist/models/siteSettings.model");
const { createPublicCallbackEnquiry } = require("../dist/controllers/enquiry.controller");
const { getSiteSettings, updateSiteSettings } = require("../dist/controllers/siteSettings.controller");
const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test("callback requests save a new website enquiry without requiring an email", async t => {
  t.mock.method(references, "ensureEnquiryReferences", async () => {});
  t.mock.method(references, "allocateEnquiryReference", async () => "EN0001");
  const create = t.mock.method(Enquiry, "create", async payload => new Enquiry(payload));
  const res = response();
  await createPublicCallbackEnquiry({ body: { name: "  Test Traveller  ", phone: "+919876543210" } }, res);
  assert.equal(res.statusCode, 201);
  const saved = create.mock.calls[0].arguments[0];
  assert.equal(saved.name, "Test Traveller");
  assert.equal(saved.email, "");
  assert.equal(saved.phone, "+919876543210");
  assert.equal(saved.status, "New");
  assert.equal(saved.source, "Website");
  assert.equal(res.body.data.enquiry.enquiryReference, "EN0001");
});

test("invalid callback payloads are rejected before any database write", async t => {
  const create = t.mock.method(Enquiry, "create", async () => { throw Error("Must not write"); });
  for (const body of [
    { name: " ", phone: "+919876543210" },
    { name: "Traveller", phone: "9876543210" },
    { name: "Traveller", phone: "+123" },
    { name: "Traveller", phone: "+919876543210", status: "Closed" },
  ]) {
    await assert.rejects(createPublicCallbackEnquiry({ body }, response()), error => error.statusCode === 400);
  }
  assert.equal(create.mock.callCount(), 0);
});

test("admin assistance heading persists and is exposed in public settings with the saved contact", async t => {
  const contact = { emailId: "help@example.com", primaryCalling: "+919876543210", officeAddress: "Pune" };
  let stored = new SiteSettings({ key: "site", contact });
  t.mock.method(SiteSettings, "findOneAndUpdate", async (_filter, update) => {
    if (update.$set) stored = new SiteSettings({ ...update.$set, _id: new mongoose.Types.ObjectId() });
    return stored;
  });
  const res = response();
  await updateSiteSettings({ body: { contact, quoteAssistanceTitle: "  Talk to our travel team  " } }, res);
  await getSiteSettings({}, res);
  assert.equal(res.body.data.settings.quoteAssistanceTitle, "Talk to our travel team");
  assert.equal(res.body.data.settings.contact.emailId, contact.emailId);
  assert.equal(res.body.data.settings.contact.primaryCalling, contact.primaryCalling);
  await assert.rejects(updateSiteSettings({ body: { contact, quoteAssistanceTitle: " " } }, response()), error => error.statusCode === 400);
});
