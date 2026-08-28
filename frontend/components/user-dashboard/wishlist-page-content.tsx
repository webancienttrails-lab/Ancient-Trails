"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  MapPin,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";
import { listenForTravellerSessionChanges } from "@/lib/auth";
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
import { getTourHref } from "@/lib/routes";
import {
  listenForWishlistChanges,
  normalizeWishlistTourId,
  readWishlistItems,
  removeWishlistTour,
  type WishlistTourItem,
} from "@/lib/wishlist";

type WishlistTourDisplay = {
  categoryLabel: string;
  description: string;
  destinationLabel: string;
  difficultyLabel: string;
  durationLabel: string;
  href: string;
  image: string;
  nextDepartureLabel: string;
  priceLabel: string;
  savedAt: string;
  title: string;
  totalSeatsLabel: string;
  tourId: string;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fallbackImages = [
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Egypt.webp",
  "/home assets/Vietnam.webp",
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load wishlist tours.";
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean))
  );
}

function parseDurationDays(duration: string) {
  const dayMatch = duration.match(/(\d+)\s*(?:d|day)/i);
  const numericMatch = dayMatch || duration.match(/(\d+)/);
  const days = numericMatch ? Number(numericMatch[1]) : 0;

  return Number.isFinite(days) && days > 0 ? days : 0;
}

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return dateFormatter.format(date).replace(",", "");
}

function formatPrice(value: number) {
  if (!value || value <= 0) {
    return "Price on request";
  }

  return currencyFormatter.format(value);
}

function getPrimaryDestinationId(tour: PublicTour) {
  return getTourDestinationIds(tour)[0] || tour.destinationId;
}

function getDestinationLabel(destination: PublicDestination | undefined) {
  if (!destination) {
    return "Ancient Trails";
  }

  return (
    uniqueValues([
      destination.city,
      destination.state,
      destination.countryRegion,
    ]).join(", ") || destination.destinationName
  );
}

function getTourImage(tour: PublicTour, fallbackImage: string) {
  return getHomeMediaUrl(
    tour.thumbnailImage ||
      tour.bannerImage ||
      tour.galleryImages[0] ||
      fallbackImage
  );
}

function getLowestPrice(departures: PublicTourDeparture[]) {
  const prices = departures
    .map((departure) => departure.priceAdult)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

function getNextDeparture(departures: PublicTourDeparture[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    departures
      .filter(
        (departure) => getDateValue(departure.departureDate) >= today.getTime()
      )
      .sort(
        (left, right) =>
          getDateValue(left.departureDate) - getDateValue(right.departureDate)
      )[0] ||
    departures
      .slice()
      .sort(
        (left, right) =>
          getDateValue(left.departureDate) - getDateValue(right.departureDate)
      )[0]
  );
}

function buildDeparturesByTourId(departures: PublicTourDeparture[]) {
  const departuresByTourId = new Map<string, PublicTourDeparture[]>();

  departures.forEach((departure) => {
    const tourId = normalizeWishlistTourId(departure.tourId);
    const currentDepartures = departuresByTourId.get(tourId) || [];

    departuresByTourId.set(tourId, [...currentDepartures, departure]);
  });

  return departuresByTourId;
}

function buildDestinationById(destinations: PublicDestination[]) {
  return new Map(
    destinations.map((destination) => [
      normalizeWishlistTourId(destination.destinationId),
      destination,
    ])
  );
}

function buildTourDisplay({
  departures,
  destinations,
  index,
  savedAt,
  tour,
}: {
  departures: PublicTourDeparture[];
  destinations: Map<string, PublicDestination>;
  index: number;
  savedAt: string;
  tour: PublicTour;
}): WishlistTourDisplay {
  const destination = destinations.get(
    normalizeWishlistTourId(getPrimaryDestinationId(tour))
  );
  const nextDeparture = getNextDeparture(departures);
  const totalSeats = departures.reduce(
    (sum, departure) => sum + Math.max(0, departure.seatsAvailable),
    0
  );
  const fallbackImage = fallbackImages[index % fallbackImages.length] || fallbackImages[0];
  const durationDays =
    parseDurationDays(tour.durationDn) ||
    destination?.recommendedDurationDays ||
    0;

  return {
    categoryLabel: tour.category || tour.tourType || "Heritage",
    description:
      tour.description ||
      "An expert-led Ancient Trails journey through heritage, culture and local stories.",
    destinationLabel: getDestinationLabel(destination),
    difficultyLabel: tour.difficulty || "Moderate",
    durationLabel: tour.durationDn || `${durationDays || 1} Days`,
    href: getTourHref(tour),
    image: getTourImage(tour, destination?.bannerImage || fallbackImage),
    nextDepartureLabel: formatDate(nextDeparture?.departureDate || null),
    priceLabel: formatPrice(getLowestPrice(departures)),
    savedAt,
    title: tour.tourName,
    totalSeatsLabel:
      totalSeats > 0 ? `${totalSeats} seats available` : "Dates coming soon",
    tourId: normalizeWishlistTourId(tour.tourId),
  };
}

function buildSnapshotDisplay(
  item: WishlistTourItem
): WishlistTourDisplay | null {
  if (!item.snapshot) {
    return null;
  }

  return {
    categoryLabel: item.snapshot.categoryLabel || "Heritage",
    description:
      item.snapshot.description ||
      "An expert-led Ancient Trails journey through heritage, culture and local stories.",
    destinationLabel: item.snapshot.destinationLabel || "Ancient Trails",
    difficultyLabel: item.snapshot.difficultyLabel || "Moderate",
    durationLabel: item.snapshot.durationLabel || "Duration soon",
    href: item.snapshot.href || "/tours",
    image: item.snapshot.image || fallbackImages[0],
    nextDepartureLabel: item.snapshot.nextDepartureLabel || "Coming Soon",
    priceLabel: item.snapshot.priceLabel || "Price on request",
    savedAt: item.savedAt,
    title: item.snapshot.title,
    totalSeatsLabel: "Saved tour",
    tourId: item.tourId,
  };
}

function MetaItem({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-sans text-[12px] font-medium text-secondary/72">
      <Icon className="size-3.5 shrink-0 text-secondary/60" strokeWidth={1.8} />
      <span className="truncate">{children}</span>
    </span>
  );
}

function WishlistCard({
  onRemove,
  tour,
}: {
  onRemove: (tour: WishlistTourDisplay) => void;
  tour: WishlistTourDisplay;
}) {
  const tourMeta = [
    { icon: Clock3, key: "duration", label: tour.durationLabel },
    { icon: MapPin, key: "destination", label: tour.destinationLabel },
    { icon: CalendarDays, key: "departure", label: tour.nextDepartureLabel },
    { icon: Star, key: "difficulty", label: tour.difficultyLabel },
  ];

  return (
    <article className="grid gap-4 rounded-[8px] border border-border bg-white p-3 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:gap-5 sm:p-4 lg:grid-cols-[310px_minmax(0,1fr)_245px]">
      <div className="relative min-h-[190px] overflow-hidden rounded-[7px] bg-muted sm:min-h-[220px] lg:min-h-0">
        <Image
          src={tour.image}
          alt={`${tour.title} preview`}
          fill
          sizes="(min-width: 1024px) 310px, 100vw"
          className="object-cover"
        />
        <Button
          type="button"
          aria-label={`Remove ${tour.title} from wishlist`}
          aria-pressed={true}
          variant="outline"
          size="icon-lg"
          className="absolute right-3 top-3 rounded-full bg-white/95 text-primary shadow-[0_10px_22px_rgba(50,50,50,0.16)]"
          onClick={() => onRemove(tour)}
        >
          <Heart className="size-5 fill-current" strokeWidth={0} />
        </Button>
      </div>

      <div className="min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-[4px] border border-primary bg-white px-3 font-sans text-[10px] font-bold uppercase text-primary">
            Group Tour
          </span>
          <span className="inline-flex h-6 items-center rounded-[4px] border border-primary/35 bg-[#fff2e9] px-3 font-sans text-[10px] font-bold uppercase text-primary">
            {tour.tourId}
          </span>
          <span className="inline-flex h-6 items-center rounded-[4px] border border-accent/35 bg-accent/10 px-3 font-sans text-[10px] font-semibold text-accent">
            {tour.categoryLabel}
          </span>
        </div>

        <h2 className="mt-3 font-heading text-[22px] font-bold leading-tight text-secondary">
          {tour.title}
        </h2>

        <Link
          href={tour.href}
          className="mt-3 inline-flex items-center gap-1.5 font-sans text-[12px] font-bold text-primary underline-offset-4 hover:underline"
        >
          All Inclusive
          <Info className="size-3.5" strokeWidth={1.9} />
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {tourMeta.map((item) => (
            <MetaItem key={item.key} icon={item.icon}>
              {item.label}
            </MetaItem>
          ))}
          <ChevronRight className="size-4 text-secondary/55" strokeWidth={2} />
        </div>

        <div className="mt-5">
          <p className="font-sans text-[12px] font-bold text-primary">
            Tour Highlights
          </p>
          <p className="mt-2 line-clamp-2 font-sans text-[12px] leading-[1.55] text-secondary/75">
            {tour.description}
          </p>
          <Link
            href={tour.href}
            className="mt-1 inline-flex font-sans text-[12px] font-semibold text-secondary underline-offset-4 hover:text-primary hover:underline"
          >
            More
          </Link>
        </div>
      </div>

      <aside className="flex flex-col justify-between rounded-[7px] bg-primary/5 p-4 sm:p-5">
        <div>
          <p className="font-sans text-[11px] font-medium text-secondary/60">
            Starting price per person
          </p>
          <p className="mt-2 font-sans text-[22px] font-bold leading-none text-secondary">
            {tour.priceLabel}
          </p>
          <p className="mt-5 font-sans text-[11px] font-medium text-secondary/60">
            Next departure
          </p>
          <p className="mt-1 font-sans text-[16px] font-bold leading-none text-secondary">
            {tour.nextDepartureLabel}
          </p>
          <p className="mt-3 font-sans text-[11px] font-medium text-secondary/60">
            {tour.totalSeatsLabel}
          </p>
        </div>

        <div className="mt-6">
          <Link
            href={tour.href}
            className={buttonVariants({
              className: "w-full justify-between gap-4 px-6 font-normal",
            })}
          >
            View Details
            <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Link>
          <button
            type="button"
            className="mx-auto mt-4 flex items-center justify-center gap-2 font-sans text-[12px] font-medium text-secondary/60 transition-colors hover:text-primary"
            onClick={() => onRemove(tour)}
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
            Remove from Wishlist
          </button>
        </div>
      </aside>
    </article>
  );
}

function WishlistSkeleton() {
  return (
    <section className="grid gap-4 sm:gap-5">
      {Array.from({ length: 3 }).map((_item, index) => (
        <div
          key={index}
          className="h-[360px] animate-pulse rounded-[8px] bg-[#ead8c5]/65 lg:h-[250px]"
        />
      ))}
    </section>
  );
}

function EmptyWishlist({ message }: { message: string }) {
  return (
    <section className="rounded-[8px] border border-dashed border-[#ead8c5] bg-white/72 px-5 py-12 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Heart className="size-6" strokeWidth={1.8} />
      </span>
      <h2 className="mt-4 font-heading text-[26px] font-bold text-secondary">
        No Saved Tours
      </h2>
      <p className="mx-auto mt-2 max-w-[420px] font-sans text-[13px] leading-[1.65] text-secondary/62">
        {message}
      </p>
      <Link
        href="/tours"
        className={buttonVariants({
          className: "mt-6 min-w-[190px] justify-between gap-4 px-6 font-normal",
        })}
      >
        Explore Tours
        <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
      </Link>
    </section>
  );
}

export function WishlistPageContent() {
  const toast = useToast();
  const [wishlistItems, setWishlistItems] = useState<WishlistTourItem[]>([]);
  const [tours, setTours] = useState<PublicTour[]>([]);
  const [departures, setDepartures] = useState<PublicTourDeparture[]>([]);
  const [destinations, setDestinations] = useState<PublicDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const syncWishlist = () => {
      setWishlistItems(readWishlistItems());
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

  const wishlistIdsKey = wishlistItems
    .map((item) => item.tourId)
    .sort()
    .join("|");

  useEffect(() => {
    let isMounted = true;

    async function loadTours() {
      if (!wishlistIdsKey) {
        setTours([]);
        setDepartures([]);
        setDestinations([]);
        setLoadError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");

      try {
        const [toursResponse, departuresResponse, destinationsResponse] =
          await Promise.all([
            listPublicTours(),
            listPublicTourDepartures(),
            listPublicDestinations(),
          ]);

        if (isMounted) {
          setTours(toursResponse.data.tours);
          setDepartures(departuresResponse.data.departures);
          setDestinations(destinationsResponse.data.destinations);
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

    loadTours();

    return () => {
      isMounted = false;
    };
  }, [wishlistIdsKey]);

  const wishlistTours = useMemo(() => {
    const tourById = new Map(
      tours.map((tour) => [normalizeWishlistTourId(tour.tourId), tour])
    );
    const departuresByTourId = buildDeparturesByTourId(departures);
    const destinationById = buildDestinationById(destinations);

    return wishlistItems.flatMap((item, index) => {
      const tour = tourById.get(item.tourId);

      if (tour) {
        return [
          buildTourDisplay({
            departures: departuresByTourId.get(item.tourId) || [],
            destinations: destinationById,
            index,
            savedAt: item.savedAt,
            tour,
          }),
        ];
      }

      const snapshotDisplay = buildSnapshotDisplay(item);

      return snapshotDisplay ? [snapshotDisplay] : [];
    });
  }, [departures, destinations, tours, wishlistItems]);

  function handleRemove(tour: WishlistTourDisplay) {
    const nextItems = removeWishlistTour(tour.tourId);

    setWishlistItems(nextItems);
    toast.info("Removed from wishlist", `${tour.title} was removed.`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="Wishlist" />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1220px] px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <section className="relative overflow-hidden pb-5 sm:pb-8">
              <Image
                src="/home assets/About_trails.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                priority
                className="pointer-events-none object-cover object-right-top opacity-[0.22] mix-blend-multiply"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff8f0_0%,#fff8f0_46%,rgba(255,248,240,0.78)_68%,rgba(255,248,240,0.58)_100%)]" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="font-heading text-[30px] font-bold leading-none text-secondary sm:text-[34px]">
                    My Wishlist
                  </h1>
                  <p className="mt-3 font-sans text-[13px] font-medium text-secondary/70">
                    Your saved tours and experiences you&apos;d love to explore.
                  </p>
                </div>

                <div className="inline-flex h-10 items-center rounded-[7px] border border-[#ead8c5] bg-white px-4 font-sans text-[12px] font-bold text-secondary shadow-[0_8px_20px_rgba(67,43,27,0.05)]">
                  {wishlistTours.length} saved
                </div>
              </div>
            </section>

            {isLoading ? <WishlistSkeleton /> : null}

            {!isLoading && wishlistTours.length > 0 ? (
              <section className="grid gap-4 sm:gap-5">
                {wishlistTours.map((tour) => (
                  <WishlistCard
                    key={`${tour.tourId}-${tour.savedAt}`}
                    tour={tour}
                    onRemove={handleRemove}
                  />
                ))}
              </section>
            ) : null}

            {!isLoading && wishlistTours.length === 0 ? (
              <EmptyWishlist
                message={
                  loadError ||
                  "No saved tours are attached to your account yet."
                }
              />
            ) : null}

            {!isLoading && loadError && wishlistTours.length > 0 ? (
              <p className="mt-4 font-sans text-[12px] font-medium text-secondary/58">
                {loadError}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
