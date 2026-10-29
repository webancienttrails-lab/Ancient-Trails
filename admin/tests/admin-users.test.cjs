const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '../app/users/page.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const mapping = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'toUserRecord');
const compiled = ts.transpileModule(mapping.getText(source) + '\nmodule.exports=toUserRecord;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mappingModule = { exports: {} }; vm.runInNewContext(compiled, { module: mappingModule, exports: mappingModule.exports });
const toUserRecord = mappingModule.exports;
const base = { id: 'fixture-one', firstName: '', lastName: '', email: '', mobileNumber: '910000000000', roles: ['traveller'], status: 'active', createdAt: '2026-10-22T00:00:00Z' };

test('mobile-only OTP accounts have a visible label and avatar initials', () => {
  const record = toUserRecord(base); assert.equal(record.name, 'Profile incomplete'); assert.equal(record.initials, 'TR'); assert.equal(record.phone, base.mobileNumber);
});
test('completed profiles retain their name and initials', () => {
  const record = toUserRecord({ ...base, firstName: ' Fixture ', lastName: ' Traveller ' }); assert.equal(record.name, 'Fixture Traveller'); assert.equal(record.initials, 'FT');
});
test('multiple email-less records preserve distinct account IDs', () => {
  const rows = [base, { ...base, id: 'fixture-two' }].map(toUserRecord); assert.notEqual(rows[0].id, rows[1].id);
});
test('status changes map back into the displayed status', () => {
  assert.equal(toUserRecord({ ...base, status: 'blocked' }).status, 'Inactive'); assert.equal(toUserRecord(base).status, 'Active');
});
test('update API sends selected user ID, actual changes and existing admin authentication', async () => {
  const calls = [], module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/users.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === '@/lib/api') return { apiRequest: async (...args) => calls.push(args) };
    if (name === '@/lib/admin-auth') return { getAdminSession: () => ({ sessionId: 'fixture-admin-token' }) };
    throw Error(name);
  } });
  await module.exports.updateAdminUser('fixture-one', { status: 'blocked' });
  const [url, options] = calls[0]; assert.equal(url, '/api/admin/users/fixture-one'); assert.equal(options.method, 'PATCH');
  assert.equal(options.headers['X-Session-Id'], 'fixture-admin-token'); assert.deepEqual(JSON.parse(options.body), { status: 'blocked' });
});
