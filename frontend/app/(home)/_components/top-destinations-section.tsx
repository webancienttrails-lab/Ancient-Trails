import Image from "next/image";
import {
  CalendarDays,
  MapPin,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { TextReveal } from "./reveal-on-view";

const popularDestinations = [
  {
    name: "Jaipur",
    state: "Rajasthan",
    image: "/home assets/destination/hawa-mahal.webp",
  },
  {
    name: "Udaipur",
    state: "Rajasthan",
    image: "/home assets/destination/Udaipur.webp",
  },
  {
    name: "Varanasi",
    state: "Uttar Pradesh",
    image: "/home assets/destination/Varanasi.webp",
  },
  {
    name: "Hampi",
    state: "Karnataka",
    image: "/home assets/destination/Hampi.webp",
  },
  {
    name: "Khajuraho",
    state: "Madhya Pradesh",
    image: "/home assets/Khajuraho.webp",
  },
  {
    name: "Varanasi",
    state: "Uttar Pradesh",
    image: "/home assets/destination/Varanasi.webp",
  },
  {
    name: "Hampi",
    state: "Karnataka",
    image: "/home assets/destination/Hampi.webp",
  },
  {
    name: "Khajuraho",
    state: "Madhya Pradesh",
    image: "/home assets/Khajuraho.webp",
  },
];

const jaipurHighlights = [
  "Top Attraction",
  "12+ Places",
  "Best Time",
  "Oct - Mar",
  "Popular Tours",
];

export function TopDestinationsSection() {
  return (
    <section className="bg-background py-10">
      <div className="mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <div className="grid items-start gap-8 lg:grid-cols-[330px_1px_1fr_auto] lg:items-end">
          <div>
            <TextReveal>
              <div>
                <div className="mb-3 flex items-center gap-3 text-primary">
                  <p className="text-description font-medium uppercase">
                    Explore India
                  </p>
                </div>
                <h2 className="font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
                  <span className="block">Top Trending</span>
                  <span className="block text-primary">Destinations</span>
                </h2>
                <div className="relative mt-2 h-[22px] w-[154px]">
                  <Image
                    src="/home assets/destination/Destination_bottom.webp"
                    alt=""
                    fill
                    sizes="154px"
                    className="object-contain"
                  />
                </div>
              </div>
            </TextReveal>
          </div>

          <div className="hidden h-[82px] w-px bg-secondary/40 lg:block" />

          <TextReveal delay={160}>
            <p className="max-w-none text-description italic text-secondary lg:max-w-[260px]">
              Pick a place to visit in the cradle of diverse culture.
            </p>
          </TextReveal>

          <Button className="h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-8 sm:px-6 sm:text-button lg:min-w-[230px]">
            View all destinations
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>

        <div className="relative mt-6 min-h-[360px] overflow-visible lg:min-h-[600px]">
          <div className="absolute left-0 top-4 z-10 hidden w-[250px] lg:block">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <h3 className="font-sans text-description font-bold text-secondary">
                  Popular Destinations
                </h3>
                <span className="h-px w-5 bg-primary" />
              </div>

              <div className="space-y-2">
                {popularDestinations.map((destination, index) => (
                  <article
                    key={`${destination.name}-${destination.state}-${index}`}
                    className="flex items-center gap-3 border-b border-border/80 pb-2 last:border-b-0"
                  >
                    <div className="relative h-[44px] w-[82px] shrink-0 overflow-hidden rounded-[5px]">
                      <Image
                        src={destination.image}
                        alt={destination.name}
                        fill
                        sizes="82px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-sans text-description font-bold leading-none text-secondary">
                        {destination.name}
                      </h4>
                      <p className="mt-1 text-[13px] leading-none text-secondary/70">
                        {destination.state}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mx-auto h-[330px] w-full max-w-[900px] sm:h-[430px] lg:h-[535px] lg:-translate-x-5">
            <Image
              src="/home assets/Map.webp"
              alt="Top destinations map of India"
              fill
              sizes="(min-width: 1024px) 900px, 100vw"
              className="scale-[1.0] object-contain object-center"
            />
          </div>

          <div className="absolute right-0 top-0 z-10 hidden w-[300px] lg:block">
            <div className="rounded-[10px] border border-primary/15 bg-white p-3 shadow-[0_14px_34px_rgba(50,50,50,0.12)]">
              <button
                type="button"
                aria-label="Close Jaipur card"
                className="absolute right-5 top-5 z-10 grid size-6 place-items-center rounded-full bg-white text-secondary shadow-[0_4px_12px_rgba(50,50,50,0.2)]"
              >
                <X className="size-4" strokeWidth={2} />
              </button>

              <div className="relative h-[128px] overflow-hidden rounded-[6px]">
                <Image
                  src="/home assets/destination/hawa-mahal.webp"
                  alt="Jaipur palace"
                  fill
                  sizes="245px"
                  className="object-cover"
                />
              </div>

              <div className="px-1 pb-2 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-[24px] font-bold leading-none text-secondary">
                      Jaipur
                    </h3>
                    <p className="mt-1 text-description font-medium text-primary">
                      Rajasthan
                    </p>
                  </div>
                  <span className="rounded-[4px] border border-primary/20 px-2 py-1 text-[11px] font-semibold text-primary">
                    Heritage
                  </span>
                </div>

                <p className="mt-3 text-[12px] leading-[1.45] text-secondary">
                  The Pink City of India, known for its royal palaces, forts,
                  vibrant bazaars and rich cultural heritage.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {jaipurHighlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-center gap-2 text-[11px] font-medium text-secondary"
                    >
                      {highlight.includes("Oct") ? (
                        <CalendarDays className="size-3.5 text-primary" />
                      ) : (
                        <MapPin className="size-3.5 text-primary" />
                      )}
                      {highlight}
                    </div>
                  ))}
                </div>

                <Button className="mt-4 h-10 w-full justify-between px-5 text-[13px] font-normal">
                  Explore Jaipur
                  <ButtonArrow className="h-3 w-6 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="overflow-hidden rounded-[4px] border border-border bg-white shadow-[0_8px_20px_rgba(50,50,50,0.1)]">
                <button
                  type="button"
                  aria-label="Zoom in"
                  className="grid size-8 place-items-center border-b border-border text-secondary"
                >
                  <Plus className="size-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  className="grid size-8 place-items-center text-secondary"
                >
                  <Minus className="size-4" strokeWidth={2} />
                </button>
              </div>

              <div className="relative size-[96px]">
                <Image
                  src="/home assets/destination/North_d.webp"
                  alt="Map direction compass"
                  fill
                  sizes="96px"
                  className="object-contain opacity-75 mix-blend-multiply contrast-90 saturate-75"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
