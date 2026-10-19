"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { apiRequest } from "@/lib/api";
import { getTravellerSession } from "@/lib/auth";
type Notice = { title: string; body: string; createdAt: string };
export default function CustomerNotificationPage() {
  const { id } = useParams<{ id: string }>();
  const [notice, setNotice] = useState<Notice | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let alive = true; const session = getTravellerSession(); if (!session) return;
    const headers = { Authorization: "Bearer " + session.token };
    apiRequest<{ notification: Notice }>("/api/notifications/customer/" + encodeURIComponent(id), { headers }).then(result => {
      if (alive && getTravellerSession()?.user.id === session.user.id) { setNotice(result.data.notification); void apiRequest("/api/notifications/customer/" + encodeURIComponent(id) + "/read", { method: "PATCH", headers, body: JSON.stringify({ read: true }) }).catch(() => {}); }
    }).catch(() => { if (alive) setError("This notification is unavailable."); });
    return () => { alive = false; };
  }, [id]);
  return <><DashboardTopBar /><main className="mx-auto max-w-3xl px-5 py-12"><Link href="/me/bookings" className="text-primary">My bookings</Link><article className="mt-6 rounded-2xl border border-primary/20 bg-white p-6"><h1 className="font-heading text-2xl font-bold">{notice?.title || "Booking update"}</h1>{notice && <><time className="mt-2 block text-sm text-stone-500">{new Date(notice.createdAt).toLocaleString("en-IN")}</time><p className="mt-5 whitespace-pre-line leading-relaxed">{notice.body}</p></>}{error && <p role="alert" className="mt-4">{error}</p>}{!notice && !error && <p className="mt-4">Loading your update?</p>}</article></main></>;
}
