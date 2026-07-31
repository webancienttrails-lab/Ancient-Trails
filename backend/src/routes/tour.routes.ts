import { Router } from "express";

import {
  createTour,
  createTourDeparture,
  deleteTour,
  deleteTourDeparture,
  listTourDepartures,
  listTours,
  updateTour,
  updateTourDeparture,
} from "../controllers/tour.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);

router.get("/departures", listTourDepartures);
router.post("/departures", createTourDeparture);
router.patch("/departures/:id", updateTourDeparture);
router.delete("/departures/:id", deleteTourDeparture);
router.get("/", listTours);
router.patch("/:id", updateTour);
router.delete("/:id", deleteTour);
router.post("/", createTour);

export default router;
