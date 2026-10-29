const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");

function browser(application, options = {}) {
  const records = new Map(), requests = [], messages = [], events = [];
  let permissionRequests = 0, registered = 0, unregistered = 0, onRegistered, onMessage;
  const identity = { sessionId: "signed-in-token", user: { id: "customer-one" } };
  const notification = { permission: "default", async requestPermission() { permissionRequests++; if (options.permission) return options.permission(notification); notification.permission = "granted"; return "granted"; } };
  class MessageChannel { constructor() { this.port1 = { close() {}, onmessage: null }; this.port2 = { channel: this }; } }
  const worker = { active: { postMessage(value, ports) { messages.push(value); const acknowledge = () => ports[0].channel.port1.onmessage({ data: { ok: true } }); if (options.workerMessage) options.workerMessage(value, acknowledge); else queueMicrotask(acknowledge); } } };
  const navigator = { serviceWorker: { async register(url, settings) { assert.equal(settings.scope, "/"); assert(url.startsWith("/firebase-messaging-sw.js?config=")); options.workerRegister?.(notification); return worker; }, ready: Promise.resolve(worker), async getRegistration() { return worker; } } };
  const window = { Notification: notification, dispatchEvent(event) { events.push(event); } };
  const sdk = { async isSupported() { return true; }, getMessaging() { return {}; },
    onRegistered(client, callback) { onRegistered = callback; return () => { onRegistered = undefined; }; },
    onMessage(client, callback) { onMessage = callback; return () => { onMessage = undefined; }; },
    async register() { registered++; onRegistered?.("c123456789012345678901"); }, async unregister() { unregistered++; },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, "../../", application, "lib/notification-push.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, { exports: module.exports, module,
    require(name) { if (name === "firebase/messaging") return sdk; if (name === "firebase/app") return { getApps: () => [], initializeApp: config => ({ options: config }) }; if (name === "@/lib/api") return { apiBaseUrl: "https://api.example.test" }; throw Error(name); },
    window, navigator, Notification: notification, crypto: crypto.webcrypto, MessageChannel, AbortSignal, Event, CustomEvent, setTimeout, clearTimeout,
    localStorage: { getItem(key) { return records.get(key) || null; }, setItem(key, value) { records.set(key, value); }, removeItem(key) { records.delete(key); } },
    async fetch(url, request) { const call = { url, ...request, parsedBody: JSON.parse(request.body) }; requests.push(call); if (options.fetch) return options.fetch(call); return { ok: true, async json() { return { data: { bindingId: "account-binding" } }; } }; },
    process: { env: { NEXT_PUBLIC_FIREBASE_API_KEY: "public-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ancient-trails-e598a", NEXT_PUBLIC_FIREBASE_APP_ID: "1:12345:web:test", NEXT_PUBLIC_FIREBASE_VAPID_KEY: "public-test-key" } },
  });
  return { api: module.exports, identity, requests, messages, records, notification, events,
    counts: () => ({ permissionRequests, registered, unregistered }), fidChanged(fid) { onRegistered?.(fid); }, foreground(data) { onMessage?.({ data }); } };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
for (const application of ["frontend", "admin"]) {
  test(application + " requests permission only after an explicit opt-in and uploads FIDs, not legacy tokens", async () => {
    const client = browser(application); client.api.resumeBrowserPush(client.identity); await tick();
    assert.equal(client.counts().permissionRequests, 0); assert.equal(client.counts().registered, 0);
    await client.api.enableBrowserPush(client.identity);
    assert.equal(client.counts().permissionRequests, 1); assert.equal(client.counts().registered, 1);
    const upload = client.requests.find(request => request.method === "POST");
    assert.equal(upload.parsedBody.fid, "c123456789012345678901"); assert.match(upload.parsedBody.deviceKey, /^[a-f0-9]{64}$/); assert.equal(upload.headers["X-Session-Id"], "signed-in-token");
    assert(client.messages.some(message => message.type === "PUSH_BINDING"));
    client.fidChanged("d123456789012345678901"); await tick();
    assert.equal(client.requests.filter(request => request.method === "POST").length, 2);
    client.foreground({ notificationId: "notice", bindingId: "wrong-binding" }); assert.equal(client.events.filter(event => event.type === "ancient-trails-notification").length, 0);
    client.foreground({ notificationId: "notice", bindingId: "account-binding" }); assert.equal(client.events.filter(event => event.type === "ancient-trails-notification").length, 1);
    await client.api.disableBrowserPush(client.identity);
    assert(client.requests.some(request => request.method === "DELETE" && request.keepalive));
    assert.equal(client.api.browserPushStatus(client.identity.user.id), "disabled");
  });
  test(application + " a sign-out during the permission dialog cannot register the previous account", async () => {
    let resolvePermission;
    const client = browser(application, { permission: () => new Promise(resolve => { resolvePermission = resolve; }) });
    const enabling = client.api.enableBrowserPush(client.identity);
    await client.api.disableBrowserPush(client.identity);
    client.notification.permission = "granted"; resolvePermission("granted"); await enabling;
    assert.equal(client.counts().registered, 0); assert.equal(client.requests.filter(request => request.method === "POST").length, 0);
  });
  test(application + " an opted-in returning browser refreshes registration without another permission prompt", async () => {
    const client = browser(application);
    client.notification.permission = "granted";
    client.records.set("ancient-trails-push:" + (application === "admin" ? "admin" : "customer") + ":enabled:" + client.identity.user.id, "true");
    client.api.resumeBrowserPush(client.identity); await tick();
    assert.equal(client.counts().permissionRequests, 0); assert.equal(client.counts().registered, 1);
    await client.api.disableBrowserPush(client.identity);
  });
  test(application + " failed server registration retries without another permission request", async () => {
    let uploads = 0;
    const client = browser(application, { fetch: async call => {
      if (call.method === "POST" && ++uploads === 1) return { ok: false };
      return { ok: true, async json() { return { data: { bindingId: "retried-binding" } }; } };
    } });
    await assert.rejects(client.api.enableBrowserPush(client.identity), /Could not register/);
    const deadline = Date.now() + 5000;
    while (client.api.browserPushStatus(client.identity.user.id) !== "enabled" && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(uploads, 2); assert.equal(client.api.browserPushStatus(client.identity.user.id), "enabled"); assert.equal(client.counts().permissionRequests, 1);
    await client.api.disableBrowserPush(client.identity);
  });
  test(application + " signing out during an in-flight upload never restores the old account binding", async () => {
    let finishUpload;
    const client = browser(application, { fetch: call => call.method === "POST" ? new Promise(resolve => { finishUpload = () => resolve({ ok: true, async json() { return { data: { bindingId: "old-binding" } }; } }); }) : Promise.resolve({ ok: true }) });
    const enabling = client.api.enableBrowserPush(client.identity); await tick();
    assert(finishUpload); const disabling = client.api.disableBrowserPush(client.identity);
    finishUpload(); await Promise.all([enabling, disabling]);
    assert(!client.messages.some(message => message.type === "PUSH_BINDING")); assert.equal(client.api.browserPushStatus(client.identity.user.id), "disabled");
  });
  test(application + " a late worker acknowledgement cannot restore opt-in after sign-out", async () => {
    let acknowledgeBinding;
    const client = browser(application, { workerMessage(value, acknowledge) { if (value.type === "PUSH_BINDING") acknowledgeBinding = acknowledge; else acknowledge(); } });
    const enabling = client.api.enableBrowserPush(client.identity); await tick();
    assert(acknowledgeBinding); const disabling = client.api.disableBrowserPush(client.identity);
    acknowledgeBinding(); await Promise.all([enabling, disabling]);
    assert.equal(client.api.browserPushStatus(client.identity.user.id), "disabled");
  });
  test(application + " permission revoked during worker setup cannot cause an automatic SDK prompt", async () => {
    const client = browser(application, { workerRegister(notification) { notification.permission = "default"; } });
    client.notification.permission = "granted";
    await assert.rejects(client.api.enableBrowserPush(client.identity, false), /permission changed/);
    assert.equal(client.counts().permissionRequests, 0); assert.equal(client.counts().registered, 0);
    await client.api.disableBrowserPush(client.identity);
  });
}
