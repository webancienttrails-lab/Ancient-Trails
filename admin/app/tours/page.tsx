"use client";

import type { FormEvent, ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Route,
  Search,
  Ticket,
  Trash2,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  listAdminDestinations,
  type AdminDestination,
} from "@/lib/destinations";
import { listAdminExperts, type AdminExpert } from "@/lib/experts";
import {
  createAdminTour,
  createAdminTourDeparture,
  createAdminTourItinerary,
  deleteAdminTour,
  deleteAdminTourDeparture,
  getTourMediaUrl,
  listAdminTourDepartures,
  listAdminTourItineraries,
  listAdminTours,
  updateAdminTour,
  updateAdminTourDeparture,
  updateAdminTourItinerary,
  uploadTourMedia,
  type AdminTour,
  type AdminTourDeparture,
  type AdminTourItinerary,
  type TourDeparturePayload,
  type TourItineraryPayload,
  type TourPayload,
} from "@/lib/tours";
import { cn } from "@/lib/utils";

type TourTab = "master" | "departures";
type TourSheetMode = "add" | "view" | "edit";
type DepartureSheetMode = "add" | "view" | "edit";
type ItinerarySheetMode = "add" | "view" | "edit";

type TourEditorType = "tour" | "departure" | "itinerary";

type TourRouteState = {
  id: string | null;
  mode: TourSheetMode | null;
  tourId: string | null;
  type: TourEditorType | null;
};

type TourMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
  trendTone: string;
};

type TourFormState = Omit<
  TourPayload,
  "destinationIds" | "inclusions" | "exclusions" | "galleryImages"
> & {
  destinationIds: string[];
  inclusions: string;
  exclusions: string;
  galleryImages: string;
};

type DepartureFormState = Omit<
  TourDeparturePayload,
  | "destinationId"
  | "childPricingRules"
  | "departureDate"
  | "returnDate"
  | "earlyBirdOffer"
  | "bookingDeadline"
  | "seatsAvailable"
  | "roomPolicy"
  | "priceAdult"
  | "priceExtraBed"
  | "priceChildWithoutExtraBed"
  | "singleOccupancy"
  | "depositValue"
  | "balanceDueDaysBefore"
> & {
  destinationId: string;
  departureDate: string;
  returnDate: string;
  earlyBirdOffer: string;
  bookingDeadline: string;
  childPricingRules: Array<{
    minAge: string;
    maxAge: string;
    allowExtraBed: boolean;
    allowWithoutExtraBed: boolean;
  }>;
  roomPolicy: {
    allowChildBedSharing: boolean;
    maxChildrenWithoutExtraBedPerRoom: string;
    allowExtraBed: boolean;
    allowChildSingleRoom: boolean;
  };
  seatsAvailable: string;
  priceAdult: string;
  priceExtraBed: string;
  priceChildWithoutExtraBed: string;
  singleOccupancy: string;
  depositValue: string;
  balanceDueDaysBefore: string;
};

type ItineraryDayFormState = {
  dayNumber: string;
  title: string;
  summary: string;
  placesVisited: string;
  transport: string;
  walkingDifficulty: string;
  meals: string;
};

type ItineraryFormState = Omit<TourItineraryPayload, "days"> & {
  days: ItineraryDayFormState[];
};

const emptyTourForm: TourFormState = {
  tourId: "",
  tourName: "",
  tourType: "",
  destinationId: "",
  destinationIds: [],
  durationDn: "",
  category: "",
  difficulty: "",
  bestSeason: "",
  description: "",
  inclusions: "",
  exclusions: "",
  expertId: "",
  notes: "",
  thumbnailImage: "",
  bannerImage: "",
  galleryImages: "",
  video: "",
};

const emptyDepartureForm: DepartureFormState = {
  departureId: "",
  tourId: "",
  destinationId: "",
  departureDate: "",
  returnDate: "",
  seatsAvailable: "0",
  priceAdult: "0",
  priceExtraBed: "0",
  priceChildWithoutExtraBed: "0",
  singleOccupancy: "0",
  depositType: "fixed",
  depositValue: "0",
  depositAppliesTo: "per_person",
  balanceDueDaysBefore: "0",
  earlyBirdOffer: "",
  bookingDeadline: "",
  status: "scheduled",
  childPricingRules: [],
  roomPolicy: {
    allowChildBedSharing: true,
    maxChildrenWithoutExtraBedPerRoom: "1",
    allowExtraBed: true,
    allowChildSingleRoom: false,
  },
};

function createEmptyItineraryDay(dayNumber: number): ItineraryDayFormState {
  return {
    dayNumber: dayNumber.toString(),
    title: "",
    summary: "",
    placesVisited: "",
    transport: "",
    walkingDifficulty: "",
    meals: "",
  };
}

const emptyItineraryForm: ItineraryFormState = {
  tourId: "",
  itinerarySummary: "",
  days: [createEmptyItineraryDay(1)],
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendTextList(currentValue: string, newValues: string[]): string {
  return Array.from(new Set([...parseTextList(currentValue), ...newValues])).join(
    "\n"
  );
}

function normalizeDestinationIds(
  destinationIds: string[] = [],
  destinationId = ""
): string[] {
  return Array.from(
    new Set(
      [destinationId, ...destinationIds]
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function getTourDestinationIds(
  tour: Pick<AdminTour, "destinationId"> & { destinationIds?: string[] }
) {
  return normalizeDestinationIds(tour.destinationIds || [], tour.destinationId);
}

function getDestinationNameList(
  destinationIds: string[],
  destinationNameById: Map<string, string>
) {
  return (
    destinationIds
      .map((destinationId) => destinationNameById.get(destinationId))
      .filter(Boolean)
      .join(", ") || "-"
  );
}

function createTourPayload(form: TourFormState): TourPayload {
  const destinationIds = normalizeDestinationIds(form.destinationIds);

  return {
    tourId: form.tourId.trim(),
    tourName: form.tourName.trim(),
    tourType: form.tourType.trim(),
    destinationId: destinationIds[0] || "",
    destinationIds,
    durationDn: form.durationDn.trim(),
    category: form.category.trim(),
    difficulty: form.difficulty.trim(),
    bestSeason: form.bestSeason.trim(),
    description: form.description.trim(),
    inclusions: parseTextList(form.inclusions),
    exclusions: parseTextList(form.exclusions),
    expertId: form.expertId.trim(),
    notes: form.notes.trim(),
    thumbnailImage: form.thumbnailImage.trim(),
    bannerImage: form.bannerImage.trim(),
    galleryImages: parseTextList(form.galleryImages),
    video: form.video.trim(),
  };
}

function createDeparturePayload(
  form: DepartureFormState
): TourDeparturePayload {
  const isComingSoon = form.status === "coming_soon";

  return {
    departureId: form.departureId.trim(),
    tourId: form.tourId.trim(),
    destinationId: form.destinationId.trim() || undefined,
    departureDate: isComingSoon || !form.departureDate ? null : form.departureDate,
    returnDate: isComingSoon || !form.returnDate ? null : form.returnDate,
    seatsAvailable: Number(form.seatsAvailable) || 0,
    priceAdult: Number(form.priceAdult) || 0,
    priceExtraBed: Number(form.priceExtraBed) || 0,
    priceChildWithoutExtraBed:
      Number(form.priceChildWithoutExtraBed) || 0,
    singleOccupancy: Number(form.singleOccupancy) || 0,
    depositType: form.depositType,
    depositValue: Number(form.depositValue) || 0,
    depositAppliesTo: form.depositAppliesTo,
    balanceDueDaysBefore: Number(form.balanceDueDaysBefore) || 0,
    earlyBirdOffer: form.earlyBirdOffer.trim() || null,
    bookingDeadline: form.bookingDeadline || null,
    status: form.status,
    childPricingRules: form.childPricingRules.map((rule) => ({
      minAge: Number(rule.minAge) || 0,
      maxAge: Number(rule.maxAge) || 0,
      allowExtraBed: rule.allowExtraBed,
      allowWithoutExtraBed: rule.allowWithoutExtraBed,
    })),
    roomPolicy: {
      allowChildBedSharing: form.roomPolicy.allowChildBedSharing,
      maxChildrenWithoutExtraBedPerRoom:
        Number(form.roomPolicy.maxChildrenWithoutExtraBedPerRoom) || 0,
      allowExtraBed: form.roomPolicy.allowExtraBed,
      allowChildSingleRoom: form.roomPolicy.allowChildSingleRoom,
    },
  };
}

function createItineraryPayload(
  form: ItineraryFormState
): TourItineraryPayload {
  return {
    tourId: form.tourId.trim(),
    itinerarySummary: form.itinerarySummary.trim(),
    days: form.days.map((day, index) => ({
      dayNumber: Number(day.dayNumber) || index + 1,
      title: day.title.trim(),
      summary: day.summary.trim(),
      placesVisited: parseTextList(day.placesVisited),
      transport: day.transport.trim(),
      walkingDifficulty: day.walkingDifficulty.trim(),
      meals: day.meals.trim(),
    })),
  };
}

function tourToForm(tour: AdminTour): TourFormState {
  const destinationIds = getTourDestinationIds(tour);

  return {
    tourId: tour.tourId,
    tourName: tour.tourName,
    tourType: tour.tourType,
    destinationId: destinationIds[0] || tour.destinationId,
    destinationIds,
    durationDn: tour.durationDn,
    category: tour.category,
    difficulty: tour.difficulty,
    bestSeason: tour.bestSeason,
    description: tour.description,
    inclusions: tour.inclusions.join("\n"),
    exclusions: tour.exclusions.join("\n"),
    expertId: tour.expertId,
    notes: tour.notes,
    thumbnailImage: tour.thumbnailImage || "",
    bannerImage: tour.bannerImage,
    galleryImages: tour.galleryImages.join("\n"),
    video: tour.video,
  };
}

function departureToForm(departure: AdminTourDeparture): DepartureFormState {
  return {
    departureId: departure.departureId,
    tourId: departure.tourId,
    destinationId: departure.destinationId || "",
    departureDate: formatDateInput(departure.departureDate),
    returnDate: formatDateInput(departure.returnDate),
    seatsAvailable: departure.seatsAvailable.toString(),
    priceAdult: departure.priceAdult.toString(),
    priceExtraBed: departure.priceExtraBed.toString(),
    priceChildWithoutExtraBed:
      departure.priceChildWithoutExtraBed.toString(),
    singleOccupancy: departure.singleOccupancy.toString(),
    depositType: departure.depositType || "fixed",
    depositValue: departure.depositValue.toString(),
    depositAppliesTo: departure.depositAppliesTo || "per_person",
    balanceDueDaysBefore: departure.balanceDueDaysBefore.toString(),
    earlyBirdOffer: departure.earlyBirdOffer || "",
    bookingDeadline: formatDateInput(departure.bookingDeadline),
    status: departure.status || "scheduled",
    childPricingRules: departure.childPricingRules.map((rule) => ({
      minAge: rule.minAge.toString(),
      maxAge: rule.maxAge.toString(),
      allowExtraBed: rule.allowExtraBed,
      allowWithoutExtraBed: rule.allowWithoutExtraBed,
    })),
    roomPolicy: {
      allowChildBedSharing:
        departure.roomPolicy?.allowChildBedSharing ?? true,
      maxChildrenWithoutExtraBedPerRoom: String(
        departure.roomPolicy?.maxChildrenWithoutExtraBedPerRoom ?? 1
      ),
      allowExtraBed: departure.roomPolicy?.allowExtraBed ?? true,
      allowChildSingleRoom:
        departure.roomPolicy?.allowChildSingleRoom ?? false,
    },
  };
}

function itineraryToForm(itinerary: AdminTourItinerary): ItineraryFormState {
  return {
    tourId: itinerary.tourId,
    itinerarySummary: itinerary.itinerarySummary,
    days:
      itinerary.days.length > 0
        ? itinerary.days.map((day, index) => ({
            dayNumber: (day.dayNumber || index + 1).toString(),
            title: day.title,
            summary: day.summary,
            placesVisited: day.placesVisited.join("\n"),
            transport: day.transport,
            walkingDifficulty: day.walkingDifficulty,
            meals: day.meals,
          }))
        : [createEmptyItineraryDay(1)],
  };
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return formatDateWithDashes(date);
}

function formatDateInput(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDatePickerValue(value: string): string {
  const date = parseDateInputValue(value);

  if (!date) {
    return "dd-mm-yyyy";
  }

  return formatDateWithDashes(date);
}

function dateToInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateWithDashes(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value || 0);
}

function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createTourMetrics(
  tours: AdminTour[],
  departures: AdminTourDeparture[]
): TourMetric[] {
  const seatsAvailable = departures.reduce(
    (total, departure) => total + departure.seatsAvailable,
    0
  );
  const upcomingDepartures = departures.filter(
    (departure) =>
      departure.departureDate &&
      new Date(departure.departureDate).getTime() >= Date.now()
  ).length;

  return [
    {
      label: "Tour Masters",
      value: tours.length.toString(),
      trend: "Live tour records",
      icon: Route,
      tone: "bg-primary/10 text-primary",
      trendTone: "text-emerald-600",
    },
    {
      label: "Departures",
      value: departures.length.toString(),
      trend: "Scheduled departures",
      icon: Ticket,
      tone: "bg-emerald-100 text-emerald-700",
      trendTone: "text-emerald-600",
    },
    {
      label: "Upcoming",
      value: upcomingDepartures.toString(),
      trend: "Future departure dates",
      icon: CalendarDays,
      tone: "bg-amber-100 text-amber-700",
      trendTone: "text-amber-600",
    },
    {
      label: "Seats",
      value: seatsAvailable.toString(),
      trend: "Total available seats",
      icon: Users,
      tone: "bg-sky-100 text-sky-700",
      trendTone: "text-sky-600",
    },
  ];
}

export default function ToursPage() {
  return (
    <Suspense fallback={null}>
      <ToursPageContent />
    </Suspense>
  );
}

function normalizeTourEditorType(
  value: string | null
): TourEditorType {
  if (
    value === "departure" ||
    value === "itinerary"
  ) {
    return value;
  }

  return "tour";
}

function getTourRouteState(
  pathname: string,
  searchParams: URLSearchParams
): TourRouteState {
  const segments = pathname
    .split("/")
    .filter(Boolean);

  const toursIndex =
    segments.findIndex(
      (segment) => segment === "tours"
    );

  const pageSegment =
    toursIndex >= 0
      ? segments[toursIndex + 1]
      : "";

  if (pageSegment === "add") {
    return {
      id: null,
      mode: "add",
      tourId: searchParams.get("tourId"),
      type: normalizeTourEditorType(
        searchParams.get("type")
      ),
    };
  }

  if (
    (pageSegment === "edit" ||
      pageSegment === "view") &&
    searchParams.get("id")
  ) {
    return {
      id: searchParams.get("id"),
      mode:
        pageSegment === "edit"
          ? "edit"
          : "view",
      tourId: searchParams.get("tourId"),
      type: normalizeTourEditorType(
        searchParams.get("type")
      ),
    };
  }

  return {
    id: null,
    mode: null,
    tourId: null,
    type: null,
  };
}

function ToursPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const searchParamString =
    searchParams.toString();
  const routeState = useMemo(
    () =>
      getTourRouteState(
        pathname,
        new URLSearchParams(
          searchParamString
        )
      ),
    [pathname, searchParamString]
  );
  const [activeTab, setActiveTab] = useState<TourTab>("master");
  const [searchQuery, setSearchQuery] = useState("");
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [departures, setDepartures] = useState<AdminTourDeparture[]>([]);
  const [itineraries, setItineraries] = useState<AdminTourItinerary[]>([]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [experts, setExperts] = useState<AdminExpert[]>([]);
  const [isLoadingTours, setIsLoadingTours] = useState(true);
  const [tourSheetMode, setTourSheetMode] = useState<TourSheetMode | null>(
    routeState.mode === "add" &&
      routeState.type === "tour"
      ? "add"
      : null
  );
  const [departureSheetMode, setDepartureSheetMode] =
    useState<DepartureSheetMode | null>(
      routeState.mode === "add" &&
        routeState.type === "departure"
        ? "add"
        : null
    );
  const [itinerarySheetMode, setItinerarySheetMode] =
    useState<ItinerarySheetMode | null>(
      routeState.mode === "add" &&
        routeState.type === "itinerary"
        ? "add"
        : null
    );
  const [selectedTour, setSelectedTour] = useState<AdminTour | null>(null);
  const [selectedDeparture, setSelectedDeparture] =
    useState<AdminTourDeparture | null>(null);
  const [selectedItinerary, setSelectedItinerary] =
    useState<AdminTourItinerary | null>(null);
  const [tourForm, setTourForm] = useState<TourFormState>(emptyTourForm);
  const [departureForm, setDepartureForm] =
    useState<DepartureFormState>(emptyDepartureForm);
  const [itineraryForm, setItineraryForm] =
    useState<ItineraryFormState>(emptyItineraryForm);
  const [isSavingTour, setIsSavingTour] = useState(false);
  const [isUploadingTourThumbnailImage, setIsUploadingTourThumbnailImage] =
    useState(false);
  const [isUploadingTourBannerImage, setIsUploadingTourBannerImage] =
    useState(false);
  const [isUploadingTourGalleryImages, setIsUploadingTourGalleryImages] =
    useState(false);
  const [isUploadingTourVideo, setIsUploadingTourVideo] = useState(false);
  const [isSavingDeparture, setIsSavingDeparture] = useState(false);
  const [isSavingItinerary, setIsSavingItinerary] = useState(false);
  const [isDeletingTourId, setIsDeletingTourId] = useState<string | null>(null);
  const [isDeletingDepartureId, setIsDeletingDepartureId] =
    useState<string | null>(null);
  useEffect(() => {
    let isMounted = true;

    async function loadTourData() {
      try {
        const [
          toursResponse,
          departuresResponse,
          itinerariesResponse,
          destinationsResponse,
          expertsResponse,
        ] = await Promise.all([
          listAdminTours(),
          listAdminTourDepartures(),
          listAdminTourItineraries(),
          listAdminDestinations(),
          listAdminExperts(),
        ]);

        if (isMounted) {
          const loadedTours =
            toursResponse.data.tours;
          const loadedDepartures =
            departuresResponse.data.departures;
          const loadedItineraries =
            itinerariesResponse.data.itineraries;

          setTours(loadedTours);
          setDepartures(loadedDepartures);
          setItineraries(loadedItineraries);
          setDestinations(destinationsResponse.data.destinations);
          setExperts(expertsResponse.data.experts);

          if (routeState.mode === "add") {
            if (routeState.type === "tour") {
              setSelectedTour(null);
              setTourForm(emptyTourForm);
              setTourSheetMode("add");
            } else if (routeState.type === "departure") {
              setSelectedDeparture(null);
              setDepartureForm(emptyDepartureForm);
              setDepartureSheetMode("add");
            } else if (routeState.type === "itinerary") {
              setSelectedItinerary(null);
              setItineraryForm({
                ...emptyItineraryForm,
                tourId: routeState.tourId || "",
              });
              setItinerarySheetMode("add");
            }
          } else if (routeState.mode) {
            if (routeState.type === "tour") {
              const tour = loadedTours.find(
                (item) =>
                  item.id === routeState.id
              );

              if (tour) {
                setSelectedTour(tour);
                setTourForm(tourToForm(tour));
                setTourSheetMode(routeState.mode);
              }
            } else if (
              routeState.type === "departure"
            ) {
              const departure =
                loadedDepartures.find(
                  (item) =>
                    item.id === routeState.id
                );

              if (departure) {
                setSelectedDeparture(departure);
                setDepartureForm(departureToForm(departure));
                setDepartureSheetMode(routeState.mode);
              }
            } else if (
              routeState.type === "itinerary"
            ) {
              const itinerary =
                loadedItineraries.find(
                  (item) =>
                    item.id === routeState.id
                );

              if (itinerary) {
                setSelectedItinerary(itinerary);
                setItineraryForm(itineraryToForm(itinerary));
                setItinerarySheetMode(routeState.mode);
              }
            }
          }
        }
      } catch (error) {
        toast.error("Unable to load tours", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingTours(false);
        }
      }
    }

    loadTourData();

    return () => {
      isMounted = false;
    };
  }, [routeState, toast]);

  const tourMetrics = useMemo(
    () => createTourMetrics(tours, departures),
    [departures, tours]
  );

  const filteredTours = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query || activeTab !== "master") {
      return tours;
    }

    return tours.filter((tour) =>
      [
        tour.tourId,
        tour.tourName,
        tour.tourType,
        tour.destinationId,
        ...getTourDestinationIds(tour),
        tour.durationDn,
        tour.category,
        tour.difficulty,
        tour.bestSeason,
        tour.expertId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [activeTab, searchQuery, tours]);

  const filteredDepartures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query || activeTab !== "departures") {
      return departures;
    }

    return departures.filter((departure) =>
      [
        departure.departureId,
        departure.tourId,
        departure.depositType,
        departure.earlyBirdOffer,
        formatDate(departure.departureDate),
        formatDate(departure.returnDate),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [activeTab, departures, searchQuery]);

  const destinationNameById = useMemo(
    () =>
      new Map(
        destinations.map((destination) => [
          destination.destinationId,
          destination.destinationName,
        ])
      ),
    [destinations]
  );

  const expertNameById = useMemo(
    () =>
      new Map(experts.map((expert) => [expert.expertId, expert.fullName])),
    [experts]
  );

  const tourNameById = useMemo(
    () => new Map(tours.map((tour) => [tour.tourId, tour.tourName])),
    [tours]
  );
  const itineraryByTourId = useMemo(
    () =>
      new Map(
        itineraries.map((itinerary) => [itinerary.tourId, itinerary])
      ),
    [itineraries]
  );
  const isTourFormBusy =
    isSavingTour ||
    isUploadingTourThumbnailImage ||
    isUploadingTourBannerImage ||
    isUploadingTourGalleryImages ||
    isUploadingTourVideo;

  function updateTourForm<K extends keyof TourFormState>(
    field: K,
    value: TourFormState[K]
  ) {
    setTourForm((currentForm) => ({
      ...currentForm,
      ...(field === "destinationIds"
        ? {
            destinationId:
              (value as string[])[0] || "",
          }
        : {}),
      [field]: value,
    }));
  }

  function updateDepartureForm<K extends keyof DepartureFormState>(
    field: K,
    value: DepartureFormState[K]
  ) {
    setDepartureForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateItineraryForm<K extends keyof ItineraryFormState>(
    field: K,
    value: ItineraryFormState[K]
  ) {
    setItineraryForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateItineraryDay(
    dayIndex: number,
    field: keyof ItineraryDayFormState,
    value: string
  ) {
    setItineraryForm((currentForm) => ({
      ...currentForm,
      days: currentForm.days.map((day, index) =>
        index === dayIndex ? { ...day, [field]: value } : day
      ),
    }));
  }

  function addItineraryDay() {
    setItineraryForm((currentForm) => ({
      ...currentForm,
      days: [
        ...currentForm.days,
        createEmptyItineraryDay(currentForm.days.length + 1),
      ],
    }));
  }

  function removeItineraryDay(dayIndex: number) {
    setItineraryForm((currentForm) => ({
      ...currentForm,
      days:
        currentForm.days.length > 1
          ? currentForm.days
              .filter((_day, index) => index !== dayIndex)
              .map((day, index) => ({
                ...day,
                dayNumber: (index + 1).toString(),
              }))
          : currentForm.days,
    }));
  }

  function openAddTourSheet() {
    router.push("/tours/add?type=tour");
  }

  function openViewTourSheet(tour: AdminTour) {
    router.push(
      `/tours/view?type=tour&id=${encodeURIComponent(tour.id)}`
    );
  }

  function openEditTourSheet(tour: AdminTour) {
    router.push(
      `/tours/edit?type=tour&id=${encodeURIComponent(tour.id)}`
    );
  }

  function openTourItinerarySheet(tour: AdminTour) {
    const itinerary = itineraryByTourId.get(tour.tourId);

    if (itinerary) {
      setSelectedItinerary(itinerary);
      setItineraryForm(itineraryToForm(itinerary));
      setItinerarySheetMode("edit");
      router.push(
        `/tours/edit?type=itinerary&id=${encodeURIComponent(itinerary.id)}`
      );
      return;
    }

    setSelectedItinerary(null);
    setItineraryForm({
      ...emptyItineraryForm,
      tourId: tour.tourId,
    });
    setItinerarySheetMode("add");
    router.push(
      `/tours/add?type=itinerary&tourId=${encodeURIComponent(tour.tourId)}`
    );
  }

  function closeTourSheet() {
    if (isTourFormBusy) {
      return;
    }

    if (routeState.mode) {
      router.push("/tours");
      return;
    }

    setTourSheetMode(null);
    setSelectedTour(null);
    setTourForm(emptyTourForm);
  }

  async function handleTourThumbnailImageUpload(files: FileList | null) {
    const [thumbnailImage] = Array.from(files || []);

    if (!thumbnailImage) {
      return;
    }

    setIsUploadingTourThumbnailImage(true);

    try {
      const response = await uploadTourMedia({ thumbnailImage });

      setTourForm((currentForm) => ({
        ...currentForm,
        thumbnailImage: response.data.thumbnailImage,
      }));
      toast.success("Thumbnail uploaded", response.message);
    } catch (error) {
      toast.error("Thumbnail upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingTourThumbnailImage(false);
    }
  }

  async function handleTourBannerImageUpload(files: FileList | null) {
    const [bannerImage] = Array.from(files || []);

    if (!bannerImage) {
      return;
    }

    setIsUploadingTourBannerImage(true);

    try {
      const response = await uploadTourMedia({ bannerImage });

      setTourForm((currentForm) => ({
        ...currentForm,
        bannerImage: response.data.bannerImage,
      }));
      toast.success("Banner uploaded", response.message);
    } catch (error) {
      toast.error("Banner upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingTourBannerImage(false);
    }
  }

  async function handleTourGalleryImagesUpload(files: FileList | null) {
    const galleryImages = Array.from(files || []);

    if (galleryImages.length === 0) {
      return;
    }

    setIsUploadingTourGalleryImages(true);

    try {
      const response = await uploadTourMedia({ galleryImages });

      setTourForm((currentForm) => ({
        ...currentForm,
        galleryImages: appendTextList(
          currentForm.galleryImages,
          response.data.galleryImages
        ),
      }));
      toast.success("Gallery uploaded", response.message);
    } catch (error) {
      toast.error("Gallery upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingTourGalleryImages(false);
    }
  }

  async function handleTourVideoUpload(files: FileList | null) {
    const [video] = Array.from(files || []);

    if (!video) {
      return;
    }

    setIsUploadingTourVideo(true);

    try {
      const response = await uploadTourMedia({ video });

      setTourForm((currentForm) => ({
        ...currentForm,
        video: response.data.video,
      }));
      toast.success("Video uploaded", response.message);
    } catch (error) {
      toast.error("Video upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingTourVideo(false);
    }
  }

  function handleRemoveTourThumbnailImage() {
    updateTourForm("thumbnailImage", "");
  }

  function handleRemoveTourBannerImage() {
    updateTourForm("bannerImage", "");
  }

  function handleRemoveTourGalleryImage(indexToRemove: number) {
    setTourForm((currentForm) => ({
      ...currentForm,
      galleryImages: parseTextList(currentForm.galleryImages)
        .filter((_image, index) => index !== indexToRemove)
        .join("\n"),
    }));
  }

  function handleRemoveTourVideo() {
    updateTourForm("video", "");
  }

  function openAddDepartureSheet() {
    router.push("/tours/add?type=departure");
  }

  function openViewDepartureSheet(departure: AdminTourDeparture) {
    router.push(
      `/tours/view?type=departure&id=${encodeURIComponent(departure.id)}`
    );
  }

  function openEditDepartureSheet(departure: AdminTourDeparture) {
    router.push(
      `/tours/edit?type=departure&id=${encodeURIComponent(departure.id)}`
    );
  }

  function closeDepartureSheet() {
    if (isSavingDeparture) {
      return;
    }

    if (routeState.mode) {
      router.push("/tours");
      return;
    }

    setDepartureSheetMode(null);
    setSelectedDeparture(null);
    setDepartureForm(emptyDepartureForm);
  }

  function closeItinerarySheet() {
    if (isSavingItinerary) {
      return;
    }

    if (routeState.mode) {
      router.push("/tours");
      return;
    }

    setItinerarySheetMode(null);
    setSelectedItinerary(null);
    setItineraryForm(emptyItineraryForm);
  }

  async function handleSaveTour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      tourSheetMode === "view" ||
      isUploadingTourThumbnailImage ||
      isUploadingTourBannerImage ||
      isUploadingTourGalleryImages ||
      isUploadingTourVideo
    ) {
      return;
    }

    setIsSavingTour(true);

    const payload = createTourPayload(tourForm);

    try {
      if (tourSheetMode === "edit" && selectedTour) {
        const response = await updateAdminTour(selectedTour.id, payload);

        setTours((currentTours) =>
          currentTours.map((tour) =>
            tour.id === selectedTour.id ? response.data.tour : tour
          )
        );
        setTourSheetMode(null);
        setSelectedTour(null);
        setTourForm(emptyTourForm);
        toast.success("Tour updated", response.message);
        router.push("/tours");
        return;
      }

      const response = await createAdminTour(payload);

      setTours((currentTours) => [response.data.tour, ...currentTours]);
      setTourSheetMode(null);
      setSelectedTour(null);
      setTourForm(emptyTourForm);
      toast.success("Tour added", response.message);
      router.push("/tours");
    } catch (error) {
      toast.error(
        tourSheetMode === "edit" ? "Tour not updated" : "Tour not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingTour(false);
    }
  }

  async function handleSaveDeparture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (departureSheetMode === "view") {
      return;
    }

    setIsSavingDeparture(true);

    const payload = createDeparturePayload(departureForm);

    try {
      if (departureSheetMode === "edit" && selectedDeparture) {
        const response = await updateAdminTourDeparture(
          selectedDeparture.id,
          payload
        );

        setDepartures((currentDepartures) =>
          currentDepartures.map((departure) =>
            departure.id === selectedDeparture.id
              ? response.data.departure
              : departure
          )
        );
        setDepartureSheetMode(null);
        setSelectedDeparture(null);
        setDepartureForm(emptyDepartureForm);
        toast.success("Departure updated", response.message);
        router.push("/tours");
        return;
      }

      const response = await createAdminTourDeparture(payload);

      setDepartures((currentDepartures) => [
        response.data.departure,
        ...currentDepartures,
      ]);
      setDepartureSheetMode(null);
      setSelectedDeparture(null);
      setDepartureForm(emptyDepartureForm);
      toast.success("Departure added", response.message);
      router.push("/tours");
    } catch (error) {
      toast.error(
        departureSheetMode === "edit"
          ? "Departure not updated"
          : "Departure not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingDeparture(false);
    }
  }

  async function handleSaveItinerary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (itinerarySheetMode === "view") {
      return;
    }

    setIsSavingItinerary(true);

    const payload = createItineraryPayload(itineraryForm);

    try {
      if (itinerarySheetMode === "edit" && selectedItinerary) {
        const response = await updateAdminTourItinerary(
          selectedItinerary.id,
          payload
        );

        setItineraries((currentItineraries) =>
          currentItineraries.map((itinerary) =>
            itinerary.id === selectedItinerary.id
              ? response.data.itinerary
              : itinerary
          )
        );
        setItinerarySheetMode(null);
        setSelectedItinerary(null);
        setItineraryForm(emptyItineraryForm);
        toast.success("Itinerary updated", response.message);
        router.push("/tours");
        return;
      }

      const response = await createAdminTourItinerary(payload);

      setItineraries((currentItineraries) => [
        response.data.itinerary,
        ...currentItineraries,
      ]);
      setItinerarySheetMode(null);
      setSelectedItinerary(null);
      setItineraryForm(emptyItineraryForm);
      toast.success("Itinerary added", response.message);
      router.push("/tours");
    } catch (error) {
      toast.error(
        itinerarySheetMode === "edit"
          ? "Itinerary not updated"
          : "Itinerary not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingItinerary(false);
    }
  }

  async function handleDeleteTour(tour: AdminTour) {
    const shouldDelete = window.confirm(`Delete ${tour.tourName}?`);

    if (!shouldDelete) {
      return;
    }

    setIsDeletingTourId(tour.id);

    try {
      const response = await deleteAdminTour(tour.id);

      setTours((currentTours) =>
        currentTours.filter((currentTour) => currentTour.id !== tour.id)
      );
      toast.success("Tour deleted", response.message);
    } catch (error) {
      toast.error("Tour not deleted", getErrorMessage(error));
    } finally {
      setIsDeletingTourId(null);
    }
  }

  async function handleDeleteDeparture(departure: AdminTourDeparture) {
    const shouldDelete = window.confirm(`Delete ${departure.departureId}?`);

    if (!shouldDelete) {
      return;
    }

    setIsDeletingDepartureId(departure.id);

    try {
      const response = await deleteAdminTourDeparture(departure.id);

      setDepartures((currentDepartures) =>
        currentDepartures.filter(
          (currentDeparture) => currentDeparture.id !== departure.id
        )
      );
      toast.success("Departure deleted", response.message);
    } catch (error) {
      toast.error("Departure not deleted", getErrorMessage(error));
    } finally {
      setIsDeletingDepartureId(null);
    }
  }

  if (routeState.mode) {
    const isLoadingEditor =
      routeState.mode !== "add" &&
      isLoadingTours;

    const hasEditor =
      tourSheetMode ||
      departureSheetMode ||
      itinerarySheetMode;

    return (
      <AdminDashboardShell activeLabel="Tours">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/tours")}
              className="h-10 rounded-sm border-border bg-white px-3 text-xs font-bold"
            >
              <ArrowLeft className="size-4" />
              Back to Tours
            </Button>
          </div>

          {isLoadingEditor ? (
            <section className="rounded-sm border border-border bg-white p-8 text-sm text-foreground/60 shadow-sm shadow-stone-200/40">
              Loading tour editor...
            </section>
          ) : null}

          {routeState.type === "tour" &&
          tourSheetMode ? (
            <TourFormDialog
              destinations={destinations}
              experts={experts}
              form={tourForm}
              isBusy={isTourFormBusy}
              isOpen
              isSaving={isSavingTour}
              isUploadingThumbnailImage={isUploadingTourThumbnailImage}
              isUploadingBannerImage={isUploadingTourBannerImage}
              isUploadingGalleryImages={isUploadingTourGalleryImages}
              isUploadingVideo={isUploadingTourVideo}
              mode={tourSheetMode}
              onThumbnailImageUpload={handleTourThumbnailImageUpload}
              onBannerImageUpload={handleTourBannerImageUpload}
              onClose={closeTourSheet}
              onGalleryImagesUpload={handleTourGalleryImagesUpload}
              onRemoveThumbnailImage={handleRemoveTourThumbnailImage}
              onRemoveBannerImage={handleRemoveTourBannerImage}
              onRemoveGalleryImage={handleRemoveTourGalleryImage}
              onRemoveVideo={handleRemoveTourVideo}
              onSubmit={handleSaveTour}
              onUpdate={updateTourForm}
              onVideoUpload={handleTourVideoUpload}
            />
          ) : null}

          {routeState.type === "departure" &&
          departureSheetMode ? (
            <DepartureFormDialog
              form={departureForm}
              isBusy={isSavingDeparture}
              isOpen
              isSaving={isSavingDeparture}
              mode={departureSheetMode}
              onClose={closeDepartureSheet}
              onSubmit={handleSaveDeparture}
              onUpdate={updateDepartureForm}
              tours={tours}
            />
          ) : null}

          {routeState.type === "itinerary" &&
          itinerarySheetMode ? (
            <ItineraryFormDialog
              form={itineraryForm}
              isBusy={isSavingItinerary}
              isOpen
              isSaving={isSavingItinerary}
              mode={itinerarySheetMode}
              onAddDay={addItineraryDay}
              onClose={closeItinerarySheet}
              onRemoveDay={removeItineraryDay}
              onSubmit={handleSaveItinerary}
              onUpdate={updateItineraryForm}
              onUpdateDay={updateItineraryDay}
              tours={tours}
            />
          ) : null}

          {!isLoadingEditor &&
          !hasEditor ? (
            <section className="rounded-sm border border-red-200 bg-red-50 p-6">
              <p className="text-sm font-bold text-red-700">
                Tour record not found.
              </p>
            </section>
          ) : null}
        </div>
      </AdminDashboardShell>
    );
  }

  const addButtonLabel =
    activeTab === "master"
      ? "Add New Tour"
      : "Add New Departure";
  const handleAddButtonClick =
    activeTab === "master"
      ? openAddTourSheet
      : openAddDepartureSheet;

  return (
    <AdminDashboardShell activeLabel="Tours">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <AdminPageTopbar
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
              Tours
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Manage tour masters and scheduled departures.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAddButtonClick}
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            {addButtonLabel}
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {tourMetrics.map((metric) => (
            <TourMetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <TourTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setSearchQuery("");
            }}
          />
          <TourFilters
            activeTab={activeTab}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          {activeTab === "master" ? (
            <TourMasterTable
              destinationNameById={destinationNameById}
              expertNameById={expertNameById}
              isDeletingTourId={isDeletingTourId}
              isLoading={isLoadingTours}
              onDelete={handleDeleteTour}
              onEdit={openEditTourSheet}
              onItinerary={openTourItinerarySheet}
              onView={openViewTourSheet}
              totalCount={tours.length}
              tours={filteredTours}
            />
          ) : (
            <TourDepartureTable
              departures={filteredDepartures}
              isDeletingDepartureId={isDeletingDepartureId}
              isLoading={isLoadingTours}
              onDelete={handleDeleteDeparture}
              onEdit={openEditDepartureSheet}
              onView={openViewDepartureSheet}
              totalCount={departures.length}
              tourNameById={tourNameById}
            />
          )}
        </section>
      </div>

      <TourFormDialog
        destinations={destinations}
        experts={experts}
        form={tourForm}
        isBusy={isTourFormBusy}
        isOpen={tourSheetMode !== null}
        isSaving={isSavingTour}
        isUploadingThumbnailImage={isUploadingTourThumbnailImage}
        isUploadingBannerImage={isUploadingTourBannerImage}
        isUploadingGalleryImages={isUploadingTourGalleryImages}
        isUploadingVideo={isUploadingTourVideo}
        mode={tourSheetMode}
        onThumbnailImageUpload={handleTourThumbnailImageUpload}
        onBannerImageUpload={handleTourBannerImageUpload}
        onClose={closeTourSheet}
        onGalleryImagesUpload={handleTourGalleryImagesUpload}
        onRemoveThumbnailImage={handleRemoveTourThumbnailImage}
        onRemoveBannerImage={handleRemoveTourBannerImage}
        onRemoveGalleryImage={handleRemoveTourGalleryImage}
        onRemoveVideo={handleRemoveTourVideo}
        onSubmit={handleSaveTour}
        onUpdate={updateTourForm}
        onVideoUpload={handleTourVideoUpload}
      />

      <DepartureFormDialog
        form={departureForm}
        isBusy={isSavingDeparture}
        isOpen={departureSheetMode !== null}
        isSaving={isSavingDeparture}
        mode={departureSheetMode}
        onClose={closeDepartureSheet}
        onSubmit={handleSaveDeparture}
        onUpdate={updateDepartureForm}
        tours={tours}
      />

      <ItineraryFormDialog
        form={itineraryForm}
        isBusy={isSavingItinerary}
        isOpen={itinerarySheetMode !== null}
        isSaving={isSavingItinerary}
        mode={itinerarySheetMode}
        onAddDay={addItineraryDay}
        onClose={closeItinerarySheet}
        onRemoveDay={removeItineraryDay}
        onSubmit={handleSaveItinerary}
        onUpdate={updateItineraryForm}
        onUpdateDay={updateItineraryDay}
        tours={tours}
      />
    </AdminDashboardShell>
  );
}

function AdminPageTopbar({
  activeTab,
  searchQuery,
  onSearchQueryChange,
}: {
  activeTab: TourTab;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) {
  const toast = useToast();
  const searchPlaceholder =
    activeTab === "master"
      ? "Search tours..."
      : "Search departures...";

  return (
    <header className="hidden flex-col gap-4 border-b border-border pb-4 md:flex xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle className="size-9 rounded-sm" />

        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold tracking-normal">Tours</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Tours</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder={searchPlaceholder}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>

        <button
          onClick={() =>
            toast.info("Notifications", "You have 4 tour notifications.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            4
          </span>
        </button>

        <button
          onClick={() =>
            toast.info("Admin profile", "Profile menu will open here.")
          }
          className="flex h-10 items-center gap-2 rounded-sm border border-border bg-white px-2.5 text-sm font-semibold transition-colors hover:border-primary"
          type="button"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#7a3b22] text-xs font-bold text-white">
            AU
          </span>
          <span className="hidden sm:inline">Admin User</span>
          <ChevronDown className="size-4 text-foreground/45" />
        </button>
      </div>
    </header>
  );
}

function TourMetricCard({ metric }: { metric: TourMetric }) {
  const Icon = metric.icon;

  return (
    <div className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            metric.tone
          )}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {metric.value}
          </p>
          <p className={cn("mt-2 text-[11px] font-semibold", metric.trendTone)}>
            {metric.trend}
          </p>
        </div>
      </div>
    </div>
  );
}

function TourTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TourTab;
  onTabChange: (tab: TourTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border p-4">
      <TabButton
        active={activeTab === "master"}
        icon={Route}
        label="Tour Master"
        onClick={() => onTabChange("master")}
      />
      <TabButton
        active={activeTab === "departures"}
        icon={Ticket}
        label="Tour Departure"
        onClick={() => onTabChange("departures")}
      />
    </div>
  );
}

function TabButton({
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
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-white px-3 text-xs font-bold text-foreground/65 transition-colors hover:border-primary hover:text-primary",
        active && "border-primary bg-primary text-white hover:text-white"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function TourFilters({
  activeTab,
  searchQuery,
  onSearchQueryChange,
}: {
  activeTab: TourTab;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) {
  const searchPlaceholder =
    activeTab === "master"
      ? "Search tours..."
      : "Search departures...";

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
      <label className="relative min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-9 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder={searchPlaceholder}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function TourMasterTable({
  destinationNameById,
  expertNameById,
  isDeletingTourId,
  isLoading,
  onDelete,
  onEdit,
  onItinerary,
  onView,
  totalCount,
  tours,
}: {
  destinationNameById: Map<string, string>;
  expertNameById: Map<string, string>;
  isDeletingTourId: string | null;
  isLoading: boolean;
  onDelete: (tour: AdminTour) => void;
  onEdit: (tour: AdminTour) => void;
  onItinerary: (tour: AdminTour) => void;
  onView: (tour: AdminTour) => void;
  totalCount: number;
  tours: AdminTour[];
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[23%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-2 py-3 font-bold">Tour ID</th>
              <th className="px-2 py-3 font-bold">Tour Name</th>
              <th className="px-2 py-3 font-bold">Type / Category</th>
              <th className="px-2 py-3 font-bold">Destination IDs</th>
              <th className="px-2 py-3 font-bold">Duration</th>
              <th className="px-2 py-3 font-bold">Difficulty</th>
              <th className="px-2 py-3 font-bold">Expert ID</th>
              <th className="px-2 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={8}
                >
                  Loading tours...
                </td>
              </tr>
            ) : null}

            {!isLoading && tours.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={8}
                >
                  No tour masters added yet.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? tours.map((tour) => {
                  const destinationIds = getTourDestinationIds(tour);

                  return (
                    <tr
                      key={tour.id}
                      className="border-t border-border transition-colors hover:bg-muted/25"
                    >
                    <td
                      data-label="Tour ID"
                      className="px-2 py-3 text-xs font-semibold text-foreground/70"
                    >
                      <span className="block truncate">{tour.tourId}</span>
                    </td>
                    <td
                      data-label="Tour Name"
                      data-mobile-primary
                      className="px-2 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <TourThumb
                          photo={
                            tour.thumbnailImage ||
                            tour.bannerImage ||
                            tour.galleryImages[0]
                          }
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">
                            {tour.tourName}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-foreground/45">
                            Best season: {tour.bestSeason || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      data-label="Type / Category"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {tour.tourType}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {tour.category || "-"}
                      </span>
                    </td>
                    <td
                      data-label="Destination IDs"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {destinationIds.join(", ") || "-"}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {getDestinationNameList(
                          destinationIds,
                          destinationNameById
                        )}
                      </span>
                    </td>
                    <td
                      data-label="Duration"
                      className="px-2 py-3 text-xs font-semibold text-foreground/70"
                    >
                      {tour.durationDn}
                    </td>
                    <td
                      data-label="Difficulty"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {tour.difficulty || "-"}
                      </span>
                    </td>
                    <td
                      data-label="Expert ID"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {tour.expertId || "-"}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {tour.expertId
                          ? expertNameById.get(tour.expertId) || "-"
                          : "-"}
                      </span>
                    </td>
                    <td data-actions data-label="Actions" className="px-2 py-3">
                      <TourActionsMenu
                        itemName={tour.tourName}
                        isDeleting={isDeletingTourId === tour.id}
                        onDelete={() => onDelete(tour)}
                        onEdit={() => onEdit(tour)}
                        onItinerary={() => onItinerary(tour)}
                        onView={() => onView(tour)}
                      />
                    </td>
                  </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>

      <TableFooter
        count={tours.length}
        totalCount={totalCount}
        itemLabel="tour masters"
      />
    </>
  );
}

function TourDepartureTable({
  departures,
  isDeletingDepartureId,
  isLoading,
  onDelete,
  onEdit,
  onView,
  totalCount,
  tourNameById,
}: {
  departures: AdminTourDeparture[];
  isDeletingDepartureId: string | null;
  isLoading: boolean;
  onDelete: (departure: AdminTourDeparture) => void;
  onEdit: (departure: AdminTourDeparture) => void;
  onView: (departure: AdminTourDeparture) => void;
  totalCount: number;
  tourNameById: Map<string, string>;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[20%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-2 py-3 font-bold">Departure ID</th>
              <th className="px-2 py-3 font-bold">Tour</th>
              <th className="px-2 py-3 font-bold">Dates</th>
              <th className="px-2 py-3 font-bold">Seats</th>
              <th className="px-2 py-3 font-bold">Price</th>
              <th className="px-2 py-3 font-bold">Deposit</th>
              <th className="px-2 py-3 font-bold">Deadline</th>
              <th className="px-2 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={8}
                >
                  Loading departures...
                </td>
              </tr>
            ) : null}

            {!isLoading && departures.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={8}
                >
                  No tour departures added yet.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? departures.map((departure) => (
                  <tr
                    key={departure.id}
                    className="border-t border-border transition-colors hover:bg-muted/25"
                  >
                    <td
                      data-label="Departure ID"
                      className="px-2 py-3 text-xs font-semibold text-foreground/70"
                    >
                      <span className="block truncate">
                        {departure.departureId}
                      </span>
                    </td>
                    <td
                      data-label="Tour"
                      data-mobile-primary
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {departure.tourId}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {tourNameById.get(departure.tourId) || "-"}
                      </span>
                    </td>
                    <td
                      data-label="Dates"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {departure.status === "coming_soon"
                          ? "Coming Soon"
                          : formatDate(departure.departureDate)}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        Return {formatDate(departure.returnDate)}
                      </span>
                    </td>
                    <td
                      data-label="Seats"
                      className="px-2 py-3 text-xs font-semibold text-foreground/70"
                    >
                      {departure.seatsAvailable}
                    </td>
                    <td
                      data-label="Price"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        Adult {formatCurrency(departure.priceAdult)}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        Extra {formatCurrency(departure.priceExtraBed)}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        Child no bed{" "}
                        {formatCurrency(departure.priceChildWithoutExtraBed)}
                      </span>
                    </td>
                    <td
                      data-label="Deposit"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {formatEnumLabel(departure.depositType || "fixed")}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {formatCurrency(departure.depositValue)} /{" "}
                        {formatEnumLabel(
                          departure.depositAppliesTo || "per_person"
                        )}
                      </span>
                    </td>
                    <td
                      data-label="Deadline"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {formatDate(departure.bookingDeadline)}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {formatEnumLabel(departure.status)} -{" "}
                        {departure.balanceDueDaysBefore} days
                      </span>
                    </td>
                    <td data-actions data-label="Actions" className="px-2 py-3">
                      <TourActionsMenu
                        itemName={departure.departureId}
                        isDeleting={isDeletingDepartureId === departure.id}
                        onDelete={() => onDelete(departure)}
                        onEdit={() => onEdit(departure)}
                        onView={() => onView(departure)}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <TableFooter
        count={departures.length}
        totalCount={totalCount}
        itemLabel="departures"
      />
    </>
  );
}

function TourThumb({ photo }: { photo?: string }) {
  return (
    <span
      className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-[#7a3b22] bg-cover bg-center text-white"
      style={
        photo
          ? { backgroundImage: `url("${getTourMediaUrl(photo)}")` }
          : undefined
      }
    >
      {!photo ? <MapPin className="size-5" /> : null}
    </span>
  );
}

function TourActionsMenu({
  itemName,
  isDeleting,
  onDelete,
  onEdit,
  onItinerary,
  onView,
}: {
  itemName: string;
  isDeleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onItinerary?: () => void;
  onView: () => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Open actions for ${itemName}`}
              disabled={isDeleting}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-36 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          <DropdownMenuItem
            onClick={onView}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onEdit}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          {onItinerary ? (
            <DropdownMenuItem
              onClick={onItinerary}
              className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
            >
              <BookOpen className="size-4 text-emerald-700" />
              Itinerary
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            variant="destructive"
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableFooter({
  count,
  itemLabel,
  totalCount,
}: {
  count: number;
  itemLabel: string;
  totalCount: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-foreground/55">
        Showing {count ? `1 to ${count}` : "0"} of {totalCount} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <PaginationButton label="Previous" disabled>
          <ChevronDown className="size-4 rotate-90" />
        </PaginationButton>
        <PaginationButton label="Page 1" active>
          1
        </PaginationButton>
        <PaginationButton label="Next" disabled>
          <ChevronDown className="size-4 -rotate-90" />
        </PaginationButton>
      </div>
    </div>
  );
}

function TourFormDialog({
  destinations,
  experts,
  form,
  isBusy,
  isOpen,
  isSaving,
  isUploadingThumbnailImage,
  isUploadingBannerImage,
  isUploadingGalleryImages,
  isUploadingVideo,
  mode,
  onThumbnailImageUpload,
  onBannerImageUpload,
  onClose,
  onGalleryImagesUpload,
  onRemoveThumbnailImage,
  onRemoveBannerImage,
  onRemoveGalleryImage,
  onRemoveVideo,
  onSubmit,
  onUpdate,
  onVideoUpload,
}: {
  destinations: AdminDestination[];
  experts: AdminExpert[];
  form: TourFormState;
  isBusy: boolean;
  isOpen: boolean;
  isSaving: boolean;
  isUploadingThumbnailImage: boolean;
  isUploadingBannerImage: boolean;
  isUploadingGalleryImages: boolean;
  isUploadingVideo: boolean;
  mode: TourSheetMode | null;
  onThumbnailImageUpload: (files: FileList | null) => void;
  onBannerImageUpload: (files: FileList | null) => void;
  onClose: () => void;
  onGalleryImagesUpload: (files: FileList | null) => void;
  onRemoveThumbnailImage: () => void;
  onRemoveBannerImage: () => void;
  onRemoveGalleryImage: (index: number) => void;
  onRemoveVideo: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof TourFormState>(
    field: K,
    value: TourFormState[K]
  ) => void;
  onVideoUpload: (files: FileList | null) => void;
}) {
  const isReadOnly = mode === "view";
  const panelTitle =
    mode === "edit" ? "Edit Tour" : mode === "view" ? "View Tour" : "Add Tour";
  const panelDescription =
    mode === "edit"
      ? "Update the tour master details."
      : mode === "view"
        ? "Review the tour master details."
        : "Add a tour master record.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : isUploadingThumbnailImage ||
        isUploadingBannerImage ||
        isUploadingGalleryImages ||
        isUploadingVideo
      ? "Uploading media..."
    : mode === "edit"
      ? "Update Tour"
      : "Save Tour";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-28 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  if (!isOpen) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-col bg-white"
        >
          <div className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {panelTitle}
                </h2>
                <p className="mt-1 text-xs text-foreground/55">
                  {panelDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="grid size-8 shrink-0 place-items-center rounded-sm border border-emerald-600 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close tour form"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-5 px-7 py-6 sm:grid-cols-2">
            <FormField label="Tour ID" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.tourId}
                onChange={(event) => onUpdate("tourId", event.target.value)}
                className={inputClassName}
                placeholder="AT-TOUR-001"
              />
            </FormField>

            <FormField label="Tour Name" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.tourName}
                onChange={(event) => onUpdate("tourName", event.target.value)}
                className={inputClassName}
                placeholder="Badami Heritage Trail"
              />
            </FormField>

            <FormField label="Tour Type" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.tourType}
                onChange={(event) => onUpdate("tourType", event.target.value)}
                className={inputClassName}
                placeholder="Domestic"
              />
            </FormField>

            <FormField label="Destination IDs" required>
              <DestinationMultiSelect
                destinations={destinations}
                disabled={isReadOnly || destinations.length === 0}
                value={form.destinationIds}
                onChange={(value) => onUpdate("destinationIds", value)}
              />
            </FormField>

            <FormField label="Duration (D/N)" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.durationDn}
                onChange={(event) => onUpdate("durationDn", event.target.value)}
                className={inputClassName}
                placeholder="5D/4N"
              />
            </FormField>

            <FormField label="Category">
              <input
                readOnly={isReadOnly}
                value={form.category}
                onChange={(event) => onUpdate("category", event.target.value)}
                className={inputClassName}
                placeholder="Heritage"
              />
            </FormField>

            <FormField label="Difficulty">
              <input
                readOnly={isReadOnly}
                value={form.difficulty}
                onChange={(event) => onUpdate("difficulty", event.target.value)}
                className={inputClassName}
                placeholder="Moderate"
              />
            </FormField>

            <FormField label="Best Season">
              <input
                readOnly={isReadOnly}
                value={form.bestSeason}
                onChange={(event) => onUpdate("bestSeason", event.target.value)}
                className={inputClassName}
                placeholder="October to March"
              />
            </FormField>

            <FormField label="Expert ID">
              <Select
                disabled={isReadOnly}
                name="expertId"
                value={form.expertId}
                onValueChange={(value) =>
                  onUpdate(
                    "expertId",
                    value === "clear-expert" ? "" : String(value || "")
                  )
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue placeholder="Select expert" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear-expert">No expert assigned</SelectItem>
                  {experts.length ? (
                    experts.map((expert) => (
                      <SelectItem key={expert.id} value={expert.expertId}>
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {expert.expertId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {expert.fullName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-experts">
                      No experts available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField className="sm:col-span-2" label="Description">
              <textarea
                readOnly={isReadOnly}
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                className={cn(textareaClassName, "min-h-36")}
                placeholder="Detailed tour description."
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Inclusions">
              <textarea
                readOnly={isReadOnly}
                value={form.inclusions}
                onChange={(event) => onUpdate("inclusions", event.target.value)}
                className={textareaClassName}
                placeholder="Accommodation, guide, breakfast"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Exclusions">
              <textarea
                readOnly={isReadOnly}
                value={form.exclusions}
                onChange={(event) => onUpdate("exclusions", event.target.value)}
                className={textareaClassName}
                placeholder="Flights, personal expenses, optional activities"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Notes">
              <textarea
                readOnly={isReadOnly}
                value={form.notes}
                onChange={(event) => onUpdate("notes", event.target.value)}
                className={textareaClassName}
                placeholder="Internal notes for operations."
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Thumbnail Image">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingThumbnailImage}
                  label="Upload thumbnail image"
                  onFilesSelected={onThumbnailImageUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={
                  form.thumbnailImage.trim() ? [form.thumbnailImage.trim()] : []
                }
                onRemove={!isReadOnly ? onRemoveThumbnailImage : undefined}
                variant="thumbnail"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Banner Image">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingBannerImage}
                  label="Upload banner image"
                  onFilesSelected={onBannerImageUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={form.bannerImage.trim() ? [form.bannerImage.trim()] : []}
                onRemove={!isReadOnly ? onRemoveBannerImage : undefined}
                variant="banner"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Gallery Photos">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingGalleryImages}
                  label="Upload gallery photos"
                  multiple
                  onFilesSelected={onGalleryImagesUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={parseTextList(form.galleryImages)}
                onRemove={!isReadOnly ? onRemoveGalleryImage : undefined}
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Video">
              {!isReadOnly ? (
                <UploadField
                  accept="video/mp4,video/quicktime,video/webm"
                  disabled={isBusy}
                  isUploading={isUploadingVideo}
                  label="Upload video"
                  onFilesSelected={onVideoUpload}
                />
              ) : null}
              <VideoPreview
                source={form.video}
                onRemove={!isReadOnly ? onRemoveVideo : undefined}
              />
            </FormField>
          </div>

          {!isReadOnly ? (
            <div className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </div>
          ) : null}
        </form>
    </section>
  );
}

function DepartureFormDialog({
  form,
  isBusy,
  isOpen,
  isSaving,
  mode,
  onClose,
  onSubmit,
  onUpdate,
  tours,
}: {
  form: DepartureFormState;
  isBusy: boolean;
  isOpen: boolean;
  isSaving: boolean;
  mode: DepartureSheetMode | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof DepartureFormState>(
    field: K,
    value: DepartureFormState[K]
  ) => void;
  tours: AdminTour[];
}) {
  const isReadOnly = mode === "view";
  const panelTitle =
    mode === "edit"
      ? "Edit Departure"
      : mode === "view"
        ? "View Departure"
        : "Add Departure";
  const panelDescription =
    mode === "edit"
      ? "Update the tour departure details."
      : mode === "view"
        ? "Review the tour departure details."
        : "Add a scheduled tour departure.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : mode === "edit"
      ? "Update Departure"
      : "Save Departure";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const isComingSoon = form.status === "coming_soon";

  function updateChildPricingRule<
    TField extends keyof DepartureFormState["childPricingRules"][number],
  >(
    index: number,
    field: TField,
    value: DepartureFormState["childPricingRules"][number][TField]
  ) {
    onUpdate(
      "childPricingRules",
      form.childPricingRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      )
    );
  }

  function addChildPricingRule() {
    onUpdate("childPricingRules", [
      ...form.childPricingRules,
      {
        minAge: "0",
        maxAge: "11",
        allowExtraBed: true,
        allowWithoutExtraBed: true,
      },
    ]);
  }

  function removeChildPricingRule(index: number) {
    onUpdate(
      "childPricingRules",
      form.childPricingRules.filter((_rule, ruleIndex) => ruleIndex !== index)
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-col bg-white"
        >
          <div className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {panelTitle}
                </h2>
                <p className="mt-1 text-xs text-foreground/55">
                  {panelDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="grid size-8 shrink-0 place-items-center rounded-sm border border-emerald-600 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close departure form"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-5 px-7 py-6 sm:grid-cols-2">
            <FormField label="Departure ID" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.departureId}
                onChange={(event) =>
                  onUpdate("departureId", event.target.value)
                }
                className={inputClassName}
                placeholder="AT-DEP-001"
              />
            </FormField>

            <FormField label="Tour ID" required>
              <Select
                disabled={isReadOnly || tours.length === 0}
                name="tourId"
                required
                value={form.tourId}
                onValueChange={(value) =>
                  onUpdate("tourId", String(value || ""))
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue
                    placeholder={
                      tours.length ? "Select tour" : "No tours available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tours.length ? (
                    tours.map((tour) => (
                      <SelectItem key={tour.id} value={tour.tourId}>
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {tour.tourId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {tour.tourName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-tours">
                      No tours available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Destination ID">
              <input
                readOnly={isReadOnly}
                value={form.destinationId}
                onChange={(event) =>
                  onUpdate("destinationId", event.target.value)
                }
                className={inputClassName}
                placeholder="Leave blank to use tour destination"
              />
            </FormField>

            <FormField label="Departure Status">
              <Select
                disabled={isReadOnly}
                value={form.status}
                onValueChange={(value) =>
                  onUpdate(
                    "status",
                    String(value || "scheduled") as DepartureFormState["status"]
                  )
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="coming_soon">Coming Soon</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Departure Date" required={!isComingSoon}>
              <DatePicker
                required={!isComingSoon}
                readOnly={isReadOnly}
                value={form.departureDate}
                onChange={(value) => onUpdate("departureDate", value)}
                triggerClassName={inputClassName}
              />
            </FormField>

            <FormField label="Return Date" required={!isComingSoon}>
              <DatePicker
                required={!isComingSoon}
                readOnly={isReadOnly}
                value={form.returnDate}
                onChange={(value) => onUpdate("returnDate", value)}
                triggerClassName={inputClassName}
              />
            </FormField>

            <FormField label="Seats Available">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.seatsAvailable}
                onChange={(event) =>
                  onUpdate("seatsAvailable", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Adult Price">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.priceAdult}
                onChange={(event) => onUpdate("priceAdult", event.target.value)}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Extra Bed Price">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.priceExtraBed}
                onChange={(event) =>
                  onUpdate("priceExtraBed", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Child Without Extra Bed Price">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.priceChildWithoutExtraBed}
                onChange={(event) =>
                  onUpdate("priceChildWithoutExtraBed", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Single Occupancy Price">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.singleOccupancy}
                onChange={(event) =>
                  onUpdate("singleOccupancy", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Deposit Type">
              <Select
                disabled={isReadOnly}
                value={form.depositType}
                onValueChange={(value) =>
                  onUpdate(
                    "depositType",
                    String(value || "fixed") as DepartureFormState["depositType"]
                  )
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Deposit Value">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.depositValue}
                onChange={(event) =>
                  onUpdate("depositValue", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Deposit Applies To">
              <Select
                disabled={isReadOnly}
                value={form.depositAppliesTo}
                onValueChange={(value) =>
                  onUpdate(
                    "depositAppliesTo",
                    String(value || "per_person") as DepartureFormState["depositAppliesTo"]
                  )
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_person">Per Person</SelectItem>
                  <SelectItem value="per_booking">Per Booking</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Balance Due Days Before">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.balanceDueDaysBefore}
                onChange={(event) =>
                  onUpdate("balanceDueDaysBefore", event.target.value)
                }
                className={inputClassName}
              />
            </FormField>

            <FormField label="Booking Deadline" required={!isComingSoon}>
              <DatePicker
                required={!isComingSoon}
                readOnly={isReadOnly}
                value={form.bookingDeadline}
                onChange={(value) => onUpdate("bookingDeadline", value)}
                triggerClassName={inputClassName}
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Early Bird Offer">
              <textarea
                readOnly={isReadOnly}
                value={form.earlyBirdOffer}
                onChange={(event) =>
                  onUpdate("earlyBirdOffer", event.target.value)
                }
                className={textareaClassName}
                placeholder="Early booking discount details."
              />
            </FormField>

            <div className="grid gap-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-normal text-foreground/55">
                  Child Pricing Rules
                </h3>
                {!isReadOnly ? (
                  <Button
                    type="button"
                    onClick={addChildPricingRule}
                    variant="outline"
                    className="h-9 rounded-sm px-3 text-xs font-bold"
                  >
                    <Plus className="size-4" data-icon="inline-start" />
                    Add Rule
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-3 rounded-sm border border-border bg-muted/15 p-3 sm:grid-cols-4">
                <FormField label="Allow Bed Sharing">
                  <label className="flex h-11 items-center gap-2 rounded-sm border border-border bg-white px-3 text-sm font-semibold text-foreground/70">
                    <input
                      checked={form.roomPolicy.allowChildBedSharing}
                      disabled={isReadOnly}
                      type="checkbox"
                      onChange={(event) =>
                        onUpdate("roomPolicy", {
                          ...form.roomPolicy,
                          allowChildBedSharing: event.target.checked,
                        })
                      }
                      className="size-4 rounded-sm border-border accent-primary"
                    />
                    Enabled
                  </label>
                </FormField>

                <FormField label="Max Shared Children / Room">
                  <input
                    min={0}
                    readOnly={isReadOnly}
                    type="number"
                    value={form.roomPolicy.maxChildrenWithoutExtraBedPerRoom}
                    onChange={(event) =>
                      onUpdate("roomPolicy", {
                        ...form.roomPolicy,
                        maxChildrenWithoutExtraBedPerRoom: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </FormField>

                <FormField label="Allow Extra Bed">
                  <label className="flex h-11 items-center gap-2 rounded-sm border border-border bg-white px-3 text-sm font-semibold text-foreground/70">
                    <input
                      checked={form.roomPolicy.allowExtraBed}
                      disabled={isReadOnly}
                      type="checkbox"
                      onChange={(event) =>
                        onUpdate("roomPolicy", {
                          ...form.roomPolicy,
                          allowExtraBed: event.target.checked,
                        })
                      }
                      className="size-4 rounded-sm border-border accent-primary"
                    />
                    Enabled
                  </label>
                </FormField>

                <FormField label="Child Single Room">
                  <label className="flex h-11 items-center gap-2 rounded-sm border border-border bg-white px-3 text-sm font-semibold text-foreground/70">
                    <input
                      checked={form.roomPolicy.allowChildSingleRoom}
                      disabled={isReadOnly}
                      type="checkbox"
                      onChange={(event) =>
                        onUpdate("roomPolicy", {
                          ...form.roomPolicy,
                          allowChildSingleRoom: event.target.checked,
                        })
                      }
                      className="size-4 rounded-sm border-border accent-primary"
                    />
                    Enabled
                  </label>
                </FormField>
              </div>

              {form.childPricingRules.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border bg-muted/25 px-3 py-4 text-xs font-semibold text-foreground/50">
                  No child pricing rules configured.
                </div>
              ) : null}

              {form.childPricingRules.map((rule, index) => (
                <div
                  key={`child-rule-${index}`}
                  className="grid gap-3 rounded-sm border border-border bg-muted/15 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <FormField label="Minimum Age">
                    <input
                      min={0}
                      readOnly={isReadOnly}
                      type="number"
                      value={rule.minAge}
                      onChange={(event) =>
                        updateChildPricingRule(index, "minAge", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </FormField>

                  <FormField label="Maximum Age">
                    <input
                      min={0}
                      readOnly={isReadOnly}
                      type="number"
                      value={rule.maxAge}
                      onChange={(event) =>
                        updateChildPricingRule(index, "maxAge", event.target.value)
                      }
                      className={inputClassName}
                    />
                  </FormField>

                  <FormField label="Allowed Bed Modes">
                    <div className="grid min-h-11 gap-2 rounded-sm border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground/70">
                      <label className="flex items-center gap-2">
                        <input
                          checked={rule.allowExtraBed}
                          disabled={isReadOnly}
                          type="checkbox"
                          onChange={(event) =>
                            updateChildPricingRule(
                              index,
                              "allowExtraBed",
                              event.target.checked
                            )
                          }
                          className="size-4 rounded-sm border-border accent-primary"
                        />
                        Extra bed
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          checked={rule.allowWithoutExtraBed}
                          disabled={isReadOnly}
                          type="checkbox"
                          onChange={(event) =>
                            updateChildPricingRule(
                              index,
                              "allowWithoutExtraBed",
                              event.target.checked
                            )
                          }
                          className="size-4 rounded-sm border-border accent-primary"
                        />
                        Without extra bed
                      </label>
                    </div>
                  </FormField>

                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={() => removeChildPricingRule(index)}
                      className="mt-6 grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-destructive hover:text-destructive"
                      aria-label={`Remove child pricing rule ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {!isReadOnly ? (
            <div className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </div>
          ) : null}
        </form>
    </section>
  );
}

function ItineraryFormDialog({
  form,
  isBusy,
  isOpen,
  isSaving,
  mode,
  onAddDay,
  onClose,
  onRemoveDay,
  onSubmit,
  onUpdate,
  onUpdateDay,
  tours,
}: {
  form: ItineraryFormState;
  isBusy: boolean;
  isOpen: boolean;
  isSaving: boolean;
  mode: ItinerarySheetMode | null;
  onAddDay: () => void;
  onClose: () => void;
  onRemoveDay: (dayIndex: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ItineraryFormState>(
    field: K,
    value: ItineraryFormState[K]
  ) => void;
  onUpdateDay: (
    dayIndex: number,
    field: keyof ItineraryDayFormState,
    value: string
  ) => void;
  tours: AdminTour[];
}) {
  const isReadOnly = mode === "view";
  const panelTitle =
    mode === "edit"
      ? "Edit Itinerary"
      : mode === "view"
        ? "View Itinerary"
        : "Add Itinerary";
  const panelDescription =
    mode === "edit"
      ? "Update the linked tour itinerary."
      : mode === "view"
        ? "Review the linked tour itinerary."
        : "Add an itinerary and daily plan for a tour.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : mode === "edit"
      ? "Update Itinerary"
      : "Save Itinerary";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  if (!isOpen) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-col bg-white"
        >
          <div className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {panelTitle}
                </h2>
                <p className="mt-1 text-xs text-foreground/55">
                  {panelDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="grid size-8 shrink-0 place-items-center rounded-sm border border-emerald-600 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close itinerary form"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-5 px-7 py-6 sm:grid-cols-2">
            <FormField label="Tour ID" required>
              <Select
                disabled={isReadOnly || tours.length === 0}
                name="itineraryTourId"
                required
                value={form.tourId}
                onValueChange={(value) =>
                  onUpdate("tourId", String(value || ""))
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue
                    placeholder={
                      tours.length ? "Select tour" : "No tours available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tours.length ? (
                    tours.map((tour) => (
                      <SelectItem key={tour.id} value={tour.tourId}>
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {tour.tourId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {tour.tourName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-itinerary-tours">
                      No tours available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField className="sm:col-span-2" label="Itinerary Summary" required>
              <textarea
                required
                readOnly={isReadOnly}
                value={form.itinerarySummary}
                onChange={(event) =>
                  onUpdate("itinerarySummary", event.target.value)
                }
                className={textareaClassName}
                placeholder="Short overview of the full itinerary."
              />
            </FormField>

            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-normal text-foreground/55">
                Days
              </h3>
              {!isReadOnly ? (
                <Button
                  type="button"
                  onClick={onAddDay}
                  disabled={isBusy}
                  variant="outline"
                  className="h-9 rounded-sm px-3 text-xs font-bold"
                >
                  <Plus className="size-4" data-icon="inline-start" />
                  Add Day
                </Button>
              ) : null}
            </div>

            {form.days.map((day, index) => (
              <div
                key={`itinerary-day-${index}`}
                className="grid gap-4 rounded-sm border border-border bg-muted/15 p-4 sm:col-span-2 sm:grid-cols-2"
              >
                <div className="flex items-center justify-between gap-3 sm:col-span-2">
                  <h4 className="text-sm font-bold text-foreground">
                    Day {index + 1}
                  </h4>
                  {!isReadOnly && form.days.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveDay(index)}
                      disabled={isBusy}
                      className="grid size-8 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-destructive hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                      aria-label={`Remove day ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>

                <FormField label="Day Number" required>
                  <input
                    required
                    min={1}
                    readOnly={isReadOnly}
                    type="number"
                    value={day.dayNumber}
                    onChange={(event) =>
                      onUpdateDay(index, "dayNumber", event.target.value)
                    }
                    className={inputClassName}
                  />
                </FormField>

                <FormField label="Title" required>
                  <input
                    required
                    readOnly={isReadOnly}
                    value={day.title}
                    onChange={(event) =>
                      onUpdateDay(index, "title", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Arrival and heritage walk"
                  />
                </FormField>

                <FormField className="sm:col-span-2" label="Summary">
                  <textarea
                    readOnly={isReadOnly}
                    value={day.summary}
                    onChange={(event) =>
                      onUpdateDay(index, "summary", event.target.value)
                    }
                    className={textareaClassName}
                    placeholder="Day-wise experience summary."
                  />
                </FormField>

                <FormField
                  className="sm:col-span-2"
                  label="Places Visited / Highlights"
                >
                  <textarea
                    readOnly={isReadOnly}
                    value={day.placesVisited}
                    onChange={(event) =>
                      onUpdateDay(index, "placesVisited", event.target.value)
                    }
                    className={textareaClassName}
                    placeholder="Add one place or highlight per line."
                  />
                </FormField>

                <FormField label="Transport">
                  <input
                    readOnly={isReadOnly}
                    value={day.transport}
                    onChange={(event) =>
                      onUpdateDay(index, "transport", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Coach, train, walk"
                  />
                </FormField>

                <FormField label="Walking / Difficulty">
                  <input
                    readOnly={isReadOnly}
                    value={day.walkingDifficulty}
                    onChange={(event) =>
                      onUpdateDay(index, "walkingDifficulty", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Easy walking"
                  />
                </FormField>

                <FormField className="sm:col-span-2" label="Meals">
                  <textarea
                    readOnly={isReadOnly}
                    value={day.meals}
                    onChange={(event) =>
                      onUpdateDay(index, "meals", event.target.value)
                    }
                    className={textareaClassName}
                    placeholder="Breakfast, lunch, dinner notes."
                  />
                </FormField>
              </div>
            ))}
          </div>

          {!isReadOnly ? (
            <div className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </div>
          ) : null}
        </form>
    </section>
  );
}

function DatePicker({
  onChange,
  readOnly = false,
  required = false,
  triggerClassName,
  value,
}: {
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  triggerClassName?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateInputValue(value);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!readOnly) {
          setIsOpen(open);
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={readOnly}
        aria-required={required}
        className={cn(
          triggerClassName,
          "flex w-full items-center justify-between gap-3 text-left font-medium",
          !value && "text-foreground/45"
        )}
      >
        <span>{formatDatePickerValue(value)}</span>
        <CalendarDays className="size-4 shrink-0 text-foreground/55" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="p-3">
        <Calendar
          key={value || "empty-date"}
          selected={selectedDate}
          onSelect={(date) => {
            onChange(dateToInputValue(date));
            setIsOpen(false);
          }}
          onClear={() => {
            onChange("");
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ImagePreviewGrid({
  images,
  onRemove,
  variant = "gallery",
}: {
  images: string[];
  onRemove?: (index: number) => void;
  variant?: "banner" | "gallery" | "thumbnail";
}) {
  const isGallery = variant === "gallery";
  const imageLabel = variant === "banner" ? "banner" : "thumbnail";
  const previewImages = isGallery ? images : images.slice(0, 1);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45",
          isGallery ? "h-20" : "h-28"
        )}
      >
        Preview will appear here
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        isGallery ? "grid-cols-3" : "grid-cols-1"
      )}
    >
      {previewImages.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className={cn(
            "relative overflow-hidden rounded-sm border border-border bg-muted",
            variant === "banner" ? "h-32" : isGallery ? "h-20" : "h-28"
          )}
        >
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              aria-label={
                isGallery
                  ? `Remove gallery photo ${index + 1}`
                  : `Remove ${imageLabel} image`
              }
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <div
            className="h-full w-full bg-cover bg-center"
            role="img"
            aria-label={
              isGallery
                ? `Tour gallery preview ${index + 1}`
                : `Tour ${imageLabel} preview`
            }
            style={{
              backgroundImage: `url("${getTourMediaUrl(image)}")`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function VideoPreview({
  onRemove,
  source,
}: {
  onRemove?: () => void;
  source: string;
}) {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return (
      <div className="grid h-28 place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45">
        <span className="inline-flex items-center gap-2">
          <Play className="size-4" />
          Preview will appear here
        </span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-muted">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
          aria-label="Remove tour video"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <video
        className="aspect-video w-full bg-black object-cover"
        controls
        preload="metadata"
        src={getTourMediaUrl(trimmedSource)}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function UploadField({
  accept,
  disabled,
  isUploading,
  label,
  multiple,
  onFilesSelected,
}: {
  accept: string;
  disabled: boolean;
  isUploading: boolean;
  label: string;
  multiple?: boolean;
  onFilesSelected: (files: FileList | null) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-primary/30 bg-primary/5 px-3 text-sm font-bold text-primary transition-colors hover:border-primary hover:bg-primary/10",
        disabled && "pointer-events-none cursor-not-allowed opacity-60"
      )}
    >
      <Upload className="size-4 shrink-0" />
      <span>{isUploading ? "Uploading..." : label}</span>
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        multiple={multiple}
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.target.value = "";
        }}
        type="file"
      />
    </label>
  );
}

function FormField({
  children,
  className,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="text-xs font-bold uppercase tracking-normal text-foreground/55">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function DestinationMultiSelect({
  destinations,
  disabled,
  onChange,
  value,
}: {
  destinations: AdminDestination[];
  disabled: boolean;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIds = normalizeDestinationIds(value);
  const selectedIdSet = new Set(selectedIds);
  const placeholder = destinations.length
    ? "Select destinations"
    : "No destinations available";

  function toggleDestination(destinationId: string) {
    if (disabled) {
      return;
    }

    if (selectedIdSet.has(destinationId)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== destinationId));
      return;
    }

    onChange([...selectedIds, destinationId]);
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!disabled) {
          setIsOpen(open);
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-border bg-white px-3 py-2 text-left text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 data-[popup-open]:border-primary data-[popup-open]:ring-3 data-[popup-open]:ring-primary/15 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60"
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {selectedIds.length > 0 ? (
            selectedIds.map((destinationId) => (
              <span
                key={destinationId}
                className="rounded-sm bg-primary/10 px-2 py-1 text-xs font-bold text-primary"
              >
                {destinationId}
              </span>
            ))
          ) : (
            <span className="truncate text-sm font-semibold text-foreground/45">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-foreground/65 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </PopoverTrigger>
      {destinations.length > 0 ? (
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-(--anchor-width) min-w-72 overflow-hidden p-0"
        >
          <div className="grid max-h-56 gap-1 overflow-y-auto p-2">
          {destinations.map((destination) => {
            const isSelected = selectedIdSet.has(destination.destinationId);

            return (
              <label
                key={destination.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-primary/5",
                  disabled && "cursor-default hover:bg-transparent",
                  isSelected && "bg-primary/10"
                )}
              >
                <input
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() =>
                    toggleDestination(destination.destinationId)
                  }
                  type="checkbox"
                  className="size-4 rounded-sm border-border accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-foreground">
                    {destination.destinationId}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-foreground/55">
                    {destination.destinationName}
                  </span>
                </span>
              </label>
            );
          })}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

function PaginationButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-sm border border-border bg-white text-xs font-bold text-foreground/60 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-45",
        active && "border-primary bg-primary text-white hover:text-white"
      )}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
