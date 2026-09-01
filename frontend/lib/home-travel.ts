import { apiBaseUrl, apiRequest } from "@/lib/api";

export type PublicTour = {
  id: string;
  tourId: string;
  tourName: string;
  tourType: string;
  tourFormat: string;
  destinationId: string;
  destinationIds: string[];
  durationDn: string;
  category: string;
  isBestseller: boolean;
  difficulty: string;
  bestSeason: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  expertId: string;
  notes: string;
  thumbnailImage?: string;
  bannerImage: string;
  galleryImages: string[];
  video: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicTourDeparture = {
  id: string;
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: string | null;
  returnDate: string | null;
  seatsAvailable: number;
  filledSeats?: number;
  totalSeats?: number;
  priceAdult: number;
  priceExtraBed: number;
  priceChildWithoutExtraBed: number;
  singleOccupancy: number;
  depositType: "fixed" | "percentage";
  depositValue: number;
  depositAppliesTo: "per_person" | "per_booking";
  balanceDueDaysBefore: number;
  earlyBirdOffer: string | null;
  bookingDeadline: string | null;
  status: "scheduled" | "coming_soon" | "closed" | "cancelled";
  childPricingRules: Array<{
    minAge: number;
    maxAge: number;
    allowExtraBed: boolean;
    allowWithoutExtraBed: boolean;
  }>;
  roomPolicy?: {
    allowChildBedSharing: boolean;
    maxChildrenWithoutExtraBedPerRoom: number;
    allowExtraBed: boolean;
    allowChildSingleRoom: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type PublicTourItineraryDay = {
  dayNumber: number;
  title: string;
  summary: string;
  placesVisited: string[];
  transport: string;
  walkingDifficulty: string;
  meals: string;
};

export type PublicTourItinerary = {
  id: string;
  tourId: string;
  itinerarySummary: string;
  days: PublicTourItineraryDay[];
  createdAt: string;
  updatedAt: string;
};

export type PublicExpert = {
  id: string;
  expertId: string;
  fullName: string;
  image: string;
  fullBiography: string;
  expertiseTags: string[];
  qualifications: string[];
  languages: string[];
  createdAt: string;
  updatedAt: string;
};

export type PublicDestination = {
  id: string;
  destinationId: string;
  destinationName: string;
  destinationType: "Domestic" | "International";
  countryRegion: string;
  region?: string;
  state: string;
  city: string;
  primaryHeritageFocus: string;
  bestTimeToVisit?: string;
  unescoSite: boolean;
  keyLandmarks: string[];
  keyLandmarkImages?: string[];
  recommendedDurationDays: number;
  shortDescription: string;
  dressCode: string;
  footwear: string;
  permits: string;
  idRequirement: string;
  restrictions: string;
  thumbnailImage?: string;
  bannerImage: string;
  galleryImages: string[];
  createdAt: string;
  updatedAt: string;
};

export type PublicExperienceAttractionPhoto = {
  image: string;
  name: string;
};

export type PublicExperience = {
  id: string;
  experienceId: string;
  destinationId: string;
  destinationName: string;
  travellerName: string;
  travellerEmail: string;
  title?: string;
  writtenReview: string;
  thingsToKnow: string[];
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  travellerVideoTitles: string[];
  attractionPhotoGallery: PublicExperienceAttractionPhoto[];
  ratingItinerary: number;
  ratingLocalTransport: number;
  ratingAccommodation: number;
  ratingTourExpert: number;
  overallRating: number;
  status: "Draft" | "Published";
  createdAt: string;
  updatedAt: string;
};

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

export type PublicMegaMenuReference = {
  id: string;
  referenceId: string;
  sortOrder: number;
};

export type PublicMegaMenuTourReference = PublicMegaMenuReference & {
  description: string;
  image: string;
  tourId: string;
  tourName: string;
};

export type PublicMegaMenuDestinationReference = PublicMegaMenuReference & {
  city: string;
  countryRegion: string;
  description: string;
  destinationId: string;
  destinationName: string;
  href: string;
  image: string;
  state: string;
  title: string;
};

export type PublicMegaMenuContent = {
  id: string;
  tourMenu: {
    heritageTours: PublicMegaMenuTourReference[];
    shortTrails: PublicMegaMenuTourReference[];
  };
  destinationMenu: {
    india: PublicMegaMenuDestinationReference[];
    international: PublicMegaMenuDestinationReference[];
    topCities: PublicMegaMenuDestinationReference[];
  };
  createdAt: string;
  updatedAt: string;
};

export type HomeTourCard = {
  date: string;
  destinationId: string;
  duration: string;
  image: string;
  title: string;
  tourId: string;
};

export type HomeDestinationCard = {
  bestSeason: string;
  description: string;
  destinationId: string;
  duration: string;
  focus: string;
  image: string;
  landmarks: string[];
  markerX: number;
  markerY: number;
  name: string;
  state: string;
  tourImage: string;
  tourName: string;
};

export type HomeCustomisedTourCard = {
  destinationId: string;
  image: string;
  tags: string[];
  title: string;
};

export type HomeExperienceCard = {
  attractionPhotoGallery: PublicExperienceAttractionPhoto[];
  destinationId: string;
  destinationName: string;
  id: string;
  experienceId: string;
  image: string;
  rating: number;
  review: string;
  title: string;
  travellerPhotoGallery: string[];
  travellerVideos: string[];
  travellerVideoTitles: string[];
  travelledMonth: string;
  travellerName: string;
  type: "Album" | "Video";
  featured?: boolean;
};

export const fallbackUpcomingTours: HomeTourCard[] = [
  {
    title: "Khajuraho",
    duration: "6 Days/ 5 Nights",
    date: "16 Jul 2026",
    image: "/home assets/Khajuraho.webp",
    destinationId: "KHAJURAHO",
    tourId: "KHAJURAHO",
  },
  {
    title: "Incredible Indonesia",
    duration: "9 Days/ 8 Nights",
    date: "8 Jul 2026",
    image: "/home assets/Indonesia.webp",
    destinationId: "INDONESIA",
    tourId: "INDONESIA",
  },
  {
    title: "Combodia",
    duration: "7 Days/ 6 Nights",
    date: "23 Aug 2026",
    image: "/home assets/Combodia.webp",
    destinationId: "COMBODIA",
    tourId: "COMBODIA",
  },
  {
    title: "Leisurely Hampi",
    duration: "6 Days/ 5 Nights",
    date: "23 Aug 2026",
    image: "/home assets/Haridwar.webp",
    destinationId: "HAMPI",
    tourId: "HAMPI",
  },
  {
    title: "Vibrant Vietnam",
    duration: "9 Days/ 8 Nights",
    date: "4 Dec 2026",
    image: "/home assets/Vietnam.webp",
    destinationId: "VIETNAM",
    tourId: "VIETNAM",
  },
  {
    title: "Mystical Egypt",
    duration: "9 Days/ 8 Nights",
    date: "14 Nov 2026",
    image: "/home assets/Egypt.webp",
    destinationId: "EGYPT",
    tourId: "EGYPT",
  },
];

export const fallbackCustomisedTours: HomeCustomisedTourCard[] = [
  {
    title: "Kashmir",
    image: "/home assets/Haridwar.webp",
    tags: ["Spiritual", "Nature"],
    destinationId: "KASHMIR",
  },
  {
    title: "Rajasthan",
    image: "/home assets/destination/hawa-mahal.webp",
    tags: ["Heritage", "Architecture"],
    destinationId: "RAJASTHAN",
  },
  {
    title: "Shimla",
    image: "/home assets/destination/Amritsar.webp",
    tags: ["Winters", "Honeymoon"],
    destinationId: "SHIMLA",
  },
];

export const fallbackTrendingDestinations: HomeDestinationCard[] = [
  {
    name: "Jaipur",
    state: "Rajasthan",
    image: "/home assets/destination/hawa-mahal.webp",
    destinationId: "JAIPUR",
    focus: "",
    markerX: 43.3,
    markerY: 42.5,
    description:
      "The Pink City of India, known for its royal palaces, forts, vibrant bazaars and rich cultural heritage.",
    duration: "12+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Top Attraction", "12+ Places"],
    tourName: "Explore Jaipur",
    tourImage: "/home assets/destination/hawa-mahal.webp",
  },
  {
    name: "Udaipur",
    state: "Rajasthan",
    image: "/home assets/destination/Udaipur.webp",
    destinationId: "UDAIPUR",
    focus: "",
    markerX: 41.9,
    markerY: 52.1,
    description:
      "A graceful city of lakes, palaces and old-world streets shaped for relaxed heritage travel.",
    duration: "8+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Lake City", "8+ Places"],
    tourName: "Explore Udaipur",
    tourImage: "/home assets/destination/Udaipur.webp",
  },
  {
    name: "Varanasi",
    state: "Uttar Pradesh",
    image: "/home assets/destination/Varanasi.webp",
    destinationId: "VARANASI",
    focus: "",
    markerX: 64.1,
    markerY: 49.7,
    description:
      "A timeless riverside destination of ghats, temples, rituals and living cultural memory.",
    duration: "10+ Places",
    bestSeason: "Nov - Feb",
    landmarks: ["Sacred Ghats", "10+ Places"],
    tourName: "Explore Varanasi",
    tourImage: "/home assets/destination/Varanasi.webp",
  },
  {
    name: "Hampi",
    state: "Karnataka",
    image: "/home assets/destination/Hampi.webp",
    destinationId: "HAMPI",
    focus: "",
    markerX: 51.2,
    markerY: 74.8,
    description:
      "A dramatic landscape of ruins, boulders and temple complexes from the Vijayanagara era.",
    duration: "9+ Places",
    bestSeason: "Oct - Feb",
    landmarks: ["UNESCO Site", "9+ Places"],
    tourName: "Explore Hampi",
    tourImage: "/home assets/destination/Hampi.webp",
  },
  {
    name: "Khajuraho",
    state: "Madhya Pradesh",
    image: "/home assets/Khajuraho.webp",
    destinationId: "KHAJURAHO",
    focus: "",
    markerX: 58.2,
    markerY: 56.5,
    description:
      "Iconic temples celebrated for sculpture, storytelling and exceptional medieval artistry.",
    duration: "7+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Temple Art", "7+ Places"],
    tourName: "Explore Khajuraho",
    tourImage: "/home assets/Khajuraho.webp",
  },
  {
    name: "Amritsar",
    state: "Punjab",
    image: "/home assets/destination/Amritsar.webp",
    destinationId: "AMRITSAR",
    focus: "",
    markerX: 37.2,
    markerY: 28.2,
    description:
      "A warm northern city shaped by sacred architecture, food traditions and layered history.",
    duration: "6+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Sacred City", "6+ Places"],
    tourName: "Explore Amritsar",
    tourImage: "/home assets/destination/Amritsar.webp",
  },
  {
    name: "Hoysalas",
    state: "Karnataka",
    image: "/home assets/destination/Hoysalas.webp",
    destinationId: "HOYSALAS",
    focus: "",
    markerX: 51.6,
    markerY: 73.1,
    description:
      "Intricate stone temples and sculptural detail across Karnataka's Hoysala heritage belt.",
    duration: "5+ Places",
    bestSeason: "Nov - Feb",
    landmarks: ["Stone Craft", "5+ Places"],
    tourName: "Explore Hoysalas",
    tourImage: "/home assets/destination/Hoysalas.webp",
  },
  {
    name: "Khajuraho",
    state: "Madhya Pradesh",
    image: "/home assets/Khajuraho.webp",
    destinationId: "KHAJURAHO-2",
    focus: "",
    markerX: 58.2,
    markerY: 56.5,
    description:
      "A compact heritage destination where sculpture, stories and temple planning come alive.",
    duration: "7+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Cultural Trail", "7+ Places"],
    tourName: "Explore Khajuraho",
    tourImage: "/home assets/Khajuraho.webp",
  },
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
  { keywords: ["hoysala", "hoysalas", "belur", "halebidu"], markerX: 51.6, markerY: 73.1 },
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

export function getHomeMediaUrl(source: string): string {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (trimmedSource.startsWith("/uploads/")) {
    return `${apiBaseUrl}${trimmedSource}`;
  }

  return trimmedSource;
}

function getMarkerSearchText(destination: PublicDestination) {
  return [
    destination.destinationName,
    destination.city,
    destination.state,
    destination.countryRegion,
    destination.primaryHeritageFocus,
    destination.bestTimeToVisit || "",
  ]
    .join(" ")
    .toLowerCase();
}

export function getDefaultDestinationMarker(
  destination: PublicDestination,
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

  const fallback =
    fallbackTrendingDestinations[index % fallbackTrendingDestinations.length];

  return {
    markerX: fallback.markerX,
    markerY: fallback.markerY,
  };
}

function getDateValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatTravelDate(value: string | null): string {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(",", "");
}

function getTourImage(tour: PublicTour | undefined, fallbackImage: string) {
  return getHomeMediaUrl(
    tour?.thumbnailImage ||
      tour?.bannerImage ||
      tour?.galleryImages?.[0] ||
      fallbackImage
  );
}

function getExperienceImage(
  experience: PublicExperience,
  fallbackImage: string
) {
  return getHomeMediaUrl(
    experience.travellerPhotoGallery.find((image) => image.trim()) ||
      experience.attractionPhotoGallery.find((photo) => photo.image.trim())
        ?.image ||
      fallbackImage
  );
}

function getExperienceTitle(experience: PublicExperience, fallbackTitle: string) {
  return (
    experience.title?.trim() ||
    experience.attractionPhotoGallery.find((photo) => photo.name.trim())?.name ||
    experience.destinationName ||
    fallbackTitle
  );
}

function getExperienceReview(experience: PublicExperience, fallbackReview: string) {
  const review =
    experience.writtenReview.trim() ||
    experience.thingsToKnow.find((item) => item.trim()) ||
    fallbackReview;

  return review.length > 190 ? `${review.slice(0, 187).trim()}...` : review;
}

function getUniqueHomeMedia(values: string[] = []) {
  return Array.from(
    new Set(
      values
        .map((value) => getHomeMediaUrl(value))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function getExperienceAttractionPhotos(
  photos: PublicExperienceAttractionPhoto[] = []
) {
  const seenImages = new Set<string>();

  return photos
    .map((photo) => ({
      image: getHomeMediaUrl(photo.image),
      name: photo.name.trim(),
    }))
    .filter((photo) => {
      if (!photo.image || seenImages.has(photo.image)) {
        return false;
      }

      seenImages.add(photo.image);

      return true;
    });
}

function formatTravelMonth(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
  }).format(date);
}

function getDestinationPlaceCountLabel(
  destination: PublicDestination,
  fallbackLabel: string
) {
  const landmarkCount = Array.from(
    new Set(
      (destination.keyLandmarks || [])
        .map((landmark) => landmark.trim())
        .filter(Boolean)
    )
  ).length;
  const landmarkImageCount = (destination.keyLandmarkImages || []).filter(
    (image) => image.trim()
  ).length;
  const placeCount = landmarkCount || landmarkImageCount;

  if (placeCount > 0) {
    return `${placeCount} ${placeCount === 1 ? "Place" : "Places"}`;
  }

  return fallbackLabel;
}

function getDestinationTourCategoryLabel(relatedTours: PublicTour[]) {
  const categories = Array.from(
    new Set(
      relatedTours
        .flatMap((tour) => (tour.category || "").split(/[,/|]+/))
        .map((category) => category.trim())
        .filter(Boolean)
    )
  );

  return categories.join(", ");
}

function splitHomeLabels(value = "") {
  return value
    .split(/[,/|]+/)
    .map((label) => label.trim())
    .filter(Boolean);
}

function getUniqueHomeLabels(labels: string[]) {
  const seen = new Set<string>();

  return labels.filter((label) => {
    const key = label.trim().toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function getCustomisedDestinationTags(
  destination: PublicDestination,
  fallbackTags: string[]
) {
  const tags = getUniqueHomeLabels([
    ...splitHomeLabels(destination.primaryHeritageFocus),
    ...(destination.unescoSite ? ["UNESCO"] : []),
    ...splitHomeLabels(destination.region || ""),
    destination.state,
    destination.countryRegion,
    ...destination.keyLandmarks.slice(0, 2),
    destination.bestTimeToVisit || "",
    ...fallbackTags,
  ]);

  return tags.slice(0, 2);
}

export function getTourDestinationIds(
  tour: Pick<PublicTour, "destinationId"> & { destinationIds?: string[] }
) {
  return Array.from(
    new Set(
      [tour.destinationId, ...(tour.destinationIds || [])]
        .map((destinationId) => destinationId.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function getPrimaryTourDestinationId(tour: PublicTour) {
  return getTourDestinationIds(tour)[0] || tour.destinationId;
}

function createDurationFromDates(departure: PublicTourDeparture) {
  if (!departure.departureDate || !departure.returnDate) {
    return "";
  }

  const departureDate = new Date(departure.departureDate);
  const returnDate = new Date(departure.returnDate);

  if (
    Number.isNaN(departureDate.getTime()) ||
    Number.isNaN(returnDate.getTime())
  ) {
    return "";
  }

  const days = Math.max(
    1,
    Math.round(
      (returnDate.getTime() - departureDate.getTime()) / 86_400_000
    ) + 1
  );

  return `${days} Days/ ${Math.max(0, days - 1)} Nights`;
}

export async function listPublicTours(destinationId = "") {
  const query = destinationId.trim()
    ? `?destinationId=${encodeURIComponent(destinationId.trim())}`
    : "";

  return apiRequest<{ tours: PublicTour[] }>(`/api/tours${query}`);
}

export async function listPublicTourDepartures() {
  return apiRequest<{ departures: PublicTourDeparture[] }>("/api/tours/departures");
}

export async function listPublicTourItineraries(tourId = "") {
  const query = tourId.trim()
    ? `?tourId=${encodeURIComponent(tourId.trim())}`
    : "";

  return apiRequest<{ itineraries: PublicTourItinerary[] }>(
    `/api/tours/itineraries${query}`
  );
}

export async function listPublicExperts() {
  return apiRequest<{ experts: PublicExpert[] }>("/api/experts");
}

export async function listPublicDestinations() {
  return apiRequest<{ destinations: PublicDestination[] }>("/api/destinations");
}

export async function listPublicExperiences(destinationId = "") {
  const query = destinationId.trim()
    ? `?destinationId=${encodeURIComponent(destinationId.trim())}`
    : "";

  return apiRequest<{ experiences: PublicExperience[] }>(
    `/api/experiences${query}`
  );
}

export async function getHomePageContent() {
  return apiRequest<{ home: HomePageContent }>("/api/home");
}

export async function listPublicMegaMenu() {
  return apiRequest<{ megaMenu: PublicMegaMenuContent }>("/api/mega-menu");
}

export function buildUpcomingTourCards(
  tours: PublicTour[],
  departures: PublicTourDeparture[],
  limit = 6,
  selectedUpcomingTours: HomeUpcomingTourSetting[] = []
): HomeTourCard[] {
  const tourById = new Map(tours.map((tour) => [tour.tourId, tour]));

  if (selectedUpcomingTours.length > 0) {
    return [...selectedUpcomingTours]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((selection) => {
        const tour = tourById.get(selection.tourId);

        if (!tour) {
          return null;
        }

        const departure = selection.departureId
          ? departures.find(
              (item) =>
                item.departureId === selection.departureId &&
                item.tourId === selection.tourId
            )
          : undefined;

        return {
          date: departure
            ? formatTravelDate(departure.departureDate)
            : "Coming Soon",
          destinationId:
            departure?.destinationId || getPrimaryTourDestinationId(tour),
          duration:
            tour.durationDn || (departure ? createDurationFromDates(departure) : ""),
          image: getTourImage(tour, "/home assets/Khajuraho.webp"),
          title: tour.tourName,
          tourId: tour.tourId,
        } satisfies HomeTourCard;
      })
      .filter((card): card is HomeTourCard => Boolean(card))
      .slice(0, limit);
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const datedDepartures = departures
    .filter((departure) => getDateValue(departure.departureDate) > 0)
    .sort(
      (left, right) =>
        getDateValue(left.departureDate) - getDateValue(right.departureDate)
    );
  const sourceDepartures =
    datedDepartures.filter(
      (departure) => getDateValue(departure.departureDate) >= today.getTime()
    ) || [];
  const selectedDepartures =
    sourceDepartures.length > 0 ? sourceDepartures : datedDepartures;
  const cards = selectedDepartures
    .map((departure) => {
      const tour = tourById.get(departure.tourId);

      if (!tour) {
        return null;
      }

      return {
        date: formatTravelDate(departure.departureDate),
        destinationId: departure.destinationId || getPrimaryTourDestinationId(tour),
        duration: tour.durationDn || createDurationFromDates(departure),
        image: getTourImage(tour, "/home assets/Khajuraho.webp"),
        title: tour.tourName,
        tourId: tour.tourId,
      } satisfies HomeTourCard;
    })
    .filter((card): card is HomeTourCard => Boolean(card));

  const usedTourIds = new Set(cards.map((card) => card.tourId));

  tours.forEach((tour) => {
    if (cards.length >= limit || usedTourIds.has(tour.tourId)) {
      return;
    }

    cards.push({
      date: "Coming Soon",
      destinationId: getPrimaryTourDestinationId(tour),
      duration: tour.durationDn,
      image: getTourImage(tour, "/home assets/Khajuraho.webp"),
      title: tour.tourName,
      tourId: tour.tourId,
    });
  });

  return cards.slice(0, limit);
}

export function buildTrendingDestinationCards(
  destinations: PublicDestination[],
  tours: PublicTour[],
  limit = 8,
  selectedTrendingDestinations: HomeTrendingDestinationSetting[] = []
): HomeDestinationCard[] {
  const toursByDestination = new Map<string, PublicTour[]>();

  tours.forEach((tour) => {
    getTourDestinationIds(tour).forEach((destinationId) => {
      toursByDestination.set(destinationId, [
        ...(toursByDestination.get(destinationId) || []),
        tour,
      ]);
    });
  });
  const destinationById = new Map(
    destinations.map((destination) => [destination.destinationId, destination])
  );
  const sourceDestinations =
    selectedTrendingDestinations.length > 0
      ? [...selectedTrendingDestinations]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((selection, index) => {
            const destination = destinationById.get(selection.destinationId);

            return {
              destination,
              markerX: selection.markerX,
              markerY: selection.markerY,
              sourceIndex: index,
            };
          })
          .filter(
            (
              item
            ): item is {
              destination: PublicDestination;
              markerX: number;
              markerY: number;
              sourceIndex: number;
            } => Boolean(item.destination)
          )
      : destinations.slice(0, limit).map((destination, index) => {
          const autoMarker = getDefaultDestinationMarker(destination, index);

          return {
            destination,
            markerX: autoMarker.markerX,
            markerY: autoMarker.markerY,
            sourceIndex: index,
          };
        });

  return sourceDestinations.slice(0, limit).map((item) => {
    const { destination, markerX, markerY, sourceIndex } = item;
    const relatedTours = toursByDestination.get(destination.destinationId) || [];
    const relatedTour = relatedTours[0];
    const fallback =
      fallbackTrendingDestinations[sourceIndex % fallbackTrendingDestinations.length];
    const image = getHomeMediaUrl(
      destination.thumbnailImage ||
        destination.bannerImage ||
        destination.galleryImages?.[0] ||
        relatedTour?.bannerImage ||
        fallback.image
    );

    return {
      bestSeason:
        destination.bestTimeToVisit ||
        relatedTour?.bestSeason ||
        fallback.bestSeason,
      description:
        destination.shortDescription ||
        relatedTour?.description ||
        fallback.description,
      destinationId: destination.destinationId,
      duration: getDestinationPlaceCountLabel(destination, fallback.duration),
      focus: getDestinationTourCategoryLabel(relatedTours),
      image,
      landmarks:
        destination.keyLandmarks.length > 0
          ? destination.keyLandmarks.slice(0, 2)
          : fallback.landmarks,
      markerX,
      markerY,
      name: destination.destinationName,
      state: destination.state || destination.countryRegion || destination.city,
      tourImage: getTourImage(relatedTour, image),
      tourName: relatedTour?.tourName || `Explore ${destination.destinationName}`,
    };
  });
}

export function buildCustomisedTourCards(
  destinations: PublicDestination[],
  limit = 6,
  selectedCustomisedTourDestinations: HomeCustomisedTourDestinationSetting[] = []
): HomeCustomisedTourCard[] {
  const destinationById = new Map(
    destinations.map((destination) => [destination.destinationId, destination])
  );
  const sourceDestinations =
    selectedCustomisedTourDestinations.length > 0
      ? [...selectedCustomisedTourDestinations]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((selection) => destinationById.get(selection.destinationId))
          .filter(
            (destination): destination is PublicDestination =>
              Boolean(destination)
          )
      : destinations.slice(0, limit);

  return sourceDestinations.slice(0, limit).map((destination, index) => {
    const fallback = fallbackCustomisedTours[index % fallbackCustomisedTours.length];
    const image = getHomeMediaUrl(
      destination.thumbnailImage ||
        destination.bannerImage ||
        destination.galleryImages?.[0] ||
        fallback.image
    );

    return {
      destinationId: destination.destinationId,
      image,
      tags: getCustomisedDestinationTags(destination, fallback.tags),
      title: destination.destinationName,
    };
  });
}

const fallbackHomeExperienceSeeds = [
  {
    image: "/home assets/Egypt.webp",
    review:
      "Location and quality of hotel in Cairo could be better- felt stranded in Cairo since hotel was a little remote from city (new and old Cairo).",
    title: "Pyramids of Giza Sunrise Experience",
  },
  {
    image: "/home assets/Egypt/Egypt_2.webp",
    review: "Exploring Luxor temples felt like walking through living history.",
    title: "Exploring Luxor Temples",
  },
  {
    image: "/home assets/Egypt/Egypt_3.webp",
    review: "The Nile cruise moments were calm, beautiful and unforgettable.",
    title: "Nile Cruise Moments",
  },
  {
    image: "/home assets/Egypt/Egypt_4.webp",
    review: "Egyptian Museum highlights brought the whole journey together.",
    title: "Egyptian Museum Highlights",
  },
  {
    image: "/home assets/Egypt/Egypt_5.webp",
    review: "Khan El Khalili market was full of colour, craft and energy.",
    title: "Khan El Khalili Market Vibes",
  },
];

export function buildHomeExperienceCards(
  experiences: PublicExperience[],
  limit = 5,
  selectedHomeExperiences: HomeExperienceSetting[] = []
): HomeExperienceCard[] {
  const experienceById = new Map(
    experiences.map((experience) => [experience.experienceId, experience])
  );
  const sourceExperiences =
    selectedHomeExperiences.length > 0
      ? [...selectedHomeExperiences]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((selection) => experienceById.get(selection.experienceId))
          .filter(
            (experience): experience is PublicExperience =>
              Boolean(experience)
          )
      : experiences.slice(0, limit);

  return sourceExperiences.slice(0, limit).map((experience, index) => {
    const fallback =
      fallbackHomeExperienceSeeds[index % fallbackHomeExperienceSeeds.length];

    return {
      attractionPhotoGallery: getExperienceAttractionPhotos(
        experience.attractionPhotoGallery
      ),
      destinationId: experience.destinationId,
      destinationName: experience.destinationName,
      id: experience.id,
      experienceId: experience.experienceId,
      featured: index === 0,
      image: getExperienceImage(experience, fallback.image),
      rating: Math.min(5, Math.max(1, Number(experience.overallRating) || 5)),
      review: getExperienceReview(experience, fallback.review),
      title: getExperienceTitle(experience, fallback.title),
      travellerPhotoGallery: getUniqueHomeMedia(experience.travellerPhotoGallery),
      travellerVideos: getUniqueHomeMedia(experience.travellerVideos),
      travellerVideoTitles: experience.travellerVideos.map(
        (_video, videoIndex) =>
          experience.travellerVideoTitles[videoIndex]?.trim() || ""
      ),
      travelledMonth: formatTravelMonth(experience.createdAt),
      travellerName: experience.travellerName.trim() || "Traveller",
      type: experience.travellerVideos.length > 0 ? "Video" : "Album",
    };
  });
}

export async function getHomeUpcomingTours(limit = 6) {
  const [homeResponse, toursResponse, departuresResponse] = await Promise.all([
    getHomePageContent(),
    listPublicTours(),
    listPublicTourDepartures(),
  ]);

  return buildUpcomingTourCards(
    toursResponse.data.tours,
    departuresResponse.data.departures,
    limit,
    homeResponse.data.home.upcomingTours
  );
}

export async function getHomeTrendingDestinations(limit = 8) {
  const [homeResponse, destinationsResponse, toursResponse] = await Promise.all([
    getHomePageContent(),
    listPublicDestinations(),
    listPublicTours(),
  ]);

  return buildTrendingDestinationCards(
    destinationsResponse.data.destinations,
    toursResponse.data.tours,
    limit,
    homeResponse.data.home.trendingDestinations
  );
}

export async function getHomeCustomisedTourDestinations(limit = 6) {
  const [homeResponse, destinationsResponse] = await Promise.all([
    getHomePageContent(),
    listPublicDestinations(),
  ]);

  return buildCustomisedTourCards(
    destinationsResponse.data.destinations,
    limit,
    homeResponse.data.home.customisedTourDestinations || []
  );
}

export async function getHomeExperienceCards(limit = 5) {
  const [homeResponse, experiencesResponse] = await Promise.all([
    getHomePageContent(),
    listPublicExperiences(),
  ]);

  return buildHomeExperienceCards(
    experiencesResponse.data.experiences,
    limit,
    homeResponse.data.home.homeExperiences || []
  );
}
