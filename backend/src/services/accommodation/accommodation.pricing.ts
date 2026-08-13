import { getPriceForCategory } from "../departure/departure.pricing";
import type { PricedDeparture, PricingCategory } from "../departure/departure.types";
import type { AccommodationOption, TravellerAllocation } from "./accommodation.types";

export function createPricingBreakdown(
  allocations: TravellerAllocation[],
  departure: PricedDeparture
): AccommodationOption["pricingBreakdown"] {
  const countCategory = (category: PricingCategory) =>
    allocations.filter((allocation) => allocation.pricingCategory === category)
      .length;

  return {
    adultCount: countCategory("adult"),
    adultUnitPrice: getPriceForCategory("adult", departure),
    extraBedCount: countCategory("extra_bed"),
    extraBedUnitPrice: getPriceForCategory("extra_bed", departure),
    childWithoutExtraBedCount: countCategory("child_without_extra_bed"),
    childWithoutExtraBedUnitPrice: getPriceForCategory(
      "child_without_extra_bed",
      departure
    ),
    singleOccupancyCount: countCategory("single_occupancy"),
    singleOccupancyUnitPrice: getPriceForCategory("single_occupancy", departure),
  };
}

export function calculateAccommodationTotal(
  allocations: TravellerAllocation[]
): number {
  return allocations.reduce((sum, allocation) => sum + allocation.price, 0);
}
