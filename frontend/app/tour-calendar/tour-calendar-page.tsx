"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  BookOpen,
  Bus,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Landmark,
  MapPin,
  Sprout,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { TourExpertHoverPopup } from "@/components/tours/tour-showcase-card";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fallbackUpcomingTours,
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicExperts,
  listPublicTourDepartures,
  listPublicTours,
  type PublicDestination,
  type PublicExpert,
  type PublicTour,
  type PublicTourDeparture,
} from "@/lib/home-travel";
import { getTourHref, matchesRouteValue } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

type DepartureStatus = "available" | "few" | "almost" | "full";

type EnrichedDeparture = {
  departure: PublicTourDeparture;
  destination: PublicDestination | undefined;
  expert: PublicExpert | undefined;
  tour: PublicTour;
};

type DestinationOption = {
  id: string;
  label: string;
};

type SortMode = "price-low" | "price-high";

const monthNameFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
});
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const departureCapacityFallback = 25;
const currentDateDotClassName = "bg-[#2faa5d]";
const departureDateDotClassName = "bg-primary";
const monthOptions = Array.from({ length: 12 }, (_item, monthIndex) => ({
  label: monthNameFormatter.format(new Date(2026, monthIndex, 1)),
  value: monthIndex,
}));

const fallbackExpertImages = [
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Varanasi.webp",
];

const benefits: Array<{
  description: string;
  icon: LucideIcon;
  title: string;
}> = [
    {
      title: "Expert-Led Tours",
      description: "Travel with knowledgeable experts and storytellers.",
      icon: Users,
    },
    {
      title: "Small Groups",
      description: "Personalised experiences with small group sizes.",
      icon: BadgeCheck,
    },
    {
      title: "Curated Itineraries",
      description: "Carefully designed tours covering highlights and hidden gems.",
      icon: BookOpen,
    },
    {
      title: "Responsible Travel",
      description: "Supporting local communities and sustainable tourism.",
      icon: Sprout,
    },
  ];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getDateKey(value: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month) {
    return new Date();
  }

  return new Date(year, month - 1, 1);
}

function getTodayKey() {
  return getDateKey(new Date());
}

function getCalendarYearOptions(departures: EnrichedDeparture[]) {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>([
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ]);

  departures.forEach(({ departure }) => {
    const date = departure.departureDate
      ? new Date(departure.departureDate)
      : null;

    if (date && !Number.isNaN(date.getTime())) {
      years.add(date.getFullYear());
    }
  });

  return Array.from(years).sort((left, right) => left - right);
}

function getDestinationOptions(departures: EnrichedDeparture[]) {
  const destinationOptions = new Map<string, DestinationOption>();
  const usedDestinationLabels = new Set<string>();

  departures.forEach((item) => {
    const destinationId = [
      item.departure.destinationId,
      ...getTourDestinationIds(item.tour),
    ].find(Boolean);
    const label = getDestinationName(item);
    const labelKey = label.trim().toLowerCase();

    if (!destinationId || !labelKey || usedDestinationLabels.has(labelKey)) {
      return;
    }

    usedDestinationLabels.add(labelKey);
    destinationOptions.set(destinationId, {
      id: destinationId,
      label,
    });
  });

  return Array.from(destinationOptions.values()).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

function buildCalendarDays(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const firstGridDate = new Date(monthStart);

  firstGridDate.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_item, index) => {
    const date = new Date(firstGridDate);

    date.setDate(firstGridDate.getDate() + index);

    return {
      date,
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function getOrdinalSuffix(day: number) {
  const teenRemainder = day % 100;

  if (teenRemainder >= 11 && teenRemainder <= 13) {
    return "th";
  }

  if (day % 10 === 1) {
    return "st";
  }

  if (day % 10 === 2) {
    return "nd";
  }

  if (day % 10 === 3) {
    return "rd";
  }

  return "th";
}

function formatOrdinalDate(value: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  const day = date.getDate();
  const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);

  return `${day}${getOrdinalSuffix(day)} ${month} ${date.getFullYear()}`;
}

function compactDurationLabel(value: string) {
  const source = value.trim();

  if (!source) {
    return "Coming Soon";
  }

  const dayNightMatch = source.match(
    /(\d+)\s*(?:days?|d)\b\s*(?:[/,-]|and)?\s*(\d+)\s*(?:nights?|n)\b/i
  );

  if (dayNightMatch) {
    return `${dayNightMatch[1]}D/${dayNightMatch[2]}N`;
  }

  const dayMatch = source.match(/(\d+)\s*(?:days?|d)\b/i);

  if (dayMatch) {
    const days = Number(dayMatch[1]);

    return days > 1 ? `${days}D/${days - 1}N` : "1 Day";
  }

  return source.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

function formatPrice(value: number) {
  return currencyFormatter.format(value || 0);
}

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function matchesDepartureSelection(
  item: EnrichedDeparture,
  destinationId: string,
  tourId: string
) {
  const matchesTour =
    tourId === "all" || item.departure.tourId === tourId;
  const matchesDestination =
    destinationId === "all" ||
    [
      item.departure.destinationId,
      ...getTourDestinationIds(item.tour),
    ].includes(destinationId);

  return matchesTour && matchesDestination;
}

function getUpcomingDepartureMonth(
  departures: EnrichedDeparture[],
  destinationId: string,
  tourId: string
) {
  if (destinationId === "all" && tourId === "all") {
    return startOfMonth(new Date());
  }

  const today = startOfDay(new Date()).getTime();
  const nextDeparture = departures
    .filter((item) => matchesDepartureSelection(item, destinationId, tourId))
    .filter(({ departure }) => getDateValue(departure.departureDate) >= today)
    .sort(
      (left, right) =>
        getDateValue(left.departure.departureDate) -
        getDateValue(right.departure.departureDate)
    )[0];

  if (!nextDeparture?.departure.departureDate) {
    return startOfMonth(new Date());
  }

  return startOfMonth(new Date(nextDeparture.departure.departureDate));
}

function getDepartureIdentifier(departure: PublicTourDeparture) {
  return departure.departureId || departure.id;
}

function getDepartureStatus(departures: EnrichedDeparture[]): DepartureStatus {
  if (departures.length === 0) {
    return "available";
  }

  if (
    departures.every(({ departure }) => getDepartureSeatsLeft(departure) <= 0)
  ) {
    return "full";
  }

  if (
    departures.some(({ departure }) => getDepartureSeatsLeft(departure) <= 3)
  ) {
    return "almost";
  }

  if (
    departures.some(({ departure }) => getDepartureSeatsLeft(departure) <= 8)
  ) {
    return "few";
  }

  return "available";
}

function statusBadgeClassName(status: DepartureStatus) {
  switch (status) {
    case "available":
      return "bg-primary text-white";
    case "few":
      return "bg-[#f0a22a] text-white";
    case "almost":
      return "bg-[#d95c34] text-white";
    case "full":
      return "bg-[#bdb2a6] text-white";
  }
}

function getDepartureStatusLabel(status: DepartureStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "few":
      return "Few Seats";
    case "almost":
      return "Almost Full";
    case "full":
      return "Full";
  }
}

function getTourImage(tour?: PublicTour) {
  return getHomeMediaUrl(
    tour?.thumbnailImage ||
    tour?.bannerImage ||
    tour?.galleryImages?.[0] ||
    fallbackUpcomingTours[0]?.image ||
    "/home assets/Khajuraho.webp"
  );
}

function getExpertImage(expert?: PublicExpert, index = 0) {
  return getHomeMediaUrl(
    expert?.image ||
    fallbackExpertImages[index % fallbackExpertImages.length] ||
    "/home assets/Khajuraho.webp"
  );
}

function getExpertInitials(expert?: PublicExpert) {
  const name = expert?.fullName || "Expert";

  return (
    name
      .split(" ")
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "EX"
  );
}

function getExpertName(item?: EnrichedDeparture) {
  if (item?.expert?.fullName.trim()) {
    return item.expert.fullName;
  }

  const expertId = item?.tour.expertId.trim();

  if (!expertId) {
    return "Ancient Trails Expert";
  }

  return expertId
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getExpertRole(expert?: PublicExpert) {
  return expert?.expertiseTags[0] || "Heritage Specialist";
}

function getExpertBio(expert?: PublicExpert) {
  return (
    expert?.fullBiography ||
    "Indologist, researcher and storyteller with deep expertise in cultural heritage journeys."
  );
}

function getDestinationName(item?: EnrichedDeparture) {
  return (
    item?.destination?.destinationName ||
    item?.tour.tourName ||
    (item?.tour ? getTourDestinationIds(item.tour)[0] : "") ||
    item?.tour.destinationId ||
    "India"
  );
}

function resolveTourFilter(routeValue: string, tours: PublicTour[]) {
  if (!routeValue.trim()) {
    return "all";
  }

  return (
    tours.find((tour) =>
      matchesRouteValue(routeValue, tour.tourId, tour.tourName)
    )?.tourId || "all"
  );
}

function resolveDestinationFilter(
  routeValue: string,
  destinations: PublicDestination[]
) {
  if (!routeValue.trim()) {
    return "all";
  }

  return (
    destinations.find((destination) =>
      matchesRouteValue(
        routeValue,
        destination.destinationId,
        destination.destinationName
      )
    )?.destinationId || "all"
  );
}

function getDepartureCapacity(departure: PublicTourDeparture) {
  const departureWithCapacity = departure as PublicTourDeparture & {
    capacity?: number;
    maxSeats?: number;
    seatsTotal?: number;
    totalSeats?: number;
  };
  const declaredCapacity = [
    departureWithCapacity.capacity,
    departureWithCapacity.totalSeats,
    departureWithCapacity.seatsTotal,
    departureWithCapacity.maxSeats,
  ].find((value) => typeof value === "number" && value > 0);

  return Math.max(
    departure.seatsAvailable,
    declaredCapacity || departureCapacityFallback
  );
}

function getDeclaredFilledSeats(departure: PublicTourDeparture) {
  const departureWithSeats = departure as PublicTourDeparture & {
    bookedSeats?: number;
    seatsBooked?: number;
  };
  const filledSeats = [
    departure.filledSeats,
    departureWithSeats.bookedSeats,
    departureWithSeats.seatsBooked,
  ].find((value) => typeof value === "number" && value >= 0);

  return typeof filledSeats === "number"
    ? Math.max(0, Math.trunc(filledSeats))
    : null;
}

function getFilledSeats(departure: PublicTourDeparture) {
  const capacity = getDepartureCapacity(departure);
  const declaredFilledSeats = getDeclaredFilledSeats(departure);

  if (declaredFilledSeats !== null) {
    return Math.min(capacity, declaredFilledSeats);
  }

  return Math.min(
    capacity,
    Math.max(0, Math.trunc(capacity - departure.seatsAvailable))
  );
}

function getDepartureSeatsLeft(departure: PublicTourDeparture) {
  const declaredFilledSeats = getDeclaredFilledSeats(departure);

  if (declaredFilledSeats !== null) {
    return Math.max(0, getDepartureCapacity(departure) - declaredFilledSeats);
  }

  return Math.max(0, Math.trunc(departure.seatsAvailable));
}

function getFilledSeatPercent(departure: PublicTourDeparture) {
  const capacity = getDepartureCapacity(departure);

  if (capacity <= 0) {
    return 0;
  }

  const filledSeats = getFilledSeats(departure);

  return Math.min(100, Math.max(0, (filledSeats / capacity) * 100));
}

function getSeatProgressColorClass(filledPercent: number) {
  if (filledPercent >= 70) {
    return "bg-[#d6452f]";
  }

  if (filledPercent >= 25) {
    return "bg-[#f5b82e]";
  }

  return "bg-[#2faa5d]";
}

function sortDeparturesByPrice(
  departures: EnrichedDeparture[],
  sortMode: SortMode
) {
  return [...departures].sort((left, right) => {
    const priceDifference =
      sortMode === "price-high"
        ? right.departure.priceAdult - left.departure.priceAdult
        : left.departure.priceAdult - right.departure.priceAdult;

    if (priceDifference !== 0) {
      return priceDifference;
    }

    return (
      getDateValue(left.departure.departureDate) -
      getDateValue(right.departure.departureDate)
    );
  });
}

function createFallbackExperts(): PublicExpert[] {
  return [
    {
      id: "fallback-expert-1",
      expertId: "GIRINATH-BHARADE",
      fullName: "Mr. Girinath Bharade",
      image: "/home assets/Khajuraho.webp",
      fullBiography:
        "Founder and Indologist, researcher and storyteller with special reverence for South India.",
      expertiseTags: ["Founder & Indologist"],
      qualifications: ["Temple Architecture"],
      languages: ["English", "Hindi"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "fallback-expert-2",
      expertId: "MEERA-NAIR",
      fullName: "Meera Nair",
      image: "/home assets/destination/Udaipur.webp",
      fullBiography:
        "Expert in temple architecture and cultural heritage trails.",
      expertiseTags: ["Heritage Specialist"],
      qualifications: ["Cultural Historian"],
      languages: ["English", "Malayalam"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "fallback-expert-3",
      expertId: "ROHIT-SINGH",
      fullName: "Rohit Singh",
      image: "/home assets/destination/Hampi.webp",
      fullBiography:
        "Archaeologist and historian passionate about ancient civilizations and art.",
      expertiseTags: ["Archaeologist"],
      qualifications: ["Ancient Civilizations"],
      languages: ["English", "Hindi"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "fallback-expert-4",
      expertId: "VIKRAM-DESHPANDE",
      fullName: "Vikram Deshpande",
      image: "/home assets/destination/Varanasi.webp",
      fullBiography:
        "Researcher and author specialising in Indian history and philosophy.",
      expertiseTags: ["History Researcher"],
      qualifications: ["Indian Philosophy"],
      languages: ["English", "Hindi", "Marathi"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function createFallbackData(): EnrichedDeparture[] {
  const now = new Date();
  const experts = createFallbackExperts();
  const tourSeeds = [
    {
      tourId: "BADAMI-HAMPI",
      tourName: "Flavours of Badami & Hampi",
      destinationId: "HAMPI",
      durationDn: "6D/5N",
      category: "Heritage",
      image: "/home assets/destination/Hampi.webp",
      city: "Hampi",
      state: "Karnataka",
      seats: 25,
      price: 35500,
      expert: experts[0],
      dayOffset: 24,
    },
    {
      tourId: "KERALA-TEMPLE",
      tourName: "Kerala Backwaters & Temple Trail",
      destinationId: "KERALA",
      durationDn: "6D/7N",
      category: "Cultural",
      image: "/home assets/Vietnam.webp",
      city: "Kochi",
      state: "Kerala",
      seats: 12,
      price: 42500,
      expert: experts[1],
      dayOffset: 38,
    },
    {
      tourId: "SACRED-SOUTH",
      tourName: "Sacred South Trail",
      destinationId: "TAMIL-NADU",
      durationDn: "7D/6N",
      category: "Spiritual",
      image: "/home assets/Khajuraho.webp",
      city: "Thanjavur",
      state: "Tamil Nadu",
      seats: 30,
      price: 37000,
      expert: experts[2],
      dayOffset: 52,
    },
    {
      tourId: "HIMALAYAN-HERITAGE",
      tourName: "Himalayan Heritage Journey",
      destinationId: "HIMALAYA",
      durationDn: "9D/8N",
      category: "Nature",
      image: "/home assets/destination/North_d.webp",
      city: "Kangra",
      state: "Himachal",
      seats: 10,
      price: 46500,
      expert: experts[3],
      dayOffset: 72,
    },
  ];

  return tourSeeds.map((seed, index) => {
    const departureDate = new Date(now);
    departureDate.setDate(now.getDate() + seed.dayOffset);

    const returnDate = new Date(departureDate);
    returnDate.setDate(departureDate.getDate() + 5);

    const tour: PublicTour = {
      id: `fallback-tour-${index + 1}`,
      tourId: seed.tourId,
      tourName: seed.tourName,
      tourType: "Curated Tour",
      tourFormat: index % 2 === 0 ? "Heritage Tours" : "Short Trails",
      destinationId: seed.destinationId,
      destinationIds: [seed.destinationId],
      durationDn: seed.durationDn,
      category: seed.category,
      isBestseller: index === 0,
      difficulty: "Easy",
      bestSeason: "Oct - Mar",
      description:
        "A carefully designed journey through living heritage, local culture and timeless monuments.",
      inclusions: [],
      exclusions: [],
      expertId: seed.expert.expertId,
      notes: "",
      bannerImage: seed.image,
      galleryImages: [],
      video: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return {
      departure: {
        id: `fallback-departure-${index + 1}`,
        departureId: `${seed.tourId}-DEP-${index + 1}`,
        tourId: seed.tourId,
        destinationId: seed.destinationId,
        departureDate: departureDate.toISOString(),
        returnDate: returnDate.toISOString(),
        seatsAvailable: seed.seats,
        priceAdult: seed.price,
        priceExtraBed: seed.price,
        priceChildWithoutExtraBed: seed.price,
        singleOccupancy: seed.price,
        depositType: "fixed",
        depositValue: 0,
        depositAppliesTo: "per_person",
        balanceDueDaysBefore: 0,
        earlyBirdOffer: null,
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
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      destination: {
        id: `fallback-destination-${index + 1}`,
        destinationId: seed.destinationId,
        destinationName: seed.city,
        destinationType: "Domestic",
        countryRegion: "India",
        state: seed.state,
        city: seed.city,
        primaryHeritageFocus: seed.category,
        unescoSite: index === 0,
        keyLandmarks: [],
        recommendedDurationDays: 6,
        shortDescription: "",
        dressCode: "",
        footwear: "",
        permits: "",
        idRequirement: "",
        restrictions: "",
        bannerImage: seed.image,
        galleryImages: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      expert: seed.expert,
      tour,
    };
  });
}

function buildEnrichedDepartures(
  tours: PublicTour[],
  departures: PublicTourDeparture[],
  destinations: PublicDestination[],
  experts: PublicExpert[]
) {
  const tourById = new Map(tours.map((tour) => [tour.tourId, tour]));
  const destinationById = new Map(
    destinations.map((destination) => [destination.destinationId, destination])
  );
  const expertById = new Map(experts.map((expert) => [expert.expertId, expert]));

  return departures
    .map((departure) => {
      const tour = tourById.get(departure.tourId);

      if (!tour) {
        return null;
      }

      return {
        departure,
        destination: destinationById.get(
          departure.destinationId || getTourDestinationIds(tour)[0] || tour.destinationId
        ),
        expert: expertById.get(tour.expertId),
        tour,
      };
    })
    .filter((item): item is EnrichedDeparture => Boolean(item))
    .sort(
      (left, right) =>
        getDateValue(left.departure.departureDate) -
        getDateValue(right.departure.departureDate)
    );
}

function getUniqueExperts(
  departures: EnrichedDeparture[],
  experts: PublicExpert[]
) {
  const expertById = new Map<string, PublicExpert>();

  departures.forEach((item) => {
    if (item.expert) {
      expertById.set(item.expert.expertId, item.expert);
    }
  });

  experts.forEach((expert) => {
    if (!expertById.has(expert.expertId)) {
      expertById.set(expert.expertId, expert);
    }
  });

  return Array.from(expertById.values());
}

export function TourCalendarPage({
  initialDestinationQuery = "",
  initialTourQuery = "",
}: {
  initialDestinationQuery?: string;
  initialTourQuery?: string;
}) {
  const fallbackData = useMemo(() => createFallbackData(), []);
  const fallbackExperts = useMemo(() => createFallbackExperts(), []);
  const fallbackTours = useMemo(
    () => fallbackData.map(({ tour }) => tour),
    [fallbackData]
  );
  const fallbackDestinations = useMemo(
    () =>
      fallbackData
        .map(({ destination }) => destination)
        .filter((destination): destination is PublicDestination =>
          Boolean(destination)
        ),
    [fallbackData]
  );
  const [enrichedDepartures, setEnrichedDepartures] =
    useState<EnrichedDeparture[]>(fallbackData);
  const [experts, setExperts] = useState<PublicExpert[]>(fallbackExperts);
  const [selectedTourId, setSelectedTourId] = useState(() =>
    resolveTourFilter(initialTourQuery, fallbackTours)
  );
  const [selectedDestinationId, setSelectedDestinationId] = useState(() =>
    resolveDestinationFilter(initialDestinationQuery, fallbackDestinations)
  );
  const [selectedDateKey, setSelectedDateKey] = useState(() => getTodayKey());
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("price-low");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCalendarData() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [
          toursResponse,
          departuresResponse,
          destinationsResponse,
          expertsResponse,
        ] = await Promise.all([
          listPublicTours(),
          listPublicTourDepartures(),
          listPublicDestinations(),
          listPublicExperts(),
        ]);
        const nextDepartures = buildEnrichedDepartures(
          toursResponse.data.tours,
          departuresResponse.data.departures,
          destinationsResponse.data.destinations,
          expertsResponse.data.experts
        );
        const sourceDepartures =
          nextDepartures.length > 0 ? nextDepartures : createFallbackData();
        const nextTours =
          toursResponse.data.tours.length > 0
            ? toursResponse.data.tours
            : sourceDepartures.map(({ tour }) => tour);
        const nextDestinations =
          destinationsResponse.data.destinations.length > 0
            ? destinationsResponse.data.destinations
            : sourceDepartures
              .map(({ destination }) => destination)
              .filter((destination): destination is PublicDestination =>
                Boolean(destination)
              );
        const nextSelectedTourId = resolveTourFilter(initialTourQuery, nextTours);
        const nextSelectedDestinationId = resolveDestinationFilter(
          initialDestinationQuery,
          nextDestinations
        );

        if (isMounted) {
          setExperts(
            expertsResponse.data.experts.length > 0
              ? expertsResponse.data.experts
              : createFallbackExperts()
          );
          setEnrichedDepartures(sourceDepartures);
          setSelectedTourId(nextSelectedTourId);
          setSelectedDestinationId(nextSelectedDestinationId);
          setSelectedDateKey(getTodayKey());
          setIsDateFilterActive(false);
          setVisibleMonth(
            getUpcomingDepartureMonth(
              sourceDepartures,
              nextSelectedDestinationId,
              nextSelectedTourId
            )
          );
        }
      } catch {
        if (isMounted) {
          const fallbackDepartures = createFallbackData();
          const nextTours = fallbackDepartures.map(({ tour }) => tour);
          const nextDestinations = fallbackDepartures
            .map(({ destination }) => destination)
            .filter((destination): destination is PublicDestination =>
              Boolean(destination)
            );
          const nextSelectedTourId = resolveTourFilter(initialTourQuery, nextTours);
          const nextSelectedDestinationId = resolveDestinationFilter(
            initialDestinationQuery,
            nextDestinations
          );

          setLoadError("Live tour calendar is temporarily unavailable.");
          setExperts(createFallbackExperts());
          setEnrichedDepartures(fallbackDepartures);
          setSelectedTourId(nextSelectedTourId);
          setSelectedDestinationId(nextSelectedDestinationId);
          setSelectedDateKey(getTodayKey());
          setIsDateFilterActive(false);
          setVisibleMonth(
            getUpcomingDepartureMonth(
              fallbackDepartures,
              nextSelectedDestinationId,
              nextSelectedTourId
            )
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCalendarData();

    return () => {
      isMounted = false;
    };
  }, [initialDestinationQuery, initialTourQuery]);

  const calendarFilteredDepartures = useMemo(() => {
    return enrichedDepartures.filter((item) =>
      matchesDepartureSelection(item, selectedDestinationId, selectedTourId)
    );
  }, [enrichedDepartures, selectedDestinationId, selectedTourId]);
  const sortedCalendarFilteredDepartures = useMemo(
    () => sortDeparturesByPrice(calendarFilteredDepartures, sortMode),
    [calendarFilteredDepartures, sortMode]
  );

  const departuresByDate = useMemo(() => {
    return sortedCalendarFilteredDepartures.reduce(
      (map, departure) => {
        const key = getDateKey(departure.departure.departureDate);

        if (!key) {
          return map;
        }

        map[key] = [...(map[key] || []), departure];

        return map;
      },
      {} as Record<string, EnrichedDeparture[]>
    );
  }, [sortedCalendarFilteredDepartures]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth]
  );
  const destinationOptions = useMemo(
    () => getDestinationOptions(enrichedDepartures),
    [enrichedDepartures]
  );
  const calendarYearOptions = useMemo(
    () => getCalendarYearOptions(enrichedDepartures),
    [enrichedDepartures]
  );
  const selectedDateDepartures = selectedDateKey
    ? sortedCalendarFilteredDepartures.filter(
      ({ departure }) =>
        getDateKey(departure.departureDate) === selectedDateKey
    )
    : [];
  const visibleDepartures =
    isDateFilterActive && selectedDateDepartures.length > 0
      ? selectedDateDepartures
      : sortedCalendarFilteredDepartures;
  const visibleExperts = getUniqueExperts(calendarFilteredDepartures, experts);

  function clearDateSelection() {
    setSelectedDateKey(getTodayKey());
    setIsDateFilterActive(false);
  }

  function selectDate(key: string) {
    const monthKey = key.slice(0, 7);

    setSelectedDateKey(key);
    setIsDateFilterActive(true);

    if (monthKey) {
      setVisibleMonth(getMonthDate(monthKey));
    }
  }

  function selectVisibleMonth(monthIndex: number, year = visibleMonth.getFullYear()) {
    setVisibleMonth(
      new Date(year, monthIndex, 1)
    );
    clearDateSelection();
  }

  function selectVisibleYear(year: number) {
    setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1));
    clearDateSelection();
  }

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeaderBand />

      <section className="mx-auto grid w-full max-w-[1300px] items-start gap-5 px-4 pb-6 pt-8 sm:px-6 lg:grid-cols-[430px_minmax(0,1fr)] lg:px-0">
        <CalendarPanel
          calendarDays={calendarDays}
          calendarYearOptions={calendarYearOptions}
          departuresByDate={departuresByDate}
          isDateFilterActive={isDateFilterActive}
          selectedDateKey={selectedDateKey}
          visibleMonth={visibleMonth}
          onMonthChange={selectVisibleMonth}
          onSelectDate={selectDate}
          onYearChange={selectVisibleYear}
          onClearDate={clearDateSelection}
        />

        <UpcomingDeparturesPanel
          destinationOptions={destinationOptions}
          departures={visibleDepartures}
          isLoading={isLoading}
          loadError={loadError}
          selectedDestinationId={selectedDestinationId}
          sortMode={sortMode}
          onDestinationChange={(destinationId) => {
            setSelectedDestinationId(destinationId);
            clearDateSelection();
            setVisibleMonth(
              getUpcomingDepartureMonth(
                enrichedDepartures,
                destinationId,
                selectedTourId
              )
            );
          }}
          onSortModeChange={setSortMode}
        />
      </section>

    </main>
  );
}

function HeaderBand() {
  return (
    <section className="relative h-[200px] overflow-hidden bg-secondary">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Ancient Trails heritage landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,18,9,0.12)_0%,rgba(35,18,9,0.34)_100%)]" />
      <div className="relative z-10 mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-0">
        <Header />
      </div>
    </section>
  );
}

function CalendarPanel({
  calendarDays,
  calendarYearOptions,
  departuresByDate,
  isDateFilterActive,
  selectedDateKey,
  visibleMonth,
  onMonthChange,
  onSelectDate,
  onYearChange,
  onClearDate,
}: {
  calendarDays: CalendarDay[];
  calendarYearOptions: number[];
  departuresByDate: Record<string, EnrichedDeparture[]>;
  isDateFilterActive: boolean;
  selectedDateKey: string;
  visibleMonth: Date;
  onMonthChange: (monthIndex: number, year?: number) => void;
  onSelectDate: (key: string) => void;
  onYearChange: (year: number) => void;
  onClearDate: () => void; // ADD
}) {
  const todayKey = getTodayKey();

  return (
    <aside className="lg:sticky lg:top-[118px] lg:self-start">
      <article className="rounded-[9px] border border-[#ead8c5] bg-white/94 p-6 transition-all duration-300">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-[22px] font-bold leading-none text-secondary">
            Filter by Date
          </h2>

          {isDateFilterActive ? (
            <button
              type="button"
              onClick={onClearDate}
              className="font-sans text-[12px] font-semibold text-primary transition-colors hover:text-accent hover:underline"
            >
              Clear All
            </button>
          ) : null}
        </div>
        <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const previousMonth = addMonths(visibleMonth, -1);

              onMonthChange(previousMonth.getMonth(), previousMonth.getFullYear());
            }}
            className="grid size-9 place-items-center rounded-full border border-transparent text-secondary/60 transition-all hover:border-primary/20 hover:bg-[#fff1e5] hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={String(visibleMonth.getMonth())}
              onValueChange={(value) => {
                if (value !== null) {
                  onMonthChange(Number(value));
                }
              }}
            >
              <SelectTrigger
                aria-label="Select month"
                className="h-10 rounded-full border-[#e8cbaa] bg-[#fffaf4] text-[13px] font-bold"
              >
                <SelectValue>
                  {monthOptions.find(
                    (month) => month.value === visibleMonth.getMonth()
                  )?.label || monthNameFormatter.format(visibleMonth)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(visibleMonth.getFullYear())}
              onValueChange={(value) => {
                if (value !== null) {
                  onYearChange(Number(value));
                }
              }}
            >
              <SelectTrigger
                aria-label="Select year"
                className="h-10 rounded-full border-[#e8cbaa] bg-[#fffaf4] text-[13px] font-bold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {calendarYearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextMonth = addMonths(visibleMonth, 1);

              onMonthChange(nextMonth.getMonth(), nextMonth.getFullYear());
            }}
            className="grid size-9 place-items-center rounded-full border border-transparent text-secondary/60 transition-all hover:border-primary/20 hover:bg-[#fff1e5] hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-y-2">
          {weekdayLabels.map((day) => (
            <span
              key={day}
              className="text-center font-sans text-[10px] font-bold uppercase text-secondary/48"
            >
              {day}
            </span>
          ))}
          {calendarDays.map((day) => {
            const key = getDateKey(day.date);
            const dayDepartures = departuresByDate[key] || [];
            const hasDepartures = dayDepartures.length > 0;
            const isSelected = isDateFilterActive && selectedDateKey === key;
            const isToday = todayKey === key;

            return (
              <button
                key={key}
                type="button"
                disabled={!hasDepartures}
                onClick={() => onSelectDate(key)}
                aria-pressed={isSelected}
                className={cn(
                  "relative mx-auto grid size-10 place-items-center rounded-full border border-transparent font-sans text-[13px] font-semibold leading-none transition-all disabled:cursor-default focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary",
                  day.isCurrentMonth ? "text-secondary" : "text-secondary/32",
                  hasDepartures &&
                  "bg-primary text-secondary text-white",
                  isToday &&
                  "rounded-full bg-[#d1fce1] border border-[#2faa5d] ",
                  isSelected &&
                  "border-primary/45 bg-primary text-white "
                )}
              >
                <span className="leading-none">{day.date.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className=" flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#f1ebe6] pt-4 font-sans text-[11px] font-semibold text-secondary/62">
          <CalendarLegendDot
            className={currentDateDotClassName}
            label="Current date"
          />
          <CalendarLegendDot
            className={departureDateDotClassName}
            label="Departure date"
          />
        </div>
      </article>
    </aside>
  );
}

function CalendarLegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

function UpcomingDeparturesPanel({
  destinationOptions,
  departures,
  isLoading,
  loadError,
  selectedDestinationId,
  sortMode,
  onDestinationChange,
  onSortModeChange,
}: {
  destinationOptions: DestinationOption[];
  departures: EnrichedDeparture[];
  isLoading: boolean;
  loadError: string;
  selectedDestinationId: string;
  sortMode: SortMode;
  onDestinationChange: (destinationId: string) => void;
  onSortModeChange: (sortMode: SortMode) => void;
}) {
  const selectedDestinationLabel =
    selectedDestinationId === "all"
      ? "All Destinations"
      : destinationOptions.find(
        (destination) =>
          destination.id.trim().toUpperCase() ===
          selectedDestinationId.trim().toUpperCase()
      )?.label || selectedDestinationId;

  return (
    <article>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-bold leading-none text-secondary">
            All Departures
          </h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="shrink-0 font-sans text-[12px] font-bold text-secondary">
              Choose Destination
            </span>

            <div className="w-full sm:w-[250px]">
              <Select
                value={selectedDestinationId}
                onValueChange={(value) => {
                  if (value) {
                    onDestinationChange(value);
                  }
                }}
              >
                <SelectTrigger className="h-10 rounded-full border-[#e8cbaa] bg-[#fffaf4] text-[13px] font-bold">
                  <SelectValue>{selectedDestinationLabel}</SelectValue>
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    All Destinations
                  </SelectItem>

                  {destinationOptions.map((destination) => (
                    <SelectItem
                      key={destination.id}
                      value={destination.id}
                    >
                      {destination.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDestinationId !== "all" ? (
              <button
                type="button"
                onClick={() => onDestinationChange("all")}
                className="shrink-0 font-sans text-[12px] font-semibold text-primary transition-colors hover:text-accent hover:underline"
              >
                Clear All
              </button>
            ) : null}
          </div>
        </div>
        <div className="w-full xl:w-[210px]">
          <Select
            value={sortMode}
            onValueChange={(value) => {
              if (value) {
                onSortModeChange(value as SortMode);
              }
            }}
          >
            <SelectTrigger
              aria-label="Sort departures by price"
              className="h-10 rounded-full border-[#e8cbaa] bg-[#fffaf4] text-[13px] font-bold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-low">Price Low to High</SelectItem>
              <SelectItem value="price-high">Price High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {departures.length > 0 ? (
          departures.map((item, index) => (
            <DepartureCard
              key={getDepartureIdentifier(item.departure)}
              item={item}
              index={index}
            />
          ))
        ) : (
          <EmptyState
            message={
              isLoading
                ? "Loading live departures..."
                : loadError || "No departures match these filters."
            }
          />
        )}
      </div>
    </article>
  );
}

function DepartureCard({ index, item }: { index: number; item: EnrichedDeparture }) {
  const status = getDepartureStatus([item]);
  const capacity = getDepartureCapacity(item.departure);
  const filledSeats = getFilledSeats(item.departure);
  const seatsLeft = getDepartureSeatsLeft(item.departure);
  const filledPercent = getFilledSeatPercent(item.departure);
  const tourIncludes = [
    { icon: BedDouble, label: "Accommodation" },
    { icon: Camera, label: "Sightseeing" },
    { icon: UserRoundCheck, label: "Expert guide" },
    { icon: Bus, label: "Local transport" },
  ];

  return (
    <article className="overflow-visible rounded-[12px] border border-[#e8cbaa] bg-white p-2 transition-all hover:-translate-y-0.5 hover:border-primary/55 sm:p-2.5">
      <div className="grid gap-2.5 xl:grid-cols-[245px_minmax(0,1fr)_210px] xl:items-stretch">
        <div className="relative h-[140px] overflow-hidden rounded-[8px] bg-muted sm:h-[165px] xl:h-auto">
          <Link
            href={getTourHref(item.tour)}
            aria-label={`View ${item.tour.tourName}`}
            className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            <Image
              src={getTourImage(item.tour)}
              alt={item.tour.tourName}
              fill
              sizes="(min-width: 1280px) 260px, 100vw"
              className="object-cover transition-transform duration-700 hover:scale-[1.035]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.08)_0%,rgba(18,12,8,0.02)_48%,rgba(18,12,8,0.55)_100%)]" />
            <span className="absolute bottom-2 left-2 inline-flex h-7 max-w-[calc(100%-1rem)] items-center gap-2 rounded-full bg-[#2b241f]/80 px-2.5 font-sans text-[12px] font-medium leading-none text-white shadow-[0_10px_22px_rgba(35,23,15,0.24)] backdrop-blur-[2px]">
              <span className="grid size-[17px] shrink-0 place-items-center rounded-full bg-white text-[#2b241f]">
                <Clock3 className="size-2.5" strokeWidth={2.3} />
              </span>
              <span className="truncate">{compactDurationLabel(item.tour.durationDn)}</span>
            </span>
          </Link>

          <span
            className={cn(
              "absolute left-2 top-2 rounded-[6px] px-2 py-1 font-sans text-[11px] font-bold leading-none",
              statusBadgeClassName(status)
            )}
          >
            {getDepartureStatusLabel(status)}
          </span>
        </div>

        <div className="flex min-w-0 flex-col px-0.5">
          <h3 className="font-heading text-[20px] font-bold leading-[1.04] tracking-normal text-secondary sm:text-[23px]">
            <Link
              href={getTourHref(item.tour)}
              className="line-clamp-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            >
              {item.tour.tourName}
            </Link>
          </h3>

          <time className="mt-2 block font-sans text-[16px] font-medium leading-none text-primary">
            {formatOrdinalDate(item.departure.departureDate)}
          </time>

          <div className="mt-3 w-full max-w-none">
            <DepartureSeatProgress
              capacity={capacity}
              filled={filledSeats}
              progressPercent={filledPercent}
              seatsLeft={seatsLeft}
            />
          </div>

          

          <div className="mt-4 border-t border-[#d6d1cb] pt-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-sans text-[12px] font-medium leading-none text-secondary/62">
                Tour Includes
              </span>
              <div className="flex shrink-0 items-center gap-3 text-primary">
                {tourIncludes.map(({ icon, label }) => (
                  <DepartureIncludeIcon key={label} icon={icon} label={label} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 border-t border-[#d6d1cb] pt-3 text-right font-sans xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <div className="min-w-0 justify-self-end">
            <span className="block text-right text-[12px] font-medium leading-none text-secondary/62">
              Tour Expert
            </span>
            <div className="mt-0 flex min-w-0 items-center justify-end gap-2">
              <ExpertAvatar expert={item.expert} index={index} size="compact" />
              <TourExpertHoverPopup
                image={getExpertImage(item.expert, index)}
                name={getExpertName(item)}
                specialties={item.expert?.expertiseTags || []}
                specialty={
                  item.expert?.expertiseTags[0] ||
                  item.tour.category ||
                  item.tour.tourType ||
                  "Heritage Tours"
                }
                triggerClassName="text-right text-[14px] font-semibold leading-tight sm:text-[15px]"
              />
            </div>
          </div>

          <div>
            <span className="block text-[12px] font-medium leading-none text-secondary/62">
              Starting from
            </span>
            <strong className="mt-1.5 block truncate text-[22px] font-semibold leading-none text-secondary">
              {formatPrice(item.departure.priceAdult)}
            </strong>
          </div>

          <Link
            href={getTourHref(item.tour)}
            aria-label={`Book Now ${item.tour.tourName}`}
            className={buttonVariants({
              className:
                "mt-auto h-9 w-full justify-between gap-3 px-4 text-[13px] font-normal hover:border-primary hover:bg-white hover:text-primary hover:shadow-none",
            })}
          >
            Book Now
            <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function DepartureSeatProgress({
  capacity,
  filled,
  progressPercent,
  seatsLeft,
}: {
  capacity: number;
  filled: number;
  progressPercent: number;
  seatsLeft: number;
}) {
  return (
    <div className="w-full min-w-0 max-w-none">
      <p className="flex items-center justify-between gap-2 font-sans text-[12px] font-semibold leading-none text-secondary/60">
        <span className="font-bold text-primary">
          {seatsLeft > 0 ? `${seatsLeft} seats left` : "Seats full"}
        </span>
        <span>{filled}/{capacity}</span>
      </p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edf1]">
        <span
          className="block h-full rounded-full bg-[#2faa5d]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

function DepartureIncludeIcon({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      className="grid size-[18px] place-items-center text-secondary/72"
    >
      <Icon className="size-4" strokeWidth={2.3} />
    </span>
  );
}

function ExpertCard({ expert, index }: { expert: PublicExpert; index: number }) {
  return (
    <article className="rounded-[9px] border border-[#ead8c5] bg-white p-4  transition-all hover:-translate-y-1 hover:border-primary/40 ">
      <div className="flex items-center gap-3">
        <ExpertAvatar expert={expert} index={index} />
        <div className="min-w-0">
          <h3 className="truncate font-heading text-[16px] font-bold leading-tight text-secondary">
            {expert.fullName}
          </h3>
          <p className="mt-1 truncate font-sans text-[11px] font-semibold text-primary">
            {getExpertRole(expert)}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 min-h-[58px] font-sans text-[11px] leading-[1.7] text-secondary/74">
        {getExpertBio(expert)}
      </p>
      <div className="mt-4 flex items-center justify-center gap-4 text-primary">
        <Landmark className="size-5" strokeWidth={1.6} />
        <BookOpen className="size-5" strokeWidth={1.6} />
        <Clock3 className="size-5" strokeWidth={1.6} />
      </div>
      <Link
        href="/about"
        className="mt-4 inline-flex h-8 items-center gap-2 rounded-[6px] border border-primary bg-white px-3 font-sans text-[11px] font-bold text-primary  transition-all hover:bg-primary hover:text-white  focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        View Profile
        <ArrowRight className="size-3.5" />
      </Link>
    </article>
  );
}

function BenefitsBand() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-4 pb-8 pt-3 sm:px-6 lg:px-0">
      <div className="relative grid overflow-hidden rounded-[9px] border border-[#ead8c5] bg-white/82 px-5 py-5  sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map(({ description, icon: Icon, title }, index) => (
          <article
            key={title}
            className={cn(
              "relative flex items-center gap-3 px-3 py-3",
              index > 0 && "border-t border-[#ead8c5] sm:border-l sm:border-t-0"
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff1e5] text-primary">
              <Icon className="size-5" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              <strong className="block font-sans text-[12px] leading-tight text-secondary">
                {title}
              </strong>
              <span className="mt-1 block font-sans text-[10px] leading-[1.45] text-secondary/65">
                {description}
              </span>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExpertAvatar({
  expert,
  index,
  size = "default",
}: {
  expert?: PublicExpert;
  index: number;
  size?: "default" | "compact" | "small";
}) {
  const image = getExpertImage(expert, index);

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-[#efe2d4]",
        size === "small" && "size-9",
        size === "compact" && "size-9",
        size === "default" && "size-16"
      )}
    >
      {image ? (
        <Image
          src={image}
          alt={expert?.fullName || "Tour expert"}
          fill
          sizes={size === "small" ? "36px" : size === "compact" ? "36px" : "64px"}
          className="object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center bg-secondary font-sans text-[11px] font-bold text-white">
          {getExpertInitials(expert)}
        </span>
      )}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#ead8c5] bg-[#fffaf4] px-4 py-8 text-center font-sans text-[13px] font-semibold text-secondary/58 sm:col-span-2 lg:col-span-4">
      {message}
    </div>
  );
}
