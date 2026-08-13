import type { Metadata } from "next";

import { AboutPageContent } from "./_components/about-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "Meet Ancient Trails, a heritage travel company crafting meaningful cultural journeys.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}
