import { Tour } from "../../models/tour.model";
import { TourDeparture } from "../../models/tourDeparture.model";
import { CustomiseTour, CustomiseTourDeparture } from "../../models/customiseTour.model";

export type BookingTourScope = "master" | "customise";

export function bookingTourModel(scope?: BookingTourScope) {
  return scope === "customise" ? CustomiseTour : Tour;
}

export function bookingDepartureModel(scope?: BookingTourScope) {
  return scope === "customise" ? CustomiseTourDeparture : TourDeparture;
}
