"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

import { AdminDashboardGuard } from "./admin-dashboard-guard";
import { AdminSidebar } from "./admin-sidebar";

type AdminDashboardShellProps = {
  activeLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

type AdminSidebarContextValue = {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  toggleSidebar: () => void;
};

const AdminSidebarContext = createContext<AdminSidebarContextValue | null>(null);

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

export function AdminSidebarToggle({ className }: { className?: string }) {
  const { isSidebarCollapsed, toggleSidebar } = useAdminSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "hidden size-10 shrink-0 place-items-center rounded-full border border-border bg-white text-foreground shadow-sm shadow-stone-200/40 transition-colors hover:border-primary hover:text-primary lg:grid",
        className
      )}
      aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <Menu className="size-5" />
    </button>
  );
}

export function AdminDashboardShell({
  activeLabel = "Dashboard",
  children,
  className,
  contentClassName,
}: AdminDashboardShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
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
          <AdminSidebar
            activeLabel={activeLabel}
            isMobileOpen={isMobileSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onMobileClose={closeMobileSidebar}
            onMobileToggle={toggleMobileSidebar}
          />
          <main
            className={cn(
              "admin-dashboard-main min-w-0 px-2.5 pb-5 pt-[72px] transition-[margin] duration-300 ease-out sm:px-6 lg:px-7 lg:py-5",
              isSidebarCollapsed ? "lg:ml-20" : "lg:ml-80",
              contentClassName
            )}
          >
            {children}
          </main>
        </div>
      </AdminSidebarContext.Provider>
    </AdminDashboardGuard>
  );
}
