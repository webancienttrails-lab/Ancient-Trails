import { getCancellationRequestPreview, requestBookingCancellation } from "../controllers/bookingCancellationRequest.controller";
import { requestAdminBookingLeadOtp, verifyAdminBookingLeadOtp } from "../controllers/bookingLead.controller";
import { Router } from "express";
import {
  bankTransferConfig, createInitialBankTransfer, createCustomerBankTransfer, getCustomerBankTransfer,
  createAdminBankTransfer, getAdminBankTransfer, refreshAdminBankTransfer, closeAdminBankTransfer,
} from "../controllers/smartCollect.controller";

import {
  archiveBooking,
  bookingKycUpload,
  cancelBookingPaymentOrder,
  cancelAdminBookingPaymentLink,
  cancelPendingBooking,
  createAdminBookingPaymentLink,
  createBookingBalancePaymentOrder,
  createBooking,
  createBookingPaymentOrder,
  createOfflineBooking,
  createBookingRecoveryPaymentOrder,
  deleteBooking,
  getBookingConfirmation,
  getOfflineBookingSubmission,
  getBookingPaymentOrderStatus,
  getBookingRecovery,
  listAdminBookingPaymentLinks,
  listBookingAccommodationOptions,
  listBookings,
  listTravellerBookings,
  markPendingBookingExpired,
  refreshAdminBookingPaymentLinkStatus,
  resendAdminBookingPaymentLinkWhatsapp,
  sendBookingRecoveryEmailManually,
  sendBookingFinalPaymentWhatsappManually,
  updateBooking,
  updateBookingAirFlightCharges,
  uploadAdminBookingKycDocument,
  uploadTravellerBookingKycDocument,
  verifyBookingBalancePayment,
  verifyBookingPayment,
  verifyRazorpayWebhook,
} from "../controllers/booking.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicBookingRoutes = Router();

publicBookingRoutes.get("/bank-transfer/config", bankTransferConfig);
publicBookingRoutes.post("/bank-transfer", createInitialBankTransfer);
publicBookingRoutes.get("/:id/bank-transfer", getCustomerBankTransfer);
publicBookingRoutes.post("/:id/bank-transfer", createCustomerBankTransfer);
publicBookingRoutes.post("/offline", createOfflineBooking);
publicBookingRoutes.post("/payment/order", createBookingPaymentOrder);
publicBookingRoutes.post("/payment/cancel", cancelBookingPaymentOrder);
publicBookingRoutes.post("/payment/verify", verifyBookingPayment);
publicBookingRoutes.post("/payment/webhook", verifyRazorpayWebhook);
publicBookingRoutes.get("/payment/orders/:orderId/status", getBookingPaymentOrderStatus);
publicBookingRoutes.get("/me", listTravellerBookings);
publicBookingRoutes.get("/:id/cancel-request", getCancellationRequestPreview);
publicBookingRoutes.post("/:id/cancel-request", requestBookingCancellation);
publicBookingRoutes.post(
  "/:id/kyc",
  bookingKycUpload.single("document"),
  uploadTravellerBookingKycDocument
);
publicBookingRoutes.post("/:id/balance-payment/order", createBookingBalancePaymentOrder);
publicBookingRoutes.post("/:id/balance-payment/verify", verifyBookingBalancePayment);
publicBookingRoutes.get("/:id/confirmation", getBookingConfirmation);
publicBookingRoutes.get("/:id/offline-submission", getOfflineBookingSubmission);
publicBookingRoutes.get("/:id/recovery", getBookingRecovery);
publicBookingRoutes.post("/:id/recovery/payment/order", createBookingRecoveryPaymentOrder);

const router = Router();

router.use(requireAdmin);

router.post("/lead/request-otp", requestAdminBookingLeadOtp);
router.post("/lead/verify-otp", verifyAdminBookingLeadOtp);
router.get("/", listBookings);
router.get("/:id/bank-transfer", getAdminBankTransfer);
router.post("/:id/bank-transfer", createAdminBankTransfer);
router.post("/:id/bank-transfer/:accountId/refresh", refreshAdminBankTransfer);
router.post("/:id/bank-transfer/:accountId/close", closeAdminBankTransfer);
router.post("/accommodation-options", listBookingAccommodationOptions);
router.post(
  "/:id/kyc",
  bookingKycUpload.single("document"),
  uploadAdminBookingKycDocument
);
router.patch("/:id/archive", archiveBooking);
router.post("/:id/recovery-email", sendBookingRecoveryEmailManually);
router.post("/:id/final-payment-whatsapp", sendBookingFinalPaymentWhatsappManually);
router.get("/:id/payment-links", listAdminBookingPaymentLinks);
router.post("/:id/payment-links", createAdminBookingPaymentLink);
router.post(
  "/:id/payment-links/:linkId/resend-whatsapp",
  resendAdminBookingPaymentLinkWhatsapp
);
router.post(
  "/:id/payment-links/:linkId/refresh",
  refreshAdminBookingPaymentLinkStatus
);
router.post("/:id/payment-links/:linkId/cancel", cancelAdminBookingPaymentLink);
router.patch("/:id/cancel", cancelPendingBooking);
router.patch("/:id/expire", markPendingBookingExpired);
router.patch("/:id/air-flight-charges", updateBookingAirFlightCharges);
router.patch("/:id", updateBooking);
router.delete("/:id", deleteBooking);
router.post("/", createBooking);

export default router;
