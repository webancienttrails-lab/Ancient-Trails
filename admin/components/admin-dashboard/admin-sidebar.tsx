"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChartColumn,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Newspaper,
  Settings,
  Star,
  Menu,
  X,
  UserRoundCheck,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AdminSidebarLogout } from "@/components/admin-dashboard/admin-sidebar-logout";

export type AdminSidebarItem = {
  activeLabels?: string[];
  label: string;
  href: string;
  icon: LucideIcon;
};

export const adminSidebarItems: AdminSidebarItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Booking",
    href: "/bookings",
    icon: Ticket,
    activeLabels: ["Bookings"],
  },
  {
    label: "Tours",
    href: "/tours",
    icon: CalendarDays,
  },
  {
    label: "Destination",
    href: "/destinations",
    icon: MapPin,
    activeLabels: ["Destinations"],
  },
  {
    label: "Expert",
    href: "/experts",
    icon: UserRoundCheck,
    activeLabels: ["Experts"],
  },
  {
    label: "Enquiries",
    href: "/enquiries",
    icon: MessageSquare,
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
  },
  {
    label: "Experiences",
    href: "/experiences",
    icon: Star,
    activeLabels: ["Experiences"],
  },
  {
    label: "Pages",
    href: "/pages",
    icon: FileText,
  },
  {
    label: "Blog",
    href: "/blog",
    icon: Newspaper,
    activeLabels: ["Blog / Stories"],
  },
  {
    label: "Report",
    href: "/reports",
    icon: ChartColumn,
    activeLabels: ["Reports"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

type AdminSidebarProps = {
  activeLabel?: string;
  className?: string;
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  items?: AdminSidebarItem[];
  onMobileClose?: () => void;
  onMobileToggle?: () => void;
};

export function AdminSidebar({
  activeLabel = "Dashboard",
  className,
  isCollapsed = false,
  isMobileOpen = false,
  items = adminSidebarItems,
  onMobileClose,
  onMobileToggle,
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-x-0 top-0 z-40",
        "lg:inset-y-0 lg:left-0 lg:right-auto",
        "lg:h-dvh lg:overflow-hidden",
        "lg:border-r lg:border-sidebar-border",
        "lg:bg-sidebar lg:text-sidebar-foreground",
        "lg:shadow-sm",
        "lg:transition-[width] lg:duration-300 lg:ease-out",

        isCollapsed ? "lg:w-20" : "lg:w-80",

        className
      )}
    >
      {/* ====================================================== */}
      {/* MOBILE HEADER */}
      {/* ====================================================== */}

      <div className="relative z-30 flex h-16 items-center justify-between gap-3 border-b border-sidebar-border bg-white px-4 text-sidebar-foreground shadow-sm shadow-stone-200/50 lg:hidden">
        <span className="text-sm font-bold text-foreground">
          Ancient Trails Admin
        </span>

        <button
          type="button"
          onClick={onMobileToggle}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            "border border-border bg-white text-foreground",
            "shadow-sm shadow-stone-200/40",
            "transition-colors",
            "hover:border-primary hover:text-primary"
          )}
          aria-expanded={isMobileOpen}
          aria-label={
            isMobileOpen ? "Close navigation" : "Open navigation"
          }
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* ====================================================== */}
      {/* MOBILE OVERLAY */}
      {/* ====================================================== */}

      <button
        type="button"
        aria-label="Close mobile navigation"
        onClick={onMobileClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]",
          "transition-opacity duration-300",
          "lg:hidden",

          isMobileOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      />

      {/* ====================================================== */}
      {/* MOBILE DRAWER */}
      {/* ====================================================== */}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50",
          "flex w-[min(326px,88vw)] flex-col overflow-hidden",
          "bg-primary text-white",
          "shadow-2xl shadow-stone-950/25",
          "transition-transform duration-300 ease-out",
          "lg:hidden",

          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        )}
      >
        {/* Mobile drawer header */}

        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/15 px-4">
          <Link
            href="/"
            aria-label="Ancient Trails admin dashboard"
            onClick={onMobileClose}
            className="min-w-0"
          >
            <span className="block truncate text-sm font-bold">
              Ancient Trails Admin
            </span>
          </Link>

          <button
            type="button"
            onClick={onMobileClose}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full",
              "border border-white/25",
              "bg-white/10 text-white",
              "transition-colors",
              "hover:bg-white/15"
            )}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Mobile navigation */}

        <nav className="grid flex-1 content-start gap-1 overflow-hidden px-4 py-3">
          <SidebarLinks
            activeLabel={activeLabel}
            items={items}
            mobileDrawer
            onMobileClose={onMobileClose}
          />
        </nav>

        {/* Mobile logout */}

        <div className="shrink-0 border-t border-white/15 p-3">
          <AdminSidebarLogout />
        </div>
      </div>

      {/* ====================================================== */}
      {/* DESKTOP SIDEBAR */}
      {/* ====================================================== */}

      <div
        className={cn(
          "hidden h-full flex-col",
          "p-4 sm:p-5",
          "lg:flex lg:min-h-0 lg:p-4",

          isCollapsed && "lg:items-center lg:px-3"
        )}
      >
        {/* 
          No logo here.

          Small top gap keeps first menu item visually
          aligned below the floating toggle area.
        */}

        <div className="h-[72px] shrink-0" />

        {/* Desktop navigation */}

        <nav
          className={cn(
            "flex gap-2 overflow-x-auto pb-1",
            "[-ms-overflow-style:none]",
            "[scrollbar-width:none]",

            "lg:grid",
            "lg:min-h-0",
            "lg:flex-1",
            "lg:grid-cols-1",
            "lg:content-start",
            "lg:gap-1.5",
            "lg:overflow-x-hidden",
            "lg:overflow-y-auto",
            "lg:pb-1",

            "[&::-webkit-scrollbar]:hidden",

            isCollapsed && "lg:w-full"
          )}
        >
          <SidebarLinks
            activeLabel={activeLabel}
            isCollapsed={isCollapsed}
            items={items}
          />
        </nav>

        {/* Desktop logout */}

        <div
          className={cn(
            "hidden shrink-0 border-t border-border pt-3 lg:block",
            isCollapsed && "lg:w-full"
          )}
        >
          <AdminSidebarLogout isCollapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}

function SidebarLinks({
  activeLabel,
  isCollapsed = false,
  items,
  mobileDrawer = false,
  onMobileClose,
}: {
  activeLabel: string;
  isCollapsed?: boolean;
  items: AdminSidebarItem[];
  mobileDrawer?: boolean;
  onMobileClose?: () => void;
}) {
  return items.map((item) => {
    const Icon = item.icon;

    const isActive =
      item.label === activeLabel ||
      Boolean(item.activeLabels?.includes(activeLabel));

    return (
      <Link
        key={item.label}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
        onClick={onMobileClose}
        className={cn(
          "flex h-11 shrink-0 items-center gap-3 rounded-lg",
          "border border-transparent",
          "px-3.5",
          "text-[13px] font-semibold",
          "transition-colors",

          "lg:h-9 lg:w-full lg:px-3",

          mobileDrawer
            ? "h-10 rounded-full px-3 text-sm text-white/90 hover:bg-white/15 hover:text-white"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",

          isCollapsed &&
            "lg:justify-center lg:gap-0 lg:px-0",

          isActive &&
            (mobileDrawer
              ? "border-white/25 bg-white text-primary shadow-sm hover:bg-white hover:text-primary"
              : "border-primary/25 bg-primary/10 text-primary"),

          isActive &&
            !isCollapsed &&
            !mobileDrawer &&
            "border-l-2 border-l-primary pl-3 lg:pl-2.5"
        )}
      >
        <Icon className="size-4 shrink-0" />

        <span
          className={cn(
            "truncate",
            isCollapsed && "lg:sr-only"
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  });
}