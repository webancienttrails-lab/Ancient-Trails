import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Frequently Asked Questions",
  description: "Find answers about Ancient Trails tours, bookings, payments, accommodation and travel preparation. Get practical help before planning your heritage journey.",
  path: "/faq",
});

export default function FaqLayout({ children }: { children: ReactNode }) {
  return children;
}
