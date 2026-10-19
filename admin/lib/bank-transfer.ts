import { apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";
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
  const session = getAdminSession();
  return session?.token ? { Authorization: "Bearer " + session.token } : {};
}
const base = (id: string) => "/api/admin/bookings/" + id + "/bank-transfer";
export function getAdminBankTransfer(id: string) {
  return apiRequest<BankTransferData>(base(id), { headers: headers(), cache: "no-store" });
}
export function createAdminBankTransfer(id: string, payload: BankTransferRequest) {
  return apiRequest<BankTransferData>(base(id), { method: "POST", headers: headers(), body: JSON.stringify(payload) });
}
export function updateBankTransferIdentifier(id: string, accountId: string, action: "refresh" | "close") {
  return apiRequest<BankTransferData>(base(id) + "/" + accountId + "/" + action, { method: "POST", headers: headers() });
}
