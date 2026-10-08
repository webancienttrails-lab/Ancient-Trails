import { Router } from "express";

import {
  archiveBooking,
  cancelBookingPaymentOrder,
  cancelPendingBooking,
  createBookingBalancePaymentOrder,
  createBooking,
  createBookingPaymentOrder,
  createBookingRecoveryPaymentOrder,
  deleteBooking,
  getBookingConfirmation,
  getBookingRecovery,
  listBookingAccommodationOptions,
  listBookings,
  listTravellerBookings,
  markPendingBookingExpired,
  sendBookingRecoveryEmailManually,
  updateBooking,
  verifyBookingBalancePayment,
  verifyBookingPayment,
  verifyRazorpayWebhook,
} from "../controllers/booking.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicBookingRoutes = Router();

publicBookingRoutes.post("/payment/order", createBookingPaymentOrder);
publicBookingRoutes.post("/payment/cancel", cancelBookingPaymentOrder);
publicBookingRoutes.post("/payment/verify", verifyBookingPayment);
publicBookingRoutes.post("/payment/webhook", verifyRazorpayWebhook);
publicBookingRoutes.get("/me", listTravellerBookings);
publicBookingRoutes.post("/:id/balance-payment/order", createBookingBalancePaymentOrder);
publicBookingRoutes.post("/:id/balance-payment/verify", verifyBookingBalancePayment);
publicBookingRoutes.get("/:id/confirmation", getBookingConfirmation);
publicBookingRoutes.get("/:id/recovery", getBookingRecovery);
publicBookingRoutes.post("/:id/recovery/payment/order", createBookingRecoveryPaymentOrder);

const router = Router();

router.use(requireAdmin);

router.get("/", listBookings);
router.post("/accommodation-options", listBookingAccommodationOptions);
router.patch("/:id/archive", archiveBooking);
router.post("/:id/recovery-email", sendBookingRecoveryEmailManually);
router.patch("/:id/cancel", cancelPendingBooking);
router.patch("/:id/expire", markPendingBookingExpired);
router.patch("/:id", updateBooking);
router.delete("/:id", deleteBooking);
router.post("/", createBooking);

export default router;
