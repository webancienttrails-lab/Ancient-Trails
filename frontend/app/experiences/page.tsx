import type { Metadata } from "next";

import { ExperiencesPage } from "./_components/experiences-page";

export const metadata: Metadata = {
  title: "Experiences",
  description:
    "Traveller stories, photos and memories from Ancient Trails heritage journeys.",
};

export default function ExperiencesRoute() {
  return <ExperiencesPage />;
}
