"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, Landmark, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getBankTransfer, type BankTransferData } from "@/lib/bank-transfer";

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
export function BankTransferPage({ bookingId, token }: { bookingId: string; token: string }) {
  const toast = useToast();
  const [data, setData] = useState<BankTransferData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData((await getBankTransfer(bookingId, token)).data); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load bank details"); }
  }, [bookingId, token]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  const account = data?.accounts.find(item => item.status === "active") || data?.accounts[0];
  const expired = !!account && new Date(account.expiresAt).getTime() <= Date.now();
  const closedBooking = ["cancelled", "expired"].includes(data?.booking.bookingStatus || "");
  const payable = Math.min(data?.outstandingAmount || 0, Math.max(0, (account?.amountRequested || 0) - (account?.amountApplied || 0)));
  async function copyField(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label + " copied");
    } catch {
      toast.error("Unable to copy", "Please copy the bank details manually.");
    }
  }
  async function copy() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText([
        "Booking ID: " + account.bookingReference, "Beneficiary: " + account.beneficiaryName,
        "Virtual Account Number: " + account.accountNumber, "IFSC: " + account.ifsc,
        "Payable Amount: " + money(payable), "Transfer using NEFT / RTGS / IMPS",
        "Valid until: " + new Date(account.expiresAt).toLocaleString("en-IN"),
      ].join("\n"));
      toast.success("Details copied");
    } catch { toast.error("Unable to copy", "Please copy the bank details manually."); }
  }
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="font-heading text-3xl font-bold text-secondary">Bank Transfer</h1><p className="mt-1 text-sm text-secondary/65">NEFT / RTGS / IMPS</p></div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Check Status</Button>
        </div>
        {error ? <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-700">{error}</p> : null}
        {!data && !error ? <p>Loading bank details...</p> : null}
        {data ? (
          <>
            <div className="grid gap-3 rounded-[10px] border border-border bg-card p-5 sm:grid-cols-3">
              <div><p className="text-xs text-secondary/60">Booking ID</p><strong>{data.booking.bookingReference}</strong></div>
              <div><p className="text-xs text-secondary/60">Verified Amount Paid</p><strong>{money(data.booking.amountPaid)}</strong></div>
              <div><p className="text-xs text-secondary/60">Outstanding Balance</p><strong>{money(data.outstandingAmount)}</strong></div>
            </div>
            <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
              Booking status: <strong>{data.booking.bookingStatus.replaceAll("_", " ")}</strong>.
              {data.booking.bookingStatus !== "confirmed" && !closedBooking ? " Bank details alone do not confirm your booking. Seats remain subject to availability until the required payment is verified." : ""}
              {data.environment === "test" ? " Test mode: do not send real money to these details." : ""}
            </p>
            {account?.accountNumber ? (
              <section className="overflow-hidden rounded-[10px] border border-border bg-card">
                <h2 className="flex items-center gap-2 border-b border-border bg-[#fff8f1] p-5 font-heading text-xl font-bold"><Landmark className="size-5 text-primary" /> Transfer Details</h2>
                <dl className="grid gap-5 p-5 sm:grid-cols-2">
                  {[
                    ["Beneficiary Name", account.beneficiaryName], ["Virtual Account Number", account.accountNumber],
                    ["IFSC", account.ifsc], ["Bank", account.bankName], ["Booking ID", account.bookingReference],
                    ["Payable Amount", money(payable)], ["Valid Until", new Date(account.expiresAt).toLocaleString("en-IN")],
                    ["Identifier Status", expired ? "Expired" : account.status],
                  ].map(([label, value]) => <div key={label}>
                    <dt className="text-xs font-semibold text-secondary/55">{label}</dt>
                    <dd className="mt-1 flex items-center gap-2 font-semibold">
                      <span className="min-w-0 break-all">{value || "-"}</span>
                      {["Beneficiary Name", "Virtual Account Number", "IFSC", "Bank"].includes(label) ? (
                        <button
                          type="button"
                          aria-label={"Copy " + label}
                          title={value && value !== "-" ? "Copy " + label : label + " unavailable"}
                          disabled={!value || value === "-"}
                          onClick={() => void copyField(label, value)}
                          className="inline-flex shrink-0 items-center justify-center rounded p-1 text-secondary/55 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Copy className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </dd>
                  </div>)}
                </dl>
                <div className="space-y-3 border-t border-border p-5 text-sm leading-relaxed text-secondary/75">
                  <p>Add the beneficiary in your banking app and pay using NEFT, RTGS or IMPS. These bank details belong only to this booking. Include the Booking ID in your transfer remarks.</p>
                  <p>Pay only the displayed payable amount. Bank transfers may take time to arrive. Do not repeat a transfer while its status is pending.</p>
                  <p>Do not transfer after expiry or closure. Late or excess payments require admin review and do not automatically confirm a booking.</p>
                  {expired || account.status !== "active" || closedBooking ? <p className="font-semibold text-red-700">These bank details are closed or expired. Contact our team before sending funds.</p> : (
                    <Button onClick={() => void copy()}><Copy className="size-4" /> Copy Details</Button>
                  )}
                </div>
              </section>
            ) : account ? <p className="rounded-lg border border-border p-5 text-sm">{account.error || "Your bank identifier is being reconciled. Please contact our team if details do not appear."}</p> : null}
            {data.transfers.length ? <section className="space-y-3 rounded-[10px] border border-border bg-card p-5"><h2 className="font-heading text-xl font-bold">Transfer History</h2>
              {data.transfers.map(item => <div key={item.paymentId} className="space-y-1 border-t border-border py-3 text-sm"><p className="font-semibold">{money(item.amount)} - {item.status}</p><p className="break-all text-xs text-secondary/60">{item.mode} / {item.utr || item.paymentId} / {new Date(item.receivedAt).toLocaleString("en-IN")}</p><p>Applied: {money(item.amountApplied)}{item.amountReview > 0 ? " / Under review: " + money(item.amountReview) : ""}</p>{item.reason ? <p className="text-amber-700">{item.reason}</p> : null}</div>)}
            </section> : null}
            {data.confirmationUrl ? <Link href={data.confirmationUrl} className="inline-block font-semibold text-primary underline">View Booking Confirmation</Link> : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
