const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../app/settings/page.tsx"), "utf8");
const parsed = ts.createSourceFile("settings.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let saveFunction;
function find(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "saveTaxes") saveFunction = node.getText(parsed);
  ts.forEachChild(node, find);
}
find(parsed);
const code = ts.transpileModule(saveFunction, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
function setup(taxes, loaded = true) {
  const calls = [];
  const context = { taxes, settingsLoaded: loaded, isTaxSaving: false,
    setIsTaxSaving: value => calls.push(["saving", value]), setTaxes: value => calls.push(["taxes", value]),
    toast: { error: (...args) => calls.push(["error", ...args]), success: (...args) => calls.push(["success", ...args]) },
    updateAdminTaxSettings: async payload => { calls.push(["save", payload]); return { data: { settings: { taxes: payload } } }; },
  };
  vm.createContext(context); vm.runInContext(code, context);
  return { calls, async save() { await context.saveTaxes({ preventDefault() {} }); } };
}

test("tax settings save SGST, CGST and TCS independently of general settings", async () => {
  const f = setup({ sgstPercentage: "3.25", cgstPercentage: "4.5", tcsPercentage: "0" });
  await f.save();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call[0] === "save")[1])), {
    sgstPercentage: 3.25, cgstPercentage: 4.5, tcsPercentage: 0,
  });
  assert.ok(f.calls.some(call => call[0] === "success"));
  assert.equal(f.calls.at(-1)[1], false);
});

test("invalid or unloaded tax settings cannot be submitted", async () => {
  const valid = { sgstPercentage: "2.5", cgstPercentage: "2.5", tcsPercentage: "2" };
  for (const taxes of [
    { ...valid, sgstPercentage: "" }, { ...valid, tcsPercentage: "-1" },
    { ...valid, tcsPercentage: "101" }, { ...valid, tcsPercentage: "1.234" },
    { ...valid, sgstPercentage: "60", cgstPercentage: "50" },
  ]) {
    const f = setup(taxes); await f.save();
    assert.ok(f.calls.some(call => call[0] === "error"));
    assert.equal(f.calls.some(call => call[0] === "save"), false);
  }
  const f = setup(valid, false); await f.save();
  assert.equal(f.calls.length, 0);
});
