import {
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type ExperienceStatus = "Draft" | "Published";

export type ExperienceAttractionPhoto = {
  image: string;
  name: string;
};

export type AdminExperience = {
  id: string;
  experienceId: string;
  destinationId: string;
  destinationName: string;
  travellerName: string;
  travellerEmail: string;
  title: string;
  writtenReview: string;
  thingsToKnow: string[];
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  travellerVideoTitles: string[];
  attractionPhotoGallery: ExperienceAttractionPhoto[];
  ratingItinerary: number;
  ratingLocalTransport: number;
  ratingAccommodation: number;
  ratingTourExpert: number;
  overallRating: number;
  status: ExperienceStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExperiencePayload = {
  experienceId?: string;
  destinationId: string;
  travellerName: string;
  travellerEmail: string;
  title?: string;
  writtenReview: string;
  thingsToKnow: string[];
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  travellerVideoTitles?: string[];
  attractionPhotoGallery?: ExperienceAttractionPhoto[];
  ratingItinerary: number;
  ratingLocalTransport: number;
  ratingAccommodation: number;
  ratingTourExpert: number;
  status: ExperienceStatus;
};

type ExperienceMediaUploadPayload = {
  travellerPhotoGallery?: File[];
  travellerVideos?: File[];
  attractionPhotoGallery?: File[];
};

export type ExperienceMediaUploadResponse = {
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  attractionPhotoGallery: string[];
};

export type RejectedExperiencePhoto = {
  fileName: string;
  size: number;
};

export const EXPERIENCE_PHOTO_MAX_SIZE = 2 * 1024 * 1024;

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

export function getExperienceMediaUrl(source: string): string {
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

export async function getUploadableExperiencePhotos(files: File[]) {
  const rejectedPhotos = files
    .filter((file) => file.size > EXPERIENCE_PHOTO_MAX_SIZE)
    .map<RejectedExperiencePhoto>((file) => ({
      fileName: file.name,
      size: file.size,
    }));
  const uploadablePhotos = files.filter(
    (file) => file.size <= EXPERIENCE_PHOTO_MAX_SIZE
  );

  return {
    rejectedPhotos,
    uploadablePhotos,
  };
}

export function getExperiencePhotoSizeMessage(rejectedPhotos: RejectedExperiencePhoto[]) {
  const rejectedSummary = rejectedPhotos
    .slice(0, 2)
    .map(({ fileName, size }) => `${fileName} (${formatFileSize(size)})`)
    .join(", ");
  const extraCount = rejectedPhotos.length > 2 ? ` and ${rejectedPhotos.length - 2} more` : "";

  return `${rejectedSummary}${extraCount} rejected. Upload experience photos up to 2 MB.`;
}

function formatFileSize(size: number) {
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listAdminExperiences() {
  return apiRequest<{ experiences: AdminExperience[] }>(
    "/api/admin/experiences",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function getAdminExperience(id: string) {
  return apiRequest<{ experience: AdminExperience }>(
    `/api/admin/experiences/${id}`,
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function createAdminExperience(payload: ExperiencePayload) {
  return apiRequest<{ experience: AdminExperience }>(
    "/api/admin/experiences",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminExperience(
  id: string,
  payload: ExperiencePayload
) {
  return apiRequest<{ experience: AdminExperience }>(
    `/api/admin/experiences/${id}`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteAdminExperience(id: string) {
  return apiRequest<{ experience: AdminExperience }>(
    `/api/admin/experiences/${id}`,
    {
      method: "DELETE",
      headers: getAdminHeaders(),
    }
  );
}

export async function uploadExperienceMedia(
  payload: ExperienceMediaUploadPayload
) {
  const formData = new FormData();

  payload.travellerPhotoGallery?.forEach((photo) => {
    formData.append("travellerPhotoGallery", photo);
  });

  payload.travellerVideos?.forEach((video) => {
    formData.append("travellerVideos", video);
  });

  payload.attractionPhotoGallery?.forEach((photo) => {
    formData.append("attractionPhotoGallery", photo);
  });

  return readUploadResponse<ExperienceMediaUploadResponse>(
    await fetch(`${apiBaseUrl}/api/admin/experiences/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}
