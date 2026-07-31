import Image from "next/image";
import type { Metadata } from "next";
import {
  BedDouble,
  CalendarDays,
  Heart,
  Plane,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";

export const metadata: Metadata = {
  title: "My Holiday Cart",
};

const cartDetails = [
  { label: "Tour Date", value: "07 Sep 2026", icon: CalendarDays },
  { label: "Departure City", value: "New York", icon: Plane },
  { label: "Guests", value: "2 Adults, 0 Child, 0 Infant", icon: UsersRound },
  { label: "Room", value: "2 Single Rooms - 1 Adult in each room", icon: BedDouble },
];

const suggestions = [
  {
    title: "Grand Europe Explorer",
    duration: "12 Days / 11 Nights",
    amount: "2,45,000",
    image: "/home assets/Egypt.webp",
  },
  {
    title: "Best of Switzerland",
    duration: "8 Days / 7 Nights",
    amount: "1,95,000",
    image: "/home assets/Haridwar.webp",
  },
  {
    title: "Japan Discovery",
    duration: "10 Days / 9 Nights",
    amount: "2,75,000",
    image: "/home assets/destination/Amritsar.webp",
  },
  {
    title: "Australia Highlights",
    duration: "9 Days / 8 Nights",
    amount: "2,10,000",
    image: "/home assets/Indonesia.webp",
  },
];

function DetailRow({ detail }: { detail: (typeof cartDetails)[number] }) {
  const Icon = detail.icon;

  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[22px_minmax(110px,150px)_minmax(0,1fr)] sm:items-center">
      <Icon className="size-4 text-secondary/70" strokeWidth={1.8} />
      <p className="font-sans text-[13px] font-medium text-secondary/72">
        {detail.label}
      </p>
      <p className="col-start-2 min-w-0 font-sans text-[13px] font-bold text-secondary sm:col-start-auto">
        {detail.value}
      </p>
    </div>
  );
}

function SuggestionCard({ tour }: { tour: (typeof suggestions)[number] }) {
  return (
    <article className="min-w-0">
      <div className="relative h-[92px] overflow-hidden rounded-[6px] bg-muted">
        <Image
          src={tour.image}
          alt={`${tour.title} preview`}
          fill
          sizes="(min-width: 1280px) 260px, (min-width: 768px) 24vw, 100vw"
          className="object-cover"
        />
        <Button
          type="button"
          aria-label={`Save ${tour.title}`}
          variant="outline"
          size="icon-sm"
          className="absolute right-2 top-2 rounded-full bg-white/92 text-secondary/65 shadow-[0_8px_18px_rgba(50,50,50,0.16)] hover:text-primary"
        >
          <Heart className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
      <h3 className="mt-3 truncate font-heading text-[15px] font-bold leading-none text-secondary">
        {tour.title}
      </h3>
      <p className="mt-1 font-sans text-[11px] leading-none text-secondary/70">
        {tour.duration}
      </p>
      <p className="mt-2 font-sans text-[13px] font-bold leading-none text-secondary">
        {"\u20b9"}
        {tour.amount}
      </p>
    </article>
  );
}

export default function HolidayCartPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf8f4] text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="My Holiday Cart" />

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
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#fbf8f4_0%,#fbf8f4_46%,rgba(251,248,244,0.78)_68%,rgba(251,248,244,0.58)_100%)]" />
              <div className="relative">
                <h1 className="font-heading text-[30px] font-bold leading-none text-secondary sm:text-[34px]">
                  My Holiday Cart
                </h1>
                <p className="mt-3 font-sans text-[13px] font-medium text-secondary/70">
                  Your pending bookings are shown here
                </p>
              </div>
            </section>

            <section className="rounded-[8px] border border-[#eadfd6] bg-white p-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex h-6 items-center rounded-[4px] border border-primary bg-white px-3 font-sans text-[10px] font-bold uppercase text-primary">
                      Group Tour
                    </span>
                    <span className="inline-flex h-6 items-center rounded-[4px] bg-primary px-3 font-sans text-[10px] font-bold uppercase text-white">
                      AKFP
                    </span>
                  </div>

                  <h2 className="mt-4 font-heading text-[22px] font-bold leading-tight text-secondary">
                    USA East Coast (Joining & Leaving)
                  </h2>

                  <div className="mt-6 grid gap-4">
                    {cartDetails.map((detail) => (
                      <DetailRow key={detail.label} detail={detail} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-6 lg:items-end">
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      aria-label="Move to wishlist"
                      variant="outline"
                      size="icon-lg"
                      className="text-secondary/70 hover:text-primary"
                    >
                      <Heart className="size-5" strokeWidth={1.8} />
                    </Button>
                    <Button
                      type="button"
                      aria-label="Remove from cart"
                      variant="outline"
                      size="icon-lg"
                      className="text-secondary/70 hover:text-primary"
                    >
                      <Trash2 className="size-5" strokeWidth={1.8} />
                    </Button>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="font-sans text-[13px] font-medium text-secondary/65">
                      Total Amount
                    </p>
                    <p className="mt-2 font-sans text-[28px] font-bold leading-none text-secondary sm:text-[32px]">
                      {"\u20b9"}4,68,000
                    </p>
                  </div>

                  <a
                    href="#"
                    className={buttonVariants({
                      className: "w-full justify-between gap-4 px-6 font-normal sm:w-[255px]",
                    })}
                  >
                    Continue Booking
                    <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                  </a>
                </div>
              </div>
            </section>

            <section className="relative mt-4 overflow-hidden rounded-[8px] border border-[#eadfd6] bg-[#fff7ef] px-4 py-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-5 sm:px-7 sm:py-5">
              <Image
                src="/home assets/Heritage Banner.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 500px, 100vw"
                className="pointer-events-none object-cover object-right opacity-[0.15] mix-blend-multiply"
              />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-primary shadow-[0_10px_22px_rgba(212,114,32,0.14)]">
                  <ShieldCheck className="size-6" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-[17px] font-bold text-secondary">
                    Secure Your Spot
                  </h2>
                  <p className="mt-2 max-w-[610px] font-sans text-[12px] leading-[1.45] text-secondary/72">
                    Complete your booking now to lock in the best prices and availability.
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-[8px] border border-[#eadfd6] bg-white p-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-[18px] font-bold text-secondary">
                    You May Also Like
                  </h2>
                  <p className="mt-2 font-sans text-[12px] text-secondary/70">
                    Handpicked experiences for your next adventure.
                  </p>
                </div>
                <a
                  href="#"
                  className={buttonVariants({
                    variant: "link",
                    className: "h-auto gap-2 p-0 font-medium",
                  })}
                >
                  View All Tours
                  <ButtonArrow className="h-2.5 w-5 group-hover/button:translate-x-0.5" />
                </a>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {suggestions.map((tour) => (
                  <SuggestionCard key={tour.title} tour={tour} />
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
