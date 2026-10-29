import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTravelCatalogue, findTourByRoute } from "@/lib/server-travel";
import { listPublicTourItineraries, getHomeMediaUrl } from "@/lib/home-travel";
import { getTourHref } from "@/lib/routes";
import { getNextBookableDeparture } from "@/lib/tour-departures";
import { pageMetadata } from "@/lib/seo";
import { formatTourTitle } from "@/lib/tour-title";
import { JsonLd } from "@/components/seo/json-ld";
import { tourStructuredData } from "@/lib/structured-data";

import { TourDetailClient } from "./_components/tour-detail-client";

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
  const { tours, departures } = await getTravelCatalogue();
  const tour = findTourByRoute(tours, tourId);
  if (!tour) notFound();
  const departure = getNextBookableDeparture(departures.filter(item => item.tourId === tour.tourId));
  const price = departure?.priceAdult ? ` From INR ${departure.priceAdult.toLocaleString("en-IN")} per person.` : "";
  return pageMetadata({
    title: formatTourTitle(tour.tourName),
    description: `${tour.tourName}. ${tour.durationDn}.${price} ${tour.description}`,
    path: getTourHref(tour),
    image: getHomeMediaUrl(tour.bannerImage || tour.thumbnailImage || tour.galleryImages[0] || ""),
    imageAlt: tour.tourName,
  });
}

export default async function TourDetailRoute({ params }: TourDetailRouteProps) {
  const { tourId } = await params;
  const catalogue = await getTravelCatalogue();
  const tour = findTourByRoute(catalogue.tours, tourId);
  if (!tour) notFound();
  const itineraries = await listPublicTourItineraries(tour.tourId);
  const itinerary = itineraries.data.itineraries.find(item => item.tourId === tour.tourId) ?? null;
  const destinations = catalogue.destinations.filter(item => [tour.destinationId, ...(tour.destinationIds || [])].includes(item.destinationId));
  return <>
    <JsonLd id="tour-jsonld" data={tourStructuredData(tour, catalogue.departures, itinerary, destinations)} />
    <TourDetailClient key={tour.id} tourId={tour.tourId} initialData={{ ...catalogue, tours: [tour], itineraries: itineraries.data.itineraries }} />
  </>;
}
