"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { clearTravellerSession } from "@/lib/auth";
import { getHomeMediaUrl } from "@/lib/home-travel";
import {
  getUserBookingDate,
  getUserBookingDateRange,
  getUserBookingDetailHref,
  getUserBookingDuration,
  getUserBookingImageSource,
  getUserBookingLocation,
  getUserBookingReference,
  getUserBookingTitle,
  getUserBookingTravellerLabel,
  getUserBookingTripStatus,
  listTravellerBookings,
  type UserBooking,
  type UserBookingTripStatus,
} from "@/lib/user-bookings";

const bookingTabs = ["All Bookings", "Upcoming", "Completed", "Cancelled"];
const pageSize = 5;

const statusClass: Record<UserBookingTripStatus, string> = {
  Upcoming: "bg-primary/10 text-primary",
  Completed: "bg-accent/10 text-accent",
  Cancelled: "bg-secondary/10 text-secondary/70",
};

function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Math.max(0, Math.round(amount)));
}

function formatShortDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getTotalAmount(booking: UserBooking) {
  return (
    booking.booking.grandTotal ||
    booking.booking.amountPaid ||
    booking.booking.depositAmount ||
    0
  );
}

function getPaidAmount(booking: UserBooking) {
  if (booking.booking.paymentStatus?.toLowerCase() === "paid") {
    return (
      booking.booking.amountPaid ||
      booking.booking.depositAmount ||
      getTotalAmount(booking)
    );
  }

  return booking.booking.amountPaid || 0;
}

function getBalanceAmount(booking: UserBooking) {
  if (typeof booking.booking.balanceAmount === "number") {
    return booking.booking.balanceAmount;
  }

  return Math.max(0, getTotalAmount(booking) - getPaidAmount(booking));
}

function BookingMeta({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5 font-sans text-[12px] font-medium leading-none text-secondary/78 sm:text-[13px]">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-3.5" strokeWidth={1.8} />
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function BookingFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[12px] font-medium text-secondary/58">
        {label}
      </p>
      <p className="mt-2 font-sans text-[14px] font-bold text-secondary">
        {value}
      </p>
    </div>
  );
}

function EmptyBookings({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-[7px] border border-dashed border-primary/25 bg-primary/5 px-4 py-10 text-center">
      <p className="font-sans text-[14px] font-semibold text-secondary">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-[420px] font-sans text-[12px] leading-[1.55] text-secondary/68">
        {description}
      </p>
      <Link
        href="/tour-calendar"
        className={buttonVariants({
          className: "mt-5 gap-3 px-5 font-normal",
        })}
      >
        Explore Tours
        <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
      </Link>
    </div>
  );
}

function BookingCard({ booking }: { booking: UserBooking }) {
  const tripStatus = getUserBookingTripStatus(booking);
  const currency = booking.booking.paymentCurrency || "INR";
  const totalAmount = getTotalAmount(booking);
  const paidAmount = getPaidAmount(booking);
  const balanceAmount = getBalanceAmount(booking);

  return (
    <article className="relative grid w-full min-w-0 overflow-hidden rounded-[8px] border border-[#eadfd4] bg-[#fffaf4] p-3 shadow-[0_18px_42px_rgba(65,43,26,0.07)] sm:p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] lg:items-stretch xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.38fr)_minmax(0,1.08fr)_minmax(0,0.86fr)] xl:p-0">
      <div className="relative aspect-[16/9] min-w-0 overflow-hidden rounded-[8px] bg-muted lg:m-5 lg:aspect-auto lg:min-h-[170px] xl:h-[170px] xl:min-h-0 2xl:h-[178px]">
        <Image
          src={getHomeMediaUrl(getUserBookingImageSource(booking))}
          alt={`${getUserBookingTitle(booking)} preview`}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 32vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 border-b border-[#eadfd4] py-5 lg:border-b-0 lg:px-6 lg:py-7 xl:px-6">
        <h2 className="max-w-[520px] text-balance font-heading text-[24px] font-bold leading-[1.15] text-secondary sm:text-[28px] xl:text-[27px] 2xl:text-[30px]">
          {getUserBookingTitle(booking)}
        </h2>
        <div className="mt-4 flex items-center gap-1.5 text-primary">
          <span className="h-px w-11 bg-primary" />
          <span className="size-1.5 rotate-45 border border-primary" />
          <span className="h-px w-4 bg-primary/55" />
        </div>
        <div className="mt-6 flex flex-wrap gap-x-7 gap-y-4">
          <BookingMeta icon={Clock3}>{getUserBookingDuration(booking)}</BookingMeta>
          <BookingMeta icon={UsersRound}>
            {getUserBookingTravellerLabel(booking)}
          </BookingMeta>
          <BookingMeta icon={CalendarDays}>
            {getUserBookingDateRange(booking)}
          </BookingMeta>
        </div>
        <div className="mt-4">
          <BookingMeta icon={MapPin}>{getUserBookingLocation(booking)}</BookingMeta>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 border-b border-[#eadfd4] py-5 lg:border-t lg:border-b-0 lg:border-[#eadfd4] lg:px-6 lg:py-6 xl:border-l xl:border-t-0 xl:px-6 xl:py-7">
        <div className="flex items-start justify-between gap-3">
          <BookingFact label="Booking ID" value={getUserBookingReference(booking)} />
          <span
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-3 font-sans text-[12px] font-semibold xl:px-2.5 ${statusClass[tripStatus]}`}
          >
            <CalendarDays className="size-3.5" strokeWidth={1.9} />
            {tripStatus}
          </span>
        </div>
        <div className="h-px bg-[#eadfd4]" />
        <BookingFact label="Booking Date" value={getUserBookingDate(booking)} />
      </div>

      <div className="relative grid min-w-0 gap-3 py-5 lg:border-t lg:border-[#eadfd4] lg:px-6 lg:py-6 xl:border-l xl:border-t-0 xl:px-5 xl:py-5">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate font-sans text-[12px] font-medium text-secondary/62">
            Total Amount
          </p>
          <p className="min-w-0 whitespace-nowrap text-right font-sans text-[15px] font-bold leading-none text-secondary 2xl:text-[16px]">
            {formatCurrency(totalAmount, currency)}
          </p>
        </div>
        <div className="h-px bg-[#eadfd4]" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate font-sans text-[12px] font-medium text-secondary/62">
            Paid Amount
          </p>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
            <p className="whitespace-nowrap font-sans text-[15px] font-bold leading-none text-emerald-600">
              {formatCurrency(paidAmount, currency)}
            </p>
          </div>
        </div>
        <div className="h-px bg-[#eadfd4]" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate font-sans text-[12px] font-medium text-secondary/62">
            Balance
          </p>
          <p className="min-w-0 whitespace-nowrap text-right font-sans text-[15px] font-bold leading-none text-secondary">
            {formatCurrency(balanceAmount, currency)}
          </p>
        </div>
        <div className="h-px bg-[#eadfd4]" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 truncate font-sans text-[12px] font-medium text-secondary/62">
            Due Date
          </p>
          <p className="min-w-0 whitespace-nowrap text-right font-sans text-[12px] font-bold leading-none text-primary 2xl:text-[13px]">
            {formatShortDate(booking.booking.balanceDueDate)}
          </p>
        </div>
        <Link
          href={getUserBookingDetailHref(booking)}
          className="mt-1 inline-flex h-10 w-full items-center justify-center gap-4 rounded-[7px] bg-[linear-gradient(180deg,#c84e11_0%,#a83a05_100%)] px-5 font-sans text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(168,58,5,0.22)] transition-transform hover:-translate-y-0.5"
        >
          View Details
          <ArrowRight className="size-4" strokeWidth={1.8} />
        </Link>
      </div>
    </article>
  );
}

export function UserBookingsSection() {
  const [activeTab, setActiveTab] = useState("All Bookings");
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

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

  const filteredBookings = useMemo(
    () =>
      activeTab === "All Bookings"
        ? bookings
        : bookings.filter(
            (booking) => getUserBookingTripStatus(booking) === activeTab
          ),
    [activeTab, bookings]
  );
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleBookings = filteredBookings.slice(pageStart, pageStart + pageSize);
  const showingStart = filteredBookings.length === 0 ? 0 : pageStart + 1;
  const showingEnd = Math.min(pageStart + pageSize, filteredBookings.length);

  return (
    <section className="mt-3 rounded-[8px] border border-border bg-white p-2.5 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-4 sm:p-4">
      <div className="grid grid-cols-2 gap-2 pb-2 sm:flex sm:gap-3 sm:overflow-x-auto sm:pb-3 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
        {bookingTabs.map((tab) => {
          const active = tab === activeTab;

          return (
            <Button
              key={tab}
              type="button"
              variant={active ? "default" : "outline"}
              className="w-full px-3 text-[16px] font-normal sm:w-auto sm:shrink-0 sm:px-5"
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
            >
              {tab}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-2.5">
        {isLoading ? (
          <div className="rounded-[7px] border border-border bg-white px-4 py-10 text-center">
            <p className="font-sans text-[13px] font-semibold text-secondary">
              Loading your bookings...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-[7px] border border-red-200 bg-red-50 px-4 py-8 text-center">
            <p className="font-sans text-[13px] font-semibold text-red-700">
              {errorMessage}
            </p>
          </div>
        ) : visibleBookings.length > 0 ? (
          visibleBookings.map((booking) => (
            <BookingCard key={booking.booking.id} booking={booking} />
          ))
        ) : (
          <EmptyBookings
            title={
              activeTab === "All Bookings"
                ? "No bookings found"
                : `No ${activeTab.toLowerCase()} bookings found`
            }
            description={
              activeTab === "All Bookings"
                ? "Your confirmed bookings will appear here once you book a tour."
                : "Try another booking status or explore upcoming tours."
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-3 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sans text-[12px] font-medium text-secondary/65">
          Showing {showingStart} to {showingEnd} of {filteredBookings.length} bookings
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            aria-label="Previous page"
            variant="outline"
            size="icon-lg"
            className="text-secondary/55 hover:text-primary"
            disabled={currentPage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </Button>
          <Button
            type="button"
            aria-label={`Page ${currentPage}`}
            size="icon-lg"
            className="font-medium"
          >
            {currentPage}
          </Button>
          <Button
            type="button"
            aria-label="Next page"
            variant="outline"
            size="icon-lg"
            className="text-secondary/55 hover:text-primary"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </section>
  );
}
