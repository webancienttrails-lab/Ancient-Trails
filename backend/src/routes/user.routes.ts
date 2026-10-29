import { Router } from "express";

import { listAdminUsers, updateAdminUser } from "../controllers/user.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);
router.get("/", listAdminUsers);
router.patch("/:id", updateAdminUser);

export default router;
