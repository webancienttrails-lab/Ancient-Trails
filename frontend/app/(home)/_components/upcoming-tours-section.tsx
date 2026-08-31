"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, ButtonArrow } from "@/components/ui/button";
import {
  fallbackUpcomingTours,
  getHomeUpcomingTours,
  type HomeTourCard,
} from "@/lib/home-travel";
import { getTourHref } from "@/lib/routes";
import { RevealOnView, TextReveal } from "./reveal-on-view";

type TourCardProps = {
  className: string;
  sizes: string;
  tour: HomeTourCard;
};

function mergeWithFallbackTours(tours: HomeTourCard[]) {
  const merged = [...tours];
  const usedKeys = new Set(
    merged.map((tour) => `${tour.tourId}-${tour.date}`)
  );

  fallbackUpcomingTours.forEach((tour) => {
    const key = `${tour.tourId}-${tour.date}`;

    if (merged.length < 6 && !usedKeys.has(key)) {
      merged.push(tour);
      usedKeys.add(key);
    }
  });

  return merged.slice(0, 6);
}

function TourCard({ tour, className, sizes }: TourCardProps) {
  return (
    <Link
      href={getTourHref(tour)}
      className={`group relative block overflow-hidden rounded-[10px] bg-secondary  ${className}`}
    >
      <Image
        src={tour.image}
        alt={`${tour.title} tour`}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.04)_0%,rgba(18,12,8,0.14)_46%,rgba(18,12,8,0.82)_100%)]" />
      <time className="absolute right-3 top-3 font-sans text-[14px] font-bold leading-none text-white">
        {tour.date}
      </time>
      <div className="absolute inset-x-0 bottom-3 px-3 text-white">
        <h3 className="line-clamp-1 font-sans text-[18px] font-bold leading-none ">
          {tour.title}
        </h3>
        <p className="mt-1 font-sans text-[12px] font-medium leading-none text-white/95 ">
          {tour.duration}
        </p>
      </div>
    </Link>
  );
}

export function UpcomingToursSection() {
  const [adminTours, setAdminTours] = useState<HomeTourCard[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadTours() {
      try {
        const tours = await getHomeUpcomingTours();

        if (isMounted) {
          setAdminTours(tours);
        }
      } catch {
        if (isMounted) {
          setAdminTours([]);
        }
      }
    }

    loadTours();

    return () => {
      isMounted = false;
    };
  }, []);

  const tours = useMemo(() => mergeWithFallbackTours(adminTours), [adminTours]);

  return (
    <section id="upcoming-tours" className="bg-background py-6 sm:py-8 lg:flex lg:min-h-screen lg:items-center lg:py-7">
      <div className="mx-auto w-full max-w-[1300px] px-5 sm:px-8 2xl:px-0">
        <div className="grid gap-y-5 lg:grid-cols-2 lg:items-stretch lg:gap-x-5 xl:gap-x-6">
          <div>
            <TextReveal>
              <div>
                <p className="text-eyebrow font-medium uppercase tracking-normal text-primary">
                  Explore Upcoming Tours
                </p>
                <h2 className="mt-1 font-sans text-[34px] font-bold leading-none tracking-normal text-title sm:text-[38px] lg:text-[40px]">
                  Trails Leaving Soon
                </h2>
              </div>
            </TextReveal>

            <RevealOnView
              motion="scale"
              rootMargin="0px 0px 320px 0px"
              className="mt-5 lg:mt-6"
            >
              <TourCard
                tour={tours[0]}
                className="h-[140px] sm:h-[210px] lg:h-auto lg:aspect-[2.24/1]"
                sizes="(min-width: 1300px) 650px, (min-width: 1024px) 44vw, 100vw"
              />
            </RevealOnView>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4">
              <RevealOnView delay={220} replay>
                <TourCard
                  tour={tours[3]}
                  className="h-[102px] sm:h-[160px] lg:h-auto lg:aspect-[1.5/1]"
                  sizes="(min-width: 1300px) 325px, (min-width: 1024px) 27vw, (min-width: 640px) 40vw, 100vw"
                />
              </RevealOnView>
              <RevealOnView delay={340} replay>
                <TourCard
                  tour={tours[4]}
                  className="h-[102px] sm:h-[160px] lg:h-auto lg:aspect-[1.5/1]"
                  sizes="(min-width: 1300px) 325px, (min-width: 1024px) 27vw, (min-width: 640px) 40vw, 100vw"
                />
              </RevealOnView>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:h-full lg:gap-x-4">
            <div className="flex h-full flex-col lg:pt-5">
              <RevealOnView
                delay={120}
                motion="scale"
                rootMargin="0px 0px 320px 0px"
                className="lg:flex-1"
              >
                <TourCard
                  tour={tours[1]}
                  className="h-[156px] sm:h-[220px] lg:h-full lg:aspect-auto"
                  sizes="(min-width: 1300px) 410px, (min-width: 1024px) 32vw, 100vw"
                />
              </RevealOnView>

              <TextReveal delay={120}>
                <p className="mt-3 max-w-[260px] font-sans text-[13px] font-medium leading-[1.25] text-accent sm:mt-4 sm:text-[15px] lg:mt-5">
                  Find upcoming tours &amp; explore destinations beyond borders
                </p>
              </TextReveal>
            </div>

            <div className="flex h-full flex-col lg:pt-5">
              <RevealOnView
                delay={220}
                motion="scale"
                rootMargin="0px 0px 320px 0px"
                className="lg:flex-1"
              >
                <TourCard
                  tour={tours[2]}
                  className="h-[102px] sm:h-[160px] lg:h-full lg:aspect-auto"
                  sizes="(min-width: 1300px) 500px, (min-width: 1024px) 39vw, 100vw"
                />
              </RevealOnView>

              <RevealOnView delay={460} replay className="mt-3 sm:mt-4 lg:flex-1">
                <TourCard
                  tour={tours[5]}
                  className="h-[102px] sm:h-[160px] lg:h-full lg:aspect-auto"
                  sizes="(min-width: 1300px) 500px, (min-width: 1024px) 39vw, 100vw"
                />
              </RevealOnView>

              <div className="mt-4 flex justify-start lg:mt-6 lg:justify-end">
                <Button
                  nativeButton={false}
                  render={<Link href="/tour-calendar" />}
                  className="h-10 w-full min-w-0 justify-between gap-2 px-3 text-[12px] sm:w-auto sm:gap-6 sm:px-5 sm:text-button lg:min-w-[220px]"
                >
                  View Tour Calendar
                  <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
