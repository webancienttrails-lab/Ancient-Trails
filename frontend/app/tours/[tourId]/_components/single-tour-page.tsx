"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BedDouble,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  Landmark,
  Mail,
  Minus,
  Mountain,
  PhoneCall,
  Plus,
  Sun,
  TrendingUp,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  fallbackUpcomingTours,
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicExperts,
  listPublicTourDepartures,
  listPublicTourItineraries,
  listPublicTours,
  type PublicDestination,
  type PublicExpert,
  type PublicTour,
  type PublicTourDeparture,
  type PublicTourItinerary,
} from "@/lib/home-travel";
import {
  calculateBalance,
  calculateBalanceDueDate,
  calculateDeposit,
  generateAccommodationOptions,
  ROOM_TYPES,
  validateDepartureForBooking,
  type AccommodationOption,
  type PricedDeparture,
  type PricingCategory,
  type Traveller,
} from "@/lib/tour-booking";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";

type TourTab = "summary" | "itinerary" | "inclusions" | "pricing";

type TourDetailData = {
  departures: PublicTourDeparture[];
  destinations: PublicDestination[];
  expert: PublicExpert;
  itinerary: PublicTourItinerary | null;
  primaryDestination: PublicDestination;
  tour: PublicTour;
};

type TourFact = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type ItineraryDay = {
  dayNumber: number;
  meals?: string;
  placesVisited?: string[];
  summary: string;
  title: string;
  transport?: string;
  walkingDifficulty?: string;
};

type TravellerCounts = {
  adults: number;
  children: number;
};

type TravellerCountKey = keyof TravellerCounts;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fallbackGalleryImages = [
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Egypt.webp",
];

const tabs: Array<{
  icon: LucideIcon;
  label: string;
  value: TourTab;
}> = [
  { value: "summary", label: "Summary", icon: BookOpen },
  { value: "itinerary", label: "Itinerary", icon: CalendarDays },
  { value: "inclusions", label: "Inclusions / Exclusions", icon: BedDouble },
  { value: "pricing", label: "Departure & Pricing", icon: CalendarDays },
];

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean))
  );
}

function formatCurrency(value: number) {
  if (!value || value <= 0) {
    return "Price on request";
  }

  return currencyFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return shortDateFormatter.format(date).replace(",", "");
}

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getDepartureIdentifier(departure: PublicTourDeparture) {
  return departure.id || departure.departureId || departure.departureDate;
}

function getTotalTravellers(counts: TravellerCounts) {
  return counts.adults + counts.children;
}

function parseDurationDays(duration: string) {
  const dayMatch = duration.match(/(\d+)\s*(?:d|day)/i);
  const numericMatch = dayMatch || duration.match(/(\d+)/);
  const days = numericMatch ? Number(numericMatch[1]) : 8;

  return Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 8;
}

function getDurationLabel(tour: PublicTour) {
  const days = parseDurationDays(tour.durationDn);

  return `${days} ${days === 1 ? "Day" : "Days"}`;
}

function getDifficultyLabel(tour: PublicTour) {
  return tour.difficulty || "Moderate";
}

function getDestinationTitle(destination: PublicDestination) {
  return (
    destination.destinationName ||
    destination.city ||
    destination.state ||
    destination.countryRegion ||
    "Ancient Trails"
  );
}

function getRouteLabel(
  tour: PublicTour,
  destinations: PublicDestination[],
  primaryDestination: PublicDestination
) {
  if (tour.tourId === "WALKING-AMALFI-COAST") {
    return "Bomerano to Agerola";
  }

  const destinationNames = uniqueValues(
    destinations.map((destination) => getDestinationTitle(destination))
  );

  if (destinationNames.length > 1) {
    return `${destinationNames[0]} to ${destinationNames[destinationNames.length - 1]}`;
  }

  return (
    primaryDestination.city ||
    primaryDestination.destinationName ||
    primaryDestination.state ||
    "Ancient Trails"
  );
}

function getStartEndLabel(
  tour: PublicTour,
  destinations: PublicDestination[],
  primaryDestination: PublicDestination
) {
  return getRouteLabel(tour, destinations, primaryDestination);
}

function getTourImages(
  tour: PublicTour,
  destinations: PublicDestination[]
) {
  const images = uniqueValues([
    tour.bannerImage,
    ...tour.galleryImages,
    ...destinations.flatMap((destination) => [
      destination.bannerImage,
      ...destination.galleryImages,
    ]),
    fallbackUpcomingTours.find((item) => item.tourId === tour.tourId)?.image,
  ]).map(getHomeMediaUrl);

  return images.length > 0 ? images : fallbackGalleryImages;
}

function getBestDeparture(departures: PublicTourDeparture[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    departures
      .filter((departure) => getDateValue(departure.departureDate) >= today.getTime())
      .sort(
        (left, right) =>
          getDateValue(left.departureDate) - getDateValue(right.departureDate)
      )[0] ||
    departures
      .slice()
      .sort(
        (left, right) =>
          getDateValue(left.departureDate) - getDateValue(right.departureDate)
      )[0]
  );
}

function getLowestPrice(departures: PublicTourDeparture[]) {
  const prices = departures
    .map((departure) => departure.priceAdult)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

function getDiscountPercent(departure?: PublicTourDeparture) {
  const offerText = departure?.earlyBirdOffer || "";
  const percentMatch = offerText.match(/(\d+(?:\.\d+)?)\s*%/);

  if (percentMatch) {
    return Math.round(Number(percentMatch[1]));
  }

  return departure?.tourId === "WALKING-AMALFI-COAST" ? 11 : 0;
}

function getOldPrice(price: number, discountPercent: number) {
  if (!price || !discountPercent || discountPercent >= 100) {
    return 0;
  }

  return Math.round(price / (1 - discountPercent / 100));
}

function createFallbackExpert(): PublicExpert {
  return {
    id: "fallback-expert-girinath",
    expertId: "GIRINATH-BHARADE",
    fullName: "Mr. Girinath Bharade",
    image: "/home assets/Khajuraho.webp",
    fullBiography:
      "Founder of Ancient Trails and an avid traveller. An Indologist, a teacher by heart, a heritage researcher and a cultural storyteller with special interest in temple architecture and ancient traditions.",
    expertiseTags: ["South Indian Temple Architecture"],
    qualifications: ["Indologist", "Heritage Researcher"],
    languages: ["English", "Hindi", "Marathi"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackDestination(): PublicDestination {
  return {
    id: "fallback-destination-amalfi",
    destinationId: "AMALFI-COAST",
    destinationName: "Amalfi Coast",
    destinationType: "International",
    countryRegion: "Italy",
    state: "Campania",
    city: "Amalfi",
    primaryHeritageFocus: "Coastal Heritage",
    unescoSite: true,
    keyLandmarks: [
      "Path of the Gods",
      "Positano",
      "Praiano",
      "Amalfi",
      "Ravello",
    ],
    recommendedDurationDays: 8,
    shortDescription:
      "Experience scenic coastal trails, layered villages and Mediterranean heritage along one of Italy's most memorable walking routes.",
    dressCode: "Light layers and sun protection",
    footwear: "Comfortable walking shoes",
    permits: "Details shared before travel",
    idRequirement: "Passport required",
    restrictions: "Some trails include steps and uneven paths",
    bannerImage: "/home assets/Khajuraho.webp",
    galleryImages: [
      "/home assets/destination/Hampi.webp",
      "/home assets/destination/Udaipur.webp",
      "/home assets/destination/Varanasi.webp",
      "/home assets/Egypt.webp",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackTour(requestedTourId: string): PublicTour {
  const matchedFallback = fallbackUpcomingTours.find(
    (tour) =>
      normalizeCode(tour.tourId) === normalizeCode(requestedTourId) ||
      slugify(tour.title) === slugify(requestedTourId)
  );

  if (matchedFallback) {
    return {
      id: `fallback-${matchedFallback.tourId}`,
      tourId: matchedFallback.tourId,
      tourName: matchedFallback.title,
      tourType: "Heritage Walk",
      destinationId: matchedFallback.destinationId,
      destinationIds: [matchedFallback.destinationId],
      durationDn: matchedFallback.duration,
      category: "Heritage Walk",
      difficulty: "Moderate",
      bestSeason: "October to March",
      description:
        "A carefully designed heritage journey with guided walks, local stories, landmark visits and meaningful cultural encounters.",
      inclusions: [
        "Expert-led sightseeing and storytelling",
        "Curated heritage walks",
        "Accommodation on twin sharing basis",
        "Local transfers as per itinerary",
      ],
      exclusions: [
        "Flights and personal expenses",
        "Meals not listed in the itinerary",
        "Camera fees and monument charges unless specified",
      ],
      expertId: "GIRINATH-BHARADE",
      notes: "",
      bannerImage: matchedFallback.image,
      galleryImages: fallbackGalleryImages.filter(
        (image) => image !== matchedFallback.image
      ),
      video: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: "fallback-walking-amalfi-coast",
    tourId: "WALKING-AMALFI-COAST",
    tourName: "Walking the Amalfi Coast",
    tourType: "Heritage Walk",
    destinationId: "AMALFI-COAST",
    destinationIds: ["AMALFI-COAST"],
    durationDn: "8 Days / 7 Nights",
    category: "Heritage Walk",
    difficulty: "Moderate",
    bestSeason: "April to October",
    description:
      "Experience the breathtaking beauty of the Amalfi Coast on this unforgettable 8-day guided hiking tour. Walk scenic coastal trails, explore charming villages, and enjoy authentic Italian hospitality from Bomerano to Agerola.",
    inclusions: [
      "Expert tour leader and local guide assistance",
      "Accommodation on private double room basis",
      "Daily breakfast and selected meals",
      "Curated walking routes and heritage visits",
      "Ground transfers as mentioned in the itinerary",
    ],
    exclusions: [
      "International and domestic flights",
      "Personal expenses and optional activities",
      "Travel insurance and visa charges",
      "Meals not mentioned in the itinerary",
      "Tips, porterage and camera charges",
    ],
    expertId: "GIRINATH-BHARADE",
    notes: "Average elevation: 450 - 650 m",
    bannerImage: "/home assets/Khajuraho.webp",
    galleryImages: [
      "/home assets/destination/Hampi.webp",
      "/home assets/destination/Udaipur.webp",
      "/home assets/destination/Varanasi.webp",
      "/home assets/Egypt.webp",
    ],
    video: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackDeparture(tour: PublicTour): PublicTourDeparture {
  const departureDate = new Date();
  departureDate.setDate(departureDate.getDate() + 45);
  const returnDate = new Date(departureDate);
  returnDate.setDate(departureDate.getDate() + parseDurationDays(tour.durationDn) - 1);

  return {
    id: `fallback-departure-${tour.tourId}`,
    departureId: `${tour.tourId}-DEP-1`,
    tourId: tour.tourId,
    destinationId: tour.destinationId,
    departureDate: departureDate.toISOString(),
    returnDate: returnDate.toISOString(),
    seatsAvailable: 12,
    priceAdult: tour.tourId === "WALKING-AMALFI-COAST" ? 1950 : 35500,
    priceExtraBed: tour.tourId === "WALKING-AMALFI-COAST" ? 1755 : 31950,
    priceChildWithoutExtraBed:
      tour.tourId === "WALKING-AMALFI-COAST" ? 1560 : 28400,
    singleOccupancy: tour.tourId === "WALKING-AMALFI-COAST" ? 2438 : 44375,
    depositType: "percentage",
    depositValue: 25,
    depositAppliesTo: "per_booking",
    balanceDueDaysBefore: 45,
    earlyBirdOffer:
      tour.tourId === "WALKING-AMALFI-COAST" ? "11% Early Bird Discount" : null,
    bookingDeadline: departureDate.toISOString(),
    status: "scheduled",
    childPricingRules: [
      {
        minAge: 0,
        maxAge: 11,
        allowExtraBed: true,
        allowWithoutExtraBed: true,
      },
    ],
    roomPolicy: {
      allowChildBedSharing: true,
      maxChildrenWithoutExtraBedPerRoom: 1,
      allowExtraBed: true,
      allowChildSingleRoom: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackDetail(requestedTourId: string): TourDetailData {
  const fallbackTour = createFallbackTour(requestedTourId);
  const fallbackDestination =
    fallbackTour.destinationId === "AMALFI-COAST"
      ? createFallbackDestination()
      : {
          ...createFallbackDestination(),
          destinationId: fallbackTour.destinationId,
          destinationName: fallbackTour.tourName,
          city: fallbackTour.tourName,
          countryRegion: "India",
          state: "",
          primaryHeritageFocus: fallbackTour.category,
          bannerImage: fallbackTour.bannerImage,
          galleryImages: fallbackTour.galleryImages,
        };

  return {
    tour: fallbackTour,
    departures: [createFallbackDeparture(fallbackTour)],
    destinations: [fallbackDestination],
    itinerary: null,
    primaryDestination: fallbackDestination,
    expert: createFallbackExpert(),
  };
}

function getItineraryHighlights(
  tour: PublicTour,
  destinations: PublicDestination[],
  itinerary: PublicTourItinerary | null
) {
  const destination = destinations[0];
  const itineraryHighlights = itinerary?.days.flatMap((day) => [
    day.title ? `Day ${day.dayNumber}: ${day.title}` : undefined,
    ...(day.placesVisited || []).slice(0, 2).map((place) => `Visit ${place}`),
  ]) || [];
  const itinerarySummaryHighlights =
    itinerary?.itinerarySummary
      .split(/[.!?]/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 34 && sentence.length < 130)
      .slice(0, 2) || [];
  const landmarkHighlights = uniqueValues(
    destinations.flatMap((item) => item.keyLandmarks)
  )
    .slice(0, 3)
    .map((landmark) => `Explore ${landmark}`);
  const defaults = [
    `Experience ${getDestinationTitle(destination)} with expert-led context`,
    `Travel through ${getRouteLabel(tour, destinations, destination)}`,
    "Enjoy local culture, cuisine and meaningful storytelling",
    `Discover ${tour.category || destination.primaryHeritageFocus || "heritage"} landmarks and beautiful landscapes`,
  ];

  return uniqueValues([
    ...itinerarySummaryHighlights,
    ...itineraryHighlights,
    ...landmarkHighlights,
    ...tour.description
      .split(/[.!?]/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 34 && sentence.length < 120)
      .slice(0, 2),
    ...defaults,
  ]).slice(0, 5);
}

function createItineraryDays(
  tour: PublicTour,
  destinations: PublicDestination[],
  itinerary: PublicTourItinerary | null
) {
  if (itinerary?.days.length) {
    return [...itinerary.days]
      .sort((left, right) => left.dayNumber - right.dayNumber)
      .map((day, index) => ({
        dayNumber: day.dayNumber || index + 1,
        meals: day.meals,
        placesVisited: day.placesVisited,
        summary:
          day.summary ||
          "A guided day with curated visits, local context and time to explore.",
        title: day.title || `Day ${day.dayNumber || index + 1}`,
        transport: day.transport,
        walkingDifficulty: day.walkingDifficulty,
      }));
  }

  if (tour.tourId === "WALKING-AMALFI-COAST") {
    return [
      {
        dayNumber: 1,
        title: "Arrive in Bomerano",
        summary:
          "Arrive in Bomerano and transfer to your hotel. Meet your guide and enjoy a welcome dinner.",
      },
      {
        dayNumber: 2,
        title: "Path of the Gods",
        summary:
          "Hike the famous Path of the Gods with breathtaking views of the coastline. Descend to Nocelle and visit Positano.",
      },
      {
        dayNumber: 3,
        title: "Amalfi Exploration",
        summary:
          "Explore the historic town of Amalfi, visit the Cathedral and enjoy free time by the sea.",
      },
      {
        dayNumber: 4,
        title: "Ravello Day",
        summary:
          "Hike to Ravello through lemon terraces and enjoy panoramic views. Visit Villa Rufolo.",
      },
      {
        dayNumber: 5,
        title: "Agerola Trails",
        summary:
          "Discover the trails around Agerola and traditional local villages.",
      },
      {
        dayNumber: 6,
        title: "Coastal Boat Day",
        summary:
          "Enjoy a scenic boat ride along the Amalfi Coast with stops for swimming.",
      },
      {
        dayNumber: 7,
        title: "Free Day",
        summary: "Leisure time to relax, explore local markets or optional activities.",
      },
      {
        dayNumber: 8,
        title: "Departure",
        summary: "After breakfast, check out and transfer to Agerola.",
      },
    ];
  }

  const days = parseDurationDays(tour.durationDn);
  const primaryDestination = destinations[0];
  const landmarks = uniqueValues(
    destinations.flatMap((destination) => [
      ...destination.keyLandmarks,
      destination.destinationName,
      destination.city,
    ])
  );
  const route = getRouteLabel(tour, destinations, primaryDestination);

  return Array.from({ length: days }, (_item, index) => {
    const dayNumber = index + 1;
    const landmark = landmarks[index % Math.max(landmarks.length, 1)];

    if (dayNumber === 1) {
      return {
        dayNumber,
        title: `Arrive in ${getDestinationTitle(primaryDestination)}`,
        summary:
          "Arrive, settle in and meet your tour expert for a journey briefing.",
      };
    }

    if (dayNumber === days) {
      return {
        dayNumber,
        title: "Departure",
        summary: "After breakfast, check out and continue with onward travel.",
      };
    }

    return {
      dayNumber,
      title: landmark ? `${landmark} Exploration` : `${route} Trail`,
      summary:
        "Follow a guided day of heritage walks, cultural interpretation and local experiences.",
    };
  });
}

function createFacts(
  tour: PublicTour,
  departures: PublicTourDeparture[],
  destinations: PublicDestination[],
  primaryDestination: PublicDestination
): TourFact[] {
  const bestDeparture = getBestDeparture(departures);
  const groupSize = bestDeparture?.seatsAvailable
    ? `2 - ${Math.min(Math.max(bestDeparture.seatsAvailable, 2), 18)} People`
    : "Small Group";

  return [
    {
      icon: Clock3,
      label: "Duration",
      value: getDurationLabel(tour),
    },
    {
      icon: TrendingUp,
      label: "Start / End",
      value: getStartEndLabel(tour, destinations, primaryDestination),
    },
    {
      icon: Users,
      label: "Group Size",
      value: groupSize,
    },
    {
      icon: BarChart3,
      label: "Activity Level",
      value: getDifficultyLabel(tour),
    },
  ];
}

function createBottomFacts(
  tour: PublicTour,
  primaryDestination: PublicDestination
): TourFact[] {
  const averageElevation =
    tour.tourId === "WALKING-AMALFI-COAST"
      ? "450 - 650 m"
      : primaryDestination.unescoSite
        ? "UNESCO Route"
        : primaryDestination.state || primaryDestination.countryRegion;

  return [
    {
      icon: Sun,
      label: "Best Time to Visit",
      value: tour.bestSeason || "October to March",
    },
    {
      icon: Users,
      label: "Tour Type",
      value: tour.tourType || tour.category || "Guided Tour",
    },
    {
      icon: BarChart3,
      label: "Activity Level",
      value: getDifficultyLabel(tour),
    },
    {
      icon: Mountain,
      label: "Average Elevation",
      value: averageElevation || "Site walks",
    },
  ];
}

function getExpertImage(expert: PublicExpert) {
  return getHomeMediaUrl(expert.image || "/home assets/Khajuraho.webp");
}

function getExpertRole(expert: PublicExpert) {
  return (
    expert.expertiseTags[0] ||
    expert.qualifications[0] ||
    "Heritage Specialist"
  );
}

function getExpertBio(expert: PublicExpert) {
  return (
    expert.fullBiography ||
    "A heritage researcher and cultural storyteller who brings history, architecture and local traditions into clear focus."
  );
}

function getPrimaryDestinationForTour(
  tour: PublicTour,
  destinations: PublicDestination[]
) {
  const destinationIds = getTourDestinationIds(tour);

  return (
    destinationIds
      .map((destinationId) =>
        destinations.find((destination) => destination.destinationId === destinationId)
      )
      .find(Boolean) ||
    destinations.find((destination) => destination.destinationId === tour.destinationId)
  );
}

function enrichTourData(
  tour: PublicTour,
  departures: PublicTourDeparture[],
  destinations: PublicDestination[],
  experts: PublicExpert[],
  itineraries: PublicTourItinerary[],
  requestedTourId: string
): TourDetailData {
  const destinationIds = getTourDestinationIds(tour);
  const linkedDestinations = destinationIds
    .map((destinationId) =>
      destinations.find((destination) => destination.destinationId === destinationId)
    )
    .filter((destination): destination is PublicDestination => Boolean(destination));
  const primaryDestination =
    getPrimaryDestinationForTour(tour, linkedDestinations) ||
    getPrimaryDestinationForTour(tour, destinations) ||
    createFallbackDetail(requestedTourId).primaryDestination;
  const tourDepartures = departures
    .filter((departure) => departure.tourId === tour.tourId)
    .sort(
      (left, right) =>
        getDateValue(left.departureDate) - getDateValue(right.departureDate)
    );
  const expert =
    experts.find((item) => item.expertId === tour.expertId) ||
    createFallbackExpert();
  const itinerary =
    itineraries.find((item) => item.tourId === tour.tourId) || null;

  return {
    tour,
    departures:
      tourDepartures.length > 0
        ? tourDepartures
        : [createFallbackDeparture(tour)],
    destinations:
      linkedDestinations.length > 0 ? linkedDestinations : [primaryDestination],
    itinerary,
    primaryDestination,
    expert,
  };
}

function findRequestedTour(tours: PublicTour[], requestedTourId: string) {
  const requestedCode = normalizeCode(decodeURIComponent(requestedTourId));
  const requestedSlug = slugify(decodeURIComponent(requestedTourId));

  return (
    tours.find(
      (tour) =>
        normalizeCode(tour.tourId) === requestedCode ||
        slugify(tour.tourName) === requestedSlug ||
        tour.id === requestedTourId
    ) || null
  );
}

export function SingleTourPage({ tourId }: { tourId: string }) {
  const fallbackDetail = useMemo(() => createFallbackDetail(tourId), [tourId]);
  const [detail, setDetail] = useState<TourDetailData>(fallbackDetail);
  const [activeTab, setActiveTab] = useState<TourTab>("summary");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTour() {
      setIsLoading(true);

      try {
        const [
          toursResponse,
          departuresResponse,
          destinationsResponse,
          expertsResponse,
          itinerariesResponse,
        ] = await Promise.all([
          listPublicTours(),
          listPublicTourDepartures(),
          listPublicDestinations(),
          listPublicExperts(),
          listPublicTourItineraries().catch(() => null),
        ]);
        const matchedTour = findRequestedTour(toursResponse.data.tours, tourId);

        if (isMounted && matchedTour) {
          setDetail(
            enrichTourData(
              matchedTour,
              departuresResponse.data.departures,
              destinationsResponse.data.destinations,
              expertsResponse.data.experts,
              itinerariesResponse?.data.itineraries || [],
              tourId
            )
          );
        }
      } catch {
        if (isMounted) {
          setDetail(createFallbackDetail(tourId));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTour();

    return () => {
      isMounted = false;
    };
  }, [tourId]);

  const galleryImages = useMemo(
    () => getTourImages(detail.tour, detail.destinations),
    [detail]
  );
  const selectedImage = galleryImages[selectedImageIndex] || galleryImages[0];
  const bestDeparture = useMemo(
    () => getBestDeparture(detail.departures),
    [detail.departures]
  );
  const price = getLowestPrice(detail.departures);
  const discountPercent = getDiscountPercent(bestDeparture);
  const oldPrice = getOldPrice(price, discountPercent);
  const facts = useMemo(
    () =>
      createFacts(
        detail.tour,
        detail.departures,
        detail.destinations,
        detail.primaryDestination
      ),
    [detail]
  );
  const itineraryDays = useMemo(
    () => createItineraryDays(detail.tour, detail.destinations, detail.itinerary),
    [detail]
  );
  const highlights = useMemo(
    () =>
      getItineraryHighlights(detail.tour, detail.destinations, detail.itinerary),
    [detail]
  );
  const bottomFacts = useMemo(
    () => createBottomFacts(detail.tour, detail.primaryDestination),
    [detail]
  );

  function handleSelectDeparture() {
    setActiveTab("pricing");
    window.requestAnimationFrame(() => {
      document
        .getElementById("departure-pricing")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="min-h-screen bg-background text-secondary">
      <Header />

      <section className="mx-auto grid w-full max-w-[1300px] gap-5 px-5 pb-7 pt-5 lg:grid-cols-[minmax(0,1fr)_306px] lg:px-0">
        <div className="min-w-0">
          <Breadcrumbs tourName={detail.tour.tourName} />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-heading text-[34px] font-bold leading-none tracking-normal text-secondary sm:text-[40px] lg:text-title">
                {detail.tour.tourName}
              </h1>
              <TourMeta
                destinations={detail.destinations}
                primaryDestination={detail.primaryDestination}
                tour={detail.tour}
              />
            </div>
            {isLoading ? (
              <span className="h-7 w-24 animate-pulse rounded-full bg-border" />
            ) : null}
          </div>

          <TourGallery
            images={galleryImages}
            selectedImage={selectedImage}
            selectedImageIndex={selectedImageIndex}
            title={detail.tour.tourName}
            tourType={detail.tour.category || detail.tour.tourType}
            onSelectImage={setSelectedImageIndex}
          />

          <TourTabs
            activeTab={activeTab}
            departures={detail.departures}
            facts={facts}
            highlights={highlights}
            itineraryDays={itineraryDays}
            onTabChange={setActiveTab}
            price={price}
            itinerary={detail.itinerary}
            primaryDestination={detail.primaryDestination}
            tour={detail.tour}
          />

          <BottomFacts facts={bottomFacts} />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-5 lg:self-start">
          <PriceCard
            bestDeparture={bestDeparture}
            discountPercent={discountPercent}
            oldPrice={oldPrice}
            price={price}
            onSelectDeparture={handleSelectDeparture}
          />
          <HelpCard />
          <ExpertCard expert={detail.expert} />
        </aside>
      </section>
    </main>
  );
}

function Breadcrumbs({ tourName }: { tourName: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-2.5 font-sans text-[12px] font-medium text-accent">
      <Link href="/" className="transition-colors hover:text-primary">
        Home
      </Link>
      <ChevronRight className="size-3.5 text-primary/70" />
      <Link href="/tour-calendar" className="transition-colors hover:text-primary">
        Tours
      </Link>
      <ChevronRight className="size-3.5 text-primary/70" />
      <span className="font-semibold">{tourName}</span>
    </nav>
  );
}

function TourMeta({
  destinations,
  primaryDestination,
  tour,
}: {
  destinations: PublicDestination[];
  primaryDestination: PublicDestination;
  tour: PublicTour;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-[13px] font-semibold text-secondary">
      <MetaItem icon={Clock3} label={getDurationLabel(tour)} />
      <MetaItem
        icon={Users}
        label={`From ${getRouteLabel(tour, destinations, primaryDestination)}`}
      />
      <MetaItem icon={TrendingUp} label={getDifficultyLabel(tour)} />
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 text-primary" strokeWidth={1.9} />
      {label}
    </span>
  );
}

function TourGallery({
  images,
  onSelectImage,
  selectedImage,
  selectedImageIndex,
  title,
  tourType,
}: {
  images: string[];
  onSelectImage: (index: number) => void;
  selectedImage: string;
  selectedImageIndex: number;
  title: string;
  tourType: string;
}) {
  const thumbnails = images.slice(0, 5);

  function moveImage(direction: number) {
    const nextIndex =
      (selectedImageIndex + direction + thumbnails.length) % thumbnails.length;

    onSelectImage(nextIndex);
  }

  return (
    <section className="mt-5">
      <div className="relative aspect-[1.95/1] overflow-hidden rounded-[8px] bg-border shadow-[0_12px_30px_rgba(67,43,27,0.1)]">
        <Image
          src={selectedImage}
          alt={title}
          fill
          priority
          sizes="(min-width: 1024px) 860px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_58%,rgba(0,0,0,0.42)_100%)]" />
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-[6px] border border-white/45 bg-secondary/75 px-3 py-2 font-sans text-[12px] font-bold text-white shadow-[0_10px_20px_rgba(0,0,0,0.18)] backdrop-blur-sm">
          <Landmark className="size-4" strokeWidth={1.7} />
          {tourType || "Heritage Walk"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-2">
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => moveImage(-1)}
          className="grid size-9 place-items-center rounded-full border border-border bg-white text-primary shadow-[0_8px_18px_rgba(67,43,27,0.08)] transition-colors hover:bg-primary hover:text-white"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="grid min-w-0 grid-cols-5 gap-2">
          {thumbnails.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`View tour photo ${index + 1}`}
              onClick={() => onSelectImage(index)}
              className={cn(
                "relative h-[68px] overflow-hidden rounded-[8px] border bg-border transition-all sm:h-[74px]",
                index === selectedImageIndex
                  ? "border-primary shadow-[0_0_0_3px_rgba(212,114,32,0.16)]"
                  : "border-transparent hover:border-primary/60"
              )}
            >
              <Image
                src={image}
                alt={`${title} thumbnail ${index + 1}`}
                fill
                sizes="150px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => moveImage(1)}
          className="grid size-9 place-items-center rounded-full border border-border bg-white text-primary shadow-[0_8px_18px_rgba(67,43,27,0.08)] transition-colors hover:bg-primary hover:text-white"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </section>
  );
}

function TourTabs({
  activeTab,
  departures,
  facts,
  highlights,
  itinerary,
  itineraryDays,
  onTabChange,
  price,
  primaryDestination,
  tour,
}: {
  activeTab: TourTab;
  departures: PublicTourDeparture[];
  facts: TourFact[];
  highlights: string[];
  itinerary: PublicTourItinerary | null;
  itineraryDays: ItineraryDay[];
  onTabChange: (tab: TourTab) => void;
  price: number;
  primaryDestination: PublicDestination;
  tour: PublicTour;
}) {
  return (
    <section
      id="tour-detail-panel"
      className="mt-5 overflow-hidden rounded-[8px] border border-border bg-card shadow-[0_12px_30px_rgba(67,43,27,0.07)]"
    >
      <div className="grid border-b border-border md:grid-cols-4">
        {tabs.map(({ icon: Icon, label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => onTabChange(value)}
            className={cn(
              "relative flex min-h-12 items-center justify-center gap-2 border-b border-border px-2 font-sans text-[11px] font-bold transition-colors sm:text-[12px] md:border-b-0",
              activeTab === value
                ? "bg-muted/45 text-primary"
                : "text-secondary hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Icon className="size-4" strokeWidth={1.8} />
            <span className="text-center leading-tight">{label}</span>
            {activeTab === value ? (
              <span className="absolute bottom-0 left-5 right-5 h-0.5 bg-primary" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {activeTab === "summary" ? (
          <SummaryPanel
            facts={facts}
            highlights={highlights}
            itineraryDays={itineraryDays}
            tour={tour}
          />
        ) : null}
        {activeTab === "itinerary" ? (
          <ItineraryPanel
            highlights={highlights}
            itinerary={itinerary}
            itineraryDays={itineraryDays}
            primaryDestination={primaryDestination}
            tour={tour}
          />
        ) : null}
        {activeTab === "inclusions" ? (
          <InclusionsPanel tour={tour} />
        ) : null}
        {activeTab === "pricing" ? (
          <PricingPanel
            departures={departures}
            price={price}
            tour={tour}
          />
        ) : null}
      </div>
    </section>
  );
}

function SummaryPanel({
  facts,
  highlights,
  itineraryDays,
  tour,
}: {
  facts: TourFact[];
  highlights: string[];
  itineraryDays: ItineraryDay[];
  tour: PublicTour;
}) {
  return (
    <>
      <SectionTitle title="Tour Overview" />
      <p className="mt-3 max-w-[820px] font-sans text-[14px] font-medium leading-[1.7] text-secondary/82">
        {tour.description ||
          "A thoughtfully designed tour with expert-led storytelling, local culture and curated heritage experiences."}
      </p>
      {tour.notes ? (
        <p className="mt-3 max-w-[820px] rounded-[6px] bg-muted px-3 py-2 font-sans text-[12px] font-semibold leading-[1.6] text-accent">
          {tour.notes}
        </p>
      ) : null}

      <FactGrid facts={facts} />

      <div className="mt-5 border-t border-border pt-4">
        <SectionTitle title="Itinerary Highlights" />
        <HighlightList highlights={highlights} />
      </div>

      <DailyItinerary days={itineraryDays} />
    </>
  );
}

function ItineraryPanel({
  highlights,
  itinerary,
  itineraryDays,
  primaryDestination,
  tour,
}: {
  highlights: string[];
  itinerary: PublicTourItinerary | null;
  itineraryDays: ItineraryDay[];
  primaryDestination: PublicDestination;
  tour: PublicTour;
}) {
  return (
    <div id="itinerary">
      <SectionTitle title="Detailed Itinerary" />
      <p className="mt-3 max-w-[820px] font-sans text-[14px] font-medium leading-[1.7] text-secondary/78">
        {itinerary?.itinerarySummary ||
          tour.description ||
          primaryDestination.shortDescription ||
          "Each day combines landmark visits, expert interpretation and time to absorb the destination."}
      </p>
      <HighlightList highlights={highlights} />
      <DailyItinerary days={itineraryDays} />
    </div>
  );
}

function InclusionsPanel({ tour }: { tour: PublicTour }) {
  const inclusions =
    tour.inclusions.length > 0
      ? tour.inclusions
      : [
          "Expert-led tour guidance",
          "Curated sightseeing and heritage walks",
          "Accommodation on twin sharing basis",
          "Local transfers as mentioned in itinerary",
        ];
  const exclusions =
    tour.exclusions.length > 0
      ? tour.exclusions
      : [
          "Airfare, visa and travel insurance",
          "Personal expenses and optional activities",
          "Meals not mentioned in the itinerary",
          "Tips, porterage and camera charges",
        ];

  return (
    <div id="inclusions">
      <SectionTitle title="Inclusions / Exclusions" />
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <ListBlock icon={Check} items={inclusions} title="Inclusions" />
        <ListBlock icon={X} items={exclusions} title="Exclusions" />
      </div>
    </div>
  );
}

const GST_PERCENTAGE = 5;

function toPricedDeparture(departure: PublicTourDeparture): PricedDeparture {
  return {
    departureId: departure.departureId,
    tourId: departure.tourId,
    destinationId: departure.destinationId,
    departureDate: departure.departureDate,
    returnDate: departure.returnDate,
    seatsAvailable: departure.seatsAvailable,
    priceAdult: departure.priceAdult,
    priceExtraBed: departure.priceExtraBed,
    priceChildWithoutExtraBed: departure.priceChildWithoutExtraBed,
    singleOccupancy: departure.singleOccupancy,
    depositType: departure.depositType || "fixed",
    depositValue: departure.depositValue || 0,
    depositAppliesTo: departure.depositAppliesTo || "per_person",
    balanceDueDaysBefore: departure.balanceDueDaysBefore || 0,
    earlyBirdOffer: departure.earlyBirdOffer || null,
    bookingDeadline: departure.bookingDeadline,
    status: departure.status || "scheduled",
    childPricingRules: departure.childPricingRules || [],
    roomPolicy: departure.roomPolicy,
  };
}

function createTravellers(
  counts: TravellerCounts,
  childBirthDates: string[]
): Traveller[] {
  return [
    ...Array.from({ length: counts.adults }, (_item, index) => ({
      id: `adult-${index + 1}`,
      type: "adult" as const,
    })),
    ...Array.from({ length: counts.children }, (_item, index) => ({
      id: `child-${index + 1}`,
      type: "child" as const,
      dateOfBirth: childBirthDates[index] || undefined,
    })),
  ];
}

function formatPricingCategory(category: PricingCategory) {
  switch (category) {
    case "adult":
      return "Standard Guests";
    case "extra_bed":
      return "Extra Bed";
    case "child_without_extra_bed":
      return "Child Without Extra Bed";
    case "single_occupancy":
      return "Single Occupancy";
  }
}

type PricingRow = {
  category: PricingCategory;
  count: number;
  key: string;
  unitPrice: number;
};

const pricingCategorySortOrder: Record<PricingCategory, number> = {
  adult: 1,
  extra_bed: 2,
  child_without_extra_bed: 3,
  single_occupancy: 4,
};

function getPricingRows(option: AccommodationOption) {
  const rows = new Map<string, PricingRow>();

  option.rooms
    .flatMap((room) => room.allocations)
    .forEach((allocation) => {
      const key = [allocation.pricingCategory, allocation.price].join("-");
      const existingRow = rows.get(key);

      if (existingRow) {
        existingRow.count += 1;
        return;
      }

      rows.set(key, {
        category: allocation.pricingCategory,
        count: 1,
        key,
        unitPrice: allocation.price,
      });
    });

  return Array.from(rows.values()).sort((left, right) => {
    const categoryDifference =
      pricingCategorySortOrder[left.category] -
      pricingCategorySortOrder[right.category];

    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    return right.unitPrice - left.unitPrice;
  });
}

function formatBalanceDueDate(value: Date | null) {
  return value ? formatDate(value.toISOString()) : "-";
}

function PricingPanel({
  departures,
  price,
  tour,
}: {
  departures: PublicTourDeparture[];
  price: number;
  tour: PublicTour;
}) {
  const firstDepartureId = departures[0]
    ? getDepartureIdentifier(departures[0])
    : "";
  const [selectedDepartureId, setSelectedDepartureId] =
    useState(firstDepartureId);
  const [travellerCounts, setTravellerCounts] = useState<TravellerCounts>({
    adults: 1,
    children: 0,
  });
  const [childBirthDates, setChildBirthDates] = useState<string[]>([]);
  const [selectedAccommodationOptionId, setSelectedAccommodationOptionId] =
    useState("");

  const selectedDeparture =
    departures.find(
      (departure) => getDepartureIdentifier(departure) === selectedDepartureId
    ) || departures[0];
  const pricedDeparture = selectedDeparture
    ? toPricedDeparture(selectedDeparture)
    : null;
  const resolvedSelectedDepartureId = selectedDeparture
    ? getDepartureIdentifier(selectedDeparture)
    : "";
  const selectedDepartureIndex = Math.max(
    0,
    departures.findIndex(
      (departure) =>
        getDepartureIdentifier(departure) === resolvedSelectedDepartureId
    )
  );
  const maxTravellers =
    selectedDeparture?.seatsAvailable && selectedDeparture.seatsAvailable > 0
      ? selectedDeparture.seatsAvailable
      : 12;
  const totalTravellers = getTotalTravellers(travellerCounts);
  const travellers = useMemo(
    () => createTravellers(travellerCounts, childBirthDates),
    [childBirthDates, travellerCounts]
  );
  const departureValidationErrors = pricedDeparture
    ? validateDepartureForBooking(pricedDeparture, totalTravellers)
    : ["Select a scheduled departure."];
  const accommodationResult = (() => {
    if (!pricedDeparture || departureValidationErrors.length > 0) {
      return {
        options: [] as AccommodationOption[],
        error: "",
      };
    }

    try {
      return {
        options: generateAccommodationOptions({
          travellers,
          departure: pricedDeparture,
          childPricingRules: pricedDeparture.childPricingRules,
          roomPolicy: pricedDeparture.roomPolicy,
        }),
        error: "",
      };
    } catch (error) {
      return {
        options: [] as AccommodationOption[],
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Accommodation options could not be generated.",
      };
    }
  })();
  const accommodationOptions = accommodationResult.options;
  const selectedAccommodationOption =
    accommodationOptions.find(
      (option) => option.id === selectedAccommodationOptionId
    ) || accommodationOptions[0];
  const resolvedSelectedAccommodationOptionId =
    selectedAccommodationOption?.id || "";
  const subtotal = selectedAccommodationOption?.totalPrice ?? 0;
  const gstAmount = Math.round((subtotal * GST_PERCENTAGE) / 100);
  const grandTotal = subtotal + gstAmount;
  const depositAmount =
    pricedDeparture && selectedAccommodationOption
      ? calculateDeposit({
          depositAppliesTo: pricedDeparture.depositAppliesTo,
          depositType: pricedDeparture.depositType,
          depositValue: pricedDeparture.depositValue,
          grandTotal,
          totalTravellers,
        })
      : 0;
  const balanceAmount = calculateBalance(grandTotal, depositAmount);
  const balanceDueDate = pricedDeparture
    ? calculateBalanceDueDate(
        pricedDeparture.departureDate,
        pricedDeparture.balanceDueDaysBefore
      )
    : null;

  function updateTravellerCount(key: TravellerCountKey, delta: number) {
    setTravellerCounts((current) => {
      const minimum = key === "adults" ? 1 : 0;
      const nextValue = Math.max(minimum, current[key] + delta);
      const nextCounts = {
        ...current,
        [key]: nextValue,
      };

      if (delta > 0 && getTotalTravellers(nextCounts) > maxTravellers) {
        return current;
      }

      return nextCounts;
    });
  }

  function moveDeparture(direction: number) {
    if (departures.length === 0) {
      return;
    }

    const nextIndex =
      (selectedDepartureIndex + direction + departures.length) %
      departures.length;

    setSelectedDepartureId(getDepartureIdentifier(departures[nextIndex]));
  }

  function updateChildBirthDate(index: number, value: string) {
    setChildBirthDates((current) =>
      Array.from(
        { length: travellerCounts.children },
        (_item, currentIndex) =>
          currentIndex === index ? value : current[currentIndex] || ""
      )
    );
  }

  return (
    <div id="departure-pricing" className="space-y-4">
      <BookingStep
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous departure"
              onClick={() => moveDeparture(-1)}
              className="grid size-8 place-items-center rounded-full border border-border bg-background text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next departure"
              onClick={() => moveDeparture(1)}
              className="grid size-8 place-items-center rounded-full border border-border bg-background text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
        step="1"
        title="Select Your Dates"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {departures.map((departure) => {
            const departureId = getDepartureIdentifier(departure);
            const isSelected = departureId === resolvedSelectedDepartureId;

            return (
              <button
                key={departureId}
                type="button"
                onClick={() => setSelectedDepartureId(departureId)}
                className={cn(
                  "group/date min-h-[142px] rounded-[8px] border bg-background p-3 text-left font-sans shadow-[0_8px_18px_rgba(67,43,27,0.04)] transition-all hover:border-primary hover:bg-white",
                  isSelected
                    ? "border-primary ring-3 ring-primary/15"
                    : "border-border"
                )}
              >
                <span className="block text-[12px] font-bold text-secondary">
                  {formatDate(departure.departureDate)}
                </span>
                <span className="mt-1 block text-[10px] font-semibold text-secondary/58">
                  Tour length
                </span>
                <strong className="block text-[11px] text-secondary">
                  {tour.durationDn || "Announced soon"}
                </strong>
                <span className="mt-1.5 block text-[10px] font-semibold text-secondary/58">
                  Return
                </span>
                <strong className="block text-[11px] text-secondary">
                  {formatDate(departure.returnDate)}
                </strong>
                <span className="mt-1.5 block text-[10px] font-semibold text-secondary/58">
                  Start From
                </span>
                <strong className="block text-[12px] text-secondary">
                  {formatCurrency(departure.priceAdult || price)}
                </strong>
                <span
                  className={cn(
                    "mt-1.5 block text-[11px] font-bold",
                    departure.seatsAvailable > 0
                      ? "text-[#239a48]"
                      : "text-destructive"
                  )}
                >
                  {departure.seatsAvailable > 0
                    ? `${departure.seatsAvailable} Seats`
                    : "Sold Out"}
                </span>
                <span
                  className={cn(
                    "mt-2 grid size-4 place-items-center rounded-full border",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-secondary/35 bg-background"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full bg-white",
                      !isSelected && "opacity-0"
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </BookingStep>

      <BookingStep step="2" title="Add Traveller Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <TravellerCounter
            ageLabel="Above 12 yrs"
            label="Adult"
            minimum={1}
            value={travellerCounts.adults}
            onDecrease={() => updateTravellerCount("adults", -1)}
            onIncrease={() => updateTravellerCount("adults", 1)}
          />
          <TravellerCounter
            ageLabel="DOB required"
            label="Child"
            value={travellerCounts.children}
            onDecrease={() => updateTravellerCount("children", -1)}
            onIncrease={() => updateTravellerCount("children", 1)}
          />
        </div>

        {travellerCounts.children > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: travellerCounts.children }, (_item, index) => (
              <label
                key={`child-dob-${index + 1}`}
                className="flex min-w-0 flex-col gap-1.5 font-sans"
              >
                <span className="text-[11px] font-bold uppercase text-secondary/58">
                  Child {index + 1} Date of Birth
                </span>
                <input
                  required
                  aria-label={`Child ${index + 1} date of birth`}
                  className="h-11 rounded-[6px] border border-border bg-background px-3 text-[12px] font-semibold text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
                  type="date"
                  value={childBirthDates[index] || ""}
                  onChange={(event) =>
                    updateChildBirthDate(index, event.target.value)
                  }
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-2 rounded-[6px] bg-muted px-3 py-2 font-sans text-[11px] font-semibold leading-[1.5] text-secondary/72">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>
            <strong className="text-secondary">Please Note :</strong> Traveller
            details should match information on passport.
          </span>
        </div>

        <div className="mt-5">
          <h3 className="font-sans text-[13px] font-bold text-secondary">
            Lead Traveller
          </h3>
          <p className="mt-1 font-sans text-[11px] font-medium text-secondary/64">
            This traveller will serve as the contact person for the booking.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-[0.55fr_1.25fr_1.25fr]">
            <select
              aria-label="Lead traveller title"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
            >
              <option>Mr</option>
              <option>Ms</option>
              <option>Mrs</option>
              <option>Dr</option>
            </select>
            <input
              aria-label="Lead traveller first name"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              placeholder="First Name *"
              type="text"
            />
            <input
              aria-label="Lead traveller last name"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              placeholder="Last Name *"
              type="text"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              aria-label="Lead traveller email"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              placeholder="Email *"
              type="email"
            />
            <input
              aria-label="Lead traveller date of birth"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors text-secondary/70 focus:border-primary focus:ring-3 focus:ring-primary/15"
              type="date"
            />
            <select
              aria-label="Lead traveller nationality"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
            >
              <option>India</option>
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Australia</option>
              <option>Other</option>
            </select>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select
              aria-label="Lead traveller phone country code"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
            >
              <option>India +91</option>
              <option>US +1</option>
              <option>UK +44</option>
              <option>Australia +61</option>
            </select>
            <input
              aria-label="Lead traveller PAN number"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              placeholder="PAN Number *"
              type="text"
            />
            <div className="flex h-11 items-center gap-4 rounded-[6px] border border-border bg-background px-3 font-sans text-[12px] font-semibold text-secondary">
              <span className="font-bold">Gender *</span>
              <label className="inline-flex items-center gap-1.5">
                <input name="lead-gender" type="radio" />
                Male
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input name="lead-gender" type="radio" />
                Female
              </label>
            </div>
          </div>
        </div>

        <p className="mt-4 font-sans text-[12px] font-medium text-secondary/72">
          You will fill the remaining traveller data after payment.
        </p>
      </BookingStep>

      <BookingStep step="3" title="Select Accommodation">
        <p className="font-sans text-[12px] font-medium text-secondary/68">
          Select an accommodation option for {totalTravellers} traveller
          {totalTravellers === 1 ? "" : "s"}.
        </p>
        {departureValidationErrors.length > 0 ? (
          <div className="mt-3 rounded-[7px] border border-destructive/20 bg-destructive/5 px-3 py-2 font-sans text-[12px] font-semibold text-destructive">
            {departureValidationErrors[0]}
          </div>
        ) : null}
        {accommodationResult.error ? (
          <div className="mt-3 rounded-[7px] border border-accent/20 bg-muted px-3 py-2 font-sans text-[12px] font-semibold text-accent">
            {accommodationResult.error}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3">
          {accommodationOptions.map((option) => (
            <AccommodationOptionCard
              key={option.id}
              option={option}
              selected={resolvedSelectedAccommodationOptionId === option.id}
              onSelect={() => setSelectedAccommodationOptionId(option.id)}
            />
          ))}
        </div>
        <p className="mt-3 font-sans text-[12px] leading-[1.6] text-secondary/65">
          Pricing is shown for {tour.tourName} and updates with the selected
          departure and traveller count.
        </p>
      </BookingStep>

      <BookingSummary
        balanceAmount={balanceAmount}
        balanceDueDate={balanceDueDate}
        depositAmount={depositAmount}
        grandTotal={grandTotal}
        gstAmount={gstAmount}
        gstPercentage={GST_PERCENTAGE}
        selectedAccommodationOption={selectedAccommodationOption}
        subtotal={subtotal}
      />
    </div>
  );
}

function BookingStep({
  actions,
  children,
  step,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  step: string;
  title: string;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-background p-4 shadow-[0_10px_24px_rgba(67,43,27,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-primary font-sans text-[14px] font-bold leading-none text-white">
            {step}
          </span>
          <h2 className="min-w-0 font-heading text-[21px] font-bold leading-tight text-secondary">
            {title}
          </h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function AccommodationOptionCard({
  onSelect,
  option,
  selected,
}: {
  onSelect: () => void;
  option: AccommodationOption;
  selected: boolean;
}) {
  const roomCounts = option.rooms.reduce(
    (map, room) => {
      map[room.roomType] = (map[room.roomType] || 0) + 1;
      return map;
    },
    {} as Partial<Record<(typeof option.rooms)[number]["roomType"], number>>
  );

  return (
    <label
      className={cn(
        "grid cursor-pointer gap-3 rounded-[8px] border bg-background p-3 font-sans transition-colors hover:bg-muted/40 sm:grid-cols-[22px_minmax(0,1fr)_minmax(160px,0.42fr)]",
        selected ? "border-primary ring-3 ring-primary/15" : "border-border"
      )}
    >
      <input
        checked={selected}
        className="mt-1"
        name="tour-accommodation"
        onChange={onSelect}
        type="radio"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="font-heading text-[18px] leading-tight text-secondary">
            {option.title}
          </strong>
          {option.recommended ? (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">
              Recommended
            </span>
          ) : null}
          {option.requiresRoommateMatching ? (
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-accent">
              Matching Needed
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[12px] font-semibold text-secondary/64">
          {option.description}
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          {Object.entries(roomCounts).map(([roomType, count]) => (
            <span
              key={roomType}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-white px-2 py-1 text-[11px] font-bold text-secondary/72"
            >
              <BedDouble className="size-3.5 text-primary" />
              {ROOM_TYPES[roomType as keyof typeof ROOM_TYPES].title}
              {count && count > 1 ? ` x ${count}` : ""}
            </span>
          ))}
        </span>
      </span>
      <span className="grid gap-1.5 rounded-[7px] bg-muted/45 p-3 text-[12px] text-secondary">
        {getPricingRows(option).map((row) => (
          <span
            key={row.key}
            className="flex items-center justify-between gap-3"
          >
            <span className="font-semibold">
              {formatPricingCategory(row.category)}
            </span>
            <span className="font-bold">
              {row.count} x {formatCurrency(row.unitPrice)}
            </span>
          </span>
        ))}
        <span className="mt-1 flex items-center justify-between border-t border-border pt-2 text-[13px]">
          <strong>Total</strong>
          <strong>{formatCurrency(option.totalPrice)}</strong>
        </span>
      </span>
    </label>
  );
}

function BookingSummary({
  balanceAmount,
  balanceDueDate,
  depositAmount,
  grandTotal,
  gstAmount,
  gstPercentage,
  selectedAccommodationOption,
  subtotal,
}: {
  balanceAmount: number;
  balanceDueDate: Date | null;
  depositAmount: number;
  grandTotal: number;
  gstAmount: number;
  gstPercentage: number;
  selectedAccommodationOption?: AccommodationOption;
  subtotal: number;
}) {
  return (
    <BookingStep step="4" title="Booking Summary">
      <div className="grid gap-2 rounded-[8px] border border-border bg-muted/35 p-3 font-sans text-[12px] text-secondary">
        <SummaryLine
          label={selectedAccommodationOption?.title || "Tour Price"}
          value={formatCurrency(subtotal)}
        />
        <SummaryLine
          label={`GST (${gstPercentage}%)`}
          value={formatCurrency(gstAmount)}
        />
        <SummaryLine
          strong
          label="Grand Total"
          value={formatCurrency(grandTotal)}
        />
        <SummaryLine
          label="Deposit Payable"
          value={formatCurrency(depositAmount)}
        />
        <SummaryLine label="Balance" value={formatCurrency(balanceAmount)} />
        <SummaryLine
          label="Balance Due Date"
          value={formatBalanceDueDate(balanceDueDate)}
        />
      </div>
    </BookingStep>
  );
}

function SummaryLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-between gap-4",
        strong && "border-y border-border py-2 text-[14px]"
      )}
    >
      <span className={cn("font-semibold", strong && "font-bold")}>{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

function TravellerCounter({
  ageLabel,
  label,
  minimum = 0,
  onDecrease,
  onIncrease,
  value,
}: {
  ageLabel: string;
  label: string;
  minimum?: number;
  onDecrease: () => void;
  onIncrease: () => void;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[7px] border border-border bg-background px-3 py-2.5">
      <span className="min-w-0 font-sans">
        <span className="block text-[12px] font-bold leading-tight text-secondary">
          {label}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium leading-tight text-secondary/56">
          {ageLabel}
        </span>
      </span>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label} count`}
          disabled={value <= minimum}
          onClick={onDecrease}
          className="grid size-7 place-items-center rounded-full border border-border bg-white text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white disabled:pointer-events-none disabled:opacity-45"
        >
          <Minus className="size-3.5" />
        </button>
        <strong className="w-5 text-center font-sans text-[13px] text-secondary">
          {value}
        </strong>
        <button
          type="button"
          aria-label={`Increase ${label} count`}
          onClick={onIncrease}
          className="grid size-7 place-items-center rounded-full border border-border bg-white text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
        >
          <Plus className="size-3.5" />
        </button>
      </span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div>
      <h2 className="font-heading text-[22px] font-bold leading-tight text-secondary">
        {title}
      </h2>
      <span className="mt-2 block h-0.5 w-8 bg-primary" />
    </div>
  );
}

function FactGrid({ facts }: { facts: TourFact[] }) {
  return (
    <div className="mt-5 grid gap-3 border-b border-border pb-4 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((fact, index) => (
        <article
          key={fact.label}
          className={cn(
            "flex items-center gap-3",
            index > 0 && "xl:border-l xl:border-border xl:pl-5"
          )}
        >
          <fact.icon className="size-7 shrink-0 text-primary" strokeWidth={1.7} />
          <span className="font-sans">
            <span className="block text-[12px] font-medium text-secondary/72">
              {fact.label}
            </span>
            <strong className="mt-1 block text-[14px] leading-tight text-secondary">
              {fact.value}
            </strong>
          </span>
        </article>
      ))}
    </div>
  );
}

function HighlightList({ highlights }: { highlights: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5 font-sans text-[13px] font-semibold text-secondary">
      {highlights.map((highlight) => (
        <li key={highlight} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} />
          <span>{highlight}</span>
        </li>
      ))}
    </ul>
  );
}

function getDayMetaItems(day: ItineraryDay) {
  return [
    {
      label: "Places",
      value: day.placesVisited?.length ? day.placesVisited.join(", ") : "",
    },
    {
      label: "Transport",
      value: day.transport || "",
    },
    {
      label: "Walk",
      value: day.walkingDifficulty || "",
    },
    {
      label: "Meals",
      value: day.meals || "",
    },
  ].filter((item) => item.value);
}

function DailyItinerary({ days }: { days: ItineraryDay[] }) {
  return (
    <div className="relative mt-4 pl-5 before:absolute before:bottom-5 before:left-[6px] before:top-4 before:w-px before:bg-primary/45">
      <div className="overflow-hidden rounded-[8px] border border-border bg-background">
        {days.map((day) => (
          <article
            key={day.dayNumber}
            className="relative grid gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[58px_minmax(0,1fr)]"
          >
            <span className="absolute -left-[20px] top-5 size-3 rounded-full bg-accent ring-4 ring-background" />
            <span className="inline-flex h-7 w-14 items-center justify-center rounded-[5px] bg-accent font-sans text-[11px] font-bold text-white">
              Day {day.dayNumber}
            </span>
            <span className="min-w-0 font-sans">
              <strong className="block text-[14px] leading-tight text-secondary">
                {day.title}
              </strong>
              <span className="mt-1 block text-[12px] font-medium leading-[1.55] text-secondary/72">
                {day.summary}
              </span>
              {getDayMetaItems(day).length > 0 ? (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {getDayMetaItems(day).map((item) => (
                    <span
                      key={`${day.dayNumber}-${item.label}`}
                      className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold leading-none text-accent"
                    >
                      <strong className="text-secondary">{item.label}:</strong>{" "}
                      {item.value}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

function ListBlock({
  icon: Icon,
  items,
  title,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
}) {
  return (
    <article>
      <h3 className="font-heading text-[20px] font-bold text-secondary">
        {title}
      </h3>
      <ul className="mt-3 space-y-2.5 font-sans text-[13px] font-semibold leading-[1.55] text-secondary/78">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.1} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function BottomFacts({ facts }: { facts: TourFact[] }) {
  return (
    <section className="mt-5 grid overflow-hidden rounded-[8px] border border-border bg-card shadow-[0_10px_24px_rgba(67,43,27,0.05)] sm:grid-cols-2 lg:grid-cols-4">
      {facts.map((fact, index) => (
        <article
          key={fact.label}
          className={cn(
            "flex min-h-[72px] items-center gap-3 px-4 py-3",
            index > 0 && "border-t border-border sm:border-l sm:border-t-0"
          )}
        >
          <fact.icon className="size-7 shrink-0 text-primary" strokeWidth={1.55} />
          <span className="font-sans">
            <span className="block text-[12px] font-bold text-secondary">
              {fact.label}
            </span>
            <span className="mt-1 block text-[12px] font-medium text-secondary/72">
              {fact.value}
            </span>
          </span>
        </article>
      ))}
    </section>
  );
}

function PriceCard({
  bestDeparture,
  discountPercent,
  oldPrice,
  onSelectDeparture,
  price,
}: {
  bestDeparture?: PublicTourDeparture;
  discountPercent: number;
  oldPrice: number;
  onSelectDeparture: () => void;
  price: number;
}) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <span className="font-sans text-[13px] font-semibold text-secondary">
          From{" "}
          {oldPrice > 0 ? (
            <span className="text-secondary/58 line-through">
              {formatCurrency(oldPrice)}
            </span>
          ) : null}
        </span>
        {discountPercent > 0 ? (
          <span className="rounded-full bg-accent px-2.5 py-1.5 font-sans text-[12px] font-bold text-white">
            -{discountPercent}%
          </span>
        ) : null}
      </div>

      <strong className="mt-3 block font-sans text-[34px] font-bold leading-none text-secondary">
        {formatCurrency(price)}
      </strong>
      <span className="mt-2 block font-sans text-[12px] font-semibold text-secondary">
        per person
      </span>

      <div className="mt-5 flex items-center gap-3 border-y border-border py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <BedDouble className="size-4" strokeWidth={1.8} />
        </span>
        <span className="font-sans text-[12px] font-bold leading-[1.5] text-secondary">
          Price based on Private Double Room
        </span>
      </div>

      <Button
        type="button"
        onClick={onSelectDeparture}
        className="mt-5 w-full justify-between gap-3 px-5 text-[15px] font-normal"
      >
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="size-4" strokeWidth={1.9} />
          Select Departure
        </span>
        <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
      </Button>

      <Button
        nativeButton={false}
        render={
          <a
            href={`mailto:Holidays@easemytrip.com?subject=${encodeURIComponent(
              "Tour enquiry"
            )}`}
          />
        }
        variant="outline"
        className="mt-3 w-full px-5 text-[15px] font-normal"
      >
        Enquire Now
      </Button>

      {bestDeparture ? (
        <p className="mt-4 font-sans text-[11px] font-semibold text-secondary/58">
          Next departure: {formatDate(bestDeparture.departureDate)}
        </p>
      ) : null}
    </article>
  );
}

function HelpCard() {
  return (
    <article className="flex items-center gap-3 rounded-[8px] border border-border bg-card p-4 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      <UserRound className="size-9 shrink-0 text-secondary" strokeWidth={1.5} />
      <div className="font-sans text-secondary">
        <h2 className="font-heading text-[18px] font-bold">Need Help?</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[11px] font-semibold">
          <PhoneCall className="size-3.5 text-primary" />
          Call us : 011-43033003 | 43131313
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] font-semibold">
          <Mail className="size-3.5 text-primary" />
          Mail us : Holidays@easemytrip.com
        </p>
      </div>
    </article>
  );
}

function ExpertCard({ expert }: { expert: PublicExpert }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-5 shadow-[0_12px_30px_rgba(67,43,27,0.07)]">
      <div className="flex justify-center">
        <span className="relative size-20 overflow-hidden rounded-full bg-border">
          <Image
            src={getExpertImage(expert)}
            alt={expert.fullName}
            fill
            sizes="80px"
            className="object-cover"
          />
        </span>
      </div>

      <h2 className="mt-4 text-center font-heading text-[21px] font-bold leading-tight text-secondary">
        {expert.fullName}
      </h2>
      <p className="mt-2 text-center font-sans text-[13px] font-bold text-primary">
        {getExpertRole(expert)}
      </p>
      <p className="mt-4 font-sans text-[13px] font-medium leading-[1.65] text-secondary/82">
        {getExpertBio(expert)}
      </p>

      <div className="mt-4 flex items-center justify-center gap-4 text-primary">
        <Landmark className="size-6" strokeWidth={1.5} />
        <span className="h-6 w-px bg-border" />
        <BookOpen className="size-6" strokeWidth={1.5} />
        <span className="h-6 w-px bg-border" />
        <Clock3 className="size-6" strokeWidth={1.5} />
      </div>

      <Button
        nativeButton={false}
        render={<Link href="/about" />}
        variant="outline"
        className="mt-5 w-full justify-between px-5 text-[15px] font-normal"
      >
        View Profile
        <ButtonArrow className="group-hover/button:brightness-0 group-hover/button:invert" />
      </Button>
    </article>
  );
}
