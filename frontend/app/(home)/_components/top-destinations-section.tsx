"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, MapPin, Minus, Plus, X } from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TextReveal } from "./reveal-on-view";

type TopDestination = {
  bestSeason: string;
  description: string;
  destinationId: string;
  duration: string;
  focus: string;
  image: string;
  landmarks: string[];
  markerX: number;
  markerY: number;
  name: string;
  state: string;
  tourImage: string;
  tourName: string;
};

const topDestinations: [TopDestination, ...TopDestination[]] = [
  {
    name: "Badami",
    state: "Karnataka",
    image: "/home assets/Caves.webp",
    destinationId: "BADAMI",
    focus: "Rock Cut Heritage",
    markerX: 50.2,
    markerY: 69.4,
    description:
      "Ancient cave temples, sandstone cliffs and Chalukyan stories shaped by the rugged Deccan landscape.",
    duration: "6+ Places",
    bestSeason: "Oct - Feb",
    landmarks: ["Cave Temples", "6+ Places"],
    tourName: "Explore Badami",
    tourImage: "/home assets/Caves.webp",
  },
  {
    name: "Jaipur",
    state: "Rajasthan",
    image: "/home assets/destination/hawa-mahal.webp",
    destinationId: "JAIPUR",
    focus: "Royal Heritage",
    markerX: 43.3,
    markerY: 42.5,
    description:
      "The Pink City of India, known for royal palaces, forts, vibrant bazaars and layered cultural heritage.",
    duration: "12+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Top Attraction", "12+ Places"],
    tourName: "Explore Jaipur",
    tourImage: "/home assets/destination/hawa-mahal.webp",
  },
  {
    name: "Udaipur",
    state: "Rajasthan",
    image: "/home assets/destination/Udaipur.webp",
    destinationId: "UDAIPUR",
    focus: "Lakes & Palaces",
    markerX: 41.9,
    markerY: 52.1,
    description:
      "A graceful city of lakes, palaces and old-world streets shaped for relaxed heritage travel.",
    duration: "8+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Lake City", "8+ Places"],
    tourName: "Explore Udaipur",
    tourImage: "/home assets/destination/Udaipur.webp",
  },
  {
    name: "Varanasi",
    state: "Uttar Pradesh",
    image: "/home assets/destination/Varanasi.webp",
    destinationId: "VARANASI",
    focus: "Sacred Heritage",
    markerX: 64.1,
    markerY: 49.7,
    description:
      "A timeless riverside destination of ghats, temples, rituals and living cultural memory.",
    duration: "10+ Places",
    bestSeason: "Nov - Feb",
    landmarks: ["Sacred Ghats", "10+ Places"],
    tourName: "Explore Varanasi",
    tourImage: "/home assets/destination/Varanasi.webp",
  },
  {
    name: "Hampi",
    state: "Karnataka",
    image: "/home assets/destination/Hampi.webp",
    destinationId: "HAMPI",
    focus: "UNESCO Heritage",
    markerX: 51.2,
    markerY: 74.8,
    description:
      "A dramatic landscape of ruins, boulders and temple complexes from the Vijayanagara era.",
    duration: "9+ Places",
    bestSeason: "Oct - Feb",
    landmarks: ["UNESCO Site", "9+ Places"],
    tourName: "Explore Hampi",
    tourImage: "/home assets/destination/Hampi.webp",
  },
  {
    name: "Khajuraho",
    state: "Madhya Pradesh",
    image: "/home assets/Khajuraho.webp",
    destinationId: "KHAJURAHO",
    focus: "Temple Art",
    markerX: 58.2,
    markerY: 56.5,
    description:
      "Iconic temples celebrated for sculpture, storytelling and exceptional medieval artistry.",
    duration: "7+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Temple Art", "7+ Places"],
    tourName: "Explore Khajuraho",
    tourImage: "/home assets/Khajuraho.webp",
  },
  {
    name: "Amritsar",
    state: "Punjab",
    image: "/home assets/destination/Amritsar.webp",
    destinationId: "AMRITSAR",
    focus: "Living Heritage",
    markerX: 37.2,
    markerY: 28.2,
    description:
      "A warm northern city shaped by sacred architecture, food traditions and layered history.",
    duration: "6+ Places",
    bestSeason: "Oct - Mar",
    landmarks: ["Sacred City", "6+ Places"],
    tourName: "Explore Amritsar",
    tourImage: "/home assets/destination/Amritsar.webp",
  },
  {
    name: "Hoysalas",
    state: "Karnataka",
    image: "/home assets/destination/Hoysalas.webp",
    destinationId: "HOYSALAS",
    focus: "Temple Architecture",
    markerX: 51.6,
    markerY: 73.1,
    description:
      "Intricate stone temples and sculptural detail across Karnataka's Hoysala heritage belt.",
    duration: "5+ Places",
    bestSeason: "Nov - Feb",
    landmarks: ["Stone Craft", "5+ Places"],
    tourName: "Explore Hoysalas",
    tourImage: "/home assets/destination/Hoysalas.webp",
  },
];

const defaultDestinationId = "HOYSALAS";

function getDestinationHighlights(destination: TopDestination) {
  return [
    destination.landmarks[0] || "Top Attraction",
    destination.duration || "Popular Trail",
    destination.bestSeason || "Best Time",
    destination.tourName || `Explore ${destination.name}`,
  ];
}

export function TopDestinationsSection() {
  const [activeDestinationId, setActiveDestinationId] =
    useState(defaultDestinationId);
  const [isCardChanging, setIsCardChanging] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const activeDestination =
    topDestinations.find(
      (destination) => destination.destinationId === activeDestinationId
    ) || topDestinations[0];
  const activeHighlights = getDestinationHighlights(activeDestination);

  function selectDestination(destinationId: string) {
    if (destinationId === activeDestination.destinationId) {
      return;
    }

    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    setIsCardChanging(true);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setActiveDestinationId(destinationId);
      setIsCardChanging(false);
    }, 120);
  }

  function resetDestinationCard() {
    setActiveDestinationId(defaultDestinationId);
  }

  return (
    <section className="bg-background py-10">
      <div className="mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <div className="grid items-start gap-8 lg:grid-cols-[330px_1px_minmax(0,1fr)_270px] lg:items-end">
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
            <p className="max-w-[300px] font-sans text-description italic text-secondary">
              Pick a place to visit in the cradle of diverse culture.
            </p>
          </TextReveal>

          <Button className="h-11 w-full min-w-0 justify-center gap-3 px-5 text-[15px] font-normal sm:w-auto sm:px-6 sm:text-button lg:min-w-[230px]">
            View all destinations
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
          <aside className="pt-4">
            <div className="mb-5 flex items-center gap-3">
              <h3 className="font-sans text-description font-bold text-secondary">
                Popular Destinations
              </h3>
              <span className="h-px w-5 bg-primary" />
            </div>

            <div className="grid gap-2">
              {topDestinations.map((destination, index) => {
                const isActive =
                  destination.destinationId === activeDestination.destinationId;

                return (
                  <button
                    key={`${destination.destinationId}-${index}`}
                    type="button"
                    onClick={() => selectDestination(destination.destinationId)}
                    onFocus={() => selectDestination(destination.destinationId)}
                    onMouseEnter={() =>
                      selectDestination(destination.destinationId)
                    }
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/80 pb-2 text-left transition-[border-color,opacity,transform] duration-300 last:border-b-0 hover:-translate-y-0.5 hover:border-primary/45",
                      isActive ? "opacity-100" : "opacity-[0.78]"
                    )}
                  >
                    <div className="relative h-[44px] w-[82px] shrink-0 overflow-hidden rounded-[5px] bg-muted">
                      <Image
                        src={destination.image}
                        alt={destination.name}
                        fill
                        sizes="82px"
                        className="object-cover"
                      />
                    </div>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate font-sans text-description font-bold leading-none transition-colors",
                          isActive ? "text-primary" : "text-secondary"
                        )}
                      >
                        {destination.name}
                      </span>
                      <span className="mt-1 block truncate font-sans text-[13px] leading-none text-secondary/70">
                        {destination.state}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="relative mx-auto h-[330px] w-full max-w-[700px] sm:h-[430px] lg:h-[535px]">
            <Image
              src="/home assets/Map.webp"
              alt="Top destinations map of India"
              fill
              sizes="(min-width: 1024px) 700px, 100vw"
              className="object-contain object-center mix-blend-multiply transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.015]"
            />

            {topDestinations.map((destination, index) => {
              const isActive =
                destination.destinationId === activeDestination.destinationId;

              return (
                <button
                  key={`map-${destination.destinationId}-${index}`}
                  type="button"
                  aria-label={`Show ${destination.name}`}
                  onClick={() => selectDestination(destination.destinationId)}
                  onFocus={() => selectDestination(destination.destinationId)}
                  onMouseEnter={() => selectDestination(destination.destinationId)}
                  className={cn(
                    "group absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-primary text-white shadow-[0_8px_18px_rgba(212,114,32,0.32)] transition-[transform,box-shadow,background-color] duration-300 hover:scale-110 hover:shadow-[0_12px_24px_rgba(212,114,32,0.42)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                    isActive ? "size-9" : "size-7"
                  )}
                  style={{
                    left: `${destination.markerX}%`,
                    top: `${destination.markerY}%`,
                  }}
                >
                  <span
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full bg-secondary/18 transition-transform duration-500",
                      isActive ? "scale-[2.1] opacity-100" : "scale-100 opacity-0"
                    )}
                  />
                  <MapPin className={cn("relative", isActive ? "size-5" : "size-4")} />
                  <span className="pointer-events-none absolute left-1/2 top-full mt-1 max-w-[120px] -translate-x-1/2 rounded-full bg-white px-2.5 py-1 font-sans text-[10px] font-bold text-secondary opacity-0 shadow-[0_6px_16px_rgba(50,50,50,0.16)] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    {destination.name}
                  </span>
                </button>
              );
            })}
          </div>

          <aside>
            <div
              className={cn(
                "relative rounded-[10px] border border-primary/15 bg-white p-3 shadow-[0_14px_34px_rgba(50,50,50,0.12)] transition-[opacity,transform,box-shadow] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isCardChanging
                  ? "translate-y-2 opacity-60"
                  : "translate-y-0 opacity-100 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(50,50,50,0.15)]"
              )}
            >
              <button
                type="button"
                aria-label={`Close ${activeDestination.name} card`}
                onClick={resetDestinationCard}
                className="absolute right-5 top-5 z-10 grid size-6 place-items-center rounded-full bg-white text-secondary shadow-[0_4px_12px_rgba(50,50,50,0.2)] transition-colors hover:text-primary"
              >
                <X className="size-4" strokeWidth={2} />
              </button>

              <div className="relative h-[128px] overflow-hidden rounded-[6px]">
                <Image
                  src={activeDestination.tourImage || activeDestination.image}
                  alt={`${activeDestination.name} tour`}
                  fill
                  sizes="245px"
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.05]"
                />
              </div>

              <div className="px-1 pb-2 pt-4">
                <h3 className="break-words font-heading text-[24px] font-bold leading-tight text-secondary">
                  {activeDestination.name}
                </h3>
                <p className="mt-1 break-words font-sans text-description font-medium text-primary">
                  {activeDestination.state}
                </p>
                <span className="mt-3 inline-flex max-w-full rounded-[4px] border border-primary/20 px-2 py-1 font-sans text-[11px] font-semibold leading-snug text-primary">
                  {activeDestination.focus}
                </span>

                <p className="mt-3 line-clamp-3 font-sans text-[12px] leading-[1.45] text-secondary">
                  {activeDestination.description}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {activeHighlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex min-w-0 items-center gap-2 font-sans text-[11px] font-medium text-secondary"
                    >
                      {highlight.includes("-") ? (
                        <CalendarDays className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <MapPin className="size-3.5 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{highlight}</span>
                    </div>
                  ))}
                </div>

                <Button className="mt-4 h-10 w-full justify-between px-5 text-[13px] font-normal">
                  Explore {activeDestination.name}
                  <ButtonArrow className="h-3 w-6 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="overflow-hidden rounded-[5px] border border-border bg-white shadow-[0_8px_20px_rgba(50,50,50,0.1)]">
                <button
                  type="button"
                  aria-label="Zoom in"
                  className="grid size-8 place-items-center border-b border-border text-secondary transition-colors hover:text-primary"
                >
                  <Plus className="size-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  className="grid size-8 place-items-center text-secondary transition-colors hover:text-primary"
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
          </aside>
        </div>
      </div>
    </section>
  );
}
