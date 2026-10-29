import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import { AboutPageContent } from "./_components/about-page";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "About",
  description:
    "Meet Ancient Trails, a heritage travel company crafting meaningful cultural journeys.",
});

export default function AboutPage() {
  return <AboutPageContent />;
}
