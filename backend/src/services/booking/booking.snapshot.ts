import type { AccommodationOption } from "../accommodation/accommodation.types";
import type { PricedDeparture } from "../departure/departure.types";
import { calculateBalanceDueDate } from "../departure/departure.validation";
import { calculateBalance, calculateDeposit } from "./booking.deposit";
import { calculateBookingTotals } from "./booking.pricing";

export type PricingSnapshot = ReturnType<typeof createPricingSnapshot>;

export function createPricingSnapshot({
  accommodationOption,
  departure,
  gstPercentage = 0,
}: {
  accommodationOption: AccommodationOption;
  departure: PricedDeparture;
  gstPercentage?: number;
}) {
  const totals = calculateBookingTotals({
    accommodationOption,
    gstPercentage,
  });
  const depositAmount = calculateDeposit({
    depositAppliesTo: departure.depositAppliesTo,
    depositType: departure.depositType,
    depositValue: departure.depositValue,
    grandTotal: totals.grandTotal,
    totalTravellers: accommodationOption.totalTravellers,
  });
  const balanceAmount = calculateBalance(totals.grandTotal, depositAmount);
  const balanceDueDate = calculateBalanceDueDate(
    departure.departureDate,
    departure.balanceDueDaysBefore
  );

  return {
    departureId: departure.departureId,
    departureDate: departure.departureDate,
    returnDate: departure.returnDate,
    priceAdult: departure.priceAdult,
    priceExtraBed: departure.priceExtraBed,
    priceChildWithoutExtraBed: departure.priceChildWithoutExtraBed,
    singleOccupancy: departure.singleOccupancy,
    childPricingRules: departure.childPricingRules.map((rule) => ({ ...rule })),
    accommodation: {
      optionId: accommodationOption.id,
      optionTitle: accommodationOption.title,
      rooms: accommodationOption.rooms,
      travellerAllocations: accommodationOption.rooms.flatMap(
        (room) => room.allocations
      ),
      pricingBreakdown: accommodationOption.pricingBreakdown,
      total: accommodationOption.total,
      totalPrice: accommodationOption.total,
    },
    subtotal: totals.subtotal,
    gstPercentage: totals.gstPercentage,
    gstAmount: totals.gstAmount,
    grandTotal: totals.grandTotal,
    depositType: departure.depositType,
    depositValue: departure.depositValue,
    depositAppliesTo: departure.depositAppliesTo,
    depositAmount,
    balanceAmount,
    balanceDueDaysBefore: departure.balanceDueDaysBefore,
    balanceDueDate,
  };
}
