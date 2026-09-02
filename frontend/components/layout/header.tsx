"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Binoculars,
  CalendarCheck,
  Globe2,
  Landmark,
  LogOut,
  MapPin,
  Mountain,
  Plane,
  Route,
  Search,
  User,
  UserRound,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { ButtonArrow } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  clearTravellerSession,
  getTravellerSession,
  listenForTravellerSessionChanges,
  type TravellerUser,
} from "@/lib/auth";
import {
  getHomeMediaUrl,
  listPublicDestinations,
  listPublicExperiences,
  listPublicMegaMenu,
  listPublicTours,
  type PublicDestination,
  type PublicExperience,
  type PublicMegaMenuContent,
  type PublicMegaMenuDestinationReference,
  type PublicMegaMenuTourReference,
  type PublicTour,
} from "@/lib/home-travel";
import {
  getDestinationHref,
  getDestinationsHref,
  getTourHref,
  slugifyRoute,
} from "@/lib/routes";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Tours", href: "/tours" },
  { label: "Destinations", href: "/destinations" },
  { label: "Experiences", href: "/experiences" },
  { label: "Tour Calendar", href: "/tour-calendar" },
];

const headerLayerStyle: CSSProperties = {
  zIndex: 2147483647,
};

const accountMenuItems = [
  {
    title: "My Account",
    description: "Manage your profile & traveller details.",
    href: "/me/account",
    icon: UserRound,
  },
  {
    title: "My Bookings",
    description: "See booking details.",
    href: "/me/bookings",
    icon: CalendarCheck,
  },
];

const tourColumns = [
  {
    title: "Heritage Tours",
    icon: Landmark,
    items: [
      { title: "Kerala Tour", image: "/home assets/Khajuraho.webp", href: getTourHref({ title: "Kerala Tour" }) },
      { title: "Vaishnavdevi", image: "/home assets/destination/Varanasi.webp", href: getTourHref({ title: "Vaishnavdevi" }) },
      { title: "White Spiti", image: "/home assets/destination/North_d.webp", href: getTourHref({ title: "White Spiti" }) },
      { title: "Kashmir", image: "/home assets/Haridwar.webp", href: getTourHref({ title: "Kashmir" }) },
    ],
  },
  {
    title: "Short Trails",
    icon: Mountain,
    items: [
      { title: "Kerala Tour", image: "/home assets/destination/Hampi.webp", href: getTourHref({ title: "Kerala Tour" }) },
      { title: "Vaishnavdevi", image: "/home assets/destination/Udaipur.webp", href: getTourHref({ title: "Vaishnavdevi" }) },
      { title: "White Spiti", image: "/home assets/destination/North_d.webp", href: getTourHref({ title: "White Spiti" }) },
      { title: "Kashmir", image: "/home assets/Haridwar.webp", href: getTourHref({ title: "Kashmir" }) },
    ],
  },
];

const featuredTours = [
  {
    title: "Customised Tours",
    subtitle: "Explore Heritage Beyond Borders",
    image: "/home assets/destination/hawa-mahal.webp",
    icon: Route,
    href: "/destinations",
  },
  {
    title: "Specialised Tours",
    subtitle: "Designed Around Your Interests",
    image: "/home assets/Special_Tour/Assam.png",
    icon: Binoculars,
    href: "/tours",
  },
];

const indianDestinations = [
  {
    title: "North India",
    description: "Jammu & Kashmir, Himachal Pradesh, Uttarakhand, Punjab...",
    image: "/home assets/destination/North_d.webp",
    href: getDestinationsHref("North India"),
  },
  {
    title: "West India",
    description: "Rajasthan, Gujarat, Maharashtra, Goa...",
    image: "/home assets/destination/hawa-mahal.webp",
    href: getDestinationsHref("West India"),
  },
  {
    title: "South India",
    description: "Kerala, Tamil Nadu, Karnataka, Andhra Pradesh...",
    image: "/home assets/destination/Hampi.webp",
    href: getDestinationsHref("South India"),
  },
  {
    title: "East India",
    description: "West Bengal, Odisha, Assam, Sikkim...",
    image: "/home assets/destination/Amritsar.webp",
    href: getDestinationsHref("East India"),
  },
  {
    title: "Central India",
    description: "Madhya Pradesh, Chhattisgarh, Jharkhand...",
    image: "/home assets/Khajuraho.webp",
    href: getDestinationsHref("Central India"),
  },
];

const internationalDestinations = [
  {
    title: "Asia",
    description: "Nepal, Bhutan, Sri Lanka, Thailand, Japan...",
    image: "/home assets/Vietnam.webp",
    href: getDestinationsHref("Asia"),
  },
  {
    title: "Europe",
    description: "France, Italy, Greece, Spain, Switzerland...",
    image: "/home assets/Indonesia.webp",
    href: getDestinationsHref("Europe"),
  },
  {
    title: "Middle East",
    description: "UAE, Jordan, Egypt, Oman, Turkey...",
    image: "/home assets/Egypt.webp",
    href: getDestinationsHref("Middle East"),
  },
  {
    title: "Africa",
    description: "Morocco, South Africa, Kenya, Tanzania...",
    image: "/home assets/Special_Tour/Assam.png",
    href: getDestinationsHref("Africa"),
  },
  {
    title: "Americas",
    description: "USA, Canada, Brazil, Peru, Mexico...",
    image: "/home assets/Combodia.webp",
    href: getDestinationsHref("Americas"),
  },
];

const topCities = [
  {
    title: "Delhi",
    image: "/home assets/destination/Amritsar.webp",
    href: getDestinationsHref("Delhi"),
  },
  {
    title: "Jaipur",
    image: "/home assets/destination/hawa-mahal.webp",
    href: getDestinationsHref("Jaipur"),
  },
  {
    title: "Varanasi",
    image: "/home assets/destination/Varanasi.webp",
    href: getDestinationsHref("Varanasi"),
  },
  {
    title: "Agra",
    image: "/home assets/Khajuraho.webp",
    href: getDestinationsHref("Agra"),
  },
  {
    title: "Dubai",
    image: "/home assets/Egypt.webp",
    href: getDestinationsHref("Dubai"),
  },
  {
    title: "Paris",
    image: "/home assets/Indonesia.webp",
    href: getDestinationsHref("Paris"),
  },
  {
    title: "Cairo",
    image: "/home assets/Egypt.webp",
    href: getDestinationsHref("Cairo"),
  },
  {
    title: "Rome",
    image: "/home assets/destination/Hampi.webp",
    href: getDestinationsHref("Rome"),
  },
];

type TourMenuColumn = (typeof tourColumns)[number];
type DestinationMenuItem = {
  description: string;
  href: string;
  image: string;
  title: string;
};
type CityMenuItem = (typeof topCities)[number];
type HeaderSearchItem = {
  description: string;
  href: string;
  image?: string;
  keywords: string;
  title: string;
  type: string;
};

const staticSearchItems: HeaderSearchItem[] = [
  {
    title: "Home",
    description: "Ancient Trails overview and featured journeys.",
    href: "/",
    keywords: "home ancient trails heritage travel plan trip",
    type: "Page",
  },
  {
    title: "About",
    description: "Our story, mentors and travel philosophy.",
    href: "/about",
    keywords: "about company mentors guides story",
    type: "Page",
  },
  {
    title: "Tours",
    description: "Browse curated heritage tours.",
    href: "/tours",
    keywords: "tours heritage cultural spiritual curated trips",
    type: "Page",
  },
  {
    title: "Destinations",
    description: "Explore Indian and international destinations.",
    href: "/destinations",
    keywords: "destinations places cities india international unesco",
    type: "Page",
  },
  {
    title: "Experiences",
    description: "Traveller stories, moments and memories.",
    href: "/experiences",
    keywords: "experiences traveller reviews stories memories",
    type: "Page",
  },
  {
    title: "Tour Calendar",
    description: "Find upcoming departures and dates.",
    href: "/tour-calendar",
    keywords: "calendar departures dates upcoming tours",
    type: "Page",
  },
];

function hasMegaMenuSettings(content: PublicMegaMenuContent | null) {
  if (!content) {
    return false;
  }

  return (
    content.tourMenu.heritageTours.length > 0 ||
    content.tourMenu.shortTrails.length > 0 ||
    content.destinationMenu.india.length > 0 ||
    content.destinationMenu.international.length > 0 ||
    content.destinationMenu.topCities.length > 0
  );
}

function resolveMegaMenuImage(source: string, fallback: string) {
  return getHomeMediaUrl(source || fallback);
}

function buildTourMenuItems(
  items: PublicMegaMenuTourReference[],
  fallbackImages: string[]
) {
  return items.map((item, index) => ({
    href: getTourHref({
      tourId: item.tourId,
      tourName: item.tourName,
    }),
    image: resolveMegaMenuImage(
      item.image,
      fallbackImages[index % fallbackImages.length] || fallbackImages[0]
    ),
    title: item.tourName,
  }));
}

function buildDestinationMenuItems(
  items: PublicMegaMenuDestinationReference[],
  fallbackImages: string[]
): DestinationMenuItem[] {
  return items.map((item, index) => ({
    description: item.description,
    href:
      item.href ||
      (item.destinationId
        ? getDestinationHref({
            destinationId: item.destinationId,
            destinationName: item.destinationName,
          })
        : getDestinationsHref(item.title || item.destinationName)),
    image: resolveMegaMenuImage(
      item.image,
      fallbackImages[index % fallbackImages.length] || fallbackImages[0]
    ),
    title: item.title || item.destinationName,
  }));
}

function buildCityMenuItems(
  items: PublicMegaMenuDestinationReference[],
  fallbackImages: string[]
): CityMenuItem[] {
  return items.map((item, index) => ({
    href: getDestinationHref({
      destinationId: item.destinationId,
      destinationName: item.destinationName,
    }),
    image: resolveMegaMenuImage(
      item.image,
      fallbackImages[index % fallbackImages.length] || fallbackImages[0]
    ),
    title: item.city || item.destinationName,
  }));
}

function getExperienceHref(experience: PublicExperience) {
  const routeValue =
    slugifyRoute(experience.destinationName) ||
    slugifyRoute(experience.title || "") ||
    experience.destinationId ||
    experience.experienceId;

  return `/experiences/${encodeURIComponent(routeValue)}`;
}

function uniqueSearchItems(items: HeaderSearchItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.href}-${item.title}`.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function getTourSearchItem(tour: PublicTour): HeaderSearchItem {
  return {
    title: tour.tourName,
    description:
      tour.description ||
      [tour.durationDn, tour.category, tour.bestSeason].filter(Boolean).join(" | "),
    href: getTourHref(tour),
    image: getHomeMediaUrl(
      tour.thumbnailImage || tour.bannerImage || tour.galleryImages[0] || ""
    ),
    keywords: [
      tour.tourId,
      tour.tourName,
      tour.tourType,
      tour.destinationId,
      tour.destinationIds.join(" "),
      tour.durationDn,
      tour.category,
      tour.difficulty,
      tour.bestSeason,
      tour.description,
      tour.notes,
    ].join(" "),
    type: "Tour",
  };
}

function getDestinationSearchItem(
  destination: PublicDestination
): HeaderSearchItem {
  return {
    title: destination.destinationName,
    description:
      destination.shortDescription ||
      [destination.state, destination.countryRegion].filter(Boolean).join(", "),
    href: getDestinationHref(destination),
    image: getHomeMediaUrl(
      destination.thumbnailImage ||
        destination.bannerImage ||
        destination.galleryImages[0] ||
        ""
    ),
    keywords: [
      destination.destinationId,
      destination.destinationName,
      destination.destinationType,
      destination.countryRegion,
      destination.region,
      destination.state,
      destination.city,
      destination.primaryHeritageFocus,
      destination.bestTimeToVisit,
      destination.keyLandmarks.join(" "),
      destination.shortDescription,
      destination.unescoSite ? "unesco world heritage" : "",
    ].join(" "),
    type: "Destination",
  };
}

function getExperienceSearchItem(
  experience: PublicExperience
): HeaderSearchItem {
  return {
    title: experience.title || experience.destinationName || "Traveller Experience",
    description:
      experience.writtenReview ||
      `Traveller experience in ${experience.destinationName}`,
    href: getExperienceHref(experience),
    image: getHomeMediaUrl(
      experience.travellerPhotoGallery[0] ||
        experience.attractionPhotoGallery[0]?.image ||
        ""
    ),
    keywords: [
      experience.experienceId,
      experience.destinationId,
      experience.destinationName,
      experience.travellerName,
      experience.title,
      experience.writtenReview,
      experience.thingsToKnow.join(" "),
    ].join(" "),
    type: "Experience",
  };
}

function getMegaMenuSearchItems(
  content: PublicMegaMenuContent | null
): HeaderSearchItem[] {
  if (!content) {
    return [];
  }

  return [
    ...content.tourMenu.heritageTours.map((tour) => ({
      title: tour.tourName,
      description: "Heritage tour",
      href: getTourHref({
        tourId: tour.tourId,
        tourName: tour.tourName,
      }),
      image: getHomeMediaUrl(tour.image),
      keywords: [tour.tourId, tour.tourName, tour.description].join(" "),
      type: "Tour",
    })),
    ...content.tourMenu.shortTrails.map((tour) => ({
      title: tour.tourName,
      description: "Short trail",
      href: getTourHref({
        tourId: tour.tourId,
        tourName: tour.tourName,
      }),
      image: getHomeMediaUrl(tour.image),
      keywords: [tour.tourId, tour.tourName, tour.description].join(" "),
      type: "Tour",
    })),
    ...[
      ...content.destinationMenu.india,
      ...content.destinationMenu.international,
      ...content.destinationMenu.topCities,
    ].map((destination) => ({
      title: destination.title || destination.destinationName,
      description: destination.description || destination.city || "Destination",
      href: destination.destinationId
        ? getDestinationHref({
            destinationId: destination.destinationId,
            destinationName: destination.destinationName,
          })
        : getDestinationsHref(destination.title || destination.destinationName),
      image: getHomeMediaUrl(destination.image),
      keywords: [
        destination.referenceId,
        destination.destinationId,
        destination.destinationName,
        destination.title,
        destination.city,
        destination.description,
      ].join(" "),
      type: "Destination",
    })),
  ];
}

function filterSearchItems(items: HeaderSearchItem[], query: string) {
  const searchTerms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (searchTerms.length === 0) {
    return [];
  }

  return items
    .map((item) => {
      const haystack = `${item.title} ${item.description} ${item.keywords}`
        .toLowerCase()
        .replace(/\s+/g, " ");
      const score = searchTerms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0
      );

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item)
    .slice(0, 8);
}

function MenuArrow({ className = "" }: { className?: string }) {
  return <ArrowRight className={`size-4 ${className}`} strokeWidth={1.8} />;
}

function megaTextRevealClass(isOpen: boolean, className = "") {
  return `${className} transform-gpu transition-[opacity,transform,filter] duration-[820ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    isOpen ? "translate-y-0 opacity-100 blur-0" : "translate-y-1.5 opacity-0 blur-[1px]"
  }`;
}

function megaTextRevealStyle(isOpen: boolean, delay = 0): CSSProperties {
  return { transitionDelay: isOpen ? `${delay}ms` : "0ms" };
}

type DestinationLink = {
  title: string;
  description: string;
  href: string;
  image: string;
};

function DestinationListItem({
  item,
  isOpen,
  delay,
}: {
  item: DestinationLink;
  isOpen: boolean;
  delay: number;
}) {
  return (
    <li>
      <Link
        href={item.href}
        className="group/destination grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-[5px] py-1 pr-1 text-secondary transition-colors hover:text-primary"
      >
        <span className="relative h-[54px] overflow-hidden rounded-[5px] bg-muted ring-1 ring-primary/10">
          <Image
            src={item.image}
            alt=""
            fill
            sizes="72px"
            className="object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/destination:scale-105"
          />
        </span>
        <span
          className={megaTextRevealClass(isOpen, "block min-w-0")}
          style={megaTextRevealStyle(isOpen, delay)}
        >
          <span className="block font-sans text-description font-semibold leading-[1.2] text-secondary transition-colors group-hover/destination:text-primary">
            {item.title}
          </span>
          <span className="mt-1 block font-sans text-[12px] font-medium leading-[1.3] text-secondary/75">
            {item.description}
          </span>
        </span>
      </Link>
    </li>
  );
}

function DestinationSection({
  icon: Icon,
  title,
  subtitle,
  items,
  footer,
  footerHref,
  isOpen,
  baseDelay = 0,
}: {
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  items: DestinationLink[];
  footer: string;
  footerHref: string;
  isOpen: boolean;
  baseDelay?: number;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-5" strokeWidth={1.7} />
        </span>
        <div>
          <h3
            className={megaTextRevealClass(
              isOpen,
              "font-heading text-[16px] font-bold leading-[1.15] text-secondary"
            )}
            style={megaTextRevealStyle(isOpen, baseDelay)}
          >
            {title}
          </h3>
          <p
            className={megaTextRevealClass(
              isOpen,
              "mt-1 font-sans text-[12px] font-medium leading-[1.2] text-secondary/70"
            )}
            style={megaTextRevealStyle(isOpen, baseDelay + 45)}
          >
            {subtitle}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item, index) => (
          <DestinationListItem
            key={item.title}
            item={item}
            isOpen={isOpen}
            delay={baseDelay + 110 + index * 55}
          />
        ))}
      </ul>

      <Link
        href={footerHref}
        className={megaTextRevealClass(
          isOpen,
          "mt-4 flex items-center justify-between font-sans text-[14px] font-bold text-primary"
        )}
        style={megaTextRevealStyle(isOpen, baseDelay + 410)}
      >
        {footer}
        <MenuArrow />
      </Link>
    </div>
  );
}

function CityTile({
  city,
  isOpen,
  delay,
}: {
  city: (typeof topCities)[number];
  isOpen: boolean;
  delay: number;
}) {
  return (
    <Link
      href={city.href}
      className="group/city relative h-[72px] overflow-hidden rounded-[7px] bg-muted shadow-[0_8px_18px_rgba(50,50,50,0.1)]"
    >
      <Image
        src={city.image}
        alt={`${city.title} destination`}
        fill
        sizes="115px"
            className="object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/city:scale-105"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/15 to-transparent" />
      <span
        className={megaTextRevealClass(
          isOpen,
          "absolute bottom-2 left-2 font-sans text-[13px] font-semibold text-white"
        )}
        style={megaTextRevealStyle(isOpen, delay)}
      >
        {city.title}
      </span>
    </Link>
  );
}

export function DestinationsMegaMenu({
  cityItems = topCities,
  indianItems = indianDestinations,
  internationalItems = internationalDestinations,
  isOpen,
  onMouseEnter,
  onMouseLeave,
}: {
  cityItems?: CityMenuItem[];
  indianItems?: DestinationMenuItem[];
  internationalItems?: DestinationMenuItem[];
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      style={headerLayerStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute left-0 right-0 top-[calc(100%+12px)] z-[2147483647] mx-auto w-full max-w-[1300px] origin-top transition-[opacity,transform,filter] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none -translate-y-1.5 scale-[0.99] opacity-0 blur-[1px]"
      }`}
    >
      <div className="overflow-hidden rounded-[10px] border border-primary/25 bg-white shadow-[0_28px_80px_rgba(35,24,16,0.3)] ring-1 ring-white/80">
        <div className="grid min-h-[445px] lg:grid-cols-[240px_1fr_1fr_280px]">
          <div className="relative overflow-hidden bg-[#fff4ea] p-7">
            <p
              className={megaTextRevealClass(
                isOpen,
                "font-sans text-description font-semibold leading-none text-accent"
              )}
              style={megaTextRevealStyle(isOpen, 60)}
            >
              Explore Destinations
            </p>
            <span className="mt-5 block h-px w-8 bg-primary" />
            <p
              className={megaTextRevealClass(
                isOpen,
                "mt-5 max-w-[170px] font-sans text-[14px] font-normal leading-[1.5] text-secondary"
              )}
              style={megaTextRevealStyle(isOpen, 120)}
            >
              From India&apos;s living heritage to cultural landmarks around
              the world, find the trail that calls you next.
            </p>
            <Image
              src="/home assets/About_trails.webp"
              alt=""
              fill
              sizes="240px"
              aria-hidden="true"
              className="pointer-events-none translate-y-24 object-cover object-left-bottom opacity-10 mix-blend-multiply"
            />
            <Link
              href={getDestinationsHref("UNESCO sites")}
              className="group/button relative mt-[210px] flex h-9 w-[192px] items-center justify-between gap-2 rounded-full border border-primary bg-white px-3 font-sans text-[12px] font-semibold text-primary shadow-[0_8px_18px_rgba(212,114,32,0.16)] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white"
            >
              <span
                className={megaTextRevealClass(isOpen, "whitespace-nowrap")}
                style={megaTextRevealStyle(isOpen, 280)}
              >
                View UNESCO sites
              </span>
              <ButtonArrow className="h-2.5 w-6 shrink-0 group-hover/button:brightness-0 group-hover/button:invert" />
            </Link>
          </div>

          <DestinationSection
            icon={Plane}
            title="India"
            subtitle="Explore Incredible India"
            items={indianItems}
            footer="View all Indian states"
            footerHref={getDestinationsHref("India")}
            isOpen={isOpen}
            baseDelay={110}
          />

          <div className="border-l border-primary/25">
            <DestinationSection
              icon={Globe2}
              title="International"
              subtitle="Discover the World"
              items={internationalItems}
              footer="View all countries"
              footerHref={getDestinationsHref("International")}
              isOpen={isOpen}
              baseDelay={170}
            />
          </div>

          <div className="border-l border-primary/25 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                <MapPin className="size-5" strokeWidth={1.7} />
              </span>
              <div>
                <h3
                  className={megaTextRevealClass(
                    isOpen,
                    "font-heading text-[16px] font-bold leading-[1.15] text-secondary"
                  )}
                  style={megaTextRevealStyle(isOpen, 230)}
                >
                  Top Cities
                </h3>
                <p
                  className={megaTextRevealClass(
                    isOpen,
                    "mt-1 font-sans text-[12px] font-medium leading-[1.2] text-secondary/70"
                  )}
                  style={megaTextRevealStyle(isOpen, 275)}
                >
                  Popular Cities Worldwide
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {cityItems.map((city, index) => (
                <CityTile
                  key={city.title}
                  city={city}
                  isOpen={isOpen}
                  delay={320 + index * 35}
                />
              ))}
            </div>

            <Link
              href={getDestinationsHref("Popular cities")}
              className={megaTextRevealClass(
                isOpen,
                "mt-4 flex items-center justify-between font-sans text-[14px] font-bold text-primary"
              )}
              style={megaTextRevealStyle(isOpen, 620)}
            >
              View all cities
              <MenuArrow />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToursMegaMenu({
  featuredItems = featuredTours,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  tourMenuColumns = tourColumns,
}: {
  featuredItems?: typeof featuredTours;
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  tourMenuColumns?: TourMenuColumn[];
}) {
  return (
    <div
      style={headerLayerStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute left-0 right-0 top-[calc(100%+12px)] z-[2147483647] mx-auto w-full max-w-[1300px] origin-top transition-[opacity,transform,filter] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none -translate-y-1.5 scale-[0.99] opacity-0 blur-[1px]"
      }`}
    >
      <div className="grid min-h-[330px] overflow-hidden rounded-[10px] border border-primary/25 bg-white shadow-[0_28px_80px_rgba(35,24,16,0.3)] ring-1 ring-white/80 lg:grid-cols-[210px_repeat(4,minmax(0,1fr))] xl:grid-cols-[240px_repeat(4,minmax(0,1fr))]">
        <div className="relative overflow-hidden bg-[#fff4ea] p-6 xl:p-7">
          <p
            className={megaTextRevealClass(
              isOpen,
              "font-sans text-description font-semibold leading-none text-accent"
            )}
            style={megaTextRevealStyle(isOpen, 60)}
          >
            Our Tours
          </p>
          <span className="mt-3 block h-px w-8 bg-primary" />
          <p
            className={megaTextRevealClass(
              isOpen,
              "mt-4 max-w-[175px] font-sans text-[14px] font-normal leading-[1.5] text-secondary"
            )}
            style={megaTextRevealStyle(isOpen, 120)}
          >
            Ancient Trails is for travellers who want more than sightseeing.
          </p>
          <span className="mt-5 block h-px w-8 bg-primary" />
          <p
            className={megaTextRevealClass(
              isOpen,
              "mt-4 max-w-[175px] font-sans text-[14px] font-normal leading-[1.5] text-secondary"
            )}
            style={megaTextRevealStyle(isOpen, 180)}
          >
            Each tour blends history, culture and leisure, with experts who
            help you understand every place beyond the usual route.
          </p>
          <Image
            src="/home assets/About_trails.webp"
            alt=""
            fill
            sizes="230px"
            aria-hidden="true"
            className="pointer-events-none object-cover object-left-bottom opacity-10 mix-blend-multiply"
          />
          <Link
            href="/tour-calendar"
            className="group/button relative mt-8 flex h-9 w-full max-w-[170px] items-center justify-between gap-4 rounded-full border border-primary bg-white px-5 font-sans text-[13px] font-semibold text-primary shadow-[0_8px_18px_rgba(212,114,32,0.16)] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white"
          >
            <span
              className={megaTextRevealClass(isOpen, "whitespace-nowrap")}
              style={megaTextRevealStyle(isOpen, 280)}
            >
              Plan your trip
            </span>
            <ButtonArrow className="h-2.5 w-7 shrink-0 group-hover/button:brightness-0 group-hover/button:invert" />
          </Link>
        </div>

        {tourMenuColumns.map(({ title, icon: Icon, items }, columnIndex) => {
          const baseDelay = 120 + columnIndex * 70;

          return (
          <div
            key={title}
            className="min-w-0 border-l border-primary/25 px-5 py-6 xl:px-6"
          >
            <div className="flex min-h-[44px] min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <h3
                className={megaTextRevealClass(
                  isOpen,
                  "min-w-0 font-sans text-[16px] font-semibold leading-[1.15] text-secondary"
                )}
                style={megaTextRevealStyle(isOpen, baseDelay)}
              >
                {title}
              </h3>
            </div>

            <ul className="mt-5 space-y-4">
              {items.map((item, index) => (
                <li key={`${title}-${item.title}`}>
                  <Link
                    href={item.href}
                    className="group/tour grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 font-sans text-description font-medium leading-[1.25] text-secondary transition-colors hover:text-primary"
                  >
                    <span className="relative size-[52px] shrink-0 overflow-hidden rounded-[5px] bg-muted ring-1 ring-primary/10">
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="52px"
                        className="object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/tour:scale-105"
                      />
                    </span>
                    <span
                      className={megaTextRevealClass(isOpen)}
                      style={megaTextRevealStyle(
                        isOpen,
                        baseDelay + 95 + index * 55
                      )}
                    >
                      {item.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/tour-calendar"
              className={megaTextRevealClass(
                isOpen,
                "mt-8 inline-flex flex-col font-sans text-[14px] font-bold text-primary"
              )}
              style={megaTextRevealStyle(isOpen, baseDelay + 380)}
            >
              And more +
              <span className="mt-2 h-px w-8 bg-primary" />
            </Link>
          </div>
          );
        })}

        {featuredItems.map(({ title, subtitle, image, icon: Icon, href }, columnIndex) => {
          const baseDelay = 260 + columnIndex * 70;

          return (
          <div
            key={title}
            className="min-w-0 border-l border-primary/25 px-5 py-6 xl:px-6"
          >
            <div className="flex min-h-[44px] min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <h3
                className={megaTextRevealClass(
                  isOpen,
                  "min-w-0 font-sans text-[16px] font-semibold leading-[1.15] text-secondary"
                )}
                style={megaTextRevealStyle(isOpen, baseDelay)}
              >
                {title}
              </h3>
            </div>

            <Link
              href={href}
              className="group/feature mt-5 block"
            >
              <span className="relative block h-[180px] overflow-hidden rounded-[7px] bg-muted ring-1 ring-primary/10 xl:h-[190px]">
                <Image
                  src={image}
                  alt={`${title} preview`}
                  fill
                  sizes="205px"
                  className="object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/feature:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-secondary/35 to-transparent" />
              </span>
              <span className="mt-6 flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span
                    className={megaTextRevealClass(
                      isOpen,
                      "block font-sans text-description font-bold leading-[1.15] text-primary"
                    )}
                    style={megaTextRevealStyle(isOpen, baseDelay + 170)}
                  >
                    {title}
                  </span>
                  <span
                    className={megaTextRevealClass(
                      isOpen,
                      "mt-1 block max-w-[170px] font-sans text-[14px] font-normal leading-[1.25] text-secondary"
                    )}
                    style={megaTextRevealStyle(isOpen, baseDelay + 220)}
                  >
                    {subtitle}
                  </span>
                </span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary text-primary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/feature:bg-primary group-hover/feature:text-white">
                  <ArrowRight className="size-4" strokeWidth={2} />
                </span>
              </span>
            </Link>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountMenu({
  isOpen,
  traveller,
  onSignOut,
}: {
  isOpen: boolean;
  traveller: TravellerUser;
  onSignOut: () => void;
}) {
  const displayName =
    traveller.firstName?.trim() || traveller.email.split("@")[0] || "Traveller";

  return (
    <div
      style={headerLayerStyle}
      className={`absolute right-0 top-[calc(100%+14px)] z-[2147483647] w-[min(400px,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] border border-primary/20 bg-white text-secondary shadow-[0_28px_70px_rgba(35,24,16,0.22)] ring-1 ring-white transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1.5 opacity-0"
      }`}
    >
      <div className="px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <p className="min-w-0 flex-1 truncate font-heading text-[28px] font-bold leading-[1.12] text-secondary">
            Hello, {displayName}
          </p>
          <Link
            href="/me/wishlist"
            className="mt-1 shrink-0 font-sans text-[12px] font-bold uppercase leading-none text-primary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            View Wishlist
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {accountMenuItems.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group/account-item flex items-start gap-3 rounded-[7px] py-1 transition-colors hover:text-primary"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#fff4ea] text-primary ring-1 ring-primary/10">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-description font-semibold leading-[1.25] text-secondary transition-colors group-hover/account-item:text-primary">
                  {title}
                </span>
                <span className="mt-1 block font-sans text-[14px] leading-[1.45] text-secondary/70">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center gap-3 border-t border-border bg-[#fbf0e8] px-6 py-4 font-sans text-description font-medium text-secondary transition-colors hover:bg-primary hover:text-white"
      >
        <LogOut className="size-5" strokeWidth={1.8} />
        Sign Out
      </button>
    </div>
  );
}

function HeaderSearchPopup({
  isLoading,
  isOpen,
  query,
  results,
  onClose,
  onQueryChange,
}: {
  isLoading: boolean;
  isOpen: boolean;
  query: string;
  results: HeaderSearchItem[];
  onClose: () => void;
  onQueryChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (popupRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      style={headerLayerStyle}
      className="absolute right-0 top-[calc(100%+14px)] z-[2147483647] w-[min(430px,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] bg-white text-secondary shadow-[0_28px_70px_rgba(35,24,16,0.22)]"
    >
      <div className="flex items-center gap-3 border-b border-border bg-[#fff8f0] px-4 py-3">
        <Search className="size-4 shrink-0 text-primary" strokeWidth={2} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search Ancient Trails</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search tours, destinations, experiences..."
            className="h-9 w-full bg-transparent font-sans text-[13px] font-semibold text-secondary outline-none placeholder:text-secondary/42"
          />
        </label>
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-full text-secondary/60 transition-colors hover:bg-primary hover:text-white"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      {query.trim() ? (
      <div className="max-h-[410px] overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-3 py-6 text-center font-sans text-[12px] font-semibold text-secondary/52">
            Loading search...
          </p>
        ) : null}

        {!isLoading && results.length === 0 ? (
          <p className="px-3 py-6 text-center font-sans text-[12px] font-semibold text-secondary/52">
            No results found.
          </p>
        ) : null}

        {!isLoading && results.length > 0 ? (
          <ul className="space-y-1">
            {results.map((item) => (
              <li key={`${item.href}-${item.title}`}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="group/search grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[7px] px-2 py-2 transition-colors hover:bg-[#fff1e5]"
                >
                  <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-[#fff4ea] text-primary ring-1 ring-primary/10">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <Search className="size-4" strokeWidth={2} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-[13px] font-bold leading-tight text-secondary transition-colors group-hover/search:text-primary">
                      {item.title}
                    </span>
                    <span className="mt-1 line-clamp-1 font-sans text-[11px] font-medium leading-tight text-secondary/58">
                      {item.description}
                    </span>
                  </span>
                  <span className="rounded-full border border-primary/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase leading-none text-primary">
                    {item.type}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const activeItem = pathname?.startsWith("/about")
    ? "About"
    : pathname?.startsWith("/experiences")
      ? "Experiences"
    : pathname?.startsWith("/destinations")
      ? "Destinations"
    : pathname?.startsWith("/tours")
      ? "Tours"
    : pathname?.startsWith("/tour-calendar")
      ? "Tour Calendar"
      : "Home";
  const router = useRouter();
  const toast = useToast();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasLoadedSearchData, setHasLoadedSearchData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [publicSearchItems, setPublicSearchItems] = useState<HeaderSearchItem[]>(
    []
  );
  const [travellerUser, setTravellerUser] = useState<TravellerUser | null>(
    null
  );
  const [megaMenuContent, setMegaMenuContent] =
    useState<PublicMegaMenuContent | null>(null);
  const [isHeaderReady, setIsHeaderReady] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isTourTabsDocked, setIsTourTabsDocked] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isHeaderPortaled, setIsHeaderPortaled] = useState(false);
  const [underlineStyle, setUnderlineStyle] = useState({
    opacity: 0,
    transform: "translate3d(0, 0, 0)",
    clipPath: "inset(0 50% 0 50%)",
  });
  const [isUnderlineAnimating, setIsUnderlineAnimating] = useState(false);
  const navRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const underlineFrameRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef(0);
  const megaMenuCloseTimeoutRef = useRef(0);
  const accountMenuCloseTimeoutRef = useRef(0);
  const hasConfiguredMegaMenu = hasMegaMenuSettings(megaMenuContent);
  const activeTourColumns = useMemo<TourMenuColumn[]>(() => {
    if (!hasConfiguredMegaMenu || !megaMenuContent) {
      return tourColumns;
    }

    return [
      {
        ...tourColumns[0],
        items: buildTourMenuItems(
          megaMenuContent.tourMenu.heritageTours,
          tourColumns[0].items.map((item) => item.image)
        ),
      },
      {
        ...tourColumns[1],
        items: buildTourMenuItems(
          megaMenuContent.tourMenu.shortTrails,
          tourColumns[1].items.map((item) => item.image)
        ),
      },
    ];
  }, [hasConfiguredMegaMenu, megaMenuContent]);
  const activeIndianDestinations = useMemo(
    () =>
      hasConfiguredMegaMenu && megaMenuContent
        ? buildDestinationMenuItems(
            megaMenuContent.destinationMenu.india,
            indianDestinations.map((item) => item.image)
          )
        : indianDestinations,
    [hasConfiguredMegaMenu, megaMenuContent]
  );
  const activeInternationalDestinations = useMemo(
    () =>
      hasConfiguredMegaMenu && megaMenuContent
        ? buildDestinationMenuItems(
            megaMenuContent.destinationMenu.international,
            internationalDestinations.map((item) => item.image)
          )
        : internationalDestinations,
    [hasConfiguredMegaMenu, megaMenuContent]
  );
  const activeTopCities = useMemo(
    () =>
      hasConfiguredMegaMenu && megaMenuContent
        ? buildCityMenuItems(
            megaMenuContent.destinationMenu.topCities,
            topCities.map((item) => item.image)
          )
        : topCities,
    [hasConfiguredMegaMenu, megaMenuContent]
  );
  const allSearchItems = useMemo(
    () =>
      uniqueSearchItems([
        ...staticSearchItems,
        ...getMegaMenuSearchItems(megaMenuContent),
        ...publicSearchItems,
      ]),
    [megaMenuContent, publicSearchItems]
  );
  const searchResults = useMemo(
    () => filterSearchItems(allSearchItems, searchQuery),
    [allSearchItems, searchQuery]
  );

  const updateUnderline = useCallback(() => {
    const nav = navRef.current;
    const currentItem = hoveredItem ?? activeItem;
    const link = linkRefs.current[currentItem];

    if (!nav || !link) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const underlineWidth = 57;
    const left = linkRect.left - navRect.left + linkRect.width / 2 - underlineWidth / 2;

    window.cancelAnimationFrame(underlineFrameRef.current);

    const nextTransform = `translate3d(${left}px, 0, 0)`;

    setIsUnderlineAnimating(false);
    setUnderlineStyle({
      opacity: 1,
      transform: nextTransform,
      clipPath: "inset(0 50% 0 50%)",
    });

    underlineFrameRef.current = window.requestAnimationFrame(() => {
      underlineFrameRef.current = window.requestAnimationFrame(() => {
        setIsUnderlineAnimating(true);
        setUnderlineStyle({
          opacity: 1,
          transform: nextTransform,
          clipPath: "inset(0 0 0 0)",
        });
      });
    });
  }, [activeItem, hoveredItem]);

  useLayoutEffect(() => {
    updateUnderline();

    window.addEventListener("resize", updateUnderline);

    return () => {
      window.cancelAnimationFrame(underlineFrameRef.current);
      window.clearTimeout(megaMenuCloseTimeoutRef.current);
      window.clearTimeout(accountMenuCloseTimeoutRef.current);
      window.removeEventListener("resize", updateUnderline);
    };
  }, [isHeaderPortaled, updateUnderline]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsHeaderReady(true);
      setIsHeaderPortaled(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const updateHeaderVisibility = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDifference = currentScrollY - lastScrollYRef.current;

      setHasScrolled(currentScrollY > 24);

      if (currentScrollY <= 24) {
        setIsHeaderVisible(true);
      } else if (Math.abs(scrollDifference) < 4) {
        lastScrollYRef.current = currentScrollY;

        return;
      } else if (scrollDifference > 0 && currentScrollY > 80) {
        setIsHeaderVisible(false);
        setHoveredItem(null);
        setIsAccountMenuOpen(false);
        setIsSearchOpen(false);
      } else if (scrollDifference < 0) {
        setIsHeaderVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    const handleScroll = () => {
      if (scrollFrameRef.current) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = 0;
        updateHeaderVisibility();
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(scrollFrameRef.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      lastScrollYRef.current = window.scrollY;
      setHasScrolled(window.scrollY > 24);
      setIsHeaderVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    let frameId = 0;

    const syncDockedState = () => {
      frameId = 0;
      setIsTourTabsDocked(root.classList.contains("tour-tabs-docked"));
    };

    const scheduleSync = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(syncDockedState);
    };

    const observer = new MutationObserver(scheduleSync);

    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const syncTravellerSession = () => {
      setTravellerUser(getTravellerSession()?.user ?? null);
    };
    const frameId = window.requestAnimationFrame(syncTravellerSession);
    const unsubscribe = listenForTravellerSessionChanges(syncTravellerSession);

    return () => {
      window.cancelAnimationFrame(frameId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMegaMenu() {
      try {
        const response = await listPublicMegaMenu();

        if (isMounted) {
          setMegaMenuContent(response.data.megaMenu);
        }
      } catch {
        if (isMounted) {
          setMegaMenuContent(null);
        }
      }
    }

    loadMegaMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSearchOpen || hasLoadedSearchData) {
      return;
    }

    let isMounted = true;

    async function loadSearchData() {
      setIsSearchLoading(true);

      try {
        const [toursResponse, destinationsResponse, experiencesResponse] =
          await Promise.all([
            listPublicTours().catch(() => ({ data: { tours: [] } })),
            listPublicDestinations().catch(() => ({
              data: { destinations: [] },
            })),
            listPublicExperiences().catch(() => ({
              data: { experiences: [] },
            })),
          ]);

        if (isMounted) {
          setPublicSearchItems(
            uniqueSearchItems([
              ...toursResponse.data.tours.map(getTourSearchItem),
              ...destinationsResponse.data.destinations.map(
                getDestinationSearchItem
              ),
              ...experiencesResponse.data.experiences.map(
                getExperienceSearchItem
              ),
            ])
          );
          setHasLoadedSearchData(true);
        }
      } finally {
        if (isMounted) {
          setIsSearchLoading(false);
        }
      }
    }

    loadSearchData();

    return () => {
      isMounted = false;
    };
  }, [hasLoadedSearchData, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSearchOpen]);

  const handleSignOut = () => {
    clearTravellerSession();
    setTravellerUser(null);
    setIsAccountMenuOpen(false);
    toast.success("Logged out", "You have been signed out successfully.");

    if (pathname?.startsWith("/me")) {
      router.push("/");
    }
  };
  const keepMegaMenuOpen = () => {
    window.clearTimeout(megaMenuCloseTimeoutRef.current);
  };
  const openMegaMenu = (label: string) => {
    keepMegaMenuOpen();
    setIsAccountMenuOpen(false);
    setIsSearchOpen(false);
    setHoveredItem(label);
  };
  const closeMegaMenu = () => {
    window.clearTimeout(megaMenuCloseTimeoutRef.current);
    megaMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setHoveredItem(null);
    }, 180);
  };
  const openAccountMenu = () => {
    window.clearTimeout(megaMenuCloseTimeoutRef.current);
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    setHoveredItem(null);
    setIsSearchOpen(false);
    setIsAccountMenuOpen(Boolean(travellerUser));
  };
  const closeAccountMenu = () => {
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    accountMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsAccountMenuOpen(false);
    }, 160);
  };
  const toggleSearch = () => {
    window.clearTimeout(megaMenuCloseTimeoutRef.current);
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    setHoveredItem(null);
    setIsAccountMenuOpen(false);
    setIsSearchOpen((current) => !current);
  };

  const loginHref =
    pathname && pathname !== "/login"
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";
  const accountHref = travellerUser ? "/me" : loginHref;
  const shouldShowHeader =
    isHeaderReady &&
    !isTourTabsDocked &&
    (isHeaderVisible || Boolean(hoveredItem) || isSearchOpen);
  const headerTopClass = hasScrolled
    ? "top-[clamp(0.5rem,2vh,1rem)]"
    : "top-[clamp(1rem,4vh,2.25rem)]";

  const headerContent = (
    <header
      style={headerLayerStyle}
      onMouseEnter={keepMegaMenuOpen}
      onMouseLeave={closeMegaMenu}
      className={`fixed left-1/2 ${headerTopClass} isolate z-[2147483647] flex w-[calc(100%-2.5rem)] max-w-[1300px] -translate-x-1/2 items-center justify-between rounded-[18px] bg-white px-4 py-1.5 shadow-[0_18px_55px_rgba(50,50,50,0.18)] ring-1 ring-white transition-[top,translate,opacity] duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:py-2 md:px-5 [@media(max-height:600px)]:py-1.5 ${
        shouldShowHeader
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-[calc(100%+3rem)] opacity-0"
      }`}
    >
      <Link href="/" aria-label="Ancient Trails home" className="shrink-0">
        <Image
          src="/Header Logo.png"
          alt="Ancient Trails"
          width={218}
          height={86}
          priority
          className="h-8 w-auto sm:h-12 [@media(max-height:600px)]:h-12"
        />
      </Link>

      <nav aria-label="Primary navigation" className="hidden lg:block">
        <ul
          ref={navRef}
          className="relative flex items-center gap-8 text-header font-medium text-accent"
        >
          {navItems.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                ref={(node) => {
                  linkRefs.current[item.label] = node;
                }}
                onFocus={() => openMegaMenu(item.label)}
                onMouseEnter={() => openMegaMenu(item.label)}
                className={`relative transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-primary ${
                  item.label === (hoveredItem ?? activeItem) ? "text-primary" : ""
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
          <Image
            src="/Path 5647.png"
            alt=""
            width={57}
            height={3}
            aria-hidden="true"
            className={`pointer-events-none absolute -bottom-3 left-0 h-[3px] w-[57px] origin-center ${
              isUnderlineAnimating
                ? "transition-[opacity,clip-path] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                : "transition-none"
            }`}
            style={underlineStyle}
          />
        </ul>
      </nav>

      {hoveredItem === "Tours" || hoveredItem === "Destinations" ? (
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-full h-[18px]"
          onMouseEnter={keepMegaMenuOpen}
        />
      ) : null}
      <ToursMegaMenu
        tourMenuColumns={activeTourColumns}
        isOpen={hoveredItem === "Tours"}
        onMouseEnter={keepMegaMenuOpen}
        onMouseLeave={closeMegaMenu}
      />
      <DestinationsMegaMenu
        cityItems={activeTopCities}
        indianItems={activeIndianDestinations}
        internationalItems={activeInternationalDestinations}
        isOpen={hoveredItem === "Destinations"}
        onMouseEnter={keepMegaMenuOpen}
        onMouseLeave={closeMegaMenu}
      />

      <div className="relative flex items-center gap-2">
        <button
          type="button"
          aria-expanded={isSearchOpen}
          aria-label="Search Ancient Trails"
          title="Search"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={toggleSearch}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-primary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white"
        >
          <Search className="size-5" strokeWidth={2.3} />
        </button>

        <HeaderSearchPopup
          isLoading={isSearchLoading && publicSearchItems.length === 0}
          isOpen={isSearchOpen}
          query={searchQuery}
          results={searchResults}
          onClose={() => setIsSearchOpen(false)}
          onQueryChange={setSearchQuery}
        />

        <div
          className="relative"
          onMouseEnter={openAccountMenu}
          onMouseLeave={closeAccountMenu}
          onFocus={openAccountMenu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              closeAccountMenu();
            }
          }}
        >
          <Link
            href={accountHref}
            aria-label={travellerUser ? "Open traveller dashboard" : "Login"}
            title={travellerUser ? "My Dashboard" : "Login"}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/25 bg-white text-primary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary hover:bg-primary hover:text-white"
          >
            <User className="size-5" strokeWidth={2.3} />
          </Link>

          {travellerUser ? (
            <>
            <span
              aria-hidden="true"
              className={`absolute right-0 top-full h-[18px] w-[min(400px,calc(100vw-2.5rem))] ${
                isAccountMenuOpen ? "block" : "hidden"
              }`}
            />
            <AccountMenu
              isOpen={isAccountMenuOpen}
              traveller={travellerUser}
              onSignOut={handleSignOut}
            />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );

  return (
    <div
      style={headerLayerStyle}
      className="relative isolate z-[2147483647] h-[60px] sm:h-[84px] [@media(max-height:600px)]:sm:h-[76px]"
    >
      {isHeaderPortaled ? createPortal(headerContent, document.body) : headerContent}
    </div>
  );
}
