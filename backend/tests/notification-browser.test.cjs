const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function browserWorker(application, options = {}) {
  const listeners = new Map(), stores = new Map(), shown = [], opened = []; let background;
  const origin = "https://" + application + ".ancienttrails.test";
  const self = { location: { origin, href: origin + "/firebase-messaging-sw.js?config=" + encodeURIComponent(JSON.stringify({ projectId: "ancient-trails-e598a" })) },
    addEventListener(type, handler) { listeners.set(type, handler); }, skipWaiting() {},
    registration: { async showNotification(title, options) { shown.push({ title, options }); }, async getNotifications() { return []; } },
    clients: { async claim() {}, async matchAll() { return []; }, async openWindow(url) { opened.push(url); } },
  };
  const caches = { async open(name) {
    if (!stores.has(name)) stores.set(name, new Map()); const data = stores.get(name);
    return { async match(key) { return data.get(key)?.clone(); }, async put(key, value) { if (name === "ancient-trails-push-binding-v1" && options.beforeBindingPut) await options.beforeBindingPut(); data.set(key, value); }, async delete(key) { return data.delete(key); }, async keys() { return [...data.keys()]; } };
  } };
  const firebase = { initializeApp() {}, messaging() { return { onBackgroundMessage(handler) { background = handler; } }; } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../", application, "public/firebase-messaging-sw.js"), "utf8"), { self, caches, firebase, importScripts() {}, URL, Response });
  async function dispatch(type, data) { let pending; listeners.get(type)({ data, ports: [{ postMessage() {} }], waitUntil(promise) { pending = promise; } }); await pending; }
  return { self, shown, opened, dispatch, background: data => background({ data }),
    async click(data) { let pending; listeners.get("notificationclick")({ notification: { data, close() {} }, stopImmediatePropagation() {}, waitUntil(promise) { pending = promise; } }); await pending; } };
}
for (const application of ["frontend", "admin"]) {
  test(application + " background messages require the current account binding and collapse duplicate delivery", async () => {
    const worker = browserWorker(application), payload = { notificationId: "notice-one", bindingId: "account-one", title: "Ancient Trails", body: "New update", url: application === "admin" ? "/bookings/view?bookingId=one" : "/me/bookings/one" };
    await worker.background(payload); assert.equal(worker.shown.length, 0);
    await worker.dispatch("message", { type: "PUSH_BINDING", bindingId: "account-one" });
    await worker.background(payload); await worker.background(payload); assert.equal(worker.shown.length, 1);
    assert.equal(worker.shown[0].options.tag, "notice-one");
    await worker.dispatch("message", { type: "PUSH_CLEAR" });
    await worker.background({ ...payload, notificationId: "notice-two" }); assert.equal(worker.shown.length, 1);
    await worker.click(worker.shown[0].options.data); assert.equal(worker.opened.length, 0);
  });
  test(application + " push clicks reject old accounts and external URLs", async () => {
    const worker = browserWorker(application);
    await worker.dispatch("message", { type: "PUSH_BINDING", bindingId: "account-two" });
    await worker.click({ bindingId: "account-one", url: worker.self.location.origin + "/me" }); assert.equal(worker.opened.length, 0);
    await worker.click({ bindingId: "account-two", url: "https://evil.test/phishing" }); assert.equal(worker.opened.length, 0);
    await worker.click({ bindingId: "account-two", url: worker.self.location.origin + "/me" }); assert.equal(worker.opened.length, 1);
  });
  test(application + " sign-out clears a binding even if the preceding cache write is still pending", async () => {
    let releaseWrite;
    const worker = browserWorker(application, { beforeBindingPut: () => new Promise(resolve => { releaseWrite = resolve; }) });
    const binding = worker.dispatch("message", { type: "PUSH_BINDING", bindingId: "old-account" });
    await new Promise(resolve => setImmediate(resolve)); assert(releaseWrite);
    const clearing = worker.dispatch("message", { type: "PUSH_CLEAR" });
    await new Promise(resolve => setImmediate(resolve)); releaseWrite(); await Promise.all([binding, clearing]);
    await worker.background({ notificationId: "old-notice", bindingId: "old-account", title: "Old account update", url: "/me" });
    assert.equal(worker.shown.length, 0);
  });
}
