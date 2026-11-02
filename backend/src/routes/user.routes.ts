import { Router } from "express";

import { createAdminUser, listAdminUsers, updateAdminUser } from "../controllers/user.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);
router.get("/", listAdminUsers);
router.post("/", createAdminUser);
router.patch("/:id", updateAdminUser);

export default router;
