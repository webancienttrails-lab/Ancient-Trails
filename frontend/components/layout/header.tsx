"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Binoculars,
  CalendarCheck,
  Gift,
  Globe2,
  Landmark,
  LogOut,
  MapPin,
  Mountain,
  Plane,
  PlayCircle,
  Route,
  ShoppingCart,
  User,
  UserRound,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ButtonArrow } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  clearTravellerSession,
  getTravellerSession,
  listenForTravellerSessionChanges,
  type TravellerUser,
} from "@/lib/auth";

const navItems = [
  "Home",
  "About",
  "Tours",
  "Destinations",
  "Experiences",
  "Tour Calendar",
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
  {
    title: "My Holiday Cart",
    description: "Complete your pending payments here.",
    href: "/me/holiday-cart",
    icon: ShoppingCart,
  },
  {
    title: "Gift Cards",
    description: "Your purchase history.",
    href: "/me/gift-cards",
    icon: Gift,
  },
  {
    title: "Pre-departure Videos",
    description: "Key tips for a smooth journey",
    href: "#",
    icon: PlayCircle,
  },
];

const tourColumns = [
  {
    title: "Heritage Tours",
    icon: Landmark,
    items: [
      { title: "Kerala Tour", image: "/home assets/Khajuraho.webp" },
      { title: "Vaishnavdevi", image: "/home assets/destination/Varanasi.webp" },
      { title: "White Spiti", image: "/home assets/destination/North_d.webp" },
      { title: "Kashmir", image: "/home assets/Haridwar.webp" },
    ],
  },
  {
    title: "Short Trails",
    icon: Mountain,
    items: [
      { title: "Kerala Tour", image: "/home assets/destination/Hampi.webp" },
      { title: "Vaishnavdevi", image: "/home assets/destination/Udaipur.webp" },
      { title: "White Spiti", image: "/home assets/destination/North_d.webp" },
      { title: "Kashmir", image: "/home assets/Haridwar.webp" },
    ],
  },
];

const featuredTours = [
  {
    title: "Customised Tours",
    subtitle: "Explore Heritage Beyond Borders",
    image: "/home assets/destination/hawa-mahal.webp",
    icon: Route,
  },
  {
    title: "Specialised Tours",
    subtitle: "Designed Around Your Interests",
    image: "/home assets/Special_Tour/Assam.png",
    icon: Binoculars,
  },
];

const indianDestinations = [
  {
    title: "North India",
    description: "Jammu & Kashmir, Himachal Pradesh, Uttarakhand, Punjab...",
    image: "/home assets/destination/North_d.webp",
  },
  {
    title: "West India",
    description: "Rajasthan, Gujarat, Maharashtra, Goa...",
    image: "/home assets/destination/hawa-mahal.webp",
  },
  {
    title: "South India",
    description: "Kerala, Tamil Nadu, Karnataka, Andhra Pradesh...",
    image: "/home assets/destination/Hampi.webp",
  },
  {
    title: "East India",
    description: "West Bengal, Odisha, Assam, Sikkim...",
    image: "/home assets/destination/Amritsar.webp",
  },
  {
    title: "Central India",
    description: "Madhya Pradesh, Chhattisgarh, Jharkhand...",
    image: "/home assets/Khajuraho.webp",
  },
];

const internationalDestinations = [
  {
    title: "Asia",
    description: "Nepal, Bhutan, Sri Lanka, Thailand, Japan...",
    image: "/home assets/Vietnam.webp",
  },
  {
    title: "Europe",
    description: "France, Italy, Greece, Spain, Switzerland...",
    image: "/home assets/Indonesia.webp",
  },
  {
    title: "Middle East",
    description: "UAE, Jordan, Egypt, Oman, Turkey...",
    image: "/home assets/Egypt.webp",
  },
  {
    title: "Africa",
    description: "Morocco, South Africa, Kenya, Tanzania...",
    image: "/home assets/Special_Tour/Assam.png",
  },
  {
    title: "Americas",
    description: "USA, Canada, Brazil, Peru, Mexico...",
    image: "/home assets/Combodia.webp",
  },
];

const topCities = [
  {
    title: "Delhi",
    image: "/home assets/destination/Amritsar.webp",
  },
  {
    title: "Jaipur",
    image: "/home assets/destination/hawa-mahal.webp",
  },
  {
    title: "Varanasi",
    image: "/home assets/destination/Varanasi.webp",
  },
  {
    title: "Agra",
    image: "/home assets/Khajuraho.webp",
  },
  {
    title: "Dubai",
    image: "/home assets/Egypt.webp",
  },
  {
    title: "Paris",
    image: "/home assets/Indonesia.webp",
  },
  {
    title: "Cairo",
    image: "/home assets/Egypt.webp",
  },
  {
    title: "Rome",
    image: "/home assets/destination/Hampi.webp",
  },
];

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
      <a
        href="#"
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
      </a>
    </li>
  );
}

function DestinationSection({
  icon: Icon,
  title,
  subtitle,
  items,
  footer,
  isOpen,
  baseDelay = 0,
}: {
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  items: DestinationLink[];
  footer: string;
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

      <a
        href="#"
        className={megaTextRevealClass(
          isOpen,
          "mt-4 flex items-center justify-between font-sans text-[14px] font-bold text-primary"
        )}
        style={megaTextRevealStyle(isOpen, baseDelay + 410)}
      >
        {footer}
        <MenuArrow />
      </a>
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
    <a
      href="#"
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
    </a>
  );
}

export function DestinationsMegaMenu({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      style={headerLayerStyle}
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
            <button
              type="button"
              className="group/button relative mt-[210px] flex h-9 w-[192px] items-center justify-between gap-2 rounded-full border border-primary bg-white px-3 font-sans text-[12px] font-semibold text-primary shadow-[0_8px_18px_rgba(212,114,32,0.16)] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white"
            >
              <span
                className={megaTextRevealClass(isOpen, "whitespace-nowrap")}
                style={megaTextRevealStyle(isOpen, 280)}
              >
                View all Destinations
              </span>
              <ButtonArrow className="h-2.5 w-6 shrink-0 group-hover/button:brightness-0 group-hover/button:invert" />
            </button>
          </div>

          <DestinationSection
            icon={Plane}
            title="India"
            subtitle="Explore Incredible India"
            items={indianDestinations}
            footer="View all Indian states"
            isOpen={isOpen}
            baseDelay={110}
          />

          <div className="border-l border-primary/25">
            <DestinationSection
              icon={Globe2}
              title="International"
              subtitle="Discover the World"
              items={internationalDestinations}
              footer="View all countries"
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
              {topCities.map((city, index) => (
                <CityTile
                  key={city.title}
                  city={city}
                  isOpen={isOpen}
                  delay={320 + index * 35}
                />
              ))}
            </div>

            <a
              href="#"
              className={megaTextRevealClass(
                isOpen,
                "mt-4 flex items-center justify-between font-sans text-[14px] font-bold text-primary"
              )}
              style={megaTextRevealStyle(isOpen, 620)}
            >
              View all cities
              <MenuArrow />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToursMegaMenu({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      style={headerLayerStyle}
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
          <button
            type="button"
            className="group/button relative mt-8 flex h-9 w-full max-w-[170px] items-center justify-between gap-4 rounded-full border border-primary bg-white px-5 font-sans text-[13px] font-semibold text-primary shadow-[0_8px_18px_rgba(212,114,32,0.16)] transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary hover:text-white"
          >
            <span
              className={megaTextRevealClass(isOpen, "whitespace-nowrap")}
              style={megaTextRevealStyle(isOpen, 280)}
            >
              Plan your trip
            </span>
            <ButtonArrow className="h-2.5 w-7 shrink-0 group-hover/button:brightness-0 group-hover/button:invert" />
          </button>
        </div>

        {tourColumns.map(({ title, icon: Icon, items }, columnIndex) => {
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
                  <a
                    href="#"
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
                  </a>
                </li>
              ))}
            </ul>

            <a
              href="#"
              className={megaTextRevealClass(
                isOpen,
                "mt-8 inline-flex flex-col font-sans text-[14px] font-bold text-primary"
              )}
              style={megaTextRevealStyle(isOpen, baseDelay + 380)}
            >
              And more +
              <span className="mt-2 h-px w-8 bg-primary" />
            </a>
          </div>
          );
        })}

        {featuredTours.map(({ title, subtitle, image, icon: Icon }, columnIndex) => {
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

            <a
              href="#"
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
            </a>
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
        <p className="font-heading text-[28px] font-bold leading-[1.12] text-secondary">
          Hello, {displayName}
        </p>

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

export function Header() {
  const activeItem = "Home";
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [travellerUser, setTravellerUser] = useState<TravellerUser | null>(
    null
  );
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
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
  const accountMenuCloseTimeoutRef = useRef(0);

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
  }, [hoveredItem]);

  useLayoutEffect(() => {
    updateUnderline();

    window.addEventListener("resize", updateUnderline);

    return () => {
      window.cancelAnimationFrame(underlineFrameRef.current);
      window.clearTimeout(accountMenuCloseTimeoutRef.current);
      window.removeEventListener("resize", updateUnderline);
    };
  }, [updateUnderline]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const updateHeaderVisibility = () => {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollYRef.current;

      setHasScrolled(currentScrollY > 24);

      if (currentScrollY <= 24) {
        setIsHeaderVisible(true);
      } else if (scrollDifference > 6 && currentScrollY > 120) {
        setIsHeaderVisible(false);
      } else if (scrollDifference < -6) {
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

  const handleSignOut = () => {
    clearTravellerSession();
    setTravellerUser(null);
    setIsAccountMenuOpen(false);
    toast.success("Logged out", "You have been signed out successfully.");

    if (pathname?.startsWith("/me")) {
      router.push("/");
    }
  };
  const openAccountMenu = () => {
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    setHoveredItem(null);
    setIsAccountMenuOpen(Boolean(travellerUser));
  };
  const closeAccountMenu = () => {
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    accountMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsAccountMenuOpen(false);
    }, 160);
  };

  const loginHref =
    pathname && pathname !== "/login"
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";
  const accountHref = travellerUser ? "/me" : loginHref;
  const shouldShowHeader = isHeaderVisible || Boolean(hoveredItem);
  const headerTopClass = hasScrolled
    ? "top-[clamp(0.5rem,2vh,1rem)]"
    : "top-[clamp(1rem,4vh,2.25rem)]";

  return (
    <div
      style={headerLayerStyle}
      className="relative isolate z-[2147483647] h-[60px] sm:h-[84px] [@media(max-height:600px)]:sm:h-[76px]"
    >
    <header
      style={headerLayerStyle}
      onMouseLeave={() => setHoveredItem(null)}
      className={`fixed left-1/2 ${headerTopClass} isolate z-[2147483647] flex w-[calc(100%-2.5rem)] max-w-[1300px] -translate-x-1/2 items-center justify-between rounded-[18px] bg-white px-5 py-2 shadow-[0_18px_55px_rgba(50,50,50,0.18)] ring-1 ring-white transition-[top,translate] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:py-3 md:px-6 [@media(max-height:600px)]:py-2 ${
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
          className="h-11 w-auto sm:h-15 [@media(max-height:600px)]:h-15"
        />
      </Link>

      <nav aria-label="Primary navigation" className="hidden lg:block">
        <ul
          ref={navRef}
          className="relative flex items-center gap-8 text-header font-medium text-accent"
        >
          {navItems.map((item) => (
            <li key={item}>
              <a
                href={item === "Home" ? "/" : "#"}
                ref={(node) => {
                  linkRefs.current[item] = node;
                }}
                onMouseEnter={() => setHoveredItem(item)}
                className={`relative transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-primary ${
                  item === (hoveredItem ?? activeItem) ? "text-primary" : ""
                }`}
              >
                {item}
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

      <ToursMegaMenu isOpen={hoveredItem === "Tours"} />
      <DestinationsMegaMenu isOpen={hoveredItem === "Destinations"} />

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
    </header>
    </div>
  );
}
