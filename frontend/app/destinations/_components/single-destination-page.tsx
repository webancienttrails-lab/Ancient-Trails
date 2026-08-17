"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Heart,
  ImageIcon,
  Landmark,
  MapPin,
  Play,
  Route,
  Star,
  TrainFront,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";
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
import { getTourCalendarHref, getTourHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

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
          <div className="mx-auto mt-16 max-w-[720px] rounded-[8px] border border-primary/15 bg-card p-8 text-center shadow-[0_18px_44px_rgba(50,50,50,0.08)]">
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
        heroImage={images[0]}
        images={images}
      />
      <LandmarksSection destination={destination} />
      <ActualExperiencesSection
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
        <div className="h-[360px] animate-pulse rounded-[8px] bg-border" />
      </div>
    </section>
  );
}

function DestinationHero({
  destination,
  heroImage,
  images,
}: {
  destination: PublicDestination;
  heroImage: string;
  images: string[];
}) {
  const locationLabel =
    getLocationLabel(destination) || destination.countryRegion || "Ancient Trails";

  return (
    <section className="relative overflow-hidden bg-background">
      <Image
        src={heroImage}
        alt={destination.destinationName}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.88)_40%,rgba(255,255,255,0.36)_72%,rgba(255,255,255,0.14)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#ffffff_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[670px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
        <Header />

        <div className="grid flex-1 items-center gap-8 pb-10 pt-8">
          <div className="max-w-[650px]">
            <DestinationBreadcrumbs destination={destination} />

            <p className="mt-8 text-eyebrow font-medium uppercase text-primary">
              {getPrimaryFocus(destination)}
            </p>
            <h1 className="mt-3 font-heading text-[42px] font-bold leading-none tracking-normal text-secondary sm:text-[58px] lg:text-[76px]">
              {destination.destinationName}
            </h1>

            <p className="mt-6 flex items-center gap-3 font-sans text-description font-medium text-accent">
              <MapPin className="size-5 shrink-0 fill-primary text-primary" strokeWidth={0} />
              {locationLabel}
            </p>

            <p className="mt-6 max-w-[470px] font-sans text-description text-secondary">
              {destination.shortDescription ||
                `${destination.destinationName} is a ${destination.destinationType.toLowerCase()} destination shaped by ${getPrimaryFocus(destination).toLowerCase()}.`}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                nativeButton={false}
                render={<Link href={getTourCalendarHref({ destination })} />}
                className="h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:min-w-[210px]"
              >
                View Tour Calendar
                <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
              </Button>
            </div>
          </div>
        </div>

        <GalleryStrip destination={destination} images={images} />
      </div>
    </section>
  );
}

function DestinationBreadcrumbs({
  destination,
}: {
  destination: PublicDestination;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 font-sans text-[13px] font-bold text-secondary">
      <Link href="/" className="transition-colors hover:text-primary">
        Home
      </Link>
      <ChevronRight className="size-4 text-secondary/50" />
      <Link href="/destinations" className="transition-colors hover:text-primary">
        Destinations
      </Link>
      {destination.state ? (
        <>
          <ChevronRight className="size-4 text-secondary/50" />
          <span>{destination.state}</span>
        </>
      ) : null}
      <ChevronRight className="size-4 text-secondary/50" />
      <span>{destination.destinationName}</span>
    </nav>
  );
}

function GalleryStrip({
  destination,
  images,
}: {
  destination: PublicDestination;
  images: string[];
}) {
  const galleryImages = Array.from({ length: 5 }, (_item, index) =>
    images[index] || fallbackImages[index % fallbackImages.length]
  );

  return (
    <section className="grid gap-4 md:grid-cols-5">
      {galleryImages.map((image, index) => (
        <article
          key={`${image}-${index}`}
          className="group relative h-[180px] overflow-hidden rounded-[8px] bg-muted shadow-[0_12px_26px_rgba(50,50,50,0.08)] ring-1 ring-white/70"
        >
          <Image
            src={image}
            alt={`${destination.destinationName} gallery ${index + 1}`}
            fill
            sizes="(min-width: 1024px) 250px, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {index === galleryImages.length - 1 ? (
            <div className="absolute inset-0 grid place-items-center bg-black/38 text-center text-white">
              <span>
                <span className="mx-auto grid size-12 place-items-center rounded-[8px] bg-white/88 text-primary">
                  <ImageIcon className="size-7" strokeWidth={1.6} />
                </span>
                <span className="mt-3 block font-sans text-[15px] font-bold">
                  View All Photos
                </span>
              </span>
            </div>
          ) : null}
        </article>
      ))}
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
      className="mx-auto w-full max-w-[1300px] px-5 pb-10 pt-3 sm:px-8 lg:px-0"
    >
      <p className="font-sans text-description font-medium uppercase text-primary">
        Explore the trail
      </p>
      <h2 className="mt-1 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
        Key Landmarks
      </h2>
      <span className="mt-3 block h-0.5 w-10 bg-primary" />

      <div className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {landmarks.slice(0, 4).map((landmark, index) => (
          <LandmarkCard
            key={`${landmark}-${index}`}
            destination={destination}
            index={index}
            landmark={landmark}
          />
        ))}
      </div>
    </section>
  );
}

function LandmarkCard({
  destination,
  index,
  landmark,
}: {
  destination: PublicDestination;
  index: number;
  landmark: string;
}) {
  const icons = [Landmark, Route, MapPin, TrainFront];
  const Icon = icons[index % icons.length];

  return (
    <article
      className={cn(
        "px-7 text-center",
        index > 0 && "lg:border-l lg:border-border"
      )}
    >
      <span className="mx-auto grid size-16 place-items-center rounded-full border border-primary/15 bg-white text-primary shadow-[0_10px_22px_rgba(50,50,50,0.06)]">
        <Icon className="size-8" strokeWidth={1.45} />
      </span>
      <h3 className="mt-5 min-h-[42px] font-heading text-[17px] font-bold leading-tight text-secondary">
        {landmark}
      </h3>
      <p className="mx-auto mt-2 max-w-[210px] font-sans text-[12px] font-medium leading-[1.65] text-secondary/70">
        {getLandmarkDescription(landmark, destination)}
      </p>
    </article>
  );
}

function ActualExperiencesSection({
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
  const videoTitle =
    featuredTour?.tourName || `Sunrise at the ${getPrimaryFocus(destination)}`;
  const videoDescription =
    featuredTour?.description ||
    destination.shortDescription ||
    `Watch ${destination.destinationName} come alive through stone, light and story.`;

  return (
    <section
      id="experiences"
      className="mx-auto w-full max-w-[1300px] px-5 py-11 sm:px-8 lg:px-0"
    >
      <p className="font-sans text-description font-medium uppercase text-primary">
        Travel moments
      </p>
      <h2 className="mt-1 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
        Actual Experiences in {destination.destinationName}
      </h2>
      <span className="mt-3 block h-0.5 w-10 bg-primary" />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_0.8fr_0.8fr]">
        <VideoExperienceCard
          description={videoDescription}
          image={images[1] || images[0]}
          title={videoTitle}
          video={video}
        />
        <QuoteExperienceCard destination={destination} />
        <PhotoExperienceCard
          destination={destination}
          image={images[2] || images[0]}
        />
      </div>
    </section>
  );
}

function VideoExperienceCard({
  description,
  image,
  title,
  video,
}: {
  description: string;
  image: string;
  title: string;
  video: string;
}) {
  return (
    <article className="group relative min-h-[305px] overflow-hidden rounded-[8px] bg-secondary shadow-[0_18px_40px_rgba(50,50,50,0.12)]">
      {video ? (
        <video
          src={video}
          className="absolute inset-0 size-full object-cover"
          muted
          playsInline
          controls
        />
      ) : (
        <Image
          src={image}
          alt={title}
          fill
          sizes="(min-width: 1024px) 590px, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,12,7,0.04)_0%,rgba(20,12,7,0.78)_100%)]" />
      <span className="absolute bottom-[88px] left-5 font-sans text-[10px] font-bold uppercase text-white">
        Video
      </span>
      <span className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-white/18 text-white backdrop-blur">
        <Play className="ml-1 size-9 fill-current" strokeWidth={0} />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="font-heading text-[21px] font-bold leading-tight">
          {title}
        </h3>
        <p className="mt-2 line-clamp-2 max-w-[520px] font-sans text-[12px] font-medium leading-[1.6] text-white/84">
          {description}
        </p>
      </div>
    </article>
  );
}

function QuoteExperienceCard({
  destination,
}: {
  destination: PublicDestination;
}) {
  return (
    <article className="rounded-[8px] border border-primary/15 bg-white p-7 shadow-[0_14px_32px_rgba(50,50,50,0.07)]">
      <p className="font-heading text-[48px] font-bold leading-none text-primary">
        &ldquo;
      </p>
      <p className="mt-2 font-sans text-[14px] font-medium leading-[1.75] text-secondary">
        Exploring {destination.destinationName} feels like stepping into a
        living chapter of India&apos;s heritage. The monuments, stories and
        quiet corners make it unforgettable.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-primary/12 font-sans text-[12px] font-bold text-primary">
          AT
        </span>
        <span className="font-sans">
          <strong className="block text-[13px] text-secondary">
            Ancient Trails Traveller
          </strong>
          <span className="block text-[11px] font-medium text-secondary/58">
            {destination.state || destination.countryRegion}
          </span>
        </span>
      </div>
      <div className="mt-5 flex gap-1 text-primary">
        {Array.from({ length: 5 }).map((_item, index) => (
          <Star key={index} className="size-4 fill-current" strokeWidth={0} />
        ))}
      </div>
    </article>
  );
}

function PhotoExperienceCard({
  destination,
  image,
}: {
  destination: PublicDestination;
  image: string;
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-primary/15 bg-white shadow-[0_14px_32px_rgba(50,50,50,0.07)]">
      <div className="relative h-[175px] overflow-hidden bg-muted">
        <Image
          src={image}
          alt={`${destination.destinationName} photo story`}
          fill
          sizes="(min-width: 1024px) 320px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="p-5">
        <p className="font-sans text-[10px] font-bold uppercase text-primary">
          Photo Story
        </p>
        <h3 className="mt-2 font-heading text-[20px] font-bold leading-tight text-secondary">
          Tranquil Afternoons
        </h3>
        <p className="mt-3 font-sans text-[13px] font-medium leading-[1.7] text-secondary/70">
          Peaceful moments around {destination.destinationName}, surrounded by
          timeless beauty.
        </p>
      </div>
    </article>
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
    <section
      id="tours"
      className="relative mx-auto w-full max-w-[1300px] px-5 py-11 sm:px-8 lg:px-0"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-sans text-description font-medium uppercase text-primary">
            Plan your visit
          </p>
          <h2 className="mt-1 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
            Tours in {destination.destinationName}
          </h2>
        </div>
        <Link
          href={getTourCalendarHref({ destination })}
          className="inline-flex w-fit items-center gap-3 font-sans text-[15px] font-bold text-primary transition-colors hover:text-accent"
        >
          View All Tours
          <ArrowRight className="size-5" />
        </Link>
      </div>
      <span className="mt-3 block h-0.5 w-10 bg-primary" />

      <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tours.slice(0, 4).map((tour, index) => (
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
    <article className="group overflow-hidden rounded-[8px] border border-primary/15 bg-white shadow-[0_16px_36px_rgba(50,50,50,0.08)] transition-all hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_22px_48px_rgba(50,50,50,0.14)]">
      <div className="relative h-[160px] overflow-hidden bg-muted">
        <Image
          src={getTourImage(tour, fallbackImage)}
          alt={tour.tourName}
          fill
          sizes="(min-width: 1280px) 305px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <button
          type="button"
          aria-label={`Save ${tour.tourName}`}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/18 text-white backdrop-blur transition-colors hover:bg-primary"
        >
          <Heart className="size-5" strokeWidth={1.9} />
        </button>
      </div>
      <div className="p-5">
        <h3 className="line-clamp-2 min-h-[46px] font-heading text-[18px] font-bold leading-tight text-secondary">
          {tour.tourName}
        </h3>
        <div className="mt-3 grid gap-2 font-sans text-[11px] font-semibold text-secondary/62">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-3.5 text-primary" strokeWidth={1.8} />
            {tour.durationDn || "Duration announced soon"}
          </span>
          <span className="inline-flex items-center gap-2">
            <Landmark className="size-3.5 text-primary" strokeWidth={1.8} />
            {tour.category || getPrimaryFocusFromTour(tour)}
          </span>
        </div>
        <div className="mt-6 flex items-end justify-between">
          <span className="font-sans text-[12px] font-semibold text-primary">
            {price > 0 ? (
              <>
                From
                <strong className="ml-1 text-[20px] leading-none">
                  {formatPrice(price)}
                </strong>
                <span className="ml-1 text-[11px] text-secondary">/ person</span>
              </>
            ) : (
              <strong className="text-[14px]">Price on request</strong>
            )}
          </span>
          <Link
            href={getTourHref(tour)}
            aria-label={`View ${tour.tourName}`}
            className="grid size-9 place-items-center text-primary transition-transform group-hover:translate-x-1"
          >
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function getPrimaryFocusFromTour(tour: PublicTour) {
  return tour.tourType || tour.difficulty || "Expert Guide";
}
