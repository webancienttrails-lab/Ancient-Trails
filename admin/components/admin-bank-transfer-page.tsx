"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createAdminBankTransfer, getAdminBankTransfer, updateBankTransferIdentifier, type BankTransferData, type BankTransferRequest } from "@/lib/bank-transfer";
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);
export function AdminBankTransferPage({ bookingId }: { bookingId: string }) {
  const toast = useToast();
  const [data, setData] = useState<BankTransferData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState<BankTransferRequest["purpose"]>("final");
  const [amount, setAmount] = useState("");
  const load = useCallback(async () => {
    try { setData((await getAdminBankTransfer(bookingId)).data); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load bank transfers"); }
  }, [bookingId]);
  useEffect(() => { void load(); }, [load]);
  async function action(id: string, method: "refresh" | "close") {
    if (method === "close" && !window.confirm("Close this bank-transfer identifier? In-flight transfers will still be reconciled.")) return;
    setBusy(true);
    try {
      const response = await updateBankTransferIdentifier(bookingId, id, method);
      setData(response.data); toast.success(response.message);
    } catch (err) { toast.error("Bank transfer update failed", err instanceof Error ? err.message : "Please retry"); }
    finally { setBusy(false); }
  }
  async function create() {
    setBusy(true);
    try {
      const response = await createAdminBankTransfer(bookingId, { purpose, ...(purpose === "partial" ? { amount: Number(amount) } : {}) });
      setData(response.data); toast.success("Bank details ready");
    } catch (err) { toast.error("Unable to generate bank details", err instanceof Error ? err.message : "Please retry"); }
    finally { setBusy(false); }
  }
  return <AdminDashboardShell activeLabel="Bookings">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Bank Transfer - {data?.booking.bookingReference || "Booking"}</h1><Link href="/bookings" className="text-sm font-semibold text-primary">Back to Bookings</Link></div>
      {error ? <p role="alert" className="rounded-sm border border-red-200 p-4 text-sm text-red-700">{error}</p> : null}
      {!data && !error ? <p>Loading bank transfers...</p> : null}
      {data ? <>
        <div className="grid gap-3 sm:grid-cols-4">{[
          ["Total", money(data.booking.grandTotal)], ["Amount Paid", money(data.booking.amountPaid)],
          ["Outstanding", money(data.outstandingAmount)], ["Environment / Booking Status", data.environment + " / " + data.booking.bookingStatus],
        ].map(([label,value]) => <div key={label} className="rounded-sm border border-border bg-white p-4"><p className="text-xs text-foreground/55">{label}</p><strong className="mt-1 block break-words">{value}</strong></div>)}</div>
        {data.outstandingAmount > 0 && !["cancelled","expired"].includes(data.booking.bookingStatus) ? <section className="space-y-3 rounded-sm border border-border bg-white p-5">
          <h2 className="font-semibold">Generate / Update Bank Details</h2>
          <p className="text-xs leading-relaxed text-foreground/65">Amounts use the saved booking total and outstanding balance. Add airfare or other charges through the existing booking controls first. Reconcile and close bank identifiers before changing prices or switching payment methods.</p>
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="Bank transfer payment purpose" value={purpose} disabled={busy} onChange={event=>setPurpose(event.target.value as typeof purpose)} className="h-10 rounded-sm border border-border bg-white px-3 text-sm">
              <option value="advance">Advance</option><option value="full">Full outstanding</option><option value="partial">Partial payment</option><option value="final">Final payment</option><option value="additional">Additional charges already on booking</option>
            </select>
            {purpose === "partial" ? <input aria-label="Partial transfer amount" type="number" min="1" max={data.outstandingAmount} step="1" value={amount} onChange={event=>setAmount(event.target.value)} className="h-10 w-40 rounded-sm border border-border px-3" /> : null}
            <Button disabled={busy || (purpose==="partial" && !(Number(amount)>0))} onClick={()=>void create()}>Generate Bank Details</Button>
          </div>
        </section> : null}
        <div className="space-y-4">{data.accounts.map(account => <section key={account.id} className="rounded-sm border border-border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Identifier {account.virtualAccountId || account.id} - {account.status}</h2><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={()=>void action(account.id,"refresh")}>Refresh Status</Button>{account.status !== "closed" && account.status !== "failed" ? <Button variant="outline" disabled={busy} onClick={()=>void action(account.id,"close")}>Close Identifier</Button> : null}</div></div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">{[
            ["Beneficiary",account.beneficiaryName],["Virtual Account Number",account.accountNumber],["IFSC",account.ifsc],
            ["Requested",money(account.amountRequested)],["Amount Received",money(account.amountReceived)],["Applied",money(account.amountApplied)],
            ["Under Review",money(account.amountReview)],["Expires",new Date(account.expiresAt).toLocaleString("en-IN")],
            ["Instructions (Email / WhatsApp)",account.emailInstructionStatus+" / "+account.whatsappInstructionStatus],
          ].map(([label,value])=><div key={label}><dt className="text-xs text-foreground/55">{label}</dt><dd className="mt-1 break-all font-semibold">{value||"-"}</dd></div>)}</dl>
          {account.error ? <p className="mt-4 text-sm text-amber-700">{account.error}</p> : null}
          {account.amountReview>0 ? <p className="mt-4 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">Funds require admin review. No automatic refund or late booking confirmation has been performed.</p> : null}
        </section>)}</div>
        <section className="overflow-hidden rounded-sm border border-border bg-white p-5"><h2 className="mb-3 font-semibold">Transfer History</h2>
          {data.transfers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-muted/40"><tr>{["Payment / UTR","Mode","Received","Applied","Review","Status / Reason","Date"].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.transfers.map(item=><tr key={item.paymentId} className="border-t border-border"><td className="p-3">{item.paymentId}<br/>{item.utr}</td><td className="p-3">{item.mode}</td><td className="p-3">{money(item.amount)}</td><td className="p-3">{money(item.amountApplied)}</td><td className="p-3">{money(item.amountReview)}</td><td className="max-w-xs p-3">{item.status}<br/>{item.reason}</td><td className="p-3">{new Date(item.receivedAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div> : <p className="text-sm text-foreground/60">No bank transfers received.</p>}
        </section>
      </> : null}
    </div>
  </AdminDashboardShell>;
}
