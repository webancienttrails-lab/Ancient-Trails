import { Router } from "express";

import {
  createEnquiry,
  listEnquiries,
  updateEnquiry,
} from "../controllers/enquiry.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);
router.get("/", listEnquiries);
router.post("/", createEnquiry);
router.patch("/:id", updateEnquiry);

export default router;
