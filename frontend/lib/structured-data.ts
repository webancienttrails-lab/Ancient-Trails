import { getSiteOrigin } from "./site-origin";
import { plainText } from "./seo";
import { getHomeMediaUrl, type PublicTour, type PublicTourDeparture, type PublicTourItinerary, type PublicDestination } from "./home-travel";
import { getTourHref } from "./routes";
import { getNextBookableDeparture } from "./tour-departures";
import type { FaqCategory } from "./faq";
import type { SiteSettings } from "./site-settings";
import type { PublicBlog } from "./blogs";

function absoluteUrl(value: string) {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value, getSiteOrigin());
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

const organizationId = () => `${getSiteOrigin()}/#organization`;

export function articleStructuredData(blog: PublicBlog) {
  const url = new URL(blog.canonicalUrl || `/blog/${encodeURIComponent(blog.slug)}`, getSiteOrigin()).href;
  const image = absoluteUrl(getHomeMediaUrl(blog.heroImage || blog.ogImage || ""));
  const published = blog.publishedAt ? Date.parse(blog.publishedAt) : NaN;
  const modified = blog.updatedAt ? Date.parse(blog.updatedAt) : NaN;
  return {
    "@context": "https://schema.org", "@type": "Article", "@id": `${url}#article`, url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: blog.title,
    description: plainText(blog.seoDescription || blog.quote || blog.content).slice(0, 155),
    publisher: { "@id": organizationId() },
    ...(blog.authorName?.trim() ? { author: { "@type": "Person", name: blog.authorName.trim() } } : {}),
    ...(image ? { image: [image] } : {}),
    ...(Number.isFinite(published) ? { datePublished: new Date(published).toISOString() } : {}),
    ...(Number.isFinite(modified) ? { dateModified: new Date(modified).toISOString() } : {}),
  };
}

export function websiteStructuredData() {
  return { "@context": "https://schema.org", "@type": "WebSite",
    "@id": `${getSiteOrigin()}/#website`, name: "Ancient Trails", url: `${getSiteOrigin()}/`,
    publisher: { "@id": organizationId() } };
}

export function organizationStructuredData(settings: SiteSettings | null) {
  const logo = settings?.logo ? absoluteUrl(getHomeMediaUrl(settings.logo)) : undefined;
  const sameAs = Object.values(settings?.socialLinks ?? {}).map(value => absoluteUrl(value)).filter(Boolean);
  return {
    "@context": "https://schema.org", "@type": "Organization", "@id": organizationId(),
    name: "Ancient Trails", url: `${getSiteOrigin()}/`,
    ...(logo ? { logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(settings?.contact.emailId ? { email: settings.contact.emailId } : {}),
    ...(settings?.contact.primaryCalling ? { telephone: settings.contact.primaryCalling } : {}),
    ...(settings?.contact.officeAddress ? { address: settings.contact.officeAddress } : {}),
  };
}

export function tourStructuredData(tour: PublicTour, departures: PublicTourDeparture[], itinerary: PublicTourItinerary | null, destinations: PublicDestination[]) {
  const url = `${getSiteOrigin()}${getTourHref(tour)}`;
  const departure = getNextBookableDeparture(departures.filter(item => item.tourId === tour.tourId));
  const image = absoluteUrl(getHomeMediaUrl(tour.bannerImage || tour.thumbnailImage || tour.galleryImages[0] || ""));
  const places = Array.from(new Set((itinerary?.days.length
    ? [...itinerary.days].sort((a, b) => a.dayNumber - b.dayNumber).flatMap(day => day.placesVisited)
    : destinations.map(destination => destination.destinationName)).map(plainText).filter(Boolean)));
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "TouristTrip", "@id": `${url}#trip`, url, name: tour.tourName,
        description: plainText(tour.description), provider: { "@id": organizationId() },
        ...(image ? { image } : {}),
        ...(places.length ? { itinerary: { "@type": "ItemList", itemListElement: places.map((name, index) => ({
          "@type": "ListItem", position: index + 1, item: { "@type": "Place", name },
        })) } } : {}),
        ...(departure ? { offers: { "@type": "Offer", url, priceCurrency: "INR", price: departure.priceAdult,
          availability: "https://schema.org/InStock", seller: { "@id": organizationId() } } } : {}),
      },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumbs`, itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${getSiteOrigin()}/` },
        { "@type": "ListItem", position: 2, name: "Tours", item: `${getSiteOrigin()}/tours` },
        { "@type": "ListItem", position: 3, name: tour.tourName, item: url },
      ] },
    ],
  };
}

export function faqStructuredData(categories: FaqCategory[]) {
  const questions = new Map<string, { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }>();
  for (const item of categories.flatMap(category => category.items)) {
    const name = plainText(item.question), text = plainText(item.answer);
    if (name && text && !questions.has(name)) questions.set(name, { "@type": "Question", name,
      acceptedAnswer: { "@type": "Answer", text } });
  }
  if (!questions.size) return null;
  return { "@context": "https://schema.org", "@type": "FAQPage", "@id": `${getSiteOrigin()}/faq#faq`,
    url: `${getSiteOrigin()}/faq`, mainEntity: Array.from(questions.values()) };
}
