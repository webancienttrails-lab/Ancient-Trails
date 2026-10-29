"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { BookingConfirmation } from "@/lib/booking-payment";
import { downloadBookingPaymentReceipt, getBookingDocumentMessage, getBookingPaymentState } from "@/lib/booking-receipt";

export function BookingPaymentReceipt({ booking, tourName }: { booking: BookingConfirmation; tourName: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { balance, canDownloadReceipt } = getBookingPaymentState(booking);
  if (!canDownloadReceipt) return null;
  async function download() {
    if (busy) return;
    setBusy(true);
    try { await downloadBookingPaymentReceipt(booking, tourName); }
    catch (error) { toast.error("Receipt download failed", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <article className="rounded-[7px] border border-border bg-background p-3">
      <h3 className="font-sans text-[13px] font-bold text-secondary">{balance > 0 ? "Advance Payment Receipt" : "Payment Receipt"}</h3>
      <p className="mt-1 font-sans text-[11px] font-semibold text-secondary/55">{getBookingDocumentMessage(booking)}</p>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void download()} className="mt-4 w-full gap-2 px-5 font-normal">
        <Download className="size-3.5" strokeWidth={1.8} />
        {busy ? "Preparing receipt..." : "Download Payment Receipt (PDF)"}
      </Button>
    </article>
  );
}
