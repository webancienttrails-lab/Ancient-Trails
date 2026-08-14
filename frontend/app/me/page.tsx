import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  MapPin,
  Play,
  XCircle,
} from "lucide-react";

import { Button, ButtonArrow, buttonVariants } from "@/components/ui/button";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";
import { getDestinationsHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "My Dashboard",
};

const dashboardStats = [
  {
    label: "Upcoming",
    description: "Trips booked",
    value: "0",
    icon: BriefcaseBusiness,
    tone: "bg-primary/12 text-primary",
  },
  {
    label: "Completed",
    description: "Trips completed",
    value: "0",
    icon: ClipboardCheck,
    tone: "bg-accent/10 text-accent",
  },
  {
    label: "Cancelled",
    description: "Trips cancelled",
    value: "0",
    icon: XCircle,
    tone: "bg-secondary/10 text-secondary/70",
  },
  {
    label: "Wishlist",
    description: "Saved for later",
    value: "0",
    icon: Bookmark,
    tone: "bg-primary/12 text-primary",
  },
];

const exploreDestinations = [
  {
    title: "Rajasthan",
    subtitle: "Royal Heritage",
    image: "/home assets/destination/hawa-mahal.webp",
  },
  {
    title: "Varanasi",
    subtitle: "Spiritual Journey",
    image: "/home assets/destination/Varanasi.webp",
  },
  {
    title: "Hampi",
    subtitle: "Historical Wonders",
    image: "/home assets/destination/Hampi.webp",
  },
  {
    title: "Kerala",
    subtitle: "Backwaters",
    image: "/home assets/Haridwar.webp",
  },
  {
    title: "Himalayan Escape",
    subtitle: "Scenic Beauty",
    image: "/home assets/destination/North_d.webp",
  },
];

function StatCard({
  stat,
  index,
}: {
  stat: (typeof dashboardStats)[number];
  index: number;
}) {
  const Icon = stat.icon;

  return (
    <article
      className={`flex items-center gap-2 px-1.5 py-2 sm:gap-4 sm:px-3 ${
        index > 0 ? "lg:border-l lg:border-border" : ""
      }`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-full sm:size-16 ${stat.tone}`}>
        <Icon className="size-5 sm:size-7" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[28px] font-bold leading-none text-secondary sm:text-[34px]">
          {stat.value}
        </p>
        <p className="mt-1.5 font-sans text-[12px] font-semibold leading-none text-secondary sm:mt-2 sm:text-[15px]">
          {stat.label}
        </p>
        <p className="mt-1 truncate font-sans text-[11px] text-secondary/70 sm:text-[13px]">
          {stat.description}
        </p>
      </div>
    </article>
  );
}

function DestinationCard({
  destination,
}: {
  destination: (typeof exploreDestinations)[number];
}) {
  return (
    <Link
      href={getDestinationsHref(destination.title)}
      className="w-[126px] shrink-0 min-w-0 snap-start sm:w-auto sm:shrink"
    >
      <div className="relative h-[62px] overflow-hidden rounded-[7px] sm:h-[68px]">
        <Image
          src={destination.image}
          alt={`${destination.title} destination`}
          fill
          sizes="(min-width: 1280px) 120px, (min-width: 640px) 180px, 45vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/45 via-transparent to-transparent" />
      </div>
      <h3 className="mt-2 truncate font-sans text-[12px] font-semibold leading-none text-secondary sm:text-[13px]">
        {destination.title}
      </h3>
      <p className="mt-1 truncate font-sans text-[10px] leading-none text-secondary/65 sm:text-[11px]">
        {destination.subtitle}
      </p>
    </Link>
  );
}

export default function MePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#fff8f0] text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1380px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
            <section className="grid grid-cols-2 gap-3 rounded-[8px] border border-border bg-white p-3 shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:gap-4 sm:p-4 lg:grid-cols-4 lg:p-5">
              {dashboardStats.map((stat, index) => (
                <StatCard key={stat.label} stat={stat} index={index} />
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
                    You have 0 booking with us. Let&apos;s break the ice.
                  </p>
                  <Button
                    nativeButton={false}
                    render={<Link href="/tour-calendar" />}
                    className="mt-7 w-full justify-between gap-4 px-5 font-normal sm:w-auto sm:min-w-[170px] sm:px-6"
                  >
                    Explore Tours
                    <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                  </Button>
                </div>
              </div>
            </section>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[1fr_0.92fr]">
              <section className="overflow-hidden rounded-[8px] border border-border bg-white p-4 shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:p-5">
                <div>
                  <h2 className="font-heading text-[18px] font-bold text-secondary">
                    Continue Exploring
                  </h2>
                  <p className="mt-2 font-sans text-[12px] text-secondary/70">
                    Discover more incredible destinations and experiences.
                  </p>
                </div>

                <div className="relative mt-5">
                  <Button
                    type="button"
                    aria-label="Previous destination"
                    variant="outline"
                    size="icon-sm"
                    className="absolute -left-1 top-[28px] z-10 rounded-full shadow-[0_8px_18px_rgba(50,50,50,0.12)] sm:top-[31px]"
                  >
                    <ChevronDown className="size-3.5 rotate-90" strokeWidth={2} />
                  </Button>
                  <div className="flex snap-x gap-3 overflow-x-auto px-8 pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-5 sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
                    {exploreDestinations.map((destination) => (
                      <DestinationCard key={destination.title} destination={destination} />
                    ))}
                  </div>
                  <Button
                    type="button"
                    aria-label="Next destination"
                    variant="outline"
                    size="icon-sm"
                    className="absolute -right-1 top-[28px] z-10 rounded-full shadow-[0_8px_18px_rgba(50,50,50,0.12)] sm:top-[31px]"
                  >
                    <ChevronDown className="size-3.5 -rotate-90" strokeWidth={2} />
                  </Button>
                </div>
              </section>

              <section className="relative overflow-hidden rounded-[8px] border border-border bg-white p-4 shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:p-7">
                <Image
                  src="/home assets/destination/Udaipur.webp"
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 520px, 100vw"
                  className="pointer-events-none object-cover object-right opacity-35"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_44%,rgba(255,255,255,0.72)_68%,rgba(255,255,255,0.38)_100%)]" />
                <div className="relative max-w-[360px]">
                  <h2 className="font-heading text-[18px] font-bold text-secondary">
                    Travel Insights
                  </h2>
                  <p className="mt-3 font-sans text-[13px] leading-[1.55] text-secondary/75">
                    Get travel tips, destination guides and expert advice for a
                    memorable journey.
                  </p>
                  <Button
                    nativeButton={false}
                    render={<Link href="/experiences" />}
                    className="mt-6 h-10 w-[calc(100%-54px)] justify-between gap-2 px-4 text-[12px] font-normal sm:mt-7 sm:h-11 sm:w-auto sm:min-w-[270px] sm:gap-4 sm:px-6 sm:text-[14px]"
                  >
                    Watch Pre-departure Videos
                    <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                  </Button>
                </div>
                <Button
                  type="button"
                  aria-label="Play travel insights video"
                  variant="outline"
                  size="icon-lg"
                  className="absolute bottom-5 right-5 rounded-full shadow-[0_12px_28px_rgba(50,50,50,0.18)]"
                >
                  <Play className="ml-0.5 size-4 fill-current" strokeWidth={0} />
                </Button>
              </section>
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}
