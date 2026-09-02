"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDot,
  FileText,
  MapPin,
  Plus,
  Save,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getDestinationMediaUrl,
  listAdminDestinations,
  type AdminDestination,
} from "@/lib/destinations";
import {
  getExperienceMediaUrl,
  listAdminExperiences,
  type AdminExperience,
} from "@/lib/experiences";
import {
  getAdminHomePage,
  getDefaultDestinationMarker,
  updateAdminHomePage,
  type HomePageContent,
  type HomePagePayload,
} from "@/lib/home";
import {
  getTourMediaUrl,
  listAdminTourDepartures,
  listAdminTours,
  type AdminTour,
  type AdminTourDeparture,
} from "@/lib/tours";
import { cn } from "@/lib/utils";

type HomeFormState = HomePagePayload;

const CUSTOMISED_TOUR_DESTINATION_LIMIT = 6;

const emptyForm: HomeFormState = {
  upcomingTours: [],
  trendingDestinations: [],
  customisedTourDestinations: [],
  homeExperiences: [],
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    Array.isArray((error as { details?: unknown }).details)
  ) {
    return (error as { details: Array<{ path?: string; message?: string }> })
      .details.map((detail) =>
        [detail.path, detail.message].filter(Boolean).join(": ")
      )
      .filter(Boolean)
      .join(", ");
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function createFormState(
  content: HomePageContent
): HomeFormState {
  return {
    upcomingTours: [...content.upcomingTours]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(({ departureId, sortOrder, tourId }) => ({
        departureId,
        sortOrder,
        tourId,
      })),
    trendingDestinations: [...content.trendingDestinations]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(({ destinationId, markerX, markerY, sortOrder }) => ({
        destinationId,
        markerX,
        markerY,
        sortOrder,
      })),
    customisedTourDestinations: [
      ...(content.customisedTourDestinations || []),
    ]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(({ destinationId, sortOrder }) => ({
        destinationId,
        sortOrder,
      })),
    homeExperiences: [...(content.homeExperiences || [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(({ experienceId, sortOrder }) => ({
        experienceId,
        sortOrder,
      })),
  };
}

function createPayload(form: HomeFormState): HomePagePayload {
  return {
    upcomingTours: form.upcomingTours.map((tour, index) => ({
      ...tour,
      sortOrder: index,
    })),
    trendingDestinations: form.trendingDestinations.map((destination, index) => ({
      ...destination,
      markerX: clampPercent(destination.markerX),
      markerY: clampPercent(destination.markerY),
      sortOrder: index,
    })),
    customisedTourDestinations: form.customisedTourDestinations.map(
      (destination, index) => ({
        ...destination,
        sortOrder: index,
      })
    ),
    homeExperiences: form.homeExperiences.map((experience, index) => ({
      ...experience,
      sortOrder: index,
    })),
  };
}

function clampPercent(value: number) {
  if (Number.isNaN(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDefaultDepartureId(
  departures: AdminTourDeparture[],
  tourId: string
) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const tourDepartures = departures
    .filter((departure) => departure.tourId === tourId && departure.departureDate)
    .sort(
      (left, right) =>
        new Date(left.departureDate || "").getTime() -
        new Date(right.departureDate || "").getTime()
    );

  return (
    tourDepartures.find(
      (departure) =>
        new Date(departure.departureDate || "").getTime() >= today.getTime()
    ) || tourDepartures[0]
  )?.departureId || "";
}

export default function PagesHomePage() {
  const toast = useToast();
  const [form, setForm] = useState<HomeFormState>(emptyForm);
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [departures, setDepartures] = useState<AdminTourDeparture[]>([]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [experiences, setExperiences] = useState<AdminExperience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDestinationIndex, setActiveDestinationIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeEditor() {
      try {
        const [
          homeResponse,
          toursResponse,
          departuresResponse,
          destinationsResponse,
          experiencesResponse,
        ] =
          await Promise.all([
            getAdminHomePage(),
            listAdminTours(),
            listAdminTourDepartures(),
            listAdminDestinations(),
            listAdminExperiences(),
          ]);

        if (!isMounted) {
          return;
        }

        setForm(createFormState(homeResponse.data.home));
        setTours(toursResponse.data.tours);
        setDepartures(departuresResponse.data.departures);
        setDestinations(destinationsResponse.data.destinations);
        setExperiences(experiencesResponse.data.experiences);
      } catch (error) {
        toast.error("Unable to load home page", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadHomeEditor();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const publishedExperiences = useMemo(
    () =>
      experiences.filter((experience) => experience.status === "Published"),
    [experiences]
  );

  const overviewMetrics = useMemo(
    () => [
      {
        label: "Upcoming Tours",
        value: form.upcomingTours.length.toString(),
        detail: "Homepage tour cards",
        icon: CalendarDays,
      },
      {
        label: "Trending Destinations",
        value: form.trendingDestinations.length.toString(),
        detail: "Map and destination list",
        icon: MapPin,
      },
      {
        label: "Customised Tours",
        value: form.customisedTourDestinations.length.toString(),
        detail: "Destination cards",
        icon: MapPin,
      },
      {
        label: "Home Experiences",
        value: form.homeExperiences.length.toString(),
        detail: "Traveller stories",
        icon: Star,
      },
      {
        label: "Available Records",
        value: `${tours.length}/${destinations.length}/${publishedExperiences.length}`,
        detail: "Tours / destinations / experiences",
        icon: FileText,
      },
    ],
    [
      destinations.length,
      form.customisedTourDestinations.length,
      form.homeExperiences.length,
      form.trendingDestinations.length,
      form.upcomingTours.length,
      publishedExperiences.length,
      tours.length,
    ]
  );

  function updateUpcomingTour<
    K extends keyof HomeFormState["upcomingTours"][number],
  >(
    index: number,
    field: K,
    value: HomeFormState["upcomingTours"][number][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      upcomingTours: currentForm.upcomingTours.map((tour, tourIndex) =>
        tourIndex === index
          ? {
              ...tour,
              [field]: value,
              ...(field === "tourId"
                ? {
                    departureId: getDefaultDepartureId(
                      departures,
                      String(value)
                    ),
                  }
                : {}),
            }
          : tour
      ),
    }));
  }

  function updateTrendingDestination<
    K extends keyof HomeFormState["trendingDestinations"][number],
  >(
    index: number,
    field: K,
    value: HomeFormState["trendingDestinations"][number][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      trendingDestinations: currentForm.trendingDestinations.map(
        (destination, destinationIndex) =>
          destinationIndex === index
            ? {
                ...destination,
                [field]: value,
              }
            : destination
      ),
    }));
  }

  function updateCustomisedTourDestination<
    K extends keyof HomeFormState["customisedTourDestinations"][number],
  >(
    index: number,
    field: K,
    value: HomeFormState["customisedTourDestinations"][number][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      customisedTourDestinations: currentForm.customisedTourDestinations.map(
        (destination, destinationIndex) =>
          destinationIndex === index
            ? {
                ...destination,
                [field]: value,
              }
            : destination
      ),
    }));
  }

  function updateHomeExperience<
    K extends keyof HomeFormState["homeExperiences"][number],
  >(
    index: number,
    field: K,
    value: HomeFormState["homeExperiences"][number][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      homeExperiences: currentForm.homeExperiences.map(
        (experience, experienceIndex) =>
          experienceIndex === index
            ? {
                ...experience,
                [field]: value,
              }
            : experience
      ),
    }));
  }

  function addUpcomingTour() {
    if (form.upcomingTours.length >= 6) {
      toast.error("Limit reached", "Upcoming Tours can show up to 6 cards.");
      return;
    }

    const selectedTourIds = new Set(form.upcomingTours.map((tour) => tour.tourId));
    const nextTour = tours.find((tour) => !selectedTourIds.has(tour.tourId));

    if (!nextTour) {
      toast.error("No tour available", "Please add tours before selecting them.");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      upcomingTours: [
        ...currentForm.upcomingTours,
        {
          departureId: getDefaultDepartureId(departures, nextTour.tourId),
          sortOrder: currentForm.upcomingTours.length,
          tourId: nextTour.tourId,
        },
      ],
    }));
  }

  function removeUpcomingTour(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      upcomingTours: currentForm.upcomingTours.filter(
        (_tour, tourIndex) => tourIndex !== index
      ),
    }));
  }

  function addTrendingDestination() {
    if (form.trendingDestinations.length >= 8) {
      toast.error("Limit reached", "Top Trending Destinations can show up to 8 pins.");
      return;
    }

    const selectedDestinationIds = new Set(
      form.trendingDestinations.map((destination) => destination.destinationId)
    );
    const nextDestination = destinations.find(
      (destination) => !selectedDestinationIds.has(destination.destinationId)
    );

    if (!nextDestination) {
      toast.error(
        "No destination available",
        "Please add destinations before selecting them."
      );
      return;
    }

    const position = getDefaultDestinationMarker(
      nextDestination,
      form.trendingDestinations.length
    );

    setForm((currentForm) => ({
      ...currentForm,
      trendingDestinations: [
        ...currentForm.trendingDestinations,
        {
          destinationId: nextDestination.destinationId,
          markerX: position.markerX,
          markerY: position.markerY,
          sortOrder: currentForm.trendingDestinations.length,
        },
      ],
    }));
    setActiveDestinationIndex(form.trendingDestinations.length);
  }

  function removeTrendingDestination(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      trendingDestinations: currentForm.trendingDestinations.filter(
        (_destination, destinationIndex) => destinationIndex !== index
      ),
    }));
    setActiveDestinationIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function selectTrendingDestination(index: number, destinationId: string) {
    const selectedDestination = destinations.find(
      (destination) => destination.destinationId === destinationId
    );
    const position = selectedDestination
      ? getDefaultDestinationMarker(selectedDestination, index)
      : { markerX: 50, markerY: 50 };

    setForm((currentForm) => ({
      ...currentForm,
      trendingDestinations: currentForm.trendingDestinations.map(
        (destination, destinationIndex) =>
          destinationIndex === index
            ? {
                ...destination,
                destinationId,
                markerX: position.markerX,
                markerY: position.markerY,
              }
            : destination
      ),
    }));
    setActiveDestinationIndex(index);
  }

  function addCustomisedTourDestination() {
    if (
      form.customisedTourDestinations.length >=
      CUSTOMISED_TOUR_DESTINATION_LIMIT
    ) {
      toast.error(
        "Limit reached",
        `Customised Tours can show up to ${CUSTOMISED_TOUR_DESTINATION_LIMIT} destinations.`
      );
      return;
    }

    const selectedDestinationIds = new Set(
      form.customisedTourDestinations.map(
        (destination) => destination.destinationId
      )
    );
    const nextDestination = destinations.find(
      (destination) => !selectedDestinationIds.has(destination.destinationId)
    );

    if (!nextDestination) {
      toast.error(
        "No destination available",
        "Please add destinations before selecting them."
      );
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      customisedTourDestinations: [
        ...currentForm.customisedTourDestinations,
        {
          destinationId: nextDestination.destinationId,
          sortOrder: currentForm.customisedTourDestinations.length,
        },
      ],
    }));
  }

  function removeCustomisedTourDestination(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      customisedTourDestinations:
        currentForm.customisedTourDestinations.filter(
          (_destination, destinationIndex) => destinationIndex !== index
        ),
    }));
  }

  function addHomeExperience() {
    if (form.homeExperiences.length >= 5) {
      toast.error(
        "Limit reached",
        "Traveller Experiences can show up to 5 cards."
      );
      return;
    }

    const selectedExperienceIds = new Set(
      form.homeExperiences.map((experience) => experience.experienceId)
    );
    const nextExperience = publishedExperiences.find(
      (experience) => !selectedExperienceIds.has(experience.experienceId)
    );

    if (!nextExperience) {
      toast.error(
        "No experience available",
        "Please add and publish traveller experiences before selecting them."
      );
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      homeExperiences: [
        ...currentForm.homeExperiences,
        {
          experienceId: nextExperience.experienceId,
          sortOrder: currentForm.homeExperiences.length,
        },
      ],
    }));
  }

  function removeHomeExperience(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      homeExperiences: currentForm.homeExperiences.filter(
        (_experience, experienceIndex) => experienceIndex !== index
      ),
    }));
  }

  function selectCustomisedTourDestination(
    index: number,
    destinationId: string
  ) {
    updateCustomisedTourDestination(index, "destinationId", destinationId);
  }

  function selectHomeExperience(index: number, experienceId: string) {
    updateHomeExperience(index, "experienceId", experienceId);
  }

  function autoPlaceTrendingDestination(index: number) {
    const destinationSetting = form.trendingDestinations[index];

    if (!destinationSetting) {
      return;
    }

    const selectedDestination = destinations.find(
      (destination) =>
        destination.destinationId === destinationSetting.destinationId
    );

    if (!selectedDestination) {
      return;
    }

    const position = getDefaultDestinationMarker(selectedDestination, index);

    updateTrendingDestination(index, "markerX", position.markerX);
    updateTrendingDestination(index, "markerY", position.markerY);
    setActiveDestinationIndex(index);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await updateAdminHomePage(createPayload(form));

      setForm(createFormState(response.data.home));
      toast.success("Home page saved", response.message);
    } catch (error) {
      toast.error("Home page not saved", getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Pages">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-[1480px] flex-col gap-5"
      >
        <HomeHeader />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-foreground/60">
            Select the tour cards, map destinations, and traveller experiences shown on the public home page.
          </p>
          <Button
            type="submit"
            disabled={isLoading || isSaving}
            className="h-11 rounded-sm px-4 text-xs font-bold lg:hidden"
          >
            <Save className="size-4" data-icon="inline-start" />
            {isSaving ? "Saving..." : "Save Home Page"}
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {overviewMetrics.map((metric) => (
            <OverviewMetric key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.35fr]">
          <div className="grid gap-5">
            <EditorPanel
              actionLabel="Add Tour"
              onAction={addUpcomingTour}
              title="Upcoming Tours"
            >
              <div className="grid gap-4">
                {isLoading ? (
                  <LoadingPanel label="Loading upcoming tours..." />
                ) : form.upcomingTours.length > 0 ? (
                  form.upcomingTours.map((tour, index) => (
                    <UpcomingTourEditor
                      key={`${tour.tourId}-${index}`}
                      departures={departures}
                      index={index}
                      onRemove={removeUpcomingTour}
                      onUpdate={updateUpcomingTour}
                      tour={tour}
                      tours={tours}
                    />
                  ))
                ) : (
                  <EmptyState label="No upcoming tours selected." />
                )}
              </div>
            </EditorPanel>

            <EditorPanel
              actionLabel="Add Destination"
              onAction={addCustomisedTourDestination}
              title="Customised Tours"
            >
              <div className="grid gap-4">
                {isLoading ? (
                  <LoadingPanel label="Loading customised tour destinations..." />
                ) : form.customisedTourDestinations.length > 0 ? (
                  form.customisedTourDestinations.map((destination, index) => (
                    <CustomisedTourDestinationEditor
                      key={`${destination.destinationId}-${index}`}
                      destination={destination}
                      destinations={destinations}
                      index={index}
                      onRemove={removeCustomisedTourDestination}
                      onSelectDestination={selectCustomisedTourDestination}
                    />
                  ))
                ) : (
                  <EmptyState label="No customised tour destinations selected." />
                )}
              </div>
            </EditorPanel>

            <EditorPanel
              actionLabel="Add Experience"
              onAction={addHomeExperience}
              title="Traveller Experiences"
            >
              <div className="grid gap-4">
                {isLoading ? (
                  <LoadingPanel label="Loading traveller experiences..." />
                ) : form.homeExperiences.length > 0 ? (
                  form.homeExperiences.map((experience, index) => (
                    <HomeExperienceEditor
                      key={`${experience.experienceId}-${index}`}
                      experience={experience}
                      experiences={publishedExperiences}
                      index={index}
                      onRemove={removeHomeExperience}
                      onSelectExperience={selectHomeExperience}
                    />
                  ))
                ) : (
                  <EmptyState label="No traveller experiences selected." />
                )}
              </div>
            </EditorPanel>
          </div>

          <EditorPanel
            actionLabel="Add Destination"
            onAction={addTrendingDestination}
            title="Top Trending Destinations"
          >
            <MapPositionPreview
              activeIndex={activeDestinationIndex}
              destinations={destinations}
              form={form}
              onActivate={setActiveDestinationIndex}
              onUpdate={updateTrendingDestination}
            />

            <div className="mt-4 grid gap-4">
              {isLoading ? (
                <LoadingPanel label="Loading destinations..." />
              ) : form.trendingDestinations.length > 0 ? (
                form.trendingDestinations.map((destination, index) => (
                  <TrendingDestinationEditor
                    key={`${destination.destinationId}-${index}`}
                    destination={destination}
                    destinations={destinations}
                    index={index}
                    isActive={index === activeDestinationIndex}
                    onActivate={setActiveDestinationIndex}
                    onAutoPlace={autoPlaceTrendingDestination}
                    onRemove={removeTrendingDestination}
                    onSelectDestination={selectTrendingDestination}
                    onUpdate={updateTrendingDestination}
                  />
                ))
              ) : (
                <EmptyState label="No trending destinations selected." />
              )}
            </div>
          </EditorPanel>
        </section>
      </form>
    </AdminDashboardShell>
  );
}

function HomeHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Home Page
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span>Pages</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Home</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "Home page editor is ready.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            1
          </span>
        </button>
        <button
          onClick={() => toast.info("Admin profile", "Profile menu will open here.")}
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

function OverviewMetric({
  metric,
}: {
  metric: {
    detail: string;
    icon: LucideIcon;
    label: string;
    value: string;
  };
}) {
  const Icon = metric.icon;

  return (
    <div className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {metric.value}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-foreground/55">
            {metric.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function EditorPanel({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel: string;
  children: ReactNode;
  onAction: () => void;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-sans text-base font-bold text-foreground">{title}</h2>
        <Button
          type="button"
          variant="outline"
          onClick={onAction}
          className="h-9 rounded-sm px-3 text-xs font-bold"
        >
          <Plus className="size-4" data-icon="inline-start" />
          {actionLabel}
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function UpcomingTourEditor({
  departures,
  index,
  onRemove,
  onUpdate,
  tour,
  tours,
}: {
  departures: AdminTourDeparture[];
  index: number;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof HomeFormState["upcomingTours"][number]>(
    index: number,
    field: K,
    value: HomeFormState["upcomingTours"][number][K]
  ) => void;
  tour: HomeFormState["upcomingTours"][number];
  tours: AdminTour[];
}) {
  const selectedTour = tours.find((item) => item.tourId === tour.tourId);
  const departureOptions = departures.filter(
    (departure) => departure.tourId === tour.tourId
  );

  return (
    <article className="grid gap-3 rounded-sm border border-border bg-[#fffaf7] p-3 lg:grid-cols-[132px_minmax(0,1fr)_44px]">
      <div className="relative aspect-[1.32/1] overflow-hidden rounded-sm border border-border bg-white">
        {selectedTour?.thumbnailImage ||
        selectedTour?.bannerImage ||
        selectedTour?.galleryImages[0] ? (
          <img
            src={getTourMediaUrl(
              selectedTour.thumbnailImage ||
                selectedTour.bannerImage ||
                selectedTour.galleryImages[0]
            )}
            alt={selectedTour.tourName}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-foreground/30">
            <CalendarDays className="size-8" />
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Tour">
          <select
            required
            value={tour.tourId}
            onChange={(event) => onUpdate(index, "tourId", event.target.value)}
            className={inputClassName}
          >
            {tours.map((option) => (
              <option key={option.tourId} value={option.tourId}>
                {option.tourName} ({option.tourId})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Departure">
          <select
            value={tour.departureId || "__none__"}
            onChange={(event) =>
              onUpdate(
                index,
                "departureId",
                event.target.value === "__none__" ? "" : event.target.value
              )
            }
            className={inputClassName}
          >
            <option value="__none__">No fixed date</option>
            {departureOptions.map((departure) => (
              <option key={departure.departureId} value={departure.departureId}>
                {formatDate(departure.departureDate)} ({departure.departureId})
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-xs font-medium leading-relaxed text-foreground/60 sm:col-span-2">
          {selectedTour
            ? `${selectedTour.durationDn} · ${selectedTour.destinationId}`
            : "Select a tour to show this card on the homepage."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove upcoming tour ${index + 1}`}
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}

function CustomisedTourDestinationEditor({
  destination,
  destinations,
  index,
  onRemove,
  onSelectDestination,
}: {
  destination: HomeFormState["customisedTourDestinations"][number];
  destinations: AdminDestination[];
  index: number;
  onRemove: (index: number) => void;
  onSelectDestination: (index: number, destinationId: string) => void;
}) {
  const selectedDestination = destinations.find(
    (item) => item.destinationId === destination.destinationId
  );
  const destinationImage =
    selectedDestination?.thumbnailImage ||
    selectedDestination?.bannerImage ||
    selectedDestination?.galleryImages[0] ||
    "";
  const destinationMeta = [
    selectedDestination?.primaryHeritageFocus,
    selectedDestination?.bestTimeToVisit,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <article className="grid gap-3 rounded-sm border border-border bg-[#fffaf7] p-3 lg:grid-cols-[112px_minmax(0,1fr)_44px]">
      <div className="relative aspect-[1.32/1] overflow-hidden rounded-sm border border-border bg-white">
        {destinationImage && selectedDestination ? (
          <img
            src={getDestinationMediaUrl(destinationImage)}
            alt={selectedDestination.destinationName}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-foreground/30">
            <MapPin className="size-8" />
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <FormField label="Destination">
          <select
            required
            value={destination.destinationId}
            onChange={(event) =>
              onSelectDestination(index, event.target.value)
            }
            className={inputClassName}
          >
            {destinations.map((option) => (
              <option key={option.destinationId} value={option.destinationId}>
                {option.destinationName} ({option.destinationId})
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-xs font-medium leading-relaxed text-foreground/60">
          {selectedDestination
            ? destinationMeta ||
              selectedDestination.state ||
              selectedDestination.countryRegion
            : "Select a destination for the Customised Tours section."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove customised tour destination ${index + 1}`}
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}

function getHomeExperienceDisplayName(
  experience: AdminExperience | undefined,
  fallbackId = ""
) {
  return (
    experience?.title?.trim() ||
    experience?.travellerName.trim() ||
    experience?.destinationName ||
    experience?.destinationId ||
    fallbackId ||
    "Traveller experience"
  );
}

function getHomeExperienceImage(experience: AdminExperience | undefined) {
  return (
    experience?.travellerPhotoGallery.find((image) => image.trim()) ||
    experience?.attractionPhotoGallery.find((photo) => photo.image.trim())?.image ||
    ""
  );
}

function HomeExperienceEditor({
  experience,
  experiences,
  index,
  onRemove,
  onSelectExperience,
}: {
  experience: HomeFormState["homeExperiences"][number];
  experiences: AdminExperience[];
  index: number;
  onRemove: (index: number) => void;
  onSelectExperience: (index: number, experienceId: string) => void;
}) {
  const selectedExperience = experiences.find(
    (item) => item.experienceId === experience.experienceId
  );
  const experienceImage = getHomeExperienceImage(selectedExperience);
  const title = getHomeExperienceDisplayName(
    selectedExperience,
    experience.experienceId
  );
  const experienceMeta = selectedExperience
    ? [
        selectedExperience.destinationName || selectedExperience.destinationId,
        selectedExperience.travellerName || "Traveller",
        `${selectedExperience.overallRating.toFixed(1)} rating`,
      ]
        .filter(Boolean)
        .join(" - ")
    : "Select a published traveller experience for the homepage.";

  return (
    <article className="grid gap-3 rounded-sm border border-border bg-[#fffaf7] p-3 lg:grid-cols-[112px_minmax(0,1fr)_44px]">
      <div className="relative aspect-[1.32/1] overflow-hidden rounded-sm border border-border bg-white">
        {experienceImage ? (
          <img
            src={getExperienceMediaUrl(experienceImage)}
            alt={title}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-foreground/30">
            <Star className="size-8" />
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <FormField label="Experience">
          <select
            required
            value={experience.experienceId}
            onChange={(event) =>
              onSelectExperience(index, event.target.value)
            }
            className={inputClassName}
          >
            {!selectedExperience && experience.experienceId ? (
              <option value={experience.experienceId}>
                {experience.experienceId}
              </option>
            ) : null}
            {experiences.map((option) => (
              <option key={option.experienceId} value={option.experienceId}>
                {getHomeExperienceDisplayName(option)} ({option.experienceId})
              </option>
            ))}
          </select>
        </FormField>
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground/60">
          {selectedExperience?.writtenReview || experienceMeta}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove traveller experience ${index + 1}`}
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}

function TrendingDestinationEditor({
  destination,
  destinations,
  index,
  isActive,
  onActivate,
  onAutoPlace,
  onRemove,
  onSelectDestination,
  onUpdate,
}: {
  destination: HomeFormState["trendingDestinations"][number];
  destinations: AdminDestination[];
  index: number;
  isActive: boolean;
  onActivate: (index: number) => void;
  onAutoPlace: (index: number) => void;
  onRemove: (index: number) => void;
  onSelectDestination: (index: number, destinationId: string) => void;
  onUpdate: <K extends keyof HomeFormState["trendingDestinations"][number]>(
    index: number,
    field: K,
    value: HomeFormState["trendingDestinations"][number][K]
  ) => void;
}) {
  const selectedDestination = destinations.find(
    (item) => item.destinationId === destination.destinationId
  );

  return (
    <article
      className={cn(
        "grid gap-3 rounded-sm border bg-[#fffaf7] p-3 transition-colors lg:grid-cols-[112px_minmax(0,1fr)_44px]",
        isActive ? "border-primary/45" : "border-border"
      )}
      onFocus={() => onActivate(index)}
      onMouseEnter={() => onActivate(index)}
    >
      <div className="relative aspect-[1.32/1] overflow-hidden rounded-sm border border-border bg-white">
        {selectedDestination?.bannerImage ||
        selectedDestination?.galleryImages[0] ? (
          <img
            src={getDestinationMediaUrl(
              selectedDestination.bannerImage ||
                selectedDestination.galleryImages[0]
            )}
            alt={selectedDestination.destinationName}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-foreground/30">
            <MapPin className="size-8" />
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px_96px]">
        <FormField className="sm:col-span-3" label="Destination">
          <select
            required
            value={destination.destinationId}
            onChange={(event) =>
              onSelectDestination(index, event.target.value)
            }
            className={inputClassName}
          >
            {destinations.map((option) => (
              <option key={option.destinationId} value={option.destinationId}>
                {option.destinationName} ({option.destinationId})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Marker X">
          <input
            min={0}
            max={100}
            step="any"
            type="number"
            value={destination.markerX}
            onChange={(event) =>
              onUpdate(index, "markerX", Number(event.target.value))
            }
            className={inputClassName}
          />
        </FormField>
        <FormField label="Marker Y">
          <input
            min={0}
            max={100}
            step="any"
            type="number"
            value={destination.markerY}
            onChange={(event) =>
              onUpdate(index, "markerY", Number(event.target.value))
            }
            className={inputClassName}
          />
        </FormField>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => onAutoPlace(index)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-primary bg-white px-3 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <CircleDot className="size-4" />
            Auto
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove destination ${index + 1}`}
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}

function MapPositionPreview({
  activeIndex,
  destinations,
  form,
  onActivate,
  onUpdate,
}: {
  activeIndex: number;
  destinations: AdminDestination[];
  form: HomeFormState;
  onActivate: (index: number) => void;
  onUpdate: <K extends keyof HomeFormState["trendingDestinations"][number]>(
    index: number,
    field: K,
    value: HomeFormState["trendingDestinations"][number][K]
  ) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);

  function handlePreviewClick(event: MouseEvent<HTMLDivElement>) {
    if (!form.trendingDestinations[activeIndex]) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const markerX = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const markerY = clampPercent(((event.clientY - rect.top) / rect.height) * 100);

    onUpdate(activeIndex, "markerX", Number(markerX.toFixed(1)));
    onUpdate(activeIndex, "markerY", Number(markerY.toFixed(1)));
  }

  return (
    <div
      ref={previewRef}
      onClick={handlePreviewClick}
      className="relative mx-auto h-[330px] w-full max-w-[700px] overflow-hidden rounded-sm border border-border bg-white sm:h-[430px] lg:h-[535px]"
    >
      <img
        src="/home-assets/home-map.webp"
        alt="India map preview"
        className="absolute inset-0 size-full object-contain"
      />
      <div className="absolute inset-0 bg-white/15" />
      {form.trendingDestinations.map((destination, index) => {
        const selectedDestination = destinations.find(
          (item) => item.destinationId === destination.destinationId
        );
        const isActive = index === activeIndex;

        return (
          <button
            key={`${destination.destinationId}-${index}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onActivate(index);
            }}
            className={cn(
              "group absolute z-10 grid h-8 w-5 -translate-x-1/2 -translate-y-full origin-bottom place-items-end transition-transform",
              isActive ? "scale-110" : "hover:scale-105"
            )}
            style={{
              left: `${destination.markerX}%`,
              top: `${destination.markerY}%`,
            }}
            aria-label={`Select ${selectedDestination?.destinationName || destination.destinationId}`}
          >
            <MapPushPin active={isActive} />
            <span className="pointer-events-none absolute left-1/2 top-full mt-1 max-w-[130px] -translate-x-1/2 rounded-sm bg-white px-2 py-1 text-[10px] font-bold text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {selectedDestination?.destinationName ||
                destination.destinationId}
            </span>
          </button>
        );
      })}
      <p className="absolute bottom-3 left-4 right-4 rounded-sm bg-white/88 px-3 py-2 text-xs font-semibold text-foreground/65 shadow-sm">
        Pins are auto-placed from destination and state. Select a row, then click the map to fine tune.
      </p>
    </div>
  );
}

function MapPushPin({ active }: { active?: boolean }) {
  return (
    <span className="pointer-events-none relative block h-8 w-5">
      <span
        className={cn(
          "absolute left-1/2 top-0 z-10 size-4 -translate-x-1/2 rounded-full shadow-[0_4px_8px_rgba(155,59,19,0.26)]",
          active
            ? "bg-[radial-gradient(circle_at_68%_24%,#ffffff_0_7%,#f7b56c_16%,#d47220_52%,#9b3b13_100%)]"
            : "bg-[radial-gradient(circle_at_68%_24%,#ffffff_0_7%,#f4a15a_16%,#d47220_54%,#9b3b13_100%)]"
        )}
      >
        <span className="absolute right-1 top-0.5 size-1.5 rounded-full bg-white/80 blur-[0.5px]" />
      </span>
      <span className="absolute left-1/2 top-[15px] h-[17px] w-[1.5px] -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-300 via-stone-500 to-stone-700 shadow-[1px_2px_3px_rgba(50,50,50,0.22)]" />
    </span>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs font-semibold text-foreground/55">
      {label}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs font-semibold text-foreground/55">
      {label}
    </div>
  );
}

function FormField({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1.5", className)}>
      <span className="text-[11px] font-bold uppercase tracking-normal text-foreground/55">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-sm border border-border bg-white px-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15";
