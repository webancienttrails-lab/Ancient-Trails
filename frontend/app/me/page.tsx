import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown, Play } from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { DashboardBookingsOverview } from "@/components/user-dashboard/dashboard-bookings-overview";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";
import { getDestinationsHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "My Dashboard",
};

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
    <main className="min-h-screen overflow-x-clip bg-background text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1380px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
            <DashboardBookingsOverview />

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
