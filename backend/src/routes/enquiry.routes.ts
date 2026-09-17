import { Router } from "express";

import {
  createEnquiry,
  createPublicTourEnquiry,
  listEnquiries,
  updateEnquiry,
} from "../controllers/enquiry.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicEnquiryRoutes = Router();
const router = Router();

publicEnquiryRoutes.post("/", createPublicTourEnquiry);

router.use(requireAdmin);
router.get("/", listEnquiries);
router.post("/", createEnquiry);
router.patch("/:id", updateEnquiry);

export default router;
