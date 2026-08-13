"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  Globe2,
  Heart,
  Landmark,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { getHomeMediaUrl, listPublicDestinations, type PublicDestination } from "@/lib/home-travel";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "india" | "international" | "popular-states";
type SortMode = "recommended" | "newest" | "name" | "duration";

type CountOption = {
  count: number;
  label: string;
  value: string;
};

type DurationOption = CountOption & {
  max?: number;
  min: number;
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

const durationRanges: Array<Omit<DurationOption, "count">> = [
  { label: "1-3 Days", max: 3, min: 1, value: "short" },
  { label: "4-7 Days", max: 7, min: 4, value: "classic" },
  { label: "8+ Days", min: 8, value: "long" },
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

function getPrimaryFocus(destination: PublicDestination) {
  return getFocusLabels(destination)[0] || destination.primaryHeritageFocus || "Heritage";
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

function getLocationLabel(destination: PublicDestination) {
  return [
    destination.city,
    destination.state,
    destination.countryRegion,
  ]
    .map(normalizeValue)
    .filter(Boolean)
    .filter((part, index, source) => source.indexOf(part) === index)
    .join(", ");
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

function getDurationRange(destination: PublicDestination) {
  const days = destination.recommendedDurationDays || 1;

  return durationRanges.find(
    (range) => days >= range.min && (range.max === undefined || days <= range.max)
  );
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

function getDurationOptions(destinations: PublicDestination[]) {
  return durationRanges
    .map((range) => ({
      ...range,
      count: destinations.filter((destination) => {
        const matchedRange = getDurationRange(destination);

        return matchedRange?.value === range.value;
      }).length,
    }))
    .filter((option) => option.count > 0);
}

function getTypeOptions(destinations: PublicDestination[]) {
  return createCountOptions(destinations, (destination) => [
    destination.destinationType === "Domestic" ? "India" : "International",
  ]);
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
    case "popular-states":
      return Boolean(normalizeValue(destination.state));
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

export function DestinationsPage() {
  const [destinations, setDestinations] = useState<PublicDestination[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFocuses, setSelectedFocuses] = useState<string[]>([]);
  const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
  const [unescoOnly, setUnescoOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [currentPage, setCurrentPage] = useState(1);
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

  const regionOptions = useMemo(
    () => createCountOptions(destinations, (destination) => [destination.countryRegion]),
    [destinations]
  );
  const stateOptions = useMemo(
    () => createCountOptions(destinations, (destination) => [destination.state]),
    [destinations]
  );
  const typeOptions = useMemo(() => getTypeOptions(destinations), [destinations]);
  const focusOptions = useMemo(
    () => createCountOptions(destinations, getFocusLabels),
    [destinations]
  );
  const durationOptions = useMemo(
    () => getDurationOptions(destinations),
    [destinations]
  );
  const unescoCount = useMemo(
    () => destinations.filter((destination) => destination.unescoSite).length,
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
        icon: Landmark,
        id: "popular-states" as const,
        label: "Popular States",
        count: getCategoryCount(destinations, "popular-states"),
      },
    ],
    [destinations]
  );

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = destinations.filter((destination) => {
      const matchesSearch =
        !query || getDestinationSearchText(destination).includes(query);
      const matchesRegion = matchesOption(selectedRegions, [
        destination.countryRegion,
      ]);
      const matchesState = matchesOption(selectedStates, [destination.state]);
      const matchesType = matchesOption(selectedTypes, [
        destination.destinationType === "Domestic" ? "India" : "International",
      ]);
      const matchesFocus = matchesOption(
        selectedFocuses,
        getFocusLabels(destination)
      );
      const durationRange = getDurationRange(destination);
      const matchesDuration =
        selectedDurations.length === 0 ||
        (durationRange ? selectedDurations.includes(durationRange.value) : false);
      const matchesUnesco = !unescoOnly || destination.unescoSite;

      return (
        matchesCategory(destination, activeCategory) &&
        matchesSearch &&
        matchesRegion &&
        matchesState &&
        matchesType &&
        matchesFocus &&
        matchesDuration &&
        matchesUnesco
      );
    });

    return sortDestinations(filtered, sortMode);
  }, [
    activeCategory,
    destinations,
    searchQuery,
    selectedDurations,
    selectedFocuses,
    selectedRegions,
    selectedStates,
    selectedTypes,
    sortMode,
    unescoOnly,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredDestinations.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const visibleDestinations = filteredDestinations.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );
  const activeFilterCount =
    selectedRegions.length +
    selectedStates.length +
    selectedTypes.length +
    selectedFocuses.length +
    selectedDurations.length +
    (unescoOnly ? 1 : 0);

  function clearFilters() {
    setSelectedRegions([]);
    setSelectedStates([]);
    setSelectedTypes([]);
    setSelectedFocuses([]);
    setSelectedDurations([]);
    setUnescoOnly(false);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff8f0] text-secondary">
      <HeroSection
        categoryTabs={categoryTabs}
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        onCategoryChange={setActiveCategory}
        onSearchQueryChange={setSearchQuery}
      />

      <section className="mx-auto grid w-full max-w-[1300px] gap-6 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-0 xl:grid-cols-[280px_minmax(0,1fr)]">
        <DestinationSidebar
          activeFilterCount={activeFilterCount}
          durationOptions={durationOptions}
          focusOptions={focusOptions}
          regionOptions={regionOptions}
          selectedDurations={selectedDurations}
          selectedFocuses={selectedFocuses}
          selectedRegions={selectedRegions}
          selectedStates={selectedStates}
          selectedTypes={selectedTypes}
          stateOptions={stateOptions}
          typeOptions={typeOptions}
          unescoCount={unescoCount}
          unescoOnly={unescoOnly}
          onClearFilters={clearFilters}
          onDurationToggle={(value) =>
            setSelectedDurations((current) => toggleSelection(current, value))
          }
          onFocusToggle={(value) =>
            setSelectedFocuses((current) => toggleSelection(current, value))
          }
          onRegionToggle={(value) =>
            setSelectedRegions((current) => toggleSelection(current, value))
          }
          onStateToggle={(value) =>
            setSelectedStates((current) => toggleSelection(current, value))
          }
          onTypeToggle={(value) =>
            setSelectedTypes((current) => toggleSelection(current, value))
          }
          onUnescoOnlyChange={setUnescoOnly}
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
  durationOptions,
  focusOptions,
  onClearFilters,
  onDurationToggle,
  onFocusToggle,
  onRegionToggle,
  onStateToggle,
  onTypeToggle,
  onUnescoOnlyChange,
  regionOptions,
  selectedDurations,
  selectedFocuses,
  selectedRegions,
  selectedStates,
  selectedTypes,
  stateOptions,
  typeOptions,
  unescoCount,
  unescoOnly,
}: {
  activeFilterCount: number;
  durationOptions: DurationOption[];
  focusOptions: CountOption[];
  regionOptions: CountOption[];
  selectedDurations: string[];
  selectedFocuses: string[];
  selectedRegions: string[];
  selectedStates: string[];
  selectedTypes: string[];
  stateOptions: CountOption[];
  typeOptions: CountOption[];
  unescoCount: number;
  unescoOnly: boolean;
  onClearFilters: () => void;
  onDurationToggle: (value: string) => void;
  onFocusToggle: (value: string) => void;
  onRegionToggle: (value: string) => void;
  onStateToggle: (value: string) => void;
  onTypeToggle: (value: string) => void;
  onUnescoOnlyChange: (checked: boolean) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-[108px] lg:max-h-[calc(100vh-124px)] lg:self-start lg:overflow-y-auto lg:pr-1">
      <div className="rounded-[8px] border border-[#ead8c5] bg-white p-4 shadow-[0_12px_32px_rgba(67,43,27,0.07)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-sans text-[14px] font-bold text-secondary">
            Filter Destinations
          </h2>
          <button
            type="button"
            onClick={onClearFilters}
            disabled={activeFilterCount === 0}
            className="font-sans text-[11px] font-bold text-primary transition-colors hover:text-accent disabled:pointer-events-none disabled:text-secondary/35"
          >
            Reset All
          </button>
        </div>

        <div className="mt-4 space-y-5">
          <FilterOptionGroup
            icon={Globe2}
            options={typeOptions}
            selectedValues={selectedTypes}
            title="By Type"
            onToggle={onTypeToggle}
          />
          <FilterOptionGroup
            icon={MapPin}
            options={regionOptions}
            selectedValues={selectedRegions}
            title="By Country / Region"
            onToggle={onRegionToggle}
          />
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
          <FilterOptionGroup
            icon={Clock3}
            options={durationOptions}
            selectedValues={selectedDurations}
            title="Duration"
            onToggle={onDurationToggle}
          />

          {unescoCount > 0 ? (
            <section>
              <h3 className="flex items-center gap-2 font-sans text-[12px] font-bold text-secondary">
                <BadgeCheck className="size-4 text-primary" strokeWidth={1.8} />
                UNESCO Heritage
              </h3>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[6px] px-1 py-1 font-sans text-[11px] font-semibold text-secondary/72 transition-colors hover:text-primary">
                <input
                  checked={unescoOnly}
                  onChange={(event) => onUnescoOnlyChange(event.target.checked)}
                  type="checkbox"
                  className="size-4 rounded border-[#d7b89a] accent-primary"
                />
                <span className="min-w-0 flex-1">UNESCO World Heritage</span>
                <span className="text-secondary/42">{unescoCount}</span>
              </label>
            </section>
          ) : null}
        </div>

        <button
          type="button"
          className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-primary bg-white px-4 font-sans text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          <SlidersHorizontal className="size-4" />
          Apply Filters
        </button>
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
      <div className="mt-3 max-h-[132px] space-y-1.5 overflow-y-auto pr-1">
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
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_item, index) => (
          <div
            key={index}
            className="h-[268px] animate-pulse rounded-[8px] border border-[#ead8c5] bg-white"
          >
            <div className="h-[134px] rounded-t-[8px] bg-[#ead8c5]/65" />
            <div className="space-y-2.5 p-3.5">
              <div className="h-3 w-24 rounded bg-[#ead8c5]/65" />
              <div className="h-5 w-3/4 rounded bg-[#ead8c5]/65" />
              <div className="h-3 w-full rounded bg-[#ead8c5]/65" />
              <div className="h-3 w-2/3 rounded bg-[#ead8c5]/65" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (destinations.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
  const focus = getPrimaryFocus(destination);
  const locationLabel = getLocationLabel(destination) || destination.countryRegion;

  return (
    <article className="group overflow-hidden rounded-[8px] border border-[#ead8c5] bg-white shadow-[0_14px_34px_rgba(67,43,27,0.07)] transition-all hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_20px_46px_rgba(67,43,27,0.12)]">
      <div className="relative h-[136px] overflow-hidden bg-muted">
        <Image
          src={image}
          alt={destination.destinationName}
          fill
          sizes="(min-width: 1280px) 305px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,14,8,0.04)_0%,rgba(22,14,8,0.36)_100%)]" />
        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-0.5 font-sans text-[9px] font-bold uppercase text-primary shadow-[0_8px_16px_rgba(35,23,15,0.12)]">
          {destination.unescoSite ? "UNESCO" : destination.destinationType}
        </span>
        <button
          type="button"
          aria-label={`Save ${destination.destinationName}`}
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-full border border-white/60 bg-white/20 text-white backdrop-blur transition-colors hover:bg-primary"
        >
          <Heart className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>

      <div className="p-3.5">
        <p className="flex min-h-[16px] items-center gap-1.5 font-sans text-[10px] font-semibold text-primary">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="truncate">{locationLabel || "Ancient Trails"}</span>
        </p>
        <h3 className="mt-1.5 line-clamp-1 font-heading text-[18px] font-bold leading-tight text-secondary">
          {destination.destinationName}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-[34px] font-sans text-[10.5px] leading-[1.6] text-secondary/68">
          {destination.shortDescription ||
            `${focus} destination with ${destination.recommendedDurationDays} day recommended stay.`}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <InfoPill icon={Clock3} label={`${destination.recommendedDurationDays} Days`} />
          <InfoPill icon={Landmark} label={focus} />
        </div>

        {destination.keyLandmarks.length > 0 ? (
          <p className="mt-2 line-clamp-1 font-sans text-[9.5px] font-medium text-secondary/54">
            {destination.keyLandmarks.slice(0, 2).join(" | ")}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-[#ead8c5] pt-2.5">
          <span className="font-sans text-[10px] font-semibold text-secondary/48">
            {destination.destinationId}
          </span>
          <Link
            href={`/destinations/${encodeURIComponent(destination.destinationId)}`}
            aria-label={`Explore ${destination.destinationName}`}
            className="grid size-7 shrink-0 place-items-center rounded-full border border-primary bg-white text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function InfoPill({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#fff1e5] px-2 py-0.5 font-sans text-[9.5px] font-bold text-primary">
      <Icon className="size-3 shrink-0" strokeWidth={1.8} />
      <span className="truncate">{label}</span>
    </span>
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
