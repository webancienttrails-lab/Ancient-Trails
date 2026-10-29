import type { MetadataRoute } from "next";
import { apiBaseUrl } from "@/lib/api";
import type { PublicTour, PublicDestination, PublicExperience } from "@/lib/home-travel";
import type { PublicBlogsResponse } from "@/lib/blogs";
import { getTourHref, getDestinationHref, getExperienceHref } from "@/lib/routes";
import { getSiteOrigin } from "@/lib/site-origin";

export const revalidate = 3600;

async function readPublicData<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Unable to generate sitemap: ${path} returned ${response.status}`);
  const body = await response.json() as { success: boolean; data: T };
  if (!body.success || !body.data) throw new Error(`Invalid sitemap data from ${path}`);
  return body.data;
}

async function getAllBlogs() {
  const first = await readPublicData<PublicBlogsResponse>("/api/blogs?page=1&limit=100");
  const blogs = [...first.blogs];
  // The public API caps each page at 100; include older published posts too.
  for (let page = 2; (page - 1) * 100 < first.total; page++) {
    const next = await readPublicData<PublicBlogsResponse>(`/api/blogs?page=${page}&limit=100`);
    blogs.push(...next.blogs);
  }
  return blogs;
}

function lastModified(value: string): { lastModified?: string } {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? { lastModified: new Date(timestamp).toISOString() } : {};
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const [tours, destinations, experiences, blogs] = await Promise.all([
    readPublicData<{ tours: PublicTour[] }>("/api/tours"),
    readPublicData<{ destinations: PublicDestination[] }>("/api/destinations"),
    readPublicData<{ experiences: PublicExperience[] }>("/api/experiences"),
    getAllBlogs(),
  ]);
  const staticPaths = [
    "/", "/about", "/contact", "/faq", "/tours", "/short-trails",
    "/specialised-tours", "/destinations", "/tour-calendar", "/experts",
    "/experiences", "/blog", "/privacy-policy", "/terms-and-conditions",
  ];
  const entries: MetadataRoute.Sitemap = [
    ...staticPaths.map(path => ({ url: `${origin}${path === "/" ? "" : path}` })),
    ...tours.tours.map(tour => ({ url: `${origin}${getTourHref(tour)}`, ...lastModified(tour.updatedAt) })),
    ...destinations.destinations.map(destination => ({ url: `${origin}${getDestinationHref(destination)}`, ...lastModified(destination.updatedAt) })),
    ...experiences.experiences.filter(experience => experience.status === "Published").map(experience => ({ url: `${origin}${getExperienceHref(experience)}`, ...lastModified(experience.updatedAt) })),
    ...blogs.filter(blog => blog.status === "Published" && blog.slug).map(blog => ({ url: `${origin}/blog/${encodeURIComponent(blog.slug)}`, ...lastModified(blog.updatedAt) })),
  ];
  // A shared name can produce the same canonical slug for more than one record.
  return Array.from(new Map(entries.map(entry => [entry.url, entry])).values());
}
