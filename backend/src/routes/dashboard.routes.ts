import { Router } from "express";

import { getAdminDashboardSummary } from "../controllers/dashboard.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);
router.get("/", getAdminDashboardSummary);

export default router;
