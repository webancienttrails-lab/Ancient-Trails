"use client";

import { getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported, onMessage, onRegistered, register, unregister } from "firebase/messaging";
import { apiBaseUrl } from "@/lib/api";

type Identity = { token: string; user: { id: string } };
const audience = "customer";
const prefix = "ancient-trails-push:" + audience + ":";
let activeUser = "", generation = 0, stopRegistration: (() => void) | undefined, stopMessage: (() => void) | undefined;
let registration: ServiceWorkerRegistration | undefined;
let uploadTimer: ReturnType<typeof setTimeout> | undefined;
let pushOperation: Promise<void> = Promise.resolve();

function deviceKey() {
  let key = localStorage.getItem(prefix + "device");
  if (!key) { key = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join(""); localStorage.setItem(prefix + "device", key); }
  return key;
}
function config() {
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const value = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || appId?.split(":")[1] };
  if (value.projectId !== "ancient-trails-e598a" || !value.apiKey || !value.appId || !value.messagingSenderId) throw new Error("Browser notifications are not configured yet.");
  return value;
}
async function messaging() {
  if (!await isSupported()) throw new Error("Browser notifications are not supported on this device.");
  const value = config(), app = getApps()[0] || initializeApp(value);
  if (app.options.projectId !== value.projectId) throw new Error("Firebase project configuration does not match.");
  return getMessaging(app);
}
async function workerMessage(type: string, bindingId = "") {
  const worker = registration || await navigator.serviceWorker.getRegistration("/");
  const target = worker?.active;
  if (!target) return;
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel(), timer = setTimeout(() => reject(new Error("Notification worker did not respond. Please retry.")), 5000);
    channel.port1.onmessage = () => { clearTimeout(timer); channel.port1.close(); resolve(); };
    target.postMessage({ type, bindingId }, [channel.port2]);
  });
}
export function browserPushStatus(userId: string) {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && localStorage.getItem(prefix + "enabled:" + userId) === "true" ? "enabled" : "disabled";
}
async function enableBrowserPushNow(identity: Identity, epoch: number) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Browser notifications are not supported on this device.");
  if (epoch !== generation) return;
  activeUser = identity.user.id;
  stopRegistration?.(); stopMessage?.(); clearTimeout(uploadTimer);
  const value = config(), client = await messaging();
  registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js?config=" + encodeURIComponent(JSON.stringify(value)), { scope: "/" });
  await navigator.serviceWorker.ready;
  if (epoch !== generation) return;
  let currentFid = "", uploadChain: Promise<void> = Promise.resolve();
  const enqueueUpload = (fid: string, attempt = 0) => {
    const task = uploadChain.catch(() => {}).then(() => upload(fid, attempt));
    uploadChain = task; return task;
  };
  const upload = async (fid: string, attempt = 0): Promise<void> => {
    if (epoch !== generation || activeUser !== identity.user.id || fid !== currentFid) return;
    try {
      const response = await fetch(apiBaseUrl + "/api/notifications/" + audience + "/registrations", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + identity.token },
        body: JSON.stringify({ fid, deviceKey: deviceKey() }), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Could not register this browser. Please retry.");
      const result = await response.json();
      if (epoch !== generation || fid !== currentFid) return;
      clearTimeout(uploadTimer); uploadTimer = undefined;
      localStorage.setItem(prefix + "binding", result.data.bindingId);
      await workerMessage("PUSH_BINDING", result.data.bindingId);
      if (epoch !== generation || fid !== currentFid) return;
      localStorage.setItem(prefix + "enabled:" + identity.user.id, "true");
      window.dispatchEvent(new Event("ancient-trails-push-status"));
    } catch (error) {
      if (epoch === generation && attempt < 5) uploadTimer = setTimeout(() => { uploadTimer = undefined; void enqueueUpload(fid, attempt + 1).catch(() => {}); }, Math.min(60000, 2000 * 2 ** attempt));
      if (attempt === 0) throw error;
    }
  };
  let resolveInitial!: () => void, rejectInitial!: (error: unknown) => void;
  const initialUpload = new Promise<void>((resolve, reject) => { resolveInitial = resolve; rejectInitial = reject; });
  const initialTimeout = setTimeout(() => rejectInitial(new Error("Browser registration is taking longer than expected. Please retry.")), 20000);
  void initialUpload.catch(() => {});
  stopRegistration = onRegistered(client, fid => { currentFid = fid; clearTimeout(uploadTimer); uploadTimer = undefined; void enqueueUpload(fid).then(resolveInitial, rejectInitial); });
  stopMessage = onMessage(client, payload => {
    if (epoch !== generation || payload.data?.bindingId !== localStorage.getItem(prefix + "binding")) return;
    // The open inbox refreshes silently; background delivery is handled by the worker.
    window.dispatchEvent(new CustomEvent("ancient-trails-notification", { detail: payload.data.notificationId }));
  });
  try {
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) throw new Error("The notification public key is not configured yet.");
    if (Notification.permission !== "granted") throw new Error("Browser notification permission changed. Please enable notifications again.");
    await Promise.race([register(client, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration }), initialUpload]);
    await initialUpload;
  } finally { clearTimeout(initialTimeout); }
}
export async function enableBrowserPush(identity: Identity, askPermission = true) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Browser notifications are not supported on this device.");
  const epoch = ++generation;
  // This is the only permission prompt, and is invoked by the Enable button.
  if (Notification.permission !== "granted") {
    if (!askPermission || await Notification.requestPermission() !== "granted") throw new Error("Allow notifications in your browser settings to enable push updates.");
  }
  if (epoch !== generation) return;
  const task = pushOperation.catch(() => {}).then(() => enableBrowserPushNow(identity, epoch));
  pushOperation = task;
  try { await task; } catch (error) { if (epoch === generation && !uploadTimer) { activeUser = ""; ++generation; stopRegistration?.(); stopMessage?.(); } throw error; }
}
export function resumeBrowserPush(identity: Identity) {
  if (activeUser === identity.user.id) return;
  if (browserPushStatus(identity.user.id) === "enabled" && Notification.permission === "granted") void enableBrowserPush(identity, false).catch(() => {});
  else void disableBrowserPush();
}
export function disableBrowserPush(identity?: Identity) {
  ++generation; activeUser = ""; stopRegistration?.(); stopMessage?.(); stopRegistration = undefined; stopMessage = undefined; clearTimeout(uploadTimer);
  localStorage.removeItem(prefix + "binding");
  if (identity) {
    localStorage.removeItem(prefix + "enabled:" + identity.user.id);
    void fetch(apiBaseUrl + "/api/notifications/" + audience + "/registrations", { method: "DELETE", keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + identity.token }, body: JSON.stringify({ deviceKey: deviceKey() }),
    }).catch(() => {});
  }
  const clear = workerMessage("PUSH_CLEAR").catch(() => {});
  window.dispatchEvent(new Event("ancient-trails-push-status"));
  const task = pushOperation.catch(() => {}).then(async () => { await clear; try { await unregister(await messaging()); } catch { /* The inbox remains available offline. */ } });
  pushOperation = task;
  return task;
}
