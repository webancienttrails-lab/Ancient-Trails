import { HomePage } from "./(home)/_components/home-page";
import {
  fallbackCustomisedTours,
  fallbackTrendingDestinations,
  getHomeCustomisedTourDestinations,
  getHomeExperienceCards,
  getHomeTrendingDestinations,
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
  ] = await Promise.all([
    getTourCategories(),
    withFallback(getHomeTrendingDestinations(8), fallbackTrendingDestinations),
    withFallback(getHomeCustomisedTourDestinations(6), fallbackCustomisedTours),
    withFallback<HomeExperienceCard[]>(getHomeExperienceCards(5), []),
  ]);

  return (
    <HomePage
      customisedTourDestinations={customisedTourDestinations}
      homeExperiences={homeExperiences}
      topDestinations={topDestinations}
      tourCategories={tourCategories}
    />
  );
}
