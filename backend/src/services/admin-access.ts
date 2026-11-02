export const adminTabs = [
  "dashboard", "bookings", "tours", "destinations", "experts", "enquiries",
  "users", "experiences", "pages", "blog", "reports", "settings",
] as const;
export type AdminTab = typeof adminTabs[number];
type AdminAccessUser = { roles: string[]; adminTabs?: string[] };

export function hasAdminTab(user: AdminAccessUser, tab: AdminTab): boolean {
  // Accounts created before tab permissions were introduced retain their access.
  return user.roles.includes("super_admin") || user.adminTabs === undefined || user.adminTabs.includes(tab);
}

export function canAccessAdminApi(user: AdminAccessUser, method: string, originalUrl: string): boolean {
  if (user.roles.includes("super_admin") || user.adminTabs === undefined) return true;
  const path = originalUrl.split("?")[0].replace(/\/+$/, "").toLowerCase();
  if (!path.startsWith("/api/admin/")) return false;
  const route = path.slice("/api/admin/".length);
  if (route === "dashboard/reports" || route === "dashboard/reports/invoices") return hasAdminTab(user, "reports");
  const section = route.split("/")[0];
  const sectionTabs: Record<string, AdminTab> = {
    dashboard: "dashboard", bookings: "bookings", tours: "tours", destinations: "destinations",
    experts: "experts", enquiries: "enquiries", users: "users", experiences: "experiences",
    home: "pages", about: "pages", faq: "pages", "tour-calendar": "pages", "mega-menu": "pages",
    blogs: "blog", "site-settings": "settings",
  };
  const tab = sectionTabs[section];
  if (tab && hasAdminTab(user, tab)) return true;

  // Existing editors read these lists to populate their selectors. They do not
  // receive permission to modify the related sections.
  if (method !== "GET" && method !== "HEAD") return false;
  const listDependencies: Record<string, AdminTab[]> = {
    tours: ["bookings", "experts", "experiences", "pages", "blog"],
    "tours/departures": ["bookings", "pages"],
    destinations: ["tours", "bookings", "pages"],
    experts: ["tours"],
    experiences: ["pages"],
    home: ["destinations"],
    "site-settings": ["bookings"],
  };
  return (listDependencies[route] || []).some((permission) => hasAdminTab(user, permission));
}
