import type { Metadata } from "next";

import { SingleTourPage } from "./_components/single-tour-page";

type TourDetailRouteProps = {
  params: Promise<{
    tourId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: TourDetailRouteProps): Promise<Metadata> {
  const { tourId } = await params;
  const readableId = decodeURIComponent(tourId).replace(/[-_]+/g, " ");

  return {
    title: readableId || "Tour",
    description:
      "Explore tour highlights, itinerary, expert details and departure pricing from Ancient Trails.",
  };
}

export default async function TourDetailRoute({ params }: TourDetailRouteProps) {
  const { tourId } = await params;

  return <SingleTourPage tourId={tourId} />;
}
