"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Binoculars,
  CalendarDays,
  Compass,
  Globe2,
  Headphones,
  Landmark,
  MapPin,
  Mountain,
  Plane,
  Route,
  Users,
  User,
} from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { ButtonArrow } from "@/components/ui/button";

const navItems = [
  "Home",
  "About",
  "Tours",
  "Destinations",
  "Experiences",
  "Tour Calendar",
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
    title: "Cultural Tours",
    icon: Users,
    items: [
      { title: "Kashmir", image: "/home assets/Haridwar.webp" },
      { title: "Kerala Tour", image: "/home assets/destination/Hampi.webp" },
      { title: "Vaishnavdevi", image: "/home assets/destination/Hoysalas.webp" },
      { title: "White Spiti", image: "/home assets/destination/North_d.webp" },
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

const destinationActions = [
  {
    title: "Not sure where to go?",
    text: "Take our quiz and get inspired",
    icon: Compass,
  },
  {
    title: "Check our tour calendar",
    text: "Find upcoming tours by destination",
    icon: CalendarDays,
  },
  {
    title: "Need help choosing?",
    text: "Talk to our travel experts",
    icon: Headphones,
  },
];

function MenuArrow({ className = "" }: { className?: string }) {
  return <ArrowRight className={`size-4 ${className}`} strokeWidth={1.8} />;
}

type DestinationLink = {
  title: string;
  description: string;
  image: string;
};

function DestinationListItem({ item }: { item: DestinationLink }) {
  return (
    <li>
      <a
        href="#"
        className="group/destination grid grid-cols-[72px_minmax(0,1fr)_16px] items-center gap-3 rounded-[5px] py-1 pr-1 text-secondary transition-colors hover:text-primary"
      >
        <span className="relative h-[54px] overflow-hidden rounded-[5px] bg-muted">
          <Image
            src={item.image}
            alt=""
            fill
            sizes="72px"
            className="object-cover transition-transform duration-500 group-hover/destination:scale-105"
          />
        </span>
        <span className="min-w-0">
          <span className="block font-sans text-[13px] font-bold leading-none text-secondary transition-colors group-hover/destination:text-primary">
            {item.title}
          </span>
          <span className="mt-1 block font-sans text-[10px] leading-[1.25] text-secondary/75">
            {item.description}
          </span>
        </span>
        <MenuArrow className="text-primary" />
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
}: {
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  items: DestinationLink[];
  footer: string;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fbf0e8] text-primary">
          <Icon className="size-5" strokeWidth={1.7} />
        </span>
        <div>
          <h3 className="font-heading text-[17px] font-bold leading-none text-accent">
            {title}
          </h3>
          <p className="mt-1 font-sans text-[10px] font-medium text-secondary/70">
            {subtitle}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <DestinationListItem key={item.title} item={item} />
        ))}
      </ul>

      <a
        href="#"
        className="mt-4 flex items-center justify-between font-sans text-[12px] font-semibold text-primary"
      >
        {footer}
        <MenuArrow />
      </a>
    </div>
  );
}

function CityTile({ city }: { city: (typeof topCities)[number] }) {
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
        className="object-cover transition-transform duration-500 group-hover/city:scale-105"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/15 to-transparent" />
      <span className="absolute bottom-2 left-2 font-sans text-[11px] font-semibold text-white">
        {city.title}
      </span>
    </a>
  );
}

function DestinationsMegaMenu({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={`absolute left-0 right-0 top-[calc(100%+12px)] z-[9999] mx-auto w-full max-w-[1300px] origin-top transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0 blur-[2px]"
      }`}
    >
      <div className="overflow-hidden rounded-[10px] border border-primary/15 bg-white shadow-[0_18px_45px_rgba(50,50,50,0.18)]">
        <div className="grid min-h-[445px] lg:grid-cols-[240px_1fr_1fr_280px]">
          <div className="relative overflow-hidden bg-[#fbf0e8] p-7">
            <p className="font-sans text-[14px] font-semibold text-accent">
              Explore Destinations
            </p>
            <span className="mt-5 block h-px w-8 bg-primary" />
            <p className="mt-5 max-w-[170px] font-sans text-[12px] leading-[1.42] text-accent">
              From India&apos;s living heritage to cultural landmarks around
              the world, find the trail that calls you next.
            </p>
            <Image
              src="/home assets/About_trails.webp"
              alt=""
              fill
              sizes="240px"
              aria-hidden="true"
              className="pointer-events-none translate-y-24 object-cover object-left-bottom opacity-20 mix-blend-multiply"
            />
            <button
              type="button"
              className="group/button relative mt-[210px] flex h-9 w-[178px] items-center justify-between rounded-full border border-primary bg-white px-5 font-sans text-[12px] text-primary transition-colors hover:bg-primary hover:text-white"
            >
              View all Destinations
              <ButtonArrow className="h-2.5 w-6 group-hover/button:brightness-0 group-hover/button:invert" />
            </button>
          </div>

          <DestinationSection
            icon={Plane}
            title="India"
            subtitle="Explore Incredible India"
            items={indianDestinations}
            footer="View all Indian states"
          />

          <div className="border-l border-primary/15">
            <DestinationSection
              icon={Globe2}
              title="International"
              subtitle="Discover the World"
              items={internationalDestinations}
              footer="View all countries"
            />
          </div>

          <div className="border-l border-primary/15 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fbf0e8] text-primary">
                <MapPin className="size-5" strokeWidth={1.7} />
              </span>
              <div>
                <h3 className="font-heading text-[17px] font-bold leading-none text-accent">
                  Top Cities
                </h3>
                <p className="mt-1 font-sans text-[10px] font-medium text-secondary/70">
                  Popular Cities Worldwide
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {topCities.map((city) => (
                <CityTile key={city.title} city={city} />
              ))}
            </div>

            <a
              href="#"
              className="mt-4 flex items-center justify-between font-sans text-[12px] font-semibold text-primary"
            >
              View all cities
              <MenuArrow />
            </a>
          </div>
        </div>

        <div className="grid border-t border-primary/15 bg-white lg:grid-cols-3">
          {destinationActions.map(({ title, text, icon: Icon }, index) => (
            <a
              key={title}
              href="#"
              className={`group/action flex min-h-[78px] items-center gap-4 px-6 py-4 ${
                index > 0 ? "border-l border-primary/15" : ""
              }`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/25 text-primary">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <span className="grid flex-1 grid-cols-[1fr_16px] items-center gap-4">
                <span>
                  <span className="block font-sans text-[11px] font-semibold leading-[1.2] text-secondary">
                    {title}
                  </span>
                  <span className="mt-1 block max-w-[150px] font-sans text-[10px] leading-[1.25] text-secondary/75">
                    {text}
                  </span>
                </span>
                <MenuArrow className="text-primary transition-transform group-hover/action:translate-x-1" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToursMegaMenu({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={`absolute left-0 right-0 top-[calc(100%+12px)] z-[9999] mx-auto w-full max-w-[1300px] origin-top transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0 blur-[2px]"
      }`}
    >
      <div className="grid min-h-[330px] overflow-hidden rounded-[10px] border border-primary/15 bg-white shadow-[0_18px_45px_rgba(50,50,50,0.18)] lg:grid-cols-[240px_repeat(3,minmax(0,1fr))_repeat(2,205px)]">
        <div className="relative overflow-hidden bg-[#fbf0e8] p-7">
          <p className="font-sans text-[14px] font-semibold text-accent">
            Our Tours
          </p>
          <span className="mt-3 block h-px w-8 bg-primary" />
          <p className="mt-4 max-w-[175px] font-sans text-[12px] leading-[1.45] text-accent">
            Ancient Trails is for travellers who want more than sightseeing.
          </p>
          <span className="mt-5 block h-px w-8 bg-primary" />
          <p className="mt-4 max-w-[175px] font-sans text-[12px] leading-[1.45] text-accent">
            Each tour blends history, culture and leisure, with experts who
            help you understand every place beyond the usual route.
          </p>
          <Image
            src="/home assets/About_trails.webp"
            alt=""
            fill
            sizes="230px"
            aria-hidden="true"
            className="pointer-events-none object-cover object-left-bottom opacity-20 mix-blend-multiply"
          />
          <button
            type="button"
            className="group/button relative mt-8 flex h-9 w-[155px] items-center justify-between rounded-full border border-primary bg-white px-5 font-sans text-[12px] text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Plan your trip
            <ButtonArrow className="h-2.5 w-6 group-hover/button:brightness-0 group-hover/button:invert" />
          </button>
        </div>

        {tourColumns.map(({ title, icon: Icon, items }) => (
          <div
            key={title}
            className="border-l border-primary/15 px-6 py-6"
          >
            <div className="flex min-h-[44px] items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fbf0e8] text-primary">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <h3 className="font-heading text-[16px] font-bold leading-[1.08] text-accent">
                {title}
              </h3>
            </div>

            <ul className="mt-5 space-y-4">
              {items.map((item) => (
                <li key={`${title}-${item.title}`}>
                  <a
                    href="#"
                    className="group/tour grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 font-sans text-[13px] leading-[1.15] text-secondary transition-colors hover:text-primary"
                  >
                    <span className="relative size-[52px] shrink-0 overflow-hidden rounded-[5px] bg-muted">
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="52px"
                        className="object-cover transition-transform duration-500 group-hover/tour:scale-105"
                      />
                    </span>
                    <span>{item.title}</span>
                  </a>
                </li>
              ))}
            </ul>

            <a
              href="#"
              className="mt-8 inline-flex flex-col font-sans text-[12px] font-semibold text-primary"
            >
              And more +
              <span className="mt-2 h-px w-8 bg-primary" />
            </a>
          </div>
        ))}

        {featuredTours.map(({ title, subtitle, image, icon: Icon }) => (
          <div
            key={title}
            className="border-l border-primary/15 px-6 py-6"
          >
            <div className="flex min-h-[44px] items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fbf0e8] text-primary">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <h3 className="font-heading text-[16px] font-bold leading-[1.08] text-accent">
                {title}
              </h3>
            </div>

            <a
              href="#"
              className="group/feature mt-5 block"
            >
              <span className="relative block h-[190px] overflow-hidden rounded-[7px] bg-muted">
                <Image
                  src={image}
                  alt={`${title} preview`}
                  fill
                  sizes="205px"
                  className="object-cover transition-transform duration-500 group-hover/feature:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-secondary/25 to-transparent" />
              </span>
              <span className="mt-6 flex items-end justify-between gap-4">
                <span className="min-w-0">
                  <span className="block font-sans text-[12px] font-semibold text-primary">
                    {title}
                  </span>
                  <span className="mt-1 block max-w-[130px] font-sans text-[11px] leading-[1.15] text-accent">
                    {subtitle}
                  </span>
                </span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary text-primary transition-colors group-hover/feature:bg-primary group-hover/feature:text-white">
                  <ArrowRight className="size-4" strokeWidth={2} />
                </span>
              </span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Header() {
  const activeItem = "Home";
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [underlineStyle, setUnderlineStyle] = useState({
    opacity: 0,
    transform: "translate3d(0, 0, 0)",
  });
  const navRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

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

    setUnderlineStyle({
      opacity: 1,
      transform: `translate3d(${left}px, 0, 0)`,
    });
  }, [hoveredItem]);

  useLayoutEffect(() => {
    updateUnderline();

    window.addEventListener("resize", updateUnderline);

    return () => {
      window.removeEventListener("resize", updateUnderline);
    };
  }, [updateUnderline]);

  return (
    <header
      onMouseLeave={() => setHoveredItem(null)}
      className="relative z-[9999] flex items-center justify-between rounded-[18px] bg-white/95 px-5 py-2 backdrop-blur sm:py-3 md:px-6 [@media(max-height:600px)]:py-2"
    >
      <Link href="/" aria-label="Ancient Trails home" className="shrink-0">
        <Image
          src="/Header Logo.png"
          alt="Ancient Trails"
          width={218}
          height={86}
          priority
          className="h-11 w-auto sm:h-13 [@media(max-height:600px)]:h-10"
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
                className={`relative transition-colors hover:text-primary ${
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
            className="pointer-events-none absolute -bottom-3 left-0 h-[3px] w-[57px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={underlineStyle}
          />
        </ul>
      </nav>

      <ToursMegaMenu isOpen={hoveredItem === "Tours"} />
      <DestinationsMegaMenu isOpen={hoveredItem === "Destinations"} />

      <a
        href="/login"
        className="flex items-center gap-2 text-header font-medium text-accent transition-colors hover:text-primary"
      >
        Login
        <User className="size-4 fill-primary text-primary" strokeWidth={2.3} />
      </a>
    </header>
  );
}
