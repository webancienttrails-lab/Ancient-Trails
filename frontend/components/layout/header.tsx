"use client";
import { useModalFocus } from "@/lib/modal-focus";
import { useHeaderPopover } from "@/lib/header-popover";

import { getTravellerAccountName } from "@/lib/profile-prompt";
import { SiteLogo } from "@/components/site-logo";
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
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { ButtonArrow } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  logoutTravellerSession,
  getTravellerSession,
  listenForTravellerSessionChanges,
  type TravellerUser,
} from "@/lib/auth";
import {
  getHomeMediaUrl,
  listPublicDestinations,
  listPublicExperiences,
  listPublicExperts,
  listPublicMegaMenu,
  listPublicTours,
  type PublicDestination,
  type PublicExperience,
  type PublicExpert,
  type PublicMegaMenuContent,
  type PublicMegaMenuDestinationReference,
  type PublicMegaMenuTourReference,
  type PublicTour,
} from "@/lib/home-travel";
import {
  getDestinationHref,
  getExperienceHref,
  getDestinationsHref,
  getTourHref,
  slugifyRoute,
} from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./header.module.css";

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

const mobileDrawerLayerStyle: CSSProperties = {
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
    title: "Long Trails",
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
    href: "/specialised-tours",
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

function getTourMenuItemLimit(title: string) {
  return /long/i.test(title) ? 8 : 4;
}

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
    getLongTrailMenuItems(content).length > 0 ||
    content.tourMenu.shortTrails.length > 0 ||
    content.destinationMenu.india.length > 0 ||
    content.destinationMenu.international.length > 0 ||
    content.destinationMenu.topCities.length > 0
  );
}

function getLongTrailMenuItems(content: PublicMegaMenuContent) {
  return content.tourMenu.longTrails || content.tourMenu.heritageTours || [];
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
    title: experience.title || experience.tourName || "Traveller Experience",
    description:
      experience.writtenReview ||
      `Traveller experience on ${experience.tourName}`,
    href: getExperienceHref(experience),
    image: getHomeMediaUrl(
      experience.travellerPhotoGallery[0] ||
        experience.attractionPhotoGallery[0]?.image ||
        ""
    ),
    keywords: [
      experience.experienceId,
      experience.tourId,
      experience.tourName,
      experience.travellerName,
      experience.title,
      experience.writtenReview,
      experience.thingsToKnow.join(" "),
    ].join(" "),
    type: "Experience",
  };
}

function getExpertSearchItem(expert: PublicExpert): HeaderSearchItem {
  return {
    title: expert.fullName,
    description:
      expert.expertiseTags.join(" • ") ||
      expert.qualifications.join(" • ") ||
      "Heritage travel expert",
    href: `/experts#${slugifyRoute(expert.expertId || expert.fullName || "expert")}`,
    image: getHomeMediaUrl(expert.image || ""),
    keywords: [
      expert.expertId,
      expert.fullName,
      expert.fullBiography,
      expert.expertiseTags.join(" "),
      expert.qualifications.join(" "),
      expert.languages.join(" "),
      "tour expert guide heritage specialist",
    ].join(" "),
    type: "Tour Expert",
  };
}

function getMegaMenuSearchItems(
  content: PublicMegaMenuContent | null
): HeaderSearchItem[] {
  if (!content) {
    return [];
  }

  return [
    ...getLongTrailMenuItems(content).map((tour) => ({
      title: tour.tourName,
      description: "Long trail",
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
      <Link prefetch={false}
        href={item.href}
        className="group/destination grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-[5px] py-1 pr-1 text-secondary transition-colors hover:text-brand-text"
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
          <span className="block font-sans text-description font-semibold leading-[1.2] text-secondary transition-colors group-hover/destination:text-brand-text">
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
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text ring-1 ring-primary/15">
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

      <Link prefetch={false}
        href={footerHref}
        className={megaTextRevealClass(
          isOpen,
          "mt-4 flex items-center justify-between font-sans text-[14px] font-bold text-brand-text"
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
    <Link prefetch={false}
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
  embedded = false,
  isOpen,
  onMouseEnter,
  onMouseLeave,
}: {
  cityItems?: CityMenuItem[];
  indianItems?: DestinationMenuItem[];
  internationalItems?: DestinationMenuItem[];
  embedded?: boolean;
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      style={headerLayerStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`${embedded ? "relative min-w-0 w-full" : "home-wide-frame absolute left-0 right-0 top-[calc(100%+12px)] z-[2147483647] mx-auto w-full"} origin-top transition-[opacity,transform,filter] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
            <Link prefetch={false}
              href={getDestinationsHref("UNESCO sites")}
              className="group/button relative mt-[210px] flex h-9 w-[192px] items-center justify-between gap-2 rounded-full border border-button-outline bg-white px-3 font-sans text-[12px] font-semibold text-button-outline shadow-[0_8px_18px_rgba(212,114,32,0.16)] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-brand-button-dark hover:text-white"
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
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text ring-1 ring-primary/15">
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

            <Link prefetch={false}
              href={getDestinationsHref("Popular cities")}
              className={megaTextRevealClass(
                isOpen,
                "mt-4 flex items-center justify-between font-sans text-[14px] font-bold text-brand-text"
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
  embedded = false,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  tourMenuColumns = tourColumns,
}: {
  featuredItems?: typeof featuredTours;
  embedded?: boolean;
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
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`${embedded ? "relative min-w-0 w-full" : "home-wide-frame absolute left-0 right-0 top-[calc(100%+12px)] z-[2147483647] mx-auto w-full"} origin-top transition-[opacity,transform,filter] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none -translate-y-1.5 scale-[0.99] opacity-0 blur-[1px]"
      }`}
    >
      <div className="grid min-h-[330px] overflow-hidden rounded-[10px] border border-primary/25 bg-white shadow-[0_28px_80px_rgba(35,24,16,0.3)] ring-1 ring-white/80 lg:grid-cols-[210px_minmax(0,1.75fr)_minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[240px_minmax(0,1.9fr)_minmax(0,1.05fr)_minmax(0,1.25fr)]">
        <div className="relative overflow-hidden bg-[#fff4ea] p-6 xl:p-7">
          <p
            className={megaTextRevealClass(
              isOpen,
              "font-sans text-description font-semibold leading-none text-accent"
            )}
            style={megaTextRevealStyle(isOpen, 60)}
          >
            Heritage Tours
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
          <Link prefetch={false}
            href="/tour-calendar"
            className="group/button relative mt-8 flex h-9 w-full max-w-[170px] items-center justify-between gap-4 rounded-full border border-button-outline bg-white px-5 font-sans text-[13px] font-semibold text-button-outline shadow-[0_8px_18px_rgba(212,114,32,0.16)] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-brand-button-dark hover:text-white"
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
          const visibleItems = items.slice(0, getTourMenuItemLimit(title));
          const isLongTrails = /long/i.test(title);

          return (
          <div
            key={title}
            className="min-w-0 border-l border-primary/25 px-5 py-6 xl:px-6"
          >
            <div className="flex min-h-[44px] min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text ring-1 ring-primary/15">
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

            <ul
              className={cn(
                "mt-5",
                isLongTrails ? "grid grid-cols-2 gap-x-4 gap-y-4" : "space-y-4"
              )}
            >
              {visibleItems.map((item, index) => (
                <li key={`${title}-${item.title}`}>
                  <Link prefetch={false}
                    href={item.href}
                    className={cn(
                      "group/tour grid items-center gap-3 font-sans text-description font-medium leading-[1.25] text-secondary transition-colors hover:text-brand-text",
                      isLongTrails
                        ? "grid-cols-[44px_minmax(0,1fr)] text-[14px]"
                        : "grid-cols-[52px_minmax(0,1fr)]"
                    )}
                  >
                    <span
                      className={cn(
                        "relative shrink-0 overflow-hidden rounded-[5px] bg-muted ring-1 ring-primary/10",
                        isLongTrails ? "size-11" : "size-[52px]"
                      )}
                    >
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes={isLongTrails ? "44px" : "52px"}
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

            <Link prefetch={false}
              href={isLongTrails ? "/tours" : "/short-trails"}
              className={megaTextRevealClass(
                isOpen,
                "mt-8 inline-flex flex-col font-sans text-[14px] font-bold text-brand-text"
              )}
              style={megaTextRevealStyle(isOpen, baseDelay + 380)}
            >
              And more +
              <span className="mt-2 h-px w-8 bg-primary" />
            </Link>
          </div>
          );
        })}

        <div className="grid min-w-0 grid-rows-2 border-l border-primary/25">
          {featuredItems.slice(0, 2).map(({ title, subtitle, image, icon: Icon, href }, columnIndex) => {
            const baseDelay = 260 + columnIndex * 110;

            return (
              <Link prefetch={false}
                key={title}
                href={href}
                className={cn(
                  "group/feature grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] content-start gap-x-4 gap-y-3 px-5 py-5 transition-colors hover:bg-primary/5",
                  columnIndex > 0 && "border-t border-primary/25"
                )}
              >
                <span className="col-span-2 flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text">
                    <Icon className="size-5" strokeWidth={1.7} />
                  </span>
                  <span className={megaTextRevealClass(isOpen, "min-w-0 font-sans text-[16px] font-semibold leading-tight text-secondary")} style={megaTextRevealStyle(isOpen, baseDelay)}>{title}</span>
                </span>
                <span className="relative block h-[100px] min-w-0 overflow-hidden rounded-[7px] bg-muted">
                  <Image src={image} alt={title + " preview"} fill sizes="(min-width: 1440px) 140px, 160px" className="object-cover transition-transform duration-300 group-hover/feature:scale-105" />
                </span>
                <span className="flex min-w-0 flex-col justify-between gap-2">
                  <span className={megaTextRevealClass(isOpen, "font-sans text-[13px] leading-relaxed text-secondary")} style={megaTextRevealStyle(isOpen, baseDelay + 90)}>{subtitle}</span>
                  <span className="grid size-9 shrink-0 place-items-center self-end rounded-full border border-primary text-brand-text transition-colors group-hover/feature:bg-brand-button-dark group-hover/feature:text-white"><ArrowRight className="size-4" /></span>
                </span>
              </Link>
            );
          })}
        </div>
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
  const displayName = getTravellerDisplayName(traveller);

  return (
    <div
      inert={!isOpen}
      aria-hidden={!isOpen}
      style={headerLayerStyle}
      className={`absolute right-0 top-[calc(100%+14px)] z-[2147483647] w-[min(400px,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] border border-primary/20 bg-white text-secondary shadow-[0_28px_70px_rgba(35,24,16,0.22)] ring-1 ring-white transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1.5 opacity-0"
      }`}
    >
      <div className="px-6 py-6">
        <div className="flex items-start justify-between gap-4 max-lg:flex-col max-lg:gap-3">
          <p className="min-w-0 flex-1 truncate font-heading text-[28px] font-bold leading-[1.12] text-secondary max-lg:w-full max-lg:flex-none max-lg:whitespace-normal max-lg:break-words max-lg:text-[20px]">
            Hello, {displayName}
          </p>
          <Link prefetch={false}
            href="/me/wishlist"
            className="mt-1 shrink-0 max-lg:mt-0 font-sans text-[12px] font-bold uppercase leading-none text-brand-text transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            View Wishlist
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {accountMenuItems.map(({ title, description, href, icon: Icon }) => (
            <Link prefetch={false}
              key={title}
              href={href}
              className="group/account-item flex items-start gap-3 rounded-[7px] py-1 transition-colors hover:text-brand-text"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#fff4ea] text-brand-text ring-1 ring-primary/10">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-description font-semibold leading-[1.25] text-secondary transition-colors group-hover/account-item:text-brand-text">
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
        className="flex w-full items-center gap-3 border-t border-border bg-[#fbf0e8] px-6 py-4 font-sans text-description font-medium text-secondary transition-colors hover:bg-brand-button-dark hover:text-white"
      >
        <LogOut className="size-5" strokeWidth={1.8} />
        Sign Out
      </button>
    </div>
  );
}

function getTravellerDisplayName(traveller: TravellerUser | null) {
  return getTravellerAccountName(traveller);
}

function getTravellerInitials(traveller: TravellerUser | null) {
  const displayName = getTravellerDisplayName(traveller);
  const nameParts = displayName.split(/\s+/).filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

function hasCompletedTravellerName(traveller: TravellerUser | null) {
  if (!traveller) {
    return false;
  }

  return Boolean(traveller.firstName?.trim() && traveller.lastName?.trim());
}

function MobileHeaderDrawer({
  isOpen,
  traveller,
  loginHref,
  accountHref,
  tourMenuColumns,
  indianItems,
  internationalItems,
  cityItems,
  triggerRef,
  onClose,
  onSignOut,
}: {
  isOpen: boolean;
  traveller: TravellerUser | null;
  loginHref: string;
  accountHref: string;
  tourMenuColumns: TourMenuColumn[];
  indianItems: DestinationMenuItem[];
  internationalItems: DestinationMenuItem[];
  cityItems: CityMenuItem[];
  triggerRef: { current: HTMLButtonElement | null };
  onClose: () => void;
  onSignOut: () => void;
}) {
  const [openChildLabel, setOpenChildLabel] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalFocus(dialogRef, isOpen, onClose, 'aside button[aria-label="Close menu"]', triggerRef);
  const tourChildGroups = tourMenuColumns
    .map((column) => ({
      title: column.title,
      items: column.items.map((item) => ({
        href: item.href,
        title: item.title,
      })),
    }))
    .filter((group) => group.items.length > 0);
  const destinationChildGroups = [
    {
      title: "India",
      items: indianItems,
    },
    {
      title: "International",
      items: internationalItems,
    },
    {
      title: "Top Cities",
      items: cityItems,
    },
  ]
    .map((group) => ({
      title: group.title,
      items: group.items.map((item) => ({
        href: item.href,
        title: item.title,
      })),
    }))
    .filter((group) => group.items.length > 0);
  const childGroupsByLabel: Record<
    string,
    Array<{ title: string; items: Array<{ href: string; title: string }> }>
  > = {
    Tours: tourChildGroups,
    Destinations: destinationChildGroups,
  };

  const drawer = (
    <dialog
      ref={dialogRef}
      id="mobile-navigation"
      aria-label="Navigation menu"
      style={mobileDrawerLayerStyle}
      className={`fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-secondary z-[2147483647] lg:hidden ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-secondary/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        className={`absolute left-0 top-0 flex h-[100svh] max-h-[100svh] w-[min(280px,calc(100vw-3rem))] flex-col overflow-hidden border-r border-border bg-white text-secondary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "translate-x-0 shadow-[0_26px_80px_rgba(35,24,16,0.24)]" : "-translate-x-full shadow-none"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <Link prefetch={false} href="/" aria-label="Ancient Trails home" onClick={onClose}>
            <SiteLogo
              alt="Ancient Trails"
              width={218}
              height={86}
              className="h-18 w-auto"
            />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>


        <nav
          aria-label="Mobile navigation"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        >
          <div className="space-y-1">
            {navItems.map((item) => {
              const childGroups = childGroupsByLabel[item.label] || [];

              return (
                <div key={item.label}>
                  {childGroups.length > 0 ? (
                    <div className="group/mobile-nav flex h-11 w-full items-center justify-between rounded-[7px] px-3 text-left font-sans text-[15px] font-semibold text-secondary transition-colors hover:bg-primary/8 hover:text-brand-text">
                      <Link prefetch={false} href={item.href} onClick={onClose} className="flex h-full min-w-0 flex-1 items-center">
                        {item.label}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Toggle ${item.label} submenu`}
                        aria-expanded={openChildLabel === item.label}
                        aria-controls={`mobile-submenu-${item.label.toLowerCase()}`}
                        onClick={() => setOpenChildLabel((current) => current === item.label ? null : item.label)}
                        className="-mr-3 grid size-11 shrink-0 place-items-center rounded-[7px]"
                      >
                        <ArrowRight
                          className={`size-4 text-brand-text opacity-70 transition-transform ${
                            openChildLabel === item.label
                              ? "rotate-90"
                              : "group-hover/mobile-nav:translate-x-0.5"
                          }`}
                          strokeWidth={1.8}
                        />
                      </button>
                    </div>
                  ) : (
                    <Link prefetch={false}
                      href={item.href}
                      onClick={onClose}
                      className="group/mobile-nav flex h-11 items-center justify-between rounded-[7px] px-3 font-sans text-[15px] font-semibold text-secondary transition-colors hover:bg-primary/8 hover:text-brand-text"
                    >
                      <span>{item.label}</span>
                      <ArrowRight
                        className="size-4 text-brand-text opacity-70 transition-transform group-hover/mobile-nav:translate-x-0.5"
                        strokeWidth={1.8}
                      />
                    </Link>
                  )}

                  {childGroups.length > 0 && openChildLabel === item.label ? (
                    <div id={`mobile-submenu-${item.label.toLowerCase()}`} className="mb-2 ml-3 border-l border-primary/18 pl-3">
                      <Link prefetch={false}
                        href={item.href}
                        onClick={onClose}
                        className="mb-1 block rounded-[6px] px-2 py-1.5 font-sans text-[13px] font-bold text-brand-text transition-colors hover:bg-primary/8"
                      >
                        View all {item.label}
                      </Link>
                      {childGroups.map((group) => (
                        <div key={group.title} className="py-1.5">
                          <p className="px-2 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-secondary/48">
                            {group.title}
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {group.items.map((child) => (
                              <Link prefetch={false}
                                key={`${group.title}-${child.href}-${child.title}`}
                                href={child.href}
                                onClick={onClose}
                                className="block rounded-[6px] px-2 py-1.5 font-sans text-[13px] font-semibold text-secondary/72 transition-colors hover:bg-primary/8 hover:text-brand-text"
                              >
                                {child.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border px-5 py-4">
          {traveller ? (
            <>
              <Link prefetch={false}
                href={accountHref}
                onClick={onClose}
                className="flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 font-sans text-[14px] font-semibold text-white transition-colors hover:bg-secondary"
              >
                My Dashboard
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-button-outline bg-white font-sans text-[14px] font-semibold text-button-outline transition-colors hover:bg-brand-button-dark hover:text-white"
              >
                <LogOut className="size-4" strokeWidth={1.9} />
                Sign Out
              </button>
            </>
          ) : (
            <Link prefetch={false}
              href={loginHref}
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 font-sans text-[14px] font-semibold text-white transition-colors hover:bg-secondary"
            >
              Login
            </Link>
          )}
        </div>
      </aside>
    </dialog>
  );

  return typeof document === "undefined"
    ? null
    : createPortal(drawer, document.body);
}

function HeaderSearchPopup({
  isLoading,
  isOpen,
  query,
  results,
  triggerRef,
  onClose,
  onQueryChange,
}: {
  isLoading: boolean;
  isOpen: boolean;
  query: string;
  results: HeaderSearchItem[];
  triggerRef: { current: HTMLButtonElement | null };
  onClose: () => void;
  onQueryChange: (value: string) => void;
}) {
  const popupRef = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  useHeaderPopover(popupRef, isOpen, onClose, 'input[type="search"]', triggerRef);
  useEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const edge = trigger.parentElement?.getBoundingClientRect().right || rect.right;
      const width = Math.min(430, window.innerWidth - 40);
      const left = window.innerWidth < 1024 ? (window.innerWidth - width) / 2 : Math.max(20, Math.min(edge - width, window.innerWidth - width - 20));
      setPosition({ position: 'fixed', margin: 0, left, top: rect.bottom + 14, width });
    };
    place(); window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isOpen, triggerRef]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <dialog
      id="header-search-dialog"
      aria-label="Search Ancient Trails"
      ref={popupRef}
      style={{ ...headerLayerStyle, ...position }}
      className="fixed border-0 p-0 z-[2147483647] w-[min(430px,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] bg-white text-secondary shadow-[0_28px_70px_rgba(35,24,16,0.22)]"
    >
      <div className="flex items-center gap-3 border-b border-border bg-[#fff8f0] px-4 py-3">
        <Search className="size-4 shrink-0 text-brand-text" strokeWidth={2} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search Ancient Trails</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search tours, destinations, experiences..."
            className="h-9 w-full bg-transparent font-sans text-[13px] font-semibold text-secondary outline-none placeholder:text-secondary/42 [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-full text-button-outline transition-colors hover:bg-brand-button-dark hover:text-white"
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
                <Link prefetch={false}
                  href={item.href}
                  onClick={onClose}
                  className="group/search grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[7px] px-2 py-2 transition-colors hover:bg-[#fff1e5]"
                >
                  <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-[#fff4ea] text-brand-text ring-1 ring-primary/10">
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
                    <span className="block truncate font-sans text-[13px] font-bold leading-tight text-secondary transition-colors group-hover/search:text-brand-text">
                      {item.title}
                    </span>
                    <span className="mt-1 line-clamp-1 font-sans text-[11px] font-medium leading-tight text-secondary/58">
                      {item.description}
                    </span>
                  </span>
                  <span className="rounded-full border border-primary/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase leading-none text-brand-text">
                    {item.type}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      ) : null}
    </dialog>,
    document.getElementById("site-header-slot") || document.body
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const accountLinkRef = useRef<HTMLAnchorElement>(null);
  const desktopDialogRef = useRef<HTMLDialogElement>(null);
  const [desktopPosition, setDesktopPosition] = useState<CSSProperties>({});
  useHeaderPopover(desktopDialogRef, isDesktopMenuOpen, () => { setIsDesktopMenuOpen(false); setHoveredItem(null); }, 'nav button, nav a', menuButtonRef);
  useEffect(() => {
    if (!isDesktopMenuOpen) return;
    const place = () => {
      const rect = headerRef.current?.getBoundingClientRect();
      if (rect) setDesktopPosition({ position: 'fixed', margin: 0, left: rect.left, top: rect.bottom + 12, width: hoveredItem ? rect.width : 240 });
    };
    place(); window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isDesktopMenuOpen, hoveredItem]);
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
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef(0);
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
          getLongTrailMenuItems(megaMenuContent),
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

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node) && !desktopDialogRef.current?.contains(event.target as Node)) {
        setIsDesktopMenuOpen(false);
        setHoveredItem(null);
        setIsAccountMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      if (isAccountMenuOpen) { setIsAccountMenuOpen(false); accountLinkRef.current?.focus(); }
      if (isDesktopMenuOpen) { setIsDesktopMenuOpen(false); setHoveredItem(null); menuButtonRef.current?.focus(); }
    };
    window.addEventListener("pointerdown", closeMenus);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenus);
      window.removeEventListener("keydown", handleEscape);
      window.clearTimeout(accountMenuCloseTimeoutRef.current);
    };
  }, [isAccountMenuOpen, isDesktopMenuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeResponsiveMenu = () => {
      setIsMobileMenuOpen(false);
      setIsDesktopMenuOpen(false);
      setHoveredItem(null);
    };
    desktop.addEventListener("change", closeResponsiveMenu);
    return () => desktop.removeEventListener("change", closeResponsiveMenu);
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsHeaderReady(true);
      setHeaderPortalTarget(document.getElementById("site-header-slot"));
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
        return;
      } else if (scrollDifference > 0 && currentScrollY > 80) {
        setIsHeaderVisible(false);
        setIsDesktopMenuOpen(false);
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
      setIsDesktopMenuOpen(false);
      setHoveredItem(null);
      setIsMobileMenuOpen(false);
      setIsSearchOpen(false);
      setIsAccountMenuOpen(false);
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
        const [toursResponse, destinationsResponse, experiencesResponse, expertsResponse] =
          await Promise.all([
            listPublicTours().catch(() => ({ data: { tours: [] } })),
            listPublicDestinations().catch(() => ({
              data: { destinations: [] },
            })),
            listPublicExperiences().catch(() => ({
              data: { experiences: [] },
            })),
            listPublicExperts().catch(() => ({
              data: { experts: [] },
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
              ...expertsResponse.data.experts.map(getExpertSearchItem),
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
    const breakpoint = window.matchMedia("(min-width: 1024px)");
    const handleBreakpoint = () => {
      setIsDesktopMenuOpen(false);
      setIsMobileMenuOpen(false);
      setHoveredItem(null);
    };
    breakpoint.addEventListener("change", handleBreakpoint);
    return () => breakpoint.removeEventListener("change", handleBreakpoint);
  }, []);

  const handleSignOut = async () => {
    try { await logoutTravellerSession(); }
    catch { toast.error("Could not sign out", "Your server session could not be ended. Please try again."); return; }
    setTravellerUser(null);
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
    toast.success("Logged out", "You have been signed out successfully.");

    if (pathname?.startsWith("/me")) {
      router.push("/");
    }
  };
  const openMegaMenu = (label: string) => {
    setIsAccountMenuOpen(false);
    setIsSearchOpen(false);
    setHoveredItem(label === "Tours" || label === "Destinations" ? label : null);
  };
  const openAccountMenu = () => {
    setIsDesktopMenuOpen(false);
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
    setIsDesktopMenuOpen(false);
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    setHoveredItem(null);
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsSearchOpen((current) => !current);
  };
  const openMobileMenu = () => {
    setIsDesktopMenuOpen(false);
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    setHoveredItem(null);
    setIsAccountMenuOpen(false);
    setIsSearchOpen(false);
    setIsMobileMenuOpen(true);
  };

  const loginHref =
    pathname && pathname !== "/login"
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";
  const accountHref = travellerUser ? "/me" : loginHref;
  const shouldShowHeader =
    isHeaderReady &&
    !isTourTabsDocked &&
    (isHeaderVisible || isDesktopMenuOpen || isMobileMenuOpen || isSearchOpen || isAccountMenuOpen);
  const hasGlassBackground = hasScrolled || isDesktopMenuOpen || isSearchOpen || isAccountMenuOpen;
  const headerContent = (
    <header
      ref={headerRef}
      style={headerLayerStyle}
      inert={!shouldShowHeader}
      className={cn(
        "fixed left-3 right-3 top-2 isolate flex h-[60px] items-center justify-between rounded-[24px] px-2 transition-[transform,opacity,background-color,box-shadow,backdrop-filter] duration-300 sm:left-5 sm:right-5 sm:h-[72px] sm:px-3 lg:left-8 lg:right-8 lg:top-3 lg:h-20 lg:rounded-[28px] lg:px-4 motion-reduce:transition-none",
        hasGlassBackground ? "border border-white/10 bg-white/15 shadow-[0_12px_40px_rgba(70,40,15,0.12)] backdrop-blur-xl max-lg:bg-white/95" : "border border-transparent bg-transparent",
        shouldShowHeader ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-[calc(100%+3rem)] opacity-0"
      )}
    >
      <button
        ref={menuButtonRef}
        type="button"
        aria-expanded={isDesktopMenuOpen || isMobileMenuOpen}
        aria-controls={isDesktopMenuOpen ? "desktop-navigation" : "mobile-navigation"}
        aria-haspopup="dialog"
        aria-label={isDesktopMenuOpen ? "Close menu" : "Open menu"}
        onClick={() => {
          if (window.matchMedia("(min-width: 1024px)").matches) {
            setIsDesktopMenuOpen(current => !current);
            setHoveredItem(null);
            setIsSearchOpen(false);
            setIsAccountMenuOpen(false);
          } else {
            openMobileMenu();
          }
        }}
        className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full bg-transparent text-brand-text lg:size-14"
      >
        {isDesktopMenuOpen ? <X className="size-7" strokeWidth={1.7} /> : <Image src="/menu%20(1).png" alt="" width={32} height={32} className="size-7 object-contain lg:size-8" />}
      </button>
      <Link prefetch={false}
        href="/"
        aria-label="Ancient Trails home"
        className="absolute left-1/2 z-10 shrink-0 -translate-x-1/2"
      >
        <SiteLogo
          alt="Ancient Trails"
          width={218}
          height={86}
          priority
          className="h-14 w-auto max-w-[min(120px,calc(100vw-224px))] object-contain sm:h-16 sm:max-w-none lg:h-[86px]"
        />
      </Link>

      {isDesktopMenuOpen && createPortal(
        <dialog
          ref={desktopDialogRef}
          aria-label="Navigation menu"
          style={{ ...headerLayerStyle, ...desktopPosition }}
          id="desktop-navigation"
          className={cn(
            "fixed p-0 text-secondary hidden max-h-[calc(100dvh-120px)] overflow-auto overscroll-contain rounded-[20px] border border-white/70 bg-[#fffdfb] max-lg:bg-white shadow-[0_20px_60px_rgba(60,35,15,0.18)] lg:grid",
            hoveredItem ? "right-0 grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)]" : "w-[240px] grid-cols-1"
          )}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) {
              setIsDesktopMenuOpen(false);
              setHoveredItem(null);
            }
          }}
        >
          <button type="button" aria-label="Close menu" onClick={() => { setIsDesktopMenuOpen(false); setHoveredItem(null); }} className="col-span-full justify-self-end m-2 grid size-8 place-items-center rounded-full text-brand-text hover:bg-primary/10"><X className="size-5" /></button>
          <nav aria-label="Primary navigation" className={cn(styles.navigationRail, "border-r border-primary/15 p-3")}>
            <ul className="space-y-2 font-sans text-[16px] font-medium text-brand-text xl:text-[18px]">
              {navItems.map(item => (
                <li key={item.label}>
                  {item.label === "Tours" || item.label === "Destinations" ? (
                    <Link prefetch={false}
                      href={item.href}
                      aria-expanded={hoveredItem === item.label}
                      aria-controls={"desktop-" + item.label.toLowerCase()}
                      onMouseEnter={() => openMegaMenu(item.label)}
                      onFocus={() => openMegaMenu(item.label)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowRight") {
                          event.preventDefault();
                          openMegaMenu(item.label);
                          window.requestAnimationFrame(() => document.querySelector<HTMLElement>("#desktop-" + item.label.toLowerCase() + " a")?.focus());
                        }
                      }}
                      className={cn("flex min-h-12 w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left transition-colors hover:bg-primary/10", hoveredItem === item.label && "bg-primary/10")}
                    >
                      {item.label}<ArrowRight className="size-4 shrink-0" />
                    </Link>
                  ) : (
                    <Link prefetch={false} href={item.href} onMouseEnter={() => openMegaMenu(item.label)} className={cn("block rounded-lg px-3 py-3 transition-colors hover:bg-primary/10", item.label === activeItem && "bg-primary/10")}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          {hoveredItem && (
            <div id={"desktop-" + hoveredItem.toLowerCase()} data-menu={hoveredItem.toLowerCase()} className={cn(styles.megaContent, "min-w-0")}>
              {hoveredItem === "Tours" ? (
                <ToursMegaMenu embedded tourMenuColumns={activeTourColumns} isOpen />
              ) : (
                <DestinationsMegaMenu embedded cityItems={activeTopCities} indianItems={activeIndianDestinations} internationalItems={activeInternationalDestinations} isOpen />
              )}
            </div>
          )}
        </dialog>,
        headerPortalTarget || document.body
      )}

      <div className="relative z-10 flex items-center gap-1 sm:gap-3 max-lg:static">
        <button
          type="button"
          ref={searchButtonRef}
          aria-controls="header-search-dialog"
          aria-haspopup="dialog"
          aria-expanded={isSearchOpen}
          aria-label="Search Ancient Trails"
          title="Search"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={toggleSearch}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-transparent text-brand-text transition-colors sm:size-10 lg:size-10"
        >
          <Search className="size-5" strokeWidth={2.3} />
        </button>

        <HeaderSearchPopup
          triggerRef={searchButtonRef}
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
          <Link prefetch={false}
            ref={accountLinkRef}
            href={accountHref}
            aria-label={travellerUser ? "Open traveller dashboard" : "Login"}
            title={travellerUser ? "My Dashboard" : "Login"}
            className="grid size-9 shrink-0 place-items-center md:text-[10px] rounded-full bg-primary font-sans text-[12px] font-normal uppercase leading-none text-white transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-brand-button-dark"
          >
            {hasCompletedTravellerName(travellerUser) ? (
              <span>{getTravellerInitials(travellerUser)}</span>
            ) : (
              <User className="size-5" strokeWidth={2.3} />
            )}
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
      className={cn(
        "relative isolate z-[2147483647] h-[60px] sm:h-[84px] [@media(max-height:600px)]:sm:h-[76px]",
        // The empty spacer must not cover the navigation rendered in the portal.
        headerPortalTarget && "pointer-events-none"
      )}
    >
      {headerPortalTarget ? createPortal(headerContent, headerPortalTarget) : headerContent}
      {isHeaderReady ? (
        <MobileHeaderDrawer
          triggerRef={menuButtonRef}
          isOpen={isMobileMenuOpen}
          traveller={travellerUser}
          loginHref={loginHref}
          accountHref={accountHref}
          tourMenuColumns={activeTourColumns}
          indianItems={activeIndianDestinations}
          internationalItems={activeInternationalDestinations}
          cityItems={activeTopCities}
          onClose={() => setIsMobileMenuOpen(false)}
          onSignOut={handleSignOut}
        />
      ) : null}
    </div>
  );
}
