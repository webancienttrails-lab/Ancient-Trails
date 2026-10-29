import type { TravellerUser } from "@/lib/auth";

const dismissalDuration = 30 * 24 * 60 * 60 * 1000;

export function suppressProfilePrompt(pathname: string): boolean {
  return ["/login", "/me/account", "/tours", "/booking", "/booking-confirmed", "/booking-submitted",
    "/bank-transfer", "/payment", "/checkout", "/me/bookings"].some(route =>
    pathname === route || pathname.startsWith(route + "/"));
}

export function isProfilePromptDismissed(userId: string, now = Date.now()): boolean {
  try {
    const until = Number(window.localStorage.getItem("ancient_trails_profile_dismissed:" + userId));
    return Number.isFinite(until) && until > now && until <= now + dismissalDuration;
  } catch { return false; }
}

export function rememberProfilePromptDismissal(userId: string, now = Date.now()): void {
  try {
    window.localStorage.setItem("ancient_trails_profile_dismissed:" + userId, String(now + dismissalDuration));
  } catch {
    // The mounted prompt still stays closed when browser storage is unavailable.
  }
}

export function getTravellerAccountName(user: TravellerUser | null): string {
  const fullName = [user?.firstName, user?.lastName].map(part => part?.trim()).filter(Boolean).join(" ");
  return fullName || user?.mobileNumber?.trim() || user?.email?.trim() || "Your account";
}

export function getTravellerAccountContact(user: TravellerUser | null): string {
  return user?.email?.trim() || user?.mobileNumber?.trim() || "";
}
