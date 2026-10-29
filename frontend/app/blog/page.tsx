import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { listPublishedBlogs, type BlogCategory } from "@/lib/blogs";
import { BLOG_PAGE_SIZE, getBlogPageCount, parseBlogPage } from "@/lib/blog-pagination";

import { BlogListPage } from "./_components/blog-pages";

type BlogSearchParams = { page?: string | string[]; category?: string; sort?: string };

export async function generateMetadata({ searchParams }: { searchParams?: Promise<BlogSearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const page = parseBlogPage(params?.page);
  if (page === null) notFound();
  const query = new URLSearchParams();
  if (params?.category && params.category !== "All") query.set("category", params.category);
  if (params?.sort === "Oldest") query.set("sort", "Oldest");
  if (page > 1) query.set("page", String(page));
  const category = params?.category && params.category !== "All" ? `${params.category} ` : "";
  return pageMetadata({
    title: `${category}Travel Blog${page > 1 ? ` - Page ${page}` : ""}`,
    description: `Explore ${category.toLowerCase()}stories, destination guides and heritage travel inspiration from Ancient Trails${page > 1 ? ` on page ${page}` : ""}. Discover historic places, local culture and memorable journeys.`,
    path: `/blog${query.size ? `?${query}` : ""}`,
  });
}

export default async function BlogPage({ searchParams }: {
  searchParams?: Promise<{ page?: string | string[]; category?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = parseBlogPage(params?.page);
  const category = params?.category || "All";
  const sort = params?.sort || "Latest";
  const categories = ["All", "Heritage", "History", "Art & Culture", "Travel Guide", "Destinations", "Travel Tips", "Uncategorized"];
  if (page === null || !categories.includes(category) || !["Latest", "Oldest"].includes(sort)) notFound();

  const { data } = await listPublishedBlogs({ page, limit: BLOG_PAGE_SIZE, category, sort: sort as "Latest" | "Oldest" });
  const totalPages = getBlogPageCount(data.total);
  if (page > Math.max(1, totalPages)) notFound();

  return <BlogListPage data={data} currentPage={page} totalPages={totalPages} selectedCategory={category as BlogCategory | "All"} sortMode={sort as "Latest" | "Oldest"} />;
}
