"use client";

import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  MapPin,
  Minus,
  Plus,
  Users,
  type LucideIcon,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";

import { Button, ButtonArrow } from "@/components/ui/button";
import {
  fallbackUpcomingTours,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicTourDepartures,
  listPublicTours,
  type PublicDestination,
  type PublicTour,
  type PublicTourDeparture,
} from "@/lib/home-travel";
import { getToursHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

type PlannerTour = Pick<
  PublicTour,
  | "bestSeason"
  | "category"
  | "description"
  | "destinationId"
  | "destinationIds"
  | "tourId"
  | "tourName"
  | "tourType"
>;

type PlannerDestination = Pick<
  PublicDestination,
  | "city"
  | "countryRegion"
  | "destinationId"
  | "destinationName"
  | "primaryHeritageFocus"
  | "state"
>;

type PlannerDeparture = Pick<
  PublicTourDeparture,
  "departureDate" | "destinationId" | "tourId"
>;

type ActiveField = "destination" | "guests" | "month" | null;

type MonthOption = {
  label: string;
  timestamp: number;
  value: string;
};

type PlannerSuggestion = {
  destinationId: string;
  id: string;
  label: string;
  meta: string;
  searchValue: string;
  type: "Destination";
};

const planTripButtonClassName =
  "group h-12 min-w-[210px] justify-between gap-5 px-5 font-semibold shadow-none text-[17px]";
const panelPadding = 12;
const maxPlannerGuests = 6;

function PlanTripButtonContent({
  arrowClassName = "group-hover/button:brightness-0 group-hover/button:invert",
}: {
  arrowClassName?: string;
}) {
  return (
    <>
      Plan Your Trip
      <ButtonArrow className={arrowClassName} />
    </>
  );
}

type PanelPosition = {
  left: number;
  top: number;
  width: number;
  closedScaleX: number;
  closedScaleY: number;
};

type ButtonRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function createFallbackTours(): PlannerTour[] {
  return fallbackUpcomingTours.map((tour, index) => ({
    bestSeason: index < 4 ? "Oct - Mar" : "Nov - Feb",
    category: index % 2 === 0 ? "Heritage" : "Culture",
    description: "",
    destinationId: tour.destinationId,
    destinationIds: [tour.destinationId],
    tourId: tour.tourId,
    tourName: tour.title,
    tourType: "Heritage Tour",
  }));
}

function createFallbackDepartures(): PlannerDeparture[] {
  return fallbackUpcomingTours.map((tour) => {
    const departureDate = new Date(tour.date);

    return {
      departureDate: Number.isNaN(departureDate.getTime())
        ? null
        : departureDate.toISOString(),
      destinationId: tour.destinationId,
      tourId: tour.tourId,
    };
  });
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean))
  );
}

function getDestinationSearchText(destination: PlannerDestination) {
  return [
    destination.destinationId,
    destination.destinationName,
    destination.city,
    destination.state,
    destination.countryRegion,
    destination.primaryHeritageFocus,
  ]
    .join(" ")
    .toLowerCase();
}

function getTourSearchText(
  tour: PlannerTour,
  destinationById: Map<string, PlannerDestination>
) {
  const destinationLabels = getTourDestinationIds(tour).flatMap((destinationId) => {
    const destination = destinationById.get(destinationId);

    return destination
      ? [
          destination.destinationName,
          destination.city,
          destination.state,
          destination.countryRegion,
          destination.primaryHeritageFocus,
        ]
      : [destinationId];
  });

  return [
    tour.tourId,
    tour.tourName,
    tour.tourType,
    tour.category,
    tour.bestSeason,
    tour.description,
    ...destinationLabels,
  ]
    .join(" ")
    .toLowerCase();
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

function getDepartureSearchText({
  departure,
  destinationById,
  tourById,
}: {
  departure: PlannerDeparture;
  destinationById: Map<string, PlannerDestination>;
  tourById: Map<string, PlannerTour>;
}) {
  const tour = tourById.get(departure.tourId.trim().toUpperCase());
  const primaryDestinationId = tour ? getTourDestinationIds(tour)[0] : "";
  const destination =
    destinationById.get(departure.destinationId.trim().toUpperCase()) ||
    destinationById.get(primaryDestinationId);

  return [
    tour ? getTourSearchText(tour, destinationById) : departure.tourId,
    destination ? getDestinationSearchText(destination) : departure.destinationId,
  ]
    .join(" ")
    .toLowerCase();
}

function createMonthOptions({
  departures,
  destinationById,
  query,
  tourById,
}: {
  departures: PlannerDeparture[];
  destinationById: Map<string, PlannerDestination>;
  query: string;
  tourById: Map<string, PlannerTour>;
}) {
  const normalizedQuery = normalizeText(query);
  const months = new Map<string, MonthOption>();

  departures.forEach((departure) => {
    if (
      normalizedQuery &&
      !getDepartureSearchText({ departure, destinationById, tourById }).includes(
        normalizedQuery
      )
    ) {
      return;
    }

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

  return Array.from(months.values()).sort(
    (left, right) => left.timestamp - right.timestamp
  );
}

function createSuggestions({
  destinations,
  query,
}: {
  destinations: PlannerDestination[];
  query: string;
}) {
  const normalizedQuery = normalizeText(query);
  const suggestions: PlannerSuggestion[] = [];
  const seenSuggestionIds = new Set<string>();

  destinations.forEach((destination) => {
    if (
      normalizedQuery &&
      !getDestinationSearchText(destination).includes(normalizedQuery)
    ) {
      return;
    }

    const id = `destination-${normalizeText(
      destination.destinationId || destination.destinationName
    )}`;

    if (seenSuggestionIds.has(id)) {
      return;
    }

    seenSuggestionIds.add(id);
    suggestions.push({
      destinationId: destination.destinationId,
      id,
      label: destination.destinationName,
      meta:
        uniqueValues([destination.city, destination.state, destination.countryRegion])
          .join(", ") || "Destination",
      searchValue: destination.destinationName,
      type: "Destination",
    });
  });

  return suggestions;
}

function getMatchingPlannerDestinationId(
  query: string,
  destinations: PlannerDestination[]
) {
  const queryKey = normalizeText(query);

  if (!queryKey) {
    return "";
  }

  return (
    destinations.find((destination) =>
      [
        destination.destinationId,
        destination.destinationName,
        destination.city,
      ].some((value) => normalizeText(value || "") === queryKey)
    )?.destinationId || ""
  );
}

export function PlanTripLauncher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [buttonStartRect, setButtonStartRect] = useState<ButtonRect | null>(null);
  const [isCtaFlying, setIsCtaFlying] = useState(false);
  const [isCtaSettled, setIsCtaSettled] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [tours, setTours] = useState<PlannerTour[]>(() => createFallbackTours());
  const [destinations, setDestinations] = useState<PlannerDestination[]>([]);
  const [departures, setDepartures] = useState<PlannerDeparture[]>(() =>
    createFallbackDepartures()
  );
  const launcherRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const destinationById = useMemo(
    () =>
      new Map(
        destinations.map((destination) => [
          destination.destinationId.trim().toUpperCase(),
          destination,
        ])
      ),
    [destinations]
  );

  const tourById = useMemo(
    () => new Map(tours.map((tour) => [tour.tourId.trim().toUpperCase(), tour])),
    [tours]
  );

  const monthOptions = useMemo(
    () =>
      createMonthOptions({
        departures,
        destinationById,
        query: destinationQuery,
        tourById,
      }),
    [departures, destinationById, destinationQuery, tourById]
  );

  const suggestions = useMemo(
    () =>
      createSuggestions({
        destinations,
        query: destinationQuery,
      }),
    [destinationQuery, destinations]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPlannerData() {
      try {
        const [toursResponse, departuresResponse, destinationsResponse] =
          await Promise.all([
            listPublicTours(),
            listPublicTourDepartures(),
            listPublicDestinations(),
          ]);

        if (!isMounted) {
          return;
        }

        if (toursResponse.data.tours.length > 0) {
          setTours(toursResponse.data.tours);
        }

        if (departuresResponse.data.departures.length > 0) {
          setDepartures(departuresResponse.data.departures);
        }

        if (destinationsResponse.data.destinations.length > 0) {
          setDestinations(destinationsResponse.data.destinations);
        }
      } catch {
        // Fallback data keeps the planner usable when live data is unavailable.
      }
    }

    loadPlannerData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedMonthIsAvailable =
    !selectedMonth ||
    monthOptions.some((monthOption) => monthOption.value === selectedMonth);
  const effectiveSelectedMonth = selectedMonthIsAvailable ? selectedMonth : "";
  const hasDestinationQuery = destinationQuery.trim().length > 0;

  const updatePanelPosition = useCallback(() => {
    const launcher = launcherRef.current;

    if (!launcher) {
      return;
    }

    const buttonRect = launcher.getBoundingClientRect();
    const viewportPadding = window.innerWidth < 768 ? 24 : 48;
    const maxPanelWidth = 1120;
    const panelChromeHeight = panelPadding * 2;
    const panelVisualHeight = buttonRect.height + panelChromeHeight;
    const left =
      window.innerWidth < 768
        ? viewportPadding
        : buttonRect.left;
    const panelWidth = Math.min(
      window.innerWidth - left - viewportPadding,
      maxPanelWidth
    );
    const width = Math.max(panelWidth, 280);
    const top = buttonRect.top - panelChromeHeight / 2;

    setPanelPosition({
      left,
      top,
      width,
      closedScaleX: buttonRect.width / width,
      closedScaleY: buttonRect.height / panelVisualHeight,
    });
  }, []);

  const closePlanner = useCallback(() => {
    setIsOpen(false);
    setActiveField(null);
    setIsCtaFlying(false);
    setIsCtaSettled(false);
    setButtonStartRect(null);
  }, []);

  const openPlanner = useCallback(() => {
    const launcher = launcherRef.current;

    if (launcher) {
      const buttonRect = launcher.getBoundingClientRect();

      setButtonStartRect({
        left: buttonRect.left,
        top: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      });
    }

    setPanelPosition(null);
    setActiveField(null);
    setIsCtaFlying(false);
    setIsCtaSettled(false);
    setIsOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelPosition();
  }, [isOpen, updatePanelPosition]);

  useLayoutEffect(() => {
    if (!isOpen || !buttonStartRect || !panelPosition) {
      return;
    }

    let firstFrameId = 0;
    let secondFrameId = 0;
    let settleTimeoutId = 0;

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setIsCtaFlying(true);
        settleTimeoutId = window.setTimeout(() => {
          setIsCtaSettled(true);
        }, 1100);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
      window.clearTimeout(settleTimeoutId);
    };
  }, [buttonStartRect, isOpen, panelPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeField) {
          setActiveField(null);
          return;
        }

        closePlanner();
      }
    };

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeField, closePlanner, isOpen, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen || !activeField) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        panelRef.current?.contains(target) &&
        target.closest("[data-plan-trip-field]")
      ) {
        return;
      }

      setActiveField(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [activeField, isOpen]);

  const handleLauncherClick = () => {
    if (isOpen) {
      closePlanner();
      return;
    }

    openPlanner();
  };

  const handleSearchTours = () => {
    if (!hasDestinationQuery) {
      setActiveField("destination");
      return;
    }

    const destinationId =
      selectedDestinationId ||
      getMatchingPlannerDestinationId(destinationQuery, destinations);
    const destinationValue =
      destinations.find((destination) => destination.destinationId === destinationId)
        ?.destinationName || "";

    router.push(
      getToursHref({
        adults: adultCount,
        children: childCount,
        destination: destinationValue,
        month: effectiveSelectedMonth,
        search: destinationValue ? "" : destinationQuery.trim(),
      })
    );
  };

  const handleSuggestionSelect = (suggestion: PlannerSuggestion) => {
    setDestinationQuery(suggestion.searchValue);
    setSelectedDestinationId(suggestion.destinationId);
    setActiveField("month");
  };

  const closeGuestPickerOnMobile = () => {
    if (window.innerWidth < 768) {
      setActiveField(null);
    }
  };

  const openGroupEnquiry = () => {
    setActiveField(null);
    setIsEnquiryOpen(true);
  };

  const updateAdultCount = (value: number) => {
    const nextAdultCount = Math.max(1, value);

    if (nextAdultCount + childCount > maxPlannerGuests) {
      openGroupEnquiry();
      return;
    }

    setAdultCount(nextAdultCount);
    closeGuestPickerOnMobile();
  };

  const updateChildCount = (value: number) => {
    const nextChildCount = Math.max(0, value);

    if (adultCount + nextChildCount > maxPlannerGuests) {
      openGroupEnquiry();
      return;
    }

    setChildCount(nextChildCount);
    closeGuestPickerOnMobile();
  };

  const ctaMotion =
    isOpen && buttonStartRect && panelPosition
      ? {
          ...buttonStartRect,
          endLeft:
            panelPosition.left +
            panelPosition.width -
            panelPadding -
            buttonStartRect.width,
          endTop: panelPosition.top + panelPadding,
        }
      : null;

  return (
    <>
      <button
        type="button"
        aria-label="Close trip planner"
        onClick={closePlanner}
        className={`fixed inset-0 z-20 bg-secondary/10 backdrop-blur-[3px] transition-opacity duration-500 ease-out ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <PlannerEnquiryDialog
        open={isEnquiryOpen}
        onOpenChange={(nextOpen) => {
          setIsEnquiryOpen(nextOpen);

          if (!nextOpen) {
            closePlanner();
          }
        }}
        placeToPlan={destinationQuery.trim()}
      />

      <div ref={launcherRef} className="relative z-30 mt-[clamp(1.2rem,6vh,3rem)] inline-flex">
        <Button
          type="button"
          variant="outline"
          aria-expanded={isOpen}
          aria-controls="plan-trip-panel"
          onClick={handleLauncherClick}
          className={`${planTripButtonClassName} transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "pointer-events-none scale-95 bg-primary text-white opacity-0"
              : "opacity-100"
          }`}
        >
          <PlanTripButtonContent />
        </Button>
      </div>

      {isOpen && ctaMotion ? (
        <div
          className="fixed z-50 hidden transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:block"
          style={{
            left: ctaMotion.left,
            top: ctaMotion.top,
            width: ctaMotion.width,
            height: ctaMotion.height,
            transform: isCtaFlying
              ? `translate3d(${ctaMotion.endLeft - ctaMotion.left}px, ${
                  ctaMotion.endTop - ctaMotion.top
                }px, 0)`
              : "translate3d(0, 0, 0)",
            willChange: "transform",
          }}
        >
          <Button
            type="button"
            variant="outline"
            tabIndex={isCtaSettled ? 0 : -1}
            disabled={!hasDestinationQuery}
            onClick={handleSearchTours}
            className={`${planTripButtonClassName} h-full w-full min-w-0 !bg-white !text-primary hover:!bg-white hover:!text-primary [&_svg]:!text-primary ${
              isCtaSettled ? "pointer-events-auto" : "pointer-events-none"
            } ${hasDestinationQuery ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <PlanTripButtonContent arrowClassName="group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      ) : null}

      <div
        ref={panelRef}
        id="plan-trip-panel"
        aria-hidden={!isOpen}
        style={
          panelPosition
            ? ({
                left: panelPosition.left,
                top: panelPosition.top,
                width: panelPosition.width,
                "--launcher-closed-scale-x": panelPosition.closedScaleX,
                "--launcher-closed-scale-y": panelPosition.closedScaleY,
              } as CSSProperties)
            : undefined
        }
        className={`fixed z-40 max-w-[calc(100vw-3rem)] origin-left transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:max-w-[calc(100vw-2.5rem)] ${
          isOpen
            ? "translate-y-0 scale-x-100 scale-y-100 opacity-100"
            : "pointer-events-none translate-y-0 scale-x-[var(--launcher-closed-scale-x)] scale-y-[var(--launcher-closed-scale-y)] opacity-0"
        }`}
      >
        <div className="flex flex-col items-center justify-center overflow-visible rounded-[24px] border border-accent/30 bg-white/95 p-4 shadow-[0_18px_55px_rgba(50,50,50,0.16)] backdrop-blur-md md:min-h-[50px] md:flex-row md:items-stretch md:rounded-[34px] md:bg-white/90 md:p-3 md:shadow-none">
          <div
            className={`grid flex-1 divide-y divide-accent/25 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:h-full md:grid-cols-3 md:items-center md:divide-x md:divide-y-0 ${
              isOpen ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
            }`}
          >
            <DestinationField
              active={activeField === "destination"}
              query={destinationQuery}
              suggestions={suggestions}
              onFocus={() => setActiveField("destination")}
              onQueryChange={(value) => {
                setDestinationQuery(value);
                setSelectedDestinationId("");
                setActiveField("destination");
              }}
              onSearch={handleSearchTours}
              onSuggestionSelect={handleSuggestionSelect}
            />

            <MonthField
              active={activeField === "month"}
              options={monthOptions}
              value={effectiveSelectedMonth}
              onToggle={() =>
                setActiveField((current) => (current === "month" ? null : "month"))
              }
              onChange={(value) => {
                setSelectedMonth(value);
                setActiveField(null);
              }}
            />

            <GuestsField
              active={activeField === "guests"}
              adultCount={adultCount}
              childCount={childCount}
              onAdultCountChange={updateAdultCount}
              onChildCountChange={updateChildCount}
              onToggle={() =>
                setActiveField((current) => (current === "guests" ? null : "guests"))
              }
            />
          </div>

          <div
            className={`relative z-10 flex w-full justify-center md:flex md:h-full md:w-auto md:min-w-[210px] md:items-center md:pt-0 ${
              activeField ? "hidden md:flex" : "pt-3 md:pt-0"
            }`}
          >
            <Button
              type="button"
              variant="outline"
              disabled={!hasDestinationQuery}
              onClick={handleSearchTours}
              className={`${planTripButtonClassName} h-10 w-full max-w-[390px] !min-w-0 !gap-3 px-4 !bg-white !text-primary hover:!bg-white hover:!text-primary [&_svg]:!text-primary md:hidden ${
                hasDestinationQuery ? "" : "cursor-not-allowed opacity-60"
              }`}
            >
              <PlanTripButtonContent arrowClassName="group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-hidden="true"
              tabIndex={-1}
              className={`${planTripButtonClassName} pointer-events-none hidden opacity-0 md:inline-flex`}
            >
              <PlanTripButtonContent />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function PlanTripInline({
  className,
  initialAdultCount = 2,
  initialChildCount = 0,
  initialMonthValue = "",
  initialSearchQuery = "",
}: {
  className?: string;
  initialAdultCount?: number;
  initialChildCount?: number;
  initialMonthValue?: string;
  initialSearchQuery?: string;
}) {
  const router = useRouter();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [destinationQuery, setDestinationQuery] = useState(initialSearchQuery);
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(initialMonthValue);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [adultCount, setAdultCount] = useState(
    Math.min(maxPlannerGuests, Math.max(1, initialAdultCount))
  );
  const [childCount, setChildCount] = useState(
    Math.min(
      Math.max(0, maxPlannerGuests - Math.max(1, initialAdultCount)),
      Math.max(0, initialChildCount)
    )
  );
  const [tours, setTours] = useState<PlannerTour[]>(() => createFallbackTours());
  const [destinations, setDestinations] = useState<PlannerDestination[]>([]);
  const [departures, setDepartures] = useState<PlannerDeparture[]>(() =>
    createFallbackDepartures()
  );
  const plannerRef = useRef<HTMLDivElement>(null);

  const destinationById = useMemo(
    () =>
      new Map(
        destinations.map((destination) => [
          destination.destinationId.trim().toUpperCase(),
          destination,
        ])
      ),
    [destinations]
  );

  const tourById = useMemo(
    () => new Map(tours.map((tour) => [tour.tourId.trim().toUpperCase(), tour])),
    [tours]
  );

  const monthOptions = useMemo(
    () =>
      createMonthOptions({
        departures,
        destinationById,
        query: destinationQuery,
        tourById,
      }),
    [departures, destinationById, destinationQuery, tourById]
  );

  const suggestions = useMemo(
    () =>
      createSuggestions({
        destinations,
        query: destinationQuery,
      }),
    [destinationQuery, destinations]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPlannerData() {
      try {
        const [toursResponse, departuresResponse, destinationsResponse] =
          await Promise.all([
            listPublicTours(),
            listPublicTourDepartures(),
            listPublicDestinations(),
          ]);

        if (!isMounted) {
          return;
        }

        if (toursResponse.data.tours.length > 0) {
          setTours(toursResponse.data.tours);
        }

        if (departuresResponse.data.departures.length > 0) {
          setDepartures(departuresResponse.data.departures);
        }

        if (destinationsResponse.data.destinations.length > 0) {
          setDestinations(destinationsResponse.data.destinations);
        }
      } catch {
        // Fallback data keeps the planner usable when live data is unavailable.
      }
    }

    loadPlannerData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeField) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        plannerRef.current?.contains(target) &&
        target.closest("[data-plan-trip-field]")
      ) {
        return;
      }

      setActiveField(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [activeField]);

  const selectedMonthIsAvailable =
    !selectedMonth ||
    monthOptions.some((monthOption) => monthOption.value === selectedMonth);
  const effectiveSelectedMonth = selectedMonthIsAvailable ? selectedMonth : "";
  const hasDestinationQuery = destinationQuery.trim().length > 0;

  const handleSearchTours = () => {
    if (!hasDestinationQuery) {
      setActiveField("destination");
      return;
    }

    const destinationId =
      selectedDestinationId ||
      getMatchingPlannerDestinationId(destinationQuery, destinations);
    const destinationValue =
      destinations.find((destination) => destination.destinationId === destinationId)
        ?.destinationName || "";

    router.push(
      getToursHref({
        adults: adultCount,
        children: childCount,
        destination: destinationValue,
        month: effectiveSelectedMonth,
        search: destinationValue ? "" : destinationQuery.trim(),
      })
    );
  };

  const closeGuestPickerOnMobile = () => {
    if (window.innerWidth < 768) {
      setActiveField(null);
    }
  };

  const openGroupEnquiry = () => {
    setActiveField(null);
    setIsEnquiryOpen(true);
  };

  const updateAdultCount = (value: number) => {
    const nextAdultCount = Math.max(1, value);

    if (nextAdultCount + childCount > maxPlannerGuests) {
      openGroupEnquiry();
      return;
    }

    setAdultCount(nextAdultCount);
    closeGuestPickerOnMobile();
  };

  const updateChildCount = (value: number) => {
    const nextChildCount = Math.max(0, value);

    if (adultCount + nextChildCount > maxPlannerGuests) {
      openGroupEnquiry();
      return;
    }

    setChildCount(nextChildCount);
    closeGuestPickerOnMobile();
  };

  return (
    <>
      <PlannerEnquiryDialog
        open={isEnquiryOpen}
        onOpenChange={(nextOpen) => {
          setIsEnquiryOpen(nextOpen);

          if (!nextOpen) {
            setActiveField(null);
          }
        }}
        placeToPlan={destinationQuery.trim()}
      />
      <div
        ref={plannerRef}
        className={cn(
          "relative z-30 grid w-full overflow-visible rounded-[34px] border border-accent/30 bg-white/90 p-3 backdrop-blur-md md:min-h-[60px] md:grid-cols-[minmax(0,1fr)_210px] md:items-stretch",
          className
        )}
      >
        <div className="grid min-w-0 flex-1 divide-y divide-accent/25 md:grid-cols-3 md:items-center md:divide-x md:divide-y-0">
          <DestinationField
            active={activeField === "destination"}
            query={destinationQuery}
            suggestions={suggestions}
            onFocus={() => setActiveField("destination")}
            onQueryChange={(value) => {
              setDestinationQuery(value);
              setSelectedDestinationId("");
              setActiveField("destination");
            }}
            onSearch={handleSearchTours}
            onSuggestionSelect={(suggestion) => {
              setDestinationQuery(suggestion.searchValue);
              setSelectedDestinationId(suggestion.destinationId);
              setActiveField("month");
            }}
          />

          <MonthField
            active={activeField === "month"}
            options={monthOptions}
            value={effectiveSelectedMonth}
            onToggle={() =>
              setActiveField((current) => (current === "month" ? null : "month"))
            }
            onChange={(value) => {
              setSelectedMonth(value);
              setActiveField(null);
            }}
          />

          <GuestsField
            active={activeField === "guests"}
            adultCount={adultCount}
            childCount={childCount}
            onAdultCountChange={updateAdultCount}
            onChildCountChange={updateChildCount}
            onToggle={() =>
              setActiveField((current) => (current === "guests" ? null : "guests"))
            }
          />
        </div>

        <div className="pt-3 md:flex md:h-full md:items-center md:justify-end md:pt-0">
          <Button
            type="button"
            variant="outline"
            disabled={!hasDestinationQuery}
            onClick={handleSearchTours}
            className={`${planTripButtonClassName} h-11 w-full min-w-0 !bg-white !text-primary hover:!bg-white hover:!text-primary [&_svg]:!text-primary md:w-[210px] ${
              hasDestinationQuery ? "" : "cursor-not-allowed opacity-60"
            }`}
          >
            <PlanTripButtonContent arrowClassName="group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </div>
    </>
  );
}

function PlannerEnquiryDialog({
  onOpenChange,
  open,
  placeToPlan,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  placeToPlan?: string;
}) {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
  };

  const closeDialog = () => {
    onOpenChange(false);
    setIsSubmitted(false);
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] grid place-items-center bg-secondary/25 px-4 py-6 backdrop-blur-[6px]">
      <button
        type="button"
        aria-label="Close group enquiry"
        className="absolute inset-0 cursor-default"
        onClick={closeDialog}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-enquiry-title"
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-[720px] overflow-hidden rounded-[18px] border border-accent/25 bg-white shadow-[0_24px_80px_rgba(50,50,50,0.28)]"
      >
        <button
          type="button"
          aria-label="Close group enquiry"
          onClick={closeDialog}
          className="absolute right-5 top-5 grid size-9 place-items-center rounded-full border border-accent/25 bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>

        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="pr-10">
            <h2
              id="planner-enquiry-title"
              className="font-heading text-[28px] font-bold leading-tight text-secondary"
            >
              Group Enquiry
            </h2>
            <p className="mt-2 max-w-[560px] font-sans text-[14px] leading-relaxed text-secondary/68">
              For more than 6 guests, please share your details and our travel team
              will help you plan the right itinerary.
            </p>
          </div>

          {isSubmitted ? (
            <div className="mt-5 rounded-[12px] border border-primary/20 bg-[#fff7ef] p-4 font-sans text-[14px] font-semibold text-secondary">
              Thank you. Your enquiry has been captured and our team will get back
              to you shortly.
            </div>
          ) : (
            <form className="mt-5 grid grid-cols-2 gap-3 sm:gap-4" onSubmit={handleSubmit}>
              <PlannerEnquiryField label="Your Name *" name="name" />
              <PlannerEnquiryField label="Email Address *" name="email" type="email" />
              <PlannerEnquiryField label="Phone Number *" name="phone" type="tel" />
              <PlannerEnquiryField
                defaultValue={placeToPlan}
                label="Place to plan trip *"
                name="place"
              />
              <PlannerEnquiryField
                label="Total Guests *"
                min={maxPlannerGuests + 1}
                name="guests"
                type="number"
              />
              <label className="col-span-2 block font-sans text-[12px] font-bold uppercase text-secondary/58">
                Message
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Tell us your preferred destination, dates, or group needs."
                  className="mt-1.5 w-full resize-none rounded-[10px] border border-accent/20 bg-white px-3 py-2 font-sans text-[13px] font-medium normal-case text-secondary outline-none transition-colors placeholder:text-secondary/38 focus:border-primary focus:ring-3 focus:ring-primary/15"
                />
              </label>
              <Button type="submit" className="col-span-2 h-11 w-full">
                Submit Enquiry
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function PlannerEnquiryField({
  defaultValue,
  label,
  name,
  type = "text",
  min,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  type?: string;
  min?: number;
}) {
  return (
    <label className="block font-sans text-[12px] font-bold uppercase text-secondary/58">
      {label}
      <input
        required
        defaultValue={defaultValue}
        min={min}
        name={name}
        type={type}
        className="mt-1.5 h-10 w-full rounded-[10px] border border-accent/20 bg-white px-3 font-sans text-[13px] font-medium normal-case text-secondary outline-none transition-colors placeholder:text-secondary/38 focus:border-primary focus:ring-3 focus:ring-primary/15"
      />
    </label>
  );
}

function DestinationField({
  active,
  onFocus,
  onQueryChange,
  onSearch,
  onSuggestionSelect,
  query,
  suggestions,
}: {
  active: boolean;
  query: string;
  suggestions: PlannerSuggestion[];
  onFocus: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSuggestionSelect: (suggestion: PlannerSuggestion) => void;
}) {
  return (
    <div data-plan-trip-field className="relative min-w-0 py-1 text-left md:py-0">
      <label className="sr-only" htmlFor="plan-trip-destination-search">
        Search destination
      </label>
      <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-accent md:left-8 md:size-6" strokeWidth={1.9} />
      <input
        id="plan-trip-destination-search"
        type="search"
        autoComplete="off"
        value={query}
        onFocus={onFocus}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSearch();
          }
        }}
        placeholder="Where to?"
        className="h-9 w-full bg-transparent py-2 pl-11 pr-3 font-sans text-description font-medium text-secondary outline-none placeholder:text-secondary md:h-full md:py-3 md:pl-[76px] md:pr-4"
      />

      {active ? (
        <div className="absolute left-0 top-[calc(100%+12px)] z-[80] w-full min-w-[280px] overflow-hidden rounded-[18px] border border-border bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)] md:w-full">
          {suggestions.length > 0 ? (
            <div className="max-h-[30dvh] touch-pan-y overflow-y-auto overscroll-contain px-2 pb-8 pt-2 [-webkit-overflow-scrolling:touch] md:max-h-[min(360px,calc(100dvh-13rem))]">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => onSuggestionSelect(suggestion)}
                  className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left font-sans transition-colors hover:bg-primary/8 hover:text-primary"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-[14px] font-bold text-secondary">
                      {suggestion.label}
                    </strong>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-secondary/54">
                      {suggestion.meta}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#fff1e5] px-2 py-1 text-[10px] font-bold uppercase text-primary">
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-5 py-4 font-sans text-[13px] font-semibold text-secondary/58">
              No matching destinations found.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MonthField({
  active,
  onChange,
  onToggle,
  options,
  value,
}: {
  active: boolean;
  options: MonthOption[];
  value: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div data-plan-trip-field className="relative min-w-0 py-1 md:py-0">
      <PlannerFieldButton
        active={active}
        icon={CalendarDays}
        label={value ? formatMonthLabel(value) : "Any Month"}
        onClick={onToggle}
      />

      {active ? (
        <div className="absolute left-1/2 top-[calc(100%+12px)] z-[80] w-[min(290px,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-border bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)] md:w-full">
          <div className="max-h-[30dvh] touch-pan-y overflow-y-auto overscroll-contain px-2 pb-8 pt-2 [-webkit-overflow-scrolling:touch] md:max-h-[min(360px,calc(100dvh-13rem))]">
            <MonthOptionButton
              active={!value}
              label="Any Month"
              onClick={() => onChange("")}
            />
            {options.map((option) => (
              <MonthOptionButton
                key={option.value}
                active={value === option.value}
                label={option.label}
                onClick={() => onChange(option.value)}
              />
            ))}
            {options.length === 0 ? (
              <p className="px-3 py-3 font-sans text-[12px] font-semibold text-secondary/58">
                No scheduled months yet.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthOptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left font-sans transition-colors hover:bg-primary/8 hover:text-primary",
        active && "bg-primary/8 text-primary"
      )}
    >
      <span className="min-w-0">
        <strong
          className={cn(
            "block truncate text-[14px] font-bold text-secondary",
            active && "text-primary"
          )}
        >
          {label}
        </strong>
      </span>
      <span className="shrink-0 rounded-full bg-[#fff1e5] px-2 py-1 text-[10px] font-bold uppercase text-primary">
        Month
      </span>
    </button>
  );
}

function GuestsField({
  active,
  adultCount,
  childCount,
  onAdultCountChange,
  onChildCountChange,
  onToggle,
}: {
  active: boolean;
  adultCount: number;
  childCount: number;
  onAdultCountChange: (value: number) => void;
  onChildCountChange: (value: number) => void;
  onToggle: () => void;
}) {
  const totalGuests = adultCount + childCount;
  const travellerLabel =
    childCount > 0
      ? `${totalGuests} ${totalGuests === 1 ? "Guest" : "Guests"}`
      : `${adultCount} ${adultCount === 1 ? "Adult" : "Adults"}`;

  return (
    <div data-plan-trip-field className="relative min-w-0 py-1 md:py-0">
      <PlannerFieldButton
        active={active}
        icon={Users}
        label={travellerLabel}
        onClick={onToggle}
      />

      {active ? (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-[80] w-[min(360px,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)] md:left-auto md:right-0 md:top-[calc(100%+12px)] md:w-[min(360px,calc(100vw-2.5rem))] md:translate-x-0">
          <div className="px-3 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-6">
            <TravellerStepper
              label="Adults"
              note="Above 12"
              minimum={1}
              value={adultCount}
              onChange={onAdultCountChange}
            />
            <div className="my-2 h-px bg-border sm:my-3" />
            <TravellerStepper
              label="Children"
              note="Above 6 to 12"
              minimum={0}
              value={childCount}
              onChange={onChildCountChange}
            />
            <p className="mt-2 font-sans text-[12px] font-normal text-secondary/62 sm:mt-3 sm:text-[13px]">
              Total guests: <strong className="font-semibold text-secondary">{totalGuests}</strong>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlannerFieldButton({
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
      aria-expanded={active}
      onClick={onClick}
      className="flex h-9 w-full items-center gap-4 px-3 py-1.5 text-left font-sans text-description font-medium text-secondary transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/15 md:h-full md:gap-5 md:px-8 md:py-3"
    >
      <Icon className="size-5 shrink-0 text-accent md:size-6" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronDown className="size-4 shrink-0 text-primary" />
    </button>
  );
}

function TravellerStepper({
  label,
  minimum,
  note,
  onChange,
  value,
}: {
  label: string;
  minimum: number;
  note: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-sans">
        <strong className="block text-[15px] font-semibold leading-tight text-secondary sm:text-[16px]">
          {label}
        </strong>
        <span className="mt-0.5 block text-[12px] font-normal leading-tight text-secondary/58 sm:text-[13px]">
          {note}
        </span>
      </span>
      <span className="inline-flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= minimum}
          onClick={() => onChange(value - 1)}
          className="grid size-8 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:bg-primary hover:text-white disabled:pointer-events-none disabled:text-secondary/28 sm:size-9"
        >
          <Minus className="size-3.5" strokeWidth={1.8} />
        </button>
        <strong className="w-5 text-center font-sans text-[15px] font-medium text-secondary sm:text-[16px]">
          {value}
        </strong>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="grid size-8 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:bg-primary hover:text-white sm:size-9"
        >
          <Plus className="size-3.5" strokeWidth={1.8} />
        </button>
      </span>
    </div>
  );
}
