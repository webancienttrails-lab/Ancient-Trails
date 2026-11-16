/* eslint-disable @typescript-eslint/no-require-imports -- This regression test runs directly in Node as CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function createDocument(bodyOverflow = '', rootOverflow = '', priority = '') {
  const element = value => ({style: {
    value, priority,
    getPropertyValue() { return this.value; },
    getPropertyPriority() { return this.priority; },
    setProperty(name, value, priority = '') { this.value = value; this.priority = priority; },
    removeProperty() { this.value = ''; this.priority = ''; },
  }});
  const document = {body:element(bodyOverflow),documentElement:element(rootOverflow)};
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/scroll-lock.ts'),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  vm.runInNewContext(code,{document,exports});
  return {document,lock:exports.lockDocumentScroll};
}

for (const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
  test(`loader, dashboard menu and notifications can close in order ${order}`, () => {
    const {document,lock} = createDocument();
    const release = [lock(true),lock(),lock()];
    for (let i=0;i<order.length;i++) {
      release[order[i]]();
      assert.equal(document.body.style.value,i===2?'':'hidden');
      assert.equal(document.documentElement.style.value,order.slice(0,i+1).includes(0)?'':'hidden');
    }
  });
}

test('repeated cleanup cannot release a newer overlay lock', () => {
  const {document,lock} = createDocument();
  const first=lock(); first();
  const second=lock(); first();
  assert.equal(document.body.style.value,'hidden');
  second();
  assert.equal(document.body.style.value,'');
});

test('closing all overlays restores original overflow values and priority', () => {
  const {document,lock} = createDocument('auto','scroll','important');
  const first=lock(true), second=lock(true);
  first(); second();
  assert.equal(document.body.style.value,'auto');
  assert.equal(document.documentElement.style.value,'scroll');
  assert.equal(document.body.style.priority,'important');
  assert.equal(document.documentElement.style.priority,'important');
});
