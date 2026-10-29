"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaymentRetryNotice({ message, busy, onRetry, onDismiss }: {
  message: string | null; busy: boolean; onRetry: () => void; onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <aside role="alert" aria-atomic="true" aria-label="Payment not completed" className="fixed inset-x-4 bottom-24 z-[160] rounded-lg border border-amber-200 bg-white p-4 text-secondary shadow-xl sm:left-auto sm:w-[400px] lg:bottom-6 lg:right-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-sans text-[15px] font-bold">Payment not completed</h2>
        <button type="button" aria-label="Dismiss payment message" onClick={onDismiss} disabled={busy} className="rounded p-1 disabled:opacity-50"><X className="size-4" /></button>
      </div>
      <p className="mt-2 font-sans text-[13px] leading-relaxed">{message}</p>
      <Button type="button" disabled={busy} onClick={onRetry} className="mt-3 w-full">{busy ? "Checking payment..." : "Retry Payment"}</Button>
    </aside>
  );
}
