import { apiRequest } from "@/lib/api";
import { getTravellerSession } from "@/lib/auth";
import type { BookingPayload } from "@/lib/booking-payment";
export type BankTransferAccount = {
  id: string; virtualAccountId: string; bookingReference: string;
  status: "creating" | "active" | "closed" | "failed" | "creation_unknown";
  beneficiaryName: string; accountNumber: string; ifsc: string; bankName: string;
  amountRequested: number; amountReceived: number; amountApplied: number; amountReview: number;
  expiresAt: string; closedAt: string | null; error: string;
  emailInstructionStatus: string; whatsappInstructionStatus: string;
};
export type BankTransferData = {
  booking: { id: string; bookingReference: string; bookingStatus: string; paymentStatus: string;
    grandTotal: number; amountPaid: number; balanceAmount: number };
  environment: "test" | "live"; outstandingAmount: number; accessToken?: string; confirmationUrl?: string;
  accounts: BankTransferAccount[];
  transfers: Array<{ paymentId: string; accountId: string; amount: number; amountApplied: number; amountReview: number;
    status: string; mode: string; utr: string; reason: string; receivedAt: string }>;
};
export type BankTransferRequest = { purpose: "advance" | "full" | "partial" | "final" | "additional"; amount?: number };

function headers(): HeadersInit {
  const session = getTravellerSession();
  return session?.sessionId ? { "X-Session-Id": session.sessionId } : {};
}
export function getBankTransferConfig() {
  return apiRequest<{ enabled: boolean }>("/api/bookings/bank-transfer/config");
}
export function createInitialBankTransfer(payload: BookingPayload) {
  return apiRequest<BankTransferData>("/api/bookings/bank-transfer", { method: "POST", body: JSON.stringify(payload), headers: headers() });
}
export function getBankTransfer(bookingId: string) {
  return apiRequest<BankTransferData>("/api/bookings/" + bookingId + "/bank-transfer", { headers: headers(), cache: "no-store" });
}
export function requestBankTransfer(bookingId: string, request: BankTransferRequest) {
  return apiRequest<BankTransferData>("/api/bookings/" + bookingId + "/bank-transfer", {
    method: "POST", headers: headers(), body: JSON.stringify(request),
  });
}
