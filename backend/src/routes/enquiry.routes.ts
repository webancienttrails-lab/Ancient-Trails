import { Router } from "express";

import {
  createEnquiry,
  createPublicCallbackEnquiry,
  createPublicContactEnquiry,
  createPublicTourEnquiry,
  addEnquiryReply,
  setEnquiryBlacklist,
  listEnquiries,
  updateEnquiry,
  updateEnquiryStatus,
} from "../controllers/enquiry.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicEnquiryRoutes = Router();
const router = Router();

publicEnquiryRoutes.post("/", createPublicTourEnquiry);
publicEnquiryRoutes.post("/contact", createPublicContactEnquiry);
publicEnquiryRoutes.post("/callback", createPublicCallbackEnquiry);

router.use(requireAdmin);
router.get("/", listEnquiries);
router.post("/", createEnquiry);
router.patch("/:id", updateEnquiry);
router.patch("/:id/status", updateEnquiryStatus);
router.post("/:id/replies", addEnquiryReply);
router.patch("/:id/blacklist", setEnquiryBlacklist);

export default router;
