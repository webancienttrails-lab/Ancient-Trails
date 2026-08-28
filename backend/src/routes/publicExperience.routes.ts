import { Router } from "express";

import { listPublishedExperiences } from "../controllers/experience.controller";

const router = Router();

router.get("/", listPublishedExperiences);

export default router;
