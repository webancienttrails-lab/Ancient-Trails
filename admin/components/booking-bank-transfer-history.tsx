"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminBankTransfer, updateBankTransferIdentifier, type BankTransferData } from "@/lib/bank-transfer";
import { useToast } from "@/components/ui/toast";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
const statusLabels: Record<string, string> = {
  applied: "Verified", review: "Needs review", failed: "Failed", pending: "Pending",
};

export function BookingBankTransferHistory({
  bookingId,
  hasBankTransfer,
}: {
  bookingId: string;
  hasBankTransfer: boolean;
}) {
  const [data, setData] = useState<BankTransferData | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const actionInProgress = useRef(false);
  const loadVersion = useRef(0);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setLoading(true);
    async function load() {
      if (actionInProgress.current) return;
      const version = ++loadVersion.current;
      try {
        const response = await getAdminBankTransfer(bookingId);
        if (active && version === loadVersion.current) { setData(response.data); setError(""); }
      } catch (err) {
        if (active && version === loadVersion.current) setError(err instanceof Error ? err.message : "Unable to load bank transfers.");
      } finally {
        if (active && version === loadVersion.current) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      loadVersion.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [bookingId, refreshKey]);

  async function updateIdentifier(accountId: string, action: "refresh" | "close") {
    if (actionInProgress.current) return;
    if (action === "close" && !window.confirm("Close this bank-transfer identifier? In-flight transfers will still be reconciled.")) return;
    actionInProgress.current = true;
    loadVersion.current++;
    setBusy(true);
    try {
      const response = await updateBankTransferIdentifier(bookingId, accountId, action);
      setData(response.data);
      setError("");
      toast.success(response.message);
    } catch (err) {
      toast.error("Bank transfer update failed", err instanceof Error ? err.message : "Please retry");
    } finally {
      actionInProgress.current = false;
      setBusy(false);
      setLoading(false);
    }
  }

  if (!hasBankTransfer && !error && !data?.accounts.length && !data?.transfers.length) return null;

  return (
    <section className="grid min-w-0 gap-4 rounded-sm border border-border bg-muted/10 p-4 sm:col-span-2" aria-label="Bank transfer history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Bank Transfer History</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={loading || busy} onClick={() => setRefreshKey(key => key + 1)} className="h-9 rounded-sm px-3 text-xs font-bold">
            <RefreshCw className="size-4" /> Refresh History
          </Button>
          {(hasBankTransfer || Boolean(data?.accounts.length) || Boolean(data?.transfers.length)) ? (
            <Link href={"/bookings/bank-transfer/?bookingId=" + encodeURIComponent(bookingId)} className="text-xs font-bold text-primary hover:underline">
              View Bank Details
            </Link>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-foreground/55">Loading bank transfers...</p> : null}
      {data ? (
        <>
          {data.accounts.map(account => (
            <article key={account.id} className="min-w-0 rounded-[12px] border border-border bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="min-w-0 break-words font-heading text-lg font-semibold">
                  Identifier {account.virtualAccountId || account.id} - {account.status}
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={busy || loading} onClick={() => void updateIdentifier(account.id, "refresh")} className="h-9 rounded-full border-primary px-3 text-sm font-semibold text-primary">
                    Refresh Status
                  </Button>
                  {account.status !== "closed" && account.status !== "failed" ? (
                    <Button type="button" variant="outline" disabled={busy || loading} onClick={() => void updateIdentifier(account.id, "close")} className="h-9 rounded-full border-primary px-3 text-sm font-semibold text-primary">
                      Close Identifier
                    </Button>
                  ) : null}
                </div>
              </div>
              <dl className="mt-5 grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Beneficiary", account.beneficiaryName || "Pending"],
                  ["Virtual Account Number", account.accountNumber || "Pending"],
                  ["IFSC", account.ifsc || "Pending"],
                  ["Requested", money(account.amountRequested)],
                  ["Amount Received", money(account.amountReceived)],
                  ["Applied", money(account.amountApplied)],
                  ["Under Review", money(account.amountReview)],
                  ["Expires", new Date(account.expiresAt).toLocaleString("en-IN")],
                  ["Instructions (Email / WhatsApp)", account.emailInstructionStatus + " / " + account.whatsappInstructionStatus],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-foreground/50">{label}</dt>
                    <dd className="mt-1 break-words font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {account.error ? <p className="mt-4 text-sm text-amber-700">{account.error}</p> : null}
            </article>
          ))}
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-foreground/55">Received by bank transfer</p><strong>{money(data.accounts.reduce((sum, account) => sum + account.amountReceived, 0))}</strong></div>
            <div><p className="text-xs text-foreground/55">Outstanding balance</p><strong>{money(data.outstandingAmount)}</strong></div>
            <div><p className="text-xs text-foreground/55">Bank transfers needing review</p><strong>{money(data.accounts.reduce((sum, account) => sum + account.amountReview, 0))}</strong></div>
          </div>
          {data.transfers.length ? (
            <div className="overflow-x-auto rounded-sm border border-border bg-white">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-muted/40">
                  <tr>{["Date & Time", "Payment ID / UTR", "Mode", "Amount", "Applied to Booking", "Needs Review", "Status"].map(label => <th key={label} scope="col" className="px-3 py-3 font-bold">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {data.transfers.map(transfer => (
                    <tr key={transfer.paymentId} className="border-t border-border">
                      <td className="px-3 py-3">{new Date(transfer.receivedAt).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3"><span className="block font-semibold">{transfer.paymentId}</span><span className="mt-1 block text-foreground/55">UTR: {transfer.utr || "Awaiting bank reference"}</span></td>
                      <td className="px-3 py-3 uppercase">{transfer.mode || "Bank Transfer"}</td>
                      <td className="px-3 py-3 font-bold text-primary">{money(transfer.amount)}</td>
                      <td className="px-3 py-3">{money(transfer.amountApplied)}</td>
                      <td className="px-3 py-3">{money(transfer.amountReview)}</td>
                      <td className="max-w-xs px-3 py-3"><span className={transfer.status === "applied" ? "font-bold text-emerald-700" : transfer.status === "failed" ? "font-bold text-red-700" : "font-bold text-amber-700"}>{statusLabels[transfer.status] || transfer.status}</span>{transfer.reason ? <span className="mt-1 block text-foreground/55">{transfer.reason}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-foreground/55">No bank transfers received yet. Generating bank details does not count as payment.</p>}
        </>
      ) : null}
    </section>
  );
}
