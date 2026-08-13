import type {
  ChildPricingRule,
  PricingCategory,
  RoomPolicy,
} from "../departure/departure.types";
import { DEFAULT_ROOM_POLICY } from "./accommodation.types";
import type {
  AccommodationOption,
  AllocationBedType,
  RoomAllocation,
  Traveller,
} from "./accommodation.types";

export function calculateAgeOnDate(
  dateOfBirth: string | Date,
  targetDate: string | Date
): number {
  const birthDate =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  const comparisonDate =
    targetDate instanceof Date ? targetDate : new Date(targetDate);

  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(comparisonDate.getTime())
  ) {
    throw new Error("A valid date of birth and departure date are required.");
  }

  let age = comparisonDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = comparisonDate.getMonth() - birthDate.getMonth();
  const dayDifference = comparisonDate.getDate() - birthDate.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age;
}

export function calculateAgeOnDeparture(
  dateOfBirth: string | Date,
  departureDate: string | Date
): number {
  return calculateAgeOnDate(dateOfBirth, departureDate);
}

export function findChildPricingRule(
  ageOnDeparture: number | undefined,
  childPricingRules: ChildPricingRule[]
): ChildPricingRule | undefined {
  if (ageOnDeparture === undefined || !Number.isFinite(ageOnDeparture)) {
    return undefined;
  }

  return childPricingRules.find(
    (rule) => ageOnDeparture >= rule.minAge && ageOnDeparture <= rule.maxAge
  );
}

export function normalizeRoomPolicy(roomPolicy?: RoomPolicy): RoomPolicy {
  return {
    ...DEFAULT_ROOM_POLICY,
    ...(roomPolicy || {}),
    maxChildrenWithoutExtraBedPerRoom: Math.max(
      0,
      Math.floor(
        roomPolicy?.maxChildrenWithoutExtraBedPerRoom ??
          DEFAULT_ROOM_POLICY.maxChildrenWithoutExtraBedPerRoom
      )
    ),
  };
}

export function resolveChildPricing({
  ageOnDeparture,
  bedType,
  childPricingRules,
  roomPolicy,
}: {
  ageOnDeparture: number | undefined;
  bedType: AllocationBedType;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
}): {
  ageOnDeparture: number;
  bedType: AllocationBedType;
  pricingCategory: PricingCategory;
} {
  if (ageOnDeparture === undefined || !Number.isFinite(ageOnDeparture)) {
    throw new Error("Child date of birth is required for pricing.");
  }

  if (bedType === "single_room") {
    return {
      ageOnDeparture,
      bedType,
      pricingCategory: "single_occupancy",
    };
  }

  const policy = normalizeRoomPolicy(roomPolicy);
  const matchingRule = findChildPricingRule(ageOnDeparture, childPricingRules);

  if (!matchingRule) {
    return {
      ageOnDeparture,
      bedType,
      pricingCategory: "adult",
    };
  }

  if (bedType === "extra_bed") {
    return matchingRule.allowExtraBed && policy.allowExtraBed
      ? {
          ageOnDeparture,
          bedType: "extra_bed",
          pricingCategory: "extra_bed",
        }
      : {
          ageOnDeparture,
          bedType,
          pricingCategory: "adult",
        };
  }

  if (
    bedType === "without_extra_bed" &&
    matchingRule.allowWithoutExtraBed &&
    policy.allowChildBedSharing
  ) {
    return {
      ageOnDeparture,
      bedType: "without_extra_bed",
      pricingCategory: "child_without_extra_bed",
    };
  }

  return {
    ageOnDeparture,
    bedType,
    pricingCategory: "adult",
  };
}

export function validateChildRoomAllocation(
  room: RoomAllocation,
  roomPolicy?: RoomPolicy,
  travellerById = new Map<string, Traveller>(),
  childPricingRules: ChildPricingRule[] = []
): string[] {
  const errors: string[] = [];
  const policy = normalizeRoomPolicy(roomPolicy);
  const adultCount = room.allocations.filter(
    (allocation) => travellerById.get(allocation.travellerId)?.type === "adult"
  ).length;
  const childAllocations = room.allocations.filter((allocation) => {
    const traveller = travellerById.get(allocation.travellerId);

    return traveller?.type === "child" || allocation.ageOnDeparture !== undefined;
  });
  const childrenWithoutExtraBed = room.allocations.filter(
    (allocation) => allocation.bedType === "without_extra_bed"
  );
  const extraBedCount = room.allocations.filter(
    (allocation) => allocation.bedType === "extra_bed"
  ).length;
  const bedOccupantCount =
    room.allocations.length - childrenWithoutExtraBed.length;
  const maximumRoomOccupancy =
    room.roomType === "single"
      ? 1
      : room.capacity + policy.maxChildrenWithoutExtraBedPerRoom;

  if (childrenWithoutExtraBed.length > 0 && !policy.allowChildBedSharing) {
    errors.push(`${room.id} does not allow child bed sharing.`);
  }

  if (
    childrenWithoutExtraBed.length >
    policy.maxChildrenWithoutExtraBedPerRoom
  ) {
    errors.push(`${room.id} exceeds child bed-sharing limit.`);
  }

  if (extraBedCount > 0 && !policy.allowExtraBed) {
    errors.push(`${room.id} does not allow extra beds.`);
  }

  childAllocations.forEach((allocation) => {
    const traveller = travellerById.get(allocation.travellerId);
    const ageOnDeparture = allocation.ageOnDeparture ?? traveller?.ageOnDeparture;
    const matchingRule = findChildPricingRule(
      ageOnDeparture,
      childPricingRules
    );

    if (allocation.bedType === "single_room" && !policy.allowChildSingleRoom) {
      errors.push(`${room.id} does not allow a child in a separate single room.`);
    }

    if (
      allocation.bedType !== "single_room" &&
      adultCount === 0
    ) {
      errors.push(`${room.id} cannot be a child-only room.`);
    }

    if (
      allocation.bedType === "without_extra_bed" &&
      (!matchingRule || !matchingRule.allowWithoutExtraBed)
    ) {
      errors.push(
        `${room.id} has a child who is not eligible to share existing bedding.`
      );
    }

    if (
      allocation.bedType === "extra_bed" &&
      matchingRule &&
      !matchingRule.allowExtraBed
    ) {
      errors.push(`${room.id} has a child who is not eligible for an extra bed.`);
    }
  });

  if (bedOccupantCount > room.capacity) {
    errors.push(`${room.id} exceeds bed capacity.`);
  }

  if (room.allocations.length > maximumRoomOccupancy) {
    errors.push(`${room.id} exceeds maximum room occupancy.`);
  }

  return errors;
}

export function validateAccommodationOption(
  option: AccommodationOption,
  travellers: Traveller[],
  roomPolicy?: RoomPolicy,
  childPricingRules: ChildPricingRule[] = []
): string[] {
  const errors: string[] = [];
  const travellerIds = travellers.map((traveller) => traveller.id);
  const travellerIdSet = new Set(travellerIds);
  const travellerById = new Map(
    travellers.map((traveller) => [traveller.id, traveller])
  );
  const allocatedIds = option.rooms.flatMap((room) =>
    room.allocations.map((allocation) => allocation.travellerId)
  );
  const uniqueAllocatedIds = new Set(allocatedIds);

  if (allocatedIds.length !== uniqueAllocatedIds.size) {
    errors.push("Every traveller must be assigned exactly once.");
  }

  travellerIds.forEach((travellerId) => {
    if (!uniqueAllocatedIds.has(travellerId)) {
      errors.push(`Traveller ${travellerId} is not assigned.`);
    }
  });

  allocatedIds.forEach((travellerId) => {
    if (!travellerIdSet.has(travellerId)) {
      errors.push(`Unknown traveller ${travellerId} is assigned.`);
    }
  });

  option.rooms.forEach((room) => {
    const allocationIds = room.allocations.map((allocation) => allocation.travellerId);
    const roomTravellerIdSet = new Set(room.travellerIds);
    errors.push(
      ...validateChildRoomAllocation(
        room,
        roomPolicy,
        travellerById,
        childPricingRules
      )
    );

    if (allocationIds.length !== room.travellerIds.length) {
      errors.push(`${room.id} traveller IDs do not match allocations.`);
    }

    allocationIds.forEach((travellerId) => {
      if (!roomTravellerIdSet.has(travellerId)) {
        errors.push(`${room.id} is missing traveller ${travellerId}.`);
      }
    });
  });

  return errors;
}
