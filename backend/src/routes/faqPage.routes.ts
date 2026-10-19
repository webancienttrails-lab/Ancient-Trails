import { Router } from "express";
import { getFaqPage, updateFaqPage } from "../controllers/faqPage.controller";
import { requireAdmin } from "../middleware/adminAuth";
export const publicFaqPageRoutes = Router();
export const adminFaqPageRoutes = Router();
publicFaqPageRoutes.get("/", getFaqPage);
adminFaqPageRoutes.use(requireAdmin);
adminFaqPageRoutes.get("/", getFaqPage);
adminFaqPageRoutes.put("/", updateFaqPage);
