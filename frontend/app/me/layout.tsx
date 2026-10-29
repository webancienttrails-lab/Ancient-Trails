import type { ReactNode } from "react";
import { privatePageRobots } from "@/lib/seo";

export const metadata = { robots: privatePageRobots };

import { UserDashboardGuard } from "@/components/user-dashboard/user-dashboard-guard";

export default function MeLayout({ children }: { children: ReactNode }) {
  return <UserDashboardGuard>{children}</UserDashboardGuard>;
}
