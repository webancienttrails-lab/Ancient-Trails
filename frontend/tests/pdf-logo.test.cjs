const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { jsPDF } = require("jspdf");

const moduleExports = {};
const source = fs.readFileSync(path.join(__dirname, "../lib/pdf-image.ts"), "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: moduleExports });
const { addContainedPdfImage } = moduleExports;

test("wide, square and portrait logos fit their PDF header without distortion or clipping", () => {
  for (const [width, height] of [[900, 300], [300, 300], [300, 900]]) {
    for (const align of ["left", "center", "right"]) {
      const box = { x: 24, y: 29, width: 145, height: 46, align };
      let actual;
      addContainedPdfImage({
        getImageProperties: () => ({ width, height, fileType: "PNG" }),
        addImage: (...args) => { actual = args; },
      }, "logo", box);
      const [, , x, y, w, h] = actual;
      assert.ok(Math.abs(w / h - width / height) < 1e-10);
      assert.ok(x >= box.x && y >= box.y);
      assert.ok(x + w <= box.x + box.width + 1e-10);
      assert.ok(y + h <= box.y + box.height + 1e-10);
      assert.ok(Math.abs(w - box.width) < 1e-10 || Math.abs(h - box.height) < 1e-10);
      if (align === "right") assert.ok(Math.abs(x + w - box.x - box.width) < 1e-10);
    }
  }
});

test("the real brand logo embeds at its original proportions in every PDF header size", () => {
  const pdf = new jsPDF({ unit: "pt" });
  const logo = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "../public/Header Logo.png")).toString("base64");
  const original = pdf.getImageProperties(logo);
  const addImage = pdf.addImage.bind(pdf);
  const placements = [];
  pdf.addImage = (...args) => { placements.push(args); return addImage(...args); };
  for (const [width, height] of [[145, 46], [102, 31], [100, 48], [145, 45]]) {
    addContainedPdfImage(pdf, logo, { x: 26, y: 30, width, height });
    pdf.addPage();
  }
  for (const [, , , , width, height] of placements) {
    assert.ok(Math.abs(width / height - original.width / original.height) < 1e-10);
  }
  assert.ok(pdf.output("arraybuffer").byteLength > 1000);
});
