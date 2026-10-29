import "server-only";
import { cache } from "react";
import { listPublishedBlogs, type PublicBlogPreview } from "./blogs";

// Home and footer share one public request during a server render.
export const getRecentPublishedBlogs = cache(async (): Promise<PublicBlogPreview[]> => {
  try {
    const { data } = await listPublishedBlogs({ page: 1, limit: 3, sort: "Latest" });
    return data.blogs.filter(blog => blog.status === "Published" && blog.slug && blog.title).slice(0, 3)
      .map(({ id, slug, title, heroImage, quote, publishedAt, category }) => ({ id, slug, title, heroImage, quote, publishedAt, category }));
  } catch { return []; }
});
