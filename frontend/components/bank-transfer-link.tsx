"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBankTransferConfig } from "@/lib/bank-transfer";
export function BankTransferBalanceLink({ bookingId, disabled }: { bookingId: string; disabled?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { void getBankTransferConfig().then(result=>setEnabled(result.data.enabled)).catch(()=>{}); }, []);
  if (!enabled || disabled) return null;
  return <Link href={"/bank-transfer/" + bookingId} className="mt-3 block rounded-lg border border-primary/25 px-4 py-2.5 text-center text-sm font-semibold text-primary">Bank Transfer (NEFT / RTGS / IMPS)</Link>;
}
