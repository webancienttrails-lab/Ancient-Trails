import type { Metadata } from "next";

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
  const readableId = decodeURIComponent(destinationId).replace(/[-_]+/g, " ");

  return {
    title: readableId || "Destination",
    description:
      "Explore destination highlights, gallery, travel details and linked tours from Ancient Trails.",
  };
}

export default async function DestinationDetailRoute({
  params,
}: DestinationDetailRouteProps) {
  const { destinationId } = await params;

  return <SingleDestinationPage destinationId={destinationId} />;
}
