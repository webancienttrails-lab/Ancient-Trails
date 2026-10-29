import type { Metadata } from "next";

import { BlogDetailPage } from "../_components/blog-pages";
import { ApiError } from "@/lib/api";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getBlogMediaUrl, getPublishedBlog, listPublishedBlogs, type PublicBlogResponse } from "@/lib/blogs";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { articleStructuredData } from "@/lib/structured-data";

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

const getBlogDetail = cache(async (slug: string) => {
  try {
    return (await getPublishedBlog(slug)).data;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: BlogDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getBlogDetail(slug);
  if (!detail?.blog) notFound();
  const blog = detail.blog;
  const description = createDescription(blog);
  const ogTitle = blog.ogTitle || blog.seoTitle || blog.title;
  const ogImage = blog.ogImage || blog.heroImage;
  const base = pageMetadata({
    title: blog.seoTitle || blog.title,
    description,
    path: '/blog/' + encodeURIComponent(blog.slug),
    canonical: blog.canonicalUrl || undefined,
    image: ogImage ? getBlogMediaUrl(ogImage) : undefined,
    imageAlt: ogTitle,
    type: 'article',
    socialTitle: ogTitle,
    socialDescription: blog.ogDescription || description,
  });
  return {
    ...base,
    keywords: blog.seoKeywords.split(',').map(keyword => keyword.trim()).filter(Boolean),
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: blog.publishedAt || undefined,
      modifiedTime: blog.updatedAt,
      authors: blog.authorName ? [blog.authorName] : undefined,
    },
  };
}

export default async function BlogDetailRoute({ params }: BlogDetailRouteProps) {
  const { slug } = await params;
  const detail = await getBlogDetail(slug);
  if (!detail?.blog) notFound();
  const list = await listPublishedBlogs().catch(() => null);
  return <>
    <JsonLd id="article-jsonld" data={articleStructuredData(detail.blog)} />
    <BlogDetailPage key={detail.blog.id} slug={detail.blog.slug} initialData={detail} initialList={list?.data} />
  </>;
}
