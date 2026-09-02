"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  Heart,
  Home,
  Landmark,
  LogOut,
  Mail,
  Menu,
  Mountain,
  Phone,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DestinationsMegaMenu,
  ToursMegaMenu,
} from "@/components/layout/header";
import { useToast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/user-dashboard/user-sidebar";
import {
  clearTravellerSession,
  getTravellerSession,
  listenForTravellerSessionChanges,
  type TravellerUser,
} from "@/lib/auth";
import {
  getHomeMediaUrl,
  listPublicMegaMenu,
  type PublicMegaMenuContent,
  type PublicMegaMenuDestinationReference,
  type PublicMegaMenuTourReference,
} from "@/lib/home-travel";
import {
  getDestinationHref,
  getDestinationsHref,
  getTourHref,
} from "@/lib/routes";
import {
  getStoredProfilePhoto,
  listenForProfilePhotoChanges,
} from "@/lib/profile-photo";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Tours", href: "/tours" },
  { label: "Destinations", href: "/destinations" },
  { label: "Experiences", href: "/experiences" },
  { label: "Tour Calendar", href: "/tour-calendar" },
];

const tourMenuColumns = [
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

const indianDestinationImages = [
  "/home assets/destination/North_d.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Amritsar.webp",
  "/home assets/Khajuraho.webp",
];

const internationalDestinationImages = [
  "/home assets/Vietnam.webp",
  "/home assets/Indonesia.webp",
  "/home assets/Egypt.webp",
  "/home assets/Special_Tour/Assam.png",
  "/home assets/Combodia.webp",
];

const topCityImages = [
  "/home assets/destination/Amritsar.webp",
  "/home assets/destination/hawa-mahal.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Khajuraho.webp",
  "/home assets/Egypt.webp",
  "/home assets/Indonesia.webp",
  "/home assets/Egypt.webp",
  "/home assets/destination/Hampi.webp",
];

const accountMenuItems = [
  {
    title: "My Account",
    description: "Manage your profile details.",
    href: "/me/account",
    icon: UserRound,
  },
  {
    title: "My Bookings",
    description: "View your bookings.",
    href: "/me/bookings",
    icon: CalendarCheck,
  },
  {
    title: "Wishlist",
    description: "Saved tours and experiences.",
    href: "/me/wishlist",
    icon: Heart,
  },
];

const mobileMenuItems: Array<{
  title: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "My Dashboard",
    href: "/me",
    icon: Home,
  },
  ...accountMenuItems.map(({ title, href, icon }) => ({ title, href, icon })),
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
) {
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
) {
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

function getTravellerDisplayName(user: TravellerUser | null) {
  if (!user) {
    return "Traveller";
  }

  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || user.email.split("@")[0] || "Traveller";
}

function getTravellerInitials(user: TravellerUser | null) {
  const displayName = getTravellerDisplayName(user);
  const nameParts = displayName.split(/\s+/).filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`;
  }

  return displayName.slice(0, 2);
}

function getTravellerEmail(user: TravellerUser | null) {
  return user?.email || "traveller@ancienttrails.com";
}

function AccountPopup({
  isOpen,
  traveller,
  profilePhoto,
  onSignOut,
}: {
  isOpen: boolean;
  traveller: TravellerUser;
  profilePhoto: string;
  onSignOut: () => void;
}) {
  const displayName = getTravellerDisplayName(traveller);
  const displayEmail = getTravellerEmail(traveller);
  const initials = getTravellerInitials(traveller);

  return (
    <div
      className={`absolute right-0 top-[calc(100%+14px)] z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-primary/20 bg-white text-secondary shadow-[0_24px_60px_rgba(35,24,16,0.2)] ring-1 ring-white transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1.5 opacity-0"
      }`}
    >
      <div className="flex items-center gap-4 border-b border-border px-5 py-5">
        <UserAvatar
          size="md"
          initials={initials}
          imageSrc={profilePhoto}
          alt={`${displayName} profile`}
        />
        <div className="min-w-0">
          <p className="truncate font-heading text-[22px] font-bold leading-tight text-secondary">
            {displayName}
          </p>
          <p className="mt-1 truncate font-sans text-[12px] text-secondary/65">
            {displayEmail}
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-3">
          {accountMenuItems.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group/account-menu flex items-start gap-3 rounded-[7px] px-2 py-1.5 transition-colors hover:bg-primary/8"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-[14px] font-semibold leading-tight text-secondary transition-colors group-hover/account-menu:text-primary">
                  {title}
                </span>
                <span className="mt-1 block font-sans text-[12px] leading-snug text-secondary/65">
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
        className="flex w-full items-center gap-3 border-t border-border bg-[#fbf0e8] px-5 py-4 font-sans text-[15px] font-semibold text-secondary transition-colors hover:bg-primary hover:text-white"
      >
        <LogOut className="size-5" strokeWidth={1.8} />
        Log Out
      </button>
    </div>
  );
}

function MobileDashboardDrawer({
  isOpen,
  traveller,
  profilePhoto,
  onClose,
  onSignOut,
}: {
  isOpen: boolean;
  traveller: TravellerUser | null;
  profilePhoto: string;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const displayName = getTravellerDisplayName(traveller);
  const displayEmail = getTravellerEmail(traveller);
  const initials = getTravellerInitials(traveller);

  const drawer = (
    <div
      className={`fixed inset-0 z-[220] lg:hidden ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close dashboard menu"
        onClick={onClose}
        className={`absolute inset-0 bg-secondary/42 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        className={`absolute left-0 top-0 flex h-[100svh] max-h-[100svh] w-[min(340px,calc(100vw-1.25rem))] flex-col overflow-hidden border-r border-border bg-white shadow-[0_26px_80px_rgba(35,24,16,0.22)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <Link href="/" aria-label="Ancient Trails home" onClick={onClose}>
            <Image
              src="/Header Logo.png"
              alt="Ancient Trails"
              width={218}
              height={86}
              className="h-10 w-auto"
            />
          </Link>
          <Button
            type="button"
            aria-label="Close dashboard menu"
            variant="outline"
            size="icon-lg"
            className="size-10 rounded-full text-secondary hover:text-primary"
            onClick={onClose}
          >
            <X className="size-5" strokeWidth={1.9} />
          </Button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              size="sm"
              initials={initials}
              imageSrc={profilePhoto}
              alt={`${displayName} profile`}
            />
            <div className="min-w-0">
              <p className="truncate font-heading text-[19px] font-bold leading-tight text-secondary">
                {displayName}
              </p>
              <p className="mt-1 truncate font-sans text-[12px] text-secondary/65">
                {displayEmail}
              </p>
            </div>
          </div>
        </div>

        <nav className="px-4 py-2">
          <div className="space-y-0.5">
            {mobileMenuItems.map(({ title, href, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                onClick={onClose}
                className="group/mobile-menu flex h-11 items-center gap-3 rounded-[7px] px-2.5 transition-colors hover:bg-primary/8"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block font-sans text-[14px] font-semibold leading-tight text-secondary transition-colors group-hover/mobile-menu:text-primary">
                    {title}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-auto px-5 pb-3">
          <div className="rounded-[8px] border border-border bg-[#fff8f0] p-3">
            <p className="font-heading text-[14px] font-bold leading-snug text-secondary">
              Need help with your trips?
            </p>
            <div className="mt-2 space-y-1.5">
              <a
                href="tel:18003135555"
                className="flex items-center gap-2.5 font-sans text-[12px] font-semibold text-secondary"
              >
                <Phone className="size-3.5 text-secondary/80" strokeWidth={1.8} />
                1800 313 5555
              </a>
              <a
                href="mailto:travel@ancienttrails.com"
                className="flex min-w-0 items-center gap-2.5 font-sans text-[12px] font-semibold text-secondary"
              >
                <Mail className="size-3.5 shrink-0 text-secondary/80" strokeWidth={1.8} />
                <span className="truncate">travel@ancienttrails.com</span>
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[7px] border border-primary/30 bg-primary/10 font-sans text-[14px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <LogOut className="size-4" strokeWidth={1.9} />
            Log Out
          </button>
        </div>
      </aside>
    </div>
  );

  return typeof document === "undefined"
    ? null
    : createPortal(drawer, document.body);
}

export function DashboardTopBar() {
  const router = useRouter();
  const toast = useToast();
  const [travellerUser, setTravellerUser] = useState<TravellerUser | null>(
    null
  );
  const [profilePhoto, setProfilePhoto] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);
  const [megaMenuContent, setMegaMenuContent] =
    useState<PublicMegaMenuContent | null>(null);
  const accountMenuCloseTimeoutRef = useRef(0);
  const hasConfiguredMegaMenu = hasMegaMenuSettings(megaMenuContent);
  const activeTourColumns = useMemo(() => {
    if (!hasConfiguredMegaMenu || !megaMenuContent) {
      return undefined;
    }

    return [
      {
        ...tourMenuColumns[0],
        items: buildTourMenuItems(
          megaMenuContent.tourMenu.heritageTours,
          tourMenuColumns[0].items.map((item) => item.image)
        ),
      },
      {
        ...tourMenuColumns[1],
        items: buildTourMenuItems(
          megaMenuContent.tourMenu.shortTrails,
          tourMenuColumns[1].items.map((item) => item.image)
        ),
      },
    ];
  }, [hasConfiguredMegaMenu, megaMenuContent]);
  const activeIndianDestinations = useMemo(
    () =>
      hasConfiguredMegaMenu && megaMenuContent
        ? buildDestinationMenuItems(
            megaMenuContent.destinationMenu.india,
            indianDestinationImages
          )
        : undefined,
    [hasConfiguredMegaMenu, megaMenuContent]
  );
  const activeInternationalDestinations = useMemo(
    () =>
      hasConfiguredMegaMenu && megaMenuContent
        ? buildDestinationMenuItems(
            megaMenuContent.destinationMenu.international,
            internationalDestinationImages
          )
        : undefined,
    [hasConfiguredMegaMenu, megaMenuContent]
  );
  const activeTopCities = useMemo(
    () =>
      hasConfiguredMegaMenu && megaMenuContent
        ? buildCityMenuItems(
            megaMenuContent.destinationMenu.topCities,
            topCityImages
          )
        : undefined,
    [hasConfiguredMegaMenu, megaMenuContent]
  );

  useEffect(() => {
    const syncTravellerSession = () => {
      const user = getTravellerSession()?.user ?? null;

      setTravellerUser(user);
      setProfilePhoto(getStoredProfilePhoto(user?.id));
    };

    syncTravellerSession();

    const stopSessionListener =
      listenForTravellerSessionChanges(syncTravellerSession);
    const stopPhotoListener = listenForProfilePhotoChanges(syncTravellerSession);

    return () => {
      stopSessionListener();
      stopPhotoListener();
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(accountMenuCloseTimeoutRef.current);
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
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const displayName = getTravellerDisplayName(travellerUser);
  const initials = getTravellerInitials(travellerUser);
  const openAccountMenu = () => {
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    setHoveredNavItem(null);
    setIsAccountMenuOpen(Boolean(travellerUser));
  };
  const closeAccountMenu = () => {
    window.clearTimeout(accountMenuCloseTimeoutRef.current);
    accountMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsAccountMenuOpen(false);
    }, 160);
  };
  const handleSignOut = () => {
    clearTravellerSession();
    setTravellerUser(null);
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
    toast.success("Logged out", "You have been signed out successfully.");
    router.push("/");
  };

  return (
    <header
      onMouseLeave={() => setHoveredNavItem(null)}
      className="sticky top-0 isolate z-[120] border-b border-border bg-white/95 backdrop-blur"
    >
      <div className="flex min-h-[78px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 lg:hidden">
          <Button
            type="button"
            aria-label="Open dashboard menu"
            variant="outline"
            size="icon-lg"
            className="rounded-full text-secondary hover:text-primary"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="size-5" strokeWidth={1.9} />
          </Button>
          <Image
            src="/Header Logo.png"
            alt="Ancient Trails"
            width={218}
            height={86}
            className="h-11 w-auto"
          />
        </div>

        <nav className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-10 text-header font-medium text-accent">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onMouseEnter={() => {
                    setHoveredNavItem(
                      item.label === "Tours" || item.label === "Destinations"
                        ? item.label
                        : null
                    );
                  }}
                  onFocus={() => {
                    setHoveredNavItem(
                      item.label === "Tours" || item.label === "Destinations"
                        ? item.label
                        : null
                    );
                  }}
                  className={`transition-colors hover:text-primary ${
                    item.label === hoveredNavItem ? "text-primary" : ""
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <span
          aria-hidden="true"
          className={`absolute left-0 right-0 top-full h-4 ${
            hoveredNavItem ? "block" : "hidden"
          }`}
        />
        <ToursMegaMenu
          isOpen={hoveredNavItem === "Tours"}
          tourMenuColumns={activeTourColumns}
        />
        <DestinationsMegaMenu
          cityItems={activeTopCities}
          indianItems={activeIndianDestinations}
          internationalItems={activeInternationalDestinations}
          isOpen={hoveredNavItem === "Destinations"}
        />

        <div className="ml-auto flex items-center gap-4">
          <Button
            type="button"
            aria-label="Notifications"
            variant="ghost"
            size="icon-lg"
            className="relative rounded-full text-secondary hover:text-primary"
          >
            <Bell className="size-5" strokeWidth={1.9} />
            <span className="absolute right-1.5 top-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold leading-none text-white">
              3
            </span>
          </Button>
          <div
            className="relative hidden sm:block"
            onMouseEnter={openAccountMenu}
            onMouseLeave={closeAccountMenu}
            onFocus={openAccountMenu}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                closeAccountMenu();
              }
            }}
          >
            <button
              type="button"
              className="flex items-center gap-3 rounded-full px-1.5 py-1 transition-colors hover:bg-primary/8"
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
            >
              <UserAvatar
                size="sm"
                initials={initials}
                imageSrc={profilePhoto}
                alt={`${displayName} profile`}
              />
              <span className="max-w-[170px] truncate font-sans text-[14px] font-semibold text-secondary">
                {displayName}
              </span>
              <ChevronDown className="size-4 text-secondary/70" strokeWidth={1.9} />
            </button>

            {travellerUser ? (
              <>
                <span
                  aria-hidden="true"
                  className={`absolute right-0 top-full h-[18px] w-[min(380px,calc(100vw-2rem))] ${
                    isAccountMenuOpen ? "block" : "hidden"
                  }`}
                />
                <AccountPopup
                  isOpen={isAccountMenuOpen}
                  traveller={travellerUser}
                  profilePhoto={profilePhoto}
                  onSignOut={handleSignOut}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <MobileDashboardDrawer
        isOpen={isMobileMenuOpen}
        traveller={travellerUser}
        profilePhoto={profilePhoto}
        onClose={() => setIsMobileMenuOpen(false)}
        onSignOut={handleSignOut}
      />
    </header>
  );
}
