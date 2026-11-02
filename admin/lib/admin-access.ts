export const adminTabOptions = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "bookings", label: "Bookings", href: "/bookings" },
  { key: "tours", label: "Tours", href: "/tours" },
  { key: "destinations", label: "Destinations", href: "/destinations" },
  { key: "experts", label: "Experts", href: "/experts" },
  { key: "enquiries", label: "Enquiries", href: "/enquiries" },
  { key: "users", label: "Users", href: "/users" },
  { key: "experiences", label: "Experiences", href: "/experiences" },
  { key: "pages", label: "Pages", href: "/pages" },
  { key: "blog", label: "Blog", href: "/blog" },
  { key: "reports", label: "Reports", href: "/reports" },
  { key: "settings", label: "Settings", href: "/settings" },
] as const;
export type AdminTab = typeof adminTabOptions[number]["key"];
type AccessUser = { roles: string[]; adminTabs?: string[] };

export function canAccessAdminPath(user: AccessUser | null | undefined, path: string): boolean {
  if (!user) return false;
  if (user.roles.includes("super_admin") || user.adminTabs === undefined) return true;
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const tab = adminTabOptions.find(({ href }) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return Boolean(tab && user.adminTabs.includes(tab.key));
}

export function getAdminHomePath(user: AccessUser | null | undefined): string {
  return adminTabOptions.find((tab) => canAccessAdminPath(user, tab.href))?.href || "/login";
}

export function hasRestrictedAdminAccess(user: AccessUser | null | undefined): boolean {
  return Boolean(user && !user.roles.includes("super_admin") && user.adminTabs !== undefined);
}
