import type { PricedDeparture, PricingCategory } from "./departure.types";

export function getPriceForCategory(
  category: PricingCategory,
  departure: Pick<
    PricedDeparture,
    | "priceAdult"
    | "priceExtraBed"
    | "priceChildWithoutExtraBed"
    | "singleOccupancy"
  >
): number {
  switch (category) {
    case "adult":
      return departure.priceAdult;
    case "extra_bed":
      return departure.priceExtraBed;
    case "child_without_extra_bed":
      return departure.priceChildWithoutExtraBed;
    case "single_occupancy":
      return departure.singleOccupancy;
  }
}
