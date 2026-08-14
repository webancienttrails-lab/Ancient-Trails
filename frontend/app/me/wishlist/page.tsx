import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe2,
  Heart,
  Info,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";
import { getTourCalendarHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "My Wishlist",
};

const wishlistTours = [
  {
    title: "Highlights of Thailand",
    image: "/home assets/Vietnam.webp",
    code: "AKTP",
    tone: "bg-[#fff2e9] text-primary border-primary/35",
    tag: "Popular",
    tagTone: "border-primary/35 bg-primary/10 text-primary",
    days: "4 Days",
    countries: "1 Country",
    cities: "2 Cities",
    highlights:
      "Alcazar Show, Coral Island, Gems Gallery, Scientific Thai Marine Park...",
    price: "64,000",
    emi: "6,232",
  },
  {
    title: "European Highlights",
    image: "/home assets/Haridwar.webp",
    code: "EURP",
    tone: "bg-[#fff2e9] text-primary border-primary/35",
    tag: "Bestseller",
    tagTone: "border-accent/35 bg-accent/10 text-accent",
    days: "8 Days",
    countries: "3 Countries",
    cities: "5 Cities",
    highlights:
      "Eiffel Tower, Swiss Mountains, Venice Gondola Ride, Colosseum Tour...",
    price: "1,95,000",
    emi: "18,932",
  },
  {
    title: "Egypt - Land of Pharaohs",
    image: "/home assets/Egypt.webp",
    code: "EGYP",
    tone: "bg-[#fff2e9] text-primary border-primary/35",
    tag: "New",
    tagTone: "border-primary/35 bg-primary/10 text-primary",
    days: "6 Days",
    countries: "1 Country",
    cities: "3 Cities",
    highlights:
      "Pyramids of Giza, Nile Cruise, Karnak Temple, Abu Simbel...",
    price: "1,35,000",
    emi: "12,876",
  },
];

const tourMeta = [
  { key: "days", icon: Clock3 },
  { key: "countries", icon: Globe2 },
  { key: "cities", icon: Building2 },
  { key: "dates", icon: CalendarDays, label: "Dates" },
] as const;

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-medium text-secondary/72">
      <Icon className="size-3.5 shrink-0 text-secondary/60" strokeWidth={1.8} />
      {children}
    </span>
  );
}

function WishlistCard({ tour }: { tour: (typeof wishlistTours)[number] }) {
  const tourHref = getTourCalendarHref({ tour: { title: tour.title } });

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
          variant="outline"
          size="icon-lg"
          className="absolute right-3 top-3 rounded-full bg-white/95 text-primary shadow-[0_10px_22px_rgba(50,50,50,0.16)]"
        >
          <Heart className="size-5 fill-current" strokeWidth={0} />
        </Button>
      </div>

      <div className="min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-[4px] border border-primary bg-white px-3 font-sans text-[10px] font-bold uppercase text-primary">
            Group Tour
          </span>
          <span
            className={`inline-flex h-6 items-center rounded-[4px] border px-3 font-sans text-[10px] font-bold uppercase ${tour.tone}`}
          >
            {tour.code}
          </span>
          <span
            className={`inline-flex h-6 items-center rounded-[4px] border px-3 font-sans text-[10px] font-semibold ${tour.tagTone}`}
          >
            {tour.tag}
          </span>
        </div>

        <h2 className="mt-3 font-heading text-[22px] font-bold leading-tight text-secondary">
          {tour.title}
        </h2>

        <Link
          href={tourHref}
          className="mt-3 inline-flex items-center gap-1.5 font-sans text-[12px] font-bold text-primary underline-offset-4 hover:underline"
        >
          All Inclusive
          <Info className="size-3.5" strokeWidth={1.9} />
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {tourMeta.map((item) => (
            <MetaItem key={item.key} icon={item.icon}>
              {item.key === "dates" ? item.label : tour[item.key]}
            </MetaItem>
          ))}
          <ChevronRight className="size-4 text-secondary/55" strokeWidth={2} />
        </div>

        <div className="mt-5">
          <p className="font-sans text-[12px] font-bold text-primary">
            Tour Highlights
          </p>
          <p className="mt-2 line-clamp-2 font-sans text-[12px] leading-[1.55] text-secondary/75">
            {tour.highlights}
          </p>
          <Link
            href={tourHref}
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
            {"\u20b9"}
            {tour.price}
          </p>
          <p className="mt-5 font-sans text-[11px] font-medium text-secondary/60">
            EMI from
          </p>
          <p className="mt-1 font-sans text-[16px] font-bold leading-none text-secondary">
            {"\u20b9"}
            {tour.emi}
            <span className="font-medium text-secondary/65"> /month</span>
          </p>
        </div>

        <div className="mt-6">
          <Link
            href={tourHref}
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
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
            Remove from Wishlist
          </button>
        </div>
      </aside>
    </article>
  );
}

export default function WishlistPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff8f0] text-secondary lg:overflow-x-visible">
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

                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <span className="font-sans text-[12px] font-medium text-secondary/65">
                    Sort by:
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 justify-between gap-3 px-4 text-[12px] font-medium sm:flex-none"
                  >
                    Recently Added
                    <ChevronDown className="size-4" strokeWidth={1.9} />
                  </Button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:gap-5">
              {wishlistTours.map((tour) => (
                <WishlistCard key={tour.title} tour={tour} />
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
