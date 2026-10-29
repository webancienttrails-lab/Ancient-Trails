"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getAdminSession as getSession, listenForAdminSessionChanges as listenForSessionChanges } from "@/lib/admin-auth";
import { browserPushStatus, disableBrowserPush, enableBrowserPush, resumeBrowserPush } from "@/lib/notification-push";

const audience = "admin";
type Notice = { _id: string; title: string; body: string; url: string; readAt: string | null; createdAt: string };
type Inbox = { notifications: Notice[]; unreadCount: number; nextCursor: string | null };
export function NotificationBell() {
  const [open, setOpen] = useState(false), [inbox, setInbox] = useState<Inbox>({ notifications: [], unreadCount: 0, nextCursor: null });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [push, setPush] = useState("disabled"), [unreadOnly, setUnreadOnly] = useState(false);
  const button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), version = useRef(0);
  const request = useCallback(async <T,>(path = "", options: RequestInit = {}) => {
    const session = getSession(); if (!session) throw new Error("Please sign in to view notifications.");
    return apiRequest<T>("/api/notifications/" + audience + path, { ...options, headers: { "X-Session-Id": session.sessionId } });
  }, []);
  const load = useCallback(async (cursor?: string) => {
    const session = getSession(), epoch = version.current; if (!session) return;
    try {
      const result = await request<Inbox>("?unreadOnly=" + unreadOnly + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
      if (epoch !== version.current || getSession()?.user.id !== session.user.id) return;
      setInbox(previous => ({ ...result.data, notifications: cursor ? [...previous.notifications, ...result.data.notifications.filter(item => !previous.notifications.some(old => old._id === item._id))] : result.data.notifications })); setError("");
    } catch (failure) { if (epoch === version.current) setError(failure instanceof Error ? failure.message : "Could not load notifications."); }
  }, [request, unreadOnly]);
  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    const sync = () => { version.current++; setInbox({ notifications: [], unreadCount: 0, nextCursor: null }); setOpen(false); const session = getSession(); if (session) { resumeBrowserPush(session); setPush(browserPushStatus(session.user.id)); void latestLoad.current(); } else { void disableBrowserPush(); setPush("disabled"); } };
    const refresh = () => { if (document.visibilityState === "visible") { void latestLoad.current(); const session = getSession(); if (session) setPush(browserPushStatus(session.user.id)); } };
    const stop = listenForSessionChanges(sync); const initialSync = setTimeout(sync, 0);
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); window.addEventListener("ancient-trails-notification", refresh); window.addEventListener("ancient-trails-push-status", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(initialSync); stop(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("ancient-trails-notification", refresh); window.removeEventListener("ancient-trails-push-status", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); };
  }, [open]);
  async function update(id: string, read: boolean) {
    try { await request("/" + id + "/read", { method: "PATCH", body: JSON.stringify({ read }) }); await load(); } catch { setError("Could not update this notification. Please retry."); }
  }
  async function togglePush() {
    const session = getSession(); if (!session) return;
    setBusy(true); setError("");
    try { if (push === "enabled") await disableBrowserPush(session); else await enableBrowserPush(session); setPush(browserPushStatus(session.user.id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not enable browser notifications."); } finally { setBusy(false); }
  }
  const close = () => { setOpen(false); button.current?.focus(); };
  return <>
    <button ref={button} type="button" className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-white text-primary shadow-sm hover:bg-orange-50" aria-label={"Notifications, " + inbox.unreadCount + " unread"} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(!open); void load(); }}>
      <Bell className="size-5" />{inbox.unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-xs font-bold text-white">{inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}</span>}
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[400] flex justify-end bg-black/25" onClick={close}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={"notification-title-" + audience} tabIndex={-1} className="flex h-[100dvh] w-full max-w-md flex-col bg-white text-stone-900 shadow-2xl outline-none" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-primary/20 p-5"><h2 id={"notification-title-" + audience} className="font-heading text-xl font-bold">Notifications</h2><button type="button" onClick={close} aria-label="Close notifications"><X className="size-5" /></button></div>
        <div className="flex items-center justify-between gap-3 border-b p-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} />Unread only</label><button type="button" className="flex items-center gap-1 text-primary disabled:opacity-50" disabled={!inbox.unreadCount} onClick={() => { void request("/read-all", { method: "PATCH" }).then(() => load()).catch(() => setError("Could not mark notifications read.")); }}><CheckCheck className="size-4" />Mark all read</button></div>
        {error && <div role="alert" className="bg-orange-50 p-4 text-sm">{error} <button type="button" className="underline" onClick={() => { void load(); }}>Retry inbox</button></div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
          {!inbox.notifications.length && <p className="p-6 text-sm text-stone-500">{error ? "Your inbox is temporarily unavailable." : "You’re all caught up. New updates will appear here."}</p>}
          {inbox.notifications.map(notice => <article key={notice._id} className={"border-b border-stone-100 p-4 " + (!notice.readAt ? "bg-orange-50/70" : "")}>
            <Link href={notice.url} onClick={() => { void update(notice._id, true); close(); }} className="block rounded focus-visible:outline-primary"><p className="flex items-center gap-2 font-semibold">{!notice.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" />}{notice.title}</p><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{notice.body}</p><time dateTime={notice.createdAt} className="mt-2 block text-xs text-stone-500">{new Date(notice.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></Link>
            <button type="button" className="mt-2 text-xs font-semibold text-primary" onClick={() => { void update(notice._id, !notice.readAt); }}>Mark as {notice.readAt ? "unread" : "read"}</button>
          </article>)}
          {inbox.nextCursor && <button type="button" className="w-full p-4 text-sm text-primary" onClick={() => { void load(inbox.nextCursor!); }}>Load more</button>}
        </div>
        <div className="space-y-2 border-t bg-[#fbf8f5] p-4 text-sm"><Link href="/notifications/tour-update" onClick={close} className="block font-semibold text-primary">Send an important tour update</Link><p className="text-stone-600">{push === "blocked" ? "Notifications are blocked. You can allow them in your browser settings." : push === "unsupported" ? "Browser push is unavailable on this device. Your inbox still works." : "Receive updates on this browser, even when Ancient Trails is closed."}</p><button type="button" disabled={busy || push === "unsupported" || push === "blocked"} onClick={() => { void togglePush(); }} className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary disabled:opacity-50">{busy ? "Please wait…" : push === "enabled" ? "Disable browser notifications" : "Enable browser notifications"}</button></div>
      </div>
    </div>, document.body)}
  </>;
}
