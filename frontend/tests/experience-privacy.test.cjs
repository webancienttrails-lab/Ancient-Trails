const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function countFunction(file) {
  const source=ts.createSourceFile(file,fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let found;
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='getTravellerReviewCount')found=node;ts.forEachChild(node,visit);}
  visit(source);assert.ok(found);
  return vm.runInNewContext(ts.transpileModule(found.getText(source)+';getTravellerReviewCount;',{
    compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
  }).outputText);
}

test('experience review cards use the server count without needing a private email',()=>{
  const count=countFunction('app/experiences/_components/experiences-page.tsx');
  assert.equal(count({id:'review-1',travellerName:'Public name',travellerReviewCount:3},[]),3);
  assert.equal(count({id:'review-1',travellerName:'Public name'},[{id:'review-1',travellerReviewCount:2}]),2);
  assert.equal(count({id:'legacy-review'},[]),1);
});
test('destination review cards retain their count when public records contain no contact fields',()=>{
  const count=countFunction('app/destinations/_components/single-destination-page.tsx');
  assert.equal(count({id:'review-1',travellerReviewCount:4}),4);
  assert.equal(count({id:'legacy-review'}),1);
});
