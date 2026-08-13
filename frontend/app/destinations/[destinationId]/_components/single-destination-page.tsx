"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Heart,
  ImageIcon,
  Landmark,
  MapPin,
  Play,
  Route,
  TrainFront,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicTourDepartures,
  listPublicTours,
  type PublicDestination,
  type PublicTour,
  type PublicTourDeparture,
} from "@/lib/home-travel";
import { cn } from "@/lib/utils";

type DetailFact = {
  icon: LucideIcon;
  label: string;
  value: string;
};

const fallbackImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
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
  return destination.primaryHeritageFocus || "Heritage Destination";
}

function getLocationLabel(destination: PublicDestination) {
  return uniqueValues([
    destination.city,
    destination.state,
    destination.countryRegion,
  ]).join(", ");
}

function getDestinationImages(
  destination: PublicDestination,
  tours: PublicTour[] = []
) {
  const images = uniqueValues([
    destination.bannerImage,
    ...destination.galleryImages,
    ...tours.flatMap((tour) => [tour.bannerImage, ...tour.galleryImages]),
  ]).map(getHomeMediaUrl);

  return images.length > 0 ? images : fallbackImages;
}

function getBestSeason(tours: PublicTour[]) {
  return tours.find((tour) => tour.bestSeason.trim())?.bestSeason || "";
}

function getTourTypeLabel(destination: PublicDestination, tours: PublicTour[]) {
  return (
    tours.find((tour) => tour.tourType.trim())?.tourType ||
    tours.find((tour) => tour.category.trim())?.category ||
    destination.destinationType
  );
}

function getActivityLabel(tours: PublicTour[]) {
  return tours.find((tour) => tour.difficulty.trim())?.difficulty || "Moderate";
}

function getAccessHubLabel(destination: PublicDestination) {
  return (
    destination.city ||
    destination.state ||
    destination.countryRegion ||
    "Details shared before travel"
  );
}

function formatDuration(destination: PublicDestination) {
  const days = destination.recommendedDurationDays || 1;

  return `${days} ${days === 1 ? "Day" : "Days"}`;
}

function formatPrice(value: number) {
  return currencyFormatter.format(value || 0);
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

function getLandmarkDescription(landmark: string, destination: PublicDestination) {
  const focus = getPrimaryFocus(destination).toLowerCase();

  return `${landmark} anchors the ${focus} story of ${destination.destinationName}.`;
}

function isTourLinkedToDestination(
  tour: PublicTour,
  destination: PublicDestination
) {
  return getTourDestinationIds(tour).includes(destination.destinationId);
}

function getRelatedDepartures(
  tours: PublicTour[],
  departures: PublicTourDeparture[]
) {
  const tourIds = new Set(tours.map((tour) => tour.tourId));

  return departures.filter((departure) => tourIds.has(departure.tourId));
}

function getTourImage(tour: PublicTour, fallbackImage: string) {
  return getHomeMediaUrl(tour.bannerImage || tour.galleryImages[0] || fallbackImage);
}

function createFacts(
  destination: PublicDestination,
  tours: PublicTour[]
): DetailFact[] {
  const bestSeason = getBestSeason(tours);

  return [
    {
      icon: Clock3,
      label: "Ideal Duration",
      value: formatDuration(destination),
    },
    {
      icon: CalendarDays,
      label: "Best Time to Visit",
      value: bestSeason || "To be announced",
    },
    {
      icon: Landmark,
      label: "UNESCO Status",
      value: destination.unescoSite ? "Yes" : "No",
    },
  ];
}

function createRequirementFacts(destination: PublicDestination, tours: PublicTour[]) {
  const bestSeason = getBestSeason(tours);

  return [
    {
      icon: CalendarDays,
      label: "Best Time to Visit",
      value: bestSeason || "To be announced",
    },
    {
      icon: Route,
      label: "Tour Type",
      value: getTourTypeLabel(destination, tours),
    },
    {
      icon: BarChart3,
      label: "Activity Level",
      value: getActivityLabel(tours),
    },
    {
      icon: TrainFront,
      label: "Nearest Railway Station",
      value: getAccessHubLabel(destination),
    },
  ];
}

export function SingleDestinationPage({
  destinationId,
}: {
  destinationId: string;
}) {
  const [destination, setDestination] = useState<PublicDestination | null>(null);
  const [relatedTours, setRelatedTours] = useState<PublicTour[]>([]);
  const [departures, setDepartures] = useState<PublicTourDeparture[]>([]);
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
            setLoadError("Destination not found.");
          }

          return;
        }

        const [toursResponse, departuresResponse] = await Promise.all([
          listPublicTours(matchedDestination.destinationId),
          listPublicTourDepartures(),
        ]);
        const tours = toursResponse.data.tours.filter((tour) =>
          isTourLinkedToDestination(tour, matchedDestination)
        );

        if (isMounted) {
          setDestination(matchedDestination);
          setRelatedTours(tours);
          setDepartures(getRelatedDepartures(tours, departuresResponse.data.departures));
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
    () => (destination ? getDestinationImages(destination, relatedTours) : fallbackImages),
    [destination, relatedTours]
  );
  const facts = useMemo(
    () => (destination ? createFacts(destination, relatedTours) : []),
    [destination, relatedTours]
  );
  const requirementFacts = useMemo(
    () => (destination ? createRequirementFacts(destination, relatedTours) : []),
    [destination, relatedTours]
  );

  if (isLoading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background text-secondary">
        <LoadingHero />
      </main>
    );
  }

  if (!destination || loadError) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background text-secondary">
        <section className="relative min-h-[520px] px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-8">
          <Header />
          <div className="mx-auto mt-16 max-w-[720px] rounded-[8px] border border-border bg-card p-8 text-center shadow-[0_18px_44px_rgba(67,43,27,0.08)]">
            <h1 className="font-heading text-[34px] font-bold text-secondary">
              Destination not found
            </h1>
            <p className="mx-auto mt-3 max-w-[460px] font-sans text-[13px] leading-[1.7] text-secondary/62">
              {loadError ||
                "This destination is not available in the current destination records."}
            </p>
            <Link
              href="/destinations"
              className="mt-6 inline-flex h-10 items-center gap-3 rounded-[7px] bg-primary px-5 font-sans text-[12px] font-bold text-white transition-colors hover:bg-accent"
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
      <DestinationHero
        destination={destination}
        facts={facts}
        heroImage={images[0]}
      />
      <GalleryStrip
        destinationName={destination.destinationName}
        images={images}
      />
      <OverviewSection destination={destination} images={images} />
      <LandmarksSection destination={destination} />
      <ExperiencesSection
        destination={destination}
        images={images}
        tours={relatedTours}
      />
      <ToursSection
        departures={departures}
        destination={destination}
        images={images}
        tours={relatedTours}
      />
      <PracticalInfoSection facts={requirementFacts} />
    </main>
  );
}

function LoadingHero() {
  return (
    <section className="relative min-h-[640px] bg-muted px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-8">
      <Header />
      <div className="mx-auto mt-14 grid w-full max-w-[1300px] gap-6 md:grid-cols-[0.8fr_1fr]">
        <div className="space-y-5">
          <div className="h-8 w-44 animate-pulse rounded-full bg-border" />
          <div className="h-20 w-80 max-w-full animate-pulse rounded bg-border" />
          <div className="h-4 w-full max-w-[420px] animate-pulse rounded bg-border" />
          <div className="h-4 w-72 animate-pulse rounded bg-border" />
        </div>
        <div className="h-[360px] animate-pulse rounded-[10px] bg-border" />
      </div>
    </section>
  );
}

function DestinationHero({
  destination,
  facts,
  heroImage,
}: {
  destination: PublicDestination;
  facts: DetailFact[];
  heroImage: string;
}) {
  return (
    <section className="relative min-h-[650px] overflow-hidden bg-secondary">
      <Image
        src={heroImage}
        alt={destination.destinationName}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,13,10,0.82)_0%,rgba(17,13,10,0.58)_42%,rgba(17,13,10,0.16)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,var(--background)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[650px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-8 lg:px-0">
        <Header />

        <div className="mt-5 flex flex-wrap items-center gap-3 font-sans text-[12px] font-semibold text-white/78">
          <Link href="/" className="transition-colors hover:text-primary">
            Home
          </Link>
          <span aria-hidden="true">&gt;</span>
          <Link href="/destinations" className="transition-colors hover:text-primary">
            Destinations
          </Link>
          {destination.state ? (
            <>
              <span aria-hidden="true">&gt;</span>
              <span>{destination.state}</span>
            </>
          ) : null}
          <span aria-hidden="true">&gt;</span>
          <span className="text-white">{destination.destinationName}</span>
        </div>

        <div className="mt-10 flex flex-1 items-start justify-between gap-8">
          <div className="max-w-[570px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/45 px-4 py-2 font-sans text-[12px] font-bold text-primary ring-1 ring-white/16 backdrop-blur">
              <Landmark className="size-4" strokeWidth={1.8} />
              {getPrimaryFocus(destination)}
            </div>

            <h1 className="mt-6 font-heading text-[60px] font-bold leading-[0.95] tracking-normal text-white sm:text-[82px] lg:text-[96px]">
              {destination.destinationName}
            </h1>

            <p className="mt-5 flex items-center gap-3 font-sans text-[17px] font-bold text-white">
              <MapPin className="size-6 shrink-0 text-primary" strokeWidth={2.1} />
              {getLocationLabel(destination) || destination.countryRegion}
            </p>

            <p className="mt-6 max-w-[470px] font-sans text-[15px] font-medium leading-[1.8] text-white/88">
              {destination.shortDescription ||
                `${destination.destinationName} is a ${destination.destinationType.toLowerCase()} destination focused on ${getPrimaryFocus(destination).toLowerCase()}.`}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {facts.map((fact, index) => (
                <HeroFact key={fact.label} fact={fact} showDivider={index > 0} />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="hidden h-12 items-center gap-3 rounded-full border border-white/25 bg-white/12 px-5 font-sans text-[13px] font-bold text-white backdrop-blur transition-colors hover:border-primary hover:bg-primary md:inline-flex"
          >
            <Heart className="size-5" strokeWidth={1.8} />
            Add to Favourites
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroFact({
  fact,
  showDivider,
}: {
  fact: DetailFact;
  showDivider: boolean;
}) {
  const Icon = fact.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        showDivider && "sm:border-l sm:border-white/35 sm:pl-5"
      )}
    >
      <Icon className="size-9 shrink-0 text-primary" strokeWidth={1.55} />
      <span className="font-sans">
        <span className="block text-[11px] font-bold text-white/80">
          {fact.label}
        </span>
        <strong className="mt-1 block text-[15px] text-white">
          {fact.value}
        </strong>
      </span>
    </div>
  );
}

function GalleryStrip({
  destinationName,
  images,
}: {
  destinationName: string;
  images: string[];
}) {
  const galleryImages = images.slice(0, 5);

  return (
    <section
      id="destination-gallery"
      className="relative z-20 mx-auto -mt-14 w-full max-w-[1300px] px-5 sm:px-8 lg:px-0"
    >
      <div className="grid gap-3 rounded-[12px] border border-border bg-card p-4 shadow-[0_20px_54px_rgba(67,43,27,0.14)] md:grid-cols-[repeat(5,minmax(0,1fr))_110px]">
        {galleryImages.map((image, index) => (
          <article
            key={`${image}-${index}`}
            className="relative h-[150px] overflow-hidden rounded-[8px] bg-muted"
          >
            <Image
              src={image}
              alt={`${destinationName} gallery ${index + 1}`}
              fill
              sizes="(min-width: 1024px) 210px, 50vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </article>
        ))}
        <a
          href="#destination-gallery"
          className="grid min-h-[130px] place-items-center rounded-[8px] border border-border bg-background px-3 text-center font-sans text-[12px] font-bold text-secondary transition-colors hover:border-primary hover:bg-muted hover:text-primary md:min-h-0"
        >
          <span className="grid justify-items-center gap-2">
            <ImageIcon className="size-8 text-primary" strokeWidth={1.6} />
            View All Photos
            <span className="grid size-8 place-items-center rounded-full bg-accent text-white">
              <ArrowRight className="size-4" />
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}

function OverviewSection({
  destination,
  images,
}: {
  destination: PublicDestination;
  images: string[];
}) {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 pb-6 pt-6 sm:px-8 lg:px-0">
      <article className="grid overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_12px_34px_rgba(67,43,27,0.06)] md:grid-cols-[420px_minmax(0,1fr)]">
        <div className="relative hidden min-h-[210px] overflow-hidden bg-muted md:block">
          <Image
            src={images[1] || images[0]}
            alt=""
            fill
            sizes="420px"
            className="object-cover opacity-20 grayscale"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(255,255,255,0.65))]" />
        </div>
        <div className="p-6 md:p-8">
          <SectionTitle title={`About ${destination.destinationName}`} />
          <p className="mt-5 max-w-[760px] font-sans text-[14px] font-medium leading-[1.8] text-secondary/82">
            {destination.shortDescription ||
              `${destination.destinationName} brings together ${getPrimaryFocus(destination).toLowerCase()} and local heritage.`}
          </p>
          <a
            href="#key-landmarks"
            className="mt-5 inline-flex items-center gap-3 font-sans text-[13px] font-bold text-primary transition-colors hover:text-accent"
          >
            Explore More
            <ArrowRight className="size-4" />
          </a>
        </div>
      </article>
    </section>
  );
}

function LandmarksSection({ destination }: { destination: PublicDestination }) {
  const landmarks =
    destination.keyLandmarks.length > 0
      ? destination.keyLandmarks
      : uniqueValues([
          destination.city,
          destination.state,
          destination.primaryHeritageFocus,
          destination.unescoSite ? "UNESCO Heritage" : "",
        ]);

  if (landmarks.length === 0) {
    return null;
  }

  return (
    <section
      id="key-landmarks"
      className="mx-auto w-full max-w-[1300px] px-5 py-6 sm:px-8 lg:px-0"
    >
      <SectionTitle title="Key Landmarks" />
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {landmarks.slice(0, 8).map((landmark, index) => (
          <article
            key={`${landmark}-${index}`}
            className={cn(
              "px-5 text-center",
              index > 0 && "lg:border-l lg:border-border"
            )}
          >
            <span className="mx-auto grid size-16 place-items-center rounded-full border border-border bg-card text-primary shadow-[0_10px_22px_rgba(67,43,27,0.05)]">
              <Landmark className="size-8" strokeWidth={1.45} />
            </span>
            <h3 className="mt-4 font-heading text-[18px] font-bold leading-tight text-secondary">
              {landmark}
            </h3>
            <p className="mx-auto mt-2 max-w-[210px] font-sans text-[12px] leading-[1.65] text-secondary/70">
              {getLandmarkDescription(landmark, destination)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExperiencesSection({
  destination,
  images,
  tours,
}: {
  destination: PublicDestination;
  images: string[];
  tours: PublicTour[];
}) {
  const featuredTour = tours[0];
  const video = featuredTour?.video ? getHomeMediaUrl(featuredTour.video) : "";
  const experienceCards = [
    {
      badge: video ? "Video" : "Photo Story",
      description:
        featuredTour?.description ||
        destination.shortDescription ||
        `Experience ${destination.destinationName} through ${getPrimaryFocus(destination).toLowerCase()}.`,
      image: images[1] || images[0],
      title: featuredTour?.tourName || `Sunrise at ${destination.destinationName}`,
      video,
    },
    {
      badge: "Photo Story",
      description: `From ${getPrimaryFocus(destination).toLowerCase()} to local legends, ${destination.destinationName} keeps every trail rich with context.`,
      image: images[2] || images[0],
      title: `A Walk Through ${destination.destinationName}`,
      video: "",
    },
    {
      badge: "Photo Story",
      description: `${getLocationLabel(destination) || destination.countryRegion} offers peaceful moments, layered views and timeless beauty.`,
      image: images[3] || images[0],
      title: destination.city
        ? `${destination.city} Afternoons`
        : `Moments in ${destination.destinationName}`,
      video: "",
    },
    {
      badge: "Voices",
      description: `Hear the stories, rituals and memories that keep ${destination.destinationName} alive across generations.`,
      image: images[4] || images[0],
      title: `Local Voices of ${destination.destinationName}`,
      video: "",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 py-8 sm:px-8 lg:px-0">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle title={`Experiences in ${destination.destinationName}`} />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="grid size-9 place-items-center rounded-full border border-border bg-card text-primary">
            <ArrowRight className="size-4 rotate-180" />
          </span>
          <span className="grid size-9 place-items-center rounded-full border border-border bg-card text-primary">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {experienceCards.map((card, index) => (
          <article
            key={`${card.title}-${index}`}
            className="overflow-hidden rounded-[8px] border border-border bg-card shadow-[0_12px_30px_rgba(67,43,27,0.06)]"
          >
            <div className="group relative h-[220px] overflow-hidden bg-muted">
              {card.video ? (
                <video
                  src={card.video}
                  className="absolute inset-0 size-full object-cover"
                  muted
                  playsInline
                  controls
                />
              ) : (
                <Image
                  src={card.image}
                  alt={`${card.title} in ${destination.destinationName}`}
                  fill
                  sizes="(min-width: 1024px) 305px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 font-sans text-[11px] font-bold text-accent shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                {card.badge}
              </span>
              {index === 0 && !card.video ? (
                <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-white/20 text-white backdrop-blur">
                  <Play className="ml-1 size-7 fill-current" strokeWidth={0} />
                </span>
              ) : null}
            </div>
            <div className="p-5">
              <h3 className="font-heading text-[20px] font-bold leading-tight text-secondary">
                {card.title}
              </h3>
              <p className="mt-2 line-clamp-3 font-sans text-[12px] font-medium leading-[1.65] text-secondary/72">
                {card.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ToursSection({
  departures,
  destination,
  images,
  tours,
}: {
  departures: PublicTourDeparture[];
  destination: PublicDestination;
  images: string[];
  tours: PublicTour[];
}) {
  if (tours.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 py-8 sm:px-8 lg:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle title={`Tours in ${destination.destinationName}`} />
        <Link
          href={`/tour-calendar?destination=${encodeURIComponent(destination.destinationId)}`}
          className="inline-flex w-fit items-center gap-3 font-sans text-[13px] font-bold text-primary transition-colors hover:text-accent"
        >
          View All Tours
          <ArrowRight className="size-5" />
        </Link>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tours.slice(0, 8).map((tour, index) => (
          <TourCard
            key={tour.id || tour.tourId}
            fallbackImage={images[index % images.length] || fallbackImages[0]}
            price={getLowestTourPrice(tour, departures)}
            tour={tour}
          />
        ))}
      </div>
    </section>
  );
}

function TourCard({
  fallbackImage,
  price,
  tour,
}: {
  fallbackImage: string;
  price: number;
  tour: PublicTour;
}) {
  return (
    <article className="group overflow-hidden rounded-[8px] border border-border bg-card shadow-[0_12px_30px_rgba(67,43,27,0.07)] transition-all hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_20px_46px_rgba(67,43,27,0.12)]">
      <div className="relative h-[150px] overflow-hidden bg-muted">
        <Image
          src={getTourImage(tour, fallbackImage)}
          alt={tour.tourName}
          fill
          sizes="(min-width: 1024px) 305px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <button
          type="button"
          aria-label={`Save ${tour.tourName}`}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/65 bg-white/20 text-white backdrop-blur transition-colors hover:bg-primary"
        >
          <Heart className="size-4" strokeWidth={1.8} />
        </button>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[42px] font-heading text-[18px] font-bold leading-tight text-secondary">
          {tour.tourName}
        </h3>
        <div className="mt-3 grid gap-2 font-sans text-[11px] font-semibold text-secondary/62">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-3.5 text-primary" />
            {tour.durationDn || "Duration announced soon"}
          </span>
          <span className="flex items-center gap-2">
            <Landmark className="size-3.5 text-primary" />
            {tour.category || getPrimaryFocusFromTour(tour)}
          </span>
        </div>
        <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
          <span className="font-sans text-[11px] font-semibold text-secondary/62">
            {price > 0 ? (
              <>
                From
                <strong className="mt-1 block text-[18px] leading-none text-primary">
                  {formatPrice(price)}
                </strong>
                <span className="text-[10px]">/ person</span>
              </>
            ) : (
              <strong className="text-[14px] text-primary">Price on request</strong>
            )}
          </span>
          <Link
            href={`/tours/${encodeURIComponent(tour.tourId)}`}
            aria-label={`View ${tour.tourName}`}
            className="grid size-9 place-items-center rounded-full border border-primary bg-white text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function getPrimaryFocusFromTour(tour: PublicTour) {
  return tour.tourType || tour.difficulty || "Expert Guide";
}

function PracticalInfoSection({ facts }: { facts: DetailFact[] }) {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 pb-14 pt-5 sm:px-8 lg:px-0">
      <div className="grid overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_12px_30px_rgba(67,43,27,0.06)] sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact, index) => (
          <PracticalFact key={fact.label} fact={fact} showDivider={index > 0} />
        ))}
      </div>
    </section>
  );
}

function PracticalFact({
  fact,
  showDivider,
}: {
  fact: DetailFact;
  showDivider: boolean;
}) {
  const Icon = fact.icon;

  return (
    <article
      className={cn(
        "flex min-h-[120px] items-center gap-5 px-7 py-6",
        showDivider && "border-t border-border sm:border-l sm:border-t-0"
      )}
    >
      <Icon className="size-11 shrink-0 text-primary" strokeWidth={1.45} />
      <span className="font-sans">
        <span className="block text-[12px] font-bold text-secondary">
          {fact.label}
        </span>
        <strong className="mt-2 block text-[16px] leading-tight text-secondary/82">
          {fact.value}
        </strong>
      </span>
    </article>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div>
      <h2 className="font-heading text-[30px] font-bold leading-tight text-secondary">
        {title}
      </h2>
      <span className="mt-3 block h-0.5 w-10 bg-primary" />
    </div>
  );
}
