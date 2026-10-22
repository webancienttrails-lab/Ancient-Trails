"use client";

import { SiteLogo } from "@/components/site-logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Heart,
  Home,
  LogOut,
  Mail,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { clearTravellerSession } from "@/lib/auth";
import {
  defaultSiteContactSettings,
  getContactCallDisplay,
  getContactEmailDisplay,
  getMailtoHref,
  getPublicSiteSettings,
  getTelephoneHref,
  type SiteContactSettings,
} from "@/lib/site-settings";

type UserSidebarItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
  separatorBefore?: boolean;
};

const defaultSidebarItems: UserSidebarItem[] = [
  { label: "My Dashboard", href: "/me", icon: Home },
  { label: "My Bookings", href: "/me/bookings", icon: CalendarCheck },
  { label: "Wishlist", href: "/me/wishlist", icon: Heart },
  { label: "My Account", href: "/me/account", icon: UserRound },
 
];

type UserAvatarProps = {
  size?: "sm" | "md" | "lg";
  initials?: string;
  imageSrc?: string;
  alt?: string;
};

export function UserAvatar({
  size = "md",
  initials = "SB",
  imageSrc = "",
  alt = "Traveller profile",
}: UserAvatarProps) {
  const sizeClass =
    size === "lg" ? "size-[72px]" : size === "sm" ? "size-11" : "size-14";
  const textClass =
    size === "lg" ? "text-[25px]" : size === "sm" ? "text-[18px]" : "text-[20px]";
  const avatarInitials = initials.trim().slice(0, 2).toUpperCase() || "SB";

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#323232,#9b3b13)] text-white shadow-[0_10px_24px_rgba(50,50,50,0.16)]`}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={alt} className="size-full object-cover" />
      ) : (
        <span className={`font-heading ${textClass} font-bold leading-none`}>
          {avatarInitials}
        </span>
      )}
    </span>
  );
}

function SidebarItem({ item }: { item: UserSidebarItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href ?? "#"}
      className={`group flex h-10 items-center gap-4 rounded-[7px] px-5 font-sans text-[15px] font-medium transition-colors ${
        item.active
          ? "border-l-2 border-primary bg-primary/10 font-bold text-primary"
          : "text-secondary hover:bg-primary/8 hover:text-primary"
      }`}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

type UserSidebarProps = {
  activeLabel?: string;
  items?: UserSidebarItem[];
};

export function UserSidebar({
  activeLabel = "My Dashboard",
  items = defaultSidebarItems,
}: UserSidebarProps) {
  const router = useRouter();
  const toast = useToast();
  const [siteContact, setSiteContact] = useState<SiteContactSettings>(
    defaultSiteContactSettings
  );
  const sidebarItems = items.map((item) => ({
    ...item,
    active: item.active ?? item.label === activeLabel,
  }));
  const callDisplay = getContactCallDisplay(siteContact);
  const callNumber =
    siteContact.primaryCalling ||
    siteContact.landline ||
    defaultSiteContactSettings.primaryCalling;
  const emailAddress = getContactEmailDisplay(siteContact);

  useEffect(() => {
    let isMounted = true;

    async function loadSiteSettings() {
      try {
        const response = await getPublicSiteSettings();

        if (isMounted) {
          setSiteContact(response.data.settings.contact);
        }
      } catch {
        if (isMounted) {
          setSiteContact(defaultSiteContactSettings);
        }
      }
    }

    loadSiteSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignOut = () => {
    clearTravellerSession();
    toast.success("Logged out", "You have been signed out successfully.");
    router.push("/");
  };

  return (
    <aside className="hidden h-screen max-h-screen overflow-hidden border-r border-border bg-white/88 lg:sticky lg:top-0 lg:flex lg:flex-col">
      <div className="px-8 pb-4 pt-5">
        <Link href="/" aria-label="Ancient Trails home">
          <SiteLogo
            alt="Ancient Trails"
            width={218}
            height={86}
            priority
            className="h-[72px] w-auto max-w-full object-contain"
          />
        </Link>
      </div>

      <nav className="mt-5 space-y-0.5 px-3">
        {sidebarItems.map((item) => (
          <div key={item.label}>
            {item.separatorBefore ? <div className="my-3 border-t border-border" /> : null}
            <SidebarItem item={item} />
          </div>
        ))}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-[8px] border border-border bg-white p-4 shadow-[0_16px_40px_rgba(50,50,50,0.05)]">
          <p className="font-heading text-[15px] font-bold leading-snug text-secondary">
            Need help with your trips?
          </p>
          <p className="mt-1.5 font-sans text-[11px] leading-[1.35] text-secondary/70">
            We&apos;re here to assist you before your departure.
          </p>
          <div className="mt-3 space-y-2.5">
            <a
              href={getTelephoneHref(callNumber)}
              className="flex items-center gap-3 font-sans text-[12px] font-semibold text-secondary"
            >
              <Phone className="size-4 text-secondary/80" strokeWidth={1.8} />
              {callDisplay || callNumber}
            </a>
            <a
              href={getMailtoHref(emailAddress)}
              className="flex min-w-0 items-center gap-3 font-sans text-[12px] font-semibold text-secondary"
            >
              <Mail className="size-4 shrink-0 text-secondary/80" strokeWidth={1.8} />
              <span className="truncate">{emailAddress}</span>
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[7px] border border-primary/30 bg-primary/10 font-sans text-[14px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          <LogOut className="size-4" strokeWidth={1.9} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
