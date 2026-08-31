"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  getAdminSession,
  listenForAdminSessionChanges,
  type AdminUser,
} from "@/lib/admin-auth";

import { AdminDashboardGuard } from "./admin-dashboard-guard";
import { AdminSidebar } from "./admin-sidebar";

type AdminDashboardShellProps = {
  activeLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;

  /**
   * Optional notification count.
   * Dashboard can pass the real count.
   * Other admin pages can leave it empty.
   */
  notificationCount?: number;
  isNotificationLoading?: boolean;
};

type AdminSidebarContextValue = {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  toggleSidebar: () => void;
};

const AdminSidebarContext =
  createContext<AdminSidebarContextValue | null>(null);

function useAdminSidebar() {
  const context = useContext(AdminSidebarContext);

  if (!context) {
    return {
      closeMobileSidebar: () => {},
      isSidebarCollapsed: false,
      isMobileSidebarOpen: false,
      toggleMobileSidebar: () => {},
      toggleSidebar: () => {},
    };
  }

  return context;
}

/* =========================================================
   ADMIN USER HELPERS
========================================================= */

function getDisplayName(user: AdminUser | null) {
  if (!user) {
    return "Super Admin";
  }

  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || user.email.split("@")[0] || "Super Admin";
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || "SA";
}

/* =========================================================
   SIDEBAR TOGGLE
========================================================= */

export function AdminSidebarToggle({
  className,
}: {
  className?: string;
}) {
  const { isSidebarCollapsed, toggleSidebar } = useAdminSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "hidden size-11 shrink-0 place-items-center rounded-full",
        "border border-border bg-white text-foreground",
        "shadow-sm shadow-stone-200/60",
        "transition-[border-color,color,box-shadow] duration-300",
        "hover:border-primary hover:text-primary hover:shadow-md",
        "lg:grid",
        className
      )}
      aria-label={
        isSidebarCollapsed
          ? "Expand sidebar"
          : "Collapse sidebar"
      }
      title={
        isSidebarCollapsed
          ? "Expand sidebar"
          : "Collapse sidebar"
      }
    >
      <ChevronLeft
        className={cn(
          "size-5 transition-transform duration-300 ease-in-out",
          isSidebarCollapsed && "rotate-180"
        )}
        strokeWidth={2.5}
      />
    </button>
  );
}

/* =========================================================
   ADMIN HEADER
========================================================= */

function AdminHeader({
  notificationCount = 0,
  isNotificationLoading = false,
}: {
  notificationCount?: number;
  isNotificationLoading?: boolean;
}) {
  const [adminUser, setAdminUser] =
    useState<AdminUser | null>(null);

  useEffect(() => {
    const syncAdminUser = () => {
      setAdminUser(getAdminSession()?.user ?? null);
    };

    syncAdminUser();

    return listenForAdminSessionChanges(syncAdminUser);
  }, []);

  const displayName = getDisplayName(adminUser);
  const initials = getInitials(displayName);

  return (
    <header
      className={cn(
        "mb-0 hidden min-h-[82px] w-full",
        "items-center justify-between gap-5",
        "lg:flex"
      )}
    >
      {/* ============================= */}
      {/* LEFT - LOGO */}
      {/* ============================= */}

      <Link
        href="/"
        aria-label="Ancient Trails admin dashboard"
        className="inline-flex shrink-0 items-center"
      >
        <Image
          src="/brand/header-logo.png"
          alt="Ancient Trails"
          width={210}
          height={72}
          priority
          className="h-auto w-[180px] max-w-none object-contain"
        />
      </Link>

      {/* ============================= */}
      {/* RIGHT - ADMIN CONTROLS */}
      {/* ============================= */}

      <div className="ml-auto flex items-center gap-3">
        {/* Notification */}

        <button
          className={cn(
            "relative grid size-11 place-items-center rounded-xl",
            "border border-border bg-white text-foreground",
            "shadow-sm shadow-stone-200/30",
            "transition-all duration-200",
            "hover:border-primary hover:text-primary hover:shadow-md"
          )}
          type="button"
          aria-label="Notifications"
        >
          <Bell
            className="size-5"
            strokeWidth={1.9}
          />

          {!isNotificationLoading &&
          notificationCount > 0 ? (
            <span
              className={cn(
                "absolute -right-1 -top-1",
                "grid min-w-5 h-5 place-items-center",
                "rounded-full bg-primary px-1",
                "text-[9px] font-bold leading-none text-white",
                "ring-2 ring-[#fbf8f5]"
              )}
            >
              {notificationCount > 99
                ? "99+"
                : notificationCount}
            </span>
          ) : null}
        </button>

        {/* Admin profile */}

        <button
          className={cn(
            "flex h-11 items-center gap-2.5 rounded-xl",
            "border border-border bg-white",
            "px-2.5 pr-3",
            "text-sm font-semibold text-foreground",
            "shadow-sm shadow-stone-200/30",
            "transition-all duration-200",
            "hover:border-primary hover:shadow-md"
          )}
          type="button"
          aria-label="Admin profile"
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center",
              "rounded-full bg-[#7a3b22]",
              "text-[11px] font-bold text-white"
            )}
          >
            {initials}
          </span>

          <span className="max-w-[160px] truncate">
            {displayName}
          </span>

          <ChevronDown
            className="size-4 shrink-0 text-foreground/45"
            strokeWidth={2}
          />
        </button>
      </div>
    </header>
  );
}

/* =========================================================
   ADMIN DASHBOARD SHELL
========================================================= */

export function AdminDashboardShell({
  activeLabel = "Dashboard",
  children,
  className,
  contentClassName,
  notificationCount = 0,
  isNotificationLoading = false,
}: AdminDashboardShellProps) {
  const [
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  ] = useState(false);

  const [
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  ] = useState(false);

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false);
  }

  function toggleSidebar() {
    setIsSidebarCollapsed((value) => !value);
  }

  function toggleMobileSidebar() {
    setIsMobileSidebarOpen((value) => !value);
  }

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  return (
    <AdminDashboardGuard>
      <AdminSidebarContext.Provider
        value={{
          closeMobileSidebar,
          isMobileSidebarOpen,
          isSidebarCollapsed,
          toggleMobileSidebar,
          toggleSidebar,
        }}
      >
        <div
          className={cn(
            "admin-dashboard-shell min-h-screen overflow-x-hidden bg-[#fbf8f5] text-foreground",
            className
          )}
        >
          {/* ================================================= */}
          {/* SIDEBAR */}
          {/* ================================================= */}

          <AdminSidebar
            activeLabel={activeLabel}
            isMobileOpen={isMobileSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onMobileClose={closeMobileSidebar}
            onMobileToggle={toggleMobileSidebar}
          />

          {/* ================================================= */}
          {/* SINGLE FLOATING SIDEBAR TOGGLE */}
          {/* ================================================= */}

          <AdminSidebarToggle
            className={cn(
              "fixed top-10 z-[60]",

              /*
               * Sidebar expanded width = 320px
               * Toggle width = 44px
               *
               * 320 - 22 = 298px
               *
               * Sidebar collapsed width = 80px
               * 80 - 22 = 58px
               *
               * Therefore exactly half the button
               * overlaps the sidebar and content.
               */
              "transition-[left] duration-300 ease-out",

              isSidebarCollapsed
                ? "lg:left-[58px]"
                : "lg:left-[298px]"
            )}
          />

          {/* ================================================= */}
          {/* MAIN CONTENT */}
          {/* ================================================= */}

          <main
            className={cn(
              "admin-dashboard-main min-w-0",
              "px-2.5 pb-5 pt-[72px]",
              "transition-[margin] duration-300 ease-out",
              "sm:px-6",
              "lg:px-7 lg:py-5",

              isSidebarCollapsed
                ? "lg:ml-20"
                : "lg:ml-80",

              contentClassName
            )}
          >
            {/* ============================================= */}
            {/* TOP HEADER */}
            {/* ============================================= */}

            <AdminHeader
              notificationCount={notificationCount}
              isNotificationLoading={
                isNotificationLoading
              }
            />

            {/* ============================================= */}
            {/* PAGE CONTENT */}
            {/* ============================================= */}

            {children}
          </main>
        </div>
      </AdminSidebarContext.Provider>
    </AdminDashboardGuard>
  );
}