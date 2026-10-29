import { HomePage } from "./(home)/_components/home-page";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationStructuredData } from "@/lib/structured-data";
import { getPublicSiteSettings } from "@/lib/site-settings";
import { getRecentPublishedBlogs } from "@/lib/server-blog";

export const metadata = pageMetadata({
  title: "Heritage Tours & Cultural Journeys",
  description: "Discover India's heritage and the world's cultural treasures with Ancient Trails. Explore expert-led tours, historic places and thoughtfully planned journeys.",
  path: "/",
});
import {
  fallbackCustomisedTours,
  fallbackTrendingDestinations,
  getHomeCustomisedTourDestinations,
  getHomeExperienceCards,
  getHomeTrendingDestinations,
  getHomeUpcomingTours,
  listPublicTours,
  type HomeExperienceCard,
} from "@/lib/home-travel";

export const revalidate = 60;

const fallbackTourCategories = [
  "Heritage",
  "Monuments",
  "Temples",
  "Adventure",
  "Architecture",
  "Culture",
  "Nature",
  "Festival Trails",
];

function splitLabels(value: string) {
  return value
    .split(/[,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getTourCategories() {
  try {
    const toursResponse = await listPublicTours();
    const categories = new Map<string, string>();

    toursResponse.data.tours.forEach((tour) => {
      [...splitLabels(tour.category), ...splitLabels(tour.tourType)].forEach(
        (label) => {
          const key = label.toLowerCase();

          if (key && !categories.has(key)) {
            categories.set(key, label);
          }
        }
      );
    });

    return categories.size > 0
      ? Array.from(categories.values())
      : fallbackTourCategories;
  } catch {
    return fallbackTourCategories;
  }
}

async function withFallback<T>(request: Promise<T>, fallback: T) {
  try {
    return await request;
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const [
    tourCategories,
    topDestinations,
    customisedTourDestinations,
    homeExperiences,
    upcomingTours,
    siteSettings,
    recentPosts,
  ] = await Promise.all([
    getTourCategories(),
    withFallback(getHomeTrendingDestinations(8), fallbackTrendingDestinations),
    withFallback(getHomeCustomisedTourDestinations(6), fallbackCustomisedTours),
    withFallback<HomeExperienceCard[]>(getHomeExperienceCards(5), []),
    withFallback(getHomeUpcomingTours(6), []),
    getPublicSiteSettings().catch(() => null),
    getRecentPublishedBlogs(),
  ]);

  return (
    <>
    <JsonLd id="organization-jsonld" data={organizationStructuredData(siteSettings?.data.settings ?? null)} />
    <HomePage
      recentPosts={recentPosts}
      upcomingTours={upcomingTours}
      customisedTourDestinations={customisedTourDestinations}
      homeExperiences={homeExperiences}
      topDestinations={topDestinations}
      tourCategories={tourCategories}
    />
    </>
  );
}
