import { Router } from "express";

import {
  createTour,
  createTourDeparture,
  createTourItinerary,
  deleteTour,
  deleteTourDeparture,
  deleteTourItinerary,
  listTourItineraries,
  listTourDepartures,
  listTours,
  tourMediaUpload,
  updateTour,
  updateTourDeparture,
  updateTourItinerary,
  uploadTourMedia,
} from "../controllers/tour.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);

router.get("/departures", listTourDepartures);
router.post("/departures", createTourDeparture);
router.patch("/departures/:id", updateTourDeparture);
router.delete("/departures/:id", deleteTourDeparture);
router.get("/itineraries", listTourItineraries);
router.post("/itineraries", createTourItinerary);
router.patch("/itineraries/:id", updateTourItinerary);
router.delete("/itineraries/:id", deleteTourItinerary);
router.get("/", listTours);
router.post(
  "/upload",
  tourMediaUpload.fields([
    { name: "thumbnailImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "galleryImages" },
    { name: "video", maxCount: 1 },
  ]),
  uploadTourMedia
);
router.patch("/:id", updateTour);
router.delete("/:id", deleteTour);
router.post("/", createTour);

export default router;
