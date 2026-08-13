import { Router } from "express";

import {
  aboutImageUpload,
  getAboutPage,
  updateAboutPage,
  uploadAboutImage,
} from "../controllers/about.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicAboutRoutes = Router();
export const adminAboutRoutes = Router();

publicAboutRoutes.get("/", getAboutPage);

adminAboutRoutes.use(requireAdmin);
adminAboutRoutes.get("/", getAboutPage);
adminAboutRoutes.put("/", updateAboutPage);
adminAboutRoutes.post("/upload", aboutImageUpload.single("image"), uploadAboutImage);
