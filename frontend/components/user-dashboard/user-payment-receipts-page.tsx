"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { clearTravellerSession } from "@/lib/auth";
import { listTravellerBookings, listTravellerPaymentReceipts, getUserBookingReference, type UserBooking, type UserPaymentReceipt } from "@/lib/user-bookings";
import { defaultSiteContactSettings, getPublicSiteSettings, type SiteContactSettings } from "@/lib/site-settings";
import { createTravellerPaymentReceiptPdf, paymentReceiptDate, paymentReceiptMoney, paymentReceiptDetails } from "@/lib/payment-receipt-document";

function ReceiptPanel({ title, lines }: { title: string; lines: string[] }) {
  return <section className="rounded-[8px] border border-[#e8ded6] p-4">
    <h3 className="mb-3 text-[11px] font-bold uppercase text-[#0f172a]">{title}</h3>
    <div className="space-y-1 break-words text-[11px] leading-relaxed text-[#334155]">{lines.map((line, index) => <p key={index} className="whitespace-pre-line">{line}</p>)}</div>
  </section>;
}

export function UserPaymentReceiptsPage({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<UserBooking | null>(null);
  const [receipts, setReceipts] = useState<UserPaymentReceipt[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [contact, setContact] = useState<SiteContactSettings>(defaultSiteContactSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();
  const receipt = receipts.find((item) => item.id === selectedId) || receipts[0];

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [bookingsResponse, receiptsResponse, settings] = await Promise.all([
          listTravellerBookings(), listTravellerPaymentReceipts(bookingId), getPublicSiteSettings().catch(() => null),
        ]);
        if (!mounted) return;
        const found = bookingsResponse.data.bookings.find((item) => item.booking.id === bookingId);
        if (!found) { setError("Booking not found for this account."); return; }
        setBooking(found); setReceipts(receiptsResponse.data.receipts);
        if (settings) setContact(settings.data.settings.contact);
      } catch (cause) {
        if (cause instanceof ApiError && cause.statusCode === 401) clearTravellerSession();
        if (mounted) setError(cause instanceof Error ? cause.message : "Payment receipts could not be loaded.");
      } finally { if (mounted) setLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, [bookingId]);

  async function download() {
    if (!booking || !receipt || downloading) return;
    setDownloading(true);
    try {
      const pdf = await createTravellerPaymentReceiptPdf(booking, receipt, contact);
      pdf.save(receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, "_") + "-Payment-Receipt.pdf");
    } catch (cause) { toast.error("Receipt download failed", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setDownloading(false); }
  }

  const details = booking && receipt ? paymentReceiptDetails(booking, receipt, contact) : null;
  return <div className="space-y-5">
    <Link href={`/me/bookings/${encodeURIComponent(bookingId)}`} className={buttonVariants({ variant: "outline", className: "gap-2" })}><ArrowLeft className="size-4" />Back to Booking</Link>
    <section className="rounded-[8px] border border-border bg-white p-5">
      <h1 className="font-heading text-[26px] font-bold text-secondary">Payment Receipts</h1>
      <p className="mt-2 text-sm text-secondary/65">View and download a receipt for each successful payment, including advances.</p>
      {loading ? <p className="mt-5 text-sm" role="status">Loading payment receipts...</p> : error ? <p className="mt-5 text-sm text-red-700" role="alert">{error}</p> : !receipts.length ? <p className="mt-5 text-sm text-secondary/65">No successful payments have been recorded for this booking yet.</p> : (
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-secondary/60"><th className="p-2">Receipt</th><th className="p-2">Payment Date</th><th className="p-2">Payment</th><th className="p-2">Amount Received</th><th className="p-2">Action</th></tr></thead>
          <tbody>{receipts.map((item) => <tr key={item.id} className={item.id === receipt?.id ? "bg-primary/5" : ""}>
            <td className="p-2 font-semibold">{item.receiptNumber}</td><td className="p-2">{paymentReceiptDate(item.paidAt)}</td><td className="p-2">{item.description}<span className="block text-xs text-secondary/60">{item.method}</span></td><td className="p-2 font-semibold">{paymentReceiptMoney(item.amount, item.currency)}</td>
            <td className="p-2"><Button type="button" variant="outline" disabled={downloading} onClick={() => setSelectedId(item.id)} className="gap-2 px-3 text-xs"><FileText className="size-3.5" />{item.id === receipt?.id ? "Viewing" : "View Receipt"}</Button></td>
          </tr>)}</tbody></table></div>
      )}
    </section>
    {!loading && !error && booking && receipt && details ? <>
      <div className="flex justify-end"><Button type="button" onClick={download} disabled={downloading} className="gap-2"><Download className="size-4" />{downloading ? "Downloading..." : "Download Receipt"}</Button></div>
      <article className="mx-auto w-full max-w-[900px] space-y-3 rounded-[8px] border border-[#e8ded6] bg-white p-4 text-[#18314f] sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[#e8ded6] pb-4">
          <SiteLogo alt="Ancient Trails" width={240} height={110} className="h-auto w-[240px] object-contain" />
          <div className="min-w-0 text-right text-[11px]"><h2 className="text-[20px] font-bold uppercase text-[#d47220]">Payment Receipt</h2><p className="mt-2 break-all font-semibold">{receipt.receiptNumber}</p><p>Payment Date: {paymentReceiptDate(receipt.paidAt)}</p><p>Booking ID: {getUserBookingReference(booking)}</p></div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2"><ReceiptPanel title="Ancient Trails" lines={details.company} /><ReceiptPanel title="Bill To" lines={details.customer} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><ReceiptPanel title="Tour Details" lines={details.tour} /><ReceiptPanel title="Payment Details" lines={details.payment} /></div>
        <div className="overflow-x-auto rounded-[8px] border border-[#e8ded6]"><table className="w-full text-[11px]"><thead className="bg-[#f1f5f9]"><tr><th className="p-3 text-left">Description</th><th className="p-3 text-right">Amount Received</th></tr></thead><tbody><tr><td className="p-3 font-semibold">{receipt.description}</td><td className="p-3 text-right font-bold">{paymentReceiptMoney(receipt.amount, receipt.currency)}</td></tr></tbody></table></div>
        <div className="grid gap-3 sm:grid-cols-2"><ReceiptPanel title="Note" lines={[details.note]} /><ReceiptPanel title="Totals" lines={details.totals} /></div>
        <div className="py-3 text-right text-[11px]"><p className="font-semibold">For Ancient Trails</p><p className="mt-10">Authorized Signatory</p></div>
        <p className="text-center text-[10px] text-[#64748b]">Thank you for travelling with Ancient Trails.</p>
      </article>
    </> : null}
  </div>;
}
