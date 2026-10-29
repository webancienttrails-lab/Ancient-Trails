"use client";

import { useEffect, useRef, useState } from "react";
import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";
import { listAdminTours, listAdminTourDepartures, type AdminTour, type AdminTourDeparture } from "@/lib/tours";

export default function TourNotificationPage() {
  const [tours, setTours] = useState<AdminTour[]>([]), [departures, setDepartures] = useState<AdminTourDeparture[]>([]);
  const [tourId, setTourId] = useState(""), [departureId, setDepartureId] = useState(""), [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [status, setStatus] = useState(""), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const requestId = useRef("");
  useEffect(() => {
    let alive = true;
    Promise.all([listAdminTours(), listAdminTourDepartures()]).then(([tourResult, departureResult]) => {
      if (alive) { setTours(tourResult.data.tours); setDepartures(departureResult.data.departures); setLoaded(true); }
    }).catch(() => { if (alive) setStatus("Could not load tours. Please refresh this page."); });
    return () => { alive = false; };
  }, []);
  const field = "w-full rounded-xl border border-primary/20 bg-white p-3";
  return <AdminDashboardShell activeLabel="Tours"><section className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-white p-5 sm:p-8">
    <h1 className="font-heading text-2xl font-bold">Send an important tour update</h1>
    <p className="my-4 text-sm text-stone-600">This update goes to registered customers with confirmed, paid bookings for the selected tour or departure, through their inbox and enabled browsers.</p>
    <form data-admin-ignore-save-reminder="true" className="space-y-5" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const session = getAdminSession(); if (!session) return;
      if (!requestId.current) requestId.current = crypto.randomUUID();
      setBusy(true); setStatus("");
      try {
        await apiRequest("/api/notifications/admin/tour-updates", { method: "POST", headers: { "X-Session-Id": session.sessionId }, body: JSON.stringify({ tourId, ...(departureId ? { departureId } : {}), title, body, requestId: requestId.current }) });
        setStatus("Update queued successfully."); setTitle(""); setBody(""); requestId.current = "";
      } catch (error) { setStatus(error instanceof Error ? error.message : "Could not send this update. Please retry."); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="space-y-5">
        <label className="block space-y-2"><span>Tour</span><select required className={field} value={tourId} onChange={event => { setTourId(event.target.value); setDepartureId(""); requestId.current = ""; }}><option value="">Select a tour</option>{tours.map(tour => <option key={tour.tourId} value={tour.tourId}>{tour.tourName}</option>)}</select></label>
        <label className="block space-y-2"><span>Departure</span><select className={field} value={departureId} onChange={event => { setDepartureId(event.target.value); requestId.current = ""; }}><option value="">All departures</option>{departures.filter(departure => departure.tourId === tourId).map(departure => <option key={departure.departureId} value={departure.departureId}>{departure.departureDate ? new Date(departure.departureDate).toLocaleDateString("en-IN") : "Dates to be announced"} ({departure.departureId})</option>)}</select></label>
        <label className="block space-y-2"><span>Title</span><input required maxLength={120} className={field} value={title} onChange={event => { setTitle(event.target.value); requestId.current = ""; }} /></label>
        <label className="block space-y-2"><span>Message</span><textarea required maxLength={1500} rows={6} className={field} value={body} onChange={event => { setBody(event.target.value); requestId.current = ""; }} /></label>
        <button type="submit" disabled={!loaded || !tourId} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send tour update"}</button>
      </fieldset>
      {status && <p role="status" className="text-sm">{status}</p>}
    </form>
  </section></AdminDashboardShell>;
}
