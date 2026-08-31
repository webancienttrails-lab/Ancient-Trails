"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Bus,
  Camera,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  Footprints,
  Heart,
  Play,
  Share2,
  ShieldCheck,
  Shirt,
  Star,
  Ticket,
  UserRoundCheck,
  X,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";
import {
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicExperts,
  listPublicExperiences,
  listPublicTourDepartures,
  listPublicTours,
  type PublicDestination,
  type PublicExpert,
  type PublicExperience,
  type PublicTour,
  type PublicTourDeparture,
} from "@/lib/home-travel";
import { getTourCalendarHref, getTourHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const fallbackImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/destination/Hoysalas.webp",
];

type LightboxState = {
  activeIndex: number;
  fallbackImages: string[];
  images: string[];
  title: string;
};

type GalleryImageSize = {
  height: number;
  width: number;
};

const minimumLightboxImageSize: GalleryImageSize = {
  height: 400,
  width: 600,
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load destination details.";
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function getPrimaryFocus(destination: PublicDestination) {
  return destination.primaryHeritageFocus || "Heritage";
}

function getRegionLabel(destination: PublicDestination) {
  return destination.region || destination.state || destination.countryRegion;
}

function getDestinationImages(
  destination: PublicDestination,
  tours: PublicTour[] = [],
  experiences: PublicExperience[] = []
) {
  const images = uniqueValues([
    destination.bannerImage,
    destination.thumbnailImage || "",
    ...destination.galleryImages,
    ...(destination.keyLandmarkImages || []),
    ...experiences.flatMap((experience) => experience.travellerPhotoGallery),
    ...tours.flatMap((tour) => [
      tour.thumbnailImage || "",
      tour.bannerImage,
      ...tour.galleryImages,
    ]),
  ]).map(getHomeMediaUrl);

  return images.length > 0 ? images : fallbackImages;
}

function getDestinationGalleryImages(destination: PublicDestination) {
  return uniqueValues(destination.galleryImages).map(getHomeMediaUrl).filter(Boolean);
}

function getExperiencePhotoGallery(experience?: PublicExperience) {
  return uniqueValues(experience?.travellerPhotoGallery || [])
    .map(getHomeMediaUrl)
    .filter(Boolean);
}

function getExperienceGalleryImages(experiences: PublicExperience[]) {
  return uniqueValues(
    experiences.flatMap((experience) => experience.travellerPhotoGallery)
  )
    .map(getHomeMediaUrl)
    .filter(Boolean);
}

function getLightboxImageStyle(imageSize?: GalleryImageSize) {
  if (!imageSize?.width || !imageSize.height) {
    return undefined;
  }

  return {
    maxHeight: `min(calc(100vh - 9rem), ${imageSize.height}px)`,
    maxWidth: `min(calc(100vw - 3rem), ${imageSize.width}px)`,
  };
}

function isSmallLightboxImage(imageSize?: GalleryImageSize) {
  return Boolean(
    imageSize &&
      (imageSize.width < minimumLightboxImageSize.width ||
        imageSize.height < minimumLightboxImageSize.height)
  );
}

function getIndexedFallbackImage(images: string[], index: number) {
  if (images.length === 0) {
    return "";
  }

  return images[index % images.length] || images[0] || "";
}

function formatPrice(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Coming Soon"
    : shortDateFormatter.format(date).replace(",", "");
}

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLowestTourPrice(
  tour: PublicTour,
  departures: PublicTourDeparture[]
) {
  const prices = departures
    .filter((departure) => departure.tourId === tour.tourId)
    .map((departure) => departure.priceAdult)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

function getNextTourDeparture(
  tour: PublicTour,
  departures: PublicTourDeparture[]
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tourDepartures = departures
    .filter((departure) => departure.tourId === tour.tourId)
    .sort(
      (left, right) =>
        getDateValue(left.departureDate) - getDateValue(right.departureDate)
    );

  return (
    tourDepartures.find(
      (departure) => getDateValue(departure.departureDate) >= today.getTime()
    ) || tourDepartures[0]
  );
}

function getRelatedDepartures(
  tours: PublicTour[],
  departures: PublicTourDeparture[]
) {
  const tourIds = new Set(tours.map((tour) => tour.tourId));

  return departures.filter((departure) => tourIds.has(departure.tourId));
}

function isTourLinkedToDestination(
  tour: PublicTour,
  destination: PublicDestination
) {
  return getTourDestinationIds(tour).includes(destination.destinationId);
}

function getRecommendedDayNightLabel(destination: PublicDestination) {
  const days = Math.max(1, Number(destination.recommendedDurationDays) || 1);

  return days > 1 ? `${days}D/${days - 1}N` : "1 Day";
}

function getBestSeason(destination: PublicDestination, tours: PublicTour[]) {
  if (destination.bestTimeToVisit?.trim()) {
    return destination.bestTimeToVisit.trim();
  }

  const season = tours.find((tour) => tour.bestSeason.trim())?.bestSeason;

  if (season) {
    return season;
  }

  if (destination.destinationType === "Domestic") {
    return "September-November";
  }

  return "Year round";
}

function getHeritageIntro(destination: PublicDestination) {
  if (destination.shortDescription.trim()) {
    return destination.shortDescription;
  }

  return `${destination.destinationName} brings together ${getPrimaryFocus(
    destination
  ).toLowerCase()}, local stories and carefully paced heritage exploration.`;
}

function getLandmarkRows(destination: PublicDestination, images: string[]) {
  const labels =
    destination.keyLandmarks.length > 0
      ? destination.keyLandmarks
      : uniqueValues([
          destination.primaryHeritageFocus,
          destination.city,
          destination.state,
          destination.unescoSite ? "UNESCO Heritage" : "",
        ]);

  return labels.slice(0, 8).map((label, index) => ({
    image:
      getHomeMediaUrl(destination.keyLandmarkImages?.[index] || "") ||
      images[(index + 1) % images.length] ||
      fallbackImages[index % fallbackImages.length],
    label,
  }));
}

function isHampiDestination(destination: PublicDestination) {
  return (
    normalizeCode(destination.destinationId) === "HAMPI" ||
    slugify(destination.destinationName) === "hampi"
  );
}

function getAttractionSummary(destination: PublicDestination) {
  if (isHampiDestination(destination)) {
    return "History of Vijaynagara Kingdom, Temple Architecture, Caves";
  }

  return (
    uniqueValues([
      destination.primaryHeritageFocus,
      ...destination.keyLandmarks.slice(0, 2),
    ]).join(", ") || getPrimaryFocus(destination)
  );
}

function getFeaturedLandmarkRows(
  destination: PublicDestination,
  images: string[]
) {
  const landmarks = getLandmarkRows(destination, images);

  if (!isHampiDestination(destination)) {
    return landmarks;
  }

  const findLandmark = (keyword: string, fallbackIndex: number) =>
    landmarks.find((landmark) =>
      landmark.label.toLowerCase().includes(keyword)
    ) || landmarks[fallbackIndex];

  const virupaksha = findLandmark("virup", 0);
  const lotus = findLandmark("lotus", 1);
  const pushkarini = findLandmark("pushkar", 2);

  const featuredLandmarks = [
    {
      image: virupaksha?.image || images[1] || fallbackImages[0],
      label: "Virupaksh Temple",
    },
    {
      image: lotus?.image || images[2] || fallbackImages[1],
      label: "Lotus Mahal",
    },
    {
      image: pushkarini?.image || images[3] || fallbackImages[2],
      label: "Pushkarini",
    },
  ];
  const featuredKeywords = ["virup", "lotus", "pushkar"];
  const remainingLandmarks = landmarks.filter(
    (landmark) =>
      !featuredKeywords.some((keyword) =>
        landmark.label.toLowerCase().includes(keyword)
      )
  );

  return [...featuredLandmarks, ...remainingLandmarks];
}

function getPlanningItems(destination: PublicDestination) {
  const items = [
    destination.dressCode || "No dress code.",
    destination.footwear || "Comfortable walking shoes or floaters",
    destination.restrictions || "Photography allowed without tripods.",
    destination.idRequirement || "Not Required",
    destination.permits || "Standard entry ticket only",
  ];

  return uniqueValues(items).slice(0, 5);
}

function getAverageExperienceRating(experiences: PublicExperience[]) {
  if (experiences.length === 0) {
    return 4.9;
  }

  const total = experiences.reduce(
    (sum, experience) => sum + experience.overallRating,
    0
  );

  return Number((total / experiences.length).toFixed(1));
}

function getPublishedExperienceCount(experiences: PublicExperience[]) {
  return experiences.length;
}

function getExperienceImage(
  experience: PublicExperience | undefined,
  fallbackImage: string
) {
  return getHomeMediaUrl(experience?.travellerPhotoGallery?.[0] || "") || fallbackImage;
}

function getExperienceVideo(experience: PublicExperience | undefined) {
  return getHomeMediaUrl(
    experience?.travellerVideos.find((video) => video.trim()) || ""
  );
}

function isExperienceUploadImage(image: string) {
  return image.includes("/uploads/experiences/");
}

function getDisplayFallbackImages(images: string[]) {
  const displayImages = images.filter(
    (image) => image && !isExperienceUploadImage(image)
  );

  return displayImages.length > 0 ? displayImages : fallbackImages;
}

function getDisplayFallbackImage(images: string[], preferredIndex = 0) {
  const displayImages = getDisplayFallbackImages(images);

  return (
    displayImages[preferredIndex] ||
    displayImages[0] ||
    fallbackImages[preferredIndex] ||
    fallbackImages[0]
  );
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

function getTourImage(tour: PublicTour, fallbackImage: string) {
  return getHomeMediaUrl(
    tour.thumbnailImage || tour.bannerImage || tour.galleryImages[0] || fallbackImage
  );
}

function getOrdinalSuffix(day: number) {
  if (day > 3 && day < 21) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatOrdinalDate(value: string | null | undefined) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  const parts = shortDateFormatter.formatToParts(date);
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";

  if (!day || !month || !year) {
    return formatDate(value);
  }

  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

function compactDurationLabel(value: string, fallbackDays: number) {
  const source = value.trim();
  const fallbackLabel =
    fallbackDays > 1 ? `${fallbackDays}D/${fallbackDays - 1}N` : "1 Day";

  if (!source) {
    return fallbackLabel;
  }

  const dayNightMatch = source.match(
    /(\d+)\s*(?:days?|d)\b\s*(?:[/,-]|and)?\s*(\d+)\s*(?:nights?|n)\b/i
  );

  if (dayNightMatch) {
    return `${dayNightMatch[1]}D/${dayNightMatch[2]}N`;
  }

  const dayMatch = source.match(/(\d+)\s*(?:days?|d)\b/i);

  if (dayMatch) {
    const days = Number(dayMatch[1]);

    return days > 1 ? `${days}D/${days - 1}N` : "1 Day";
  }

  return source.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

function getTourBadgeLabel(tour: PublicTour) {
  const label = [tour.category, tour.tourType].find((value) =>
    /best|popular|featured|recommended|trending/i.test(value)
  );

  return (label || "Bestseller").trim().toUpperCase();
}

function getTourDifficultyLabel(tour: PublicTour) {
  const difficulty = tour.difficulty.trim() || "Moderate";

  return /activity\s*level/i.test(difficulty)
    ? difficulty
    : `${difficulty} Activity Level`;
}

function getReadableExpertName(expertId: string) {
  const value = expertId.trim();

  if (!value) {
    return "Ancient Trails Expert";
  }

  return value
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getTourExpertName(tour: PublicTour, experts: PublicExpert[]) {
  const matchedExpert = experts.find(
    (expert) => normalizeCode(expert.expertId) === normalizeCode(tour.expertId)
  );

  return matchedExpert?.fullName.trim() || getReadableExpertName(tour.expertId);
}

export function SingleDestinationPage({
  destinationId,
}: {
  destinationId: string;
}) {
  const [destination, setDestination] = useState<PublicDestination | null>(null);
  const [relatedTours, setRelatedTours] = useState<PublicTour[]>([]);
  const [departures, setDepartures] = useState<PublicTourDeparture[]>([]);
  const [experts, setExperts] = useState<PublicExpert[]>([]);
  const [experiences, setExperiences] = useState<PublicExperience[]>([]);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const requestedId = decodeURIComponent(destinationId);

    async function loadDestination() {
      setIsLoading(true);
      setLoadError("");

      try {
        const destinationsResponse = await listPublicDestinations();
        const normalizedRequestedId = normalizeCode(requestedId);
        const requestedSlug = slugify(requestedId);
        const matchedDestination =
          destinationsResponse.data.destinations.find(
            (item) =>
              normalizeCode(item.destinationId) === normalizedRequestedId ||
              slugify(item.destinationName) === requestedSlug
          ) || null;

        if (!matchedDestination) {
          if (isMounted) {
            setDestination(null);
            setRelatedTours([]);
            setDepartures([]);
            setExperts([]);
            setExperiences([]);
            setLoadError("Destination not found.");
          }

          return;
        }

        const [toursResponse, departuresResponse, experiencesResponse, expertsResponse] =
          await Promise.all([
            listPublicTours(matchedDestination.destinationId),
            listPublicTourDepartures(),
            listPublicExperiences(matchedDestination.destinationId).catch(() => ({
              data: { experiences: [] as PublicExperience[] },
            })),
            listPublicExperts().catch(() => ({
              data: { experts: [] as PublicExpert[] },
            })),
          ]);
        const tours = toursResponse.data.tours.filter((tour) =>
          isTourLinkedToDestination(tour, matchedDestination)
        );

        if (isMounted) {
          setDestination(matchedDestination);
          setRelatedTours(tours);
          setDepartures(getRelatedDepartures(tours, departuresResponse.data.departures));
          setExperts(expertsResponse.data.experts);
          setExperiences(experiencesResponse.data.experiences);
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

    loadDestination();

    return () => {
      isMounted = false;
    };
  }, [destinationId]);

  const images = useMemo(
    () =>
      destination
        ? getDestinationImages(destination, relatedTours, experiences)
        : fallbackImages,
    [destination, experiences, relatedTours]
  );
  const destinationGalleryImages = useMemo(
    () => (destination ? getDestinationGalleryImages(destination) : []),
    [destination]
  );
  const experienceGalleryImages = useMemo(
    () => getExperienceGalleryImages(experiences),
    [experiences]
  );

  function openLightbox(
    galleryImages: string[],
    title: string,
    activeIndex = 0,
    lightboxFallbackImages = fallbackImages
  ) {
    if (galleryImages.length === 0) {
      return;
    }

    setLightbox({
      activeIndex: Math.min(Math.max(activeIndex, 0), galleryImages.length - 1),
      fallbackImages: lightboxFallbackImages,
      images: galleryImages,
      title,
    });
  }

  if (isLoading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background text-secondary">
        <LoadingDestination />
      </main>
    );
  }

  if (!destination || loadError) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background text-secondary">
        <TopBackdrop />
        <section className="mx-auto mt-10 max-w-[720px] px-5 pb-20">
          <div className="rounded-[8px] border border-[#ead8c5] bg-white p-8 text-center shadow-[0_18px_44px_rgba(50,50,50,0.08)]">
            <h1 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Destination not found
            </h1>
            <p className="mx-auto mt-4 max-w-[460px] font-sans text-description text-secondary/70">
              {loadError ||
                "This destination is not available in the current destination records."}
            </p>
            <Link
              href="/destinations"
              className="mt-6 inline-flex h-10 items-center gap-3 rounded-full bg-primary px-5 font-sans text-[14px] font-bold text-white transition-colors hover:bg-accent"
            >
              Back to Destinations
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-secondary">
      <TopBackdrop />

      <div className="mx-auto mt-8 w-[calc(100%-2.5rem)] max-w-[1300px] pb-16">
        <DestinationOverview
          destination={destination}
          images={images}
          onGalleryOpen={(index) =>
            openLightbox(
              destinationGalleryImages,
              `${destination.destinationName} gallery`,
              index
            )
          }
          tours={relatedTours}
        />

        <ExploreAndPlan
          destination={destination}
          images={images}
        />

        <TravellerExperienceSection
          destination={destination}
          experiences={experiences}
          experienceGalleryImages={experienceGalleryImages}
          images={images}
          onExperienceGalleryOpen={(galleryImages, title, activeIndex) =>
            openLightbox(
              galleryImages,
              title,
              activeIndex,
              getDisplayFallbackImages(images)
            )
          }
        />

        <ToursSection
          departures={departures}
          destination={destination}
          experts={experts}
          images={images}
          tours={relatedTours}
        />

        {lightbox ? (
          <GalleryLightbox
            activeIndex={lightbox.activeIndex}
            fallbackImages={lightbox.fallbackImages}
            images={lightbox.images}
            title={lightbox.title}
            onClose={() => setLightbox(null)}
            onIndexChange={(index) =>
              setLightbox((current) =>
                current ? { ...current, activeIndex: index } : current
              )
            }
          />
        ) : null}
      </div>
    </main>
  );
}

function LoadingDestination() {
  return (
    <>
      <TopBackdrop />
      <section className="mx-auto mt-8 w-[calc(100%-2.5rem)] max-w-[1300px] pb-16">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.95fr)]">
          <div className="h-[320px] animate-pulse rounded-[8px] bg-muted xl:h-[360px]" />
          <div className="h-[320px] animate-pulse rounded-[8px] bg-muted xl:h-[360px]" />
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="h-52 animate-pulse rounded-[8px] bg-muted" />
          <div className="h-52 animate-pulse rounded-[8px] bg-muted" />
        </div>
      </section>
    </>
  );
}

function TopBackdrop() {
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
      <div className="relative z-10 mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-0">
        <Header />
      </div>
    </section>
  );
}

function DestinationOverview({
  destination,
  images,
  onGalleryOpen,
  tours,
}: {
  destination: PublicDestination;
  images: string[];
  onGalleryOpen: (index: number) => void;
  tours: PublicTour[];
}) {
  const galleryImages = Array.from({ length: 5 }, (_item, index) =>
    images[index + 1] || images[index] || fallbackImages[index % fallbackImages.length]
  );

  return (
    <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.95fr)]">
      <article className="relative h-[410px] overflow-hidden rounded-[8px] bg-secondary shadow-[0_14px_30px_rgba(34,25,18,0.15)] sm:h-[430px] lg:h-full lg:min-h-[410px] xl:min-h-[430px]">
        <Image
          src={images[0] || fallbackImages[0]}
          alt={destination.destinationName}
          fill
          priority
          sizes="(min-width: 1280px) 780px, (min-width: 1024px) 58vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.38)_22%,rgba(20,13,8,0.04)_48%,rgba(20,13,8,0.78)_100%)]" />

        <div className="absolute left-5 top-4 max-w-[calc(100%-12rem)] text-white sm:max-w-[70%]">
          <h1 className="break-words font-heading text-title font-bold italic leading-none tracking-normal drop-shadow-sm">
            {destination.destinationName}
          </h1>
          <p className="mt-1 font-sans text-description font-medium text-white/86">
            {getRegionLabel(destination)}
          </p>
        </div>

        <span className="absolute right-4 top-4  px-4 py-2 font-sans text-[14px] font-bold text-white ">
          Recommended Days: {getRecommendedDayNightLabel(destination)}
        </span>

        <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[14px] font-bold text-white">
            Best Time To Visit - {getBestSeason(destination, tours)}
          </p>
          {destination.unescoSite ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-sans text-[14px] font-bold text-white">
              <ShieldCheck className="size-4" />
              Unesco Site
            </span>
          ) : null}
        </div>
      </article>

      <aside className="min-w-0 rounded-[8px] bg-background lg:flex lg:h-full lg:flex-col">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            {galleryImages.slice(0, 2).map((image, index) => (
              <GalleryThumb
                key={`${image}-${index}`}
                alt={`${destination.destinationName} gallery ${index + 1}`}
                image={image}
                size="large"
                isOverlay={index === 1}
                onOpen={onGalleryOpen}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {galleryImages.slice(2, 5).map((image, index) => (
              <GalleryThumb
                key={`${image}-${index + 2}`}
                alt={`${destination.destinationName} gallery ${index + 3}`}
                image={image}
                size="small"
              />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[8px] bg-background">
          <h2 className="font-heading text-title font-bold italic leading-none tracking-normal text-secondary">
            Heritage
            <span className="ml-2 font-sans text-description font-medium not-italic text-secondary/70">
              at {destination.destinationName}
            </span>
          </h2>
          <p className="mt-4 max-w-[470px] font-sans text-description text-secondary/70">
            {getHeritageIntro(destination)}
          </p>
        </div>
      </aside>
    </section>
  );
}

function GalleryThumb({
  alt,
  image,
  isOverlay = false,
  onOpen,
  size,
}: {
  alt: string;
  image: string;
  isOverlay?: boolean;
  onOpen?: (index: number) => void;
  size: "large" | "small";
}) {
  const galleryIndex = isOverlay ? 1 : 0;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[8px] bg-muted shadow-sm",
        size === "large" ? "h-[150px] xl:h-[168px]" : "h-[100px] xl:h-[116px]"
      )}
    >
      <Image
        src={image || fallbackImages[0]}
        alt={alt}
        fill
        sizes={size === "large" ? "(min-width: 1280px) 300px, 220px" : "(min-width: 1280px) 190px, 145px"}
        className="object-cover"
      />
      {isOverlay ? (
        <button
          type="button"
          onClick={() => onOpen?.(galleryIndex)}
          className="absolute inset-0 grid place-items-center bg-black/54 px-3 text-center transition-colors hover:bg-black/62"
        >
          <span className="font-sans text-description font-bold leading-tight text-white">
            View all Photos
          </span>
        </button>
      ) : null}
    </article>
  );
}

function GalleryLightbox({
  activeIndex,
  fallbackImages: lightboxFallbackImages,
  images,
  onClose,
  onIndexChange,
  title,
}: {
  activeIndex: number;
  fallbackImages: string[];
  images: string[];
  onClose: () => void;
  onIndexChange: (index: number) => void;
  title: string;
}) {
  const galleryImages =
    images.length > 0
      ? images
      : lightboxFallbackImages.length > 0
        ? lightboxFallbackImages
        : fallbackImages;
  const boundedIndex = Math.min(Math.max(activeIndex, 0), galleryImages.length - 1);
  const sourceImage = galleryImages[boundedIndex] || fallbackImages[0];
  const [imageSizes, setImageSizes] = useState<Record<string, GalleryImageSize>>(
    {}
  );
  const highResolutionFallbackImage =
    getIndexedFallbackImage(lightboxFallbackImages, boundedIndex) ||
    fallbackImages[boundedIndex % fallbackImages.length] ||
    fallbackImages[0];
  const shouldUseFallbackImage =
    isExperienceUploadImage(sourceImage) &&
    highResolutionFallbackImage !== sourceImage &&
    isSmallLightboxImage(imageSizes[sourceImage]);
  const activeImage = shouldUseFallbackImage
    ? highResolutionFallbackImage
    : sourceImage;
  const activeImageStyle = getLightboxImageStyle(imageSizes[activeImage]);

  function updateImageSize(image: HTMLImageElement) {
    const imageSource = image.currentSrc || image.src || activeImage;
    const naturalSize = {
      height: image.naturalHeight,
      width: image.naturalWidth,
    };

    if (!naturalSize.height || !naturalSize.width) {
      return;
    }

    setImageSizes((currentSizes) => {
      const currentSize = currentSizes[imageSource];

      if (
        currentSize?.height === naturalSize.height &&
        currentSize.width === naturalSize.width
      ) {
        return currentSizes;
      }

      return {
        ...currentSizes,
        [activeImage]: naturalSize,
        [imageSource]: naturalSize,
      };
    });
  }

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft") {
        onIndexChange(
          boundedIndex === 0 ? galleryImages.length - 1 : boundedIndex - 1
        );
      }

      if (event.key === "ArrowRight") {
        onIndexChange(
          boundedIndex === galleryImages.length - 1 ? 0 : boundedIndex + 1
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [boundedIndex, galleryImages.length, onClose, onIndexChange]);

  function showPreviousImage() {
    onIndexChange(boundedIndex === 0 ? galleryImages.length - 1 : boundedIndex - 1);
  }

  function showNextImage() {
    onIndexChange(boundedIndex === galleryImages.length - 1 ? 0 : boundedIndex + 1);
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
            {boundedIndex + 1} / {galleryImages.length}
          </p>
          <div className="flex items-center gap-5 text-white/88">
            <button
              type="button"
              aria-label="Fullscreen gallery"
              className="transition-colors hover:text-primary"
            >
              <Expand className="size-6" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Zoom gallery image"
              className="transition-colors hover:text-primary"
            >
              <ZoomIn className="size-6" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Share gallery image"
              className="transition-colors hover:text-primary"
            >
              <Share2 className="size-6" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Close gallery"
              onClick={onClose}
              className="transition-colors hover:text-primary"
            >
              <X className="size-7" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-16 md:px-24">
          <button
            type="button"
            aria-label="Previous gallery image"
            onClick={showPreviousImage}
            className="absolute left-5 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/18 text-white transition-colors hover:bg-primary md:left-10"
          >
            <ChevronLeft className="size-8" strokeWidth={2.4} />
          </button>

          <div
            className="relative h-[calc(100vh-9rem)] w-full max-w-[1120px]"
            style={activeImageStyle}
          >
            <Image
              src={activeImage}
              alt={`${title} gallery image ${boundedIndex + 1}`}
              fill
              priority
              unoptimized
              sizes="(min-width: 1280px) 1120px, calc(100vw - 3rem)"
              onLoad={(event) => updateImageSize(event.currentTarget)}
              className="object-contain object-center drop-shadow-[0_18px_42px_rgba(0,0,0,0.26)]"
            />
          </div>

          <button
            type="button"
            aria-label="Next gallery image"
            onClick={showNextImage}
            className="absolute right-5 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/18 text-white transition-colors hover:bg-primary md:right-10"
          >
            <ChevronRight className="size-8" strokeWidth={2.4} />
          </button>
        </div>

        <p className="absolute bottom-6 left-1/2 z-20 w-[min(90vw,520px)] -translate-x-1/2 truncate text-center font-sans text-[18px] font-bold text-white/92">
          {title} {boundedIndex + 1}
        </p>
      </div>
    </section>,
    document.body
  );
}

function ExploreAndPlan({
  destination,
  images,
}: {
  destination: PublicDestination;
  images: string[];
}) {
  const landmarks = getFeaturedLandmarkRows(destination, images);
  const planningItems = getPlanningItems(destination);
  const attractionSummary = getAttractionSummary(destination);
  const planningIcons = [Shirt, Footprints, Camera, ShieldCheck, Ticket];
  const attractionItems =
    landmarks.length > 0
      ? landmarks
      : [
          {
            image: images[1] || fallbackImages[0],
            label: destination.destinationName,
          },
          {
            image: images[2] || fallbackImages[1],
            label: getPrimaryFocus(destination),
          },
          {
            image: images[3] || fallbackImages[2],
            label: getRegionLabel(destination),
          },
        ];
  const [attractionSlideIndex, setAttractionSlideIndex] = useState(0);
  const [nextAttractionSlideIndex, setNextAttractionSlideIndex] = useState<
    number | null
  >(null);
  const nextSlideIndex =
    attractionItems.length > 1
      ? (attractionSlideIndex + 1) % attractionItems.length
      : attractionSlideIndex;
  const isAttractionSliding = nextAttractionSlideIndex !== null;
  const attractionTrack = getVisibleAttractionTrack(
    attractionItems,
    attractionSlideIndex
  );

  useEffect(() => {
    if (attractionItems.length <= 1 || nextAttractionSlideIndex !== null) {
      return;
    }

    const interval = window.setInterval(() => {
      setNextAttractionSlideIndex(nextSlideIndex);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [attractionItems.length, nextAttractionSlideIndex, nextSlideIndex]);

  useEffect(() => {
    if (nextAttractionSlideIndex === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAttractionSlideIndex(nextAttractionSlideIndex);
      setNextAttractionSlideIndex(null);
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [nextAttractionSlideIndex]);

  return (
    <section className="mt-10 grid gap-10 py-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(400px,0.88fr)] xl:grid-cols-[minmax(0,750px)_minmax(430px,1fr)] xl:gap-[40px]">
      <div className="min-w-0">
        <div className="grid gap-5 sm:grid-cols-[280px_minmax(0,1fr)] sm:items-start">
          <div className="pt-0.5">
            <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              Explore with us
            </p>
            <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Top Attractions
            </h2>
          </div>
          <p className="max-w-[390px] border-l border-[#a8a8a8] pl-7 font-sans text-description italic text-secondary/80 sm:mt-[31px]">
            {attractionSummary}
          </p>
        </div>

        <div className="mt-7 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[700px] overflow-hidden lg:min-w-0">
            <div
              className={cn(
                "flex gap-6",
                isAttractionSliding &&
                  "transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              )}
              style={{
                transform: isAttractionSliding
                  ? "translateX(calc((100% + 1.5rem) / -3))"
                  : "translateX(0)",
              }}
            >
              {attractionTrack.map((landmark, index) => (
                <div
                  key={`${landmark.label}-${attractionSlideIndex}-${index}`}
                  className="shrink-0"
                  style={{ width: "calc((100% - 3rem) / 3)" }}
                >
                  <AttractionCard
                    image={landmark.image}
                    label={landmark.label}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:pl-1 xl:pl-0">
        <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
          Planning a trip to {destination.destinationName.toUpperCase()}?
        </p>
        <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
          Things to remember
        </h2>

        <div className="mt-7">
          <ul className="grid gap-5">
            {planningItems.map((item, index) => (
              <li
                key={item}
                className="flex items-center gap-6 font-sans text-description font-medium leading-snug text-secondary/80"
              >
                <PlanningIconBullet
                  icon={planningIcons[index % planningIcons.length]}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function getVisibleAttractionTrack(
  attractions: Array<{ image: string; label: string }>,
  startIndex: number
) {
  if (attractions.length <= 1) {
    return attractions;
  }

  return Array.from({ length: 4 }, (_item, index) => {
    const attractionIndex = (startIndex + index) % attractions.length;

    return attractions[attractionIndex];
  });
}

function AttractionCard({ image, label }: { image: string; label: string }) {
  return (
    <article className="min-w-0">
      <div className="relative h-[220px] overflow-hidden rounded-[8px] bg-muted shadow-[0_10px_20px_rgba(67,43,27,0.08)] lg:h-[250px] xl:h-[273px]">
        <Image
          src={image || fallbackImages[0]}
          alt={label}
          fill
          sizes="(min-width: 1280px) 235px, (min-width: 1024px) 18vw, 230px"
          className="object-cover transition-transform duration-700 hover:scale-105"
        />
      </div>
      <h3 className="mt-5 truncate font-sans text-description font-medium leading-none text-secondary/90">
        {label}
      </h3>
    </article>
  );
}

function PlanningIconBullet({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff4ee] text-primary"
    >
      <Icon className="size-[19px]" strokeWidth={1.9} />
    </span>
  );
}

function TravellerExperienceSection({
  destination,
  experiences,
  experienceGalleryImages,
  images,
  onExperienceGalleryOpen,
}: {
  destination: PublicDestination;
  experiences: PublicExperience[];
  experienceGalleryImages: string[];
  images: string[];
  onExperienceGalleryOpen: (
    galleryImages: string[],
    title: string,
    activeIndex?: number
  ) => void;
}) {
  if (experiences.length === 0) {
    return null;
  }

  const averageRating = getAverageExperienceRating(experiences);
  const featuredExperience = experiences[0];
  const reviewExperiences = experiences.slice(0, 2);
  const displayFallbackImages = getDisplayFallbackImages(images);
  const featuredFallbackImage = getDisplayFallbackImage(images, 3);
  const featuredImage = getExperienceImage(featuredExperience, featuredFallbackImage);
  const featuredVideo = getExperienceVideo(featuredExperience);

  function getTravellerReviewCount(experience: PublicExperience) {
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

  return (
    <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(180px,0.58fr)_minmax(290px,0.95fr)] lg:items-start xl:gap-10">
      <div className="pt-2">
        <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
          What Travellers say on -
        </p>
        <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
          Exploring {destination.destinationName} with Us
        </h2>
        <Link
          href="/experiences"
          className="mt-4 inline-flex items-center gap-2 font-sans text-description font-medium uppercase text-primary"
        >
          Reviews & Experiences
          <ArrowRight className="size-4" />
        </Link>

        <div className="mt-8">
          <p className="font-sans text-description font-medium uppercase text-secondary/48">
            Rating
          </p>
          <div className="mt-1 flex items-end gap-2">
            <strong className="font-sans text-[42px] font-medium leading-none text-primary">
              {averageRating.toFixed(1)}
            </strong>
            <span className="pb-1.5 font-sans text-description font-medium text-primary">
              /5
            </span>
          </div>
          <p className="mt-1 max-w-[220px] font-sans text-description italic text-secondary/46">
            Based on {getPublishedExperienceCount(experiences)} verified
            review{getPublishedExperienceCount(experiences) === 1 ? "" : "s"}
          </p>
        </div>

        <MiniMediaRow
          displayFallbackImages={displayFallbackImages}
          experienceGalleryImages={experienceGalleryImages}
          title={`${destination.destinationName} traveller photos`}
          onPhotosOpen={onExperienceGalleryOpen}
        />
      </div>

      <article className="relative h-[420px] overflow-hidden rounded-[8px] bg-[#f3eee9] shadow-[0_14px_30px_rgba(67,43,27,0.12)] xl:h-[460px]">
        {featuredVideo ? (
          <video
            autoPlay
            className="size-full object-cover object-center"
            controls
            loop
            muted
            playsInline
            poster={featuredImage || fallbackImages[0]}
            preload="metadata"
            src={featuredVideo}
          />
        ) : (
          <Image
            src={featuredImage || fallbackImages[0]}
            alt={featuredExperience?.title || destination.destinationName}
            fill
            unoptimized
            sizes="(min-width: 1280px) 340px, (min-width: 1024px) 28vw, 100vw"
            className="object-cover object-center"
          />
        )}
      </article>

      <div className="grid gap-3">
        <div className="grid gap-4">
          <p className="max-w-[360px] font-sans text-description font-medium text-primary">
            Every Journey we organise is built on trust, safety and unforgettable
            memories
          </p>

          {reviewExperiences.map((experience) => (
            <ReviewCard
              key={experience.id}
              experience={experience}
              reviewCount={getTravellerReviewCount(experience)}
              onPhotoOpen={onExperienceGalleryOpen}
            />
          ))}
        </div>

        <div className="pt-5">
          <p className="font-sans text-description font-medium text-secondary/70">
            Ready to plan your Journey?
            <span className="block">Let&apos;s get started!</span>
          </p>
          <Link
            href={getTourCalendarHref({ destination })}
            className="mt-3 inline-flex h-9 items-center gap-3 rounded-full bg-primary px-5 font-sans text-[14px] font-bold text-white transition-colors hover:bg-accent"
          >
            Plan your trip
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function MiniMediaRow({
  displayFallbackImages,
  experienceGalleryImages,
  onPhotosOpen,
  title,
}: {
  displayFallbackImages: string[];
  experienceGalleryImages: string[];
  onPhotosOpen: (
    galleryImages: string[],
    title: string,
    activeIndex?: number
  ) => void;
  title: string;
}) {
  const fallbackPhoto =
    displayFallbackImages[1] ||
    displayFallbackImages[0] ||
    fallbackImages[0];
  const previewFallbackPhoto =
    displayFallbackImages[2] ||
    displayFallbackImages[0] ||
    fallbackImages[0];
  const photo =
    experienceGalleryImages[1] ||
    experienceGalleryImages[0] ||
    fallbackPhoto;
  const previewPhoto = experienceGalleryImages[0] || previewFallbackPhoto;

  return (
    <div className="mt-8 grid grid-cols-2 gap-3">
      <div className="relative h-[180px] overflow-hidden rounded-[8px] bg-[#f3eee9]">
        <Image
          src={photo || fallbackPhoto}
          alt="Traveller memory"
          fill
          unoptimized
          sizes="180px"
          className="object-cover object-center"
        />
      </div>
      <button
        type="button"
        onClick={() => onPhotosOpen(experienceGalleryImages, title, 0)}
        className="relative grid h-[180px] place-items-center overflow-hidden rounded-[8px] bg-[#2b241f] text-white"
      >
        <Image
          src={previewPhoto}
          alt=""
          fill
          unoptimized
          sizes="180px"
          className="object-cover object-center"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-black/38"
        />
        <span className="relative grid size-9 place-items-center rounded-full bg-white/22">
          <Play className="ml-0.5 size-4 fill-current" strokeWidth={0} />
        </span>
        <span className="absolute bottom-2 left-2 right-2 truncate text-center font-sans text-description font-bold text-white">
          View all Photos
        </span>
      </button>
    </div>
  );
}

function RatingStars({
  className,
  value,
}: {
  className?: string;
  value: number;
}) {
  const filledCount = Math.round(value);

  return (
    <div className={cn("flex items-center gap-0.5 text-primary", className)}>
      {Array.from({ length: 5 }, (_item, index) => (
        <Star
          key={index}
          className={cn(
            "size-4",
            index < filledCount ? "fill-current" : "text-white/80"
          )}
          strokeWidth={index < filledCount ? 0 : 1.4}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  experience,
  onPhotoOpen,
  reviewCount,
}: {
  experience: PublicExperience;
  onPhotoOpen?: (
    galleryImages: string[],
    title: string,
    activeIndex?: number
  ) => void;
  reviewCount: number;
}) {
  const name = experience.travellerName.trim() || "Traveller";
  const photoGallery = getExperiencePhotoGallery(experience);
  const photoCount = photoGallery.length;
  const reviewText =
    experience.writtenReview || experience.title || "Traveller experience";
  const reviewMeta = `${reviewCount} review${reviewCount === 1 ? "" : "s"} - ${photoCount} photo${photoCount === 1 ? "" : "s"}`;
  const avatarImage = photoGallery[0] || "";
  const identity = (
    <>
      {avatarImage ? (
        <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-primary/10">
          <Image
            src={avatarImage}
            alt={name}
            fill
            unoptimized
            sizes="40px"
            className="object-cover"
          />
        </span>
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-sans text-description font-bold text-white">
          {getTravellerInitials(name)}
        </span>
      )}
      <span className="min-w-0">
        <strong className="block truncate font-sans text-description font-bold leading-tight text-secondary">
          {name}
        </strong>
        <span className="block truncate font-sans text-[12px] font-semibold leading-tight text-secondary/58">
          {reviewMeta}
        </span>
      </span>
    </>
  );

  return (
    <article className="rounded-[8px] border border-[#eee5dd] bg-white px-4 py-4 shadow-[0_7px_16px_rgba(50,50,50,0.1)]">
      <RatingStars value={experience.overallRating} className="text-[#ffb000]" />
      <p className="mt-2 font-sans text-description font-medium text-secondary/78">
        {reviewText}
      </p>
      {photoCount > 0 && onPhotoOpen ? (
        <button
          type="button"
          onClick={() => onPhotoOpen(photoGallery, `${name} photos`)}
          className="mt-4 flex w-full min-w-0 items-center gap-3 text-left"
        >
          {identity}
        </button>
      ) : (
        <div className="mt-4 flex min-w-0 items-center gap-3">
          {identity}
        </div>
      )}
    </article>
  );
}

function ToursSection({
  departures,
  destination,
  experts,
  images,
  tours,
}: {
  departures: PublicTourDeparture[];
  destination: PublicDestination;
  experts: PublicExpert[];
  images: string[];
  tours: PublicTour[];
}) {
  if (tours.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
        Plan your visit
      </p>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
          Tours in {destination.destinationName.toUpperCase()}
        </h2>
        <Link
          href={getTourCalendarHref({ destination })}
          className="inline-flex w-fit items-center gap-2 font-sans text-description font-medium uppercase text-primary"
        >
          View all tours
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-5 grid justify-items-center gap-5 md:grid-cols-2 xl:grid-cols-3">
        {tours.slice(0, 3).map((tour, index) => (
          <DestinationTourCard
            key={tour.id || tour.tourId}
            destination={destination}
            fallbackImage={images[index % images.length] || fallbackImages[0]}
            expertName={getTourExpertName(tour, experts)}
            nextDeparture={getNextTourDeparture(tour, departures)}
            price={getLowestTourPrice(tour, departures)}
            tour={tour}
          />
        ))}
      </div>
    </section>
  );
}

function DestinationTourCard({
  destination,
  expertName,
  fallbackImage,
  nextDeparture,
  price,
  tour,
}: {
  destination: PublicDestination;
  expertName: string;
  fallbackImage: string;
  nextDeparture?: PublicTourDeparture;
  price: number;
  tour: PublicTour;
}) {
  const duration = compactDurationLabel(
    tour.durationDn,
    destination.recommendedDurationDays || 1
  );
  const tourHref = getTourHref(tour);
  const tourIncludes = [
    { icon: BedDouble, label: "Accommodation" },
    { icon: Camera, label: "Sightseeing" },
    { icon: UserRoundCheck, label: "Expert guide" },
    { icon: Bus, label: "Local transport" },
  ];

  return (
    <article className="group w-full max-w-[410px] overflow-hidden rounded-[20px] border border-[#e8dfd8] bg-white shadow-[0_12px_26px_rgba(50,50,50,0.12)]">
      <div className="relative aspect-[1.6/1] overflow-hidden bg-muted">
        <Image
          src={getTourImage(tour, fallbackImage)}
          alt={tour.tourName}
          fill
          sizes="(min-width: 1280px) 410px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.12)_0%,rgba(18,12,8,0.02)_48%,rgba(18,12,8,0.35)_100%)]" />

        <div className="absolute left-5 top-0 flex h-[46px] items-stretch">
          <span
            aria-hidden="true"
            className="grid w-[40px] place-items-center rounded-b-[14px] bg-primary/72 text-white shadow-[0_10px_22px_rgba(35,23,15,0.2)] backdrop-blur-[2px]"
          >
            <BestsellerBadgeIcon />
          </span>
          <span className="inline-flex max-w-[118px] items-center truncate px-3 font-sans text-[10px] font-extrabold uppercase leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
            {getTourBadgeLabel(tour)}
          </span>
        </div>

        <button
          type="button"
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-[#2b241f]/80 text-white shadow-[0_10px_24px_rgba(35,23,15,0.28)] backdrop-blur-[2px] transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/45"
          aria-label={`Save ${tour.tourName}`}
        >
          <Heart className="size-[18px]" strokeWidth={1.9} />
        </button>

        <span className="absolute bottom-4 left-4 inline-flex h-9 max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-[#2b241f]/80 px-4 font-sans text-[13px] font-medium leading-none text-white shadow-[0_10px_22px_rgba(35,23,15,0.24)] backdrop-blur-[2px]">
          <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-white text-[#2b241f]">
            <Clock3 className="size-3" strokeWidth={2.3} />
          </span>
          <span className="truncate">{duration}</span>
        </span>

        <span className="absolute bottom-4 right-4 hidden h-9 max-w-[50%] items-center rounded-full bg-[#2b241f]/80 px-4 font-sans text-[13px] font-medium leading-none text-white shadow-[0_10px_22px_rgba(35,23,15,0.24)] backdrop-blur-[2px] sm:inline-flex">
          <span className="truncate">{getTourDifficultyLabel(tour)}</span>
        </span>
      </div>

      <div className="px-4 pb-5 pt-4 sm:px-5">
        <h3 className="line-clamp-2 font-heading text-[24px] font-bold leading-[1.06] tracking-normal text-secondary sm:text-[25px]">
          {tour.tourName}
        </h3>

        <span className="mt-3 block h-px w-full bg-primary/65" />

        <div className="mt-2 grid gap-2 font-sans lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <p className="text-[12px] font-medium leading-none text-secondary/86">
              Upcoming Departure
            </p>
            <time className="mt-1.5 block truncate text-[16px] font-medium leading-none text-primary">
              {formatOrdinalDate(nextDeparture?.departureDate)}
            </time>
          </div>
          <Link
            href={getTourCalendarHref({ destination, tour })}
            className="inline-flex w-fit items-center gap-2 pt-0.5 text-[12px] font-medium leading-none text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 sm:text-[13px] lg:justify-self-end"
          >
            <span className="whitespace-nowrap">View all departures</span>
            <CalendarDays className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
          </Link>
        </div>

        <div className="mt-4 flex min-w-0 items-baseline justify-between gap-3 font-sans text-secondary">
          <span className="shrink-0 text-[12px] font-medium leading-none text-secondary/62 sm:text-[13px]">
            Tour Expert
          </span>
          <strong className="min-w-0 truncate text-right text-[14px] font-semibold leading-none text-secondary sm:text-[15px]">
            {expertName}
          </strong>
        </div>

        <div className="mt-2 border-y border-[#d6d1cb]">
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="font-sans text-[14px] font-medium leading-none text-secondary">
              Tour Includes
            </span>
            <div className="flex shrink-0 items-center gap-2.5 text-primary sm:gap-3">
              {tourIncludes.map(({ icon, label }) => (
                <TourIncludeIcon key={label} icon={icon} label={label} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-nowrap items-center justify-between gap-2.5">
          <span className="min-w-0 flex-1 font-sans">
            <span className="block text-[12px] font-medium leading-none text-secondary/72 sm:text-[13px]">
              Starting from
            </span>
            <strong
              className={cn(
                "mt-0 block truncate font-sans font-semibold leading-none text-primary",
                price > 0 ? "text-[22px] sm:text-[24px]" : "text-[20px]"
              )}
            >
              {price > 0 ? `${formatPrice(price)} +` : "On request"}
            </strong>
          </span>

          <Button
            nativeButton={false}
            render={<Link href={tourHref} />}
            className="h-[42px] min-w-[134px] shrink-0 gap-4 px-4 text-[16px] font-normal shadow-[0_12px_24px_rgba(212,114,32,0.22)] sm:min-w-[144px] sm:text-[16px]"
          >
            Book Now
            <ButtonArrow className="h-2.5 w-6 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function BestsellerBadgeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
    >
      <path
        d="m32 4.5 5.3 4 6.6-.9 2.8 6 6 2.8-.9 6.6 4 5.3-4 5.3.9 6.6-6 2.8-2.8 6-6.6-.9-5.3 4-5.3-4-6.6.9-2.8-6-6-2.8.9-6.6-4-5.3 4-5.3-.9-6.6 6-2.8 2.8-6 6.6.9 5.3-4Z"
      />
      <path d="m32 17.4 3.7 7.5 8.3 1.2-6 5.8 1.4 8.2-7.4-3.9-7.4 3.9 1.4-8.2-6-5.8 8.3-1.2L32 17.4Z" />
    </svg>
  );
}

function TourIncludeIcon({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      className="grid size-[18px] place-items-center text-primary"
    >
      <Icon className="size-4" strokeWidth={2.4} />
    </span>
  );
}
