import { HomePage } from "./_components/home-page";
import {
  fallbackCustomisedTours,
  fallbackTrendingDestinations,
  getHomeCustomisedTourDestinations,
  getHomeExperienceCards,
  getHomeTrendingDestinations,
  listPublicTours,
  type HomeExperienceCard,
} from "@/lib/home-travel";

export const dynamic = "force-dynamic";

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

export default async function Home() {
  let customisedTourDestinations = fallbackCustomisedTours;
  let homeExperiences: HomeExperienceCard[] = [];
  let topDestinations = fallbackTrendingDestinations;
  const tourCategories = await getTourCategories();

  try {
    topDestinations = await getHomeTrendingDestinations(8);
  } catch {
    topDestinations = fallbackTrendingDestinations;
  }

  try {
    customisedTourDestinations = await getHomeCustomisedTourDestinations(3);
  } catch {
    customisedTourDestinations = fallbackCustomisedTours;
  }

  try {
    homeExperiences = await getHomeExperienceCards(5);
  } catch {
    homeExperiences = [];
  }

  return (
    <HomePage
      customisedTourDestinations={customisedTourDestinations}
      homeExperiences={homeExperiences}
      topDestinations={topDestinations}
      tourCategories={tourCategories}
    />
  );
}
