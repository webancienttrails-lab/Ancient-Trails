import { Router } from "express";

import { listAdminUsers } from "../controllers/user.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);
router.get("/", listAdminUsers);

export default router;
