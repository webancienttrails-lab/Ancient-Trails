import { Router } from "express";

import {
  createBooking,
  deleteBooking,
  listBookings,
  updateBooking,
} from "../controllers/booking.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);

router.get("/", listBookings);
router.patch("/:id", updateBooking);
router.delete("/:id", deleteBooking);
router.post("/", createBooking);

export default router;
