"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, Heart } from "lucide-react";
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
      className={`group relative block overflow-hidden rounded-[14px] border border-[#ead8c5] bg-secondary shadow-[0_16px_34px_rgba(67,43,27,0.1)] ${className}`}
    >
      <Image
        src={tour.image}
        alt={`${tour.title} tour`}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.08)_0%,rgba(18,12,8,0.16)_45%,rgba(18,12,8,0.76)_100%)]" />
      <span className="absolute bottom-4 left-4 inline-flex h-9 items-center gap-2 rounded-full bg-secondary/72 px-3.5 font-sans text-[13px] font-bold text-white shadow-[0_10px_20px_rgba(35,23,15,0.18)] backdrop-blur">
        <Clock3 className="size-3.5" strokeWidth={2} />
        {tour.duration}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-white/35 bg-secondary/55 text-white shadow-[0_10px_24px_rgba(35,23,15,0.22)] backdrop-blur transition-colors group-hover:bg-primary"
      >
        <Heart className="size-[18px]" strokeWidth={1.9} />
      </span>
      <time className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-sans text-[12px] font-bold text-primary shadow-[0_8px_18px_rgba(35,23,15,0.14)]">
        {tour.date}
      </time>
      <div className="absolute inset-x-0 bottom-16 p-4 text-white">
        <h3 className="line-clamp-2 font-heading text-[22px] font-bold leading-tight">
          {tour.title}
        </h3>
        <span className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 font-sans text-[13px] font-bold text-white transition-colors group-hover:bg-accent">
          Book Now
          <ArrowRight className="ml-2 size-4" strokeWidth={2} />
        </span>
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
    <section id="upcoming-tours" className="bg-background py-10 sm:py-10">
      <div className="mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <div className="grid gap-7 lg:grid-cols-[1.38fr_1.85fr] lg:gap-10">
          <div className="space-y-5">
            <TextReveal>
              <div>
                <p className="text-eyebrow font-medium uppercase text-primary">
                  Explore Upcoming Tours
                </p>
                <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary">
                  Trails Leaving Soon
                </h2>
              </div>
            </TextReveal>

            <RevealOnView motion="scale" rootMargin="0px 0px 320px 0px">
              <TourCard
                tour={tours[0]}
                className="aspect-[1.88/1]"
                sizes="(min-width: 1024px) 410px, 100vw"
              />
            </RevealOnView>

            <div className="grid gap-5 sm:grid-cols-2">
              <RevealOnView delay={220} replay>
                <TourCard
                  tour={tours[3]}
                  className="aspect-[1/1.04]"
                  sizes="(min-width: 1024px) 190px, (min-width: 640px) 50vw, 100vw"
                />
              </RevealOnView>
              <RevealOnView delay={340} replay>
                <TourCard
                  tour={tours[4]}
                  className="aspect-[1/1.04]"
                  sizes="(min-width: 1024px) 190px, (min-width: 640px) 50vw, 100vw"
                />
              </RevealOnView>
            </div>
          </div>

          <div className="space-y-8 lg:pt-6">
            <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-stretch">
              <RevealOnView
                delay={120}
                motion="scale"
                rootMargin="0px 0px 320px 0px"
                className="h-[320px] sm:h-[410px] lg:h-full"
              >
                <TourCard
                  tour={tours[1]}
                  className="h-full"
                  sizes="(min-width: 1024px) 330px, 100vw"
                />
              </RevealOnView>

              <div className="grid gap-5">
                <RevealOnView
                  delay={220}
                  motion="scale"
                  rootMargin="0px 0px 320px 0px"
                >
                  <TourCard
                    tour={tours[2]}
                    className="aspect-[1.4/1]"
                    sizes="(min-width: 1024px) 390px, 100vw"
                  />
                </RevealOnView>
                <RevealOnView delay={460} replay>
                  <TourCard
                    tour={tours[5]}
                    className="aspect-[1.4/1]"
                    sizes="(min-width: 1024px) 390px, 100vw"
                  />
                </RevealOnView>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-center">
              <TextReveal delay={120}>
                <p className="text-description text-accent">
                  Find upcoming tours &amp; explore destinations beyond borders
                </p>
              </TextReveal>
              <div className="flex justify-start lg:justify-end">
                <Button
                  nativeButton={false}
                  render={<Link href="/tour-calendar" />}
                  className="h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-8 sm:px-6 sm:text-button lg:min-w-[230px]"
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
