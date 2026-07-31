"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { clearAdminSession } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

type AdminSidebarLogoutProps = {
  isCollapsed?: boolean;
};

export function AdminSidebarLogout({
  isCollapsed = false,
}: AdminSidebarLogoutProps) {
  const router = useRouter();

  function handleLogout() {
    clearAdminSession();
    router.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground",
        isCollapsed && "lg:px-0"
      )}
      aria-label="Logout"
      title="Logout"
    >
      <LogOut className="size-4" />
      <span className={cn(isCollapsed && "lg:sr-only")}>Logout</span>
    </button>
  );
}
