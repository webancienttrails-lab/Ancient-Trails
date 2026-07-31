import type { ReactNode } from "react";

import { UserDashboardGuard } from "@/components/user-dashboard/user-dashboard-guard";

export default function MeLayout({ children }: { children: ReactNode }) {
  return <UserDashboardGuard>{children}</UserDashboardGuard>;
}
