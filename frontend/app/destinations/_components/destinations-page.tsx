"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Globe2,
  Landmark,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { getHomeMediaUrl, listPublicDestinations, type PublicDestination } from "@/lib/home-travel";
import { getDestinationHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "india" | "international" | "unesco-site";
type SortMode = "recommended" | "newest" | "name" | "duration";

type CountOption = {
  count: number;
  label: string;
  value: string;
};

const pageSize = 12;

const fallbackImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/destination/Hoysalas.webp",
];

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: "Recommended", value: "recommended" },
  { label: "Newest", value: "newest" },
  { label: "Name A-Z", value: "name" },
  { label: "Duration", value: "duration" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load destinations.";
}

function normalizeValue(value: string) {
  return value.trim();
}

function normalizeKey(value: string) {
  return normalizeValue(value).toLowerCase();
}

function splitLabels(value: string) {
  return value
    .split(/[,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFocusLabels(destination: PublicDestination) {
  return splitLabels(destination.primaryHeritageFocus);
}

function isIndiaDestination(destination: PublicDestination) {
  return (
    destination.destinationType === "Domestic" ||
    normalizeKey(destination.countryRegion).includes("india")
  );
}

function getDestinationImage(destination: PublicDestination, index: number) {
  return getHomeMediaUrl(
    destination.bannerImage ||
      destination.galleryImages?.[0] ||
      fallbackImages[index % fallbackImages.length] ||
      fallbackImages[0]
  );
}

function getDestinationSearchText(destination: PublicDestination) {
  return [
    destination.destinationId,
    destination.destinationName,
    destination.destinationType,
    destination.countryRegion,
    destination.state,
    destination.city,
    destination.primaryHeritageFocus,
    destination.shortDescription,
    destination.keyLandmarks.join(" "),
    destination.dressCode,
    destination.footwear,
    destination.permits,
    destination.idRequirement,
    destination.restrictions,
  ]
    .join(" ")
    .toLowerCase();
}

function createCountOptions(
  destinations: PublicDestination[],
  getValues: (destination: PublicDestination) => string[]
) {
  const counts = new Map<string, CountOption>();

  destinations.forEach((destination) => {
    getValues(destination).forEach((rawValue) => {
      const label = normalizeValue(rawValue);

      if (!label) {
        return;
      }

      const key = normalizeKey(label);
      const current = counts.get(key);

      counts.set(key, {
        count: (current?.count || 0) + 1,
        label: current?.label || label,
        value: key,
      });
    });
  });

  return Array.from(counts.values()).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

function getCategoryCount(
  destinations: PublicDestination[],
  category: CategoryFilter
) {
  return destinations.filter((destination) =>
    matchesCategory(destination, category)
  ).length;
}

function matchesCategory(
  destination: PublicDestination,
  category: CategoryFilter
) {
  switch (category) {
    case "india":
      return isIndiaDestination(destination);
    case "international":
      return !isIndiaDestination(destination);
    case "unesco-site":
      return destination.unescoSite;
    case "all":
      return true;
  }
}

function hasSelection(selection: string[], value: string) {
  return selection.includes(value);
}

function toggleSelection(selection: string[], value: string) {
  return hasSelection(selection, value)
    ? selection.filter((item) => item !== value)
    : [...selection, value];
}

function matchesOption(
  selection: string[],
  values: string[]
) {
  if (selection.length === 0) {
    return true;
  }

  const normalizedValues = values.map(normalizeKey).filter(Boolean);

  return selection.some((selectedValue) =>
    normalizedValues.includes(selectedValue)
  );
}

function getRecommendedScore(destination: PublicDestination) {
  return (
    (destination.unescoSite ? 8 : 0) +
    (destination.bannerImage ? 5 : 0) +
    Math.min(destination.galleryImages.length, 4) +
    Math.min(destination.keyLandmarks.length, 4) +
    (destination.shortDescription ? 1 : 0)
  );
}

function getDateValue(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortDestinations(destinations: PublicDestination[], sortMode: SortMode) {
  return [...destinations].sort((left, right) => {
    if (sortMode === "name") {
      return left.destinationName.localeCompare(right.destinationName);
    }

    if (sortMode === "duration") {
      return left.recommendedDurationDays - right.recommendedDurationDays;
    }

    if (sortMode === "newest") {
      return getDateValue(right.updatedAt) - getDateValue(left.updatedAt);
    }

    return getRecommendedScore(right) - getRecommendedScore(left);
  });
}

function formatShowingRange(currentPage: number, totalCount: number) {
  if (totalCount === 0) {
    return "Showing 0 destinations";
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return `Showing ${start} - ${end} of ${totalCount} destinations`;
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

export function DestinationsPage({
  initialSearchQuery = "",
}: {
  initialSearchQuery?: string;
}) {
  const [destinations, setDestinations] = useState<PublicDestination[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedFocuses, setSelectedFocuses] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDestinations() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await listPublicDestinations();

        if (isMounted) {
          setDestinations(response.data.destinations);
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

    loadDestinations();

    return () => {
      isMounted = false;
    };
  }, []);

  const stateOptions = useMemo(
    () => createCountOptions(destinations, (destination) => [destination.state]),
    [destinations]
  );
  const focusOptions = useMemo(
    () => createCountOptions(destinations, getFocusLabels),
    [destinations]
  );

  const categoryTabs = useMemo(
    () => [
      {
        icon: Sparkles,
        id: "all" as const,
        label: "All",
        count: getCategoryCount(destinations, "all"),
      },
      {
        icon: MapPin,
        id: "india" as const,
        label: "India",
        count: getCategoryCount(destinations, "india"),
      },
      {
        icon: Globe2,
        id: "international" as const,
        label: "International",
        count: getCategoryCount(destinations, "international"),
      },
      {
        icon: BadgeCheck,
        id: "unesco-site" as const,
        label: "UNESCO Site",
        count: getCategoryCount(destinations, "unesco-site"),
      },
    ],
    [destinations]
  );

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = destinations.filter((destination) => {
      const matchesSearch =
        !query || getDestinationSearchText(destination).includes(query);
      const matchesState = matchesOption(selectedStates, [destination.state]);
      const matchesFocus = matchesOption(
        selectedFocuses,
        getFocusLabels(destination)
      );

      return (
        matchesCategory(destination, activeCategory) &&
        matchesSearch &&
        matchesState &&
        matchesFocus
      );
    });

    return sortDestinations(filtered, sortMode);
  }, [
    activeCategory,
    destinations,
    searchQuery,
    selectedFocuses,
    selectedStates,
    sortMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredDestinations.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const visibleDestinations = filteredDestinations.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );
  const activeFilterCount = selectedStates.length + selectedFocuses.length;

  function clearFilters() {
    setSelectedStates([]);
    setSelectedFocuses([]);
  }

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeroSection
        categoryTabs={categoryTabs}
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        onCategoryChange={setActiveCategory}
        onSearchQueryChange={setSearchQuery}
      />

      <section
        className={cn(
          "mx-auto grid w-full max-w-[1300px] items-start gap-6 px-5 pb-12 pt-8 transition-[grid-template-columns] duration-300 sm:px-8 lg:px-0",
          isFilterCollapsed
            ? "lg:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[84px_minmax(0,1fr)]"
            : "lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]"
        )}
      >
        <DestinationSidebar
          activeFilterCount={activeFilterCount}
          focusOptions={focusOptions}
          isCollapsed={isFilterCollapsed}
          selectedFocuses={selectedFocuses}
          selectedStates={selectedStates}
          stateOptions={stateOptions}
          onClearFilters={clearFilters}
          onCollapsedChange={setIsFilterCollapsed}
          onFocusToggle={(value) =>
            setSelectedFocuses((current) => toggleSelection(current, value))
          }
          onStateToggle={(value) =>
            setSelectedStates((current) => toggleSelection(current, value))
          }
        />

        <section className="min-w-0">
          <ResultsHeader
            currentPage={activePage}
            destinationCount={filteredDestinations.length}
            isLoading={isLoading}
            sortMode={sortMode}
            activeCategoryLabel={
              categoryTabs.find((tab) => tab.id === activeCategory)?.label || "All"
            }
            onSortModeChange={setSortMode}
          />

          {loadError ? (
            <EmptyState
              title="Destinations could not load"
              message={loadError}
            />
          ) : null}

          {!loadError ? (
            <DestinationGrid
              destinations={visibleDestinations}
              isLoading={isLoading}
            />
          ) : null}

          {!isLoading && !loadError && filteredDestinations.length === 0 ? (
            <EmptyState
              title="No destinations found"
              message="Try changing search text or clearing filters."
            />
          ) : null}

          {!isLoading && !loadError && filteredDestinations.length > pageSize ? (
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

function HeroSection({
  activeCategory,
  categoryTabs,
  onCategoryChange,
  onSearchQueryChange,
  searchQuery,
}: {
  activeCategory: CategoryFilter;
  categoryTabs: Array<{
    count: number;
    icon: LucideIcon;
    id: CategoryFilter;
    label: string;
  }>;
  onCategoryChange: (category: CategoryFilter) => void;
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#fff2e5]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Ancient temple destination landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,248,240,0.96)_0%,rgba(255,248,240,0.84)_38%,rgba(255,248,240,0.32)_72%,rgba(255,248,240,0.1)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,248,240,0)_0%,#fff8f0_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[370px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-8 lg:px-0">
        <Header />

        <div className="grid flex-1 items-center gap-8 pb-14 pt-8 md:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
          <div className="max-w-[600px]">
            <p className="font-sans text-[11px] font-bold uppercase tracking-normal text-primary">
              Explore timeless destinations
            </p>
            <h1 className="mt-4 font-heading text-[40px] font-bold leading-[1.05] tracking-normal text-secondary sm:text-[56px]">
              Discover places that
              <span className="block">inspire your journey</span>
            </h1>
            <p className="mt-5 max-w-[430px] font-sans text-[13px] leading-[1.75] text-secondary/78 sm:text-[14px]">
              From ancient monuments to spiritual retreats, explore places
              shaped by living heritage and local stories.
            </p>
          </div>

          <label className="relative self-end md:justify-self-end">
            <span className="sr-only">Search destinations</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search destinations, places..."
              className="h-13 w-full rounded-full border border-[#ead8c5] bg-white px-5 pr-12 font-sans text-[13px] font-semibold text-secondary shadow-[0_16px_38px_rgba(67,43,27,0.14)] outline-none transition-colors placeholder:text-secondary/42 focus:border-primary focus:ring-3 focus:ring-primary/18 md:w-[360px]"
            />
            <Search className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2 text-primary" />
          </label>
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-7 w-full max-w-[1300px] px-5 sm:px-8 lg:px-0">
        <div className="flex flex-wrap gap-3 rounded-[8px] border border-[#ead8c5] bg-white/95 p-3 shadow-[0_18px_44px_rgba(67,43,27,0.12)] backdrop-blur">
          {categoryTabs.map(({ count, icon: Icon, id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onCategoryChange(id)}
              aria-pressed={activeCategory === id}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 font-sans text-[12px] font-bold transition-all",
                activeCategory === id
                  ? "border-primary bg-primary text-white shadow-[0_10px_24px_rgba(212,114,32,0.24)]"
                  : "border-[#ead8c5] bg-white text-secondary hover:border-primary hover:text-primary"
              )}
            >
              <Icon className="size-4" strokeWidth={1.8} />
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  activeCategory === id ? "bg-white/20 text-white" : "bg-[#fff1e5] text-primary"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function DestinationSidebar({
  activeFilterCount,
  focusOptions,
  isCollapsed,
  onClearFilters,
  onCollapsedChange,
  onFocusToggle,
  onStateToggle,
  selectedFocuses,
  selectedStates,
  stateOptions,
}: {
  activeFilterCount: number;
  focusOptions: CountOption[];
  isCollapsed: boolean;
  selectedFocuses: string[];
  selectedStates: string[];
  stateOptions: CountOption[];
  onClearFilters: () => void;
  onCollapsedChange: (value: boolean) => void;
  onFocusToggle: (value: string) => void;
  onStateToggle: (value: string) => void;
}) {
  if (isCollapsed) {
    return (
      <aside className="lg:sticky lg:top-5 lg:z-20 lg:self-start">
        <div className="flex items-center justify-center gap-2 rounded-[8px] border border-[#ead8c5] bg-white p-2 shadow-[0_12px_32px_rgba(67,43,27,0.07)] lg:flex-col">
          <button
            type="button"
            aria-label="Maximize destination filters"
            onClick={() => onCollapsedChange(false)}
            className="grid size-10 place-items-center rounded-[7px] border border-primary/25 bg-primary/8 text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            aria-label="Open state filters"
            onClick={() => onCollapsedChange(false)}
            className="relative grid size-10 place-items-center rounded-[7px] text-secondary transition-colors hover:bg-primary/8 hover:text-primary"
          >
            <Landmark className="size-4" strokeWidth={1.8} />
            {selectedStates.length > 0 ? (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
            ) : null}
          </button>
          <button
            type="button"
            aria-label="Open heritage focus filters"
            onClick={() => onCollapsedChange(false)}
            className="relative grid size-10 place-items-center rounded-[7px] text-secondary transition-colors hover:bg-primary/8 hover:text-primary"
          >
            <Sparkles className="size-4" strokeWidth={1.8} />
            {selectedFocuses.length > 0 ? (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
            ) : null}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-3 lg:sticky lg:top-5 lg:z-20 lg:self-start">
      <div className="rounded-[8px] border border-[#ead8c5] bg-white p-4 shadow-[0_12px_32px_rgba(67,43,27,0.07)] transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-sans text-[14px] font-bold text-secondary">
            Filter Destinations
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearFilters}
              disabled={activeFilterCount === 0}
              className="font-sans text-[11px] font-bold text-primary transition-colors hover:text-accent disabled:pointer-events-none disabled:text-secondary/35"
            >
              Reset All
            </button>
            <button
              type="button"
              aria-controls="destination-filter-panel"
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

        <div id="destination-filter-panel">
          <div className="mt-4 space-y-5">
            <FilterOptionGroup
              icon={Landmark}
              options={stateOptions}
              selectedValues={selectedStates}
              title="By State"
              onToggle={onStateToggle}
            />
            <FilterOptionGroup
              icon={Sparkles}
              options={focusOptions}
              selectedValues={selectedFocuses}
              title="Heritage Focus"
              onToggle={onFocusToggle}
            />
          </div>

          <button
            type="button"
            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-primary bg-white px-4 font-sans text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <SlidersHorizontal className="size-4" />
            Apply Filters
          </button>
        </div>
      </div>
    </aside>
  );
}

function FilterOptionGroup({
  icon: Icon,
  options,
  onToggle,
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
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-[6px] px-1 py-1 font-sans text-[11px] font-semibold text-secondary/72 transition-colors hover:text-primary"
          >
            <input
              checked={hasSelection(selectedValues, option.value)}
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

function ResultsHeader({
  activeCategoryLabel,
  currentPage,
  destinationCount,
  isLoading,
  onSortModeChange,
  sortMode,
}: {
  activeCategoryLabel: string;
  currentPage: number;
  destinationCount: number;
  isLoading: boolean;
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-sans text-[11px] font-bold uppercase tracking-normal text-primary">
          {activeCategoryLabel}
        </p>
        <h2 className="mt-1 font-heading text-[30px] font-bold leading-tight text-secondary sm:text-[36px]">
          Top Destinations
        </h2>
        <p className="mt-1 font-sans text-[12px] font-semibold text-secondary/56">
          {isLoading ? "Loading live destinations..." : formatShowingRange(currentPage, destinationCount)}
        </p>
      </div>

      <label className="flex h-10 w-full items-center gap-3 rounded-[7px] border border-[#ead8c5] bg-white px-3 font-sans text-[11px] font-bold text-secondary shadow-[0_8px_20px_rgba(67,43,27,0.05)] sm:w-auto">
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
    </div>
  );
}

function DestinationGrid({
  destinations,
  isLoading,
}: {
  destinations: PublicDestination[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_item, index) => (
          <div
            key={index}
            className="aspect-[1.04/1] min-h-[300px] animate-pulse rounded-[16px] bg-[#ead8c5]/65"
          />
        ))}
      </div>
    );
  }

  if (destinations.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {destinations.map((destination, index) => (
        <DestinationCard
          key={destination.id || destination.destinationId}
          destination={destination}
          image={getDestinationImage(destination, index)}
        />
      ))}
    </div>
  );
}

function DestinationCard({
  destination,
  image,
}: {
  destination: PublicDestination;
  image: string;
}) {
  const title = destination.destinationName;

  return (
    <article className="group relative aspect-[1.04/1] min-h-[300px] overflow-hidden rounded-[16px] bg-secondary shadow-[0_16px_34px_rgba(67,43,27,0.11)]">
      <Image
        src={image}
        alt={title}
        fill
        sizes="(min-width: 1280px) 310px, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.46)_0%,rgba(18,12,8,0.08)_48%,rgba(18,12,8,0.44)_100%)]" />

      <div className="absolute inset-x-0 top-0 p-6">
        <h3 className="min-w-0 truncate font-sans text-[20px] font-semibold leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
          {title}
        </h3>
      </div>

      <Link
        href={getDestinationHref(destination)}
        aria-label={`Explore ${title}`}
        className="absolute bottom-7 left-7 inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-secondary/62 pl-5 pr-1.5 font-sans text-[14px] font-semibold text-white shadow-[0_14px_32px_rgba(35,23,15,0.24)] backdrop-blur transition-colors hover:bg-primary/90"
      >
        Explore
        <span className="grid size-9 place-items-center rounded-full bg-white text-secondary transition-transform duration-300 group-hover:translate-x-0.5">
          <ArrowRight className="size-4 -rotate-45 transition-transform duration-300 group-hover:rotate-0" strokeWidth={2.2} />
        </span>
      </Link>
    </article>
  );
}

function EmptyState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <div className="mt-6 rounded-[8px] border border-dashed border-[#ead8c5] bg-white/72 px-5 py-10 text-center">
      <h3 className="font-heading text-[24px] font-bold text-secondary">
        {title}
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
    <nav
      aria-label="Destination pagination"
      className="mt-8 flex items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <PaginationButton
          label="Previous destinations page"
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
              label={`Go to destinations page ${page}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </PaginationButton>
          </span>
        );
      })}

      {currentPage < totalPages ? (
        <PaginationButton
          label="Next destinations page"
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
