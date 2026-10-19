import { parseSiteLogoUpload } from "../services/site-logo-upload";
import { Router } from "express";

import {
  getSiteSettings,
  uploadSiteLogo,
  resetSiteLogo,
  updateSiteSettings,
} from "../controllers/siteSettings.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicSiteSettingsRoutes = Router();
export const adminSiteSettingsRoutes = Router();

publicSiteSettingsRoutes.get("/", getSiteSettings);

adminSiteSettingsRoutes.use(requireAdmin);
adminSiteSettingsRoutes.get("/", getSiteSettings);
adminSiteSettingsRoutes.put("/", updateSiteSettings);

adminSiteSettingsRoutes.post("/logo", parseSiteLogoUpload, uploadSiteLogo);
adminSiteSettingsRoutes.delete("/logo", resetSiteLogo);
