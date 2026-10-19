/* Public Firebase web configuration only. Credentials stay on the backend. */
/* global firebase */
"use strict";
const config = JSON.parse(new URL(self.location.href).searchParams.get("config") || "{}");
if (config.projectId !== "ancient-trails-e598a") throw new Error("Firebase project mismatch");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");
firebase.initializeApp(config);
const bindingCache = "ancient-trails-push-binding-v1";
const bindingUrl = new URL("/__ancient_trails_push_binding", self.location.origin).href;
async function currentBinding() { const cached = await (await caches.open(bindingCache)).match(bindingUrl); return cached ? cached.text() : ""; }
function safeUrl(path) { return typeof path === "string" && /^\/(me|bookings|users|tours)(\/|\?|$)/.test(path) && !path.includes("\\") && !path.includes("//") ? new URL(path, self.location.origin).href : self.location.origin; }
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
let bindingChanges = Promise.resolve();
self.addEventListener("message", event => {
  if (event.data?.type !== "PUSH_BINDING" && event.data?.type !== "PUSH_CLEAR") return;
  bindingChanges = bindingChanges.catch(() => {}).then(async () => {
    const store = await caches.open(bindingCache);
    if (event.data.type === "PUSH_BINDING") {
      if (await currentBinding() !== event.data.bindingId) for (const notification of await self.registration.getNotifications()) notification.close();
      await store.put(bindingUrl, new Response(event.data.bindingId));
    }
    else { await store.delete(bindingUrl); for (const notification of await self.registration.getNotifications()) notification.close(); }
    event.ports[0]?.postMessage({ ok: true });
  });
  event.waitUntil(bindingChanges);
});
firebase.messaging().onBackgroundMessage(async payload => {
  const data = payload.data;
  if (!data?.notificationId || !data.bindingId || await currentBinding() !== data.bindingId) return;
  const seen = await caches.open("ancient-trails-push-seen-v1"), key = new URL("/__push_seen/" + encodeURIComponent(data.notificationId), self.location.origin).href;
  if (await seen.match(key) || await currentBinding() !== data.bindingId) return;
  await self.registration.showNotification(data.title || "Ancient Trails", { body: data.body, icon: "/favicon.ico", tag: data.notificationId,
    data: { url: safeUrl(data.url), bindingId: data.bindingId } });
  if (await currentBinding() !== data.bindingId) { for (const notice of await self.registration.getNotifications({ tag: data.notificationId })) notice.close(); return; }
  await seen.put(key, new Response("1"));
  const keys = await seen.keys(); for (const old of keys.slice(0, Math.max(0, keys.length - 200))) await seen.delete(old);
});
// Data-only notices use this account-checked click handler.
self.addEventListener("notificationclick", event => {
  event.stopImmediatePropagation(); event.notification.close();
  event.waitUntil((async () => {
    if (!event.notification.data?.bindingId || await currentBinding() !== event.notification.data.bindingId) return;
    const url = new URL(event.notification.data.url || "/", self.location.origin);
    if (url.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) { if (new URL(client.url).origin === self.location.origin) { await client.navigate(url.href); await client.focus(); return; } }
    await self.clients.openWindow(url.href);
  })());
});
