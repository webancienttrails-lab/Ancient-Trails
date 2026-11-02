"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getHomeMediaUrl } from "@/lib/home-travel";
import styles from "./events-section.module.css";

export type HomeEventCard = {
  id: string;
  title: string;
  image: string;
  href: string;
  sortOrder: number;
};

export function EventsSection({
  enabled,
  events,
}: {
  enabled: boolean;
  events: HomeEventCard[];
}) {
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const sortedEvents = [...events].sort((left, right) => left.sortOrder - right.sortOrder);

  useEffect(() => {
    if (!carousel) return;
    const updateSelected = () => setSelected(carousel.selectedScrollSnap());
    updateSelected();
    carousel.on("select", updateSelected).on("reInit", updateSelected);
    return () => {
      carousel.off("select", updateSelected).off("reInit", updateSelected);
    };
  }, [carousel]);

  if (!enabled || sortedEvents.length === 0) return null;

  return (
    <section
      aria-label="Featured events"
      aria-roledescription="carousel"
      className={styles.section}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (event.key === "ArrowLeft") carousel?.scrollPrev();
          else carousel?.scrollNext();
        }
      }}
    >
      <div className={styles.frame}>
        <div className={styles.viewport} ref={viewportRef}>
          <div className={styles.track}>
            {sortedEvents.map((event, index) => {
              const image = (
                <img src={getHomeMediaUrl(event.image)} alt={event.title || `Featured event ${index + 1}`} className={styles.image} loading="lazy" draggable={false} />
              );
              return (
                <div key={event.id} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${sortedEvents.length}`} aria-hidden={index !== selected} inert={index !== selected}>
                  {image}
                </div>
              );
            })}
          </div>
        </div>
        {sortedEvents.length > 1 && (
          <>
            <button type="button" onClick={() => carousel?.scrollPrev()} aria-label="Previous event" className={`${styles.arrow} ${styles.previous}`}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" onClick={() => carousel?.scrollNext()} aria-label="Next event" className={`${styles.arrow} ${styles.next}`}>
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {sortedEvents.length > 1 && (
        <div className={styles.dots} aria-label="Choose event">
          {sortedEvents.map((event, index) => (
            <button key={event.id} type="button" onClick={() => carousel?.scrollTo(index)} aria-label={`Show event ${index + 1}${event.title ? `: ${event.title}` : ""}`} aria-current={selected === index ? "true" : undefined} className={styles.dot} />
          ))}
        </div>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">Event {selected + 1} of {sortedEvents.length}</span>
    </section>
  );
}
