import type { AccommodationOption, Traveller } from "./accommodation.types";

export function calculateAgeOnDate(
  dateOfBirth: string | Date,
  targetDate: string | Date
): number {
  const birthDate = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  const comparisonDate =
    targetDate instanceof Date ? targetDate : new Date(targetDate);

  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(comparisonDate.getTime())
  ) {
    throw new Error("A valid child date of birth is required for pricing.");
  }

  let age = comparisonDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = comparisonDate.getMonth() - birthDate.getMonth();
  const dayDifference = comparisonDate.getDate() - birthDate.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

export function validateAccommodationOption(
  option: AccommodationOption,
  travellers: Traveller[]
): string[] {
  const errors: string[] = [];
  const allocations = option.rooms.flatMap((room) => room.allocations);
  const allocationIds = new Set(
    allocations.map((allocation) => allocation.travellerId)
  );
  const travellerIds = new Set(travellers.map((traveller) => traveller.id));
  const total = option.breakdown.reduce((sum, item) => sum + item.amount, 0);

  if (allocations.length !== travellers.length) {
    errors.push("Every guest must be allocated exactly once.");
  }

  if (allocationIds.size !== allocations.length) {
    errors.push("Duplicate guest allocation detected.");
  }

  travellers.forEach((traveller) => {
    if (!allocationIds.has(traveller.id)) {
      errors.push(`${traveller.id} is missing from room allocation.`);
    }
  });

  allocations.forEach((allocation) => {
    if (!travellerIds.has(allocation.travellerId)) {
      errors.push(`${allocation.travellerId} is not part of this booking.`);
    }

    if (!allocation.rateType) {
      errors.push(`${allocation.travellerId} is missing a rate type.`);
    }
  });

  if (total !== option.total) {
    errors.push("Accommodation total must match its price breakdown.");
  }

  return errors;
}
