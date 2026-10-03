"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  "home-wide-frame mx-auto w-full px-5 sm:px-8 lg:px-0";

const fallbackImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/destination/Hoysalas.webp",
];

const destinationMasonryCardClasses = [
  "row-span-[11]",
  "row-span-[14]",
  "row-span-[10]",
  "row-span-[13]",
  "row-span-[12]",
  "row-span-[15]",
];

const categoryTabs: Array<{ id: CategoryFilter; label: string }> = [
  { id: "india", label: "India" },
  { id: "international", label: "International" },
  { id: "popular-cities", label: "Popular cities" },
  { id: "unesco-sites", label: "Unesco cities" },
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

  if (!isIndiaDestination(destination)) {
    return explicitRegions.length > 0
      ? uniqueLabels(explicitRegions)
      : [];
  }

  const specificRegions = explicitRegions.filter(
    (label) => !isGenericRegionLabel(label)
  );

  if (specificRegions.length > 0) {
    return uniqueLabels(specificRegions);
  }

  const stateKey = normalizeKey(destination.state);
  const matchedRegion = indianRegionMap.find((region) =>
    region.keywords.some((keyword) => stateKey.includes(keyword))
  );

  return matchedRegion ? [matchedRegion.label] : [];
}

function getCountryLabels(destination: PublicDestination) {
  return uniqueLabels(splitLabels(destination.countryRegion || ""));
}

function isGenericRegionLabel(label: string) {
  const key = normalizeKey(label);

  return key === "india" || key === "domestic" || key === "international";
}

function removeGenericRegionOptions(options: CountOption[]) {
  return options.filter((option) => !isGenericRegionLabel(option.label));
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
  const [isMobileInterestOpen, setIsMobileInterestOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
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
            removeGenericRegionOptions(
              createCountOptions(loadedDestinations, (destination) =>
                getRegionLabels(destination)
              )
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
          const initialCountryDestination = initialCountry
            ? loadedDestinations.find(
                (destination) =>
                  !isIndiaDestination(destination) &&
                  matchesOption([initialCountry.value], getCountryLabels(destination))
              )
            : undefined;
          const initialCountryRegion = initialCountryDestination
            ? getRegionLabels(initialCountryDestination)[0]
            : "";

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
            setSelectedRegions(
              initialCountryRegion ? [normalizeKey(initialCountryRegion)] : []
            );
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
        removeGenericRegionOptions(
          createCountOptions(filterOptionDestinations, (destination) =>
            getRegionLabels(destination)
          )
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
  const hasSelectedRegion = activeSelectedRegions.length > 0;
  const dependentFilterDestinations = useMemo(
    () => (hasSelectedRegion ? regionScopedDestinations : []),
    [hasSelectedRegion, regionScopedDestinations]
  );
  const stateOptions = useMemo(
    () =>
      createCountOptions(dependentFilterDestinations, (destination) =>
        activeCategory === "international"
          ? getCountryLabels(destination)
          : [destination.state]
      ),
    [activeCategory, dependentFilterDestinations]
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
    () =>
      hasSelectedRegion
        ? createCountOptions(stateScopedDestinations, getFocusLabels)
        : [],
    [hasSelectedRegion, stateScopedDestinations]
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
    setSelectedStates([]);
    setSelectedFocuses([]);
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

  function clearInterestFilters() {
    resetVisibleDestinations();
    setSelectedInterests([]);
  }

  function clearDestinationFilters() {
    resetVisibleDestinations();
    setSearchQuery("");
    setActiveCategory("india");
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
  const activeFilterCount =
    (activeCategory !== "india" ? 1 : 0) +
    activeSelectedRegions.length +
    activeSelectedStates.length +
    activeSelectedFocuses.length;

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeaderBand />

      <DestinationTopBar
        searchQuery={searchQuery}
        onSearchQueryChange={updateSearchQuery}
      />

      <section className={`${pageContainerClassName} hidden pt-4 lg:block`}>
        <InterestFilter
          selectedInterests={selectedInterests}
          onInterestToggle={toggleInterest}
        />
      </section>

      <section className={`${pageContainerClassName} grid items-start gap-8 pb-28 pt-7 lg:grid-cols-[255px_minmax(0,1fr)] lg:pb-14 xl:gap-10`}>
        <DestinationSidebar
          activeCategory={activeCategory}
          focusOptions={focusOptions}
          hasActiveFilters={hasActiveFilters}
          variant="desktop"
          onCategoryChange={updateCategory}
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

      <MobileDestinationActions
        activeCategory={activeCategory}
        activeFilterCount={activeFilterCount}
        focusOptions={focusOptions}
        isFilterOpen={isMobileFilterOpen}
        isInterestOpen={isMobileInterestOpen}
        regionOptions={regionOptions}
        selectedFocuses={activeSelectedFocuses}
        selectedInterests={selectedInterests}
        selectedRegions={activeSelectedRegions}
        selectedStates={activeSelectedStates}
        stateOptions={stateOptions}
        onCategoryChange={updateCategory}
        onClearDestinationFilters={clearDestinationFilters}
        onClearInterestFilters={clearInterestFilters}
        onFilterOpenChange={setIsMobileFilterOpen}
        onFocusToggle={toggleFocus}
        onInterestOpenChange={setIsMobileInterestOpen}
        onInterestToggle={toggleInterest}
        onRegionToggle={toggleRegion}
        onStateToggle={toggleState}
      />
    </main>
  );
}

function HeaderBand() {
  return (
    <section className="relative h-[120px] overflow-hidden bg-secondary">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Ancient Trails heritage landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,18,9,0.12)_0%,rgba(35,18,9,0.34)_100%)]" />
      <div className="home-wide-frame relative z-10 mx-auto w-full px-5 sm:px-0">
        <Header />
      </div>
    </section>
  );
}

function DestinationTopBar({
  onSearchQueryChange,
  searchQuery,
}: {
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
}) {
  return (
    <section>
      <div className={`${pageContainerClassName} flex justify-end pt-0`}>
        {/* <label className="relative w-full md:w-[235px]">
          <span className="sr-only">Search Destination</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search Destination"
            className="h-9 w-full rounded-full border border-primary/55 bg-white px-5 pr-10 font-sans text-[13px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/50 focus:border-primary focus:ring-3 focus:ring-primary/15"
          />
          <Search className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
        </label> */}
      </div>
    </section>
  );
}

function DestinationSidebar({
  activeCategory,
  focusOptions,
  hasActiveFilters,
  onCategoryChange,
  onClearAll,
  onFocusToggle,
  onRegionToggle,
  onStateToggle,
  regionOptions,
  selectedFocuses,
  selectedRegions,
  selectedStates,
  stateOptions,
  variant = "desktop",
}: {
  activeCategory: CategoryFilter;
  focusOptions: CountOption[];
  hasActiveFilters: boolean;
  regionOptions: CountOption[];
  selectedFocuses: string[];
  selectedRegions: string[];
  selectedStates: string[];
  stateOptions: CountOption[];
  variant?: "desktop" | "mobile";
  onCategoryChange: (category: CategoryFilter) => void;
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
      setIsFocusFilterOpen(true);
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
    <aside
      className={cn(
        variant === "desktop"
          ? "hidden lg:sticky lg:top-[70px] lg:block lg:self-start"
          : "block"
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3 font-sans leading-none">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase text-secondary">
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
        <CategoryFilterGroup
          activeCategory={activeCategory}
          variant={variant}
          onCategoryChange={onCategoryChange}
        />
        <FilterOptionGroup
          options={regionOptions}
          selectedValues={selectedRegions}
          title="Regions"
          variant={variant}
          onToggle={handleRegionToggle}
        />
        <FilterOptionGroup
          options={stateOptions}
          selectedValues={selectedStates}
          title={stateFilterTitle}
          isCollapsible
          isOpen={isStateFilterOpen}
          variant={variant}
          onOpenToggle={() => setIsStateFilterOpen((current) => !current)}
          onToggle={handleStateToggle}
        />
        <FilterOptionGroup
          options={focusOptions}
          selectedValues={selectedFocuses}
          title="Heritage Focus"
          isCollapsible
          isOpen={isFocusFilterOpen}
          variant={variant}
          onOpenToggle={() => setIsFocusFilterOpen((current) => !current)}
          onToggle={onFocusToggle}
        />
      </div>
    </aside>
  );
}

function MobileDestinationActions({
  activeCategory,
  activeFilterCount,
  focusOptions,
  isFilterOpen,
  isInterestOpen,
  onCategoryChange,
  onClearDestinationFilters,
  onClearInterestFilters,
  onFilterOpenChange,
  onFocusToggle,
  onInterestOpenChange,
  onInterestToggle,
  onRegionToggle,
  onStateToggle,
  regionOptions,
  selectedFocuses,
  selectedInterests,
  selectedRegions,
  selectedStates,
  stateOptions,
}: {
  activeCategory: CategoryFilter;
  activeFilterCount: number;
  focusOptions: CountOption[];
  isFilterOpen: boolean;
  isInterestOpen: boolean;
  regionOptions: CountOption[];
  selectedFocuses: string[];
  selectedInterests: string[];
  selectedRegions: string[];
  selectedStates: string[];
  stateOptions: CountOption[];
  onCategoryChange: (category: CategoryFilter) => void;
  onClearDestinationFilters: () => void;
  onClearInterestFilters: () => void;
  onFilterOpenChange: (open: boolean) => void;
  onFocusToggle: (value: string) => void;
  onInterestOpenChange: (open: boolean) => void;
  onInterestToggle: (value: string) => void;
  onRegionToggle: (value: string) => void;
  onStateToggle: (value: string) => void;
}) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ead8c5] bg-white/96 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_30px_rgba(18,32,44,0.13)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-[520px] grid-cols-2 divide-x divide-[#ead8c5] overflow-hidden rounded-t-[10px]">
          <MobileActionButton
            badge={selectedInterests.length}
            icon={Sparkles}
            label="Pick Interest"
            onClick={() => onInterestOpenChange(true)}
          />
          <MobileActionButton
            badge={activeFilterCount}
            icon={SlidersHorizontal}
            label="Filter"
            onClick={() => onFilterOpenChange(true)}
          />
        </div>
      </div>

      <Sheet open={isInterestOpen} onOpenChange={onInterestOpenChange}>
        <SheetContent
          side="bottom"
          className="z-[90] max-h-[86dvh] gap-0 overflow-hidden rounded-t-[18px] border-[#ead8c5] bg-white p-0 lg:hidden"
        >
          <SheetHeader className="shrink-0 border-b border-[#ead8c5] px-5 py-4">
            <SheetTitle className="flex items-center gap-2 font-heading text-[22px] font-bold text-secondary">
              Pick Interest
              {selectedInterests.length > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 font-sans text-[12px] font-bold text-white">
                  {selectedInterests.length}
                </span>
              ) : null}
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <InterestFilter
              selectedInterests={selectedInterests}
              onInterestToggle={onInterestToggle}
              onInterestClear={onClearInterestFilters}
            />
          </div>

          <SheetFooter className="shrink-0 border-t border-[#ead8c5] bg-white px-5 py-5">
            <button
              type="button"
              className="h-[40px] rounded-[6px] bg-primary px-4 font-sans text-[17px] font-normal text-white shadow-[0_12px_24px_rgba(244,192,7,0.24)] transition-transform active:translate-y-px"
              onClick={() => onInterestOpenChange(false)}
            >
              Apply ({selectedInterests.length}) Interests
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isFilterOpen} onOpenChange={onFilterOpenChange}>
        <SheetContent
          side="bottom"
          className="z-[90] max-h-[86dvh] gap-0 overflow-hidden rounded-t-[18px] border-[#ead8c5] bg-white p-0 lg:hidden"
        >
          <SheetHeader className="shrink-0 border-b border-[#ead8c5] px-5 py-4">
            <SheetTitle className="flex items-center gap-2 font-heading text-[22px] font-bold text-secondary">
              Filters
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 font-sans text-[12px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
            <DestinationSidebar
              activeCategory={activeCategory}
              focusOptions={focusOptions}
              hasActiveFilters={activeFilterCount > 0}
              regionOptions={regionOptions}
              selectedFocuses={selectedFocuses}
              selectedRegions={selectedRegions}
              selectedStates={selectedStates}
              stateOptions={stateOptions}
              variant="mobile"
              onCategoryChange={onCategoryChange}
              onClearAll={onClearDestinationFilters}
              onFocusToggle={onFocusToggle}
              onRegionToggle={onRegionToggle}
              onStateToggle={onStateToggle}
            />
          </div>

          <SheetFooter className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] items-center gap-4 border-t border-[#ead8c5] bg-white px-5 py-5">
            <button
              type="button"
              disabled={activeFilterCount === 0}
              className="justify-self-center font-sans text-[15px] font-medium text-secondary underline underline-offset-2 transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-45"
              onClick={onClearDestinationFilters}
            >
              Reset Filters
            </button>
            <button
              type="button"
              className="h-[40px] rounded-[6px] bg-primary px-4 font-sans text-[17px] font-normal text-white shadow-[0_12px_24px_rgba(244,192,7,0.24)] transition-transform active:translate-y-px"
              onClick={() => onFilterOpenChange(false)}
            >
              Apply ({activeFilterCount}) Filters
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MobileActionButton({
  badge,
  icon: Icon,
  label,
  onClick,
}: {
  badge?: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="relative flex min-h-[44px] w-full items-center justify-center gap-1.5 bg-white px-1.5 font-sans text-[14px] font-medium leading-none text-secondary transition-colors active:bg-[#fff8f1]"
      onClick={onClick}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-white">
        <Icon className="size-3.5" strokeWidth={2.2} />
      </span>
      <span className="truncate">{label}</span>
      {badge && badge > 0 ? (
        <span className="grid min-w-4 place-items-center rounded-full bg-secondary px-1 py-0.5 font-sans text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function CategoryFilterGroup({
  activeCategory,
  onCategoryChange,
  variant = "desktop",
}: {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  variant?: "desktop" | "mobile";
}) {
  return (
    <section className="border-b border-[#f1ebe6] pb-4">
      <h3 className="font-sans text-[14px] font-semibold leading-none text-primary">
        Destination Type
      </h3>
      <div className="mt-3 space-y-2">
        {categoryTabs.map((tab) => {
          const isActive = activeCategory === tab.id;

          return (
            <label
              key={tab.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 font-sans text-[14px] font-medium leading-[1.25] text-secondary/68 transition-colors hover:text-primary",
                variant === "mobile" &&
                  "rounded-[6px] border border-transparent px-2.5 py-2",
                variant === "mobile" &&
                  isActive &&
                  "border-primary/30 bg-primary/8 text-primary"
              )}
            >
              <input
                checked={isActive}
                onChange={() => onCategoryChange(tab.id)}
                type="radio"
                name="destination-category"
                className={cn(
                  "size-4 border-[#d9cdc3] accent-primary",
                  variant === "mobile" && "sr-only"
                )}
              />
              {variant === "mobile" ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border border-secondary/38 bg-white",
                    isActive && "border-primary"
                  )}
                >
                  {isActive ? (
                    <span className="size-2 rounded-full bg-primary" />
                  ) : null}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
            </label>
          );
        })}
      </div>
    </section>
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
  variant = "desktop",
}: {
  isCollapsible?: boolean;
  isOpen?: boolean;
  options: CountOption[];
  selectedValues: string[];
  title: string;
  variant?: "desktop" | "mobile";
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
          {options.map((option) => {
            const isActive = hasSelection(selectedValues, option.value);

            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 font-sans text-[14px] font-medium leading-[1.25] text-secondary/68 transition-colors hover:text-primary",
                  variant === "mobile" &&
                    "rounded-[6px] border border-transparent px-2.5 py-2",
                  variant === "mobile" &&
                    isActive &&
                    "border-primary/30 bg-primary/8 text-primary"
                )}
              >
                <input
                  checked={isActive}
                  onChange={() => onToggle(option.value)}
                  type="checkbox"
                  className={cn(
                    "size-4 rounded-[2px] border-[#d9cdc3] accent-primary",
                    variant === "mobile" && "sr-only"
                  )}
                />
                {variant === "mobile" ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-[3px] border border-secondary/38 bg-white",
                      isActive && "border-primary bg-primary"
                    )}
                  >
                    {isActive ? (
                      <span className="h-1.5 w-2.5 rotate-[-45deg] border-b-2 border-l-2 border-white" />
                    ) : null}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span
                  className={cn(
                    "text-[12px] text-secondary/38",
                    variant === "mobile" && isActive && "text-primary"
                  )}
                >
                  {option.count}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function InterestFilter({
  onInterestClear,
  onInterestToggle,
  selectedInterests,
}: {
  onInterestClear?: () => void;
  selectedInterests: string[];
  onInterestToggle: (value: string) => void;
}) {
  function handleClearInterests() {
    if (onInterestClear) {
      onInterestClear();
      return;
    }

    selectedInterests.forEach((value) => onInterestToggle(value));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-description font-medium uppercase leading-none text-secondary">
          Pick your interest
        </p>
        <button
          type="button"
          onClick={handleClearInterests}
          disabled={selectedInterests.length === 0}
          className="font-sans text-[12px] font-bold leading-none text-secondary/55 transition-colors hover:text-secondary disabled:pointer-events-none disabled:text-secondary/30"
        >
          Clear all
        </button>
      </div>
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
                  ? "border-primary bg-primary text-white "
                  : "border-primary/70 bg-white hover:bg-primary hover:text-white"
              )}
            >
              <span className="text-[15px] leading-none">{tab.label}</span>
              <span aria-hidden="true" className="text-[15px] leading-none">
                {isActive ? "-" : "+"}
              </span>
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
      <div className="mt-8 grid auto-rows-[8px] grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: pageSize }).map((_item, index) => (
          <div
            key={index}
            className={cn(
              "animate-pulse rounded-[4px] bg-[#e7ddd5]",
              destinationMasonryCardClasses[
                index % destinationMasonryCardClasses.length
              ]
            )}
          />
        ))}
      </div>
    );
  }

  if (destinations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 grid auto-rows-[8px] grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
          index={index}
        />
      ))}
    </div>
  );
}

function DestinationCard({
  categoryPills,
  destination,
  image,
  index,
}: {
  categoryPills: string[];
  destination: PublicDestination;
  image: string;
  index: number;
}) {
  const title = destination.destinationName;
  const masonryClassName =
    destinationMasonryCardClasses[index % destinationMasonryCardClasses.length];

  return (
    <Link
      href={getDestinationHref(destination)}
      aria-label={`Customize journey to ${title}`}
      className={cn("group block", masonryClassName)}
    >
      <article className="relative h-full overflow-hidden rounded-[10px] bg-secondary">
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
