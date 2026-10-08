"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getHomeMediaUrl,
  listPublicTours,
  type PublicTour,
} from "@/lib/home-travel";
import { getTourHref } from "@/lib/routes";

const fallbackTourImage = "/home assets/Khajuraho.webp";
const sliderStep = 320;

function getTourImage(tour: PublicTour) {
  return (
    getHomeMediaUrl(
      tour.thumbnailImage || tour.bannerImage || tour.galleryImages[0] || ""
    ) || fallbackTourImage
  );
}

function TourCard({ tour }: { tour: PublicTour }) {
  return (
    <Link
      href={getTourHref(tour)}
      className="w-[152px] min-w-0 shrink-0 snap-start sm:w-[176px]"
    >
      <div className="relative h-[74px] overflow-hidden rounded-[7px] sm:h-[82px]">
        <Image
          src={getTourImage(tour)}
          alt={`${tour.tourName} tour`}
          fill
          sizes="176px"
          className="object-cover transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/50 via-transparent to-transparent" />
      </div>
      <h3 className="mt-2 line-clamp-2 font-sans text-[12px] font-semibold leading-[1.2] text-secondary sm:text-[13px]">
        {tour.tourName}
      </h3>
      <p className="mt-1 truncate font-sans text-[10px] leading-none text-secondary/65 sm:text-[11px]">
        {[tour.durationDn, tour.category || tour.tourType]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Link>
  );
}

export function DashboardContinueExploring() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tours, setTours] = useState<PublicTour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loopedTours = tours.length > 0 ? [...tours, ...tours, ...tours] : [];

  useEffect(() => {
    let isMounted = true;

    async function loadTours() {
      setIsLoading(true);

      try {
        const response = await listPublicTours();

        if (isMounted) {
          setTours(response.data.tours);
        }
      } catch {
        if (isMounted) {
          setTours([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTours();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;

    if (!scroller || tours.length === 0) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scroller.scrollLeft = scroller.scrollWidth / 3;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [tours.length]);

  function normalizeLoopPosition() {
    const scroller = scrollRef.current;

    if (!scroller || tours.length === 0) {
      return;
    }

    const loopWidth = scroller.scrollWidth / 3;

    if (scroller.scrollLeft < loopWidth * 0.5) {
      scroller.scrollLeft += loopWidth;
    } else if (scroller.scrollLeft > loopWidth * 1.5) {
      scroller.scrollLeft -= loopWidth;
    }
  }

  function scrollTours(direction: number) {
    normalizeLoopPosition();

    scrollRef.current?.scrollBy({
      left: direction * sliderStep,
      behavior: "smooth",
    });
  }

  return (
    <section className="overflow-hidden rounded-[8px] border border-border bg-white p-4 shadow-[0_16px_45px_rgba(50,50,50,0.04)] sm:p-5">
      <div>
        <h2 className="font-heading text-[18px] font-bold text-secondary">
          Continue Exploring
        </h2>
        <p className="mt-2 font-sans text-[12px] text-secondary/70">
          Browse current Ancient Trails tours.
        </p>
      </div>

      <div className="relative mt-5">
        <Button
          type="button"
          aria-label="Previous tours"
          variant="outline"
          size="icon-sm"
          onClick={() => scrollTours(-1)}
          className="absolute -left-1 top-[33px] z-10 rounded-full shadow-[0_8px_18px_rgba(50,50,50,0.12)] sm:top-[37px]"
        >
          <ChevronDown className="size-3.5 rotate-90" strokeWidth={2} />
        </Button>

        <div
          ref={scrollRef}
          className="flex snap-x gap-4 overflow-x-auto px-8 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_item, index) => (
                <div
                  key={`tour-skeleton-${index}`}
                  className="w-[152px] shrink-0 sm:w-[176px]"
                >
                  <div className="h-[74px] animate-pulse rounded-[7px] bg-muted sm:h-[82px]" />
                  <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))
            : loopedTours.map((tour, index) => (
                <TourCard key={`${tour.id}-${index}`} tour={tour} />
              ))}

          {!isLoading && tours.length === 0 ? (
            <p className="px-1 py-8 font-sans text-[13px] font-medium text-secondary/62">
              Current tours will appear here soon.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          aria-label="Next tours"
          variant="outline"
          size="icon-sm"
          onClick={() => scrollTours(1)}
          className="absolute -right-1 top-[33px] z-10 rounded-full shadow-[0_8px_18px_rgba(50,50,50,0.12)] sm:top-[37px]"
        >
          <ChevronDown className="size-3.5 -rotate-90" strokeWidth={2} />
        </Button>
      </div>
    </section>
  );
}
