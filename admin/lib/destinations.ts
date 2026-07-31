import {
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type DestinationType = "Domestic" | "International";

export type AdminDestination = {
  id: string;
  destinationId: string;
  destinationName: string;
  destinationType: DestinationType;
  countryRegion: string;
  state: string;
  city: string;
  primaryHeritageFocus: string;
  unescoSite: boolean;
  keyLandmarks: string[];
  recommendedDurationDays: number;
  shortDescription: string;
  dressCode: string;
  footwear: string;
  permits: string;
  idRequirement: string;
  restrictions: string;
  bannerImage: string;
  galleryImages: string[];
  createdAt: string;
  updatedAt: string;
};

export type DestinationPayload = {
  destinationId: string;
  destinationName: string;
  destinationType: DestinationType;
  countryRegion: string;
  state: string;
  city: string;
  primaryHeritageFocus: string;
  unescoSite: boolean;
  keyLandmarks: string[];
  recommendedDurationDays: number;
  shortDescription: string;
  dressCode: string;
  footwear: string;
  permits: string;
  idRequirement: string;
  restrictions: string;
  bannerImage: string;
  galleryImages: string[];
};

type DestinationImageUploadPayload = {
  bannerImage?: File;
  galleryImages?: File[];
};

export type DestinationImageUploadResponse = {
  bannerImage: string;
  galleryImages: string[];
};

export function getDestinationMediaUrl(source: string): string {
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

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.token) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
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

export async function listAdminDestinations() {
  return apiRequest<{ destinations: AdminDestination[] }>(
    "/api/admin/destinations",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function createAdminDestination(payload: DestinationPayload) {
  return apiRequest<{ destination: AdminDestination }>(
    "/api/admin/destinations",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminDestination(
  destinationId: string,
  payload: DestinationPayload
) {
  return apiRequest<{ destination: AdminDestination }>(
    `/api/admin/destinations/${destinationId}`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function uploadDestinationImages(
  payload: DestinationImageUploadPayload
) {
  const formData = new FormData();

  if (payload.bannerImage) {
    formData.append("bannerImage", payload.bannerImage);
  }

  payload.galleryImages?.forEach((image) => {
    formData.append("galleryImages", image);
  });

  return readUploadResponse<DestinationImageUploadResponse>(
    await fetch(`${apiBaseUrl}/api/admin/destinations/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}
