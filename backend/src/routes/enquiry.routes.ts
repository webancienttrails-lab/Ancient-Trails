import { Router } from "express";

import {
  createEnquiry,
  createPublicContactEnquiry,
  createPublicTourEnquiry,
  listEnquiries,
  updateEnquiry,
  updateEnquiryStatus,
} from "../controllers/enquiry.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicEnquiryRoutes = Router();
const router = Router();

publicEnquiryRoutes.post("/", createPublicTourEnquiry);
publicEnquiryRoutes.post("/contact", createPublicContactEnquiry);

router.use(requireAdmin);
router.get("/", listEnquiries);
router.post("/", createEnquiry);
router.patch("/:id", updateEnquiry);
router.patch("/:id/status", updateEnquiryStatus);

export default router;
