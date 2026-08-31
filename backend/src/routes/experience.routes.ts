import { Router } from "express";

import {
  createExperience,
  deleteExperience,
  experienceMediaUpload,
  getExperience,
  listExperiences,
  updateExperience,
  uploadExperienceMedia,
} from "../controllers/experience.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);

router.get("/", listExperiences);
router.post(
  "/upload",
  experienceMediaUpload.fields([
    { name: "travellerPhotoGallery" },
    { name: "travellerVideos" },
    { name: "attractionPhotoGallery" },
  ]),
  uploadExperienceMedia
);
router.get("/:id", getExperience);
router.patch("/:id", updateExperience);
router.delete("/:id", deleteExperience);
router.post("/", createExperience);

export default router;
