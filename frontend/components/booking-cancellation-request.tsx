"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getCancellationPreview, requestBookingCancellation, type CancellationPreview, type CancellationRequest } from "@/lib/booking-cancellation";
import type { BookingConfirmation } from "@/lib/booking-payment";

export function BookingCancellationRequestControl({ booking, departureDate, disabled }: {
  booking: BookingConfirmation; departureDate?: string | null; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [record, setRecord] = useState<CancellationRequest | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const upcoming = Boolean(departureDate && new Date(departureDate).getTime() > Date.now()
    && !["cancelled", "expired", "draft"].includes(booking.bookingStatus || ""));
  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: booking.paymentCurrency || "INR", maximumFractionDigits: 2 }).format(value);
  async function showPreview() {
    setOpen(true); setBusy(true); setMessage(""); setPreview(null);
    try {
      const result = await getCancellationPreview(booking.id);
      setPreview(result.data); setRecord(result.data.existingRequest);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load the cancellation estimate."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !preview?.canRequest || record || reason.trim().length < 5) return;
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const result = await requestBookingCancellation(booking.id, reason.trim(), preview.quoteHash);
      setRecord(result.data.request); setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit. Please try again.");
      if (error instanceof ApiError && error.statusCode === 409) {
        try { setPreview((await getCancellationPreview(booking.id)).data); } catch { setPreview(null); }
      }
    } finally { submitting.current = false; setBusy(false); }
  }
  if (!upcoming) return null;
  const estimate = record?.estimate || preview?.estimate;
  return (
    <div>
      <Button type="button" variant="outline" disabled={disabled || busy || Boolean(record)} onClick={() => void showPreview()}>
        {record ? "Cancellation requested" : "Request cancellation"}
      </Button>
      <Link href="/terms-and-conditions#cancellation-policy" className="ml-3 font-sans text-[12px] font-semibold text-brand-text underline">Cancellation policy</Link>
      {open ? (
        <div role="dialog" aria-modal="true" aria-labelledby="cancellation-request-title" className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-y-auto bg-secondary/50 p-4">
          <form onSubmit={submit} className="my-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-lg bg-white p-5 text-secondary shadow-xl">
            <h2 id="cancellation-request-title" className="font-heading text-2xl font-bold">Request cancellation</h2>
            <p className="text-sm">Review the estimate before sending your request. Our team handles cancellation and any refund manually. Submitting this request does not cancel your booking automatically.</p>
            {estimate ? (
              <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                <p>Days before departure: <strong>{estimate.daysBeforeDeparture}</strong></p>
                <p>Recorded payments: <strong>{money(estimate.amountPaid)}</strong></p>
                <p>Cancellation charge: <strong>{estimate.cancellationCharge === null ? "Requires team review" : money(estimate.cancellationCharge) + " (" + estimate.chargePercentage + "%)"}</strong></p>
                <p>Non-refundable GST: <strong>{money(estimate.nonRefundableGst)}</strong></p>
                <p>Estimated refund: <strong>{estimate.estimatedRefund === null ? "Our team must confirm the amount" : money(estimate.estimatedRefund)}</strong></p>
                <table className="w-full text-left"><caption className="text-left font-semibold">Applicable policy bands</caption><thead><tr><th>Days before departure</th><th>Charge</th></tr></thead><tbody>{estimate.policyRows.map((row, index) => <tr key={index}><td>{row.days}</td><td>{row.charge}</td></tr>)}</tbody></table>
                {estimate.notes.map(note => <p key={note} className="text-xs text-secondary/70">{note}</p>)}
              </div>
            ) : busy ? <p role="status">Loading estimate...</p> : null}
            {message ? <p role="status" className="rounded border border-primary/20 bg-primary/5 p-3 text-sm">{message}</p> : null}
            {record ? <p role="status" className="text-sm font-semibold">Your cancellation request is recorded and awaiting team review. No refund has been issued automatically.</p> : preview && !preview.canRequest ? <p className="text-sm">This booking is not eligible for an online cancellation request. Please contact our team.</p> : preview ? (
              <label className="block text-sm font-semibold">Reason for cancellation<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded border border-border p-2" /></label>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{record ? "Close" : "Keep my booking"}</Button>
              {!record && preview?.canRequest ? <Button type="submit" disabled={busy || reason.trim().length < 5}>{busy ? "Sending..." : "Send cancellation request"}</Button> : null}
              <Link href="/terms-and-conditions#cancellation-policy" className="self-center text-sm text-brand-text underline">Read cancellation policy</Link>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
