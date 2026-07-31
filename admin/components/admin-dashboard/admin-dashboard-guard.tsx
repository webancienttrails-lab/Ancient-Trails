"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  hasValidAdminSession,
  listenForAdminSessionChanges,
} from "@/lib/admin-auth";

function getCurrentRedirectPath(pathname: string | null) {
  if (typeof window === "undefined") {
    return pathname || "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function AdminDashboardGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const syncAccess = () => {
      if (hasValidAdminSession()) {
        setIsAllowed(true);
        return;
      }

      setIsAllowed(false);
      router.replace(
        `/login?redirect=${encodeURIComponent(getCurrentRedirectPath(pathname))}`
      );
    };

    syncAccess();

    return listenForAdminSessionChanges(syncAccess);
  }, [pathname, router]);

  if (!isAllowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fbf8f5] text-primary">
        <Loader2 className="size-7 animate-spin" aria-hidden="true" />
        <span className="sr-only">Checking admin session</span>
      </div>
    );
  }

  return <>{children}</>;
}
