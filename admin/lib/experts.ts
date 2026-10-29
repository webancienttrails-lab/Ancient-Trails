import {
  sessionFetch,
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type AdminExpert = {
  id: string;
  expertId: string;
  fullName: string;
  image: string;
  fullBiography: string;
  expertiseTags: string[];
  qualifications: string[];
  languages: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExpertPayload = {
  expertId: string;
  fullName: string;
  image: string;
  fullBiography: string;
  expertiseTags: string[];
  qualifications: string[];
  languages: string[];
};

export type ExpertImageUploadResponse = {
  image: string;
};

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.sessionId) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    "X-Session-Id": session.sessionId,
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

export function getExpertMediaUrl(source: string): string {
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

export async function listAdminExperts() {
  return apiRequest<{ experts: AdminExpert[] }>("/api/admin/experts", {
    headers: getAdminHeaders(),
  });
}

export async function createAdminExpert(payload: ExpertPayload) {
  return apiRequest<{ expert: AdminExpert }>("/api/admin/experts", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminExpert(
  id: string,
  payload: ExpertPayload
) {
  return apiRequest<{ expert: AdminExpert }>(`/api/admin/experts/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminExpert(id: string) {
  return apiRequest<{ expert: AdminExpert }>(`/api/admin/experts/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function uploadExpertImage(image: File) {
  const formData = new FormData();

  formData.append("image", image);

  return readUploadResponse<ExpertImageUploadResponse>(
    await sessionFetch(`${apiBaseUrl}/api/admin/experts/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}
