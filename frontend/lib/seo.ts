import type { Metadata } from "next";
import { getSiteOrigin } from "./site-origin";

export function plainText(value: string): string {
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function shorten(value: string, limit: number) {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit - 1);
  const space = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, space >= limit - 18 ? space : undefined).trimEnd()}…`;
}

export function pageMetadata({ title, description, path, image, imageAlt, canonical, type = "website", socialTitle, socialDescription }: {
  title: string; description: string; path: string; image?: string; imageAlt?: string;
  canonical?: string; type?: "website" | "article"; socialTitle?: string; socialDescription?: string;
}): Metadata {
  const origin = getSiteOrigin();
  const name = plainText(title).replace(/\s*\|\s*Ancient Trails$/i, "");
  const fullTitle = `${shorten(name, 43)} | Ancient Trails`;
  let summary = plainText(description);
  if (summary.length < 120) summary += " Explore heritage, history and culture with Ancient Trails, with expert-led journeys, carefully planned itineraries and memorable places.";
  summary = shorten(summary, 155);
  const url = new URL(canonical || path, origin).href;
  const photo = new URL(image || "/home assets/Heritage Banner.webp", origin).href;
  const previewTitle = socialTitle ? plainText(socialTitle) : fullTitle;
  const previewDescription = socialDescription ? shorten(plainText(socialDescription), 155) : summary;
  return {
    title: { absolute: fullTitle },
    description: summary,
    alternates: { canonical: url },
    openGraph: { title: previewTitle, description: previewDescription, url, type,
      siteName: "Ancient Trails", images: [{ url: photo, alt: imageAlt || name }] },
    twitter: { card: "summary_large_image", title: previewTitle, description: previewDescription,
      images: [{ url: photo, alt: imageAlt || name }] },
  };
}

export const privatePageRobots: Metadata["robots"] = { index: false, follow: false };
