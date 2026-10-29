import { Router } from "express";

import { getPublishedExperience, listPublishedExperiences } from "../controllers/experience.controller";

const router = Router();

router.get("/", listPublishedExperiences);
router.get("/:reference", getPublishedExperience);

export default router;
