import {
  apiBaseUrl,
  apiRequest,
  ApiError,
  type ApiResponse,
} from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type BlogCategory =
  | "Heritage"
  | "History"
  | "Art & Culture"
  | "Travel Guide"
  | "Destinations"
  | "Travel Tips"
  | "Uncategorized";

export type BlogStatus = "Published" | "Draft" | "Archived";

export type AdminBlog = {
  id: string;
  blogId: string;
  title: string;
  slug: string;
  category: BlogCategory;
  content: string;
  quote: string;
  authorName: string;
  heroImage: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  status: BlogStatus;
  readTimeMinutes: number;
  popularRank: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlogPayload = {
  blogId: string;
  title: string;
  slug: string;
  category: BlogCategory;
  content: string;
  quote: string;
  authorName: string;
  heroImage: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  status: BlogStatus;
  readTimeMinutes: number;
  popularRank: number;
  publishedAt: string;
};

type BlogImageUploadPayload = {
  heroImage?: File;
};

export type BlogImageUploadResponse = {
  heroImage: string;
};

export function getBlogMediaUrl(source: string): string {
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

export async function listAdminBlogs() {
  return apiRequest<{ blogs: AdminBlog[] }>("/api/admin/blogs", {
    headers: getAdminHeaders(),
  });
}

export async function getAdminBlog(id: string) {
  return apiRequest<{ blog: AdminBlog }>(`/api/admin/blogs/${id}`, {
    headers: getAdminHeaders(),
  });
}

export async function createAdminBlog(payload: BlogPayload) {
  return apiRequest<{ blog: AdminBlog }>("/api/admin/blogs", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBlog(id: string, payload: BlogPayload) {
  return apiRequest<{ blog: AdminBlog }>(`/api/admin/blogs/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBlog(id: string) {
  return apiRequest<{ blog: AdminBlog }>(`/api/admin/blogs/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function uploadBlogImages(payload: BlogImageUploadPayload) {
  const formData = new FormData();

  if (payload.heroImage) {
    formData.append("heroImage", payload.heroImage);
  }

  return readUploadResponse<BlogImageUploadResponse>(
    await fetch(`${apiBaseUrl}/api/admin/blogs/upload`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: formData,
      credentials: "include",
    })
  );
}
