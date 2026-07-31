import { Router } from "express";

import {
  createExpert,
  deleteExpert,
  listExperts,
  updateExpert,
} from "../controllers/expert.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);

router.get("/", listExperts);
router.patch("/:id", updateExpert);
router.delete("/:id", deleteExpert);
router.post("/", createExpert);

export default router;
