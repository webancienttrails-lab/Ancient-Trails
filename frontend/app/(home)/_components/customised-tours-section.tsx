"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, ButtonArrow } from "@/components/ui/button";
import {
  fallbackCustomisedTours,
  type HomeCustomisedTourCard,
} from "@/lib/home-travel";
import { getDestinationHref, getTourCalendarHref } from "@/lib/routes";
import { RevealOnView, TextReveal } from "./reveal-on-view";

const customisedTourLayouts = [
  {
    className: "lg:h-[285px]",
    sizes: "(min-width: 1280px) 250px, (min-width: 1024px) 23vw, (min-width: 768px) 50vw, 100vw",
  },
  {
    className: "lg:h-[330px]",
    sizes: "(min-width: 1280px) 260px, (min-width: 1024px) 23vw, (min-width: 768px) 50vw, 100vw",
  },
  {
    className: "lg:h-[250px]",
    sizes: "(min-width: 1280px) 220px, (min-width: 1024px) 23vw, (min-width: 768px) 50vw, 100vw",
  },
];

type CustomisedTourCardProps = {
  className: string;
  activeIndex: number;
  sizes: string;
  tours: HomeCustomisedTourCard[];
};

function mergeWithFallbackCustomisedTours(tours: HomeCustomisedTourCard[]) {
  const merged = [...tours];
  const usedKeys = new Set(
    merged.map((tour) => tour.destinationId || tour.title.toLowerCase())
  );

  fallbackCustomisedTours.forEach((tour) => {
    const key = tour.destinationId || tour.title.toLowerCase();

    if (merged.length < 6 && !usedKeys.has(key)) {
      merged.push(tour);
      usedKeys.add(key);
    }
  });

  return merged.slice(0, 6);
}

function CustomisedTourCard({
  activeIndex,
  className,
  sizes,
  tours,
}: CustomisedTourCardProps) {
  const visibleIndex = tours[activeIndex] ? activeIndex : 0;

  return (
    <div
      className={`relative min-h-[260px] w-full overflow-hidden rounded-[10px] lg:min-h-0 ${className}`}
    >
      {tours.map((tour, index) => (
        <Link
          key={`${tour.destinationId || tour.title}-${index}`}
          href={getDestinationHref({
            destinationId: tour.destinationId,
            destinationName: tour.title,
          })}
          aria-hidden={index !== visibleIndex}
          tabIndex={index === visibleIndex ? 0 : -1}
          className={`absolute inset-0 block overflow-hidden rounded-[10px] transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            index === visibleIndex
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <Image
            src={tour.image}
            alt={`${tour.title} customised tour`}
            fill
            sizes={sizes}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-transparent to-secondary/10" />
          <h3 className="absolute left-4 top-4 font-sans text-description font-bold uppercase leading-none text-white">
            {tour.title}
          </h3>
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 lg:gap-2">
            {tour.tags.map((tag, tagIndex) => (
              <span
                key={`${tag}-${tagIndex}`}
                className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-primary"
              >
                {tag} +
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function CustomisedToursSection({
  destinations = fallbackCustomisedTours,
}: {
  destinations?: HomeCustomisedTourCard[];
}) {
  const displayedTours = useMemo(
    () => mergeWithFallbackCustomisedTours(destinations),
    [destinations]
  );
  const tourSlots = useMemo(
    () =>
      customisedTourLayouts.map((_layout, index) =>
        [displayedTours[index], displayedTours[index + 3]].filter(
          (tour): tour is HomeCustomisedTourCard => Boolean(tour)
        )
      ),
    [displayedTours]
  );
  const sectionRef = useRef<HTMLElement>(null);
  const [isSectionReady, setIsSectionReady] = useState(false);
  const [activeTourIndex, setActiveTourIndex] = useState(0);
  const hasAlternatingTours = tourSlots.some((slot) => slot.length > 1);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section || isSectionReady) {
      return;
    }

    const reveal = () => setIsSectionReady(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frameId = window.requestAnimationFrame(reveal);

      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      {
        rootMargin: "0px 0px -25% 0px",
        threshold: 0.25,
      }
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, [isSectionReady]);

  useEffect(() => {
    if (!isSectionReady || !hasAlternatingTours) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveTourIndex((currentIndex) => (currentIndex === 0 ? 1 : 0));
    }, 4200);

    return () => window.clearInterval(interval);
  }, [hasAlternatingTours, isSectionReady]);

  return (
    <section
      id="customised-tours"
      ref={sectionRef}
      className="overflow-hidden bg-[#fbf0e8] py-14 lg:py-16"
    >
      <div className="relative mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <div className="relative z-10 grid gap-10 md:grid-cols-2 lg:grid-cols-[minmax(250px,330px)_repeat(3,minmax(0,1fr))] lg:items-start lg:gap-x-8 xl:grid-cols-[330px_250px_260px_220px] xl:justify-between xl:gap-x-[44px]">
          <div className="lg:pt-1">
            <TextReveal visible={isSectionReady}>
              <p className="text-description font-medium uppercase text-primary">
                Customised Tours
              </p>
            </TextReveal>
            <TextReveal delay={120} visible={isSectionReady}>
              <h2 className="mt-2 max-w-[330px] font-heading text-title font-bold leading-none text-secondary">
                Find your perfect experience
              </h2>
            </TextReveal>
            <TextReveal delay={240} visible={isSectionReady}>
              <p className="mt-6 max-w-[290px] text-description italic text-secondary/75">
                Have a route in mind, or just an interest you want to follow?
                Share your destination, dates and budget with us.
              </p>
            </TextReveal>
            <TextReveal delay={340} visible={isSectionReady}>
              <p className="mt-6 text-description italic text-secondary/75">
                Let us plan for you!
              </p>
            </TextReveal>
          </div>

          <div>
            <RevealOnView visible={isSectionReady}>
              <CustomisedTourCard
                activeIndex={activeTourIndex}
                className={customisedTourLayouts[0].className}
                sizes={customisedTourLayouts[0].sizes}
                tours={tourSlots[0]}
              />
            </RevealOnView>

            <div className="mt-7">
              <span className="mb-4 block h-px w-[72px] bg-primary" />
              <TextReveal delay={180} visible={isSectionReady}>
                <p className="max-w-[220px] text-description italic text-secondary/75">
                  Pick your interests &amp; explore suitable destinations
                </p>
              </TextReveal>
            </div>

            <Button
              nativeButton={false}
              render={<Link href={getTourCalendarHref()} />}
              className="mt-11 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:px-6 sm:text-button lg:min-w-[200px]"
            >
              Customise your tour
              <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>

          <div className="lg:pt-[28px]">
            <div className="mb-8">
              <span className="mb-4 block h-px w-[76px] bg-primary" />
              <TextReveal delay={220} visible={isSectionReady}>
                <p className="max-w-[215px] text-description italic text-secondary/75">
                  Share your ideas with us, so that we can plan your tour
                </p>
              </TextReveal>
            </div>

            <RevealOnView delay={160} visible={isSectionReady}>
              <CustomisedTourCard
                activeIndex={activeTourIndex}
                className={customisedTourLayouts[1].className}
                sizes={customisedTourLayouts[1].sizes}
                tours={tourSlots[1]}
              />
            </RevealOnView>
          </div>

          <div className="lg:pt-[21px]">
            <RevealOnView delay={280} visible={isSectionReady}>
              <CustomisedTourCard
                activeIndex={activeTourIndex}
                className={customisedTourLayouts[2].className}
                sizes={customisedTourLayouts[2].sizes}
                tours={tourSlots[2]}
              />
            </RevealOnView>

            <div className="mt-8">
              <span className="mb-4 block h-px w-[76px] bg-primary" />
              <TextReveal delay={360} visible={isSectionReady}>
                <p className="max-w-[190px] text-description italic text-secondary/75">
                  Need an expert guide? We got you covered!
                </p>
              </TextReveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
