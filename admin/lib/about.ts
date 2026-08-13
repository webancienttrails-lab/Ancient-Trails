import {
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type AboutStatIcon =
  | "BookOpen"
  | "CalendarDays"
  | "Globe2"
  | "MapPin"
  | "Users";

export type AboutStat = {
  id: string;
  label: string;
  value: string;
  icon: AboutStatIcon;
  sortOrder: number;
};

export type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
  sortOrder: number;
};

export type AboutPageContent = {
  id: string;
  stats: AboutStat[];
  teamMembers: AboutTeamMember[];
  createdAt: string;
  updatedAt: string;
};

export type AboutPagePayload = {
  stats: Array<Omit<AboutStat, "id">>;
  teamMembers: Array<Omit<AboutTeamMember, "id">>;
};

export type AboutImageUploadResponse = {
  image: string;
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

export function getAboutMediaUrl(source: string): string {
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

export async function getAdminAboutPage() {
  return apiRequest<{ about: AboutPageContent }>("/api/admin/about", {
    headers: getAdminHeaders(),
  });
}

export async function updateAdminAboutPage(payload: AboutPagePayload) {
  return apiRequest<{ about: AboutPageContent }>("/api/admin/about", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function uploadAboutImage(image: File) {
  const formData = new FormData();

  formData.append("image", image);

  return readUploadResponse<AboutImageUploadResponse>(
    await fetch(`${apiBaseUrl}/api/admin/about/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}
