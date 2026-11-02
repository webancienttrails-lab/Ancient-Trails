import { Router } from "express";

import { getAdminDashboardSummary } from "../controllers/dashboard.controller";
import { getAdminReport, getAdminReportInvoices } from "../controllers/reports.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);
router.get("/", getAdminDashboardSummary);
router.get("/reports", getAdminReport);
router.get("/reports/invoices", getAdminReportInvoices);

export default router;
