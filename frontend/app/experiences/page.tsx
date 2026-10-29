import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import { ExperiencesPage } from "./_components/experiences-page";

export const metadata: Metadata = pageMetadata({
  path: "/experiences",
  title: "Experiences",
  description:
    "Traveller stories, photos and memories from Ancient Trails heritage journeys.",
});

export default async function ExperiencesRoute({ searchParams }: {
  searchParams?: Promise<{ search?: string; destination?: string }>;
}) {
  const params = await searchParams;
  return <ExperiencesPage key={`${params?.destination || ""}-${params?.search || ""}`} initialSearchQuery={params?.search || ""} initialDestinationValue={params?.destination || ""} />;
}
