import { Router } from "express";

import {
  completeGoogleTravellerProfile,
  completeTravellerProfile,
  loginAdminWithPassword,
  loginTravellerWithGoogle,
  requestTravellerProfileMobileChangeOtp,
  requestTravellerOtp,
  updateTravellerProfile,
  verifyTravellerOtpAndLogin,
} from "../controllers/auth.controller";

const router = Router();

router.post("/admin/login", loginAdminWithPassword);
router.post("/traveller/request-otp", requestTravellerOtp);
router.post("/traveller/verify-otp", verifyTravellerOtpAndLogin);
router.post("/traveller/complete-profile", completeTravellerProfile);
router.post("/traveller/complete-google-profile", completeGoogleTravellerProfile);
router.post("/traveller/google", loginTravellerWithGoogle);
router.post(
  "/traveller/profile/request-mobile-change-otp",
  requestTravellerProfileMobileChangeOtp
);
router.patch("/traveller/profile", updateTravellerProfile);

export default router;
