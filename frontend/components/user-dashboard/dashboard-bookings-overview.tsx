"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  MapPin,
  UsersRound,
  XCircle,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { clearTravellerSession } from "@/lib/auth";
import { getHomeMediaUrl } from "@/lib/home-travel";
import {
  getUserBookingDateRange,
  getUserBookingDetailHref,
  getUserBookingImageSource,
  getUserBookingLocation,
  getUserBookingTitle,
  getUserBookingTravellerLabel,
  getUserBookingTripStatus,
  listTravellerBookings,
  type UserBooking,
  type UserBookingTripStatus,
} from "@/lib/user-bookings";

const statConfig = [
  {
    label: "Upcoming",
    description: "Trips booked",
    icon: BriefcaseBusiness,
    tone: "bg-primary/12 text-primary",
  },
  {
    label: "Completed",
    description: "Trips completed",
    icon: ClipboardCheck,
    tone: "bg-accent/10 text-accent",
  },
  {
    label: "Cancelled",
    description: "Trips cancelled",
    icon: XCircle,
    tone: "bg-secondary/10 text-secondary/70",
  },
  {
    label: "Total",
    description: "Bookings made",
    icon: Bookmark,
    tone: "bg-primary/12 text-primary",
  },
];

function getDepartureTime(booking: UserBooking) {
  const value =
    booking.departure?.departureDate ||
    booking.booking.pricingSnapshot?.departureDate ||
    booking.booking.createdAt;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function StatCard({
  description,
  icon: Icon,
  index,
  isLoading,
  label,
  tone,
  value,
}: {
  description: string;
  icon: typeof BriefcaseBusiness;
  index: number;
  isLoading: boolean;
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <article
      className={`flex items-center gap-2 px-1.5 py-2 sm:gap-4 sm:px-3 ${
        index > 0 ? "lg:border-l lg:border-border" : ""
      }`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-full sm:size-16 ${tone}`}>
        <Icon className="size-5 sm:size-7" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[28px] font-bold leading-none text-secondary sm:text-[34px]">
          {isLoading ? "..." : value}
        </p>
        <p className="mt-1.5 font-sans text-[12px] font-semibold leading-none text-secondary sm:mt-2 sm:text-[15px]">
          {label}
        </p>
        <p className="mt-1 truncate font-sans text-[11px] text-secondary/70 sm:text-[13px]">
          {description}
        </p>
      </div>
    </article>
  );
}

function UpcomingBookingCard({ booking }: { booking: UserBooking }) {
  return (
    <article className="grid gap-3 rounded-[7px] border border-primary/15 bg-white p-3 shadow-[0_8px_20px_rgba(50,50,50,0.035)] sm:grid-cols-[128px_minmax(0,1fr)]">
      <div className="relative h-[108px] overflow-hidden rounded-[7px] bg-muted sm:h-full">
        <Image
          src={getHomeMediaUrl(getUserBookingImageSource(booking))}
          alt={`${getUserBookingTitle(booking)} preview`}
          fill
          sizes="(min-width: 640px) 128px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 py-1">
        <h3 className="font-heading text-[16px] font-bold leading-tight text-secondary">
          {getUserBookingTitle(booking)}
        </h3>
        <div className="mt-3 grid gap-2">
          <span className="inline-flex min-w-0 items-center gap-2 font-sans text-[11px] font-medium text-secondary/72">
            <CalendarDays className="size-4 shrink-0 text-secondary/68" strokeWidth={1.8} />
            <span className="truncate">{getUserBookingDateRange(booking)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-2 font-sans text-[11px] font-medium text-secondary/72">
            <MapPin className="size-4 shrink-0 text-secondary/68" strokeWidth={1.8} />
            <span className="truncate">{getUserBookingLocation(booking)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-2 font-sans text-[11px] font-medium text-secondary/72">
            <UsersRound className="size-4 shrink-0 text-secondary/68" strokeWidth={1.8} />
            <span className="truncate">{getUserBookingTravellerLabel(booking)}</span>
          </span>
        </div>
        <Link
          href={getUserBookingDetailHref(booking)}
          className={buttonVariants({
            variant: "link",
            className: "mt-3 h-auto gap-2 p-0 text-[12px] font-semibold",
          })}
        >
          View Booking
          <ButtonArrow className="h-2.5 w-5 group-hover/button:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

function EmptyUpcomingTours() {
  return (
    <div className="relative mt-4 overflow-hidden rounded-[7px] bg-primary/5 px-4 py-6 sm:mt-5 sm:px-5 sm:py-7">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt=""
        fill
        sizes="100vw"
        className="pointer-events-none object-cover object-right opacity-[0.12] mix-blend-multiply"
      />
      <div className="relative mx-auto flex max-w-[640px] flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
          <MapPin className="size-8" strokeWidth={1.8} />
        </span>
        <div>
          <p className="font-sans text-[15px] font-semibold text-secondary">
            You have no upcoming tours.
          </p>
          <p className="mt-1 font-sans text-[13px] text-secondary/70">
            Plan your next adventure with us!
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/tour-calendar" />}
            variant="outline"
            className="mt-4 w-full justify-between gap-4 px-5 font-normal sm:w-auto sm:min-w-[170px] sm:px-6"
          >
            Explore Tours
            <ButtonArrow className="h-2.5 w-5 group-hover/button:brightness-0 group-hover/button:invert" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardBookingsOverview() {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await listTravellerBookings();

        if (isMounted) {
          setBookings(response.data.bookings);
        }
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          clearTravellerSession();
          return;
        }

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Bookings could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<UserBookingTripStatus | "Total", number> = {
      Cancelled: 0,
      Completed: 0,
      Total: bookings.length,
      Upcoming: 0,
    };

    bookings.forEach((booking) => {
      counts[getUserBookingTripStatus(booking)] += 1;
    });

    return counts;
  }, [bookings]);
  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((booking) => getUserBookingTripStatus(booking) === "Upcoming")
        .sort((left, right) => getDepartureTime(left) - getDepartureTime(right))
        .slice(0, 2),
    [bookings]
  );
  const totalBookingLabel = `${bookings.length} ${
    bookings.length === 1 ? "booking" : "bookings"
  }`;
  const primaryActionHref = bookings.length > 0 ? "/me/bookings" : "/tour-calendar";
  const primaryActionLabel = bookings.length > 0 ? "View Bookings" : "Explore Tours";

  return (
    <>
      <section className="grid grid-cols-2 gap-3 rounded-[8px] border border-border bg-white p-3 shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:gap-4 sm:p-4 lg:grid-cols-4 lg:p-5">
        {statConfig.map((stat, index) => (
          <StatCard
            key={stat.label}
            {...stat}
            index={index}
            isLoading={isLoading}
            value={statusCounts[stat.label as UserBookingTripStatus | "Total"]}
          />
        ))}
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-border bg-white p-4 shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:mt-6 sm:p-5">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-[18px] font-bold leading-tight text-secondary">
            My Upcoming Tours
          </h2>
          <Link
            href="/me/bookings"
            className={buttonVariants({
              variant: "link",
              className: "h-auto gap-2 p-0 font-medium",
            })}
          >
            View All Bookings
            <ButtonArrow className="h-2.5 w-5 group-hover/button:translate-x-0.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-[7px] bg-primary/5 px-4 py-8 text-center sm:mt-5">
            <p className="font-sans text-[13px] font-semibold text-secondary">
              Loading your upcoming tours...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="mt-4 rounded-[7px] border border-red-200 bg-red-50 px-4 py-8 text-center sm:mt-5">
            <p className="font-sans text-[13px] font-semibold text-red-700">
              {errorMessage}
            </p>
          </div>
        ) : upcomingBookings.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:mt-5 xl:grid-cols-2">
            {upcomingBookings.map((booking) => (
              <UpcomingBookingCard key={booking.booking.id} booking={booking} />
            ))}
          </div>
        ) : (
          <EmptyUpcomingTours />
        )}
      </section>

      <section className="relative mt-4 overflow-hidden rounded-[8px] border border-border bg-white shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:mt-6">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff8f1_0%,#ffffff_48%,#fff4ea_100%)]" />
        <Image
          src="/home assets/destination/hawa-mahal.webp"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none object-cover object-right opacity-[0.13] mix-blend-multiply"
        />
        <div className="relative grid min-h-[220px] items-center gap-8 px-5 py-7 sm:min-h-[250px] sm:px-6 sm:py-8 lg:grid-cols-[390px_1fr] lg:px-12">
          <div className="max-w-[560px]">
            <p className="font-heading text-[28px] font-bold leading-tight text-secondary sm:text-[32px]">
              This is a good time to go on a holiday.
            </p>
            <p className="mt-4 font-sans text-[15px] text-secondary/80">
              {isLoading
                ? "Checking your booking history..."
                : bookings.length > 0
                  ? `You have ${totalBookingLabel} with us.`
                  : "You have no bookings with us. Let's break the ice."}
            </p>
            <Button
              nativeButton={false}
              render={<Link href={primaryActionHref} />}
              className="mt-7 w-full justify-between gap-4 px-5 font-normal sm:w-auto sm:min-w-[170px] sm:px-6"
            >
              {primaryActionLabel}
              <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
