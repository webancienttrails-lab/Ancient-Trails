import type { PublicTour, PublicTourDeparture, PublicDestination, PublicExpert, PublicTourItinerary, PublicExperience, PublicMegaMenuContent, PublicTourCalendarContent } from "./home-travel";

export type TravelCatalogue = {
  tours: PublicTour[];
  departures: PublicTourDeparture[];
  destinations: PublicDestination[];
  experts: PublicExpert[];
};
export type TourPageData = TravelCatalogue & { itineraries: PublicTourItinerary[] };
export type DestinationPageData = TravelCatalogue & {
  destination: PublicDestination;
  experiences: PublicExperience[];
};
export type DestinationListData = TravelCatalogue & { megaMenu: PublicMegaMenuContent | null };
export type CalendarPageData = TravelCatalogue & { calendar: PublicTourCalendarContent | null };
