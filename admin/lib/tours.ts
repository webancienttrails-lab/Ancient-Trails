import {
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type AdminTour = {
  id: string;
  tourId: string;
  tourName: string;
  tourType: string;
  tourFormat: string;
  destinationId: string;
  destinationIds: string[];
  durationDn: string;
  category: string;
  isBestseller: boolean;
  difficulty: string;
  bestSeason: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  expertId: string;
  notes: string;
  thumbnailImage: string;
  bannerImage: string;
  galleryImages: string[];
  video: string;
  createdAt: string;
  updatedAt: string;
};

export type TourPayload = {
  tourId: string;
  tourName: string;
  tourType: string;
  tourFormat: string;
  destinationId: string;
  destinationIds: string[];
  durationDn: string;
  category: string;
  isBestseller: boolean;
  difficulty: string;
  bestSeason: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  expertId: string;
  notes: string;
  thumbnailImage: string;
  bannerImage: string;
  galleryImages: string[];
  video: string;
};

type TourMediaUploadPayload = {
  thumbnailImage?: File;
  bannerImage?: File;
  galleryImages?: File[];
  video?: File;
};

export type TourMediaUploadResponse = {
  thumbnailImage: string;
  bannerImage: string;
  galleryImages: string[];
  video: string;
};

export type AdminTourItineraryDay = {
  dayNumber: number;
  title: string;
  summary: string;
  placesVisited: string[];
  transport: string;
  walkingDifficulty: string;
  meals: string;
};

export type AdminTourItinerary = {
  id: string;
  tourId: string;
  itinerarySummary: string;
  days: AdminTourItineraryDay[];
  createdAt: string;
  updatedAt: string;
};

export type TourItineraryPayload = {
  tourId: string;
  itinerarySummary: string;
  days: AdminTourItineraryDay[];
};

export type AdminTourDeparture = {
  id: string;
  departureId: string;
  tourId: string;
  destinationId?: string;
  departureDate: string | null;
  returnDate: string | null;
  seatsAvailable: number;
  priceAdult: number;
  priceExtraBed: number;
  priceChildWithoutExtraBed: number;
  singleOccupancy: number;
  depositType: "fixed" | "percentage";
  depositValue: number;
  depositAppliesTo: "per_person" | "per_booking";
  balanceDueDaysBefore: number;
  earlyBirdOffer: string | null;
  bookingDeadline: string | null;
  status: "scheduled" | "coming_soon" | "closed" | "cancelled";
  childPricingRules: Array<{
    minAge: number;
    maxAge: number;
    allowExtraBed: boolean;
    allowWithoutExtraBed: boolean;
  }>;
  roomPolicy?: {
    allowChildBedSharing: boolean;
    maxChildrenWithoutExtraBedPerRoom: number;
    allowExtraBed: boolean;
    allowChildSingleRoom: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type TourDeparturePayload = {
  departureId: string;
  tourId: string;
  destinationId?: string;
  departureDate: string | null;
  returnDate: string | null;
  seatsAvailable: number;
  priceAdult: number;
  priceExtraBed: number;
  priceChildWithoutExtraBed: number;
  singleOccupancy: number;
  depositType: "fixed" | "percentage";
  depositValue: number;
  depositAppliesTo: "per_person" | "per_booking";
  balanceDueDaysBefore: number;
  earlyBirdOffer: string | null;
  bookingDeadline: string | null;
  status: "scheduled" | "coming_soon" | "closed" | "cancelled";
  childPricingRules: Array<{
    minAge: number;
    maxAge: number;
    allowExtraBed: boolean;
    allowWithoutExtraBed: boolean;
  }>;
  roomPolicy?: {
    allowChildBedSharing: boolean;
    maxChildrenWithoutExtraBedPerRoom: number;
    allowExtraBed: boolean;
    allowChildSingleRoom: boolean;
  };
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

export function getTourMediaUrl(source: string): string {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (trimmedSource.startsWith("/uploads/")) {
    return `${apiBaseUrl}${trimmedSource}`;
  }

  return trimmedSource;
}

async function readUploadResponse<TData>(
  response: Response
): Promise<ApiResponse<TData>> {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as Partial<ApiResponse<TData>> | null)
    : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message || "Upload failed",
      body?.details
    );
  }

  if (!body) {
    throw new ApiError(response.status, "Invalid API response");
  }

  return body as ApiResponse<TData>;
}

export async function listAdminTours() {
  return apiRequest<{
    tours: AdminTour[];
    tourFormatOptions: string[];
    tourTypeOptions: string[];
  }>(
    "/api/admin/tours",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function createAdminTour(payload: TourPayload) {
  return apiRequest<{ tour: AdminTour }>("/api/admin/tours", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTour(id: string, payload: TourPayload) {
  return apiRequest<{ tour: AdminTour }>(`/api/admin/tours/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminTour(id: string) {
  return apiRequest<{ tour: AdminTour }>(`/api/admin/tours/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function uploadTourMedia(payload: TourMediaUploadPayload) {
  const formData = new FormData();

  if (payload.thumbnailImage) {
    formData.append("thumbnailImage", payload.thumbnailImage);
  }

  if (payload.bannerImage) {
    formData.append("bannerImage", payload.bannerImage);
  }

  payload.galleryImages?.forEach((image) => {
    formData.append("galleryImages", image);
  });

  if (payload.video) {
    formData.append("video", payload.video);
  }

  return readUploadResponse<TourMediaUploadResponse>(
    await fetch(`${apiBaseUrl}/api/admin/tours/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}

export async function listAdminTourItineraries() {
  return apiRequest<{ itineraries: AdminTourItinerary[] }>(
    "/api/admin/tours/itineraries",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function createAdminTourItinerary(
  payload: TourItineraryPayload
) {
  return apiRequest<{ itinerary: AdminTourItinerary }>(
    "/api/admin/tours/itineraries",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminTourItinerary(
  id: string,
  payload: TourItineraryPayload
) {
  return apiRequest<{ itinerary: AdminTourItinerary }>(
    `/api/admin/tours/itineraries/${id}`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteAdminTourItinerary(id: string) {
  return apiRequest<{ itinerary: AdminTourItinerary }>(
    `/api/admin/tours/itineraries/${id}`,
    {
      method: "DELETE",
      headers: getAdminHeaders(),
    }
  );
}

export async function listAdminTourDepartures() {
  return apiRequest<{ departures: AdminTourDeparture[] }>(
    "/api/admin/tours/departures",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function createAdminTourDeparture(payload: TourDeparturePayload) {
  return apiRequest<{ departure: AdminTourDeparture }>(
    "/api/admin/tours/departures",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminTourDeparture(
  id: string,
  payload: TourDeparturePayload
) {
  return apiRequest<{ departure: AdminTourDeparture }>(
    `/api/admin/tours/departures/${id}`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteAdminTourDeparture(id: string) {
  return apiRequest<{ departure: AdminTourDeparture }>(
    `/api/admin/tours/departures/${id}`,
    {
      method: "DELETE",
      headers: getAdminHeaders(),
    }
  );
}
