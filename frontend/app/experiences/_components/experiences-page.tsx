"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Bus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe2,
  ImageIcon,
  Play,
  Search,
  Star,
  Utensils,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
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

function getTravellerInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "AT";
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
      <HeaderBand />

      <ExperienceTopBar
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        onCategoryChange={setActiveCategory}
        onSearchQueryChange={setSearchQuery}
      />

      <section
        className={`${pageContainerClassName} grid gap-6 pb-10 pt-10 md:grid-cols-[minmax(0,1fr)_300px] md:items-end`}
      >
        <div className="min-w-0">
          <p className="font-sans text-eyebrow font-medium uppercase leading-none tracking-normal text-primary">
            Traveller Experiences
          </p>
          <h1 className="mt-2 max-w-[460px] font-heading text-title font-bold leading-none tracking-normal text-secondary">
            <span className="block">Experiences with</span>
            <span className="block text-primary">Ancient Trails</span>
          </h1>
        </div>

        <p className="max-w-[300px] font-sans text-description italic leading-[1.35] text-secondary md:justify-self-end">
          Choose a destination and get to know more about real travel
          experiences from people visiting these locations.
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
                    ? "border-primary bg-primary text-white shadow-[0_6px_15px_rgba(212,114,32,0.2)]"
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
      <article className="grid h-[102px] grid-cols-[102px_minmax(0,1fr)_50px] items-stretch overflow-hidden rounded-[9px] border border-[#eee9e4] bg-white shadow-[0_4px_10px_rgba(50,50,50,0.1)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(50,50,50,0.14)]">
        <div className="relative m-0 overflow-hidden rounded-[8px] bg-muted">
          <Image
            src={image}
            alt={destination.destinationName}
            fill
            unoptimized
            sizes="102px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>

        <div className="min-w-0 px-3.5 py-3">
          <h2 className="line-clamp-2 min-h-[36px] font-sans text-[21px] font-bold leading-[1.02] tracking-normal text-secondary">
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
          <span className="grid size-9 place-items-center rounded-full bg-primary text-white transition-colors group-hover:bg-accent">
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
              className="mt-6 inline-flex h-10 items-center gap-3 rounded-full bg-primary px-5 font-sans text-[14px] font-bold text-white transition-colors hover:bg-accent"
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
      <HeaderBand />

      <section className={`${detailContainerClassName} pb-20 pt-8`}>
        <ExperienceDetailHero
          averageRating={averageRating}
          destination={detail.destination}
          experiences={detail.experiences}
          images={images}
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
        <TravellerMomentsSection
          destination={detail.destination}
          experiences={detail.experiences}
          images={images}
        />
        <ReviewsGrid experiences={detail.experiences} images={images} />
      </section>
    </main>
  );
}

function ExperienceDetailHero({
  averageRating,
  destination,
  experiences,
  images,
}: {
  averageRating: number;
  destination: PublicDestination;
  experiences: PublicExperience[];
  images: string[];
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
  const bullets = uniqueValues([
    ...experiences.flatMap((experience) => experience.thingsToKnow),
    destination.primaryHeritageFocus
      ? `${destination.primaryHeritageFocus} heritage route`
      : "",
    destination.keyLandmarks.length > 0
      ? `${destination.keyLandmarks.length}+ landmark moments`
      : "",
  ]).slice(0, 3);

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
              <Link
                href={getTourCalendarHref({ destination })}
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
              </Link>
            </div>
          </div>
        </div>

        <aside className="w-full pt-3 lg:pt-16">
          <p className="max-w-[360px] font-sans text-description font-medium leading-[1.35] text-primary">
            Every Journey we organise is built on trust, safety and
            unforgettable memories
          </p>

          <div className="mt-9">
            <p className="font-sans text-eyebrow font-medium uppercase leading-none text-secondary">
              Rating
            </p>
            <div className="mt-3 grid w-full max-w-[390px] grid-cols-[auto_auto_minmax(112px,1fr)] items-end gap-3">
              <strong className="font-sans text-[54px] font-medium leading-[0.8] text-primary">
                {averageRating.toFixed(1)}
              </strong>
              <span className="pb-1.5 font-sans text-[28px] font-medium text-primary">
                / 5
              </span>
              <span className="mb-2 max-w-[160px] justify-self-end font-sans text-description italic leading-[1.2] text-secondary/60">
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
      <span className="absolute left-5 top-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 font-sans text-description font-semibold leading-none text-secondary shadow-[0_8px_18px_rgba(35,23,15,0.12)]">
        <ImageIcon className="size-4" strokeWidth={1.8} />
        Album
      </span>
      <span className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3">
        <strong
          className={cn(
            "min-w-0 truncate font-sans text-button font-bold leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
          )}
        >
          {title}
        </strong>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/80 bg-white/5 text-white backdrop-blur-sm transition-colors group-hover:bg-primary group-hover:border-primary">
          <ArrowRight className="size-5" strokeWidth={2} />
        </span>
      </span>
    </article>
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
  const featuredImage =
    getExperiencePhotoGallery(featuredExperience)[0] || images[1] || fallbackImages[0];
  const tallImage = images[2] || featuredImage;
  const averageRating = getAverageRating(experiences);
  const reviewCount = experiences.length;
  const thumbnailImages = [
    featuredImage,
    images[3] || images[0] || tallImage || fallbackImages[1],
  ];
  const centerVideo =
    getExperienceVideo(featuredExperience) ||
    getExperienceVideo(experiences.find((experience) => getExperienceVideo(experience)));

  return (
    <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,1fr)_390px_minmax(0,1fr)] xl:gap-10">
      <div className="flex h-full min-w-0 flex-col">
        <p className="font-sans text-eyebrow font-medium uppercase leading-none text-secondary/76">
          What Travellers Say On -
        </p>
        <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary">
          Exploring {destination.destinationName} with Us
        </h2>
        <Link
          href="#traveller-reviews"
          className="mt-5 inline-flex w-fit items-center gap-3 font-sans text-eyebrow font-medium uppercase leading-none text-primary transition-colors hover:text-accent"
        >
          Reviews &amp; Experiences
          <ArrowRight className="size-4" strokeWidth={1.9} />
        </Link>

        <div className="mt-10">
          <p className="font-sans text-eyebrow font-medium uppercase leading-none text-secondary/54">
            Rating
          </p>
          <div className="mt-3 flex items-end gap-2 font-sans text-primary">
            <strong className="text-[52px] font-medium leading-[0.82]">
              {averageRating.toFixed(1)}
            </strong>
            <span className="pb-1 text-[20px] font-medium">/5</span>
          </div>
          <p className="mt-3 font-sans text-description italic leading-none text-secondary/54">
            Based on {reviewCount}+ verified reviews
          </p>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-4">
          {thumbnailImages.map((image, index) => (
            <article
              key={`${image}-${index}`}
              className="relative h-[170px] overflow-hidden rounded-[8px] bg-muted shadow-[0_10px_22px_rgba(50,50,50,0.1)]"
            >
              <Image
                src={image}
                alt={`${destination.destinationName} traveller photo ${index + 1}`}
                fill
                unoptimized
                sizes="(min-width: 1280px) 185px, (min-width: 1024px) 15vw, 50vw"
                className="object-cover"
              />
              {index === 1 ? (
                <>
                  <span className="absolute inset-0 bg-secondary/42" />
                  <span className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/26 text-white backdrop-blur-sm">
                    <Play className="ml-0.5 size-5 fill-current" strokeWidth={0} />
                  </span>
                  <span className="absolute inset-x-3 bottom-3 text-center font-sans text-[16px] font-bold leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                    View all Photos
                  </span>
                </>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <article className="relative min-h-[560px] overflow-hidden rounded-[8px] bg-muted shadow-[0_18px_42px_rgba(50,50,50,0.12)]">
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
            sizes="(min-width: 1280px) 390px, (min-width: 1024px) 350px, 100vw"
            className="object-cover"
          />
        )}
      </article>

      <div className="flex h-full min-w-0 flex-col pt-1">
        <p className="max-w-[430px] font-sans text-description font-medium leading-[1.35] text-primary">
          Every Journey we organise is built on trust, safety and unforgettable
          memories
        </p>
        {experiences.length > 0 ? (
          <ExperienceReviewSlider
            destination={destination}
            experiences={experiences}
          />
        ) : (
          <p className="mt-10 max-w-[320px] font-sans text-description leading-[1.5] text-secondary/62">
            Traveller voices will appear here once experiences are published for
            this destination.
          </p>
        )}
      </div>
    </section>
  );
}

function CompactVoiceCard({ experience }: { experience: PublicExperience }) {
  const photo = getExperiencePhotoGallery(experience)[0] || "";
  const name = experience.travellerName.trim() || "Traveller";
  const photoCount = getExperiencePhotoGallery(experience).length;

  return (
    <article>
      <RatingStars
        value={experience.overallRating}
        className="text-[#ffbd00]"
        starClassName="size-4"
      />

      <p className="mt-4 max-w-[430px] font-sans text-description font-medium leading-[1.45] text-secondary/82">
        {experience.writtenReview || experience.title || "Traveller experience"}
      </p>

      <div className="mt-6 flex items-center gap-3">
        {photo ? (
          <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-primary/10">
            <Image
              src={photo}
              alt={name}
              fill
              unoptimized
              sizes="44px"
              className="object-cover"
            />
          </span>
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-sans text-[13px] font-bold text-white">
            {getTravellerInitials(name)}
          </span>
        )}
        <span className="min-w-0 text-left font-sans">
          <strong className="block truncate text-description font-bold leading-tight text-secondary">
            {name}
          </strong>
          <span className="block truncate text-[13px] font-medium leading-tight text-secondary/60">
            1 review - {photoCount} photos
          </span>
        </span>
      </div>
    </article>
  );
}

function ExperienceReviewSlider({
  destination,
  experiences,
}: {
  destination: PublicDestination;
  experiences: PublicExperience[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const boundedIndex = experiences[activeIndex] ? activeIndex : 0;

  function showPreviousReview() {
    setActiveIndex(boundedIndex === 0 ? experiences.length - 1 : boundedIndex - 1);
  }

  function showNextReview() {
    setActiveIndex(boundedIndex === experiences.length - 1 ? 0 : boundedIndex + 1);
  }

  return (
    <div className="mt-10 w-full min-w-0">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${boundedIndex * 100}%)` }}
        >
          {experiences.map((experience) => (
            <div
              key={experience.id || experience.experienceId}
              className="w-full shrink-0"
            >
              <CompactVoiceCard experience={experience} />
            </div>
          ))}
        </div>
      </div>

      {experiences.length > 1 ? (
        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            aria-label="Previous traveller review"
            onClick={showPreviousReview}
            className="grid size-10 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="size-4" strokeWidth={2.3} />
          </button>

          <div className="flex items-center justify-center gap-3">
            {experiences.map((experience, index) => (
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

      <div className="mt-7">
        <p className="font-sans text-description font-medium leading-[1.35] text-secondary/78">
          Ready to plan your Journey?
          <span className="block">Let&apos;s get started!</span>
        </p>
        <Link
          href={getTourCalendarHref({ destination })}
          className="mt-5 inline-flex h-11 min-w-[210px] items-center justify-between gap-6 rounded-full bg-primary px-6 font-sans text-button font-medium leading-none text-white shadow-[0_12px_28px_rgba(212,114,32,0.2)] transition-colors hover:bg-accent"
        >
          Plan your trip
          <ArrowRight className="size-5" strokeWidth={1.9} />
        </Link>
      </div>
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
      icon: CalendarDays,
      label: "Itinerary",
      value: getRatingValue(experiences, "ratingItinerary"),
    },
    {
      icon: Bus,
      label: "Transport",
      value: getRatingValue(experiences, "ratingLocalTransport"),
    },
    {
      icon: UserRoundCheck,
      label: "Guide",
      value: getRatingValue(experiences, "ratingTourExpert"),
    },
    {
      icon: BedDouble,
      label: "Accommodation",
      value: getRatingValue(experiences, "ratingAccommodation"),
    },
    {
      icon: Utensils,
      label: "Food",
      value: getRatingValue(experiences, "overallRating"),
    },
    {
      icon: Globe2,
      label: "Tour Operator",
      value: getRatingValue(experiences, "ratingTourExpert"),
    },
  ];

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="font-sans text-[28px] font-semibold leading-none text-secondary">
            Traveler Rating
          </h2>
          <p className="mt-2 font-sans text-[18px] font-medium leading-none text-secondary">
            Overall rating based on{" "}
            <strong>{reviewCount || 0} reviews</strong>
          </p>
        </div>
        <RatingStars
          value={averageRating}
          className="pb-1 text-[#ffbd00]"
          starClassName="size-3"
        />
      </div>

      <div className="mt-7 grid gap-x-14 gap-y-5 rounded-[10px] bg-[#eef8ff] px-5 py-6 sm:px-8 md:grid-cols-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="grid grid-cols-[112px_minmax(0,1fr)_32px] items-center gap-4"
          >
            <span className="flex items-center gap-3 font-sans text-[13px] font-medium text-secondary/82">
              <Icon className="size-4 text-secondary/58" strokeWidth={1.7} />
              {label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-secondary/14">
              <span
                className="block h-full rounded-full bg-secondary/72"
                style={{ width: `${Math.min(100, (value / 5) * 100)}%` }}
              />
            </span>
            <span className="font-sans text-[12px] font-medium text-secondary/78">
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
      video: getExperienceVideo(experience),
    };
  });

  return (
    <section className="mt-16">
      <h2 className="font-sans text-[28px] font-semibold leading-none text-secondary">
        Traveler Moments
      </h2>
      <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-5">
        {moments.map((moment, index) => (
          <article
            key={`${moment.image}-${index}`}
            className="relative h-[190px] overflow-hidden rounded-[8px] bg-muted shadow-[0_8px_18px_rgba(50,50,50,0.08)] xl:h-[205px]"
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
                className="object-cover"
              />
            )}
            <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.18)_100%)]" />
            <span className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-secondary text-white">
              <Play className="ml-0.5 size-5 fill-current" strokeWidth={0} />
            </span>
          </article>
        ))}
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

  return (
    <section className="mt-14 grid gap-x-24 gap-y-5 lg:grid-cols-2">
      {reviewItems.slice(0, 10).map((experience, index) => (
        <ReviewCard
          key={experience.id || experience.experienceId || index}
          experience={experience}
          experiences={experiences}
          fallbackImage={images[index % images.length] || fallbackImages[0]}
        />
      ))}
    </section>
  );
}

function ReviewCard({
  experience,
  experiences,
  fallbackImage,
}: {
  experience: PublicExperience;
  experiences: PublicExperience[];
  fallbackImage: string;
}) {
  const name = experience.travellerName.trim() || "Traveller";
  const photoGallery = getExperiencePhotoGallery(experience);
  const avatarImage = photoGallery[0] || fallbackImage;
  const photoCount = photoGallery.length;

  return (
    <article className="rounded-[4px] border border-[#eee8e2] bg-white px-7 py-5 shadow-[0_4px_12px_rgba(50,50,50,0.08)]">
      <div className="flex items-center gap-2">
        <RatingStars
          value={experience.overallRating}
          className="text-[#ffbd00]"
          starClassName="size-3"
        />
        <span className="font-sans text-[11px] font-medium text-secondary/62">
          {getReviewMonthLabel(experience.createdAt)}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 font-sans text-[11px] font-medium leading-[1.45] text-secondary/82">
        {experience.writtenReview || experience.title || "Traveller experience"}
      </p>

      <div className="mt-5 flex min-w-0 items-center gap-3">
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
          <strong className="block truncate text-[12px] font-bold leading-tight text-secondary">
            {name}
          </strong>
          <span className="block truncate text-[10px] font-medium leading-tight text-secondary/62">
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
      <h3 className="font-sans text-[24px] font-semibold text-secondary">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-[420px] font-sans text-[12px] leading-[1.65] text-secondary/62">
        {message}
      </p>
    </div>
  );
}
