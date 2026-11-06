import { model, models, type Model } from "mongoose";
import { Tour, type ITour } from "./tour.model";
import { TourDeparture, type ITourDeparture } from "./tourDeparture.model";
import { TourItinerary, type ITourItinerary } from "./tourItinerary.model";

// Identical forms and validation, with independent IDs and collections.
export const CustomiseTour = (models.CustomiseTour as Model<ITour> | undefined)
  || model<ITour>("CustomiseTour", Tour.schema.clone(), "customiseTours");
export const CustomiseTourDeparture = (models.CustomiseTourDeparture as Model<ITourDeparture> | undefined)
  || model<ITourDeparture>("CustomiseTourDeparture", TourDeparture.schema.clone(), "customiseTourDepartures");
export const CustomiseTourItinerary = (models.CustomiseTourItinerary as Model<ITourItinerary> | undefined)
  || model<ITourItinerary>("CustomiseTourItinerary", TourItinerary.schema.clone(), "customiseTourItineraries");
