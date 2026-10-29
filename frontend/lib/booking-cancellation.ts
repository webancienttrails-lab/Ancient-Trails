import { ApiError, apiRequest } from "@/lib/api";
import { getTravellerSession } from "@/lib/auth";

export type CancellationEstimate = {
  daysBeforeDeparture: number; chargePercentage: number | null; amountPaid: number;
  cancellationCharge: number | null; nonRefundableGst: number; estimatedRefund: number | null;
  departureDate: string; policyRows: Array<{ days: string; charge: string }>; notes: string[];
};
export type CancellationRequest = { status: "requested"; reason: string; requestedAt: string; estimate: CancellationEstimate };
export type CancellationPreview = { existingRequest: CancellationRequest | null; canRequest: boolean;
  estimate: CancellationEstimate | null; quoteHash: string; policyHref: string };
function headers(): HeadersInit {
  const session = getTravellerSession();
  if (!session?.sessionId) throw new ApiError(401, "Please sign in to manage this booking");
  return { "X-Session-Id": session.sessionId };
}
export function getCancellationPreview(bookingId: string) {
  return apiRequest<CancellationPreview>("/api/bookings/" + encodeURIComponent(bookingId) + "/cancel-request", { headers: headers(), cache: "no-store" });
}
export function requestBookingCancellation(bookingId: string, reason: string, quoteHash: string) {
  return apiRequest<{ request: CancellationRequest }>("/api/bookings/" + encodeURIComponent(bookingId) + "/cancel-request", {
    method: "POST", headers: headers(), body: JSON.stringify({ reason, quoteHash }),
  });
}
