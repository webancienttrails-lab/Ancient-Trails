import {
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type ExperienceStatus = "Draft" | "Published";

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
  experienceId: string;
  destinationId: string;
  travellerName: string;
  travellerEmail: string;
  title: string;
  writtenReview: string;
  thingsToKnow: string[];
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  ratingItinerary: number;
  ratingLocalTransport: number;
  ratingAccommodation: number;
  ratingTourExpert: number;
  status: ExperienceStatus;
};

type ExperienceMediaUploadPayload = {
  travellerPhotoGallery?: File[];
  travellerVideos?: File[];
};

export type ExperienceMediaUploadResponse = {
  travellerPhotoGallery: string[];
  travellerVideos: string[];
};

export type RejectedExperiencePhoto = {
  fileName: string;
  height: number;
  width: number;
};

export const EXPERIENCE_PHOTO_MIN_HEIGHT = 400;
export const EXPERIENCE_PHOTO_MIN_WIDTH = 600;

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

function readImageDimensions(file: File): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      const dimensions = {
        height: image.naturalHeight,
        width: image.naturalWidth,
      };

      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read image dimensions for ${file.name}`));
    };
    image.src = objectUrl;
  });
}

export async function getUploadableExperiencePhotos(files: File[]) {
  const measuredPhotos = await Promise.all(
    files.map(async (file) => ({
      file,
      ...(await readImageDimensions(file)),
    }))
  );
  const rejectedPhotos = measuredPhotos
    .filter(
      ({ height, width }) =>
        width < EXPERIENCE_PHOTO_MIN_WIDTH || height < EXPERIENCE_PHOTO_MIN_HEIGHT
    )
    .map<RejectedExperiencePhoto>(({ file, height, width }) => ({
      fileName: file.name,
      height,
      width,
    }));
  const uploadablePhotos = measuredPhotos
    .filter(
      ({ height, width }) =>
        width >= EXPERIENCE_PHOTO_MIN_WIDTH && height >= EXPERIENCE_PHOTO_MIN_HEIGHT
    )
    .map(({ file }) => file);

  return {
    rejectedPhotos,
    uploadablePhotos,
  };
}

export function getExperiencePhotoSizeMessage(rejectedPhotos: RejectedExperiencePhoto[]) {
  const rejectedSummary = rejectedPhotos
    .slice(0, 2)
    .map(({ fileName, height, width }) => `${fileName} (${width}x${height})`)
    .join(", ");
  const extraCount = rejectedPhotos.length > 2 ? ` and ${rejectedPhotos.length - 2} more` : "";

  return `${rejectedSummary}${extraCount} rejected. Upload traveller photos at least ${EXPERIENCE_PHOTO_MIN_WIDTH}x${EXPERIENCE_PHOTO_MIN_HEIGHT}px.`;
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

  return readUploadResponse<ExperienceMediaUploadResponse>(
    await fetch(`${apiBaseUrl}/api/admin/experiences/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}
