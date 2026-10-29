import { TourDeparture } from "../../models/tourDeparture.model";
import { travelDay } from "./departure-offer.validation";

export async function completePastDepartures(now = new Date()) {
  // A trip in progress remains scheduled until its return day has ended in India.
  const today = new Date(`${travelDay(now)}T00:00:00+05:30`);
  return TourDeparture.updateMany(
    { status: "scheduled", returnDate: { $ne: null, $lt: today } },
    { $set: { status: "completed" } }
  );
}

export function millisecondsUntilNextTravelDay(now = new Date()) {
  const midnight = Date.parse(`${travelDay(now)}T00:00:00+05:30`) + 86400000;
  return Math.max(1000, midnight - now.getTime());
}
