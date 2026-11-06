const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/enquiries/page.tsx"), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "sendReply") handler = node.getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler);
const code = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;

function setup(overrides = {}) {
  const saved = [];
  const opened = [];
  const errors = [];
  const enquiry = { id: "enquiry-1", phone: "98765 43210", replies: [] };
  const state = {
    replyingEnquiry: enquiry,
    replyText: " Discussed travel dates and pricing. ",
    isSavingReply: false,
    enquiries: [enquiry],
    viewingEnquiry: enquiry,
    toast: { success() {}, error: (...args) => errors.push(args) },
    window: { open: (...args) => opened.push(args) },
    toEnquiryRecord: (enquiry) => enquiry,
    addAdminEnquiryReply: async (id, message) => {
      saved.push({ id, message });
      return { data: { enquiry: { ...enquiry, status: "Replied", replies: [{ message, sentAt: "2026-11-04T00:00:00Z" }] } } };
    },
    ...overrides,
  };
  for (const key of ["replyingEnquiry", "replyText", "isSavingReply", "enquiries", "viewingEnquiry"]) {
    state[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => {
      state[key] = typeof value === "function" ? value(state[key]) : value;
    };
  }
  vm.runInNewContext(code, state);
  return { state, saved, opened, errors };
}

test("phone call notes are saved and labelled in history without opening WhatsApp", async () => {
  const { state, saved, opened } = setup();
  await state.sendReply("phone");
  assert.deepEqual(saved, [{ id: "enquiry-1", message: "Phone Call:\nDiscussed travel dates and pricing." }]);
  assert.equal(opened.length, 0);
  assert.equal(state.enquiries[0].replies[0].message, saved[0].message);
  assert.equal(state.viewingEnquiry.replies[0].message, saved[0].message);
  assert.equal(state.replyingEnquiry, null);
  assert.equal(state.replyText, "");
  assert.equal(state.isSavingReply, false);
});

test("existing WhatsApp action saves the reply and opens the same WhatsApp link", async () => {
  const { state, saved, opened } = setup();
  await state.sendReply();
  assert.equal(saved[0].message, "Discussed travel dates and pricing.");
  assert.equal(opened[0][0], "https://wa.me/9876543210?text=Discussed%20travel%20dates%20and%20pricing.");
  assert.equal(opened[0][2], "noopener,noreferrer");
});

test("failed note saves keep the text available for retry and do not open another app", async () => {
  const { state, opened, errors } = setup({ addAdminEnquiryReply: async () => { throw Error("Save failed"); } });
  await state.sendReply("phone");
  assert.equal(errors.length, 1);
  assert.equal(opened.length, 0);
  assert.equal(state.replyingEnquiry.id, "enquiry-1");
  assert.equal(state.replyText, " Discussed travel dates and pricing. ");
  assert.equal(state.isSavingReply, false);
});

test("empty, duplicate-in-progress and oversized notes are not submitted", async () => {
  for (const overrides of [{ replyText: "  " }, { isSavingReply: true }, { replyText: "a".repeat(3000) }]) {
    const { state, saved, opened } = setup(overrides);
    await state.sendReply("phone");
    assert.equal(saved.length, 0);
    assert.equal(opened.length, 0);
  }
});
