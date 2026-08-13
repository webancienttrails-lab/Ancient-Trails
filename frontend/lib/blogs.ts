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

export type PublicBlogsResponse = {
  blogs: PublicBlog[];
  categories: BlogCategoryCount[];
  popularPosts: PublicBlog[];
  total: number;
};

export type PublicBlogResponse = {
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

export async function listPublishedBlogs() {
  return apiRequest<PublicBlogsResponse>("/api/blogs");
}

export async function getPublishedBlog(slug: string) {
  return apiRequest<PublicBlogResponse>(`/api/blogs/${slug}`);
}
