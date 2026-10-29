import { apiBaseUrl, apiRequest } from "@/lib/api";

export type BlogCategory =
  | "Heritage"
  | "History"
  | "Art & Culture"
  | "Travel Guide"
  | "Destinations"
  | "Travel Tips"
  | "Uncategorized";

export type PublicBlog = {
  id: string;
  blogId: string;
  title: string;
  slug: string;
  category: BlogCategory;
  content: string;
  quote: string;
  relatedTourIds: string[];
  authorName: string;
  heroImage: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  status: "Published";
  readTimeMinutes: number;
  popularRank: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlogCategoryCount = {
  category: BlogCategory;
  count: number;
};

export type PublicBlogPreview = Pick<PublicBlog, "id" | "slug" | "title" | "heroImage" | "quote" | "publishedAt" | "category">;

export type PublicBlogsResponse = {
  blogs: PublicBlog[];
  categories: BlogCategoryCount[];
  popularPosts: PublicBlog[];
  total: number;
};

export type BlogRelatedTour = {
  tourId: string; tourName: string; durationDn: string; thumbnailImage: string; bannerImage: string;
};

export type PublicBlogResponse = {
  relatedTours: BlogRelatedTour[];
  blog: PublicBlog;
  popularPosts: PublicBlog[];
  adjacentPosts: PublicBlog[];
  currentIndex: number;
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

export async function listPublishedBlogs(options: {
  page?: number; limit?: number; category?: string; sort?: "Latest" | "Oldest";
} = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "All") params.set(key, String(value));
  }
  const query = params.toString();
  return apiRequest<PublicBlogsResponse>(`/api/blogs${query ? `?${query}` : ""}`, { cache: "no-store" });
}

export async function getPublishedBlog(slug: string) {
  return apiRequest<PublicBlogResponse>(`/api/blogs/${encodeURIComponent(slug)}`);
}
