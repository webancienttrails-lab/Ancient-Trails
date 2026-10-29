import "server-only";
import { cache } from "react";
import { listPublicTours, listPublicTourDepartures, listPublicDestinations, listPublicExperts } from "./home-travel";
import type { TravelCatalogue } from "./travel-page-data";
import type { PublicTour } from "./home-travel";
import { matchesRouteValue, getRequestedTourAlias } from "./routes";

export function findTourByRoute(tours: PublicTour[], reference: string) {
  const alias = getRequestedTourAlias(reference);
  return tours.find(tour => matchesRouteValue(reference, tour.tourId, tour.tourName) ||
    tour.id === reference || (alias && tour.tourId.toUpperCase() === alias.toUpperCase()));
}

// Share the public catalogue between metadata and the page within one render.
// These requests carry no visitor cookies; booking availability is checked again at checkout.
export const getTravelCatalogue = cache(async (): Promise<TravelCatalogue> => {
  const [tours, departures, destinations, experts] = await Promise.all([
    listPublicTours(), listPublicTourDepartures(), listPublicDestinations(),
    listPublicExperts().catch(() => ({ data: { experts: [] } })),
  ]);
  return { tours: tours.data.tours, departures: departures.data.departures,
    destinations: destinations.data.destinations, experts: experts.data.experts };
});
