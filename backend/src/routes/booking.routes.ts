import { Router } from "express";

import {
  cancelBookingPaymentOrder,
  createBookingBalancePaymentOrder,
  createBooking,
  createBookingPaymentOrder,
  deleteBooking,
  getBookingConfirmation,
  listBookings,
  listTravellerBookings,
  updateBooking,
  verifyBookingBalancePayment,
  verifyBookingPayment,
} from "../controllers/booking.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicBookingRoutes = Router();

publicBookingRoutes.post("/payment/order", createBookingPaymentOrder);
publicBookingRoutes.post("/payment/cancel", cancelBookingPaymentOrder);
publicBookingRoutes.post("/payment/verify", verifyBookingPayment);
publicBookingRoutes.get("/me", listTravellerBookings);
publicBookingRoutes.post("/:id/balance-payment/order", createBookingBalancePaymentOrder);
publicBookingRoutes.post("/:id/balance-payment/verify", verifyBookingBalancePayment);
publicBookingRoutes.get("/:id/confirmation", getBookingConfirmation);

const router = Router();

router.use(requireAdmin);

router.get("/", listBookings);
router.patch("/:id", updateBooking);
router.delete("/:id", deleteBooking);
router.post("/", createBooking);

export default router;
