"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Clock3,
  Grid2X2,
  Heart,
  Landmark,
  List as ListIcon,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { PlanTripInline } from "@/components/plan-trip-launcher";
import { TourShowcaseCard } from "@/components/tours/tour-showcase-card";
import { useToast } from "@/components/ui/toast";
import { listenForTravellerSessionChanges } from "@/lib/auth";
import {
  fallbackUpcomingTours,
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicTourDepartures,
  listPublicTours,
  type PublicDestination,
  type PublicTour,
  type PublicTourDeparture,
} from "@/lib/home-travel";
import { getTourHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  getWishlistTourIds,
  listenForWishlistChanges,
  normalizeWishlistTourId,
  toggleWishlistTour,
  type WishlistTourSnapshot,
} from "@/lib/wishlist";

type DurationFilter = "all" | "short" | "medium" | "long";
type AvailabilityFilter = "all" | "available" | "coming-soon" | "sold-out";
type SortMode = "recommended" | "earliest" | "price-low" | "price-high" | "duration";
type ViewMode = "grid" | "list";

type SelectOption = {
  label: string;
  value: string;
};

type CountOption = {
  count: number;
  label: string;
  value: string;
};

type MonthOption = SelectOption & {
  timestamp: number;
};

type TourListItem = {
  availability: AvailabilityFilter;
  departures: PublicTourDeparture[];
  destination: PublicDestination | undefined;
  durationDays: number;
  image: string;
  locationLabel: string;
  lowestPrice: number;
  nextDeparture: PublicTourDeparture | undefined;
  score: number;
  totalSeats: number;
  tour: PublicTour;
};

const pageSize = 12;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fallbackImages = [
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Egypt.webp",
  "/home assets/Vietnam.webp",
];

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: "Recommended", value: "recommended" },
  { label: "Earliest Departure", value: "earliest" },
  { label: "Price Low to High", value: "price-low" },
  { label: "Price High to Low", value: "price-high" },
  { label: "Duration", value: "duration" },
];

const durationOptions: Array<{ label: string; value: DurationFilter }> = [
  { label: "Any Duration", value: "all" },
  { label: "1 - 3 Days", value: "short" },
  { label: "4 - 7 Days", value: "medium" },
  { label: "8+ Days", value: "long" },
];

const availabilityOptions: Array<{ label: string; value: AvailabilityFilter }> = [
  { label: "Any Status", value: "all" },
  { label: "Available", value: "available" },
  { label: "Coming Soon", value: "coming-soon" },
  { label: "Sold Out", value: "sold-out" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load tours.";
}

function normalizeValue(value: string) {
  return value.trim();
}

function normalizeKey(value: string) {
  return normalizeValue(value).toLowerCase();
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean))
  );
}

function parseDurationDays(duration: string) {
  const dayMatch = duration.match(/(\d+)\s*(?:d|day)/i);
  const numericMatch = dayMatch || duration.match(/(\d+)/);
  const days = numericMatch ? Number(numericMatch[1]) : 0;

  return Number.isFinite(days) && days > 0 ? days : 0;
}

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return dateFormatter.format(date).replace(",", "");
}

function getMonthValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthTimestamp(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return 0;
  }

  return new Date(year, month - 1, 1).getTime();
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  if (!year || !month || Number.isNaN(date.getTime())) {
    return "Any Month";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatPrice(value: number) {
  if (!value || value <= 0) {
    return "Price on request";
  }

  return currencyFormatter.format(value);
}

function getPrimaryDestinationId(tour: PublicTour) {
  return getTourDestinationIds(tour)[0] || tour.destinationId;
}

function getDestinationLabel(destination: PublicDestination | undefined) {
  if (!destination) {
    return "Ancient Trails";
  }

  return (
    uniqueValues([
      destination.city,
      destination.state,
      destination.countryRegion,
    ]).join(", ") || destination.destinationName
  );
}

function getTourImage(tour: PublicTour, fallbackImage: string) {
  return getHomeMediaUrl(
    tour.thumbnailImage ||
      tour.bannerImage ||
      tour.galleryImages[0] ||
      fallbackImage
  );
}

function getLowestPrice(departures: PublicTourDeparture[]) {
  const prices = departures
    .map((departure) => departure.priceAdult)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

function getNextDeparture(departures: PublicTourDeparture[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    departures
      .filter(
        (departure) => getDateValue(departure.departureDate) >= today.getTime()
      )
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

function getAvailability(departures: PublicTourDeparture[]): AvailabilityFilter {
  if (departures.length === 0) {
    return "coming-soon";
  }

  if (departures.every((departure) => departure.seatsAvailable <= 0)) {
    return "sold-out";
  }

  return "available";
}

function getAvailabilityLabel(availability: AvailabilityFilter) {
  switch (availability) {
    case "available":
      return "Available";
    case "coming-soon":
      return "Coming Soon";
    case "sold-out":
      return "Sold Out";
    case "all":
      return "All";
  }
}

function getAvailabilityClassName(availability: AvailabilityFilter) {
  switch (availability) {
    case "available":
      return "bg-[#4f9f45] text-white";
    case "coming-soon":
      return "bg-primary text-white";
    case "sold-out":
      return "bg-secondary/55 text-white";
    case "all":
      return "bg-primary text-white";
  }
}

function getTourSearchText(item: TourListItem) {
  const { destination, tour } = item;

  return [
    tour.tourId,
    tour.tourName,
    tour.tourType,
    tour.category,
    tour.difficulty,
    tour.bestSeason,
    tour.description,
    destination?.destinationName,
    destination?.city,
    destination?.state,
    destination?.countryRegion,
    destination?.primaryHeritageFocus,
  ]
    .join(" ")
    .toLowerCase();
}

function matchesDuration(item: TourListItem, durationFilter: DurationFilter) {
  if (durationFilter === "all") {
    return true;
  }

  if (durationFilter === "short") {
    return item.durationDays > 0 && item.durationDays <= 3;
  }

  if (durationFilter === "medium") {
    return item.durationDays >= 4 && item.durationDays <= 7;
  }

  return item.durationDays >= 8;
}

function createCountOptions(
  items: TourListItem[],
  getValues: (item: TourListItem) => string[]
) {
  const counts = new Map<string, CountOption>();

  items.forEach((item) => {
    getValues(item).forEach((rawValue) => {
      const label = normalizeValue(rawValue);

      if (!label) {
        return;
      }

      const value = normalizeKey(label);
      const current = counts.get(value);

      counts.set(value, {
        count: (current?.count || 0) + 1,
        label: current?.label || label,
        value,
      });
    });
  });

  return Array.from(counts.values()).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

function createMonthOptions(items: TourListItem[]) {
  const months = new Map<string, MonthOption>();

  items.forEach((item) => {
    item.departures.forEach((departure) => {
      const value = getMonthValue(departure.departureDate);

      if (!value || months.has(value)) {
        return;
      }

      months.set(value, {
        label: formatMonthLabel(value),
        timestamp: getMonthTimestamp(value),
        value,
      });
    });
  });

  return Array.from(months.values()).sort(
    (left, right) => left.timestamp - right.timestamp
  );
}

function getMonthScopedItem(item: TourListItem, selectedMonth: string) {
  if (!selectedMonth) {
    return item;
  }

  const monthDepartures = item.departures.filter(
    (departure) => getMonthValue(departure.departureDate) === selectedMonth
  );

  if (monthDepartures.length === 0) {
    return null;
  }

  const totalSeats = monthDepartures.reduce(
    (sum, departure) => sum + Math.max(0, departure.seatsAvailable),
    0
  );

  return {
    ...item,
    availability: getAvailability(monthDepartures),
    departures: monthDepartures,
    lowestPrice: getLowestPrice(monthDepartures),
    nextDeparture: getNextDeparture(monthDepartures),
    totalSeats,
  } satisfies TourListItem;
}

function getShowingRange(currentPage: number, totalCount: number) {
  if (totalCount === 0) {
    return "Showing 0 tours";
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return `Showing ${start} - ${end} of ${totalCount} tours`;
}

function createPaginationPages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_item, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage]);

  if (currentPage > 1) {
    pages.add(currentPage - 1);
  }

  if (currentPage < totalPages) {
    pages.add(currentPage + 1);
  }

  return Array.from(pages).sort((left, right) => left - right);
}

function createFallbackDestinations(): PublicDestination[] {
  return fallbackUpcomingTours.map((tour, index) => ({
    id: `fallback-destination-${tour.destinationId}`,
    destinationId: tour.destinationId,
    destinationName: tour.title,
    destinationType: index < 3 ? "Domestic" : "International",
    countryRegion: index < 3 ? "India" : tour.title,
    state: index < 3 ? "Heritage India" : "",
    city: tour.title,
    primaryHeritageFocus: "Heritage",
    unescoSite: index === 0,
    keyLandmarks: [],
    recommendedDurationDays: parseDurationDays(tour.duration) || 6,
    shortDescription: "",
    dressCode: "",
    footwear: "",
    permits: "",
    idRequirement: "",
    restrictions: "",
    bannerImage: tour.image,
    galleryImages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function createFallbackTours(): PublicTour[] {
  return fallbackUpcomingTours.map((tour, index) => ({
    id: `fallback-tour-${tour.tourId}`,
    tourId: tour.tourId,
    tourName: tour.title,
    tourType: index % 2 === 0 ? "Heritage Tour" : "Cultural Tour",
    destinationId: tour.destinationId,
    destinationIds: [tour.destinationId],
    durationDn: tour.duration,
    category: index % 2 === 0 ? "Heritage" : "Culture",
    difficulty: index % 3 === 0 ? "Easy" : "Moderate",
    bestSeason: "Oct - Mar",
    description:
      "A carefully designed Ancient Trails journey with expert-led storytelling, cultural context and meaningful local experiences.",
    inclusions: [],
    exclusions: [],
    expertId: "",
    notes: "",
    bannerImage: tour.image,
    galleryImages: [],
    video: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function createFallbackDepartures(): PublicTourDeparture[] {
  return fallbackUpcomingTours.map((tour, index) => {
    const departureDate = new Date(tour.date);
    const days = parseDurationDays(tour.duration) || 6;
    const returnDate = new Date(departureDate);
    returnDate.setDate(departureDate.getDate() + days - 1);
    const price = [24999, 35500, 42500, 38999, 52999, 58499][index] || 34999;

    return {
      id: `fallback-departure-${tour.tourId}`,
      departureId: `${tour.tourId}-DEP-1`,
      tourId: tour.tourId,
      destinationId: tour.destinationId,
      departureDate: Number.isNaN(departureDate.getTime())
        ? null
        : departureDate.toISOString(),
      returnDate: Number.isNaN(returnDate.getTime())
        ? null
        : returnDate.toISOString(),
      seatsAvailable: [18, 12, 9, 22, 14, 8][index] || 10,
      priceAdult: price,
      priceExtraBed: price,
      priceChildWithoutExtraBed: price,
      singleOccupancy: price,
      depositType: "fixed",
      depositValue: 0,
      depositAppliesTo: "per_person",
      balanceDueDaysBefore: 0,
      earlyBirdOffer: null,
      bookingDeadline: Number.isNaN(departureDate.getTime())
        ? null
        : departureDate.toISOString(),
      status: "scheduled",
      childPricingRules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

function buildTourItems(
  tours: PublicTour[],
  departures: PublicTourDeparture[],
  destinations: PublicDestination[]
) {
  const departuresByTourId = new Map<string, PublicTourDeparture[]>();
  const destinationById = new Map(
    destinations.map((destination) => [destination.destinationId, destination])
  );

  departures.forEach((departure) => {
    const current = departuresByTourId.get(departure.tourId) || [];
    departuresByTourId.set(departure.tourId, [...current, departure]);
  });

  return tours.map((tour, index): TourListItem => {
    const tourDepartures = departuresByTourId.get(tour.tourId) || [];
    const primaryDestinationId = getPrimaryDestinationId(tour);
    const destination = destinationById.get(primaryDestinationId);
    const nextDeparture = getNextDeparture(tourDepartures);
    const lowestPrice = getLowestPrice(tourDepartures);
    const totalSeats = tourDepartures.reduce(
      (sum, departure) => sum + Math.max(0, departure.seatsAvailable),
      0
    );
    const image = getTourImage(
      tour,
      destination?.bannerImage ||
        fallbackImages[index % fallbackImages.length] ||
        fallbackImages[0]
    );

    return {
      availability: getAvailability(tourDepartures),
      departures: tourDepartures,
      destination,
      durationDays:
        parseDurationDays(tour.durationDn) ||
        destination?.recommendedDurationDays ||
        0,
      image,
      locationLabel: getDestinationLabel(destination),
      lowestPrice,
      nextDeparture,
      score:
        (nextDeparture ? 8 : 0) +
        (lowestPrice > 0 ? 4 : 0) +
        (tour.thumbnailImage || tour.bannerImage ? 3 : 0) +
        Math.min(totalSeats, 10),
      totalSeats,
      tour,
    };
  });
}

function sortItems(items: TourListItem[], sortMode: SortMode) {
  return [...items].sort((left, right) => {
    if (sortMode === "earliest") {
      return (
        (getDateValue(left.nextDeparture?.departureDate || null) || Number.MAX_SAFE_INTEGER) -
        (getDateValue(right.nextDeparture?.departureDate || null) || Number.MAX_SAFE_INTEGER)
      );
    }

    if (sortMode === "price-low") {
      return (
        (left.lowestPrice || Number.MAX_SAFE_INTEGER) -
        (right.lowestPrice || Number.MAX_SAFE_INTEGER)
      );
    }

    if (sortMode === "price-high") {
      return right.lowestPrice - left.lowestPrice;
    }

    if (sortMode === "duration") {
      return left.durationDays - right.durationDays;
    }

    return right.score - left.score;
  });
}

function toggleSelection(selection: string[], value: string) {
  return selection.includes(value)
    ? selection.filter((item) => item !== value)
    : [...selection, value];
}

function createWishlistSnapshot(item: TourListItem): WishlistTourSnapshot {
  return {
    categoryLabel: item.tour.category || item.tour.tourType || "Heritage",
    description:
      item.tour.description ||
      "An expert-led Ancient Trails journey through heritage, culture and local stories.",
    destinationLabel: item.locationLabel,
    difficultyLabel: item.tour.difficulty || "Moderate",
    durationLabel: item.tour.durationDn || `${item.durationDays} Days`,
    href: getTourHref(item.tour),
    image: item.image,
    nextDepartureLabel: formatDate(item.nextDeparture?.departureDate || null),
    priceLabel: formatPrice(item.lowestPrice),
    title: item.tour.tourName,
    tourId: normalizeWishlistTourId(item.tour.tourId),
  };
}

export function ToursListingPage({
  initialAdultCount = 2,
  initialChildCount = 0,
  initialMonthValue = "",
  initialSearchQuery = "",
}: {
  initialAdultCount?: number;
  initialChildCount?: number;
  initialMonthValue?: string;
  initialSearchQuery?: string;
}) {
  const toast = useToast();
  const fallbackTours = useMemo(() => createFallbackTours(), []);
  const fallbackDepartures = useMemo(() => createFallbackDepartures(), []);
  const fallbackDestinations = useMemo(() => createFallbackDestinations(), []);
  const [tours, setTours] = useState<PublicTour[]>(fallbackTours);
  const [departures, setDepartures] =
    useState<PublicTourDeparture[]>(fallbackDepartures);
  const [destinations, setDestinations] =
    useState<PublicDestination[]>(fallbackDestinations);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedTypeValues, setSelectedTypeValues] = useState<string[]>([]);
  const [selectedDestinationValues, setSelectedDestinationValues] = useState<
    string[]
  >([]);
  const [selectedMonth, setSelectedMonth] = useState(initialMonthValue);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const [adultCount, setAdultCount] = useState(initialAdultCount);
  const [childCount, setChildCount] = useState(initialChildCount);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [priceLimit, setPriceLimit] = useState(0);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [wishlistTourIds, setWishlistTourIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadTours() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [toursResponse, departuresResponse, destinationsResponse] =
          await Promise.all([
            listPublicTours(),
            listPublicTourDepartures(),
            listPublicDestinations(),
          ]);

        if (isMounted) {
          if (toursResponse.data.tours.length > 0) {
            setTours(toursResponse.data.tours);
          }

          if (departuresResponse.data.departures.length > 0) {
            setDepartures(departuresResponse.data.departures);
          }

          if (destinationsResponse.data.destinations.length > 0) {
            setDestinations(destinationsResponse.data.destinations);
          }
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTours();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const syncWishlist = () => {
      setWishlistTourIds(getWishlistTourIds());
    };

    syncWishlist();

    const stopWishlistListener = listenForWishlistChanges(syncWishlist);
    const stopSessionListener =
      listenForTravellerSessionChanges(syncWishlist);

    return () => {
      stopWishlistListener();
      stopSessionListener();
    };
  }, []);

  const allItems = useMemo(
    () => buildTourItems(tours, departures, destinations),
    [departures, destinations, tours]
  );

  const maxPrice = useMemo(() => {
    const prices = allItems
      .map((item) => item.lowestPrice)
      .filter((price) => price > 0);

    return prices.length > 0 ? Math.max(...prices) : 0;
  }, [allItems]);
  const effectivePriceLimit = priceLimit || maxPrice;
  const travellerCount = adultCount + childCount;

  const typeOptions = useMemo(
    () =>
      createCountOptions(allItems, (item) =>
        uniqueValues([item.tour.category, item.tour.tourType])
      ),
    [allItems]
  );

  const destinationOptions = useMemo(
    () =>
      createCountOptions(allItems, (item) => [
        item.destination?.destinationName ||
          item.destination?.city ||
          getPrimaryDestinationId(item.tour),
      ]),
    [allItems]
  );

  const monthOptions = useMemo(() => createMonthOptions(allItems), [allItems]);
  const selectedMonthIsAvailable =
    !selectedMonth ||
    monthOptions.some((monthOption) => monthOption.value === selectedMonth);
  const effectiveSelectedMonth = selectedMonthIsAvailable ? selectedMonth : "";

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sortItems(
      allItems.flatMap((item) => {
        const scopedItem = getMonthScopedItem(item, effectiveSelectedMonth);

        if (!scopedItem) {
          return [];
        }

        const typeValues = uniqueValues([
          scopedItem.tour.category,
          scopedItem.tour.tourType,
        ]).map(normalizeKey);
        const destinationValue = normalizeKey(
          scopedItem.destination?.destinationName ||
            scopedItem.destination?.city ||
            getPrimaryDestinationId(scopedItem.tour)
        );
        const matchesSearch =
          !query || getTourSearchText(scopedItem).includes(query);
        const matchesType =
          selectedTypeValues.length === 0 ||
          selectedTypeValues.some((value) => typeValues.includes(value));
        const matchesDestination =
          selectedDestinationValues.length === 0 ||
          selectedDestinationValues.includes(destinationValue);
        const matchesAvailability =
          availabilityFilter === "all" ||
          scopedItem.availability === availabilityFilter;
        const matchesTravellers =
          scopedItem.availability !== "available" ||
          scopedItem.totalSeats >= travellerCount;
        const matchesPrice =
          !effectivePriceLimit ||
          !scopedItem.lowestPrice ||
          scopedItem.lowestPrice <= effectivePriceLimit;

        return matchesSearch &&
          matchesType &&
          matchesDestination &&
          matchesDuration(scopedItem, durationFilter) &&
          matchesAvailability &&
          matchesTravellers &&
          matchesPrice
          ? [scopedItem]
          : [];
      }),
      sortMode
    );
  }, [
    allItems,
    availabilityFilter,
    durationFilter,
    effectivePriceLimit,
    effectiveSelectedMonth,
    searchQuery,
    selectedDestinationValues,
    selectedTypeValues,
    sortMode,
    travellerCount,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const visibleItems = filteredItems.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );
  const wishlistedTourIds = useMemo(
    () => new Set(wishlistTourIds),
    [wishlistTourIds]
  );
  const activeFilterCount =
    selectedTypeValues.length +
    selectedDestinationValues.length +
    (effectiveSelectedMonth ? 1 : 0) +
    (durationFilter !== "all" ? 1 : 0) +
    (availabilityFilter !== "all" ? 1 : 0) +
    (priceLimit > 0 && maxPrice > 0 && priceLimit < maxPrice ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (adultCount !== 2 || childCount !== 0 ? 1 : 0);

  function clearFilters() {
    setSearchQuery("");
    setSelectedTypeValues([]);
    setSelectedDestinationValues([]);
    setSelectedMonth("");
    setDurationFilter("all");
    setAvailabilityFilter("all");
    setAdultCount(2);
    setChildCount(0);
    setPriceLimit(0);
  }

  function handleWishlistToggle(item: TourListItem) {
    const { isWishlisted, items } = toggleWishlistTour(
      createWishlistSnapshot(item)
    );

    setWishlistTourIds(items.map((wishlistItem) => wishlistItem.tourId));

    if (isWishlisted) {
      toast.success("Added to wishlist", `${item.tour.tourName} is saved.`);
      return;
    }

    toast.info("Removed from wishlist", `${item.tour.tourName} was removed.`);
  }

  return (
    <main className="min-h-screen bg-background text-secondary">
      <ToursHero
        initialAdultCount={adultCount}
        initialChildCount={childCount}
        initialMonthValue={effectiveSelectedMonth}
        initialSearchQuery={searchQuery}
      />

      <section
        id="tour-results"
        className={cn(
          "mx-auto grid w-full max-w-[1300px] items-start gap-6 px-5 pb-14 pt-8 transition-[grid-template-columns] duration-300 sm:px-8 lg:px-0",
          isFilterCollapsed
            ? "lg:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[84px_minmax(0,1fr)]"
            : "lg:grid-cols-[282px_minmax(0,1fr)]"
        )}
      >
        <TourSidebar
          activeFilterCount={activeFilterCount}
          availabilityFilter={availabilityFilter}
          destinationOptions={destinationOptions}
          durationFilter={durationFilter}
          isCollapsed={isFilterCollapsed}
          maxPrice={maxPrice}
          priceLimit={priceLimit}
          selectedDestinationValues={selectedDestinationValues}
          selectedTypeValues={selectedTypeValues}
          typeOptions={typeOptions}
          onAvailabilityChange={setAvailabilityFilter}
          onClearFilters={clearFilters}
          onCollapsedChange={setIsFilterCollapsed}
          onDestinationToggle={(value) =>
            setSelectedDestinationValues((current) =>
              toggleSelection(current, value)
            )
          }
          onDurationChange={setDurationFilter}
          onPriceLimitChange={setPriceLimit}
          onTypeToggle={(value) =>
            setSelectedTypeValues((current) => toggleSelection(current, value))
          }
        />

        <section className="min-w-0">
          <ResultsHeader
            count={filteredItems.length}
            currentPage={activePage}
            isLoading={isLoading}
            loadError={loadError}
            sortMode={sortMode}
            viewMode={viewMode}
            onSortModeChange={setSortMode}
            onViewModeChange={setViewMode}
          />

          <TourResults
            favoriteTourIds={wishlistedTourIds}
            isLoading={isLoading}
            items={visibleItems}
            viewMode={viewMode}
            onWishlistToggle={handleWishlistToggle}
          />

          {!isLoading && filteredItems.length === 0 ? (
            <EmptyState
              message={
                loadError ||
                "No tours match these filters. Try changing destination, month or price."
              }
            />
          ) : null}

          {!isLoading && filteredItems.length > pageSize ? (
            <Pagination
              currentPage={activePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function ToursHero({
  initialAdultCount,
  initialChildCount,
  initialMonthValue,
  initialSearchQuery,
}: {
  initialAdultCount: number;
  initialChildCount: number;
  initialMonthValue: string;
  initialSearchQuery: string;
}) {
  return (
    <section className="relative overflow-visible bg-[#fff2e5]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Heritage tour landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,248,240,0.98)_0%,rgba(255,248,240,0.86)_38%,rgba(255,248,240,0.32)_72%,rgba(255,248,240,0.12)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,248,240,0)_0%,#fff8f0_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[520px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-8 lg:px-0">
        <Header />

        <div className="grid flex-1 items-center gap-8 pb-6 pt-8 md:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.55fr)]">
          <div className="max-w-[620px]">
            <nav className="flex flex-wrap items-center gap-2 font-sans text-[12px] font-bold text-secondary/68">
              <Link href="/" className="transition-colors hover:text-primary">
                Home
              </Link>
              <ArrowRight className="size-3.5 text-secondary/40" />
              <span>Tours</span>
            </nav>
            <p className="mt-7 font-sans text-[11px] font-bold uppercase text-primary">
              Explore curated journeys
            </p>
            <h1 className="mt-3 font-heading text-[42px] font-bold leading-none text-secondary sm:text-[58px]">
              Explore Our Tours
            </h1>
            <p className="mt-5 max-w-[460px] font-sans text-[14px] font-medium leading-[1.75] text-secondary/78 sm:text-description">
              Handpicked journeys to iconic heritage destinations across India
              and beyond.
            </p>
          </div>
        </div>

        <PlanTripInline
          className="mb-8"
          initialAdultCount={initialAdultCount}
          initialChildCount={initialChildCount}
          initialMonthValue={initialMonthValue}
          initialSearchQuery={initialSearchQuery}
        />
      </div>
    </section>
  );
}

function TourSidebar({
  activeFilterCount,
  availabilityFilter,
  destinationOptions,
  durationFilter,
  isCollapsed,
  maxPrice,
  onAvailabilityChange,
  onClearFilters,
  onCollapsedChange,
  onDestinationToggle,
  onDurationChange,
  onPriceLimitChange,
  onTypeToggle,
  priceLimit,
  selectedDestinationValues,
  selectedTypeValues,
  typeOptions,
}: {
  activeFilterCount: number;
  availabilityFilter: AvailabilityFilter;
  destinationOptions: CountOption[];
  durationFilter: DurationFilter;
  isCollapsed: boolean;
  maxPrice: number;
  priceLimit: number;
  selectedDestinationValues: string[];
  selectedTypeValues: string[];
  typeOptions: CountOption[];
  onAvailabilityChange: (value: AvailabilityFilter) => void;
  onClearFilters: () => void;
  onCollapsedChange: (value: boolean) => void;
  onDestinationToggle: (value: string) => void;
  onDurationChange: (value: DurationFilter) => void;
  onPriceLimitChange: (value: number) => void;
  onTypeToggle: (value: string) => void;
}) {
  const isPriceFiltered = priceLimit > 0 && maxPrice > 0 && priceLimit < maxPrice;

  if (isCollapsed) {
    return (
      <aside className="lg:sticky lg:top-5 lg:z-20 lg:self-start">
        <div className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ead8c5] bg-white p-2 shadow-[0_12px_32px_rgba(67,43,27,0.07)] lg:flex-col">
          <button
            type="button"
            aria-label="Maximize tour filters"
            onClick={() => onCollapsedChange(false)}
            className="grid size-10 place-items-center rounded-[7px] border border-primary/25 bg-primary/8 text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.9} />
          </button>
          <CollapsedFilterButton
            active={selectedTypeValues.length > 0}
            icon={Sparkles}
            label="Open tour type filters"
            onClick={() => onCollapsedChange(false)}
          />
          <CollapsedFilterButton
            active={durationFilter !== "all"}
            icon={Clock3}
            label="Open duration filters"
            onClick={() => onCollapsedChange(false)}
          />
          <CollapsedFilterButton
            active={isPriceFiltered}
            icon={Landmark}
            label="Open price filters"
            onClick={() => onCollapsedChange(false)}
          />
          <CollapsedFilterButton
            active={selectedDestinationValues.length > 0}
            icon={MapPin}
            label="Open destination filters"
            onClick={() => onCollapsedChange(false)}
          />
          <CollapsedFilterButton
            active={availabilityFilter !== "all"}
            icon={BadgeCheck}
            label="Open status filters"
            onClick={() => onCollapsedChange(false)}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
      <div className="rounded-[8px] border border-[#ead8c5] bg-white p-4 shadow-[0_12px_32px_rgba(67,43,27,0.07)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 font-sans text-[14px] font-bold text-secondary">
            <SlidersHorizontal className="size-4 text-primary" />
            Filters
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearFilters}
              disabled={activeFilterCount === 0}
              className="font-sans text-[11px] font-bold text-primary transition-colors hover:text-accent disabled:pointer-events-none disabled:text-secondary/35"
            >
              Clear All
            </button>
            <button
              type="button"
              aria-controls="tour-filter-panel"
              aria-expanded={!isCollapsed}
              onClick={() => onCollapsedChange(true)}
              className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-primary/25 bg-primary/5 px-2 font-sans text-[11px] font-bold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              Minimize
              <ChevronDown
                className="size-3.5 rotate-90 transition-transform"
                strokeWidth={2}
              />
            </button>
          </div>
        </div>

        <div id="tour-filter-panel" className="mt-5 space-y-6">
          <CheckboxGroup
            icon={Sparkles}
            options={typeOptions}
            selectedValues={selectedTypeValues}
            title="Tour Type"
            onToggle={onTypeToggle}
          />

          <RadioGroup
            icon={Clock3}
            options={durationOptions}
            title="Duration"
            value={durationFilter}
            onChange={(value) => onDurationChange(value as DurationFilter)}
          />

          <PriceRange
            maxPrice={maxPrice}
            priceLimit={priceLimit}
            onChange={onPriceLimitChange}
          />

          <CheckboxGroup
            icon={MapPin}
            options={destinationOptions}
            selectedValues={selectedDestinationValues}
            title="Popular Destinations"
            onToggle={onDestinationToggle}
          />

          <RadioGroup
            icon={BadgeCheck}
            options={availabilityOptions}
            title="Status"
            value={availabilityFilter}
            onChange={(value) => onAvailabilityChange(value as AvailabilityFilter)}
          />
        </div>
      </div>

      <article className="rounded-[8px] border border-[#ead8c5] bg-white p-4 shadow-[0_12px_32px_rgba(67,43,27,0.06)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" strokeWidth={1.8} />
          </span>
          <span>
            <strong className="block font-sans text-[13px] text-secondary">
              Best Price Guarantee
            </strong>
            <span className="mt-1 block font-sans text-[11px] leading-[1.55] text-secondary/64">
              Tour prices are shown from live departure records whenever
              available.
            </span>
          </span>
        </div>
      </article>
    </aside>
  );
}

function CollapsedFilterButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative grid size-10 place-items-center rounded-[7px] text-secondary transition-colors hover:bg-primary/8 hover:text-primary"
    >
      <Icon className="size-4" strokeWidth={1.8} />
      {active ? (
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
      ) : null}
    </button>
  );
}

function CheckboxGroup({
  icon: Icon,
  onToggle,
  options,
  selectedValues,
  title,
}: {
  icon: LucideIcon;
  options: CountOption[];
  selectedValues: string[];
  title: string;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-sans text-[12px] font-bold text-secondary">
        <Icon className="size-4 text-primary" strokeWidth={1.8} />
        {title}
      </h3>
      <div className="mt-3 space-y-1.5">
        {options.slice(0, 8).map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-[6px] px-1 py-1 font-sans text-[11px] font-semibold text-secondary/72 transition-colors hover:text-primary"
          >
            <input
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
              type="checkbox"
              className="size-4 rounded border-[#d7b89a] accent-primary"
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="text-secondary/42">{option.count}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function RadioGroup({
  icon: Icon,
  onChange,
  options,
  title,
  value,
}: {
  icon: LucideIcon;
  options: Array<{ label: string; value: string }>;
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 font-sans text-[12px] font-bold text-secondary">
        <Icon className="size-4 text-primary" strokeWidth={1.8} />
        {title}
      </h3>
      <div className="mt-3 space-y-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-[6px] px-1 py-1 font-sans text-[11px] font-semibold text-secondary/72 transition-colors hover:text-primary"
          >
            <input
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              type="radio"
              className="size-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function PriceRange({
  maxPrice,
  onChange,
  priceLimit,
}: {
  maxPrice: number;
  priceLimit: number;
  onChange: (value: number) => void;
}) {
  if (maxPrice <= 0) {
    return null;
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-sans text-[12px] font-bold text-secondary">
        <Landmark className="size-4 text-primary" strokeWidth={1.8} />
        Price Range
      </h3>
      <input
        type="range"
        min={0}
        max={maxPrice}
        step={500}
        value={priceLimit || maxPrice}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className="mt-4 w-full accent-primary"
      />
      <div className="mt-2 flex items-center justify-between font-sans text-[10px] font-bold text-secondary/56">
        <span>{currencyFormatter.format(0)}</span>
        <span>{formatPrice(priceLimit || maxPrice)}</span>
      </div>
    </section>
  );
}

function ResultsHeader({
  count,
  currentPage,
  isLoading,
  loadError,
  onSortModeChange,
  onViewModeChange,
  sortMode,
  viewMode,
}: {
  count: number;
  currentPage: number;
  isLoading: boolean;
  loadError: string;
  sortMode: SortMode;
  viewMode: ViewMode;
  onSortModeChange: (value: SortMode) => void;
  onViewModeChange: (value: ViewMode) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-sans text-[11px] font-bold uppercase text-primary">
          {loadError ? "Fallback tours" : "Tour results"}
        </p>
        <h2 className="mt-1 font-heading text-[30px] font-bold leading-tight text-secondary sm:text-[36px]">
          Available Tours
        </h2>
        <p className="mt-1 font-sans text-[12px] font-semibold text-secondary/56">
          {isLoading ? "Loading live tours..." : getShowingRange(currentPage, count)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 items-center gap-3 rounded-[7px] border border-[#ead8c5] bg-white px-3 font-sans text-[11px] font-bold text-secondary shadow-[0_8px_20px_rgba(67,43,27,0.05)]">
          <span className="whitespace-nowrap text-secondary/52">Sort by:</span>
          <select
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as SortMode)}
            className="min-w-0 bg-transparent font-sans text-[11px] font-bold text-secondary outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none size-4 text-primary" />
        </label>

        <div className="flex overflow-hidden rounded-[7px] border border-[#ead8c5] bg-white shadow-[0_8px_20px_rgba(67,43,27,0.05)]">
          <ViewButton
            active={viewMode === "grid"}
            label="Grid view"
            onClick={() => onViewModeChange("grid")}
          >
            <Grid2X2 className="size-4" />
          </ViewButton>
          <ViewButton
            active={viewMode === "list"}
            label="List view"
            onClick={() => onViewModeChange("list")}
          >
            <ListIcon className="size-4" />
          </ViewButton>
        </div>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-10 place-items-center text-secondary transition-colors hover:text-primary",
        active && "bg-primary text-white hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function TourResults({
  favoriteTourIds,
  isLoading,
  items,
  onWishlistToggle,
  viewMode,
}: {
  favoriteTourIds: Set<string>;
  isLoading: boolean;
  items: TourListItem[];
  onWishlistToggle: (item: TourListItem) => void;
  viewMode: ViewMode;
}) {
  if (isLoading) {
    return (
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_item, index) => (
          <div
            key={index}
            className="h-[340px] animate-pulse rounded-[8px] bg-[#ead8c5]/65"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  if (viewMode === "list") {
    return (
      <div className="mt-5 grid gap-4">
        {items.map((item) => (
          <TourListRow
            key={item.tour.id || item.tour.tourId}
            isWishlisted={favoriteTourIds.has(
              normalizeWishlistTourId(item.tour.tourId)
            )}
            item={item}
            onWishlistToggle={onWishlistToggle}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <TourCard
          key={item.tour.id || item.tour.tourId}
          isWishlisted={favoriteTourIds.has(
            normalizeWishlistTourId(item.tour.tourId)
          )}
          item={item}
          onWishlistToggle={onWishlistToggle}
        />
      ))}
    </div>
  );
}

function TourCard({
  isWishlisted,
  item,
  onWishlistToggle,
}: {
  isWishlisted: boolean;
  item: TourListItem;
  onWishlistToggle: (item: TourListItem) => void;
}) {
  return (
    <TourShowcaseCard
      durationLabel={item.tour.durationDn || `${item.durationDays} Days`}
      favoriteLabel={
        isWishlisted
          ? `Remove ${item.tour.tourName} from wishlist`
          : `Save ${item.tour.tourName}`
      }
      href={getTourHref(item.tour)}
      image={item.image}
      imageSizes="(min-width: 1280px) 300px, (min-width: 640px) 50vw, 100vw"
      isFavorite={isWishlisted}
      nextDepartureLabel={formatDate(item.nextDeparture?.departureDate || null)}
      onFavoriteToggle={() => onWishlistToggle(item)}
      priceLabel={formatPrice(item.lowestPrice)}
      title={item.tour.tourName}
    />
  );
}

function TourListRow({
  isWishlisted,
  item,
  onWishlistToggle,
}: {
  isWishlisted: boolean;
  item: TourListItem;
  onWishlistToggle: (item: TourListItem) => void;
}) {
  return (
    <article className="grid gap-4 overflow-hidden rounded-[8px] border border-[#ead8c5] bg-white p-3 shadow-[0_14px_32px_rgba(67,43,27,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/45 sm:grid-cols-[220px_minmax(0,1fr)_170px] sm:items-center">
      <div className="relative h-[170px] overflow-hidden rounded-[7px] bg-muted sm:h-[150px]">
        <Image
          src={item.image}
          alt={item.tour.tourName}
          fill
          sizes="220px"
          className="object-cover"
        />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-[5px] px-2 py-1 font-sans text-[10px] font-bold",
            getAvailabilityClassName(item.availability)
          )}
        >
          {getAvailabilityLabel(item.availability)}
        </span>
        <button
          type="button"
          aria-label={
            isWishlisted
              ? `Remove ${item.tour.tourName} from wishlist`
              : `Save ${item.tour.tourName}`
          }
          aria-pressed={isWishlisted}
          onClick={() => onWishlistToggle(item)}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-white/35 bg-secondary/55 text-white shadow-[0_10px_22px_rgba(35,23,15,0.2)] backdrop-blur transition-colors hover:bg-primary"
        >
          <Heart
            className={cn("size-[18px]", isWishlisted && "fill-current")}
            strokeWidth={isWishlisted ? 0 : 1.9}
          />
        </button>
      </div>

      <div className="min-w-0">
        <h3 className="font-heading text-[23px] font-bold leading-tight text-secondary">
          {item.tour.tourName}
        </h3>
        <p className="mt-2 line-clamp-2 font-sans text-[13px] leading-[1.6] text-secondary/72">
          {item.tour.description ||
            "An expert-led Ancient Trails journey through heritage, culture and local stories."}
        </p>
        <TourMeta item={item} compact />
      </div>

      <div className="grid gap-3 sm:justify-items-end">
        <span className="font-sans text-[11px] font-semibold text-secondary/58 sm:text-right">
          from
          <strong className="mt-1 block font-heading text-[23px] leading-none text-secondary">
            {formatPrice(item.lowestPrice)}
          </strong>
          per person
        </span>
        <Link
          href={getTourHref(item.tour)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 font-sans text-[13px] font-bold text-white transition-colors hover:bg-white hover:text-primary"
        >
          View Details
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function TourMeta({
  compact = false,
  item,
}: {
  compact?: boolean;
  item: TourListItem;
}) {
  const metaItems = [
    {
      icon: CalendarDays,
      key: "departure",
      label: formatDate(item.nextDeparture?.departureDate || null),
    },
    {
      icon: Clock3,
      key: "duration",
      label: item.tour.durationDn || `${item.durationDays} Days`,
    },
    {
      icon: MapPin,
      key: "location",
      label: item.locationLabel,
    },
    {
      icon: Users,
      key: "seats",
      label:
        item.totalSeats > 0
          ? `${item.totalSeats} seats available`
          : getAvailabilityLabel(item.availability),
    },
  ];

  return (
    <div
      className={cn(
        "mt-3 grid gap-2 font-sans text-[11px] font-semibold text-secondary/62",
        compact ? "sm:grid-cols-2" : "grid-cols-2"
      )}
    >
      {metaItems.map(({ icon: Icon, key, label }) => (
        <span key={key} className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-primary" strokeWidth={1.8} />
          <span className="truncate">{label}</span>
        </span>
      ))}
      <span className="flex min-w-0 items-center gap-2">
        <Star className="size-3.5 shrink-0 fill-primary text-primary" strokeWidth={0} />
        <span className="truncate">{item.tour.difficulty || "Moderate"}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <Landmark className="size-3.5 shrink-0 text-primary" strokeWidth={1.8} />
        <span className="truncate">
          {item.tour.category || item.tour.tourType || "Heritage"}
        </span>
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-[8px] border border-dashed border-[#ead8c5] bg-white/72 px-5 py-10 text-center">
      <h3 className="font-heading text-[24px] font-bold text-secondary">
        No tours found
      </h3>
      <p className="mx-auto mt-2 max-w-[420px] font-sans text-[13px] leading-[1.65] text-secondary/62">
        {message}
      </p>
    </div>
  );
}

function Pagination({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = createPaginationPages(currentPage, totalPages);

  return (
    <nav aria-label="Tour pagination" className="mt-8 flex items-center justify-center gap-2">
      {currentPage > 1 ? (
        <PaginationButton
          label="Previous tours page"
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ArrowRight className="size-3.5 rotate-180" />
        </PaginationButton>
      ) : null}

      {pages.map((page, index) => {
        const previousPage = pages[index - 1];
        const showGap = previousPage !== undefined && page - previousPage > 1;

        return (
          <span key={page} className="flex items-center gap-2">
            {showGap ? (
              <span className="font-sans text-[11px] font-bold text-secondary/42">
                ...
              </span>
            ) : null}
            <PaginationButton
              active={currentPage === page}
              label={`Go to tours page ${page}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </PaginationButton>
          </span>
        );
      })}

      {currentPage < totalPages ? (
        <PaginationButton
          label="Next tours page"
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ArrowRight className="size-3.5" />
        </PaginationButton>
      ) : null}
    </nav>
  );
}

function PaginationButton({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-full border border-[#ead8c5] bg-white font-sans text-[11px] font-bold text-secondary transition-colors hover:border-primary hover:text-primary",
        active && "border-primary bg-primary text-white hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
