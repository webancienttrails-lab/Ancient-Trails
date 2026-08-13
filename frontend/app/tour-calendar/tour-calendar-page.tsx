"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grid2X2,
  Landmark,
  MapPin,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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

type SortMode = "earliest" | "price" | "seats";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function getMonthKey(value: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month) {
    return new Date();
  }

  return new Date(year, month - 1, 1);
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

function formatFullDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return fullDateFormatter.format(date).replace(",", "");
}

function formatDateRange(departure: PublicTourDeparture) {
  if (!departure.departureDate || !departure.returnDate) {
    return "Coming Soon";
  }

  const departureDate = new Date(departure.departureDate);
  const returnDate = new Date(departure.returnDate);

  if (
    Number.isNaN(departureDate.getTime()) ||
    Number.isNaN(returnDate.getTime())
  ) {
    return formatFullDate(departure.departureDate);
  }

  const start = dayMonthFormatter.format(departureDate).replace(",", "");
  const end = dayMonthFormatter.format(returnDate).replace(",", "");

  if (departureDate.getFullYear() !== returnDate.getFullYear()) {
    return `${start} ${departureDate.getFullYear()} - ${end} ${returnDate.getFullYear()}`;
  }

  return `${start} - ${end} ${returnDate.getFullYear()}`;
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

function getDepartureIdentifier(departure: PublicTourDeparture) {
  return departure.departureId || departure.id;
}

function getDepartureStatus(departures: EnrichedDeparture[]): DepartureStatus {
  if (departures.length === 0) {
    return "available";
  }

  if (departures.every(({ departure }) => departure.seatsAvailable <= 0)) {
    return "full";
  }

  if (departures.some(({ departure }) => departure.seatsAvailable <= 3)) {
    return "almost";
  }

  if (departures.some(({ departure }) => departure.seatsAvailable <= 8)) {
    return "few";
  }

  return "available";
}

function statusDotClassName(status: DepartureStatus) {
  switch (status) {
    case "available":
      return "bg-[#4f9f45]";
    case "few":
      return "bg-[#e3b14d]";
    case "almost":
      return "bg-[#d95c34]";
    case "full":
      return "bg-[#bdb2a6]";
  }
}

function statusBadgeClassName(status: DepartureStatus) {
  switch (status) {
    case "available":
      return "bg-[#48a94a] text-white";
    case "few":
      return "bg-[#f0a22a] text-white";
    case "almost":
      return "bg-[#d95c34] text-white";
    case "full":
      return "bg-[#bdb2a6] text-white";
  }
}

function getSeatLabel(seatsAvailable: number) {
  return seatsAvailable > 0 ? `${seatsAvailable} Seats Left` : "Sold Out";
}

function getTourImage(tour?: PublicTour) {
  return getHomeMediaUrl(
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

function getLocationLabel(item?: EnrichedDeparture) {
  if (!item) {
    return "India";
  }

  const { destination, tour } = item;
  const parts = [
    destination?.city,
    destination?.state,
    destination?.countryRegion,
  ]
    .filter(Boolean)
    .filter((part, index, source) => source.indexOf(part) === index);

  return (
    parts.join(", ") ||
    getTourDestinationIds(tour)[0] ||
    tour.destinationId ||
    "Ancient Trails"
  );
}

function getDestinationName(item?: EnrichedDeparture) {
  return (
    item?.destination?.destinationName ||
    (item?.tour ? getTourDestinationIds(item.tour)[0] : "") ||
    item?.tour.destinationId ||
    "India"
  );
}

function getDurationBadge(tour: PublicTour) {
  return tour.durationDn.replace(/\s+/g, "") || "6D/5N";
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
      destinationId: seed.destinationId,
      destinationIds: [seed.destinationId],
      durationDn: seed.durationDn,
      category: seed.category,
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

function getPreferredMonth(departures: EnrichedDeparture[]) {
  const today = startOfDay(new Date()).getTime();
  const upcoming = departures.find(
    ({ departure }) => getDateValue(departure.departureDate) >= today
  );
  const sourceDate = upcoming?.departure.departureDate
    ? new Date(upcoming.departure.departureDate)
    : departures[0]?.departure.departureDate
      ? new Date(departures[0].departure.departureDate)
      : new Date();

  return startOfMonth(sourceDate);
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

export function TourCalendarPage() {
  const fallbackData = useMemo(() => createFallbackData(), []);
  const fallbackExperts = useMemo(() => createFallbackExperts(), []);
  const [enrichedDepartures, setEnrichedDepartures] =
    useState<EnrichedDeparture[]>(fallbackData);
  const [tours, setTours] = useState<PublicTour[]>(() =>
    fallbackData.map(({ tour }) => tour)
  );
  const [destinations, setDestinations] = useState<PublicDestination[]>(() =>
    fallbackData
      .map(({ destination }) => destination)
      .filter((destination): destination is PublicDestination =>
        Boolean(destination)
      )
  );
  const [experts, setExperts] = useState<PublicExpert[]>(fallbackExperts);
  const [selectedTourId, setSelectedTourId] = useState("all");
  const [selectedDestinationId, setSelectedDestinationId] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("earliest");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getPreferredMonth(fallbackData)
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

        if (isMounted) {
          setTours(
            toursResponse.data.tours.length > 0
              ? toursResponse.data.tours
              : sourceDepartures.map(({ tour }) => tour)
          );
          setDestinations(
            destinationsResponse.data.destinations.length > 0
              ? destinationsResponse.data.destinations
              : sourceDepartures
                  .map(({ destination }) => destination)
                  .filter((destination): destination is PublicDestination =>
                    Boolean(destination)
                  )
          );
          setExperts(
            expertsResponse.data.experts.length > 0
              ? expertsResponse.data.experts
              : createFallbackExperts()
          );
          setEnrichedDepartures(sourceDepartures);
          setVisibleMonth(getPreferredMonth(sourceDepartures));
        }
      } catch {
        if (isMounted) {
          const fallbackDepartures = createFallbackData();

          setLoadError("Live tour calendar is temporarily unavailable.");
          setTours(fallbackDepartures.map(({ tour }) => tour));
          setDestinations(
            fallbackDepartures
              .map(({ destination }) => destination)
              .filter((destination): destination is PublicDestination =>
                Boolean(destination)
              )
          );
          setExperts(createFallbackExperts());
          setEnrichedDepartures(fallbackDepartures);
          setVisibleMonth(getPreferredMonth(fallbackDepartures));
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
  }, []);

  const monthOptions = useMemo(() => {
    const keyedMonths = enrichedDepartures
      .map(({ departure }) => getMonthKey(departure.departureDate))
      .filter(Boolean);

    return Array.from(new Set(keyedMonths))
      .sort()
      .map((monthKey) => ({
        label: monthFormatter.format(getMonthDate(monthKey)),
        value: monthKey,
      }));
  }, [enrichedDepartures]);

  const calendarFilteredDepartures = useMemo(() => {
    return enrichedDepartures.filter(({ departure, tour }) => {
      const matchesTour =
        selectedTourId === "all" || departure.tourId === selectedTourId;
      const matchesDestination =
        selectedDestinationId === "all" ||
        [
          departure.destinationId,
          ...getTourDestinationIds(tour),
        ].includes(selectedDestinationId);

      return matchesTour && matchesDestination;
    });
  }, [enrichedDepartures, selectedDestinationId, selectedTourId]);

  const filteredDepartures = useMemo(() => {
    return calendarFilteredDepartures.filter(({ departure }) => {
      return (
        selectedMonth === "all" ||
        getMonthKey(departure.departureDate) === selectedMonth
      );
    });
  }, [calendarFilteredDepartures, selectedMonth]);

  const departuresByDate = useMemo(() => {
    return calendarFilteredDepartures.reduce(
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
  }, [calendarFilteredDepartures]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth]
  );
  const selectedDateDepartures = selectedDateKey
    ? filteredDepartures.filter(
        ({ departure }) =>
          getDateKey(departure.departureDate) === selectedDateKey
      )
    : [];
  const upcomingDepartures = (
    selectedDateDepartures.length > 0
      ? selectedDateDepartures
      : filteredDepartures.filter(
          ({ departure }) =>
            getDateValue(departure.departureDate) >=
            startOfDay(new Date()).getTime()
        )
  );
  const scheduledDepartures = [...filteredDepartures]
    .sort((left, right) => {
      if (sortMode === "price") {
        return left.departure.priceAdult - right.departure.priceAdult;
      }

      if (sortMode === "seats") {
        return right.departure.seatsAvailable - left.departure.seatsAvailable;
      }

      return (
        getDateValue(left.departure.departureDate) -
        getDateValue(right.departure.departureDate)
      );
    });
  const visibleExperts = getUniqueExperts(filteredDepartures, experts);

  function clearDateSelection() {
    setSelectedDateKey("");
  }

  function selectDate(key: string) {
    const monthKey = key.slice(0, 7);

    setSelectedDateKey(key);

    if (monthKey) {
      setSelectedMonth(monthKey);
      setVisibleMonth(getMonthDate(monthKey));
    }
  }

  function updateMonth(monthKey: string) {
    setSelectedMonth(monthKey);
    setSelectedDateKey("");

    if (monthKey !== "all") {
      setVisibleMonth(getMonthDate(monthKey));
    }
  }

  function handleSearchTours() {
    setSelectedDateKey("");

    if (selectedMonth !== "all") {
      setVisibleMonth(getMonthDate(selectedMonth));
      return;
    }

    setVisibleMonth(getPreferredMonth(calendarFilteredDepartures));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff8f0] text-secondary">
      <HeroSection />

      <section className="relative z-20 mx-auto -mt-8 w-full max-w-[1300px] px-4 sm:px-6 lg:px-0">
        <FilterBar
          destinations={destinations}
          monthOptions={monthOptions}
          selectedDestinationId={selectedDestinationId}
          selectedMonth={selectedMonth}
          selectedTourId={selectedTourId}
          tours={tours}
          onDestinationChange={(value) => {
            setSelectedDestinationId(value);
            clearDateSelection();
          }}
          onMonthChange={updateMonth}
          onSearch={handleSearchTours}
          onTourChange={(value) => {
            setSelectedTourId(value);
            clearDateSelection();
          }}
        />
      </section>

      <section className="mx-auto grid w-full max-w-[1300px] items-start gap-5 px-4 pb-6 pt-5 sm:px-6 lg:grid-cols-[430px_minmax(0,1fr)] lg:px-0">
        <CalendarPanel
          calendarDays={calendarDays}
          departuresByDate={departuresByDate}
          selectedDateKey={selectedDateKey}
          visibleMonth={visibleMonth}
          onMonthChange={(month) => {
            setVisibleMonth(month);
            setSelectedMonth(getMonthKey(month));
            clearDateSelection();
          }}
          onSelectDate={selectDate}
        />

        <UpcomingDeparturesPanel
          departures={upcomingDepartures}
          isLoading={isLoading}
          loadError={loadError}
          onViewAll={() => {
            setSelectedTourId("all");
            setSelectedDestinationId("all");
            setSelectedMonth("all");
            clearDateSelection();
            setVisibleMonth(getPreferredMonth(enrichedDepartures));
          }}
        />
      </section>

      <section className="mx-auto w-full max-w-[1300px] px-4 py-3 sm:px-6 lg:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-[24px] font-bold leading-tight text-secondary">
            All Scheduled Tours
          </h2>
          <label className="relative inline-flex h-10 w-fit min-w-[186px] items-center gap-2 rounded-[7px] border border-[#e8cbaa] bg-[#fffaf4] px-3 font-sans text-[11px] font-semibold text-secondary/65 shadow-[0_8px_20px_rgba(67,43,27,0.05)] transition-all hover:border-primary/55 hover:bg-white focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
            <span className="shrink-0">Sort by:</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 font-bold text-secondary outline-none"
            >
              <option value="earliest">Earliest Departure</option>
              <option value="price">Price Low to High</option>
              <option value="seats">Most Seats Left</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 size-3.5 text-primary"
              strokeWidth={1.8}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {scheduledDepartures.length > 0 ? (
            scheduledDepartures.map((item) => (
              <ScheduledTourCard
                key={getDepartureIdentifier(item.departure)}
                item={item}
              />
            ))
          ) : (
            <EmptyState message="No scheduled tours match these filters." />
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1300px] px-4 py-5 sm:px-6 lg:px-0">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-[24px] font-bold leading-tight text-secondary">
            Meet Our Experts
          </h2>
          <Link
            href="/about"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-sans text-[12px] font-bold text-primary transition-colors hover:bg-[#fff1e5] hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            View All Experts
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleExperts.length > 0 ? (
            visibleExperts.map((expert, index) => (
              <ExpertCard
                key={expert.expertId || expert.id}
                expert={expert}
                index={index}
              />
            ))
          ) : (
            <EmptyState message="No expert profiles are available yet." />
          )}
        </div>
      </section>

      <BenefitsBand />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[340px] overflow-hidden bg-[#fff8f0]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Traveller overlooking ancient temple architecture"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,248,240,0.98)_0%,rgba(255,248,240,0.9)_31%,rgba(255,248,240,0.38)_58%,rgba(255,248,240,0.05)_100%)]" />
      
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,rgba(255,248,240,0)_0%,#fff8f0_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[340px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
        <Header />

        <div className="flex flex-1 items-center px-0 pb-12 pt-7 sm:px-8">
          <div className="max-w-[430px]">
            <p className="font-sans text-[11px] font-bold uppercase tracking-normal text-primary">
              Plan Your Journey
            </p>
            <h1 className="mt-2 font-heading text-[42px] font-bold leading-none tracking-normal text-secondary sm:text-[56px] lg:text-[64px]">
              Tour Calendar
            </h1>
            <p className="mt-4 max-w-[360px] font-sans text-[13px] leading-[1.65] text-secondary/78">
              Handpicked journeys across India, led by experts. Explore, learn
              and experience timeless heritage.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  destinations,
  monthOptions,
  selectedDestinationId,
  selectedMonth,
  selectedTourId,
  tours,
  onDestinationChange,
  onMonthChange,
  onSearch,
  onTourChange,
}: {
  destinations: PublicDestination[];
  monthOptions: Array<{ label: string; value: string }>;
  selectedDestinationId: string;
  selectedMonth: string;
  selectedTourId: string;
  tours: PublicTour[];
  onDestinationChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onSearch: () => void;
  onTourChange: (value: string) => void;
}) {
  const tourOptions = [
    { label: "Select Tours", value: "all" },
    ...tours.map((tour) => ({
      label: tour.tourName,
      value: tour.tourId,
    })),
  ];
  const destinationOptions = [
    { label: "Select Destination", value: "all" },
    ...destinations.map((destination) => ({
      label: destination.destinationName,
      value: destination.destinationId,
    })),
  ];
  const filterMonthOptions = [
    { label: "Select Month", value: "all" },
    ...monthOptions,
  ];

  return (
    <div className="grid w-full min-w-0 gap-2 rounded-[24px] border border-[#ead8c5] bg-white/94 p-2 shadow-[0_20px_50px_rgba(67,43,27,0.14)] backdrop-blur-md sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_150px] xl:gap-0 xl:rounded-full">
      <FilterSelect
        icon={Grid2X2}
        label="Tours"
        options={tourOptions}
        value={selectedTourId}
        onChange={onTourChange}
      />
      <FilterSelect
        icon={MapPin}
        label="Destinations"
        hasDivider
        options={destinationOptions}
        value={selectedDestinationId}
        onChange={onDestinationChange}
      />
      <FilterSelect
        icon={Calendar}
        label="Months"
        hasDivider
        options={filterMonthOptions}
        value={selectedMonth}
        onChange={onMonthChange}
      />
      <button
        type="button"
        onClick={onSearch}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-primary bg-white px-4 font-sans text-[13px] font-semibold leading-tight text-primary shadow-[0_10px_22px_rgba(212,114,32,0.12)] transition-all hover:bg-primary hover:text-white hover:shadow-[0_15px_30px_rgba(212,114,32,0.24)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:col-span-2 lg:col-span-1 xl:rounded-full"
      >
        <span className="whitespace-nowrap">Search Tours</span>
        <ArrowRight className="size-4 shrink-0" strokeWidth={2} />
      </button>
    </div>
  );
}

function FilterSelect({
  hasDivider = false,
  icon: Icon,
  label,
  onChange,
  options,
  value,
}: {
  hasDivider?: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label || label;

  return (
    <div
      className={cn(
        "relative min-w-0 rounded-[18px] xl:rounded-none",
        hasDivider && "xl:border-l xl:border-[#e8cbaa]"
      )}
    >
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue !== null) {
            onChange(nextValue);
          }
        }}
      >
        <SelectTrigger
          aria-label={label}
          className="h-12 min-w-0 rounded-[18px] border-[#e8cbaa] bg-[#fffaf4] px-4 font-sans text-[14px] font-semibold text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] hover:border-primary/55 hover:bg-white focus-visible:ring-primary/15 data-[popup-open]:border-primary data-[popup-open]:bg-white data-[popup-open]:ring-primary/15 xl:rounded-none xl:border-y-0 xl:border-l-0 xl:border-r-0 xl:bg-transparent xl:px-5 xl:shadow-none xl:focus-visible:ring-0 xl:data-[popup-open]:ring-0 [&_[data-slot=select-icon]]:text-primary"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
            <span data-slot="select-value" className="min-w-0 truncate text-left">
              {selectedLabel}
            </span>
          </span>
        </SelectTrigger>
        <SelectContent className="border-[#ead8c5] bg-[#fffaf4]">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CalendarPanel({
  calendarDays,
  departuresByDate,
  selectedDateKey,
  visibleMonth,
  onMonthChange,
  onSelectDate,
}: {
  calendarDays: CalendarDay[];
  departuresByDate: Record<string, EnrichedDeparture[]>;
  selectedDateKey: string;
  visibleMonth: Date;
  onMonthChange: (month: Date) => void;
  onSelectDate: (key: string) => void;
}) {
  return (
    <article className="rounded-[9px] border border-[#ead8c5] bg-white/94 p-6 shadow-[0_16px_36px_rgba(67,43,27,0.08)]">
      <h2 className="font-heading text-[22px] font-bold leading-none text-secondary">
        Select Dates
      </h2>
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(visibleMonth, -1))}
          className="grid size-9 place-items-center rounded-full border border-transparent text-secondary/60 transition-all hover:border-primary/20 hover:bg-[#fff1e5] hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h3 className="font-sans text-[15px] font-bold text-secondary">
          {monthFormatter.format(visibleMonth)}
        </h3>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(visibleMonth, 1))}
          className="grid size-9 place-items-center rounded-full border border-transparent text-secondary/60 transition-all hover:border-primary/20 hover:bg-[#fff1e5] hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-y-4">
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
          const status = getDepartureStatus(dayDepartures);
          const isSelected = selectedDateKey === key;

          return (
            <button
              key={key}
              type="button"
              disabled={!hasDepartures}
              onClick={() => onSelectDate(key)}
              aria-pressed={isSelected}
              className={cn(
                "relative mx-auto grid size-10 place-items-center rounded-full border border-transparent font-sans text-[13px] font-semibold transition-all disabled:cursor-default focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
                day.isCurrentMonth ? "text-secondary" : "text-secondary/32",
                hasDepartures &&
                  "hover:border-primary/20 hover:bg-[#fff1e5] hover:text-primary",
                isSelected &&
                  "border-primary/30 bg-[#fff1e5] text-primary shadow-[0_0_0_4px_rgba(212,114,32,0.1)]"
              )}
            >
              {day.date.getDate()}
              {hasDepartures ? (
                <span
                  className={cn(
                    "absolute -bottom-1 size-1.5 rounded-full",
                    statusDotClassName(status)
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-3 font-sans text-[11px] font-semibold text-secondary/62 sm:grid-cols-2">
        <LegendDot label="Seats Available" status="available" />
        <LegendDot label="Few Seats Left" status="few" />
        <LegendDot label="Almost Full" status="almost" />
        <LegendDot label="Sold Out" status="full" />
      </div>
    </article>
  );
}

function UpcomingDeparturesPanel({
  departures,
  isLoading,
  loadError,
  onViewAll,
}: {
  departures: EnrichedDeparture[];
  isLoading: boolean;
  loadError: string;
  onViewAll: () => void;
}) {
  return (
    <article className="rounded-[9px] border border-[#ead8c5] bg-white/94 p-5 shadow-[0_16px_36px_rgba(67,43,27,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-[19px] font-bold leading-none text-secondary">
          Upcoming Departures
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-sans text-[11px] font-bold text-primary transition-colors hover:bg-[#fff1e5] hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
        >
          View All Departures
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
        {departures.length > 0 ? (
          departures.map((item, index) => (
            <DepartureRow
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
                : loadError || "No upcoming departures match these filters."
            }
          />
        )}
      </div>
    </article>
  );
}

function DepartureRow({ index, item }: { index: number; item: EnrichedDeparture }) {
  const status = getDepartureStatus([item]);

  return (
    <article className="grid gap-3 rounded-[8px] border border-[#ead8c5] bg-white p-3 shadow-[0_8px_20px_rgba(67,43,27,0.035)] transition-all hover:-translate-y-0.5 hover:border-primary/55 hover:bg-[#fffaf4] hover:shadow-[0_14px_28px_rgba(67,43,27,0.08)] xl:grid-cols-[172px_minmax(0,1fr)_82px_112px_150px] xl:items-center">
      <div className="relative h-[128px] overflow-hidden rounded-[7px] bg-muted xl:h-[104px]">
        <Image
          src={getTourImage(item.tour)}
          alt={item.tour.tourName}
          fill
          sizes="172px"
          className="object-cover"
        />
        <span
          className={cn(
            "absolute left-2 top-2 rounded-[5px] px-2 py-1 font-sans text-[10px] font-bold",
            statusBadgeClassName(status)
          )}
        >
          {getDurationBadge(item.tour)}
        </span>
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-2 font-heading text-[18px] font-bold leading-tight text-secondary">
          {item.tour.tourName}
        </h3>
        <p className="mt-2 flex items-center gap-2 font-sans text-[11px] font-semibold text-secondary/62">
          <CalendarDays className="size-3.5 text-primary" strokeWidth={1.8} />
          {formatDateRange(item.departure)}
        </p>
        <p className="mt-1 flex items-center gap-2 font-sans text-[11px] font-semibold text-secondary/62">
          <MapPin className="size-3.5 text-primary" strokeWidth={1.8} />
          {getDestinationName(item)}
        </p>
      </div>

      <MetricBlock label="Seats Left" value={item.departure.seatsAvailable.toString()} />
      <MetricBlock label="per person" value={formatPrice(item.departure.priceAdult)} />

      <div className="grid gap-2 xl:justify-items-end">
        <Link
          href={`/tours/${encodeURIComponent(item.tour.tourId)}`}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-primary bg-white px-3 font-sans text-[11px] font-bold text-primary shadow-[0_6px_14px_rgba(212,114,32,0.08)] transition-all hover:bg-primary hover:text-white hover:shadow-[0_10px_18px_rgba(212,114,32,0.22)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
        >
          View Details
          <ArrowRight className="size-3.5" />
        </Link>
        <div className="flex items-center gap-2 xl:justify-end">
          <ExpertAvatar expert={item.expert} index={index} size="small" />
          <span className="min-w-0 font-sans">
            <span className="block text-[9px] font-semibold uppercase text-secondary/48">
              Expert
            </span>
            <span className="block max-w-[118px] truncate text-[10px] font-bold text-secondary">
              {getExpertName(item)}
            </span>
            <Link
              href="/about"
              className="inline-flex items-center gap-1 text-[9px] font-bold text-primary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              View Profile
            </Link>
          </span>
        </div>
      </div>
    </article>
  );
}

function ScheduledTourCard({ item }: { item: EnrichedDeparture }) {
  const status = getDepartureStatus([item]);

  return (
    <article className="overflow-hidden rounded-[9px] border border-[#ead8c5] bg-white shadow-[0_14px_32px_rgba(67,43,27,0.08)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_42px_rgba(67,43,27,0.12)]">
      <div className="relative h-[155px] bg-muted">
        <Image
          src={getTourImage(item.tour)}
          alt={item.tour.tourName}
          fill
          sizes="(min-width: 1024px) 275px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-[5px] px-2 py-1 font-sans text-[10px] font-bold",
            statusBadgeClassName(status)
          )}
        >
          {getDurationBadge(item.tour)}
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[42px] font-heading text-[17px] font-bold leading-tight text-secondary">
          {item.tour.tourName}
        </h3>
        <p className="mt-3 flex items-center gap-2 font-sans text-[11px] text-secondary/62">
          <CalendarDays className="size-3.5 text-primary" />
          {formatDateRange(item.departure)}
        </p>
        <p className="mt-1 flex items-center gap-2 font-sans text-[11px] text-secondary/62">
          <MapPin className="size-3.5 text-primary" />
          {getLocationLabel(item)}
        </p>
        <p className="mt-1 flex items-center gap-2 font-sans text-[11px] text-secondary/62">
          <Users className="size-3.5 text-primary" />
          {getSeatLabel(item.departure.seatsAvailable)}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#ead8c5] pt-3">
          <span className="font-sans text-[10px] text-secondary/58">
            from
            <strong className="block font-heading text-[18px] leading-none text-secondary">
              {formatPrice(item.departure.priceAdult)}
            </strong>
            per person
          </span>
          <Link
            href={`/tours/${encodeURIComponent(item.tour.tourId)}`}
            aria-label={`View ${item.tour.tourName}`}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-primary bg-white text-primary shadow-[0_6px_14px_rgba(212,114,32,0.08)] transition-all hover:bg-primary hover:text-white hover:shadow-[0_10px_18px_rgba(212,114,32,0.22)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ExpertCard({ expert, index }: { expert: PublicExpert; index: number }) {
  return (
    <article className="rounded-[9px] border border-[#ead8c5] bg-white p-4 shadow-[0_14px_32px_rgba(67,43,27,0.08)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_42px_rgba(67,43,27,0.12)]">
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
        className="mt-4 inline-flex h-8 items-center gap-2 rounded-[6px] border border-primary bg-white px-3 font-sans text-[11px] font-bold text-primary shadow-[0_6px_14px_rgba(212,114,32,0.08)] transition-all hover:bg-primary hover:text-white hover:shadow-[0_10px_18px_rgba(212,114,32,0.22)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
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
      <div className="relative grid overflow-hidden rounded-[9px] border border-[#ead8c5] bg-white/82 px-5 py-5 shadow-[0_14px_34px_rgba(67,43,27,0.06)] sm:grid-cols-2 lg:grid-cols-4">
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
  size?: "default" | "small";
}) {
  const image = getExpertImage(expert, index);

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-[#efe2d4]",
        size === "small" ? "size-9" : "size-16"
      )}
    >
      {image ? (
        <Image
          src={image}
          alt={expert?.fullName || "Tour expert"}
          fill
          sizes={size === "small" ? "36px" : "64px"}
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

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <span className="font-sans">
      <strong className="block text-[13px] font-bold leading-none text-secondary">
        {value}
      </strong>
      <span className="mt-1 block text-[10px] font-medium text-secondary/52">
        {label}
      </span>
    </span>
  );
}

function LegendDot({
  label,
  status,
}: {
  label: string;
  status: DepartureStatus;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 rounded-full", statusDotClassName(status))} />
      {label}
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
