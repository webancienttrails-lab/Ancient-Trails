"use client";

import Image from "next/image";
import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Expand,
  MapPin,
  Play,
  Quote,
  Share2,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import { createPortal } from "react-dom";

import { Header } from "@/components/layout/header";
import { TourShowcaseCard } from "@/components/tours/tour-showcase-card";
import { useToast } from "@/components/ui/toast";
import { listenForTravellerSessionChanges } from "@/lib/auth";
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
import {
  getTourCalendarHref,
  getTourHref,
  slugifyRoute,
} from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  getWishlistTourIds,
  listenForWishlistChanges,
  normalizeWishlistTourId,
  toggleWishlistTour,
  type WishlistTourSnapshot,
} from "@/lib/wishlist";

function getExperiencesHref(destination: PublicDestination) {
  return `/experiences/${encodeURIComponent(
    slugifyRoute(destination.destinationName) || destination.destinationId
  )}`;
}

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
const destinationToursSectionId = "destination-tours";
const visibleAttractionCount = 4;
const attractionSlideDurationMs = 900;

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

function getDestinationFact(destination: PublicDestination) {
  if (destination.fact?.trim()) {
    return destination.fact.trim();
  }

  return `${destination.destinationName} is best experienced slowly, where every carved wall, street corner and landscape view adds one more layer to the story.`;
}

function getDestinationStats(
  destination: PublicDestination,
  tours: PublicTour[]
) {
  return [
    {
      label: "Weather",
      value: destination.weather?.trim() || "Dry and sunny",
    },
    {
      label: "Elevation",
      value: destination.elevation?.trim() || "467 m",
    },
    {
      label: "Temperature",
      value: destination.temperature?.trim() || "Min 10 C / Max 32 C",
    },
    {
      label: "Season",
      value: destination.season?.trim() || getBestSeason(destination, tours),
    },
  ];
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

function getTourExpert(tour: PublicTour, experts: PublicExpert[]) {
  return experts.find(
    (expert) => normalizeCode(expert.expertId) === normalizeCode(tour.expertId)
  );
}

function createWishlistSnapshot({
  destination,
  durationLabel,
  fallbackImage,
  nextDeparture,
  price,
  tour,
}: {
  destination: PublicDestination;
  durationLabel: string;
  fallbackImage: string;
  nextDeparture?: PublicTourDeparture;
  price: number;
  tour: PublicTour;
}): WishlistTourSnapshot {
  return {
    categoryLabel: tour.category || tour.tourType || "Heritage",
    description:
      tour.description ||
      "An expert-led Ancient Trails journey through heritage, culture and local stories.",
    destinationLabel: destination.destinationName,
    difficultyLabel: tour.difficulty || "Moderate",
    durationLabel,
    href: getTourHref(tour),
    image: getTourImage(tour, fallbackImage),
    nextDepartureLabel: formatDate(nextDeparture?.departureDate || null),
    priceLabel: price > 0 ? `${formatPrice(price)} +` : "On request",
    title: tour.tourName,
    tourId: normalizeWishlistTourId(tour.tourId),
  };
}

export function SingleDestinationPage({
  destinationId,
}: {
  destinationId: string;
}) {
  const toast = useToast();
  const [destination, setDestination] = useState<PublicDestination | null>(null);
  const [relatedTours, setRelatedTours] = useState<PublicTour[]>([]);
  const [departures, setDepartures] = useState<PublicTourDeparture[]>([]);
  const [experts, setExperts] = useState<PublicExpert[]>([]);
  const [experiences, setExperiences] = useState<PublicExperience[]>([]);
  const [wishlistTourIds, setWishlistTourIds] = useState<string[]>([]);
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

  useEffect(() => {
    const syncWishlist = () => {
      setWishlistTourIds(getWishlistTourIds());
    };

    syncWishlist();

    const stopWishlistListener = listenForWishlistChanges(syncWishlist);
    const stopSessionListener =
      listenForTravellerSessionChanges(syncWishlist);

    return () => {
      stopWishlistListener();
      stopSessionListener();
    };
  }, []);

  const wishlistedTourIds = useMemo(
    () => new Set(wishlistTourIds),
    [wishlistTourIds]
  );

  function handleWishlistToggle({
    durationLabel,
    fallbackImage,
    nextDeparture,
    price,
    tour,
  }: {
    durationLabel: string;
    fallbackImage: string;
    nextDeparture?: PublicTourDeparture;
    price: number;
    tour: PublicTour;
  }) {
    if (!destination) {
      return;
    }

    const { isWishlisted, items } = toggleWishlistTour(
      createWishlistSnapshot({
        destination,
        durationLabel,
        fallbackImage,
        nextDeparture,
        price,
        tour,
      })
    );

    setWishlistTourIds(items.map((wishlistItem) => wishlistItem.tourId));

    if (isWishlisted) {
      toast.success("Added to wishlist", `${tour.tourName} is saved.`);
      return;
    }

    toast.info("Removed from wishlist", `${tour.tourName} was removed.`);
  }

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

      <div className="home-wide-frame mx-auto mt-8 w-[calc(100%-2.5rem)] pb-16">
        <DestinationOverview
          destination={destination}
          images={images}
          tours={relatedTours}
        />

        <ExploreAndPlan
          destination={destination}
          galleryImages={destinationGalleryImages}
          images={images}
          onGalleryOpen={(index) =>
            openLightbox(
              destinationGalleryImages,
              `${destination.destinationName} gallery`,
              index
            )
          }
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
          onWishlistToggle={handleWishlistToggle}
          tours={relatedTours}
          wishlistedTourIds={wishlistedTourIds}
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
      <section className="home-wide-frame mx-auto mt-8 w-[calc(100%-2.5rem)] pb-16">
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
      <div className="home-wide-frame relative z-10 mx-auto w-full px-5 sm:px-8 lg:px-0">
        <Header />
      </div>
    </section>
  );
}

function DestinationOverview({
  destination,
  images,
  tours,
}: {
  destination: PublicDestination;
  images: string[];
  tours: PublicTour[];
}) {
  const stats = getDestinationStats(destination, tours);

  function scrollToToursSection(event: MouseEvent<HTMLAnchorElement>) {
    const toursSection = document.getElementById(destinationToursSectionId);

    if (!toursSection) {
      return;
    }

    event.preventDefault();
    toursSection.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${destinationToursSectionId}`);
  }

  return (
    <section>
      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.42fr)_minmax(340px,0.72fr)]">
        <article className="relative min-h-[360px] overflow-hidden rounded-[22px] bg-secondary shadow-[0_14px_30px_rgba(34,25,18,0.15)] sm:min-h-[430px] lg:min-h-[450px] lg:rounded-[8px]">
          <Image
            src={images[0] || fallbackImages[0]}
            alt={destination.destinationName}
            fill
            priority
            sizes="(min-width: 1280px) 680px, (min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.18)_46%,rgba(20,13,8,0.82)_100%)]" />

          <div className="absolute left-7 top-7 max-w-[calc(100%-10rem)] text-white lg:left-5 lg:top-5 sm:left-7 sm:top-7">
            <h1 className="break-words font-heading text-[27px] font-bold italic leading-none tracking-normal drop-shadow-sm sm:text-[30px] lg:text-title">
              <span className="lg:hidden">{destination.destinationName}</span>
              <span className="hidden lg:inline">{destination.destinationName}</span>
            </h1>
            <p className="mt-2 font-sans text-[13px] font-medium text-white/88 sm:text-[14px] lg:flex lg:items-center lg:gap-2 lg:text-description">
              <MapPin className="hidden size-4 shrink-0 lg:block" />
              {getRegionLabel(destination)}
            </p>
          </div>

          {destination.unescoSite ? (
            <span
              aria-label="UNESCO Site"
              className="absolute right-5 top-5 inline-flex items-center gap-1.5 font-sans text-[11px] font-bold text-white sm:right-7 sm:top-7 sm:text-[12px] lg:gap-2 lg:text-[13px]"
            >
              <span>UNESCO Site</span>
              <span className="grid size-9 place-items-center rounded-full bg-primary lg:size-11">
                <Image
                  src="/unesco.svg"
                  alt=""
                  width={28}
                  height={28}
                  className="size-5 object-contain lg:size-7"
                />
              </span>
            </span>
          ) : null}

          <div className="absolute inset-x-7 bottom-7 flex flex-wrap items-end justify-between gap-3 lg:inset-x-5 lg:bottom-5 sm:inset-x-7 sm:bottom-7">
            <div className="grid gap-2">
              <p className="font-sans text-[13px] font-bold text-white sm:text-[14px]">
                Recommended Days: {getRecommendedDayNightLabel(destination)}
              </p>
              {/* <p className="font-sans text-[14px] font-bold text-white lg:hidden">
                Best Time To Visit - {getBestSeason(destination, tours)}
              </p> */}
            </div>
            <Link
              href={getTourCalendarHref({ destination })}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/80 bg-black/50 px-4 py-2 font-sans text-[13px] font-medium leading-none text-white backdrop-blur-sm sm:text-[14px]"
            >
              Customise my {destination.destinationName} Tour
              <ArrowRight className="size-3.5 sm:size-4" />
            </Link>
          </div>
        </article>

        <aside className="flex min-w-0 flex-col justify-center rounded-[8px] px-3 py-8 sm:px-2 lg:px-4 lg:py-4">
       
          <h2 className="mt-2 font-heading text-title italic font-bold leading-none tracking-normal text-secondary">
             Heritage
            <span className="ml-2 font-sans text-description font-medium text-secondary/65">
              at {getRegionLabel(destination)}
            </span>
          </h2>
          <p className="mt-2 max-w-[560px] font-sans text-description leading-relaxed text-secondary/72">
            {getHeritageIntro(destination)}
          </p>

          <div className="mt-4 border-l-4 border-primary pl-5">
            <Quote className="mb-1 size-6 text-primary" strokeWidth={1.8} />
            <p className="font-heading text-[16px] font-normal italic leading-snug tracking-normal text-secondary sm:text-[20px]">
              {getDestinationFact(destination)}
            </p>
          </div>

          <Link
            href={`#${destinationToursSectionId}`}
            onClick={scrollToToursSection}
            className="mt-4 inline-flex w-fit items-center gap-2 font-sans text-description font-normal uppercase text-primary transition-colors hover:text-secondary"
          >
            Scroll to view tours in {destination.destinationName}
            <ArrowDown className="size-4" />
          </Link>
        </aside>
      </div>

      <div className="mt-6 sm:mt-12 grid gap-0  bg-[#fff0e1] px-3 py-3 sm:grid-cols-1 lg:grid-cols-4 lg:gap-3 lg:rounded-[8px] lg:px-5 lg:py-5">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              "min-w-0 px-0 py-3 text-left lg:px-2 lg:py-0 lg:text-center",
              index === 0 && "pt-0 lg:pt-0",
              index === stats.length - 1 && "pb-0 lg:pb-0",
              index > 0 && "border-t border-[#e2cdbb] lg:border-l lg:border-t-0 lg:border-[#efcdb5]"
            )}
          >
            <p className="font-sans text-[15px] font-semibold uppercase leading-none text-secondary/50 lg:text-[11px]">
              {stat.label}
            </p>
            <p className="mt-1 break-words font-sans text-[14px] font-normal leading-tight text-secondary lg:truncate lg:text-[15px]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </section>
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
  galleryImages,
  images,
  onGalleryOpen,
}: {
  destination: PublicDestination;
  galleryImages: string[];
  images: string[];
  onGalleryOpen: (index: number) => void;
}) {
  const landmarks = getFeaturedLandmarkRows(destination, images);
  const attractionSummary = getAttractionSummary(destination);
  const destinationGallery = Array.from({ length: 7 }, (_item, index) =>
    galleryImages[index] ||
    images[index + 1] ||
    images[index] ||
    fallbackImages[index % fallbackImages.length]
  );
  const masonryTileClassNames = [
    "mb-3 h-[235px] break-inside-avoid lg:mb-0 lg:h-auto lg:col-span-2 lg:row-span-4",
    "mb-3 h-[110px] break-inside-avoid lg:mb-0 lg:h-auto lg:col-span-1 lg:row-span-2",
    "mb-3 h-[110px] break-inside-avoid lg:mb-0 lg:h-auto lg:col-span-2 lg:row-span-1",
    "mb-3 h-[235px] break-inside-avoid lg:mb-0 lg:h-auto lg:col-span-1 lg:row-span-2",
    "mb-3 h-[110px] break-inside-avoid lg:mb-0 lg:h-auto lg:col-span-1 lg:row-span-2",
    "mb-3 h-[235px] break-inside-avoid lg:mb-0 lg:h-auto lg:col-span-1 lg:row-span-2",
    "mb-0 h-[110px] break-inside-avoid lg:h-auto lg:col-span-2 lg:row-span-1",
  ];
  const experienceCtaBackgroundImage =
    galleryImages[0] ||
    galleryImages[1] ||
    images[1] ||
    images[2] ||
    fallbackImages[0];
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
  const canSlideAttractions = attractionItems.length > 1;

  function queueAttractionSlide(nextIndex: number) {
    if (!canSlideAttractions || nextAttractionSlideIndex !== null) {
      return;
    }

    setNextAttractionSlideIndex(nextIndex);
  }

  function showPreviousAttraction() {
    const previousIndex =
      attractionSlideIndex === 0
        ? attractionItems.length - 1
        : attractionSlideIndex - 1;

    queueAttractionSlide(previousIndex);
  }

  function showNextAttraction() {
    queueAttractionSlide(nextSlideIndex);
  }

  useEffect(() => {
    if (!canSlideAttractions || nextAttractionSlideIndex !== null) {
      return;
    }

    const interval = window.setInterval(() => {
      setNextAttractionSlideIndex(nextSlideIndex);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [canSlideAttractions, nextAttractionSlideIndex, nextSlideIndex]);

  useEffect(() => {
    if (nextAttractionSlideIndex === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAttractionSlideIndex(nextAttractionSlideIndex);
      setNextAttractionSlideIndex(null);
    }, attractionSlideDurationMs);

    return () => window.clearTimeout(timeout);
  }, [nextAttractionSlideIndex]);

  return (
    <section className="mt-5 py-4 lg:mt-10 lg:py-8">
      <div className="min-w-0">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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

          {canSlideAttractions ? (
            <div className="flex shrink-0 items-center gap-2 lg:pt-8">
              <button
                type="button"
                aria-label="Previous attraction"
                onClick={showPreviousAttraction}
                className="grid size-10 place-items-center rounded-full border border-[#efcdb5] bg-white text-primary shadow-[0_10px_20px_rgba(67,43,27,0.08)] transition-colors hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
              >
                <ChevronLeft className="size-5" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                aria-label="Next attraction"
                onClick={showNextAttraction}
                className="grid size-10 place-items-center rounded-full border border-[#efcdb5] bg-white text-primary shadow-[0_10px_20px_rgba(67,43,27,0.08)] transition-colors hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
              >
                <ChevronRight className="size-5" strokeWidth={2.2} />
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-7 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[980px] overflow-hidden lg:min-w-0">
            <div
              className={cn(
                "flex gap-6",
                isAttractionSliding &&
                  "transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              )}
              style={{
                transform: isAttractionSliding
                  ? `translateX(calc((100% + 1.5rem) / -${visibleAttractionCount}))`
                  : "translateX(0)",
              }}
            >
              {attractionTrack.map((landmark, index) => (
                <div
                  key={`${landmark.label}-${attractionSlideIndex}-${index}`}
                  className="shrink-0"
                  style={{
                    width: `calc((100% - ${
                      visibleAttractionCount - 1
                    } * 1.5rem) / ${visibleAttractionCount})`,
                  }}
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

      <section
        className="relative mt-10 ml-[calc(50%-50vw)] w-screen overflow-hidden bg-secondary bg-cover bg-center bg-no-repeat px-6 py-10 bg-fixed sm:px-8 lg:px-10"
        style={{
          backgroundImage: `url("${experienceCtaBackgroundImage}")`,
        }}
      >
        <div className="absolute inset-0 bg-black/75" />
        <div className="home-wide-frame relative z-10 mx-auto flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              Live the legacy
            </p>
            <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-white">
              Experiences in {destination.destinationName}
            </h2>
          </div>
          <Link
            href={getExperiencesHref(destination)}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 font-sans text-[14px] font-normal  leading-none text-white  transition-colors hover:bg-secondary"
          >
            Explore Experiences
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <div className="mt-12 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              In pictures
            </p>
            <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Photo Gallery
            </h2>
          </div>
          <p className="max-w-[360px] font-sans text-description italic text-secondary/70">
            Glimpses of {destination.destinationName}&apos;s timeless beauty.
          </p>
        </div>

        <div className="mt-6 columns-2 gap-3 lg:grid lg:auto-rows-[116px] lg:grid-flow-dense lg:grid-cols-5">
          {destinationGallery.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => onGalleryOpen(index)}
              className={cn(
                "group relative block w-full overflow-hidden rounded-[8px] bg-muted text-left shadow-[0_12px_24px_rgba(67,43,27,0.09)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                masonryTileClassNames[index]
              )}
            >
              <Image
                src={image || fallbackImages[index] || fallbackImages[0]}
                alt={`${destination.destinationName} gallery ${index + 1}`}
                fill
                sizes="(min-width: 1280px) 310px, (min-width: 1024px) 24vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.045]"
              />
              {index === destinationGallery.length - 1 ? (
                <span className="absolute inset-0 grid place-items-center bg-black/78 font-sans text-description font-bold text-white">
                  View all Photos
                </span>
              ) : null}
            </button>
          ))}
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

  return Array.from({ length: visibleAttractionCount + 1 }, (_item, index) => {
    const attractionIndex = (startIndex + index) % attractions.length;

    return attractions[attractionIndex];
  });
}

function AttractionCard({ image, label }: { image: string; label: string }) {
  return (
    <article className="min-w-0">
      <div className="relative h-[220px] overflow-hidden rounded-[8px] bg-muted shadow-[0_10px_20px_rgba(67,43,27,0.08)] lg:h-[238px] xl:h-[258px]">
        <Image
          src={image || fallbackImages[0]}
          alt={label}
          fill
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 23vw, 230px"
          className="object-cover transition-transform duration-700 hover:scale-105"
        />
      </div>
      <h3 className="mt-5 truncate font-sans text-description font-medium leading-none text-secondary/90">
        {label}
      </h3>
    </article>
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
  const videoExperience =
    experiences.find((experience) => getExperienceVideo(experience)) ||
    featuredExperience;
  const displayFallbackImages = getDisplayFallbackImages(images);
  const featuredFallbackImage = getDisplayFallbackImage(images, 3);
  const featuredImage = getExperienceImage(videoExperience, featuredFallbackImage);
  const featuredVideo = getExperienceVideo(videoExperience);

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
        <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-secondary/70">
          What Travellers say on -
        </p>
        <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
          Exploring {destination.destinationName} with Us
        </h2>
        <Link
          href={getExperiencesHref(destination)}
          className="mt-4 inline-flex items-center gap-2 font-sans text-description font-medium uppercase text-primary transition-colors hover:text-secondary"
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
            alt={videoExperience?.title || destination.destinationName}
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

          <DestinationReviewSlider
            experiences={experiences}
            getReviewCount={getTravellerReviewCount}
            onPhotoOpen={onExperienceGalleryOpen}
          />
        </div>

        <div className="pt-0">
          <p className="font-sans text-description font-medium text-secondary/70">
            Ready to plan your Journey?
            <span className="block">Let&apos;s get started!</span>
          </p>
          <Link
            href={getTourCalendarHref({ destination })}
            className="group/button mt-3 inline-flex h-11 items-center justify-center gap-4 rounded-[24px] border border-primary bg-primary px-6 font-sans text-button font-medium leading-none text-white transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white hover:text-primary"
          >
            Plan Your Trip
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
    <article className="  bg-white px-4 py-4">
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

function DestinationReviewSlider({
  experiences,
  getReviewCount,
  onPhotoOpen,
}: {
  experiences: PublicExperience[];
  getReviewCount: (experience: PublicExperience) => number;
  onPhotoOpen: (
    galleryImages: string[],
    title: string,
    activeIndex?: number
  ) => void;
}) {
  const reviewExperiences = experiences.slice(0, 4);
  const [activeIndex, setActiveIndex] = useState(0);
  const boundedIndex = reviewExperiences[activeIndex] ? activeIndex : 0;

  if (reviewExperiences.length === 0) {
    return null;
  }

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
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${boundedIndex * 100}%)` }}
        >
          {reviewExperiences.map((experience) => (
            <div
              key={experience.id || experience.experienceId}
              className="w-full shrink-0 pr-1"
            >
              <ReviewCard
                experience={experience}
                reviewCount={getReviewCount(experience)}
                onPhotoOpen={onPhotoOpen}
              />
            </div>
          ))}
        </div>
      </div>

      {reviewExperiences.length > 1 ? (
        <div className="mt-1 flex items-center justify-between gap-4">
          <button
            type="button"
            aria-label="Previous traveller review"
            onClick={showPreviousReview}
            className="grid size-9 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="size-4" strokeWidth={2.3} />
          </button>

          <div className="flex items-center justify-center gap-2">
            {reviewExperiences.map((experience, index) => (
              <button
                key={`${experience.id || experience.experienceId}-dot`}
                type="button"
                aria-label={`Show traveller review ${index + 1}`}
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
            className="grid size-9 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronRight className="size-4" strokeWidth={2.3} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToursSection({
  departures,
  destination,
  experts,
  images,
  onWishlistToggle,
  tours,
  wishlistedTourIds,
}: {
  departures: PublicTourDeparture[];
  destination: PublicDestination;
  experts: PublicExpert[];
  images: string[];
  onWishlistToggle: (item: {
    durationLabel: string;
    fallbackImage: string;
    nextDeparture?: PublicTourDeparture;
    price: number;
    tour: PublicTour;
  }) => void;
  tours: PublicTour[];
  wishlistedTourIds: Set<string>;
}) {
  if (tours.length === 0) {
    return null;
  }

  return (
    <section id={destinationToursSectionId} className="mt-10 scroll-mt-28">
      <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
        Plan your visit
      </p>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
          Tours in {destination.destinationName.toLowerCase()}
        </h2>
        <Link
          href={getTourCalendarHref({ destination })}
          className="inline-flex w-fit items-center gap-2 font-sans text-description font-medium uppercase text-primary"
        >
          View all tours
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-5 grid justify-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,320px))]">
        {tours.slice(0, 3).map((tour, index) => {
          const fallbackImage = images[index % images.length] || fallbackImages[0];
          const nextDeparture = getNextTourDeparture(tour, departures);
          const price = getLowestTourPrice(tour, departures);
          const durationLabel = compactDurationLabel(
            tour.durationDn,
            destination.recommendedDurationDays || 1
          );

          return (
            <DestinationTourCard
              key={tour.id || tour.tourId}
              destination={destination}
              durationLabel={durationLabel}
              expert={getTourExpert(tour, experts)}
              expertName={getTourExpertName(tour, experts)}
              fallbackImage={fallbackImage}
              isWishlisted={wishlistedTourIds.has(
                normalizeWishlistTourId(tour.tourId)
              )}
              nextDeparture={nextDeparture}
              onWishlistToggle={onWishlistToggle}
              price={price}
              tour={tour}
            />
          );
        })}
      </div>
    </section>
  );
}

function DestinationTourCard({
  destination,
  durationLabel,
  expert,
  expertName,
  fallbackImage,
  isWishlisted,
  nextDeparture,
  onWishlistToggle,
  price,
  tour,
}: {
  destination: PublicDestination;
  durationLabel: string;
  expert?: PublicExpert;
  expertName: string;
  fallbackImage: string;
  isWishlisted: boolean;
  nextDeparture?: PublicTourDeparture;
  onWishlistToggle: (item: {
    durationLabel: string;
    fallbackImage: string;
    nextDeparture?: PublicTourDeparture;
    price: number;
    tour: PublicTour;
  }) => void;
  price: number;
  tour: PublicTour;
}) {
  return (
    <TourShowcaseCard
      allDeparturesHref={getTourCalendarHref({ destination, tour })}
      badgeLabel="BESTSELLER"
      difficultyLabel={getTourDifficultyLabel(tour)}
      durationLabel={durationLabel}
      expertImage={getHomeMediaUrl(expert?.image || "")}
      expertName={expertName}
      expertSpecialties={expert?.expertiseTags || []}
      expertSpecialty={
        expert?.expertiseTags[0] ||
        tour.category ||
        tour.tourType ||
        "Heritage Tours"
      }
      favoriteLabel={
        isWishlisted
          ? `Remove ${tour.tourName} from wishlist`
          : `Save ${tour.tourName}`
      }
      href={getTourHref(tour)}
      image={getTourImage(tour, fallbackImage)}
      imageSizes="(min-width: 1280px) 320px, (min-width: 640px) 50vw, 100vw"
      isFavorite={isWishlisted}
      nextDepartureLabel={formatDate(nextDeparture?.departureDate || null)}
      onFavoriteToggle={() =>
        onWishlistToggle({
          durationLabel,
          fallbackImage,
          nextDeparture,
          price,
          tour,
        })
      }
      priceLabel={price > 0 ? `${formatPrice(price)} +` : "On request"}
      showBadge={tour.isBestseller}
      title={tour.tourName}
      className="w-full max-w-[320px]"
    />
  );
}
