// Preloaded by the test scripts only. Production startup never imports this file.
const net = require('node:net');
const dns = require('node:dns');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

if (process.env.NODE_ENV === 'production') {
  throw new Error('TEST SAFETY: do not run automated tests in a production process.');
}
process.env.NODE_ENV = 'test';
for (const name of Object.keys(process.env)) {
  if (/^(DATABASE_URL|MONGO.*|RAZORPAY_.*|MSG91_.*|SMTP_.*|ADMIN_PASSWORD(?:_HASH)?|FIREBASE_PRIVATE_KEY|FIREBASE_CLIENT_EMAIL|GOOGLE_APPLICATION_CREDENTIALS|JWT_SECRET|PUSH_REGISTRATION_ENCRYPTION_KEY)$/.test(name)) {
    delete process.env[name];
  }
}

function blocked(action) {
  throw new Error(`TEST SAFETY: ${action} is prohibited; mock the service instead.`);
}
mongoose.connect = () => blocked('database connections');
mongoose.createConnection = () => blocked('database connections');
mongoose.Connection.prototype.openUri = () => blocked('database connections');

// Permit only loopback servers opened by this test process, not existing local services.
const fixturePorts = new Set();
const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  let fixturePort;
  this.once('listening', () => {
    const address = this.address();
    if (address && typeof address === 'object') {
      fixturePort = address.port;
      fixturePorts.add(fixturePort);
    }
  });
  this.once('close', () => fixturePorts.delete(fixturePort));
  return originalListen.apply(this, args);
};
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = normalized[0];
  const host = typeof options === 'object' ? options.host : normalized[1];
  const port = typeof options === 'object' ? options.port : options;
  if (!['127.0.0.1', '::1', 'localhost', undefined].includes(host) || !fixturePorts.has(Number(port))) {
    return blocked('network connections outside this process\'s loopback fixtures');
  }
  return originalConnect.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) || !fixturePorts.has(Number(url.port))) {
    return blocked('external fetch requests');
  }
  return originalFetch(input, options);
};
for (const name of ['resolve', 'resolve4', 'resolve6', 'resolveMx', 'resolveTxt', 'resolveSrv']) {
  dns[name] = () => blocked('external DNS queries');
  dns.promises[name] = async () => blocked('external DNS queries');
}
nodemailer.createTransport = () => blocked('email delivery');
