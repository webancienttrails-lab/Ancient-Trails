const test = require("node:test");
const assert = require("node:assert/strict");
const { FaqPage } = require("../dist/models/faqPage.model");
const { getFaqPage, updateFaqPage, faqPagePayloadSchema } = require("../dist/controllers/faqPage.controller");
const { defaultFaqCategories } = require("../dist/data/faq-defaults");
const { adminFaqPageRoutes, publicFaqPageRoutes } = require("../dist/routes/faqPage.routes");
const { requireAdmin } = require("../dist/middleware/adminAuth");
const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test("the FAQ page preserves all existing questions and supplies all requested subjects before the first save", async t => {
  t.mock.method(FaqPage, "findOne", async filter => { assert.deepEqual(filter, { pageKey: "faq" }); return null; });
  const writes = t.mock.method(FaqPage, "create", () => { throw Error("Reading FAQs must not create or overwrite content"); });
  const res = response(); await getFaqPage({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.faq.categories.map(category => category.title), ["General FAQ", "Air/Train Booking", "Booking / Payment", "Cancellation / Refunds", "Hotels", "Food", "Local Transport", "Passport/VISA/Insurance"]);
  assert.equal(res.body.data.faq.categories.reduce((sum, category) => sum + category.items.length, 0), 28);
  assert.equal(writes.mock.callCount(), 0);
  assert(defaultFaqCategories[0].items.find(item => item.question.includes("Things/clothes") || item.question.includes("things/clothes")).answer.includes("Medicines"));
});

test("saved subject and question edits, order and multiline answers survive a reload", async t => {
  const categories = [
    { id: "passport", title: "Passport/VISA/Insurance", items: [{ id: "q-2", question: "Documents?", answer: "Passport\n\nInsurance copies" }, { id: "q-1", question: "Documents?", answer: "Ask the team." }] },
    { id: "general", title: "General FAQ", items: [] },
  ];
  let stored;
  t.mock.method(FaqPage, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { pageKey: "faq" }); assert.equal(options.runValidators, true); assert.equal(options.upsert, true);
    stored = new FaqPage({ pageKey: "faq", categories: update.$set.categories }); return stored;
  });
  t.mock.method(FaqPage, "findOne", async () => stored);
  const saved = response(); await updateFaqPage({ body: { categories } }, saved);
  const loaded = response(); await getFaqPage({}, loaded);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.body.data.faq.categories)), categories);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.body.data.faq.categories)), categories);
});

test("removing all FAQs persists an empty page rather than restoring the default questions", async t => {
  t.mock.method(FaqPage, "findOneAndUpdate", async () => new FaqPage({ pageKey: "faq", categories: [] }));
  t.mock.method(FaqPage, "findOne", async () => new FaqPage({ pageKey: "faq", categories: [] }));
  const res = response(); await updateFaqPage({ body: { categories: [] } }, res);
  await getFaqPage({}, res); assert.equal(res.body.data.faq.categories.length, 0);
});

test("invalid FAQ saves do not write data or replace the existing page", async t => {
  const write = t.mock.method(FaqPage, "findOneAndUpdate", () => { throw Error("Invalid data must not be saved"); });
  const valid = { id: "general", title: "General FAQ", items: [{ id: "q1", question: "Question?", answer: "Answer" }] };
  for (const body of [ {}, { categories: [{ ...valid, title: " " }] },
    { categories: [{ ...valid, items: [{ ...valid.items[0], answer: " " }] }] },
    { categories: [valid, valid] },
    { categories: [{ ...valid, items: [valid.items[0], valid.items[0]] }] },
    { categories: [{ ...valid, items: [{ ...valid.items[0], answer: "a".repeat(8001) }] }] },
  ]) await assert.rejects(updateFaqPage({ body }, response()), error => error.statusCode === 400);
  assert.equal(write.mock.callCount(), 0);
});

test("FAQ limits apply across subjects and titles, questions and answers are trimmed", () => {
  const subject = { id: "s1", title: " General FAQ ", items: [{ id: "q1", question: " Question? ", answer: " Answer " }] };
  const parsed = faqPagePayloadSchema.parse({ categories: [subject] });
  assert.equal(parsed.categories[0].title, "General FAQ"); assert.equal(parsed.categories[0].items[0].answer, "Answer");
  const categories = Array.from({ length: 6 }, (_, category) => ({ id: "s" + category, title: "Subject", items: Array.from({ length: 100 }, (_, index) => ({ id: "q" + category + "-" + index, question: "Question?", answer: "Answer" })) }));
  assert.equal(faqPagePayloadSchema.safeParse({ categories }).success, false);
});

test("FAQ editing uses the existing admin guard and public routes are read-only", async () => {
  assert.equal(adminFaqPageRoutes.stack[0].handle, requireAdmin);
  let error; await adminFaqPageRoutes.stack[0].handle({ headers: {} }, {}, value => { error = value; });
  assert.equal(error.statusCode, 401);
  assert.deepEqual(publicFaqPageRoutes.stack.filter(layer => layer.route).map(layer => Object.keys(layer.route.methods)), [["get"]]);
});
