"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, ButtonArrow } from "@/components/ui/button";
import {
  getHomeUpcomingTours,
  type HomeTourCard,
} from "@/lib/home-travel";
import { getTourHref } from "@/lib/routes";
import { TextReveal } from "./reveal-on-view";

type TourCardProps = {
  className: string;
  sizes: string;
  tour: HomeTourCard;
};

function compactDurationLabel(duration: string) {
  const source = duration.trim();
  const dayNightMatch = source.match(
    /(\d+)\s*(?:days?|d)\b\s*\/?\s*(\d+)\s*(?:nights?|n)\b/i
  );

  if (dayNightMatch) {
    return `${dayNightMatch[1]}D/${dayNightMatch[2]}N`;
  }

  return source.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

function getOrdinalSuffix(day: number) {
  const teenRemainder = day % 100;

  if (teenRemainder >= 11 && teenRemainder <= 13) {
    return "th";
  }

  if (day % 10 === 1) {
    return "st";
  }

  if (day % 10 === 2) {
    return "nd";
  }

  if (day % 10 === 3) {
    return "rd";
  }

  return "th";
}

function formatDepartureDate(value: string) {
  const source = value.trim();

  if (!source || /^coming soon$/i.test(source)) {
    return source || "Coming Soon";
  }

  const formattedDateMatch = source.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+(\d{4})$/i
  );

  if (formattedDateMatch) {
    const day = Number(formattedDateMatch[1]);
    const month = formattedDateMatch[2];
    const year = formattedDateMatch[3];

    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
  }

  const date = new Date(source);

  if (Number.isNaN(date.getTime())) {
    return source;
  }

  const day = date.getDate();
  const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  const year = date.getFullYear();

  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

function TourCard({ tour, className, sizes }: TourCardProps) {
  const formattedDate = formatDepartureDate(tour.date);

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
      <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0)_100%)]" />
      {tour.isBestseller ? (
        <span className="absolute left-2 top-2 rounded-[6px] bg-primary px-2 py-1 font-sans text-[10px] font-bold leading-none text-white shadow-[0_10px_20px_rgba(0,0,0,0.18)] lg:left-3 lg:top-3 lg:text-[11px]">
          BESTSELLER
        </span>
      ) : null}
      <time
        className={`absolute max-w-[calc(100%-1rem)] rounded-full bg-black/28 px-2 py-1 text-right font-sans text-[11px] font-semibold leading-none text-white backdrop-blur-[2px] lg:right-3 lg:top-3 lg:max-w-none lg:bg-transparent lg:px-0 lg:py-0 lg:text-[14px] lg:backdrop-blur-0 ${
          tour.isBestseller
            ? "left-2 top-8 lg:left-auto lg:top-3"
            : "right-2 top-2"
        }`}
      >
        {formattedDate}
      </time>
      <div className="absolute inset-x-0 bottom-2 px-2.5 text-white lg:bottom-3 lg:px-3">
        <h3 className="line-clamp-2 font-sans text-[15px] font-semibold leading-[1.08] sm:text-[17px] lg:line-clamp-1 lg:text-[18px] lg:leading-none">
          {tour.title}
        </h3>
        <span className="mt-1.5 inline-flex h-6 items-center gap-1.5 rounded-full bg-black/68 px-2 font-sans text-[11px] font-normal leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.24)] backdrop-blur-[2px] lg:mt-2 lg:px-2.5 lg:text-[12px]">
          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-white text-secondary">
            <Clock3 className="size-2.5" strokeWidth={2.2} />
          </span>
          {compactDurationLabel(tour.duration)}
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

  const tours = adminTours.slice(0, 6);

  if (tours.length === 0) {
    return null;
  }

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

            <div className="mt-5 grid grid-cols-2 gap-3 lg:hidden">
              {tours.map((tour, index) => (
                <TourCard
                  key={`${tour.tourId}-${tour.date}-${index}`}
                  tour={tour}
                  className={
                    index % 3 === 0
                      ? "col-span-2 h-[190px]"
                      : "h-[180px] sm:h-[200px]"
                  }
                  sizes={index % 3 === 0 ? "100vw" : "50vw"}
                />
              ))}
            </div>

            <div className="mt-4 flex justify-start lg:hidden">
              <Button
                nativeButton={false}
                render={<Link href="/tour-calendar" />}
                className="h-10 w-auto min-w-[220px] justify-between gap-4 px-4 text-[12px] sm:w-auto sm:gap-6 sm:px-5 sm:text-button"
              >
                View Tour Calendar
                <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
              </Button>
            </div>

            <div className="hidden lg:mt-6 lg:block">
              {tours[0] ? (
                <TourCard
                  tour={tours[0]}
                  className="h-[140px] sm:h-[210px] lg:h-auto lg:aspect-[2.24/1]"
                  sizes="(min-width: 1300px) 650px, (min-width: 1024px) 44vw, 100vw"
                />
              ) : null}
            </div>

            <div className="hidden lg:mt-4 lg:grid lg:grid-cols-2 lg:gap-4">
              {tours[3] ? (
                <TourCard
                  tour={tours[3]}
                  className="h-[102px] sm:h-[160px] lg:h-auto lg:aspect-[1.5/1]"
                  sizes="(min-width: 1300px) 325px, (min-width: 1024px) 27vw, (min-width: 640px) 40vw, 100vw"
                />
              ) : null}
              {tours[4] ? (
                <TourCard
                  tour={tours[4]}
                  className="h-[102px] sm:h-[160px] lg:h-auto lg:aspect-[1.5/1]"
                  sizes="(min-width: 1300px) 325px, (min-width: 1024px) 27vw, (min-width: 640px) 40vw, 100vw"
                />
              ) : null}
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-3 sm:gap-4 lg:grid lg:h-full lg:gap-x-4">
            <div className="flex h-full flex-col lg:pt-5">
              {tours[1] ? (
                <TourCard
                  tour={tours[1]}
                  className="h-[156px] sm:h-[220px] lg:h-full lg:flex-1 lg:aspect-auto"
                  sizes="(min-width: 1300px) 410px, (min-width: 1024px) 32vw, 100vw"
                />
              ) : null}
            </div>

            <div className="flex h-full flex-col lg:pt-5">
              {tours[2] ? (
                <TourCard
                  tour={tours[2]}
                  className="h-[102px] sm:h-[160px] lg:h-full lg:flex-1 lg:aspect-auto"
                  sizes="(min-width: 1300px) 500px, (min-width: 1024px) 39vw, 100vw"
                />
              ) : null}

              {tours[5] ? (
                <TourCard
                  tour={tours[5]}
                  className="mt-3 h-[102px] sm:mt-4 sm:h-[160px] lg:h-full lg:flex-1 lg:aspect-auto"
                  sizes="(min-width: 1300px) 500px, (min-width: 1024px) 39vw, 100vw"
                />
              ) : null}

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
