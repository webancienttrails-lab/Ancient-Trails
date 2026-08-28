import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type MegaMenuReference = {
  id: string;
  referenceId: string;
  sortOrder: number;
};

export type MegaMenuTourReference = MegaMenuReference & {
  description: string;
  image: string;
  tourId: string;
  tourName: string;
};

export type MegaMenuDestinationReference = MegaMenuReference & {
  city: string;
  countryRegion: string;
  description: string;
  destinationId: string;
  destinationName: string;
  href: string;
  image: string;
  state: string;
  title: string;
};

export type MegaMenuRegionSetting = {
  description: string;
  href: string;
  image: string;
  sortOrder: number;
  title: string;
};

export type MegaMenuContent = {
  id: string;
  tourMenu: {
    heritageTours: MegaMenuTourReference[];
    shortTrails: MegaMenuTourReference[];
  };
  destinationMenu: {
    india: MegaMenuDestinationReference[];
    international: MegaMenuDestinationReference[];
      topCities: MegaMenuDestinationReference[];
  };
  destinationIndiaRegions: MegaMenuRegionSetting[];
  destinationInternationalRegions: MegaMenuRegionSetting[];
  createdAt: string;
  updatedAt: string;
};

export type MegaMenuPayload = {
  destinationIndia: Array<Omit<MegaMenuReference, "id">>;
  destinationIndiaRegions: MegaMenuRegionSetting[];
  destinationInternational: Array<Omit<MegaMenuReference, "id">>;
  destinationInternationalRegions: MegaMenuRegionSetting[];
  destinationTopCities: Array<Omit<MegaMenuReference, "id">>;
  tourHeritage: Array<Omit<MegaMenuReference, "id">>;
  tourShortTrails: Array<Omit<MegaMenuReference, "id">>;
};

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.token) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export async function getAdminMegaMenu() {
  return apiRequest<{ megaMenu: MegaMenuContent }>("/api/admin/mega-menu", {
    headers: getAdminHeaders(),
  });
}

export async function updateAdminMegaMenu(payload: MegaMenuPayload) {
  return apiRequest<{ megaMenu: MegaMenuContent }>("/api/admin/mega-menu", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}
