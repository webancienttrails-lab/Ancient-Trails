import { sessionFetch, apiBaseUrl, apiRequest, ApiError, type ApiResponse } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type BookingGuestDetails = {
  isNri?: boolean;
  title: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
};

export type BookingChildDetails = {
  age: number;
};

export type BookingAccommodationDetails = {
  singleOccupancyOneRoom: number;
  singleOccupancyTwoRooms: number;
  doubleOccupancy: number;
  twinOccupancy: number;
  tripleOccupancy: number;
};

export type BookingPaymentOption = "advance" | "full";
export type BookingPaymentMethod = "cash" | "cheque" | "neft" | "imps" | "rtgs" | "upi" | "netbanking" | "card" | "wallet" | "emi" | "razorpay" | "bank_transfer" | "";
export type BookingPaymentLinkPurpose =
  | "final"
  | "additional"
  | "partial"
  | "custom";

export type BookingTravellerDetails = {
  isNri?: boolean;
  id: string;
  type: "adult" | "child";
  title?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  mobileNumber?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  ageOnDeparture?: number;
  kycDocuments?: BookingKycDocument[];
};

export type BookingKycDocument = {
  id: string;
  documentType:
    | "aadhaar_card"
    | "driving_license"
    | "voter_id"
    | "passport"
    | "pan_card"
    | "visa"
    | "oci";
  documentLabel: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedBy: "traveller" | "admin";
  uploadedAt: string;
};

export type BookingAccommodationOption = {
  id: string;
  title: string;
  description: string;
  total: number;
  rooms: Array<{
    id: string;
    title: string;
    bedSummary: string;
    roomType: string;
    allocations: Array<{
      label: string;
      price: number;
    }>;
  }>;
  recommended: boolean;
  requiresRoommateMatching: boolean;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  packageTotal?: number;
  tcsApplicable?: boolean;
  tcsPercentage?: number;
  tcsAmount?: number;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  balanceDueDate: string | null;
};

export type BookingCancellationPayload = {
  reason: string;
  chargePercentage: number;
  requestedBy: "Customer" | "Admin" | "Tour Operator";
  notes: string;
};
export type AdminCancellationRequest = {
  id: string; reason: string; status: "requested" | "processing" | "refund_initiated" | "offline_refund_recorded";
  estimate: { estimatedRefund: number | null; cancellationCharge: number | null; nonRefundableGst: number; daysBeforeDeparture: number; amountPaid: number; chargeableSubtotal?: number | null; chargePercentage: number | null; notes: string[] };
  requestedAt: string; refundPercentage?: number; refundAmount?: number; refundMode?: "razorpay" | "offline";
  adminNote?: string; processedAt?: string;
};

export type BookingHotelDetail = { destination: string; hotel: string; category: string; nights: number };
export type BookingFlightDetail = { from: string; to: string; airline: string; seats: number; dateTime: string };

export type AdminBooking = {
  invoiceOverrides?: Record<string, string>;
  sourceEnquiryCategory?: "normal" | "group" | "customise";
  tourScope?: "master" | "customise";
  hotelDetails?: BookingHotelDetail[];
  flightDetails?: BookingFlightDetail[];
  cancellation?: (BookingCancellationPayload & { cancelledAt: string }) | null;
  paymentMode?: "online" | "offline" | "bank_transfer";
  hasBankTransfer?: boolean;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  id: string;
  cancellationRequest?: AdminCancellationRequest | null;
  bookingReference?: string;
  bookingStatus?:
    | "draft"
    | "payment_pending"
    | "payment_processing"
    | "confirmed"
    | "expired"
    | "cancelled";
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: BookingPaymentOption;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: BookingChildDetails[];
  guestDetails: BookingGuestDetails[];
  travellers?: BookingTravellerDetails[];
  accommodationDetails: BookingAccommodationDetails;
  pricingSnapshot?: {
    departureDate?: string | null;
    returnDate?: string | null;
    accommodation?: {
      optionTitle?: string;
      rooms?: BookingAccommodationOption["rooms"];
    };
  };
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  packageTotal?: number;
  tcsApplicable?: boolean;
  tcsPercentage?: number;
  tcsAmount?: number;
  tcsExemptionVerified?: boolean;
  grandTotal?: number;
  airFlightCharges?: number;
  airfareIncludedInTotal?: boolean;
  airfareExcluded?: boolean;
  airfareAddedAt?: string | null;
  airfareHistory?: Array<{ previousAmount: number; amount: number; changedBy: string; changedAt: string; previousIncludedInTotal?: boolean; includedInTotal?: boolean; previousTotal?: number; total?: number; reason?: string }>;
  collectionHistory?: Array<{ paymentId: string; amount: number; airfareAmount: number; paidAt: string }>;
  depositAmount?: number;
  balanceAmount?: number;
  balanceDueDate?: string | null;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: BookingPaymentMethod | "razorpay" | "bank_transfer" | "";
  paymentProvider?: "razorpay" | "";
  paymentOrderId?: string;
  paymentId?: string;
  paymentCurrency?: string;
  amountPaid?: number;
  paymentCapturedAt?: string | null;
  whatsappMarketingConsent?: boolean;
  whatsappFeedbackStatus?: "not_sent" | "sending" | "sent" | "failed";
  whatsappFeedbackLastSentAt?: string | null;
  whatsappFeedbackRecipient?: string;
  whatsappFeedbackError?: string;
  heldSeatCount?: number;
  holdExpiresAt?: string | null;
  recoveryExpiresAt?: string | null;
  recoveryUrl?: string;
  finalPaymentUrl?: string;
  recoveryEmailStatus?: "pending" | "sending" | "sent" | "failed" | "disabled";
  recoveryReminderCount?: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingPaymentLinkRequest = {
  id: string;
  bookingId: string;
  purpose: BookingPaymentLinkPurpose;
  purposeLabel: string;
  amount: number;
  amountRupees: number;
  currency: string;
  description: string;
  razorpayPaymentLinkId: string;
  razorpayPaymentId: string;
  paymentLinkUrl: string;
  status: "created" | "sent" | "paid" | "failed" | "expired" | "cancelled";
  whatsappStatus: "pending" | "sent" | "failed";
  whatsappRecipient: string;
  whatsappRequestId: string;
  whatsappError: string;
  expiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingPaymentLinkPayload = {
  additionalChargeAlreadyApplied?: boolean;
  amount?: number;
  description?: string;
  purpose: BookingPaymentLinkPurpose;
};

export type AdminBookingReceipt = {
  id: string; transactionId: string; amount: number; paidAt: string | null;
  method: string; currency: string; description: string; receiptNumber: string;
  totalPaid: number; balanceAfterPayment: number; bookingTotal: number;
};

export function listAdminBookingReceipts(id: string) {
  return apiRequest<{ receipts: AdminBookingReceipt[] }>(`/api/admin/bookings/${encodeURIComponent(id)}/receipts`, { headers: getAdminHeaders() });
}

export async function shareAdminBookingReceipt(id: string, receiptId: string, pdf: Blob) {
  if (pdf.size > 10 * 1024 * 1024) {
    throw new Error("The receipt PDF exceeds the 10 MB sharing limit. Please reduce unusually long receipt details and try again.");
  }
  const form = new FormData();
  form.append("receipt", pdf, "Payment-Receipt.pdf");
  return readUploadResponse<{ whatsappUrl: string; recipient: string; expiresAt: string }>(await sessionFetch(
    `${apiBaseUrl}/api/admin/bookings/${encodeURIComponent(id)}/receipts/${encodeURIComponent(receiptId)}/share`,
    { method: "POST", headers: getAdminHeaders(), body: form, }
  ));
}

export type BookingPayload = {
  sourceEnquiryCategory?: "normal" | "group" | "customise";
  tourScope?: "master" | "customise";
  paymentMode?: "online" | "offline" | "bank_transfer";
  leadVerificationToken?: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: BookingPaymentOption;
  paymentMethod?: BookingPaymentMethod;
  amountPaid?: number;
  airFlightCharges?: number;
  airfareIncludedInTotal?: boolean;
  airfareExcluded?: boolean;
  airfareAddedAt?: string | null;
  airfareHistory?: Array<{ previousAmount: number; amount: number; changedBy: string; changedAt: string; previousIncludedInTotal?: boolean; includedInTotal?: boolean; previousTotal?: number; total?: number; reason?: string }>;
  collectionHistory?: Array<{ paymentId: string; amount: number; airfareAmount: number; paidAt: string }>;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: BookingChildDetails[];
  guestDetails: BookingGuestDetails[];
  travellers?: BookingTravellerDetails[];
  accommodationDetails: BookingAccommodationDetails;
  gstPercentage?: number;
};

export type BookingAccommodationOptionsPayload = {
  tourScope?: "master" | "customise";
  bookingId?: string;
  departureId: string;
  adultCount: number;
  childDetails: BookingChildDetails[];
  gstPercentage?: number;
};

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.sessionId) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    "X-Session-Id": session.sessionId,
  };
}

async function readUploadResponse<TData>(
  response: Response
): Promise<ApiResponse<TData>> {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as Partial<ApiResponse<TData>> | null)
    : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message || "Upload failed",
      body?.details
    );
  }

  if (!body) {
    throw new ApiError(response.status, "Invalid API response");
  }

  return body as ApiResponse<TData>;
}

export function getBookingKycDocumentUrl(source = "") {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (trimmedSource.startsWith("/uploads/")) {
    return `${apiBaseUrl}${trimmedSource}`;
  }

  return trimmedSource;
}

export async function listAdminBookings() {
  return apiRequest<{ bookings: AdminBooking[] }>("/api/admin/bookings", {
    headers: getAdminHeaders(),
  });
}

export function updateAdminBookingInvoice(id: string, invoiceOverrides: Record<string, string>) {
  return apiRequest<{ invoiceOverrides: Record<string, string> }>(`/api/admin/bookings/${encodeURIComponent(id)}/invoice`, {
    method: "PATCH", headers: getAdminHeaders(), body: JSON.stringify({ invoiceOverrides }),
  });
}

export function updateAdminBookingTravelDetails(id: string, payload: {
  hotelDetails?: BookingHotelDetail[];
  flightDetails?: BookingFlightDetail[];
}) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${encodeURIComponent(id)}/travel-details`, {
    method: "PATCH", headers: getAdminHeaders(), body: JSON.stringify(payload),
  });
}

export function verifyBookingTcsExemption(bookingId: string, verified: boolean) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${encodeURIComponent(bookingId)}/tcs-exemption`, {
    method: "PATCH", headers: getAdminHeaders(), body: JSON.stringify({ verified }),
  });
}

export async function uploadAdminBookingKycDocument(payload: {
  bookingId: string;
  documentType: BookingKycDocument["documentType"];
  file: File;
  travellerId: string;
}) {
  const formData = new FormData();

  formData.append("travellerId", payload.travellerId);
  formData.append("documentType", payload.documentType);
  formData.append("document", payload.file);

  return readUploadResponse<{ booking: AdminBooking }>(
    await sessionFetch(
      `${apiBaseUrl}/api/admin/bookings/${encodeURIComponent(payload.bookingId)}/kyc`,
      {
        method: "POST",
        headers: getAdminHeaders(),
        body: formData,
        credentials: "include",
      }
    )
  );
}

export async function createAdminBooking(payload: BookingPayload) {
  return apiRequest<{ booking: AdminBooking }>("/api/admin/bookings", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function listAdminBookingAccommodationOptions(
  payload: BookingAccommodationOptionsPayload
) {
  return apiRequest<{ options: BookingAccommodationOption[] }>(
    "/api/admin/bookings/accommodation-options",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminBooking(id: string, payload: BookingPayload) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function archiveAdminBooking(id: string) {
  return apiRequest<{ booking: AdminBooking }>(
    `/api/admin/bookings/${id}/archive`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );
}

export async function sendAdminBookingRecoveryEmail(id: string) {
  return apiRequest<{ booking: AdminBooking; recoveryUrl: string }>(
    `/api/admin/bookings/${id}/recovery-email`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );
}

export async function sendAdminBookingFinalPaymentWhatsapp(id: string) {
  return apiRequest<{
    booking: AdminBooking;
    finalPaymentUrl: string;
    requestId: string;
  }>(`/api/admin/bookings/${id}/final-payment-whatsapp`, {
    method: "POST",
    headers: getAdminHeaders(),
  });
}

export async function sendAdminBookingFeedbackWhatsapp(id: string, resend = false) {
  return apiRequest<{ booking: AdminBooking; requestId: string }>(`/api/admin/bookings/${encodeURIComponent(id)}/feedback-whatsapp`, {
    method: "POST", headers: getAdminHeaders(), body: JSON.stringify({ resend }),
  });
}

export async function listAdminBookingPaymentLinks(id: string) {
  return apiRequest<{
    booking: AdminBooking;
    paymentLinkRequests: BookingPaymentLinkRequest[];
  }>(`/api/admin/bookings/${id}/payment-links`, {
    headers: getAdminHeaders(),
  });
}

export async function createAdminBookingPaymentLink(
  id: string,
  payload: BookingPaymentLinkPayload
) {
  return apiRequest<{
    booking: AdminBooking;
    paymentLinkRequest: BookingPaymentLinkRequest;
    paymentLinkRequests: BookingPaymentLinkRequest[];
  }>(`/api/admin/bookings/${id}/payment-links`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function resendAdminBookingPaymentLinkWhatsapp(
  bookingId: string,
  linkId: string
) {
  return apiRequest<{
    booking: AdminBooking;
    paymentLinkRequest: BookingPaymentLinkRequest;
    paymentLinkRequests: BookingPaymentLinkRequest[];
  }>(
    `/api/admin/bookings/${bookingId}/payment-links/${linkId}/resend-whatsapp`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );
}

export async function refreshAdminBookingPaymentLinkStatus(
  bookingId: string,
  linkId: string
) {
  return apiRequest<{
    booking: AdminBooking;
    paymentLinkRequests: BookingPaymentLinkRequest[];
  }>(`/api/admin/bookings/${bookingId}/payment-links/${linkId}/refresh`, {
    method: "POST",
    headers: getAdminHeaders(),
  });
}

export async function cancelAdminBookingPaymentLink(
  bookingId: string,
  linkId: string
) {
  return apiRequest<{
    booking: AdminBooking;
    paymentLinkRequests: BookingPaymentLinkRequest[];
  }>(`/api/admin/bookings/${bookingId}/payment-links/${linkId}/cancel`, {
    method: "POST",
    headers: getAdminHeaders(),
  });
}

export async function updateAdminBookingAirFlightCharges(
  id: string,
  airFlightCharges: number,
  airfareIncludedInTotal?: boolean
) {
  return apiRequest<{ booking: AdminBooking; finalPaymentUrl: string }>(
    `/api/admin/bookings/${id}/air-flight-charges`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify({ airFlightCharges, airfareIncludedInTotal }),
    }
  );
}

export async function cancelAdminBooking(id: string, payload: BookingCancellationPayload) {
  return apiRequest<{ booking: AdminBooking; availability: { departureId: string; seatsReleased: number; seatsAvailable: number | null } }>(
    `/api/admin/bookings/${id}/cancel`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: getAdminHeaders(),
    }
  );
}

export async function startAdminCancellationRefund(id: string, payload: { refundPercentage: number; refundAmount: number; adminNote?: string }) {
  return apiRequest<{ request: AdminCancellationRequest; booking: AdminBooking | null; refundMode: "razorpay" | "offline" }>(`/api/admin/bookings/${encodeURIComponent(id)}/cancellation-request/refund`, {
    method: "POST", headers: getAdminHeaders(), body: JSON.stringify(payload),
  }, true, 60_000);
}

export async function expireAdminBooking(id: string) {
  return apiRequest<{ booking: AdminBooking | null }>(
    `/api/admin/bookings/${id}/expire`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );
}

export async function deleteAdminBooking(id: string) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export function formatBookingPaymentMethod(booking: Pick<AdminBooking, "paymentMethod" | "paymentMode" | "paymentProvider">): string {
  const method = booking.paymentMethod;
  const labels: Record<string, string> = { cash: "Cash", cheque: "Cheque", neft: "NEFT", imps: "IMPS", rtgs: "RTGS", upi: "UPI", netbanking: "Netbanking", card: "Card", wallet: "Wallet", emi: "EMI", bank_transfer: "Bank Transfer", razorpay: "Razorpay" };
  if (method && method !== "razorpay") return labels[method] || method;
  if (booking.paymentMode === "bank_transfer") return "Bank Transfer";
  if (booking.paymentProvider === "razorpay" || method === "razorpay" || booking.paymentMode === "online") return "Razorpay";
  return "Not recorded";
}
export function requestAdminLeadOtp(payload: { countryCode: string; mobileNumber: string }) {
  return apiRequest<{ mobileNumber: string }>("/api/admin/bookings/lead/request-otp", { method: "POST", headers: getAdminHeaders(), body: JSON.stringify(payload) });
}
export function verifyAdminLeadOtp(payload: { countryCode: string; mobileNumber: string; otp: string }) {
  return apiRequest<{ verificationToken: string; traveller: Pick<BookingGuestDetails, "firstName" | "lastName" | "email" | "gender" | "dateOfBirth"> | null }>("/api/admin/bookings/lead/verify-otp", { method: "POST", headers: getAdminHeaders(), body: JSON.stringify(payload) });
}
