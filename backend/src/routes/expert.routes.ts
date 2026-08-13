import { Router } from "express";

import {
  createExpert,
  deleteExpert,
  expertImageUpload,
  listExperts,
  uploadExpertImage,
  updateExpert,
} from "../controllers/expert.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicExpertRoutes = Router();
const adminExpertRoutes = Router();

publicExpertRoutes.get("/", listExperts);

adminExpertRoutes.use(requireAdmin);

adminExpertRoutes.get("/", listExperts);
adminExpertRoutes.post("/upload", expertImageUpload.single("image"), uploadExpertImage);
adminExpertRoutes.patch("/:id", updateExpert);
adminExpertRoutes.delete("/:id", deleteExpert);
adminExpertRoutes.post("/", createExpert);

export default adminExpertRoutes;
