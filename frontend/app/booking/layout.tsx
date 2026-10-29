import type { ReactNode } from "react";
import { privatePageRobots } from "@/lib/seo";

export const metadata = { robots: privatePageRobots, referrer: "no-referrer" as const };

export default function BookingLayout({ children }: { children: ReactNode }) {
  return children;
}
