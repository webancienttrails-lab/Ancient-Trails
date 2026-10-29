"use client";
import type { CalendarPageData } from "@/lib/travel-page-data";

import {
  getBookableDepartures,
  getNextBookableDeparture,
  getDepartureTotalSeats as getDepartureCapacity,
  getDepartureFilledSeats as getFilledSeats,
  getDepartureSeatsLeft,
} from "@/lib/tour-departures";
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
  getTourCalendarPageContent,
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicExperts,
  listPublicTourDepartures,
  listPublicTours,
  type PublicDestination,
  type PublicExpert,
  type PublicTour,
  type PublicTourCalendarFestival,
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
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const currentDateDotClassName = "bg-[#2faa5d]";
const departureDateDotClassName = "bg-primary";
const festivalDateDotClassName = "bg-primary/50";
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

function getCalendarYearOptions(
  departures: EnrichedDeparture[],
  festivals: PublicTourCalendarFestival[]
) {
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
  festivals.forEach((festival) => {
    const date = new Date(festival.date);

    if (!Number.isNaN(date.getTime())) {
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

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isUpcomingDeparture(departure: PublicTourDeparture) {
  return getDateValue(departure.departureDate) >= startOfDay(new Date()).getTime();
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
  const nextDeparture = getNextBookableDeparture(departures
    .filter((item) => matchesDepartureSelection(item, destinationId, tourId))
    .map((item) => item.departure));

  return nextDeparture?.departureDate
    ? startOfMonth(new Date(nextDeparture.departureDate))
    : startOfMonth(new Date());
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
      return "bg-brand-button-dark text-white";
    case "few":
      return "bg-[#f0a22a] text-white";
    case "almost":
      return "bg-[#d95c34] text-white";
    case "full":
      return "bg-[#bdb2a6] text-white";
  }
}

function getDepartureStatusLabel(status: DepartureStatus, isBestseller: boolean) {
  switch (status) {
    case "available":
      return isBestseller ? "Best seller" : "";
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
  const today = startOfDay(new Date()).getTime();

  return [...departures].sort((left, right) => {
    const leftDate = getDateValue(left.departure.departureDate);
    const rightDate = getDateValue(right.departure.departureDate);
    const leftIsUpcoming = leftDate >= today;
    const rightIsUpcoming = rightDate >= today;

    if (leftIsUpcoming !== rightIsUpcoming) {
      return leftIsUpcoming ? -1 : 1;
    }

    const dateDifference = leftIsUpcoming
      ? leftDate - rightDate
      : rightDate - leftDate;

    if (dateDifference !== 0) {
      return dateDifference;
    }

    const priceDifference =
      sortMode === "price-high"
        ? right.departure.priceAdult - left.departure.priceAdult
        : left.departure.priceAdult - right.departure.priceAdult;

    if (priceDifference !== 0) {
      return priceDifference;
    }

    return left.tour.tourName.localeCompare(right.tour.tourName);
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

  return getBookableDepartures(departures)
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

function groupFestivalsByDate(festivals: PublicTourCalendarFestival[]) {
  return festivals.reduce(
    (map, festival) => {
      const key = getDateKey(festival.date);

      if (!key) {
        return map;
      }

      map[key] = [...(map[key] || []), festival];

      return map;
    },
    {} as Record<string, PublicTourCalendarFestival[]>
  );
}

function getVisibleMonthFestivals(
  festivals: PublicTourCalendarFestival[],
  visibleMonth: Date
) {
  const visibleMonthKey = getDateKey(visibleMonth).slice(0, 7);

  return festivals
    .filter((festival) => getDateKey(festival.date).startsWith(visibleMonthKey))
    .sort((left, right) => {
      const dateDifference =
        getDateValue(left.date) - getDateValue(right.date);

      return dateDifference || left.title.localeCompare(right.title);
    });
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
  initialData,
  initialDestinationQuery = "",
  initialTourQuery = "",
}: {
  initialData?: CalendarPageData;
  initialDestinationQuery?: string;
  initialTourQuery?: string;
}) {
  const [enrichedDepartures, setEnrichedDepartures] =
    useState<EnrichedDeparture[]>(() => initialData ? buildEnrichedDepartures(initialData.tours, initialData.departures, initialData.destinations, initialData.experts) : []);
  const [experts, setExperts] = useState<PublicExpert[]>(initialData?.experts ?? []);
  const [festivals, setFestivals] = useState<PublicTourCalendarFestival[]>(initialData?.calendar?.festivals ?? []);
  const [selectedTourId, setSelectedTourId] = useState(() =>
    resolveTourFilter(initialTourQuery, initialData?.tours ?? [])
  );
  const [selectedDestinationId, setSelectedDestinationId] = useState(() =>
    resolveDestinationFilter(initialDestinationQuery, initialData?.destinations ?? [])
  );
  const [selectedDateKey, setSelectedDateKey] = useState(() => getTodayKey());
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("price-low");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getUpcomingDepartureMonth(enrichedDepartures, selectedDestinationId, selectedTourId)
  );
  const [isLoading, setIsLoading] = useState(!initialData);
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
          tourCalendarResponse,
        ] = await Promise.all([
          listPublicTours(),
          listPublicTourDepartures(),
          listPublicDestinations(),
          listPublicExperts(),
          getTourCalendarPageContent().catch(() => null),
        ]);
        const nextDepartures = buildEnrichedDepartures(
          toursResponse.data.tours,
          departuresResponse.data.departures,
          destinationsResponse.data.destinations,
          expertsResponse.data.experts
        );
        const sourceDepartures = nextDepartures;
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
              : []
          );
          setEnrichedDepartures(sourceDepartures);
          setFestivals(tourCalendarResponse?.data.tourCalendar.festivals || []);
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
          const fallbackDepartures: EnrichedDeparture[] = [];
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
          setExperts([]);
          setEnrichedDepartures(fallbackDepartures);
          setFestivals([]);
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

    if (!initialData) loadCalendarData();

    return () => {
      isMounted = false;
    };
  }, [initialDestinationQuery, initialTourQuery, initialData]);

  const calendarFilteredDepartures = useMemo(() => {
    return enrichedDepartures.filter((item) =>
      isUpcomingDeparture(item.departure) &&
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
  const festivalsByDate = useMemo(
    () => groupFestivalsByDate(festivals),
    [festivals]
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth]
  );
  const destinationOptions = useMemo(
    () => getDestinationOptions(enrichedDepartures),
    [enrichedDepartures]
  );
  const calendarYearOptions = useMemo(
    () => getCalendarYearOptions(enrichedDepartures, festivals),
    [enrichedDepartures, festivals]
  );
  const visibleMonthFestivals = useMemo(
    () => getVisibleMonthFestivals(festivals, visibleMonth),
    [festivals, visibleMonth]
  );
  const selectedDateDepartures = selectedDateKey
    ? sortedCalendarFilteredDepartures.filter(
      ({ departure }) =>
        getDateKey(departure.departureDate) === selectedDateKey
    )
    : [];
  const visibleDepartures =
    isDateFilterActive
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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-secondary">
      <HeaderBand />

      <section className="home-wide-frame mx-auto grid w-full items-start gap-5 px-3 pb-6 pt-6 sm:px-6 sm:pt-8 lg:grid-cols-[430px_minmax(0,1fr)] lg:px-0">
        <CalendarPanel
          calendarDays={calendarDays}
          calendarYearOptions={calendarYearOptions}
          departuresByDate={departuresByDate}
          festivalsByDate={festivalsByDate}
          festivals={visibleMonthFestivals}
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
    <section className="relative h-[100px] overflow-hidden bg-secondary lg:h-[120px]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Ancient Trails heritage landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,18,9,0.12)_0%,rgba(35,18,9,0.34)_100%)]" />
      <div className="home-wide-frame relative z-10 mx-auto w-full px-5 sm:px-8 lg:px-0">
        <Header />
        <h1 className="sr-only">Tour Calendar</h1>
      </div>
    </section>
  );
}

function CalendarPanel({
  calendarDays,
  calendarYearOptions,
  departuresByDate,
  festivalsByDate,
  festivals,
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
  festivalsByDate: Record<string, PublicTourCalendarFestival[]>;
  festivals: PublicTourCalendarFestival[];
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
      <article className="rounded-[9px] border border-[#ead8c5] bg-white/94 p-3 transition-all duration-300 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-[22px] font-bold leading-none text-secondary">
            Filter by Date
          </h2>

          {isDateFilterActive ? (
            <button
              type="button"
              onClick={onClearDate}
              className="font-sans text-[12px] font-semibold text-button-outline transition-colors hover:text-accent hover:underline"
            >
              Clear All
            </button>
          ) : null}
        </div>
        <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:mt-6 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              const previousMonth = addMonths(visibleMonth, -1);

              onMonthChange(previousMonth.getMonth(), previousMonth.getFullYear());
            }}
            className="grid size-9 place-items-center rounded-full border border-transparent text-button-outline transition-all hover:border-button-outline hover:bg-[#fff1e5] hover:text-button-outline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
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
                className="h-9 rounded-full border-[#e8cbaa] bg-[#fffaf4] px-2 text-[12px] font-bold sm:h-10 sm:text-[13px]"
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
                className="h-9 rounded-full border-[#e8cbaa] bg-[#fffaf4] px-2 text-[12px] font-bold sm:h-10 sm:text-[13px]"
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
            className="grid size-9 place-items-center rounded-full border border-transparent text-button-outline transition-all hover:border-button-outline hover:bg-[#fff1e5] hover:text-button-outline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-y-1.5 sm:mt-6 sm:gap-y-2">
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
            const dayFestivals = festivalsByDate[key] || [];
            const hasDepartures = dayDepartures.length > 0;
            const hasFestivals = dayFestivals.length > 0;
            const hasEvents = hasDepartures || hasFestivals;
            const isSelected = isDateFilterActive && selectedDateKey === key;
            const isToday = todayKey === key;

            return (
              <button
                key={key}
                type="button"
                disabled={!hasEvents}
                onClick={() => onSelectDate(key)}
                aria-pressed={isSelected}
                className={cn(
                  "relative mx-auto grid size-8 place-items-center rounded-full border border-transparent font-sans text-[12px] font-semibold leading-none transition-all disabled:cursor-default focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary sm:size-10 sm:text-[13px]",
                  day.isCurrentMonth ? "text-button-outline" : "text-button-outline",
                  hasDepartures &&
                  "bg-primary text-white text-white",
                  hasFestivals &&
                  "rounded-full  border border-button-outline text-button-outline",
                  isToday &&
                  "rounded-full bg-[#d1fce1] border border-button-outline  text-button-outline",
                  isSelected &&
                  "border-primary/45 bg-primary text-white "
                )}
              >
                <span className="leading-none">{day.date.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#f1ebe6] pt-4 font-sans text-[11px] font-semibold text-secondary/62 sm:gap-x-5">
          <CalendarLegendDot
            className={currentDateDotClassName}
            label="Current date"
          />
          <CalendarLegendDot
            className={departureDateDotClassName}
            label="Departure date"
          />
          <CalendarLegendDot
            className={festivalDateDotClassName}
            label="Festival date"
          />
        </div>
        <FestivalDatesList
          festivals={festivals}
          onSelectDate={onSelectDate}
          selectedDateKey={selectedDateKey}
        />
      </article>
    </aside>
  );
}

function FestivalDatesList({
  festivals,
  onSelectDate,
  selectedDateKey,
}: {
  festivals: PublicTourCalendarFestival[];
  onSelectDate: (key: string) => void;
  selectedDateKey: string;
}) {
  if (festivals.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-[#f1ebe6] pt-4 font-sans">
      <h3 className="text-[13px] font-bold uppercase tracking-normal text-secondary/58">
        Festivals This Month
      </h3>
      <div className="mt-3 grid gap-2">
        {festivals.map((festival) => {
          const dateKey = getDateKey(festival.date);
          const isSelected = selectedDateKey === dateKey;

          return (
            <button
              key={festival.id}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-[7px] border px-3 py-2 text-left transition-colors min-[420px]:flex-row min-[420px]:justify-between min-[420px]:gap-3",
                isSelected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-button-outline bg-[#fffaf4] text-button-outline hover:border-accent/45"
              )}
            >
              <span className="min-w-0">
                <strong className="block text-[13px] font-bold leading-tight">
                  {festival.title}
                </strong>
                {festival.description ? (
                  <span className="mt-1 block text-[12px] font-medium leading-snug text-secondary/58">
                    {festival.description}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[12px] font-bold text-brand-text min-[420px]:text-right">
                {formatOrdinalDate(festival.date)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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
                className="shrink-0 font-sans text-[12px] font-semibold text-button-outline transition-colors hover:text-accent hover:underline"
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

      <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
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
  const statusLabel = getDepartureStatusLabel(status, item.tour.isBestseller);
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
        <div className="relative h-[150px] overflow-hidden rounded-[8px] bg-muted sm:h-[165px] xl:h-auto">
          <Link prefetch={false}
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

          {statusLabel ? (
            <span
              className={cn(
                "absolute left-2 top-2 rounded-[6px] px-2 py-1 font-sans text-[11px] font-bold leading-none",
                statusBadgeClassName(status)
              )}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col px-1 sm:px-0.5">
          <h3 className="font-heading text-[19px] font-bold leading-[1.08] tracking-normal text-secondary sm:text-[23px]">
            <Link prefetch={false}
              href={getTourHref(item.tour)}
              className="line-clamp-2 transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            >
              {item.tour.tourName}
            </Link>
          </h3>

          <time className="mt-2 block font-sans text-[15px] font-medium leading-none text-brand-text sm:text-[16px]">
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
              <div className="flex shrink-0 items-center gap-3 text-brand-text">
                {tourIncludes.map(({ icon, label }) => (
                  <DepartureIncludeIcon key={label} icon={icon} label={label} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 border-t border-[#d6d1cb] pt-3 text-left font-sans xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0 xl:text-right">
          <div className="min-w-0 justify-self-start xl:justify-self-end">
            <span className="block text-left text-[12px] font-medium leading-none text-secondary/62 xl:text-right">
              Tour Expert
            </span>
            <div className="mt-1 flex min-w-0 items-center justify-start gap-2 xl:mt-0 xl:justify-end">
              <ExpertAvatar expert={item.expert} index={index} size="compact" />
              <TourExpertHoverPopup
                image={getExpertImage(item.expert, index)}
                name={getExpertName(item)}
                specialties={item.expert?.expertiseTags || []}
                specialty={
                  item.expert?.expertiseTags[0] ||
                  item.tour.category ||
                  item.tour.tourType ||
                  "Long Trails"
                }
                triggerClassName="text-left text-[14px] font-semibold leading-tight sm:text-[15px] xl:text-right"
              />
            </div>
          </div>

          <Link prefetch={false}
            href={getTourHref(item.tour)}
            aria-label={`View itinerary for ${item.tour.tourName}`}
            className="justify-self-start font-sans text-[15px] font-semibold leading-none text-brand-text underline-offset-4 transition-colors hover:underline xl:justify-self-end"
          >
            View Itinerary
          </Link>

          <Link prefetch={false}
            href={getTourHref(item.tour)}
            aria-label={`Book Now ${item.tour.tourName}`}
            className={buttonVariants({
              className:
                "mt-auto h-9 w-full justify-center gap-3 px-4 text-[13px] font-normal hover:border-primary hover:bg-white hover:text-brand-text hover:shadow-none xl:justify-between",
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
        <span className="font-bold text-brand-text">
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
          <p className="mt-1 truncate font-sans text-[11px] font-semibold text-brand-text">
            {getExpertRole(expert)}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 min-h-[58px] font-sans text-[11px] leading-[1.7] text-secondary/74">
        {getExpertBio(expert)}
      </p>
      <div className="mt-4 flex items-center justify-center gap-4 text-brand-text">
        <Landmark className="size-5" strokeWidth={1.6} />
        <BookOpen className="size-5" strokeWidth={1.6} />
        <Clock3 className="size-5" strokeWidth={1.6} />
      </div>
      <Link prefetch={false}
        href="/about"
        className="mt-4 inline-flex h-8 items-center gap-2 rounded-[6px] border border-button-outline bg-white px-3 font-sans text-[11px] font-bold text-button-outline  transition-all hover:bg-brand-button-dark hover:text-white  focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        View Profile
        <ArrowRight className="size-3.5" />
      </Link>
    </article>
  );
}

function BenefitsBand() {
  return (
    <section className="home-wide-frame mx-auto w-full px-4 pb-8 pt-3 sm:px-6 lg:px-0">
      <div className="relative grid overflow-hidden rounded-[9px] border border-[#ead8c5] bg-white/82 px-5 py-5  sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map(({ description, icon: Icon, title }, index) => (
          <article
            key={title}
            className={cn(
              "relative flex items-center gap-3 px-3 py-3",
              index > 0 && "border-t border-[#ead8c5] sm:border-l sm:border-t-0"
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff1e5] text-brand-text">
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
