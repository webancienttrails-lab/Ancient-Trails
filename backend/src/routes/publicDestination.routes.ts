import { Router } from "express";

import { listDestinations } from "../controllers/destination.controller";

const router = Router();

router.get("/", listDestinations);

export default router;
