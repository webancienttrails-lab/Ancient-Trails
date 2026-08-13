import { Router } from "express";

import {
  listTourItineraries,
  listTourDepartures,
  listTours,
} from "../controllers/tour.controller";

const router = Router();

router.get("/departures", listTourDepartures);
router.get("/itineraries", listTourItineraries);
router.get("/", listTours);

export default router;
