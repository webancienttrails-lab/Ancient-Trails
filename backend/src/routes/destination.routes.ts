import { Router } from "express";

import {
  createDestination,
  destinationImageUpload,
  listDestinations,
  updateDestination,
  uploadDestinationImages,
} from "../controllers/destination.controller";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdmin);

router.get("/", listDestinations);
router.post(
  "/upload",
  destinationImageUpload.fields([
    { name: "thumbnailImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  uploadDestinationImages
);
router.patch("/:id", updateDestination);
router.post("/", createDestination);

export default router;
