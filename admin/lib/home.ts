import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type HomeUpcomingTourSetting = {
  id: string;
  departureId: string;
  sortOrder: number;
  tourId: string;
};

export type HomeTrendingDestinationSetting = {
  id: string;
  destinationId: string;
  markerX: number;
  markerY: number;
  sortOrder: number;
};

export type HomeCustomisedTourDestinationSetting = {
  id: string;
  destinationId: string;
  sortOrder: number;
};

export type HomeExperienceSetting = {
  id: string;
  experienceId: string;
  sortOrder: number;
};

export type HomePageContent = {
  id: string;
  upcomingTours: HomeUpcomingTourSetting[];
  trendingDestinations: HomeTrendingDestinationSetting[];
  customisedTourDestinations: HomeCustomisedTourDestinationSetting[];
  homeExperiences: HomeExperienceSetting[];
  createdAt: string;
  updatedAt: string;
};

export type HomePagePayload = {
  upcomingTours: Array<Omit<HomeUpcomingTourSetting, "id">>;
  trendingDestinations: Array<Omit<HomeTrendingDestinationSetting, "id">>;
  customisedTourDestinations: Array<
    Omit<HomeCustomisedTourDestinationSetting, "id">
  >;
  homeExperiences: Array<Omit<HomeExperienceSetting, "id">>;
};

type MarkerDestination = {
  city: string;
  countryRegion: string;
  destinationName: string;
  primaryHeritageFocus: string;
  state: string;
};

const legacyMarkerPositions = [
  { markerX: 36, markerY: 34 },
  { markerX: 42, markerY: 45 },
  { markerX: 57, markerY: 38 },
  { markerX: 49, markerY: 61 },
  { markerX: 54, markerY: 50 },
  { markerX: 32, markerY: 24 },
  { markerX: 51, markerY: 69 },
  { markerX: 61, markerY: 57 },
];

const fallbackMarkerPositions = [
  { markerX: 43.3, markerY: 42.5 },
  { markerX: 41.9, markerY: 52.1 },
  { markerX: 64.1, markerY: 49.7 },
  { markerX: 51.2, markerY: 74.8 },
  { markerX: 58.2, markerY: 56.5 },
  { markerX: 37.2, markerY: 28.2 },
  { markerX: 51.6, markerY: 73.1 },
  { markerX: 49.6, markerY: 69.4 },
];

const keywordMarkerPositions: Array<{
  keywords: string[];
  markerX: number;
  markerY: number;
}> = [
  { keywords: ["amritsar", "punjab"], markerX: 37.2, markerY: 28.2 },
  { keywords: ["leh", "ladakh"], markerX: 47.8, markerY: 21.8 },
  { keywords: ["delhi"], markerX: 45.3, markerY: 36.4 },
  { keywords: ["agra"], markerX: 47.6, markerY: 42.6 },
  { keywords: ["jaipur"], markerX: 43.3, markerY: 42.5 },
  { keywords: ["udaipur"], markerX: 41.9, markerY: 52.1 },
  { keywords: ["ajanta"], markerX: 49.4, markerY: 60.5 },
  { keywords: ["ellora"], markerX: 49.7, markerY: 62.5 },
  { keywords: ["badami"], markerX: 49.6, markerY: 69.4 },
  { keywords: ["hampi"], markerX: 51.2, markerY: 74.8 },
  {
    keywords: ["hoysala", "hoysalas", "belur", "halebidu"],
    markerX: 51.6,
    markerY: 73.1,
  },
  { keywords: ["khajuraho"], markerX: 58.2, markerY: 56.5 },
  { keywords: ["varanasi", "banaras", "kashi"], markerX: 64.1, markerY: 49.7 },
  { keywords: ["bodhgaya", "gaya"], markerX: 63.2, markerY: 53.8 },
  { keywords: ["kolkata", "west bengal"], markerX: 70.1, markerY: 56.2 },
  { keywords: ["puri", "odisha"], markerX: 63.5, markerY: 64.7 },
  { keywords: ["mumbai"], markerX: 43.8, markerY: 63.2 },
  { keywords: ["goa"], markerX: 46.7, markerY: 70.7 },
  { keywords: ["hyderabad"], markerX: 53.7, markerY: 65.8 },
  { keywords: ["bengaluru", "bangalore", "mysore"], markerX: 52.1, markerY: 76.5 },
  { keywords: ["chennai"], markerX: 56.3, markerY: 79.9 },
  { keywords: ["madurai"], markerX: 54.2, markerY: 87.5 },
  { keywords: ["kochi", "cochin", "kerala"], markerX: 49.2, markerY: 83.5 },
  { keywords: ["rajasthan"], markerX: 42.6, markerY: 45.8 },
  { keywords: ["karnataka"], markerX: 51.1, markerY: 72.6 },
  { keywords: ["madhya pradesh"], markerX: 55.2, markerY: 55.2 },
  { keywords: ["uttar pradesh"], markerX: 58.8, markerY: 47.8 },
  { keywords: ["maharashtra"], markerX: 49.2, markerY: 62.6 },
  { keywords: ["gujarat"], markerX: 38.7, markerY: 55.6 },
  { keywords: ["tamil nadu"], markerX: 55.2, markerY: 84.5 },
];

function getMarkerSearchText(destination: MarkerDestination) {
  return [
    destination.destinationName,
    destination.city,
    destination.state,
    destination.countryRegion,
    destination.primaryHeritageFocus,
  ]
    .join(" ")
    .toLowerCase();
}

export function getDefaultDestinationMarker(
  destination: MarkerDestination,
  index = 0
) {
  const markerText = getMarkerSearchText(destination);
  const matchedPosition = keywordMarkerPositions.find((position) =>
    position.keywords.some((keyword) => markerText.includes(keyword))
  );

  if (matchedPosition) {
    return {
      markerX: matchedPosition.markerX,
      markerY: matchedPosition.markerY,
    };
  }

  return fallbackMarkerPositions[index % fallbackMarkerPositions.length];
}

export function isLegacyDestinationMarker(
  markerX: number,
  markerY: number,
  index: number
) {
  const legacyPosition = legacyMarkerPositions[index];

  if (!legacyPosition) {
    return false;
  }

  return (
    Math.abs(markerX - legacyPosition.markerX) < 0.2 &&
    Math.abs(markerY - legacyPosition.markerY) < 0.2
  );
}

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.token) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export async function getAdminHomePage() {
  return apiRequest<{ home: HomePageContent }>("/api/admin/home", {
    headers: getAdminHeaders(),
  });
}

export async function updateAdminHomePage(payload: HomePagePayload) {
  return apiRequest<{ home: HomePageContent }>("/api/admin/home", {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}
