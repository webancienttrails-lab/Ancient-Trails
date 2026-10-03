"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Compass, Landmark, MapPin, Users } from "lucide-react";

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
  "Nature",
  "Photography",
  "UNESCO Site",
  "Architecture",
  "Culture",
  "Temples",
  "Festival Trails",
];

const destinationCategoryFallbacks = [
  "Heritage",
  "Nature",
  "Photography",
  "UNESCO Site",
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
    .map((label) => label.replace(/\s*\+\d+\s*$/, "").trim())
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

function getDestinationFallbackCategories(destination: TopDestination) {
  const searchText = [
    destination.name,
    destination.state,
    destination.description,
    destination.landmarks.join(" "),
    destination.tourName,
  ]
    .join(" ")
    .toLowerCase();
  const categories: string[] = [];

  if (
    /heritage|ancient|historic|history|cultural|culture|temple|palace|fort|cave|ghat|sacred|stone|sculpture/.test(
      searchText
    )
  ) {
    categories.push("Heritage");
  }

  if (/nature|lake|river|cliff|landscape|boulder|forest|hill|mountain/.test(searchText)) {
    categories.push("Nature");
  }

  if (/photo|view|sunrise|sunset|graceful|dramatic|sculpture|architecture|palace|lake/.test(searchText)) {
    categories.push("Photography");
  }

  if (/unesco|hampi|khajuraho/.test(searchText)) {
    categories.push("UNESCO Site");
  }

  const fallbackIndex = Math.abs(
    destination.destinationId
      .split("")
      .reduce((total, character) => total + character.charCodeAt(0), 0)
  );

  return getUniqueTourCategories(
    categories.length > 0
      ? categories
      : [
          destinationCategoryFallbacks[
            fallbackIndex % destinationCategoryFallbacks.length
          ],
          "Heritage",
        ]
  ).slice(0, 3);
}

function getDestinationCategoryLabels(destination: TopDestination) {
  const labels = getTourCategoryLabels(destination.focus);

  return labels.length > 0 ? labels : getDestinationFallbackCategories(destination);
}

function getCompactTourCategoryLabel(labels: string[], sourceValue = "") {
  const compactLabel = labels.join(", ");
  const hasHiddenCategories = /\+\d+\s*$/.test(sourceValue.trim());

  if (!hasHiddenCategories) {
    return compactLabel;
  }

  return `${compactLabel}...`;
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
    <span className="pointer-events-none relative block h-6 w-4 lg:h-8 lg:w-5">
      <span
        className={cn(
          "absolute left-1/2 top-0 z-10 size-3 -translate-x-1/2 rounded-full shadow-[0_4px_8px_rgba(155,59,19,0.26)] lg:size-4",
          active
            ? "bg-[radial-gradient(circle_at_68%_24%,#ffffff_0_7%,#f7b56c_16%,#d47220_52%,#9b3b13_100%)]"
            : "bg-[radial-gradient(circle_at_68%_24%,#ffffff_0_7%,#f4a15a_16%,#d47220_54%,#9b3b13_100%)]"
        )}
      >
        <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-white/80 blur-[0.5px] lg:right-1 lg:size-1.5" />
      </span>
      <span className="absolute left-1/2 top-[11px] h-[13px] w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-stone-300 via-stone-500 to-stone-700 shadow-[1px_2px_3px_rgba(50,50,50,0.22)] lg:top-[15px] lg:h-[17px] lg:w-[1.5px]" />
      <span
        className={cn(
          "absolute left-1/2 top-[10px] -z-10 size-5 -translate-x-1/2 rounded-full bg-primary/15 transition-transform duration-500 lg:top-[13px] lg:size-6",
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
  const destinationButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {}
  );

  const activeDestination =
    displayedDestinations.find(
      (destination) => destination.destinationId === activeDestinationId
    ) || displayedDestinations[0] || topDestinations[0];
  const activeHighlights = getDestinationHighlights(activeDestination);
  const activeTourCategoryLabels = getDestinationCategoryLabels(activeDestination);

  function selectDestination(destinationId: string) {
    if (destinationId !== activeDestination.destinationId) {
      setActiveDestinationId(destinationId);
    }

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.requestAnimationFrame(() => {
        destinationButtonRefs.current[destinationId]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      });
    }
  }

  return (
    <section className="overflow-hidden bg-background py-10 lg:overflow-visible">
      <div className="home-wide-frame mx-auto w-full overflow-hidden px-5 sm:px-0 lg:overflow-visible [@media(min-width:1300px)]:px-12">
        <div className="grid items-start gap-5 lg:grid-cols-[330px_1px_minmax(0,1fr)_270px] lg:items-end lg:gap-8">
          <div>
            <TextReveal>
              <div>
                <div className="mb-3 hidden items-center gap-3 text-primary lg:flex">
                  <p className="text-description font-medium uppercase">
                    Explore India
                  </p>
                </div>
                <h2 className="font-heading text-title font-bold leading-[0.94] text-secondary">
                  <span className="block">Top Trending</span>
                  <span className="block text-primary">Destinations</span>
                </h2>
                <div className="relative mt-2 hidden h-[22px] w-[154px] lg:block">
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
            <p className="max-w-[300px] font-sans text-description italic leading-[1.24] text-secondary/72 lg:max-w-[300px]">
              Pick a place to visit in the cradle of diverse culture.
            </p>
          </TextReveal>

          <Button
            nativeButton={false}
            render={<Link href="/destinations" />}
            className="h-12 w-fit min-w-0 justify-between gap-4 rounded-full px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:h-11 lg:min-w-[230px]"
          >
            View All Destinations
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>

        <TourCategorySlider categories={tourCategories} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
          <aside className="order-2 pt-0 lg:order-none lg:pt-4">
            <div className="mb-4 flex items-center justify-between gap-3 lg:mb-5 lg:justify-start">
              <div className="flex items-center gap-3">
                <h3 className="font-sans text-[18px] font-bold text-secondary">
                  Popular Destinations
                </h3>
                <span className="h-px w-5 bg-primary/50" />
              </div>
              <Link
                href="/destinations"
                className="inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-primary lg:hidden"
              >
                See All
                <ButtonArrow className="h-2.5 w-5" />
              </Link>
            </div>

            <div className="-mx-5 flex max-w-[100vw] gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:max-w-none lg:gap-2 lg:overflow-visible lg:px-0 lg:pb-0">
              {displayedDestinations.map((destination, index) => {
                const isActive =
                  destination.destinationId === activeDestination.destinationId;

                return (
                  <button
                    key={`${destination.destinationId}-${index}`}
                    ref={(node) => {
                      destinationButtonRefs.current[destination.destinationId] = node;
                    }}
                    type="button"
                    onClick={() => selectDestination(destination.destinationId)}
                    onFocus={() => selectDestination(destination.destinationId)}
                    onMouseEnter={() =>
                      selectDestination(destination.destinationId)
                    }
                    className={cn(
                      "flex w-[132px] shrink-0 flex-col items-center gap-2 rounded-[8px] border border-border bg-white p-2 text-center shadow-[0_8px_20px_rgba(50,50,50,0.06)] transition-[border-color,opacity,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/45 lg:w-full lg:flex-row lg:items-center lg:gap-3 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:bg-transparent lg:p-0 lg:pb-2 lg:text-left lg:shadow-none lg:last:border-b-0",
                      isActive
                        ? "border-primary/45 opacity-100 shadow-[0_8px_22px_rgba(212,114,32,0.16)] lg:shadow-none"
                        : "opacity-[0.78]"
                    )}
                  >
                    <div className="relative h-[58px] w-full shrink-0 overflow-hidden rounded-[6px] bg-muted lg:h-[44px] lg:w-[82px]">
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
                          "block max-w-full truncate font-sans text-[15px] font-bold leading-none transition-colors lg:text-description",
                          isActive ? "text-primary" : "text-secondary"
                        )}
                      >
                        {destination.name}
                      </span>
                      <span className="mt-1 block max-w-full truncate font-sans text-[13px] leading-none text-secondary/70">
                        {destination.state}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="relative order-1 -mx-5 w-[390px] h-[min(410px,82vw)] overflow-visible lg:order-none lg:mx-auto lg:h-[535px] lg:w-full lg:max-w-[700px] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
            <div className="absolute left-1/2 top-1/2 aspect-[700/535] w-[min(100vw,520px)] -translate-x-1/2 -translate-y-1/2 lg:inset-0 lg:aspect-auto lg:w-full lg:translate-x-0 lg:translate-y-0">
              <Image
                src="/home assets/Map.webp"
                alt="Top destinations map of India"
                fill
                sizes="(min-width: 1024px) 700px, 100vw"
                className="object-contain object-center opacity-100 mix-blend-multiply"
              />

              {displayedDestinations.map((destination, index) => {
                const isActive =
                  destination.destinationId === activeDestination.destinationId;
                const showBelow = destination.markerY < 24;
                const alignLeft = destination.markerX < 28;
                const alignRight = destination.markerX > 72;

                return (
                <Link
                  key={`map-${destination.destinationId}-${index}`}
                  href={getDestinationHref(destination)}
                  aria-label={`Explore ${destination.name}`}
                  onClick={(event) => {
                    if (window.innerWidth < 1024) {
                      event.preventDefault();
                      selectDestination(destination.destinationId);
                    }
                  }}
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
                      "pointer-events-none absolute left-1/2 top-[calc(100%+2px)] z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2 py-1 font-sans text-[10px] font-bold leading-none text-primary opacity-0 shadow-[0_8px_18px_rgba(50,50,50,0.14)] ring-1 ring-primary/15 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 lg:hidden",
                      isActive && "opacity-100"
                    )}
                  >
                    {destination.name}
                  </span>
                  <span
                      className={cn(
                        "pointer-events-auto absolute z-30 hidden w-[160px] translate-y-0 rounded-[8px] border border-primary/15 bg-white p-2 text-center opacity-0 shadow-[0_16px_34px_rgba(50,50,50,0.16)] transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 lg:block",
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
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="order-3 h-auto lg:order-none lg:h-[500px]">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border border-primary/15 bg-white p-3 lg:rounded-[10px] lg:p-3">
              <div className="relative h-[145px] shrink-0 overflow-hidden rounded-[10px] sm:h-[210px] lg:h-[128px] lg:rounded-[6px]">
                <Image
                  src={activeDestination.tourImage || activeDestination.image}
                  alt={`${activeDestination.name} tour`}
                  fill
                  sizes="245px"
                  className="object-cover"
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-1 pb-1 pt-3 lg:pb-2 lg:pt-4">
                <h3 className="line-clamp-2 min-h-0 break-words font-heading text-[25px] font-bold leading-tight text-secondary sm:text-[30px] lg:min-h-[30px] lg:text-[24px]">
                  {activeDestination.name}
                </h3>
                <p className="mt-1 min-h-0 break-words border-b border-primary/20 pb-2 font-sans text-[17px] font-medium text-primary sm:text-[20px] lg:min-h-[27px] lg:pb-1 lg:text-description">
                  {activeDestination.state}
                </p>
                {activeTourCategoryLabels.length > 0 ? (
                  <div className="hidden">
                    <Landmark className="mr-2 size-4" />
                    <span className="font-sans text-[13px] font-semibold">
                      {activeTourCategoryLabels[0] || "World Heritage Site"}
                    </span>
                  </div>
                ) : null}
                {activeTourCategoryLabels.length > 0 ? (
                  <div className="hidden lg:block">
                    <span className="font-sans text-[13px] font-medium leading-none text-secondary mt-2 ">
                      Known for
                    </span>
                    <span
                      title={activeTourCategoryLabels.join(", ")}
                      className="mt-1 inline-flex h-9 min-w-0 max-w-full items-center  font-sans text-[13px] font-semibold leading-none text-primary"
                    >
                      <span className="min-w-0 truncate">
                        {getCompactTourCategoryLabel(
                          activeTourCategoryLabels,
                          activeDestination.focus
                        )}
                      </span>
                    </span>
                  </div>
                ) : null}

                <p className="mt-3 line-clamp-3 min-h-0 font-sans text-[13px] leading-[1.45] text-secondary sm:mt-4 sm:text-[15px] lg:mt-3 lg:min-h-[60px] lg:line-clamp-3 lg:text-[13px]">
                  {activeDestination.description}
                </p>

                <div className="mb-4 mt-4 grid min-h-0 grid-cols-2 gap-x-3 gap-y-2 lg:mt-3 lg:min-h-[70px] lg:gap-x-3 lg:gap-y-1">
                  {activeHighlights.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex min-w-0 items-center gap-2 font-sans text-[12px] font-medium text-secondary sm:text-[14px] lg:text-[13px]"
                    >
                      <Icon className="size-4 shrink-0 text-primary lg:size-3.5" />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>

                <Button
                  nativeButton={false}
                  render={<Link href={getDestinationHref(activeDestination)} />}
                  className="mt-auto h-10 w-full justify-between rounded-full px-5 text-[14px] font-normal sm:h-12 sm:text-[17px] lg:h-10 lg:text-[13px]"
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
