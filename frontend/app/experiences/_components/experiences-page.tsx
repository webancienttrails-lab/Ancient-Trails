"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Bus,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Play,
  Route,
  Search,
  Star,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";

import { Header } from "@/components/layout/header";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import {
  getHomeMediaUrl,
  listPublicDestinations,
  listPublicExperiences,
  listPublicMegaMenu,
  type PublicDestination,
  type PublicExperience,
  type PublicMegaMenuContent,
} from "@/lib/home-travel";
import {
  getTourCalendarHref,
  matchesRouteValue,
  slugifyRoute,
} from "@/lib/routes";
import { cn } from "@/lib/utils";

type ExperienceCategory =
  | "all"
  | "india"
  | "international"
  | "popular-cities"
  | "unesco-sites";

type DestinationExperienceGroup = {
  destination: PublicDestination;
  experiences: PublicExperience[];
  image: string;
  rating: number;
  reviewCount: number;
};

type ExperienceDetailState = {
  destination: PublicDestination | null;
  experiences: PublicExperience[];
};

const pageContainerClassName =
  "mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-0";
const detailContainerClassName =
  "mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-0";

const fallbackImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/destination/Hoysalas.webp",
];

const categoryTabs: Array<{ id: ExperienceCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "india", label: "India" },
  { id: "international", label: "International" },
  { id: "popular-cities", label: "Popular cities" },
  { id: "unesco-sites", label: "Unesco Sites" },
];

const experienceStats: Array<{
  label: string;
  value: string;
}> = [
  { label: "Curated Tours", value: "150+" },
  { label: "Destinations", value: "75+" },
  { label: "Happy Travellers", value: "25,000+" },
  { label: "Years of Experience", value: "12+" },
  { label: "Countries Explored", value: "10+" },
];

const experienceHeaderStats: Array<{
  label: string;
  value: string;
}> = [
  { label: "Curated Tours", value: "150+" },
  { label: "Happy Travellers", value: "25K" },
  { label: "Countries explored", value: "10+" },
];

const experienceStatFormatter = new Intl.NumberFormat("en-IN");

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load traveller experiences.";
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeId(value: string) {
  return value.trim().toUpperCase();
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function isIndiaDestination(destination: PublicDestination) {
  return (
    destination.destinationType === "Domestic" ||
    normalizeKey(destination.countryRegion).includes("india")
  );
}

function getRegionLabel(destination: PublicDestination) {
  return destination.region || destination.state || destination.countryRegion;
}

function getExperienceHref(destination: PublicDestination) {
  return `/experiences/${encodeURIComponent(
    slugifyRoute(destination.destinationName) || destination.destinationId
  )}`;
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

function matchesCategory(
  destination: PublicDestination,
  category: ExperienceCategory,
  topCityDestinationIds: Set<string>
) {
  switch (category) {
    case "all":
      return true;
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

function getDestinationSearchText(
  destination: PublicDestination,
  experiences: PublicExperience[]
) {
  return [
    destination.destinationId,
    destination.destinationName,
    destination.destinationType,
    destination.countryRegion,
    destination.region,
    destination.state,
    destination.city,
    destination.primaryHeritageFocus,
    destination.shortDescription,
    destination.keyLandmarks.join(" "),
    experiences.map((experience) => experience.travellerName).join(" "),
    experiences.map((experience) => experience.title || "").join(" "),
    experiences.map((experience) => experience.writtenReview).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function getDestinationImages(
  destination: PublicDestination,
  experiences: PublicExperience[]
) {
  const images = uniqueValues([
    destination.bannerImage,
    destination.thumbnailImage || "",
    ...destination.galleryImages,
    ...(destination.keyLandmarkImages || []),
    ...experiences.flatMap((experience) => experience.travellerPhotoGallery),
    ...experiences.flatMap((experience) =>
      experience.attractionPhotoGallery.map((photo) => photo.image)
    ),
  ])
    .map(getHomeMediaUrl)
    .filter(Boolean);

  return images.length > 0 ? images : fallbackImages;
}

function getDestinationImage(
  destination: PublicDestination,
  experiences: PublicExperience[],
  index: number
) {
  return (
    getHomeMediaUrl(
      destination.thumbnailImage ||
        destination.bannerImage ||
        destination.galleryImages[0] ||
        experiences[0]?.travellerPhotoGallery[0] ||
        fallbackImages[index % fallbackImages.length] ||
        fallbackImages[0]
    ) || fallbackImages[index % fallbackImages.length]
  );
}

function getAverageRating(experiences: PublicExperience[]) {
  if (experiences.length === 0) {
    return 4.9;
  }

  const total = experiences.reduce(
    (sum, experience) => sum + experience.overallRating,
    0
  );

  return Number((total / experiences.length).toFixed(1));
}

function getRatingValue(
  experiences: PublicExperience[],
  key: keyof Pick<
    PublicExperience,
    | "overallRating"
    | "ratingAccommodation"
    | "ratingItinerary"
    | "ratingLocalTransport"
    | "ratingTourExpert"
  >
) {
  if (experiences.length === 0) {
    return key === "ratingAccommodation" ? 4.3 : 4.6;
  }

  const total = experiences.reduce((sum, experience) => {
    const value = Number(experience[key]) || 0;

    return sum + value;
  }, 0);

  return Number((total / experiences.length).toFixed(1));
}

function getExperiencePhotoGallery(experience?: PublicExperience) {
  return uniqueValues(experience?.travellerPhotoGallery || [])
    .map(getHomeMediaUrl)
    .filter(Boolean);
}

function getExperienceVideo(experience?: PublicExperience) {
  return getHomeMediaUrl(
    experience?.travellerVideos.find((video) => video.trim()) || ""
  );
}

function getAttractionName(
  destination: PublicDestination,
  experience: PublicExperience | undefined,
  index: number
) {
  return (
    experience?.attractionPhotoGallery[index]?.name ||
    destination.keyLandmarks[index] ||
    destination.destinationName
  );
}

function getReviewMonthLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recent";
  }

  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - date.getFullYear()) * 12 +
      now.getMonth() -
      date.getMonth()
  );

  if (months === 0) {
    return "this mon";
  }

  return `${months} mon`;
}

function getTravellerReviewCount(
  experience: PublicExperience,
  experiences: PublicExperience[]
) {
  const travellerKey =
    experience.travellerEmail.trim().toLowerCase() ||
    experience.travellerName.trim().toLowerCase();

  if (!travellerKey) {
    return 1;
  }

  return Math.max(
    experiences.filter((item) => {
      const itemKey =
        item.travellerEmail.trim().toLowerCase() ||
        item.travellerName.trim().toLowerCase();

      return itemKey === travellerKey;
    }).length,
    1
  );
}

function buildDestinationGroups(
  destinations: PublicDestination[],
  experiences: PublicExperience[]
) {
  const experiencesByDestinationId = new Map<string, PublicExperience[]>();

  experiences.forEach((experience) => {
    const key = normalizeId(experience.destinationId);
    const current = experiencesByDestinationId.get(key) || [];

    experiencesByDestinationId.set(key, [...current, experience]);
  });

  return destinations
    .map<DestinationExperienceGroup>((destination, index) => {
      const destinationExperiences =
        experiencesByDestinationId.get(normalizeId(destination.destinationId)) ||
        experiences.filter(
          (experience) =>
            normalizeKey(experience.destinationName) ===
            normalizeKey(destination.destinationName)
        );

      return {
        destination,
        experiences: destinationExperiences,
        image: getDestinationImage(destination, destinationExperiences, index),
        rating: getAverageRating(destinationExperiences),
        reviewCount: destinationExperiences.length,
      };
    })
    .sort((left, right) => {
      if (right.reviewCount !== left.reviewCount) {
        return right.reviewCount - left.reviewCount;
      }

      return left.destination.destinationName.localeCompare(
        right.destination.destinationName
      );
    });
}

function HeaderBand({
  description,
  stats = experienceHeaderStats,
  subtitle,
  title = "Experiences",
}: {
  description?: string;
  stats?: Array<{ label: string; value: string }>;
  subtitle?: string;
  title?: string;
}) {
  return (
    <section className="relative h-[260px] overflow-hidden bg-secondary md:h-[200px]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Ancient Trails heritage landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,18,9,0.12)_0%,rgba(20,16,12,0.7)_100%)]" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1300px] flex-col px-5 sm:px-8 lg:px-0">
        <Header />
        <div className="flex flex-1 items-center pb-6 md:pb-6">
          <div className="max-w-[760px] text-center text-white">
          
            {stats.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3 text-left ">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="border-r-1 border-white pr-3 last:border-none pr-0 "
                  >
                    <span className="block font-description text-[20px] font-semibold leading-none text-white">
                      {stat.value}
                    </span>
                    <span className="mt-1 block font-sans text-[16px]  tracking-[0.10em] text-white">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function parseExperienceStatValue(value: string) {
  const target = Number(value.replace(/[^\d]/g, ""));
  const suffix = value.trim().endsWith("+") ? "+" : "";

  return {
    suffix,
    target: Number.isFinite(target) ? target : 0,
  };
}

function formatExperienceStatValue(value: number, suffix: string) {
  return `${experienceStatFormatter.format(value)}${suffix}`;
}

function CountUpStatValue({
  className,
  value,
}: {
  className: string;
  value: string;
}) {
  const valueRef = useRef<HTMLElement | null>(null);
  const { suffix, target } = useMemo(
    () => parseExperienceStatValue(value),
    [value]
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [displayValue, setDisplayValue] = useState(() =>
    formatExperienceStatValue(0, suffix)
  );

  useEffect(() => {
    const element = valueRef.current;

    if (!element) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frameId = window.requestAnimationFrame(() => {
        setDisplayValue(formatExperienceStatValue(target, suffix));
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [suffix, target]);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    const duration = 1200;
    const startTime = window.performance.now();
    let frameId = 0;

    const animateValue = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startTime) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(target * easedProgress);

      setDisplayValue(formatExperienceStatValue(nextValue, suffix));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animateValue);
      }
    };

    frameId = window.requestAnimationFrame(animateValue);

    return () => window.cancelAnimationFrame(frameId);
  }, [hasStarted, suffix, target]);

  return (
    <strong ref={valueRef} className={className}>
      {displayValue}
    </strong>
  );
}

// function ExperienceStatsStrip() {
//   return (
//     <section className={`${detailContainerClassName} relative z-20 -mt-[44px]`}>
//       <div className="mx-auto grid max-w-[1080px] overflow-hidden rounded-[10px] border border-primary/15 bg-white sm:grid-cols-2 lg:grid-cols-5">
//         {experienceStats.map((stat, index) => (
//             <article
//               key={stat.label}
//               className={cn(
//                 "flex min-h-[82px] flex-col items-center justify-center px-2 py-3 text-center",
//                 index > 0 && "border-t border-border sm:border-l sm:border-t-0",
//                 index === 2 && "sm:border-t lg:border-t-0",
//                 index === 4 && "sm:col-span-2 lg:col-span-1"
//               )}
//             >
//               <CountUpStatValue
//                 value={stat.value}
//                 className="font-description text-[24px] font-semibold leading-none tracking-normal text-secondary"
//               />
//               <span className="mt-1.5 font-description text-description font-medium leading-none text-secondary/70">
//                 {stat.label}
//               </span>
//             </article>
//         ))}
//       </div>
//     </section>
//   );
// }

export function ExperiencesPage() {
  const [destinations, setDestinations] = useState<PublicDestination[]>([]);
  const [experiences, setExperiences] = useState<PublicExperience[]>([]);
  const [topCityDestinationIds, setTopCityDestinationIds] = useState<string[]>(
    []
  );
  const [activeCategory, setActiveCategory] =
    useState<ExperienceCategory>("india");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadExperiences() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [destinationsResponse, experiencesResponse, megaMenuResponse] =
          await Promise.all([
            listPublicDestinations(),
            listPublicExperiences().catch(() => ({ data: { experiences: [] } })),
            listPublicMegaMenu().catch(() => null),
          ]);

        if (!isMounted) {
          return;
        }

        setDestinations(destinationsResponse.data.destinations);
        setExperiences(experiencesResponse.data.experiences);
        setTopCityDestinationIds(
          getTopCityDestinationIds(megaMenuResponse?.data.megaMenu || null)
        );
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

    loadExperiences();

    return () => {
      isMounted = false;
    };
  }, []);

  const groups = useMemo(
    () => buildDestinationGroups(destinations, experiences),
    [destinations, experiences]
  );
  const topCityDestinationIdSet = useMemo(
    () => new Set(topCityDestinationIds),
    [topCityDestinationIds]
  );
  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        getDestinationSearchText(group.destination, group.experiences).includes(
          query
        );

      return (
        matchesCategory(group.destination, activeCategory, topCityDestinationIdSet) &&
        matchesSearch
      );
    });
  }, [activeCategory, groups, searchQuery, topCityDestinationIdSet]);

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeaderBand
        description="Real stories, moments and memories from travellers who explored these destinations with Ancient Trails."
        stats={experienceHeaderStats}
        title="Experiences"
      />

      <ExperienceTopBar
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        onCategoryChange={setActiveCategory}
        onSearchQueryChange={setSearchQuery}
      />

      <section
        className={`${pageContainerClassName} grid gap-6 pb-10 pt-10 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:items-center md:gap-10 lg:gap-14`}
      >
        <div className="min-w-0">
          <p className="font-sans text-eyebrow font-medium uppercase leading-none text-primary">
            Traveller
          </p>
          <h1 className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1 font-heading text-title font-bold italic leading-none tracking-normal text-secondary">
            <span>Experiences</span>
            <span className="pb-1 font-sans text-description font-medium not-italic leading-none text-secondary">
              With Ancient Trails
            </span>
          </h1>
        </div>

        <span className="h-px w-full bg-border md:h-20 md:w-px" />

        <p className="max-w-[520px] font-sans text-description font-medium leading-[1.25] text-secondary/72">
          <span className="block text-secondary/68">Planning a trip with us?</span>
          <span className="block">
            Choose a destination and get to know more about the travel
            experiences of people visiting all these locations
          </span>
        </p>
      </section>

      <section className={`${pageContainerClassName} pb-16`}>
        {loadError ? (
          <EmptyState title="Experiences could not load" message={loadError} />
        ) : null}

        {!loadError ? (
          <ExperienceGrid groups={visibleGroups} isLoading={isLoading} />
        ) : null}

        {!isLoading && !loadError && visibleGroups.length === 0 ? (
          <EmptyState
            title="No traveller experiences found"
            message="Try changing the destination search or category."
          />
        ) : null}
      </section>
    </main>
  );
}

function ExperienceTopBar({
  activeCategory,
  onCategoryChange,
  onSearchQueryChange,
  searchQuery,
}: {
  activeCategory: ExperienceCategory;
  onCategoryChange: (category: ExperienceCategory) => void;
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
}) {
  return (
    <section className="border-b border-border bg-muted/45">
      <div className={`${pageContainerClassName} flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-wrap items-center gap-4">
          {categoryTabs.map((tab) => {
            const isActive = activeCategory === tab.id;
            const isPlainAll = tab.id === "all" && !isActive;

            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onCategoryChange(tab.id)}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-full font-sans text-[15px] font-semibold leading-none transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isPlainAll
                    ? "px-0 text-primary hover:text-accent"
                    : "border px-5",
                  isActive
                    ? "border-primary bg-primary text-white "
                    : !isPlainAll &&
                        "border-primary/70 bg-white text-primary hover:bg-primary hover:text-white"
                )}
              >
                {tab.label}
              </button>
            );
          })}
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

function ExperienceGrid({
  groups,
  isLoading,
}: {
  groups: DestinationExperienceGroup[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_item, index) => (
          <div
            key={index}
            className="h-[102px] animate-pulse rounded-[9px] bg-muted"
          />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <ExperienceDestinationCard
          key={group.destination.id || group.destination.destinationId}
          group={group}
        />
      ))}
    </div>
  );
}

function ExperienceDestinationCard({
  group,
}: {
  group: DestinationExperienceGroup;
}) {
  const { destination, image, rating, reviewCount } = group;

  return (
    <Link
      href={getExperienceHref(destination)}
      aria-label={`Read traveller experiences for ${destination.destinationName}`}
      className="group block"
    >
      <article className="grid h-[102px] grid-cols-[128px_minmax(0,1fr)_50px] items-stretch overflow-hidden rounded-[9px] border border-[#eee9e4] bg-white transition-transform duration-300 hover:-translate-y-0.5 hover:border-primary">
        <div className="relative m-0 overflow-hidden rounded-[8px] bg-muted">
          <Image
            src={image}
            alt={destination.destinationName}
            fill
            unoptimized
            sizes="128px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>

        <div className="min-w-0 px-3.5 py-3">
          <h2 className="line-clamp-2 min-h-[36px] font-sans text-[18px] font-bold leading-[1.02] tracking-normal text-secondary">
            {destination.destinationName}
          </h2>
          <div className="mt-3 flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-sans text-[14px] font-medium leading-none text-secondary/28">
              {reviewCount}+
            </span>
            <RatingStars
              value={rating}
              className="text-[#ffbd00]"
              starClassName="size-4.5"
            />
          </div>
        </div>

        <div className="flex items-end justify-center pb-3">
          <span className="grid size-9 place-items-center rounded-full border border-primary bg-primary text-white transition-colors group-hover:bg-white group-hover:text-primary">
            <ArrowRight className="size-5" strokeWidth={2.1} />
          </span>
        </div>
      </article>
    </Link>
  );
}

export function SingleExperiencePage({
  experienceId,
}: {
  experienceId: string;
}) {
  const [detail, setDetail] = useState<ExperienceDetailState>({
    destination: null,
    experiences: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const requestedId = decodeURIComponent(experienceId);

    async function loadExperienceDetail() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [destinationsResponse, experiencesResponse] = await Promise.all([
          listPublicDestinations(),
          listPublicExperiences().catch(() => ({ data: { experiences: [] } })),
        ]);
        const destinations = destinationsResponse.data.destinations;
        const allExperiences = experiencesResponse.data.experiences;
        const matchedDestination =
          destinations.find((destination) =>
            matchesRouteValue(
              requestedId,
              destination.destinationId,
              destination.destinationName
            )
          ) || null;
        const matchedExperience = matchedDestination
          ? null
          : allExperiences.find((experience) =>
              matchesRouteValue(
                requestedId,
                experience.experienceId,
                experience.title || experience.destinationName
              )
            ) || null;
        const destination =
          matchedDestination ||
          (matchedExperience
            ? destinations.find(
                (item) =>
                  normalizeId(item.destinationId) ===
                    normalizeId(matchedExperience.destinationId) ||
                  normalizeKey(item.destinationName) ===
                    normalizeKey(matchedExperience.destinationName)
              ) || null
            : null);

        if (!destination) {
          if (isMounted) {
            setDetail({ destination: null, experiences: [] });
            setLoadError("Experience destination not found.");
          }

          return;
        }

        const destinationExperiencesResponse = await listPublicExperiences(
          destination.destinationId
        ).catch(() => ({
          data: {
            experiences: allExperiences.filter(
              (experience) =>
                normalizeId(experience.destinationId) ===
                  normalizeId(destination.destinationId) ||
                normalizeKey(experience.destinationName) ===
                  normalizeKey(destination.destinationName)
            ),
          },
        }));

        if (isMounted) {
          setDetail({
            destination,
            experiences: destinationExperiencesResponse.data.experiences,
          });
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

    loadExperienceDetail();

    return () => {
      isMounted = false;
    };
  }, [experienceId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-secondary">
        <HeaderBand />
        <section className={`${detailContainerClassName} py-10`}>
          <div className="h-[360px] animate-pulse rounded-[8px] bg-muted" />
          <div className="mt-10 h-[260px] animate-pulse rounded-[8px] bg-muted" />
        </section>
      </main>
    );
  }

  if (!detail.destination || loadError) {
    return (
      <main className="min-h-screen bg-background text-secondary">
        <HeaderBand />
        <section className="mx-auto mt-10 max-w-[720px] px-5 pb-20">
          <div className="rounded-[8px] border border-[#ead8c5] bg-white p-8 text-center shadow-[0_18px_44px_rgba(50,50,50,0.08)]">
            <h1 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Experience not found
            </h1>
            <p className="mx-auto mt-4 max-w-[460px] font-sans text-description text-secondary/70">
              {loadError ||
                "This traveller experience is not available in the current records."}
            </p>
            <Link
              href="/experiences"
              className="mt-6 inline-flex h-10 items-center gap-3 rounded-full bg-primary px-5 font-sans text-button font-bold text-white transition-colors hover:bg-accent"
            >
              Back to Experiences
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const images = getDestinationImages(detail.destination, detail.experiences);
  const averageRating = getAverageRating(detail.experiences);

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeaderBand
        description="Real stories, moments and memories from travellers who explored this destination with Ancient Trails."
        stats={experienceHeaderStats}
        subtitle={getRegionLabel(detail.destination)}
        title={detail.destination.destinationName}
      />

      <section className={`${detailContainerClassName} pb-20 pt-8`}>
        <ExperienceDetailHero
          averageRating={averageRating}
          destination={detail.destination}
          experiences={detail.experiences}
          images={images}
          onGalleryOpen={setLightboxIndex}
        />
        <ExploringWithUsSection
          destination={detail.destination}
          experiences={detail.experiences}
          images={images}
        />
        <TravellerRatingSection
          averageRating={averageRating}
          experiences={detail.experiences}
        />
         <ExperiencePlanTripCta destination={detail.destination} images={images} />
        <TravellerMomentsSection
          destination={detail.destination}
          experiences={detail.experiences}
          images={images}
        />
        <ReviewsGrid experiences={detail.experiences} images={images} />
      </section>

      {lightboxIndex !== null ? (
        <ExperiencePhotoLightbox
          activeIndex={lightboxIndex}
          images={images}
          title={`${detail.destination.destinationName} photos`}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </main>
  );
}

function ExperienceDetailHero({
  averageRating,
  destination,
  experiences,
  images,
  onGalleryOpen,
}: {
  averageRating: number;
  destination: PublicDestination;
  experiences: PublicExperience[];
  images: string[];
  onGalleryOpen: (index: number) => void;
}) {
  const featuredExperience = experiences[0];
  const heroImages = Array.from({ length: 9 }, (_item, index) =>
    images[index] || fallbackImages[index % fallbackImages.length]
  );
  const albumCards = heroImages.slice(0, 5).map((image, index) => ({
    image,
    title:
      index === 0
        ? getAttractionName(destination, featuredExperience, 0)
        : getAttractionName(destination, featuredExperience, index) ||
          `${destination.destinationName} album`,
  }));
  const thumbnailImages = heroImages.slice(5, 9);
  const reviewCount = experiences.length;
  const bullets = [
    "One of our bestseller tours",
    "100% safe routes with certified local guides",
    "56 Guided Tours delivered",
  ];

  return (
    <section>
      <div className="grid items-center gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <p className="font-sans text-eyebrow font-medium uppercase leading-none text-primary">
          Stories | Moments | Memories.
        </p>
        <span className="hidden h-px bg-primary/55 lg:block" />
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,66%)_minmax(0,30%)] lg:items-start lg:justify-between lg:gap-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <h1 className="font-heading text-title font-bold italic leading-none text-secondary">
              {destination.destinationName}
            </h1>
            <p className="pb-1 font-sans text-button font-medium leading-none text-secondary">
              {getRegionLabel(destination)}
            </p>
          </div>
          <p className="mt-2 max-w-[520px] font-sans text-description text-secondary/60">
            Real stories, moments and memories from our travellers
          </p>

          <div className="mt-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)]">
              <ExperienceAlbumCard
                image={albumCards[0].image}
                title={albumCards[0].title}
                priority
                featured
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {albumCards.slice(1).map((card, index) => (
                  <ExperienceAlbumCard
                    key={`${card.image}-${index}`}
                    image={card.image}
                    title={card.title}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 items-center gap-4 sm:grid-cols-[repeat(4,minmax(0,1fr))_180px]">
              {thumbnailImages.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="relative h-[92px] overflow-hidden rounded-[7px] bg-muted"
                >
                  <Image
                    src={image}
                    alt={`${destination.destinationName} album thumbnail ${index + 1}`}
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 145px, (min-width: 1024px) 11vw, (min-width: 640px) 20vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => onGalleryOpen(0)}
                className="col-span-2 flex h-[92px] items-center justify-center gap-4 rounded-[7px] bg-white font-sans text-description font-medium uppercase leading-[1.1] text-primary transition-colors hover:text-accent sm:col-span-1"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-primary">
                  <ImageIcon className="size-5" strokeWidth={1.8} />
                </span>
                <span className="text-left">
                  View all
                  <br />
                  photos
                </span>
              </button>
            </div>
          </div>
        </div>

        <aside className="w-full">
          

          <div className="mt-9">
            <p className="font-sans text-description font-normal uppercase leading-none text-secondary">
              Rating
            </p>
            <div className="mt-3 grid w-full max-w-[390px] grid-cols-[auto_auto_minmax(112px,1fr)] items-end gap-3 rounded-[8px]  bg-transparent px-4 py-3">
              <strong className="font-description text-[46px] font-semibold leading-none tracking-normal text-primary">
                {averageRating.toFixed(1)}
              </strong>
              <span className="pb-1.5 font-description text-[20px] font-semibold leading-none text-primary">
                / 5
              </span>
              <span className="mb-2 max-w-[160px] justify-self-end font-sans text-description italic leading-[1.2] text-secondary/70">
                Based on {reviewCount}+ verified reviews
              </span>
            </div>

            <ul className="mt-8 max-w-[390px] space-y-4 font-sans text-description font-medium leading-[1.25] text-secondary/82">
              {(bullets.length > 0
                ? bullets
                : [
                    "One of our traveller-loved heritage routes",
                    "Local stories and guided moments included",
                    "Memories from verified Ancient Trails travellers",
                  ]
              ).map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ExperienceAlbumCard({
  featured = false,
  image,
  priority = false,
  title,
}: {
  featured?: boolean;
  image: string;
  priority?: boolean;
  title: string;
}) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[8px] bg-muted shadow-[0_10px_26px_rgba(50,50,50,0.1)]",
        featured ? "h-[360px] lg:h-full lg:min-h-[360px]" : "h-[172px]"
      )}
    >
      <Image
        src={image}
        alt={title}
        fill
        priority={priority}
        unoptimized
        sizes={
          featured
            ? "(min-width: 1280px) 310px, (min-width: 1024px) 24vw, 100vw"
            : "(min-width: 1280px) 185px, (min-width: 1024px) 14vw, (min-width: 640px) 45vw, 100vw"
        }
        className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
      />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.04)_0%,rgba(18,12,8,0.18)_45%,rgba(18,12,8,0.66)_100%)]" />
      <span className="pointer-events-none absolute left-4 top-4 inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-secondary">
        <ImageIcon className="size-3.5" strokeWidth={2} />
        Album
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
        <strong className="max-w-[220px] font-sans text-description font-semibold leading-tight">
          {title}
        </strong>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/80 bg-white/5 text-white backdrop-blur-sm transition-colors group-hover:bg-primary group-hover:border-primary">
          <ArrowRight className="size-5" strokeWidth={2} />
        </span>
      </span>
    </article>
  );
}

function ExperiencePhotoLightbox({
  activeIndex,
  images,
  title,
  onClose,
  onIndexChange,
}: {
  activeIndex: number;
  images: string[];
  title: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const boundedIndex = images[activeIndex] ? activeIndex : 0;
  const activeImage = images[boundedIndex];

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft") {
        onIndexChange(boundedIndex === 0 ? images.length - 1 : boundedIndex - 1);
      }

      if (event.key === "ArrowRight") {
        onIndexChange(boundedIndex === images.length - 1 ? 0 : boundedIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [boundedIndex, images.length, onClose, onIndexChange]);

  if (!activeImage) {
    return null;
  }

  function showPreviousImage() {
    onIndexChange(boundedIndex === 0 ? images.length - 1 : boundedIndex - 1);
  }

  function showNextImage() {
    onIndexChange(boundedIndex === images.length - 1 ? 0 : boundedIndex + 1);
  }

  return createPortal(
    <section
      aria-label={`${title} gallery`}
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 bg-black/82 text-white"
      style={{ zIndex: 2147483647 }}
    >
      <button
        type="button"
        aria-label="Close gallery backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-[70px] items-center justify-between px-5 md:px-8">
          <p className="font-sans text-[18px] font-semibold tracking-wide text-white/92">
            {boundedIndex + 1} / {images.length}
          </p>
          <button
            type="button"
            aria-label="Close gallery"
            onClick={onClose}
            className="transition-colors hover:text-primary"
          >
            <X className="size-7" strokeWidth={2} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-16 md:px-24">
          {images.length > 1 ? (
            <button
              type="button"
              aria-label="Previous gallery image"
              onClick={showPreviousImage}
              className="absolute left-5 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/18 text-white transition-colors hover:bg-primary md:left-10"
            >
              <ChevronLeft className="size-8" strokeWidth={2.4} />
            </button>
          ) : null}

          <div className="relative h-[calc(100vh-9rem)] w-full max-w-[1120px]">
            <Image
              src={activeImage}
              alt={`${title} ${boundedIndex + 1}`}
              fill
              priority
              unoptimized
              sizes="(min-width: 1280px) 1120px, calc(100vw - 3rem)"
              className="object-contain object-center drop-shadow-[0_18px_42px_rgba(0,0,0,0.26)]"
            />
          </div>

          {images.length > 1 ? (
            <button
              type="button"
              aria-label="Next gallery image"
              onClick={showNextImage}
              className="absolute right-5 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/18 text-white transition-colors hover:bg-primary md:right-10"
            >
              <ChevronRight className="size-8" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>

        <p className="absolute bottom-6 left-1/2 z-20 w-[min(90vw,520px)] -translate-x-1/2 truncate text-center font-sans text-[18px] font-bold text-white/92">
          {title}
        </p>
      </div>
    </section>,
    document.body
  );
}

function ExploringWithUsSection({
  destination,
  experiences,
  images,
}: {
  destination: PublicDestination;
  experiences: PublicExperience[];
  images: string[];
}) {
  const featuredExperience = experiences[0];
  const fallbackMediaImage =
    getExperiencePhotoGallery(featuredExperience)[0] || images[1] || fallbackImages[0];
  const tallImage = images[2] || fallbackMediaImage;
  const centerVideo =
    getExperienceVideo(featuredExperience) ||
    getExperienceVideo(experiences.find((experience) => getExperienceVideo(experience)));

  return (
    <section className="mt-16 py-3 mb-10">
      <div className="grid gap-8 lg:h-[390px] lg:grid-cols-[minmax(290px,1.02fr)_minmax(190px,0.62fr)_minmax(260px,0.82fr)] lg:items-stretch lg:gap-12 xl:grid-cols-[minmax(330px,1.08fr)_minmax(205px,0.64fr)_minmax(300px,0.86fr)]">
        <div className="flex min-w-0 flex-col">
          <p className="font-sans text-eyebrow font-medium uppercase leading-none text-secondary/68">
            What Travellers Say On -
          </p>
          <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary border-b border-secondary/28 pb-4">
            Exploring {destination.destinationName} with Us
          </h2>
          <p className="mt-5 max-w-[320px] font-sans text-description font-medium leading-[1.35] text-primary">
            Every Journey we organise is built on trust, safety and unforgettable
            memories
          </p>

          <article className="relative mt-4 min-h-[180px] flex-1 overflow-hidden rounded-[8px] bg-muted shadow-[0_14px_32px_rgba(50,50,50,0.1)]">
            <Image
              src={fallbackMediaImage}
              alt={`${destination.destinationName} traveller memory`}
              fill
              unoptimized
              sizes="(min-width: 1280px) 320px, (min-width: 1024px) 25vw, 100vw"
              className="object-cover"
            />
          </article>
        </div>

        <article className="relative h-[320px] overflow-hidden rounded-[8px] bg-muted shadow-[0_14px_32px_rgba(50,50,50,0.1)] sm:h-[360px] lg:h-full">
          {centerVideo ? (
            <video
              autoPlay
              className="size-full object-cover"
              loop
              muted
              playsInline
              poster={tallImage}
              preload="metadata"
              src={centerVideo}
            />
          ) : (
            <Image
              src={tallImage}
              alt={`${destination.destinationName} memory`}
              fill
              unoptimized
              sizes="(min-width: 1280px) 350px, (min-width: 1024px) 28vw, 100vw"
              className="object-cover"
            />
          )}
        </article>

        <div className="flex min-w-0 flex-col justify-center">
          <div className="w-full max-w-[390px] justify-self-center lg:justify-self-auto">
            {experiences.length > 0 ? (
              <ExperienceReviewSlider experiences={experiences} />
            ) : (
              <p className="mt-10 max-w-[320px] font-sans text-description leading-[1.5] text-secondary/62">
                Traveller voices will appear here once experiences are published for
                this destination.
              </p>
            )}
            
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactVoiceCard({ experience }: { experience: PublicExperience }) {
  const name = experience.travellerName.trim() || "Traveller";

  return (
    <article className="text-center">
      <p className="mx-auto mt-6 line-clamp-7 max-w-[360px] font-description text-[16px] font-medium leading-[1.36] text-secondary/70">
        {experience.writtenReview || experience.title || "Traveller experience"}
      </p>

      <span className="mx-auto mt-5 block h-px w-20 bg-primary/45" />

      <div className="mt-4 flex items-center justify-center gap-6">
        <RatingStars
          value={experience.overallRating}
          className="text-primary"
          starClassName="size-4"
        />
        <span className="font-sans text-[20px] font-semibold leading-none text-secondary">
          {experience.overallRating.toFixed(1)}
        </span>
      </div>

      <p className="mt-4 truncate font-sans text-[16px] font-medium leading-none text-primary">
        {name}
      </p>
    </article>
  );
}

function ExperienceReviewSlider({
  experiences,
}: {
  experiences: PublicExperience[];
}) {
  const reviewExperiences = experiences.slice(0, 4);
  const [activeIndex, setActiveIndex] = useState(0);
  const boundedIndex = reviewExperiences[activeIndex] ? activeIndex : 0;

  useEffect(() => {
    if (reviewExperiences.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        currentIndex === reviewExperiences.length - 1 ? 0 : currentIndex + 1
      );
    }, 4500);

    return () => window.clearInterval(interval);
  }, [reviewExperiences.length]);

  function showPreviousReview() {
    setActiveIndex(
      boundedIndex === 0 ? reviewExperiences.length - 1 : boundedIndex - 1
    );
  }

  function showNextReview() {
    setActiveIndex(
      boundedIndex === reviewExperiences.length - 1 ? 0 : boundedIndex + 1
    );
  }

  return (
    <div className="w-full min-w-0">
      <h3 className="mt-4 text-center font-sans text-description font-semibold uppercase tracking-normal text-primary">
        Voices from our travellers
      </h3>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${boundedIndex * 100}%)` }}
        >
          {reviewExperiences.map((experience) => (
            <div
              key={experience.id || experience.experienceId}
              className="w-full shrink-0"
            >
              <CompactVoiceCard experience={experience} />
            </div>
          ))}
        </div>
      </div>

      {reviewExperiences.length > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <button
            type="button"
            aria-label="Previous traveller review"
            onClick={showPreviousReview}
            className="grid size-10 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="size-4" strokeWidth={2.3} />
          </button>

          <div className="flex items-center justify-center gap-3">
            {reviewExperiences.map((experience, index) => (
              <button
                key={`${experience.id || experience.experienceId}-voice-dot`}
                type="button"
                aria-label={`Show traveller voice ${index + 1}`}
                aria-current={index === boundedIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  index === boundedIndex ? "bg-primary" : "bg-primary/30"
                )}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next traveller review"
            onClick={showNextReview}
            className="grid size-10 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronRight className="size-4" strokeWidth={2.3} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TravellerRatingSection({
  averageRating,
  experiences,
}: {
  averageRating: number;
  experiences: PublicExperience[];
}) {
  const reviewCount = experiences.length;
  const rows: Array<{ icon: LucideIcon; label: string; value: number }> = [
    {
      icon: Route,
      label: "Itinerary",
      value: getRatingValue(experiences, "ratingItinerary"),
    },
    {
      icon: Bus,
      label: "Local Transport",
      value: getRatingValue(experiences, "ratingLocalTransport"),
    },
    {
      icon: BedDouble,
      label: "Accommodation",
      value: getRatingValue(experiences, "ratingAccommodation"),
    },
    {
      icon: UserRound,
      label: "Tour Expert",
      value: getRatingValue(experiences, "ratingTourExpert"),
    },
  ];

  return (
    <section className="mt-40">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="font-heading text-title font-bold leading-none text-secondary">
            Traveller Rating
          </h2>
          <p className="mt-2 font-sans text-description font-medium leading-none text-secondary">
            Overall {averageRating.toFixed(1)} rating based on{" "}
            <strong>{reviewCount || 0} reviews</strong>
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-2 md:grid-cols-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(130px,0.82fr)_minmax(0,1fr)_42px] items-center gap-3  bg-white px-4 py-4 sm:grid-cols-[minmax(160px,0.82fr)_minmax(0,1fr)_48px]"
          >
            <span className="flex min-w-0 items-center gap-2.5 font-sans text-description font-medium text-secondary/82">
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
              {label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-primary/12">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (value / 5) * 100)}%` }}
              />
            </span>
            <span className="font-sans text-button font-semibold text-primary">
              {value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TravellerMomentsSection({
  destination,
  experiences,
  images,
}: {
  destination: PublicDestination;
  experiences: PublicExperience[];
  images: string[];
}) {
  const [activeMomentIndex, setActiveMomentIndex] = useState<number | null>(null);

  const availableVideos = uniqueValues(
    experiences.flatMap((experience) => experience.travellerVideos)
  ).map(getHomeMediaUrl);
  const momentLayouts = [
    "lg:col-span-2",
    "lg:col-span-1",
    "lg:col-span-1",
    "lg:col-span-2",
    "lg:col-span-1",
  ];
  const moments = Array.from({ length: 5 }, (_item, index) => {
    const experience = experiences[index % Math.max(experiences.length, 1)];
    const photo =
      getExperiencePhotoGallery(experience)[0] ||
      images[index % images.length] ||
      fallbackImages[index % fallbackImages.length];

    return {
      image: photo,
      title:
        experience?.travellerVideoTitles[0] ||
        experience?.title ||
        `${destination.destinationName} moment`,
      video:
        availableVideos[index % availableVideos.length] ||
        getExperienceVideo(experience),
    };
  });
  const activeMoment =
    activeMomentIndex === null ? null : moments[activeMomentIndex] || null;

  return (
    <>
      <section className="mt-12">
        <h2 className="font-heading text-title font-bold leading-none text-secondary">
          Traveller Moments
        </h2>
        <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-7">
          {moments.map((moment, index) => (
            <button
              key={`${moment.image}-${index}`}
              type="button"
              aria-label={moment.title}
              onClick={() => setActiveMomentIndex(index)}
              className={cn(
                "group relative h-[190px] overflow-hidden rounded-[8px] bg-muted text-left shadow-[0_8px_18px_rgba(50,50,50,0.08)] focus:outline-none focus:ring-3 focus:ring-primary/20 lg:h-[210px] xl:h-[225px]",
                momentLayouts[index % momentLayouts.length]
              )}
            >
              {moment.video ? (
                <video
                  className="size-full object-cover"
                  muted
                  playsInline
                  poster={moment.image}
                  preload="metadata"
                  src={moment.video}
                />
              ) : (
                <Image
                  src={moment.image}
                  alt={moment.title}
                  fill
                  unoptimized
                  sizes="240px"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              )}
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.18)_100%)]" />
              <span className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-secondary text-white transition-transform group-hover:scale-110">
                <Play className="ml-0.5 size-5 fill-current" strokeWidth={0} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {activeMoment ? (
        <ExperienceMomentLightbox
          moment={activeMoment}
          onClose={() => setActiveMomentIndex(null)}
        />
      ) : null}
    </>
  );
}

function ExperienceMomentLightbox({
  moment,
  onClose,
}: {
  moment: { image: string; title: string; video?: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <section
      aria-label={`${moment.title} preview`}
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[2147483647] bg-black/82 text-white"
    >
      <button
        type="button"
        aria-label="Close media preview"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-[70px] items-center justify-between px-5 md:px-8">
          <p className="font-sans text-[18px] font-semibold tracking-wide text-white/92">
            {moment.title}
          </p>
          <button
            type="button"
            aria-label="Close media preview"
            onClick={onClose}
            className="transition-colors hover:text-primary"
          >
            <X className="size-7" strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-16 md:px-24">
          {moment.video ? (
            <video
              autoPlay
              controls
              className="h-[calc(100vh-9rem)] w-full max-w-[1120px] rounded-[10px] bg-black object-contain"
              playsInline
              preload="metadata"
              src={moment.video}
            />
          ) : (
            <div className="relative h-[calc(100vh-9rem)] w-full max-w-[1120px]">
              <Image
                src={moment.image}
                alt={moment.title}
                fill
                priority
                unoptimized
                sizes="(min-width: 1280px) 1120px, calc(100vw - 3rem)"
                className="rounded-[10px] object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </section>,
    document.body
  );
}

function ExperiencePlanTripCta({
  destination,
  images,
}: {
  destination: PublicDestination;
  images: string[];
}) {
  const ctaImage =
    images[3] ||
    images[0] ||
    destination.bannerImage ||
    destination.thumbnailImage ||
    fallbackImages[0];

  return (
    <section className="relative mt-12 overflow-hidden rounded-[10px] bg-secondary px-5 py-8 text-white shadow-[0_18px_44px_rgba(50,50,50,0.12)] sm:px-8 lg:px-10">
      <Image
        src={getHomeMediaUrl(ctaImage)}
        alt={`${destination.destinationName} plan trip`}
        fill
        unoptimized
        sizes="1300px"
        className="object-cover"
      />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(35,24,16,0.86)_0%,rgba(35,24,16,0.66)_44%,rgba(35,24,16,0.2)_100%)]" />
      <div className="relative max-w-[560px]">
        <p className="font-sans text-eyebrow font-medium uppercase leading-none text-white/78">
          Make It Your Journey
        </p>
        <h2 className="mt-3 font-heading text-title font-bold leading-none tracking-normal">
          Plan your {destination.destinationName} trip with Ancient Trails
        </h2>
        <Link
          href={getTourCalendarHref({ destination })}
          className={buttonVariants({
            className: "mt-6 min-w-[190px] justify-between gap-8",
          })}
        >
          Plan Your Trip
          <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
        </Link>
      </div>
    </section>
  );
}

function ReviewsGrid({
  experiences,
  images,
}: {
  experiences: PublicExperience[];
  images: string[];
}) {
  const [visibleReviewCount, setVisibleReviewCount] = useState(12);
  const reviewsPerLoad = 4;
  const reviewItems =
    experiences.length > 0
      ? experiences
      : Array.from({ length: 0 }) as PublicExperience[];

  if (reviewItems.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        message="Published traveller reviews for this destination will appear here."
      />
    );
  }

  const masonryReviews = Array.from({ length: visibleReviewCount }, (_item, index) => ({
    experience: reviewItems[index % reviewItems.length],
    key: `${reviewItems[index % reviewItems.length].id || reviewItems[index % reviewItems.length].experienceId}-${index}`,
  }));
  const reviewLayouts = [
    "lg:min-h-[190px]",
    "lg:min-h-[235px]",
    "lg:min-h-[205px]",
    "lg:min-h-[250px]",
    "lg:min-h-[245px]",
    "lg:min-h-[190px]",
    "lg:min-h-[250px]",
    "lg:min-h-[210px]",
    "lg:min-h-[205px]",
    "lg:min-h-[250px]",
    "lg:min-h-[190px]",
    "lg:min-h-[230px]",
  ];
  const reviewLineClamps = [
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
    "line-clamp-3",
  ];

  return (
    <section className="relative mt-12 overflow-hidden pb-10">
      <h2 className="font-heading text-title font-bold leading-none text-secondary">
        Written Reviews
      </h2>
      <div className="mt-7 columns-1 gap-6 sm:columns-2 lg:columns-4">
        {masonryReviews.map(({ experience, key }, index) => (
          <ReviewCard
            key={key}
            className={reviewLayouts[index % reviewLayouts.length]}
            experience={experience}
            experiences={experiences}
            fallbackImage={images[index % images.length] || fallbackImages[0]}
            lineClampClass={reviewLineClamps[index % reviewLineClamps.length]}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-64 items-center justify-center bg-gradient-to-t from-background via-background/80 to-transparent pb-2">
        <button
          type="button"
          onClick={() =>
            setVisibleReviewCount((currentCount) =>
              currentCount + reviewsPerLoad
            )
          }
          className="inline-flex h-10 min-w-[150px] items-center justify-center rounded-full border border-primary bg-primary px-5 font-sans text-button font-medium text-white transition-colors hover:bg-transparent hover:text-primary"
        >
          Load more
        </button>
      </div>
    </section>
  );
}

function ReviewCard({
  className,
  experience,
  experiences,
  fallbackImage,
  lineClampClass = "line-clamp-2",
}: {
  className?: string;
  experience: PublicExperience;
  experiences: PublicExperience[];
  fallbackImage: string;
  lineClampClass?: string;
}) {
  const name = experience.travellerName.trim() || "Traveller";
  const photoGallery = getExperiencePhotoGallery(experience);
  const avatarImage = photoGallery[0] || fallbackImage;
  const photoCount = photoGallery.length;

  return (
    <article
      className={cn(
        "mb-6 flex break-inside-avoid flex-col rounded-[10px] border border-[#eee8e2] bg-white px-5 py-5 ",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <RatingStars
          value={experience.overallRating}
          className="text-[#ffbd00]"
          starClassName="size-3"
        />
        <span className="font-sans text-eyebrow font-medium text-secondary/62">
          {getReviewMonthLabel(experience.createdAt)}
        </span>
      </div>

      <p
        className={cn(
          "mt-3 text-[14px] text-description font-medium leading-[1.5] text-secondary/82",
          lineClampClass
        )}
      >
        {experience.writtenReview || experience.title || "Traveller experience"}
      </p>

      <div className="mt-auto flex min-w-0 items-center gap-3 pt-5">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-primary/10">
          <Image
            src={avatarImage}
            alt={name}
            fill
            unoptimized
            sizes="36px"
            className="object-cover"
          />
        </span>
        <span className="min-w-0 font-sans">
          <strong className="block truncate text-description font-semibold text-[14px] leading-tight text-secondary">
            {name}
          </strong>
          <span className="block truncate text-eyebrow font-medium text-[14px] leading-tight text-secondary/62">
            Local Guide - {getTravellerReviewCount(experience, experiences)} reviews
            - {photoCount} photos
          </span>
        </span>
      </div>
    </article>
  );
}

function RatingStars({
  className,
  starClassName = "size-4",
  value,
}: {
  className?: string;
  starClassName?: string;
  value: number;
}) {
  const filledCount = Math.round(value);

  return (
    <div className={cn("flex items-center gap-0.5 text-primary", className)}>
      {Array.from({ length: 5 }, (_item, index) => (
        <Star
          key={index}
          className={cn(
            starClassName,
            index < filledCount ? "fill-current" : "text-secondary/15"
          )}
          strokeWidth={index < filledCount ? 0 : 1.2}
        />
      ))}
    </div>
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
    <div className="mt-8 rounded-[8px] border border-dashed border-[#e0d3c8] bg-white/75 px-5 py-10 text-center">
      <h3 className="font-heading text-title font-semibold text-secondary">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-[420px] font-sans text-description leading-[1.65] text-secondary/62">
        {message}
      </p>
    </div>
  );
}
