"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicMegaMenu,
  listPublicDestinations,
  listPublicTours,
  type PublicMegaMenuContent,
  type PublicDestination,
  type PublicTour,
} from "@/lib/home-travel";
import { getDestinationHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CategoryFilter = "india" | "international" | "popular-cities" | "unesco-sites";

type CountOption = {
  count: number;
  label: string;
  value: string;
};

const pageSize = 6;
const pageContainerClassName =
  "mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-0";

const fallbackImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/destination/Hoysalas.webp",
];

const categoryTabs: Array<{ id: CategoryFilter; label: string }> = [
  { id: "india", label: "India" },
  { id: "international", label: "International" },
  { id: "popular-cities", label: "Popular cities" },
  { id: "unesco-sites", label: "UNESCO sites" },
];

const interestTabs = [
  "Heritage",
  "Spiritual",
  "Cultural",
  "Archaeological",
  "Art Heritage",
  "Architecture",
  "Food Heritage",
  "Tribal Heritage",
  "Unesco Heritage",
  "Photography",
  "History",
  "Temples",
  "Nature",
  "Shopping",
].map((label) => ({
  label,
  value: normalizeKey(label),
  keywords: getInterestKeywords(label),
}));

const indianRegionMap = [
  {
    label: "Central India",
    keywords: ["madhya pradesh", "chhattisgarh", "jharkhand"],
  },
  {
    label: "North India",
    keywords: [
      "delhi",
      "haryana",
      "himachal pradesh",
      "jammu",
      "kashmir",
      "ladakh",
      "punjab",
      "uttar pradesh",
      "uttarakhand",
    ],
  },
  {
    label: "West India",
    keywords: ["rajasthan", "gujarat", "maharashtra", "goa", "daman", "diu"],
  },
  {
    label: "East India",
    keywords: [
      "assam",
      "bihar",
      "odisha",
      "west bengal",
      "sikkim",
      "arunachal pradesh",
      "manipur",
      "meghalaya",
      "mizoram",
      "nagaland",
      "tripura",
    ],
  },
  {
    label: "South India",
    keywords: [
      "andhra pradesh",
      "karnataka",
      "kerala",
      "lakshadweep",
      "puducherry",
      "tamil nadu",
      "telangana",
    ],
  },
];

const regionOrder = [
  "central india",
  "north india",
  "west india",
  "east india",
  "south india",
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

function normalizeId(value: string) {
  return value.trim().toUpperCase();
}

function splitLabels(value: string) {
  return value
    .split(/[,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();

  return labels.filter((label) => {
    const key = normalizeKey(label);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function getInterestKeywords(label: string) {
  switch (normalizeKey(label)) {
    case "spiritual":
      return ["spiritual", "sacred", "pilgrim", "ghat", "temple", "shrine"];
    case "cultural":
      return ["cultural", "culture", "festival", "tradition", "living heritage"];
    case "archaeological":
      return ["archaeological", "archaeology", "ruins", "caves", "excavation"];
    case "art heritage":
      return ["art", "sculpture", "painting", "craft", "carving"];
    case "architecture":
      return ["architecture", "architectural", "palace", "fort", "temple", "monument"];
    case "food heritage":
      return ["food", "cuisine", "culinary", "kitchen", "bazaar"];
    case "tribal heritage":
      return ["tribal", "indigenous", "folk"];
    case "unesco heritage":
      return ["unesco", "world heritage"];
    case "photography":
      return ["photo", "photography", "landscape", "view", "sunset"];
    case "history":
      return ["history", "historic", "historical", "ancient", "medieval"];
    case "temples":
      return ["temple", "mandir", "shrine"];
    case "nature":
      return ["nature", "river", "lake", "forest", "hill", "mountain", "landscape"];
    case "shopping":
      return ["shopping", "market", "bazaar", "craft", "souvenir"];
    default:
      return ["heritage", "monument", "temple", "palace", "fort", "ancient"];
  }
}

function getFocusLabels(destination: PublicDestination) {
  const labels = splitLabels(destination.primaryHeritageFocus);

  if (
    destination.unescoSite &&
    !labels.some((label) => normalizeKey(label).includes("unesco"))
  ) {
    labels.push("Unesco Heritage");
  }

  return uniqueLabels(labels);
}

function isIndiaDestination(destination: PublicDestination) {
  return (
    destination.destinationType === "Domestic" ||
    normalizeKey(destination.countryRegion).includes("india")
  );
}

function getRegionLabels(destination: PublicDestination) {
  const explicitRegions = splitLabels(destination.region || "");

  if (explicitRegions.length > 0) {
    return uniqueLabels(explicitRegions);
  }

  if (!isIndiaDestination(destination)) {
    return ["International"];
  }

  const stateKey = normalizeKey(destination.state);
  const matchedRegion = indianRegionMap.find((region) =>
    region.keywords.some((keyword) => stateKey.includes(keyword))
  );

  return [matchedRegion?.label || "India"];
}

function getCountryLabels(destination: PublicDestination) {
  return uniqueLabels(splitLabels(destination.countryRegion || ""));
}

function getDestinationImage(destination: PublicDestination, index: number) {
  return getHomeMediaUrl(
    destination.thumbnailImage ||
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
    destination.region,
    getRegionLabels(destination).join(" "),
    destination.state,
    destination.city,
    destination.primaryHeritageFocus,
    destination.bestTimeToVisit || "",
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
    uniqueLabels(getValues(destination)).forEach((rawValue) => {
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

function sortRegionOptions(options: CountOption[]) {
  return [...options].sort((left, right) => {
    const leftIndex = regionOrder.indexOf(left.value);
    const rightIndex = regionOrder.indexOf(right.value);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }

    return left.label.localeCompare(right.label);
  });
}

function matchesCategory(
  destination: PublicDestination,
  category: CategoryFilter,
  topCityDestinationIds: Set<string>
) {
  switch (category) {
    case "india":
      return isIndiaDestination(destination);
    case "international":
      return !isIndiaDestination(destination);
    case "popular-cities":
      return topCityDestinationIds.size > 0
        ? topCityDestinationIds.has(normalizeId(destination.destinationId))
        : Boolean(destination.city.trim());
    case "unesco-sites":
      return destination.unescoSite;
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

function matchesOption(selection: string[], values: string[]) {
  if (selection.length === 0) {
    return true;
  }

  const normalizedValues = values.map(normalizeKey).filter(Boolean);
  const joinedValues = normalizedValues.join(" ");

  return selection.some((selectedValue) =>
    normalizedValues.some(
      (value) =>
        value === selectedValue ||
        value.includes(selectedValue) ||
        selectedValue.includes(value)
    ) || joinedValues.includes(selectedValue)
  );
}

function matchesInterests(selection: string[], destination: PublicDestination) {
  if (selection.length === 0) {
    return true;
  }

  const destinationText = getDestinationSearchText(destination);

  return selection.some((selectedValue) => {
    const tab = interestTabs.find((item) => item.value === selectedValue);

    if (!tab) {
      return destinationText.includes(selectedValue);
    }

    if (tab.value === "unesco heritage" && destination.unescoSite) {
      return true;
    }

    if (tab.value === "heritage") {
      return true;
    }

    return tab.keywords.some((keyword) => destinationText.includes(keyword));
  });
}

function getRecommendedScore(destination: PublicDestination) {
  return (
    (destination.unescoSite ? 8 : 0) +
    (destination.thumbnailImage || destination.bannerImage ? 5 : 0) +
    Math.min(destination.galleryImages.length, 4) +
    Math.min(destination.keyLandmarks.length, 4) +
    (destination.shortDescription ? 1 : 0)
  );
}

function getDestinationTourCategoryLabels(tours: PublicTour[]) {
  const categoryLabelsByDestinationId = new Map<string, string[]>();

  tours.forEach((tour) => {
    const tourCategories = uniqueLabels([
      ...splitLabels(tour.category || ""),
      ...splitLabels(tour.tourType || ""),
    ]);

    if (tourCategories.length === 0) {
      return;
    }

    const destinationIds = new Set(getTourDestinationIds(tour).map(normalizeId));

    destinationIds.forEach((destinationId) => {
      categoryLabelsByDestinationId.set(
        destinationId,
        uniqueLabels([
          ...(categoryLabelsByDestinationId.get(destinationId) || []),
          ...tourCategories,
        ])
      );
    });
  });

  return categoryLabelsByDestinationId;
}

function keepAvailableSelections(
  selection: string[],
  options: CountOption[]
) {
  if (selection.length === 0) {
    return selection;
  }

  const availableValues = new Set(options.map((option) => option.value));
  const nextSelection = selection.filter((value) => availableValues.has(value));

  return nextSelection.length === selection.length ? selection : nextSelection;
}

function sortDestinations(destinations: PublicDestination[]) {
  return [...destinations].sort(
    (left, right) => getRecommendedScore(right) - getRecommendedScore(left)
  );
}

function getInitialCategory(searchQuery: string): CategoryFilter {
  const query = normalizeKey(searchQuery);

  if (query.includes("international")) {
    return "international";
  }

  if (query.includes("popular")) {
    return "popular-cities";
  }

  if (query.includes("unesco")) {
    return "unesco-sites";
  }

  return "india";
}

function isPopularCitiesQuery(searchQuery: string) {
  const query = normalizeKey(searchQuery).replace(/[-_]+/g, " ");

  return query === "popular cities" || query === "top cities";
}

function isUnescoSitesQuery(searchQuery: string) {
  const query = normalizeKey(searchQuery).replace(/[-_]+/g, " ");

  return query === "unesco" || query === "unesco sites";
}

function getInitialSearchQuery(searchQuery: string) {
  return isPopularCitiesQuery(searchQuery) || isUnescoSitesQuery(searchQuery)
    ? ""
    : searchQuery;
}

function getTopCityDestinationIds(content: PublicMegaMenuContent | null) {
  return Array.from(
    new Set(
      (content?.destinationMenu.topCities || [])
        .map((item) => normalizeId(item.destinationId || item.referenceId))
        .filter(Boolean)
    )
  );
}

function getInitialRegionOption(
  searchQuery: string,
  regionOptions: CountOption[]
) {
  const query = normalizeKey(searchQuery);

  if (!query) {
    return undefined;
  }

  return regionOptions.find(
    (option) => option.value === query || normalizeKey(option.label) === query
  );
}

function getCategoryForRegion(
  regionValue: string,
  destinations: PublicDestination[]
): CategoryFilter {
  const matchingDestinations = destinations.filter((destination) =>
    getRegionLabels(destination).some(
      (regionLabel) => normalizeKey(regionLabel) === regionValue
    )
  );
  const hasInternationalDestination = matchingDestinations.some(
    (destination) => !isIndiaDestination(destination)
  );
  const hasIndiaDestination = matchingDestinations.some(isIndiaDestination);

  if (hasInternationalDestination && !hasIndiaDestination) {
    return "international";
  }

  return "india";
}

export function DestinationsPage({
  initialSearchQuery = "",
}: {
  initialSearchQuery?: string;
}) {
  const [destinations, setDestinations] = useState<PublicDestination[]>([]);
  const [tours, setTours] = useState<PublicTour[]>([]);
  const [topCityDestinationIds, setTopCityDestinationIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(() =>
    getInitialSearchQuery(initialSearchQuery)
  );
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(() =>
    getInitialCategory(initialSearchQuery)
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedFocuses, setSelectedFocuses] = useState<string[]>([]);
  const [visibleDestinationCount, setVisibleDestinationCount] =
    useState(pageSize);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDestinations() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [destinationsResponse, megaMenuResponse, toursResponse] =
          await Promise.all([
          listPublicDestinations(),
          listPublicMegaMenu().catch(() => null),
            listPublicTours().catch(() => null),
          ]);

        if (isMounted) {
          const loadedDestinations = destinationsResponse.data.destinations;
          const loadedRegionOptions = sortRegionOptions(
            createCountOptions(loadedDestinations, (destination) =>
              getRegionLabels(destination)
            )
          );
          const loadedCountryOptions = createCountOptions(
            loadedDestinations.filter(
              (destination) => !isIndiaDestination(destination)
            ),
            getCountryLabels
          );
          const initialRegion = getInitialRegionOption(
            initialSearchQuery,
            loadedRegionOptions
          );
          const initialCountry = initialRegion
            ? undefined
            : getInitialRegionOption(initialSearchQuery, loadedCountryOptions);

          setDestinations(loadedDestinations);
          setTours(toursResponse?.data.tours || []);
          setTopCityDestinationIds(
            getTopCityDestinationIds(megaMenuResponse?.data.megaMenu || null)
          );

          if (initialRegion) {
            setSearchQuery("");
            setSelectedRegions([initialRegion.value]);
            setActiveCategory(
              getCategoryForRegion(initialRegion.value, loadedDestinations)
            );
          } else if (initialCountry) {
            setSearchQuery("");
            setSelectedStates([initialCountry.value]);
            setActiveCategory("international");
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

    loadDestinations();

    return () => {
      isMounted = false;
    };
  }, [initialSearchQuery]);

  const topCityDestinationIdSet = useMemo(
    () => new Set(topCityDestinationIds),
    [topCityDestinationIds]
  );
  const filterOptionDestinations = useMemo(
    () =>
      destinations.filter((destination) =>
        matchesCategory(destination, activeCategory, topCityDestinationIdSet)
      ),
    [activeCategory, destinations, topCityDestinationIdSet]
  );
  const regionOptions = useMemo(
    () =>
      sortRegionOptions(
        createCountOptions(filterOptionDestinations, (destination) =>
          getRegionLabels(destination)
        )
      ),
    [filterOptionDestinations]
  );
  const activeSelectedRegions = useMemo(
    () => keepAvailableSelections(selectedRegions, regionOptions),
    [regionOptions, selectedRegions]
  );
  const regionScopedDestinations = useMemo(() => {
    if (activeSelectedRegions.length === 0) {
      return filterOptionDestinations;
    }

    return filterOptionDestinations.filter((destination) =>
      matchesOption(activeSelectedRegions, getRegionLabels(destination))
    );
  }, [activeSelectedRegions, filterOptionDestinations]);
  const stateOptions = useMemo(
    () =>
      createCountOptions(regionScopedDestinations, (destination) =>
        activeCategory === "international"
          ? getCountryLabels(destination)
          : [destination.state]
      ),
    [activeCategory, regionScopedDestinations]
  );
  const tourCategoriesByDestinationId = useMemo(
    () => getDestinationTourCategoryLabels(tours),
    [tours]
  );
  const activeSelectedStates = useMemo(
    () => keepAvailableSelections(selectedStates, stateOptions),
    [selectedStates, stateOptions]
  );
  const stateScopedDestinations = useMemo(() => {
    if (activeSelectedStates.length === 0) {
      return regionScopedDestinations;
    }

    return regionScopedDestinations.filter((destination) =>
      matchesOption(activeSelectedStates, [
        ...(activeCategory === "international"
          ? getCountryLabels(destination)
          : [destination.state]),
      ])
    );
  }, [activeCategory, activeSelectedStates, regionScopedDestinations]);
  const focusOptions = useMemo(
    () => createCountOptions(stateScopedDestinations, getFocusLabels),
    [stateScopedDestinations]
  );
  const activeSelectedFocuses = useMemo(
    () => keepAvailableSelections(selectedFocuses, focusOptions),
    [focusOptions, selectedFocuses]
  );

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = destinations.filter((destination) => {
      const matchesSearch =
        !query || getDestinationSearchText(destination).includes(query);
      const matchesRegion = matchesOption(
        activeSelectedRegions,
        getRegionLabels(destination)
      );
      const matchesState = matchesOption(activeSelectedStates, [
        ...(activeCategory === "international"
          ? getCountryLabels(destination)
          : [destination.state]),
      ]);
      const matchesFocus = matchesOption(
        activeSelectedFocuses,
        getFocusLabels(destination)
      );

      return (
        matchesCategory(destination, activeCategory, topCityDestinationIdSet) &&
        matchesSearch &&
        matchesRegion &&
        matchesState &&
        matchesFocus &&
        matchesInterests(selectedInterests, destination)
      );
    });

    return sortDestinations(filtered);
  }, [
    activeCategory,
    activeSelectedFocuses,
    activeSelectedRegions,
    activeSelectedStates,
    destinations,
    searchQuery,
    selectedInterests,
    topCityDestinationIdSet,
  ]);
  const visibleDestinations = useMemo(
    () => filteredDestinations.slice(0, visibleDestinationCount),
    [filteredDestinations, visibleDestinationCount]
  );
  const hasMoreDestinations =
    visibleDestinationCount < filteredDestinations.length;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const shouldLoadMore = visibleDestinationCount < filteredDestinations.length;

    if (!sentinel || !shouldLoadMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleDestinationCount((current) =>
          Math.min(current + pageSize, filteredDestinations.length)
        );
      },
      {
        rootMargin: "320px 0px",
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [filteredDestinations.length, visibleDestinationCount]);

  function resetVisibleDestinations() {
    setVisibleDestinationCount(pageSize);
  }

  function updateSearchQuery(value: string) {
    resetVisibleDestinations();
    setSearchQuery(value);
  }

  function updateCategory(category: CategoryFilter) {
    resetVisibleDestinations();
    setActiveCategory(category);
  }

  function toggleInterest(value: string) {
    resetVisibleDestinations();
    setSelectedInterests((current) => toggleSelection(current, value));
  }

  function toggleRegion(value: string) {
    resetVisibleDestinations();
    setSelectedRegions((current) => toggleSelection(current, value));
  }

  function toggleState(value: string) {
    resetVisibleDestinations();
    setSelectedStates((current) => toggleSelection(current, value));
  }

  function toggleFocus(value: string) {
    resetVisibleDestinations();
    setSelectedFocuses((current) => toggleSelection(current, value));
  }

  function clearAllFilters() {
    resetVisibleDestinations();
    setSearchQuery("");
    setActiveCategory("india");
    setSelectedInterests([]);
    setSelectedRegions([]);
    setSelectedStates([]);
    setSelectedFocuses([]);
  }

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    activeCategory !== "india" ||
    selectedInterests.length > 0 ||
    activeSelectedRegions.length > 0 ||
    activeSelectedStates.length > 0 ||
    activeSelectedFocuses.length > 0;

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeaderBand />

      <DestinationTopBar
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        onCategoryChange={updateCategory}
        onSearchQueryChange={updateSearchQuery}
      />

      <section className={`${pageContainerClassName} pt-6`}>
        <InterestFilter
          selectedInterests={selectedInterests}
          onInterestToggle={toggleInterest}
        />
      </section>

      <section className={`${pageContainerClassName} grid items-start gap-8 pb-14 pt-7 lg:grid-cols-[255px_minmax(0,1fr)] xl:gap-10`}>
        <DestinationSidebar
          activeCategory={activeCategory}
          focusOptions={focusOptions}
          hasActiveFilters={hasActiveFilters}
          regionOptions={regionOptions}
          selectedFocuses={activeSelectedFocuses}
          selectedRegions={activeSelectedRegions}
          selectedStates={activeSelectedStates}
          stateOptions={stateOptions}
          onClearAll={clearAllFilters}
          onFocusToggle={toggleFocus}
          onRegionToggle={toggleRegion}
          onStateToggle={toggleState}
        />

        <section className="min-w-0">
          <ResultsIntro />

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
            tourCategoriesByDestinationId={tourCategoriesByDestinationId}
          />
          ) : null}

          {!isLoading && !loadError && hasMoreDestinations ? (
            <div
              ref={loadMoreRef}
              className="mt-8 flex h-10 items-center justify-center font-sans text-[12px] font-semibold text-secondary/45"
            >
              Loading more destinations...
            </div>
          ) : null}

          {!isLoading && !loadError && filteredDestinations.length === 0 ? (
            <EmptyState
              title="No destinations found"
              message="Try changing search text or unticking a filter."
            />
          ) : null}

        </section>
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
      <div className="relative z-10 mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <Header />
      </div>
    </section>
  );
}

function DestinationTopBar({
  activeCategory,
  onCategoryChange,
  onSearchQueryChange,
  searchQuery,
}: {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
}) {
  return (
    <section className="border-b border-border bg-muted/45">
      <div className={`${pageContainerClassName} flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-wrap items-center gap-4">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeCategory === tab.id}
              suppressHydrationWarning
              onClick={() => onCategoryChange(tab.id)}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-full border px-5 font-sans text-[15px] font-semibold leading-none transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                activeCategory === tab.id
                  ? "border-primary bg-primary text-white"
                  : "border-primary/70 bg-white text-primary hover:bg-primary hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="relative w-full md:w-[235px]">
          <span className="sr-only">Search Destination</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search Destination"
            className="h-9 w-full rounded-full border border-primary/55 bg-white px-5 pr-10 font-sans text-[13px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/50 focus:border-primary focus:ring-3 focus:ring-primary/15"
          />
          <Search className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
        </label>
      </div>
    </section>
  );
}

function DestinationSidebar({
  activeCategory,
  focusOptions,
  hasActiveFilters,
  onClearAll,
  onFocusToggle,
  onRegionToggle,
  onStateToggle,
  regionOptions,
  selectedFocuses,
  selectedRegions,
  selectedStates,
  stateOptions,
}: {
  activeCategory: CategoryFilter;
  focusOptions: CountOption[];
  hasActiveFilters: boolean;
  regionOptions: CountOption[];
  selectedFocuses: string[];
  selectedRegions: string[];
  selectedStates: string[];
  stateOptions: CountOption[];
  onClearAll: () => void;
  onFocusToggle: (value: string) => void;
  onRegionToggle: (value: string) => void;
  onStateToggle: (value: string) => void;
}) {
  const [isStateFilterOpen, setIsStateFilterOpen] = useState(
    () => selectedRegions.length > 0
  );
  const [isFocusFilterOpen, setIsFocusFilterOpen] = useState(
    () => selectedStates.length > 0
  );
  const stateFilterTitle =
    activeCategory === "international" ? "Countries" : "States";

  function handleRegionToggle(value: string) {
    if (!hasSelection(selectedRegions, value)) {
      setIsStateFilterOpen(true);
    }

    onRegionToggle(value);
  }

  function handleStateToggle(value: string) {
    if (!hasSelection(selectedStates, value)) {
      setIsFocusFilterOpen(true);
    }

    onStateToggle(value);
  }

  return (
    <aside className="lg:sticky lg:top-[70px] lg:self-start">
      <div className="mb-4 flex items-center justify-between gap-3 font-sans leading-none">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase text-primary">
          <SlidersHorizontal className="size-4" strokeWidth={1.8} />
          <span>Filter your search</span>
        </div>
        <button
          type="button"
          disabled={!hasActiveFilters}
          onClick={onClearAll}
          className="text-[12px] font-bold text-primary transition-colors hover:text-accent disabled:pointer-events-none disabled:text-secondary/32"
        >
          Clear all
        </button>
      </div>

      <div className="rounded-[4px] border border-border bg-white px-5 py-5 ">
        <FilterOptionGroup
          options={regionOptions}
          selectedValues={selectedRegions}
          title="Regions"
          onToggle={handleRegionToggle}
        />
        <FilterOptionGroup
          options={stateOptions}
          selectedValues={selectedStates}
          title={stateFilterTitle}
          isCollapsible
          isOpen={isStateFilterOpen}
          onOpenToggle={() => setIsStateFilterOpen((current) => !current)}
          onToggle={handleStateToggle}
        />
        <FilterOptionGroup
          options={focusOptions}
          selectedValues={selectedFocuses}
          title="Heritage Focus"
          isCollapsible
          isOpen={isFocusFilterOpen}
          onOpenToggle={() => setIsFocusFilterOpen((current) => !current)}
          onToggle={onFocusToggle}
        />
      </div>
    </aside>
  );
}

function FilterOptionGroup({
  isCollapsible = false,
  isOpen = true,
  onOpenToggle,
  options,
  onToggle,
  selectedValues,
  title,
}: {
  isCollapsible?: boolean;
  isOpen?: boolean;
  options: CountOption[];
  selectedValues: string[];
  title: string;
  onOpenToggle?: () => void;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-[#f1ebe6] py-4 first:pt-0 last:border-b-0 last:pb-0">
      {isCollapsible ? (
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onOpenToggle}
          className="flex w-full items-center justify-between gap-3 font-sans text-[14px] font-semibold leading-none text-primary"
        >
          <span>{title}</span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              isOpen ? "rotate-180" : "rotate-0"
            )}
            strokeWidth={1.8}
          />
        </button>
      ) : (
        <h3 className="font-sans text-[14px] font-semibold leading-none text-primary">
          {title}
        </h3>
      )}

      {isOpen ? (
        <div className="mt-3 space-y-2">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2.5 font-sans text-[14px] font-medium leading-[1.25] text-secondary/68 transition-colors hover:text-primary"
            >
              <input
                checked={hasSelection(selectedValues, option.value)}
                onChange={() => onToggle(option.value)}
                type="checkbox"
                className="size-4 rounded-[2px] border-[#d9cdc3] accent-primary"
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="text-[12px] text-secondary/38">{option.count}</span>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InterestFilter({
  onInterestToggle,
  selectedInterests,
}: {
  selectedInterests: string[];
  onInterestToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-3 border-b border-primary/45 pb-5">
      <p className="font-sans text-description font-medium uppercase leading-none text-secondary">
        Pick your interest
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-3">
        {interestTabs.map((tab) => {
          const isActive = hasSelection(selectedInterests, tab.value);

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onInterestToggle(tab.value)}
              className={cn(
                "inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-full border px-5 font-sans text-[15px] font-normal leading-none transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isActive
                  ? "border-primary bg-primary text-white shadow-[0_6px_14px_rgba(212,114,32,0.18)]"
                  : "border-primary/70 bg-white text-secondary hover:bg-primary hover:text-white"
              )}
            >
              <span>{tab.label}</span>
              <span aria-hidden="true">{isActive ? "-" : "+"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultsIntro() {
  return (
    <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] md:items-end">
      <div>
        <p className="font-sans text-description font-medium uppercase leading-none tracking-normal text-primary">
          Explore heritage beyond borders
        </p>
        <h1 className="mt-2 max-w-[420px] font-heading text-title font-bold leading-none tracking-normal text-secondary">
          <span className="block">Find your perfect</span>
          <span className="block text-primary">experience</span>
        </h1>
      </div>

      <p className="max-w-[300px] font-sans text-description italic text-secondary md:justify-self-end">
        Guides, local transport, accommodation, and like-minded travelers are
        always included. Book securely & flexibly.
      </p>
    </div>
  );
}

function DestinationGrid({
  destinations,
  isLoading,
  tourCategoriesByDestinationId,
}: {
  destinations: PublicDestination[];
  isLoading: boolean;
  tourCategoriesByDestinationId: Map<string, string[]>;
}) {
  if (isLoading) {
    return (
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: pageSize }).map((_item, index) => (
          <div
            key={index}
            className="aspect-[0.95/1] min-h-[230px] animate-pulse rounded-[4px] bg-[#e7ddd5]"
          />
        ))}
      </div>
    );
  }

  if (destinations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {destinations.map((destination, index) => (
        <DestinationCard
          key={destination.id || destination.destinationId}
          categoryPills={
            tourCategoriesByDestinationId.get(
              normalizeId(destination.destinationId)
            ) || []
          }
          destination={destination}
          image={getDestinationImage(destination, index)}
        />
      ))}
    </div>
  );
}

function DestinationCard({
  categoryPills,
  destination,
  image,
}: {
  categoryPills: string[];
  destination: PublicDestination;
  image: string;
}) {
  const title = destination.destinationName;

  return (
    <Link
      href={getDestinationHref(destination)}
      aria-label={`Customize journey to ${title}`}
      className="group block"
    >
      <article className="relative aspect-[0.95/1] min-h-[230px] overflow-hidden rounded-[10px] bg-secondary ">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(min-width: 1280px) 250px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.06)_0%,rgba(18,12,8,0.12)_42%,rgba(18,12,8,0.82)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[34%] bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.38)_55%,rgba(0,0,0,0)_100%)]" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 pt-4 text-white">
          <h3 className="min-w-0 font-sans text-[18px] font-semibold leading-none tracking-normal ">
            {title}
          </h3>
          <ArrowRight
            aria-hidden="true"
            className="size-6 shrink-0  transition-transform duration-300 group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
          {categoryPills.length > 0 ? (
            <div className="mt-3 flex max-h-[112px] flex-wrap gap-1.5 overflow-hidden">
              {categoryPills.map((label, index) => (
                <span
                  key={label}
                  title={label}
                  style={{ transitionDelay: `${index * 70}ms` }}
                  className="inline-flex max-w-full translate-y-2 items-center rounded-full border border-white/25 bg-[#2b241f]/88 px-3 py-2 font-sans text-[11px] font-semibold leading-none text-white opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                >
                  <span className="truncate">{label}</span>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="inline-flex h-9 min-w-[124px] items-center justify-center rounded-[24px] border border-primary bg-white px-5 font-sans text-[15px] font-normal leading-none text-secondary transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:border-primary group-hover:bg-primary group-hover:text-white">
              <span className="truncate">Customize</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
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
    <div className="mt-6 rounded-[8px] border border-dashed border-[#e0d3c8] bg-white/75 px-5 py-10 text-center">
      <h3 className="font-sans text-[24px] font-semibold text-secondary">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-[420px] font-sans text-[12px] leading-[1.65] text-secondary/62">
        {message}
      </p>
    </div>
  );
}
