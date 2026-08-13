import type { Metadata } from "next";

import { BlogDetailPage } from "../_components/blog-pages";
import { apiBaseUrl } from "@/lib/api";
import { getBlogMediaUrl, type PublicBlogResponse } from "@/lib/blogs";

type BlogDetailRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

function createPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createDescription(blog: PublicBlogResponse["blog"]): string {
  const fallbackDescription =
    createPlainText(blog.quote) || createPlainText(blog.content);

  return (
    blog.seoDescription ||
    fallbackDescription.slice(0, 160) ||
    "Heritage travel stories from Ancient Trails."
  );
}

export async function generateMetadata({
  params,
}: BlogDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const response = await fetch(`${apiBaseUrl}/api/blogs/${slug}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const body = (await response.json()) as {
        data?: PublicBlogResponse;
      };
      const blog = body.data?.blog;

      if (blog) {
        const description = createDescription(blog);
        const ogTitle = blog.ogTitle || blog.seoTitle || blog.title;
        const ogDescription = blog.ogDescription || description;
        const ogImage = blog.ogImage || blog.heroImage;

        return {
          title: blog.seoTitle || blog.title || "Travel Blog",
          description,
          keywords: blog.seoKeywords
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          alternates: blog.canonicalUrl
            ? {
                canonical: blog.canonicalUrl,
              }
            : undefined,
          openGraph: {
            title: ogTitle,
            description: ogDescription,
            type: "article",
            publishedTime: blog.publishedAt || undefined,
            modifiedTime: blog.updatedAt,
            authors: blog.authorName ? [blog.authorName] : undefined,
            images: ogImage
              ? [
                  {
                    url: getBlogMediaUrl(ogImage),
                    alt: ogTitle,
                  },
                ]
              : undefined,
          },
        };
      }
    }
  } catch {
    // Keep generic metadata when the API is unavailable during static builds.
  }

  return {
    title: "Travel Blog",
    description: "Heritage travel stories from Ancient Trails.",
  };
}

export default async function BlogDetailRoute({ params }: BlogDetailRouteProps) {
  const { slug } = await params;

  return <BlogDetailPage slug={slug} />;
}
