"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminBankTransferPage } from "@/components/admin-bank-transfer-page";
import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";

function BankTransferRoute() {
  const bookingId = useSearchParams().get("bookingId")?.trim();

  if (!bookingId) {
    return (
      <AdminDashboardShell activeLabel="Bookings">
        <p role="alert">Select a booking to view bank transfer details.</p>
        <Link href="/bookings" className="text-sm font-semibold text-primary">
          Back to Bookings
        </Link>
      </AdminDashboardShell>
    );
  }

  return <AdminBankTransferPage key={bookingId} bookingId={bookingId} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BankTransferRoute />
    </Suspense>
  );
}
