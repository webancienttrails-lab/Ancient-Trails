import { Router } from "express";

import {
  getTourCalendarPage,
  updateTourCalendarPage,
} from "../controllers/tourCalendarPage.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicTourCalendarPageRoutes = Router();
export const adminTourCalendarPageRoutes = Router();

publicTourCalendarPageRoutes.get("/", getTourCalendarPage);

adminTourCalendarPageRoutes.use(requireAdmin);
adminTourCalendarPageRoutes.get("/", getTourCalendarPage);
adminTourCalendarPageRoutes.put("/", updateTourCalendarPage);
