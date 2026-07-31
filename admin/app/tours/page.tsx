"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  Search,
  Ticket,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  deleteAdminTour,
  deleteAdminTourDeparture,
  listAdminTourDepartures,
  listAdminTours,
  updateAdminTour,
  updateAdminTourDeparture,
  type AdminTour,
  type AdminTourDeparture,
  type TourDeparturePayload,
  type TourPayload,
} from "@/lib/tours";
import { cn } from "@/lib/utils";

type TourTab = "master" | "departures";
type TourSheetMode = "add" | "view" | "edit";
type DepartureSheetMode = "add" | "view" | "edit";

type TourMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
  trendTone: string;
};

type TourFormState = Omit<TourPayload, "inclusions" | "exclusions"> & {
  inclusions: string;
  exclusions: string;
};

type DepartureFormState = Omit<
  TourDeparturePayload,
  | "seatsAvailable"
  | "priceAdult"
  | "priceChild"
  | "singleOccupancy"
  | "depositValue"
  | "balanceDueDaysBefore"
> & {
  seatsAvailable: string;
  priceAdult: string;
  priceChild: string;
  singleOccupancy: string;
  depositValue: string;
  balanceDueDaysBefore: string;
};

const emptyTourForm: TourFormState = {
  tourId: "",
  tourName: "",
  tourType: "",
  destinationId: "",
  durationDn: "",
  category: "",
  difficulty: "",
  bestSeason: "",
  description: "",
  inclusions: "",
  exclusions: "",
  expertId: "",
  notes: "",
};

const emptyDepartureForm: DepartureFormState = {
  departureId: "",
  tourId: "",
  destinationId: "",
  departureDate: "",
  returnDate: "",
  seatsAvailable: "0",
  priceAdult: "0",
  priceChild: "0",
  singleOccupancy: "0",
  depositType: "",
  depositValue: "0",
  balanceDueDaysBefore: "0",
  earlyBirdOffer: "",
  bookingDeadline: "",
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

function createTourPayload(form: TourFormState): TourPayload {
  return {
    tourId: form.tourId.trim(),
    tourName: form.tourName.trim(),
    tourType: form.tourType.trim(),
    destinationId: form.destinationId.trim(),
    durationDn: form.durationDn.trim(),
    category: form.category.trim(),
    difficulty: form.difficulty.trim(),
    bestSeason: form.bestSeason.trim(),
    description: form.description.trim(),
    inclusions: parseTextList(form.inclusions),
    exclusions: parseTextList(form.exclusions),
    expertId: form.expertId.trim(),
    notes: form.notes.trim(),
  };
}

function createDeparturePayload(
  form: DepartureFormState
): TourDeparturePayload {
  return {
    departureId: form.departureId.trim(),
    tourId: form.tourId.trim(),
    destinationId: form.destinationId.trim(),
    departureDate: form.departureDate,
    returnDate: form.returnDate,
    seatsAvailable: Number(form.seatsAvailable) || 0,
    priceAdult: Number(form.priceAdult) || 0,
    priceChild: Number(form.priceChild) || 0,
    singleOccupancy: Number(form.singleOccupancy) || 0,
    depositType: form.depositType.trim(),
    depositValue: Number(form.depositValue) || 0,
    balanceDueDaysBefore: Number(form.balanceDueDaysBefore) || 0,
    earlyBirdOffer: form.earlyBirdOffer.trim(),
    bookingDeadline: form.bookingDeadline,
  };
}

function tourToForm(tour: AdminTour): TourFormState {
  return {
    tourId: tour.tourId,
    tourName: tour.tourName,
    tourType: tour.tourType,
    destinationId: tour.destinationId,
    durationDn: tour.durationDn,
    category: tour.category,
    difficulty: tour.difficulty,
    bestSeason: tour.bestSeason,
    description: tour.description,
    inclusions: tour.inclusions.join("\n"),
    exclusions: tour.exclusions.join("\n"),
    expertId: tour.expertId,
    notes: tour.notes,
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
    priceChild: departure.priceChild.toString(),
    singleOccupancy: departure.singleOccupancy.toString(),
    depositType: departure.depositType,
    depositValue: departure.depositValue.toString(),
    balanceDueDaysBefore: departure.balanceDueDaysBefore.toString(),
    earlyBirdOffer: departure.earlyBirdOffer,
    bookingDeadline: formatDateInput(departure.bookingDeadline),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return formatDateWithDashes(date);
}

function formatDateInput(value: string): string {
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

function createTourMetrics(
  tours: AdminTour[],
  departures: AdminTourDeparture[]
): TourMetric[] {
  const seatsAvailable = departures.reduce(
    (total, departure) => total + departure.seatsAvailable,
    0
  );
  const upcomingDepartures = departures.filter(
    (departure) => new Date(departure.departureDate).getTime() >= Date.now()
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
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TourTab>("master");
  const [searchQuery, setSearchQuery] = useState("");
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [departures, setDepartures] = useState<AdminTourDeparture[]>([]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [experts, setExperts] = useState<AdminExpert[]>([]);
  const [isLoadingTours, setIsLoadingTours] = useState(true);
  const [tourSheetMode, setTourSheetMode] = useState<TourSheetMode | null>(null);
  const [departureSheetMode, setDepartureSheetMode] =
    useState<DepartureSheetMode | null>(null);
  const [selectedTour, setSelectedTour] = useState<AdminTour | null>(null);
  const [selectedDeparture, setSelectedDeparture] =
    useState<AdminTourDeparture | null>(null);
  const [tourForm, setTourForm] = useState<TourFormState>(emptyTourForm);
  const [departureForm, setDepartureForm] =
    useState<DepartureFormState>(emptyDepartureForm);
  const [isSavingTour, setIsSavingTour] = useState(false);
  const [isSavingDeparture, setIsSavingDeparture] = useState(false);
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
          destinationsResponse,
          expertsResponse,
        ] = await Promise.all([
          listAdminTours(),
          listAdminTourDepartures(),
          listAdminDestinations(),
          listAdminExperts(),
        ]);

        if (isMounted) {
          setTours(toursResponse.data.tours);
          setDepartures(departuresResponse.data.departures);
          setDestinations(destinationsResponse.data.destinations);
          setExperts(expertsResponse.data.experts);
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
  }, [toast]);

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
        departure.destinationId,
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

  function updateTourForm<K extends keyof TourFormState>(
    field: K,
    value: TourFormState[K]
  ) {
    setTourForm((currentForm) => ({
      ...currentForm,
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
      ...(field === "tourId"
        ? {
            destinationId:
              tours.find(
                (tour) =>
                  tour.tourId === String(value).trim().toUpperCase()
              )?.destinationId || currentForm.destinationId,
          }
        : {}),
    }));
  }

  function openAddTourSheet() {
    setSelectedTour(null);
    setTourForm(emptyTourForm);
    setTourSheetMode("add");
  }

  function openViewTourSheet(tour: AdminTour) {
    setSelectedTour(tour);
    setTourForm(tourToForm(tour));
    setTourSheetMode("view");
  }

  function openEditTourSheet(tour: AdminTour) {
    setSelectedTour(tour);
    setTourForm(tourToForm(tour));
    setTourSheetMode("edit");
  }

  function closeTourSheet() {
    if (isSavingTour) {
      return;
    }

    setTourSheetMode(null);
    setSelectedTour(null);
    setTourForm(emptyTourForm);
  }

  function openAddDepartureSheet() {
    setSelectedDeparture(null);
    setDepartureForm(emptyDepartureForm);
    setDepartureSheetMode("add");
  }

  function openViewDepartureSheet(departure: AdminTourDeparture) {
    setSelectedDeparture(departure);
    setDepartureForm(departureToForm(departure));
    setDepartureSheetMode("view");
  }

  function openEditDepartureSheet(departure: AdminTourDeparture) {
    setSelectedDeparture(departure);
    setDepartureForm(departureToForm(departure));
    setDepartureSheetMode("edit");
  }

  function closeDepartureSheet() {
    if (isSavingDeparture) {
      return;
    }

    setDepartureSheetMode(null);
    setSelectedDeparture(null);
    setDepartureForm(emptyDepartureForm);
  }

  async function handleSaveTour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (tourSheetMode === "view") {
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
        return;
      }

      const response = await createAdminTour(payload);

      setTours((currentTours) => [response.data.tour, ...currentTours]);
      setTourSheetMode(null);
      setSelectedTour(null);
      setTourForm(emptyTourForm);
      toast.success("Tour added", response.message);
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

  const addButtonLabel =
    activeTab === "master" ? "Add New Tour" : "Add New Departure";

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
            onClick={
              activeTab === "master" ? openAddTourSheet : openAddDepartureSheet
            }
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
              onView={openViewTourSheet}
              totalCount={tours.length}
              tours={filteredTours}
            />
          ) : (
            <TourDepartureTable
              destinationNameById={destinationNameById}
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
        isBusy={isSavingTour}
        isOpen={tourSheetMode !== null}
        isSaving={isSavingTour}
        mode={tourSheetMode}
        onClose={closeTourSheet}
        onSubmit={handleSaveTour}
        onUpdate={updateTourForm}
      />

      <DepartureFormDialog
        destinations={destinations}
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
    activeTab === "master" ? "Search tours..." : "Search departures...";

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

        <HeaderDateRangePicker />

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
    activeTab === "master" ? "Search tours..." : "Search departures...";

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
              <th className="px-2 py-3 font-bold">Destination ID</th>
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
              ? tours.map((tour) => (
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
                        <TourThumb />
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
                      data-label="Destination ID"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {tour.destinationId}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {destinationNameById.get(tour.destinationId) || "-"}
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
                        onView={() => onView(tour)}
                      />
                    </td>
                  </tr>
                ))
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
  destinationNameById,
  departures,
  isDeletingDepartureId,
  isLoading,
  onDelete,
  onEdit,
  onView,
  totalCount,
  tourNameById,
}: {
  destinationNameById: Map<string, string>;
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
              <th className="px-2 py-3 font-bold">Tour / Destination</th>
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
                      data-label="Tour / Destination"
                      data-mobile-primary
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {departure.tourId}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {tourNameById.get(departure.tourId) || "-"}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {departure.destinationId || "-"}
                        {departure.destinationId
                          ? ` · ${
                              destinationNameById.get(departure.destinationId) ||
                              "-"
                            }`
                          : ""}
                      </span>
                    </td>
                    <td
                      data-label="Dates"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {formatDate(departure.departureDate)}
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
                        {formatCurrency(departure.priceAdult)}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        Child {formatCurrency(departure.priceChild)}
                      </span>
                    </td>
                    <td
                      data-label="Deposit"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {departure.depositType || "-"}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {formatCurrency(departure.depositValue)}
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

function TourThumb() {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-[#7a3b22] text-white">
      <MapPin className="size-5" />
    </span>
  );
}

function TourActionsMenu({
  itemName,
  isDeleting,
  onDelete,
  onEdit,
  onView,
}: {
  itemName: string;
  isDeleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
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
  mode,
  onClose,
  onSubmit,
  onUpdate,
}: {
  destinations: AdminDestination[];
  experts: AdminExpert[];
  form: TourFormState;
  isBusy: boolean;
  isOpen: boolean;
  isSaving: boolean;
  mode: TourSheetMode | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof TourFormState>(
    field: K,
    value: TourFormState[K]
  ) => void;
}) {
  const isReadOnly = mode === "view";
  const sheetTitle =
    mode === "edit" ? "Edit Tour" : mode === "view" ? "View Tour" : "Add Tour";
  const sheetDescription =
    mode === "edit"
      ? "Update the tour master details."
      : mode === "view"
        ? "Review the tour master details."
        : "Add a tour master record.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : mode === "edit"
      ? "Update Tour"
      : "Save Tour";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-28 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l border-border bg-white p-0 shadow-2xl shadow-stone-900/20 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:w-full data-[side=right]:sm:max-w-[680px]"
      >
        <form
          onSubmit={onSubmit}
          className="flex h-full min-h-0 flex-col bg-white"
        >
          <SheetHeader className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {sheetTitle}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-foreground/55">
                  {sheetDescription}
                </SheetDescription>
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
          </SheetHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-7 py-6 sm:grid-cols-2">
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

            <FormField label="Destination ID" required>
              <Select
                disabled={isReadOnly || destinations.length === 0}
                name="destinationId"
                required
                value={form.destinationId}
                onValueChange={(value) =>
                  onUpdate("destinationId", String(value || ""))
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue
                    placeholder={
                      destinations.length
                        ? "Select destination"
                        : "No destinations available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.length ? (
                    destinations.map((destination) => (
                      <SelectItem
                        key={destination.id}
                        value={destination.destinationId}
                      >
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {destination.destinationId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {destination.destinationName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-destinations">
                      No destinations available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
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
          </div>

          {!isReadOnly ? (
            <SheetFooter className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </SheetFooter>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DepartureFormDialog({
  destinations,
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
  destinations: AdminDestination[];
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
  const sheetTitle =
    mode === "edit"
      ? "Edit Departure"
      : mode === "view"
        ? "View Departure"
        : "Add Departure";
  const sheetDescription =
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

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l border-border bg-white p-0 shadow-2xl shadow-stone-900/20 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:w-full data-[side=right]:sm:max-w-[680px]"
      >
        <form
          onSubmit={onSubmit}
          className="flex h-full min-h-0 flex-col bg-white"
        >
          <SheetHeader className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {sheetTitle}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-foreground/55">
                  {sheetDescription}
                </SheetDescription>
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
          </SheetHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-7 py-6 sm:grid-cols-2">
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

            <FormField label="Destination ID" required>
              <Select
                disabled={isReadOnly || destinations.length === 0}
                name="departureDestinationId"
                required
                value={form.destinationId}
                onValueChange={(value) =>
                  onUpdate("destinationId", String(value || ""))
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue
                    placeholder={
                      destinations.length
                        ? "Select destination"
                        : "No destinations available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.length ? (
                    destinations.map((destination) => (
                      <SelectItem
                        key={destination.id}
                        value={destination.destinationId}
                      >
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {destination.destinationId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {destination.destinationName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-departure-destinations">
                      No destinations available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Departure Date" required>
              <DatePicker
                required
                readOnly={isReadOnly}
                value={form.departureDate}
                onChange={(value) => onUpdate("departureDate", value)}
                triggerClassName={inputClassName}
              />
            </FormField>

            <FormField label="Return Date" required>
              <DatePicker
                required
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

            <FormField label="Price (Adult)">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.priceAdult}
                onChange={(event) => onUpdate("priceAdult", event.target.value)}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Price (Child)">
              <input
                min={0}
                readOnly={isReadOnly}
                type="number"
                value={form.priceChild}
                onChange={(event) => onUpdate("priceChild", event.target.value)}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Single Occupancy">
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
              <input
                readOnly={isReadOnly}
                value={form.depositType}
                onChange={(event) => onUpdate("depositType", event.target.value)}
                className={inputClassName}
                placeholder="Fixed Amount"
              />
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

            <FormField label="Booking Deadline" required>
              <DatePicker
                required
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
          </div>

          {!isReadOnly ? (
            <SheetFooter className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </SheetFooter>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
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
