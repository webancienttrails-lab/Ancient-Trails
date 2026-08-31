"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Compass, Landmark, MapPin, Users } from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { getDestinationHref } from "@/lib/routes";
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
    focus: "",
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
    focus: "",
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
    focus: "",
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
    focus: "",
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
    focus: "",
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
    focus: "",
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
    focus: "",
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
    focus: "",
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

const fallbackTourCategories = [
  "Heritage",
  "Monuments",
  "Temples",
  "Adventure",
  "Architecture",
  "Culture",
  "Nature",
  "Festival Trails",
];

function getDestinationHighlights(destination: TopDestination) {
  return [
    {
      icon: Landmark,
      label: "Top Attraction",
    },
    {
      icon: MapPin,
      label: destination.duration || "Popular Trail",
    },
    {
      icon: Compass,
      label: "Best Time",
    },
    {
      icon: Landmark,
      label: "Heritage Focus",
    },
    {
      icon: Users,
      label: "Popular Tours",
    },
  ];
}

function getTourCategoryLabels(value: string) {
  const seen = new Set<string>();
  const labels = value
    .split(/[,/|]+/)
    .map((label) => label.trim())
    .filter((label) => {
      const key = label.toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
  const fallbackValue = value.trim();

  return labels.length > 0 ? labels : fallbackValue ? [fallbackValue] : [];
}

function getCompactTourCategoryLabel(labels: string[]) {
  if (labels.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function getUniqueTourCategories(categories: string[]) {
  const seen = new Set<string>();

  return categories.filter((category) => {
    const key = category.trim().toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function TourCategorySlider({ categories }: { categories: string[] }) {
  const displayedCategories = getUniqueTourCategories(categories);
  const sliderCategories =
    displayedCategories.length > 0 ? displayedCategories : fallbackTourCategories;
  const trackCategories = [...sliderCategories, ...sliderCategories];

  return (
    <div className="mt-10 mb-6 overflow-hidden">
      <div className="flex w-max items-center gap-5 motion-safe:animate-[tour-category-slide_34s_linear_infinite] motion-reduce:flex-wrap">
        {trackCategories.map((category, index) => (
          <span
            key={`${category}-${index}`}
            className="inline-flex h-9 min-w-[118px] items-center justify-center rounded-full bg-[#f4f4f4] px-6 font-sans text-[14px] font-medium leading-none text-secondary/62"
          >
            {category}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes tour-category-slide {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

function MapPushPin({ active }: { active?: boolean }) {
  return (
    <span className="pointer-events-none relative block h-8 w-5">
      <span
        className={cn(
          "absolute left-1/2 top-0 z-10 size-4 -translate-x-1/2 rounded-full shadow-[0_4px_8px_rgba(155,59,19,0.26)]",
          active
            ? "bg-[radial-gradient(circle_at_68%_24%,#ffffff_0_7%,#f7b56c_16%,#d47220_52%,#9b3b13_100%)]"
            : "bg-[radial-gradient(circle_at_68%_24%,#ffffff_0_7%,#f4a15a_16%,#d47220_54%,#9b3b13_100%)]"
        )}
      >
        <span className="absolute right-1 top-0.5 size-1.5 rounded-full bg-white/80 blur-[0.5px]" />
      </span>
      <span className="absolute left-1/2 top-[15px] h-[17px] w-[1.5px] -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-300 via-stone-500 to-stone-700 shadow-[1px_2px_3px_rgba(50,50,50,0.22)]" />
      <span
        className={cn(
          "absolute left-1/2 top-[13px] -z-10 size-6 -translate-x-1/2 rounded-full bg-primary/15 transition-transform duration-500",
          active ? "scale-125 opacity-100" : "scale-75 opacity-0"
        )}
      />
    </span>
  );
}

export function TopDestinationsSection({
  destinations = topDestinations,
  tourCategories = fallbackTourCategories,
}: {
  destinations?: TopDestination[];
  tourCategories?: string[];
}) {
  const displayedDestinations = useMemo(() => {
    const sourceDestinations =
      destinations.length > 0 ? destinations : topDestinations;

    return sourceDestinations.slice(0, 8);
  }, [destinations]);
  const initialDestinationId = displayedDestinations.some(
    (destination) => destination.destinationId === defaultDestinationId
  )
    ? defaultDestinationId
    : displayedDestinations[0]?.destinationId || topDestinations[0].destinationId;
  const [activeDestinationId, setActiveDestinationId] =
    useState(initialDestinationId);

  const activeDestination =
    displayedDestinations.find(
      (destination) => destination.destinationId === activeDestinationId
    ) || displayedDestinations[0] || topDestinations[0];
  const activeHighlights = getDestinationHighlights(activeDestination);
  const activeTourCategoryLabels = getTourCategoryLabels(activeDestination.focus);

  function selectDestination(destinationId: string) {
    if (destinationId === activeDestination.destinationId) {
      return;
    }

    setActiveDestinationId(destinationId);
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
                <h2 className="font-heading text-title font-bold leading-none text-secondary">
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

          <Button
            nativeButton={false}
            render={<Link href="/destinations" />}
            className="h-11 w-full min-w-0 justify-center gap-3 px-5 text-[15px] font-normal sm:w-auto sm:px-6 sm:text-button lg:min-w-[230px]"
          >
            View all destinations
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>

        <TourCategorySlider categories={tourCategories} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
          <aside className="pt-4">
            <div className="mb-5 flex items-center gap-3">
              <h3 className="font-sans text-description font-bold text-secondary">
                Popular Destinations
              </h3>
              <span className="h-px w-5 bg-primary" />
            </div>

            <div className="grid gap-2">
              {displayedDestinations.map((destination, index) => {
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
              className="object-contain object-center mix-blend-multiply"
            />

            {displayedDestinations.map((destination, index) => {
              const isActive =
                destination.destinationId === activeDestination.destinationId;
              const showBelow = destination.markerY < 24;
              const alignLeft = destination.markerX < 28;
              const alignRight = destination.markerX > 72;

              return (
                <button
                  key={`map-${destination.destinationId}-${index}`}
                  type="button"
                  aria-label={`Show ${destination.name}`}
                  onClick={() => selectDestination(destination.destinationId)}
                  onFocus={() => selectDestination(destination.destinationId)}
                  onMouseEnter={() => selectDestination(destination.destinationId)}
                  className={cn(
                    "group absolute grid h-8 w-5 -translate-x-1/2 -translate-y-full origin-bottom place-items-end transition-transform duration-300 hover:z-40 hover:scale-110 focus-visible:z-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                    isActive ? "z-40 scale-110" : "z-10"
                  )}
                  style={{
                    left: `${destination.markerX}%`,
                    top: `${destination.markerY}%`,
                  }}
                >
                  <MapPushPin active={isActive} />
                  <span
                    className={cn(
                      "pointer-events-none absolute z-30 w-[160px] translate-y-0 rounded-[8px] border border-primary/15 bg-white p-2 text-center opacity-0 shadow-[0_16px_34px_rgba(50,50,50,0.16)] transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
                      showBelow ? "top-full mt-3" : "bottom-full mb-3",
                      !isActive && (showBelow ? "translate-y-1" : "-translate-y-1"),
                      isActive && "opacity-100",
                      alignLeft
                        ? "left-0"
                        : alignRight
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute size-3 rotate-45 border-primary/15 bg-white",
                        showBelow
                          ? "-top-[7px] border-l border-t"
                          : "-bottom-[7px] border-b border-r",
                        alignLeft
                          ? "left-5"
                          : alignRight
                            ? "right-5"
                            : "left-1/2 -translate-x-1/2"
                      )}
                    />
                    <span className="relative z-10 block min-w-0">
                      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-muted shadow-sm">
                        <Image
                          src={destination.image}
                          alt=""
                          fill
                          sizes="144px"
                          className="object-cover"
                        />
                      </span>
                      <span className="mt-2 block truncate font-sans text-[13px] font-bold leading-tight text-secondary">
                        {destination.name}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="h-[550px] sm:h-[496px] lg:h-[500px]">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[10px] border border-primary/15 bg-white p-3 ">
              <div className="relative h-[128px] shrink-0 overflow-hidden rounded-[6px]">
                <Image
                  src={activeDestination.tourImage || activeDestination.image}
                  alt={`${activeDestination.name} tour`}
                  fill
                  sizes="245px"
                  className="object-cover"
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-1 pb-2 pt-4">
                <h3 className="line-clamp-2 min-h-[30px] break-words font-heading text-[24px] font-bold leading-tight text-secondary">
                  {activeDestination.name}
                </h3>
                <p className="mt-1 min-h-[27px] break-words font-sans text-description font-medium text-primary">
                  {activeDestination.state}
                </p>
                {activeTourCategoryLabels.length > 0 ? (
                  <span
                    title={activeTourCategoryLabels.join(", ")}
                    className="mt-3 inline-flex h-8 min-w-0 max-w-full items-center rounded-[4px] border border-primary/20 px-2 font-sans text-[13px] font-semibold leading-none text-primary"
                  >
                    <span className="min-w-0 truncate">
                      {getCompactTourCategoryLabel(activeTourCategoryLabels)}
                    </span>
                  </span>
                ) : null}

                <p className="mt-3 min-h-[60px] line-clamp-3 font-sans text-[13px] leading-[1.45] text-secondary">
                  {activeDestination.description}
                </p>

                <div className="mt-4 grid min-h-[80px] grid-cols-2 gap-x-4 gap-y-2.5">
                  {activeHighlights.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex min-w-0 items-center gap-2 font-sans text-[13px] font-medium text-secondary"
                    >
                      <Icon className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>

                <Button
                  nativeButton={false}
                  render={<Link href={getDestinationHref(activeDestination)} />}
                  className="mt-auto h-10 w-full justify-between px-5 text-[13px] font-normal"
                >
                  Explore {activeDestination.name}
                  <ButtonArrow className="h-3 w-6 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
