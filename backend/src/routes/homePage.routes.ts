import { Router } from "express";

import {
  getHomePage,
  updateHomePage,
} from "../controllers/homePage.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicHomePageRoutes = Router();
export const adminHomePageRoutes = Router();

publicHomePageRoutes.get("/", getHomePage);

adminHomePageRoutes.use(requireAdmin);
adminHomePageRoutes.get("/", getHomePage);
adminHomePageRoutes.put("/", updateHomePage);
