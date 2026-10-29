"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { logoutAdminSession } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

type AdminSidebarLogoutProps = {
  isCollapsed?: boolean;
};

export function AdminSidebarLogout({
  isCollapsed = false,
}: AdminSidebarLogoutProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try { await logoutAdminSession(); router.replace("/login"); }
    catch { toast.error("Could not sign out", "Your server session could not be ended. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
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
