"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import {
  clearTravellerSession,
  getTravellerSession,
  listenForTravellerSessionChanges,
} from "@/lib/auth";
import { LoaderScreen } from "@/components/layout/site-loader";

function getCurrentRedirectPath(pathname: string | null) {
  if (typeof window === "undefined") {
    return pathname || "/me";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function hasValidTravellerSession() {
  const session = getTravellerSession();

  if (!session?.token) {
    return false;
  }

  const isTraveller = session.user.roles.includes("traveller");
  const isActive = session.user.status === "active";

  if (!isTraveller || !isActive) {
    clearTravellerSession();
    return false;
  }

  return true;
}

export function UserDashboardGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const syncAccess = () => {
      if (hasValidTravellerSession()) {
        setIsAllowed(true);
        return;
      }

      setIsAllowed(false);
      router.replace(
        `/login?redirect=${encodeURIComponent(getCurrentRedirectPath(pathname))}`
      );
    };

    syncAccess();

    return listenForTravellerSessionChanges(syncAccess);
  }, [pathname, router]);

  if (!isAllowed) {
    return <LoaderScreen />;
  }

  return <>{children}</>;
}
