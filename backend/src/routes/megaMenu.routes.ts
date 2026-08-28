import { Router } from "express";

import {
  getMegaMenu,
  updateMegaMenu,
} from "../controllers/megaMenu.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicMegaMenuRoutes = Router();
export const adminMegaMenuRoutes = Router();

publicMegaMenuRoutes.get("/", getMegaMenu);

adminMegaMenuRoutes.use(requireAdmin);
adminMegaMenuRoutes.get("/", getMegaMenu);
adminMegaMenuRoutes.put("/", updateMegaMenu);
