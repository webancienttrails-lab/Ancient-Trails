const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/production-safety.cjs');

test('test guard refuses an inherited production environment', () => {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const result = spawnSync(process.execPath, ['--require', path.join(__dirname, 'helpers/production-safety.cjs'), '-e', ''], {
    env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TEST SAFETY: do not run automated tests in a production process/);
});

test('test guard prevents real database, provider, email and existing local service access', async () => {
  const mongoose = require('mongoose');
  const net = require('node:net');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.throws(() => mongoose.connect('mongodb://127.0.0.1/fixture'), /TEST SAFETY/);
  assert.throws(() => mongoose.createConnection('mongodb://127.0.0.1/fixture'), /TEST SAFETY/);
  assert.throws(() => net.connect(27017, '127.0.0.1'), /TEST SAFETY/);
  assert.throws(() => net.connect(443, 'api.razorpay.com'), /TEST SAFETY/);
  await assert.rejects(fetch('https://api.razorpay.com/v1/orders'), /TEST SAFETY/);
  await assert.rejects(fetch('https://control.msg91.com/api/v5/otp'), /TEST SAFETY/);
  await assert.rejects(require('node:dns').promises.resolveMx('example.com'), /TEST SAFETY/);
  assert.throws(() => require('nodemailer').createTransport({}), /TEST SAFETY/);
});

test('test guard permits HTTP fixtures opened by the same test process', async t => {
  const http = require('node:http');
  const server = http.createServer((_request, response) => response.end('fixture'));
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await response.text(), 'fixture');
});
