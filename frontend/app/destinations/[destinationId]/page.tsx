import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTravelCatalogue } from "@/lib/server-travel";
import { listPublicExperiences, getHomeMediaUrl } from "@/lib/home-travel";
import { matchesRouteValue, getDestinationHref } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

import { SingleDestinationPage } from "../_components/single-destination-page";

type DestinationDetailRouteProps = {
  params: Promise<{
    destinationId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: DestinationDetailRouteProps): Promise<Metadata> {
  const { destinationId } = await params;
  const { destinations } = await getTravelCatalogue();
  const destination = destinations.find(item => matchesRouteValue(destinationId, item.destinationId, item.destinationName));

  if (!destination) notFound();
  return pageMetadata({
    title: `${destination.destinationName} Travel`,
    description: `${destination.destinationName}: ${destination.shortDescription} Explore ${destination.keyLandmarks.join(", ")} with Ancient Trails.`,
    path: getDestinationHref(destination),
    image: getHomeMediaUrl(destination.bannerImage || destination.thumbnailImage || destination.galleryImages[0] || ""),
    imageAlt: destination.destinationName,
  });
}

export default async function DestinationDetailRoute({
  params,
}: DestinationDetailRouteProps) {
  const { destinationId } = await params;
  const catalogue = await getTravelCatalogue();
  const destination = catalogue.destinations.find(item => matchesRouteValue(destinationId, item.destinationId, item.destinationName));
  if (!destination) notFound();
  const experiences = await listPublicExperiences().catch(() => null);
  return <SingleDestinationPage key={destination.id} destinationId={destination.destinationId} initialData={{ ...catalogue, destination, experiences: experiences?.data.experiences ?? [] }} />;
}
