import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";

export const metadata: Metadata = {
  title: "My Bookings",
};

const bookingTabs = ["All Bookings", "Upcoming", "Completed", "Cancelled"];

const bookings = [
  {
    title: "Rajasthan Heritage Trail",
    image: "/home assets/destination/Udaipur.webp",
    duration: "8 Days / 7 Nights",
    travelers: "2 Travellers",
    dateRange: "10 Jun - 17 Jun 2024",
    location: "Rajasthan, India",
    bookingId: "ATB-2024-00125",
    bookingDate: "02 May 2024",
    status: "Upcoming",
    amount: "₹24,500",
    payment: "Paid",
  },
  {
    title: "Himalayan Escape",
    image: "/home assets/Haridwar.webp",
    duration: "10 Days / 9 Nights",
    travelers: "1 Traveller",
    dateRange: "18 Apr - 27 Apr 2024",
    location: "Himachal Pradesh, India",
    bookingId: "ATB-2024-00098",
    bookingDate: "05 Apr 2024",
    status: "Completed",
    amount: "₹18,000",
    payment: "Paid",
  },
  {
    title: "Spiritual Varanasi",
    image: "/home assets/destination/Varanasi.webp",
    duration: "7 Days / 6 Nights",
    travelers: "2 Travellers",
    dateRange: "15 Mar - 21 Mar 2024",
    location: "Uttar Pradesh, India",
    bookingId: "ATB-2024-00065",
    bookingDate: "28 Feb 2024",
    status: "Cancelled",
    amount: "₹16,800",
    payment: "Refunded",
  },
  {
    title: "Kerala Backwaters",
    image: "/home assets/destination/Amritsar.webp",
    duration: "5 Days / 4 Nights",
    travelers: "2 Travellers",
    dateRange: "10 Feb - 14 Feb 2024",
    location: "Kerala, India",
    bookingId: "ATB-2024-00041",
    bookingDate: "20 Jan 2024",
    status: "Completed",
    amount: "₹14,500",
    payment: "Paid",
  },
];

const statusClass: Record<string, string> = {
  Upcoming: "bg-[#e9f8ee] text-[#2d9a45]",
  Completed: "bg-[#e9f8ee] text-[#2d9a45]",
  Cancelled: "bg-[#ffe8e8] text-[#df2e2e]",
};

function BookingMeta({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 font-sans text-[11px] font-medium leading-none text-secondary/72 sm:text-[12px]">
      <Icon className="size-4 shrink-0 text-secondary/68" strokeWidth={1.8} />
      <span className="truncate">{children}</span>
    </span>
  );
}

function BookingFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[10px] font-medium text-secondary/58">
        {label}
      </p>
      <p className="mt-1 font-sans text-[12px] font-medium text-secondary">
        {value}
      </p>
    </div>
  );
}

function BookingCard({ booking }: { booking: (typeof bookings)[number] }) {
  return (
    <article className="grid gap-4 rounded-[7px] border border-[#eadfd6] bg-white p-3 shadow-[0_8px_22px_rgba(50,50,50,0.025)] sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(250px,1fr)_170px_118px_175px] lg:items-center">
      <div className="relative h-[148px] overflow-hidden rounded-[7px] bg-muted sm:h-full lg:h-[126px]">
        <Image
          src={booking.image}
          alt={`${booking.title} preview`}
          fill
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 190px, 100vw"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 self-start py-1 lg:self-center">
        <h2 className="font-heading text-[17px] font-bold leading-tight text-secondary">
          {booking.title}
        </h2>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
          <BookingMeta icon={Clock3}>{booking.duration}</BookingMeta>
          <BookingMeta icon={UsersRound}>{booking.travelers}</BookingMeta>
        </div>
        <div className="mt-3 grid gap-3">
          <BookingMeta icon={CalendarDays}>{booking.dateRange}</BookingMeta>
          <BookingMeta icon={MapPin}>{booking.location}</BookingMeta>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:col-start-2 lg:col-start-auto lg:grid-cols-1 lg:gap-5">
        <BookingFact label="Booking ID" value={booking.bookingId} />
        <BookingFact label="Booking Date" value={booking.bookingDate} />
      </div>

      <div className="sm:col-start-2 lg:col-start-auto lg:self-start lg:pt-3">
        <span
          className={`inline-flex h-7 min-w-[82px] items-center justify-center rounded-[6px] px-3 font-sans text-[11px] font-semibold ${
            statusClass[booking.status]
          }`}
        >
          {booking.status}
        </span>
      </div>

      <div className="grid gap-3 sm:col-start-2 sm:grid-cols-[1fr_auto] sm:items-end lg:col-start-auto lg:block">
        <div>
          <p className="font-sans text-[10px] font-medium text-secondary/58">
            Total Amount
          </p>
          <p className="mt-1 font-sans text-[14px] font-bold leading-none text-secondary">
            {booking.amount}
          </p>
          <p
            className={`mt-2 font-sans text-[11px] font-semibold ${
              booking.payment === "Refunded" ? "text-[#df2e2e]" : "text-[#2d9a45]"
            }`}
          >
            {booking.payment}
          </p>
        </div>
        <a
          href="#"
          className={buttonVariants({
            variant: "outline",
            className: "w-full gap-3 px-5 font-normal sm:w-[165px] lg:mt-4",
          })}
        >
          View Details
          <ButtonArrow className="h-2.5 w-5 group-hover/button:brightness-0 group-hover/button:invert" />
        </a>
      </div>
    </article>
  );
}

export default function MyBookingsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf8f4] text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="My Bookings" />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1230px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
            <section className="relative overflow-hidden rounded-[8px] border border-[#eadfd6] bg-white px-4 py-5 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:px-7 sm:py-7 lg:min-h-[128px]">
              <Image
                src="/home assets/About_trails.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 760px, 100vw"
                priority
                className="pointer-events-none object-cover object-[55%_50%] opacity-[0.23] mix-blend-multiply"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_38%,rgba(255,255,255,0.78)_64%,rgba(255,255,255,0.48)_100%)]" />
              <div className="relative">
                <h1 className="font-heading text-[26px] font-bold leading-none text-secondary sm:text-[30px]">
                  My Bookings
                </h1>
                <p className="mt-3 font-sans text-[12px] font-medium text-secondary/75 sm:text-[13px]">
                  View and manage all your bookings in one place.
                </p>
              </div>
            </section>

            <section className="mt-3 rounded-[8px] border border-[#eadfd6] bg-white p-2.5 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-4 sm:p-4">
              <div className="grid grid-cols-2 gap-2 pb-2 sm:flex sm:gap-3 sm:overflow-x-auto sm:pb-3 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
                {bookingTabs.map((tab) => {
                  const active = tab === "All Bookings";

                  return (
                    <Button
                      key={tab}
                      type="button"
                      variant={active ? "default" : "outline"}
                      className="w-full px-3 text-[12px] font-normal sm:w-auto sm:shrink-0 sm:px-5 sm:text-button"
                    >
                      {tab}
                    </Button>
                  );
                })}
              </div>

              <div className="grid gap-2.5">
                {bookings.map((booking) => (
                  <BookingCard key={booking.bookingId} booking={booking} />
                ))}
              </div>

              <div className="flex flex-col gap-3 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-sans text-[12px] font-medium text-secondary/65">
                  Showing 1 to 4 of 4 bookings
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    aria-label="Previous page"
                    variant="outline"
                    size="icon-lg"
                    className="text-secondary/55 hover:text-primary"
                  >
                    <ChevronLeft className="size-4" strokeWidth={2} />
                  </Button>
                  <Button
                    type="button"
                    aria-label="Page 1"
                    size="icon-lg"
                    className="font-medium"
                  >
                    1
                  </Button>
                  <Button
                    type="button"
                    aria-label="Next page"
                    variant="outline"
                    size="icon-lg"
                    className="text-secondary/55 hover:text-primary"
                  >
                    <ChevronRight className="size-4" strokeWidth={2} />
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
