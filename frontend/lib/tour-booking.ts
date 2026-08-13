export type DepositType = "fixed" | "percentage";
export type DepositAppliesTo = "per_person" | "per_booking";
export type DepartureStatus =
  | "scheduled"
  | "coming_soon"
  | "closed"
  | "cancelled";
export type PricingCategory =
  | "adult"
  | "extra_bed"
  | "child_without_extra_bed"
  | "single_occupancy";

export type ChildPricingRule = {
  minAge: number;
  maxAge: number;
  allowExtraBed: boolean;
  allowWithoutExtraBed: boolean;
};

export type RoomPolicy = {
  allowChildBedSharing: boolean;
  maxChildrenWithoutExtraBedPerRoom: number;
  allowExtraBed: boolean;
  allowChildSingleRoom: boolean;
};

export type PricedDeparture = {
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: string | null;
  returnDate: string | null;
  seatsAvailable: number;
  priceAdult: number;
  priceExtraBed: number;
  priceChildWithoutExtraBed: number;
  singleOccupancy: number;
  depositType: DepositType;
  depositValue: number;
  depositAppliesTo: DepositAppliesTo;
  balanceDueDaysBefore: number;
  earlyBirdOffer: string | null;
  bookingDeadline: string | null;
  status: DepartureStatus;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
};

export type RoomType =
  | "single"
  | "double"
  | "twin"
  | "triple_double"
  | "triple_twin";
export type TravellerType = "adult" | "child";
type ChildBedType = "standard_bed" | "extra_bed" | "without_extra_bed";
type AllocationBedType = ChildBedType | "single_room";

export interface Traveller {
  id: string;
  type: TravellerType;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ageOnDeparture?: number;
}

export interface TravellerAllocation {
  travellerId: string;
  roomId: string;
  roomType: RoomType;
  bedType: AllocationBedType;
  pricingCategory: PricingCategory;
  price: number;
  ageOnDeparture?: number;
}

export interface RoomAllocation {
  id: string;
  roomType: RoomType;
  capacity: number;
  travellerIds: string[];
  allocations: TravellerAllocation[];
}

export interface AccommodationOption {
  id: string;
  title: string;
  description?: string;
  rooms: RoomAllocation[];
  totalTravellers: number;
  pricingBreakdown: {
    adultCount: number;
    adultUnitPrice: number;
    extraBedCount: number;
    extraBedUnitPrice: number;
    childWithoutExtraBedCount: number;
    childWithoutExtraBedUnitPrice: number;
    singleOccupancyCount: number;
    singleOccupancyUnitPrice: number;
  };
  totalPrice: number;
  recommended?: boolean;
  requiresRoommateMatching?: boolean;
  preferredSharingType?: "twin" | "triple";
}

export const ROOM_TYPES: Record<
  RoomType,
  { capacity: number; title: string; description: string }
> = {
  single: {
    capacity: 1,
    title: "Single Occupancy",
    description: "One person in one room",
  },
  double: {
    capacity: 2,
    title: "Double Occupancy",
    description: "One double bed in a room",
  },
  twin: {
    capacity: 2,
    title: "Twin Occupancy",
    description: "Two single beds in a room",
  },
  triple_double: {
    capacity: 3,
    title: "Double Room + Extra Bed",
    description: "One double bed plus one extra bed",
  },
  triple_twin: {
    capacity: 3,
    title: "Twin Room + Extra Bed",
    description: "Two single beds plus one extra bed",
  },
};

export const MAX_VISIBLE_OPTIONS = 6;
export const DEFAULT_ROOM_POLICY: RoomPolicy = {
  allowChildBedSharing: true,
  maxChildrenWithoutExtraBedPerRoom: 1,
  allowExtraBed: true,
  allowChildSingleRoom: false,
};

const roomCombinationTypes: RoomType[] = [
  "single",
  "double",
  "twin",
  "triple_double",
  "triple_twin",
];

function toDate(value: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function canonicalRoomCombinationKey(roomTypeList: RoomType[]) {
  return [...roomTypeList].sort().join("|");
}

function countCategory(
  allocations: TravellerAllocation[],
  category: PricingCategory
) {
  return allocations.filter((allocation) => allocation.pricingCategory === category)
    .length;
}

function getRoomTitle(roomTypeList: RoomType[]) {
  const counts = roomTypeList.reduce(
    (map, roomType) => {
      map[roomType] = (map[roomType] || 0) + 1;
      return map;
    },
    {} as Partial<Record<RoomType, number>>
  );

  return Object.entries(counts)
    .map(([roomType, count]) => {
      const title = ROOM_TYPES[roomType as RoomType].title
        .replace("Double Occupancy", "Double Room")
        .replace("Twin Occupancy", "Twin Room")
        .replace("Triple Occupancy", "Triple Room")
        .replace("Single Occupancy", "Single Room");

      return `${count} ${title}`;
    })
    .join(" + ");
}

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

function normalizeRoomPolicy(roomPolicy?: RoomPolicy): RoomPolicy {
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

function hydrateTravellerAge(
  traveller: Traveller,
  departure: PricedDeparture
): Traveller {
  if (traveller.type !== "child" || traveller.ageOnDeparture !== undefined) {
    return traveller;
  }

  if (!traveller.dateOfBirth || !departure.departureDate) {
    throw new Error("Child date of birth is required for pricing.");
  }

  return {
    ...traveller,
    ageOnDeparture: calculateAgeOnDate(
      traveller.dateOfBirth,
      departure.departureDate
    ),
  };
}

function assignPricing({
  bedType,
  childPricingRules,
  roomPolicy,
  traveller,
}: {
  bedType: AllocationBedType;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
  traveller: Traveller;
}): {
  bedType: AllocationBedType;
  pricingCategory: PricingCategory;
} {
  if (bedType === "single_room") {
    return {
      bedType,
      pricingCategory: "single_occupancy",
    };
  }

  if (traveller.type === "adult") {
    return {
      bedType,
      pricingCategory: bedType === "extra_bed" ? "extra_bed" : "adult",
    };
  }

  const resolvedChildPricing = resolveChildPricing({
    ageOnDeparture: traveller.ageOnDeparture,
    bedType,
    childPricingRules,
    roomPolicy,
  });

  return {
    bedType: resolvedChildPricing.bedType,
    pricingCategory: resolvedChildPricing.pricingCategory,
  };
}

function createAllocation({
  category,
  bedType,
  departure,
  roomId,
  roomType,
  traveller,
}: {
  category: PricingCategory;
  bedType: AllocationBedType;
  departure: PricedDeparture;
  roomId: string;
  roomType: RoomType;
  traveller: Traveller;
}): TravellerAllocation {
  return {
    travellerId: traveller.id,
    roomId,
    roomType,
    bedType,
    pricingCategory: category,
    price: getPriceForCategory(category, departure),
    ...(traveller.type === "child" &&
    traveller.ageOnDeparture !== undefined &&
    Number.isFinite(traveller.ageOnDeparture)
      ? { ageOnDeparture: traveller.ageOnDeparture }
      : {}),
  };
}

type RoomTravellerAssignment = {
  traveller: Traveller;
  bedType: AllocationBedType;
};

type PlannedRoomAllocation = {
  roomType: RoomType;
  assignments: RoomTravellerAssignment[];
};

function allocatePlannedRooms({
  childPricingRules,
  departure,
  plans,
  roomPolicy,
}: {
  childPricingRules: ChildPricingRule[];
  departure: PricedDeparture;
  plans: PlannedRoomAllocation[];
  roomPolicy?: RoomPolicy;
}): RoomAllocation[] {
  return plans.map((plan, index) => {
    const roomId = `room-${index + 1}`;
    const capacity = ROOM_TYPES[plan.roomType].capacity;
    const assignments = plan.assignments.map((assignment) => ({
      ...assignment,
      traveller: hydrateTravellerAge(assignment.traveller, departure),
    }));
    const allocations = assignments.map((assignment) => {
      const pricing = assignPricing({
        bedType: assignment.bedType,
        childPricingRules,
        roomPolicy,
        traveller: assignment.traveller,
      });

      return createAllocation({
        category: pricing.pricingCategory,
        bedType: pricing.bedType,
        departure,
        roomId,
        roomType: plan.roomType,
        traveller: assignment.traveller,
      });
    });

    return {
      id: roomId,
      roomType: plan.roomType,
      capacity,
      travellerIds: assignments.map((assignment) => assignment.traveller.id),
      allocations,
    };
  });
}

export function allocateTravellersToRooms({
  childPricingRules,
  departure,
  roomPolicy,
  roomTypes,
  travellers,
}: {
  childPricingRules: ChildPricingRule[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  roomTypes: RoomType[];
  travellers: Traveller[];
}): RoomAllocation[] {
  const hydratedTravellers = travellers.map((traveller) =>
    hydrateTravellerAge(traveller, departure)
  );
  const queue = [
    ...hydratedTravellers.filter((traveller) => traveller.type === "adult"),
    ...hydratedTravellers.filter((traveller) => traveller.type === "child"),
  ];
  let cursor = 0;

  return roomTypes.map((roomType, index) => {
    const roomId = `room-${index + 1}`;
    const capacity = ROOM_TYPES[roomType].capacity;
    const roomTravellers = queue.slice(cursor, cursor + capacity);
    cursor += capacity;
    const allocations = roomTravellers.map((traveller, occupantIndex) => {
      const bedType: ChildBedType | "single_room" =
        roomType === "single"
          ? "single_room"
          : roomType.startsWith("triple") && occupantIndex === 2
            ? "extra_bed"
            : "standard_bed";
      const pricing = assignPricing({
        bedType,
        childPricingRules,
        roomPolicy,
        traveller,
      });

      return createAllocation({
        category: pricing.pricingCategory,
        bedType: pricing.bedType,
        departure,
        roomId,
        roomType,
        traveller,
      });
    });

    return {
      id: roomId,
      roomType,
      capacity,
      travellerIds: roomTravellers.map((traveller) => traveller.id),
      allocations,
    };
  });
}

function allocateChildrenWithoutExtraBed({
  childPricingRules,
  departure,
  roomPolicy,
  roomTypes,
  travellers,
}: {
  childPricingRules: ChildPricingRule[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  roomTypes: RoomType[];
  travellers: Traveller[];
}): RoomAllocation[] {
  const adults = travellers.filter((traveller) => traveller.type === "adult");
  const children = travellers
    .filter((traveller) => traveller.type === "child")
    .map((traveller) => hydrateTravellerAge(traveller, departure));
  const policy = normalizeRoomPolicy(roomPolicy);
  const rooms: RoomAllocation[] = roomTypes.map((roomType, index) => ({
    id: `room-${index + 1}`,
    roomType,
    capacity: ROOM_TYPES[roomType].capacity,
    travellerIds: [],
    allocations: [],
  }));
  let adultCursor = 0;

  rooms.forEach((room) => {
    if (adultCursor >= adults.length || room.roomType === "single") {
      return;
    }

    const traveller = adults[adultCursor];
    const pricing = assignPricing({
      bedType: "standard_bed",
      childPricingRules,
      roomPolicy,
      traveller,
    });

    room.travellerIds.push(traveller.id);
    room.allocations.push(
      createAllocation({
        category: pricing.pricingCategory,
        bedType: pricing.bedType,
        departure,
        roomId: room.id,
        roomType: room.roomType,
        traveller,
      })
    );
    adultCursor += 1;
  });

  rooms.forEach((room) => {
    while (adultCursor < adults.length && room.allocations.length < room.capacity) {
      const traveller = adults[adultCursor];
      const pricing = assignPricing({
        bedType: "standard_bed",
        childPricingRules,
        roomPolicy,
        traveller,
      });

      room.travellerIds.push(traveller.id);
      room.allocations.push(
        createAllocation({
          category: pricing.pricingCategory,
          bedType: pricing.bedType,
          departure,
          roomId: room.id,
          roomType: room.roomType,
          traveller,
        })
      );
      adultCursor += 1;
    }
  });

  if (adultCursor < adults.length) {
    throw new Error("Adults could not be allocated safely.");
  }

  children.forEach((traveller) => {
    if (!policy.allowChildBedSharing) {
      throw new Error("Children without extra bed are not allowed.");
    }

    const room = rooms
      .filter((candidate) => candidate.roomType !== "single")
      .filter((candidate) =>
        candidate.allocations.some((allocation) =>
          adults.some((adult) => adult.id === allocation.travellerId)
        )
      )
      .filter(
        (candidate) =>
          candidate.allocations.filter(
            (allocation) => allocation.bedType === "without_extra_bed"
          ).length < policy.maxChildrenWithoutExtraBedPerRoom
      )
      .sort((left, right) => left.allocations.length - right.allocations.length)
      .find(
        (candidate) =>
          candidate.allocations.length <
          candidate.capacity + policy.maxChildrenWithoutExtraBedPerRoom
      );

    if (!room) {
      throw new Error("Children without extra bed could not be allocated safely.");
    }

    const pricing = assignPricing({
      bedType: "without_extra_bed",
      childPricingRules,
      roomPolicy,
      traveller,
    });

    room.travellerIds.push(traveller.id);
    room.allocations.push(
      createAllocation({
        category: pricing.pricingCategory,
        bedType: pricing.bedType,
        departure,
        roomId: room.id,
        roomType: room.roomType,
        traveller,
      })
    );
  });

  if (rooms.some((room) => room.allocations.length === 0)) {
    throw new Error("Room allocation created an empty room.");
  }

  return rooms;
}

export function calculateAccommodationTotal(
  allocations: TravellerAllocation[]
): number {
  return allocations.reduce((sum, allocation) => sum + allocation.price, 0);
}

function createPricingBreakdown(
  allocations: TravellerAllocation[],
  departure: PricedDeparture
): AccommodationOption["pricingBreakdown"] {
  return {
    adultCount: countCategory(allocations, "adult"),
    adultUnitPrice: getPriceForCategory("adult", departure),
    extraBedCount: countCategory(allocations, "extra_bed"),
    extraBedUnitPrice: getPriceForCategory("extra_bed", departure),
    childWithoutExtraBedCount: countCategory(
      allocations,
      "child_without_extra_bed"
    ),
    childWithoutExtraBedUnitPrice: getPriceForCategory(
      "child_without_extra_bed",
      departure
    ),
    singleOccupancyCount: countCategory(allocations, "single_occupancy"),
    singleOccupancyUnitPrice: getPriceForCategory("single_occupancy", departure),
  };
}

function createOption({
  departure,
  description,
  idPrefix = "option",
  recommended = false,
  rooms,
  title,
  travellers,
}: {
  departure: PricedDeparture;
  description?: string;
  idPrefix?: string;
  recommended?: boolean;
  rooms: RoomAllocation[];
  title?: string;
  travellers: Traveller[];
}): AccommodationOption {
  const allocations = rooms.flatMap((room) => room.allocations);
  const roomTypeList = rooms.map((room) => room.roomType);

  return {
    id: `${idPrefix}-${canonicalRoomCombinationKey(roomTypeList)}`,
    title: title || getRoomTitle(roomTypeList),
    description: description || getRoomTitle(roomTypeList),
    rooms,
    totalTravellers: travellers.length,
    pricingBreakdown: createPricingBreakdown(allocations, departure),
    totalPrice: calculateAccommodationTotal(allocations),
    recommended,
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

    if (allocation.bedType !== "single_room" && adultCount === 0) {
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
    errors.push(
      ...validateChildRoomAllocation(
        room,
        roomPolicy,
        travellerById,
        childPricingRules
      )
    );
  });

  return errors;
}

function getRank(option: AccommodationOption) {
  if (option.recommended) {
    return 0;
  }

  const roomTypeList = option.rooms.map((room) => room.roomType);
  const singleCount = roomTypeList.filter((roomType) => roomType === "single")
    .length;
  const hasTriple = roomTypeList.some((roomType) =>
    roomType.startsWith("triple")
  );
  const hasStandard = roomTypeList.some(
    (roomType) => roomType === "double" || roomType === "twin"
  );

  if (roomTypeList.every((roomType) => roomType === "single")) {
    return 90;
  }

  if (!hasTriple && hasStandard && singleCount <= 1) {
    return 10;
  }

  if (hasTriple && hasStandard && singleCount <= 1) {
    return 20;
  }

  if (!hasTriple && hasStandard && singleCount > 1) {
    return 30;
  }

  if (hasTriple && singleCount > 0) {
    return 40;
  }

  return 60;
}

export function rankAccommodationOptions(options: AccommodationOption[]) {
  return [...options].sort((left, right) => {
    const rankDifference = getRank(left) - getRank(right);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const roomDifference = left.rooms.length - right.rooms.length;

    if (roomDifference !== 0) {
      return roomDifference;
    }

    return left.totalPrice - right.totalPrice;
  });
}

export function generateRoomCombinations(totalTravellers: number): RoomType[][] {
  if (totalTravellers < 1 || totalTravellers > 25) {
    return [];
  }

  const combinations: RoomType[][] = [];

  function walk(startIndex: number, remainingCapacity: number, current: RoomType[]) {
    if (remainingCapacity === 0) {
      combinations.push([...current]);
      return;
    }

    roomCombinationTypes.slice(startIndex).forEach((roomType, offset) => {
      const capacity = ROOM_TYPES[roomType].capacity;

      if (capacity > remainingCapacity) {
        return;
      }

      current.push(roomType);
      walk(startIndex + offset, remainingCapacity - capacity, current);
      current.pop();
    });
  }

  walk(0, totalTravellers, []);

  return combinations;
}

export function deduplicateAccommodationOptions(
  options: AccommodationOption[]
): AccommodationOption[] {
  const optionByKey = new Map<string, AccommodationOption>();

  options.forEach((option) => {
    const key = canonicalRoomCombinationKey(
      option.rooms.map((room) => room.roomType)
    );
    const existingOption = optionByKey.get(key);

    if (!existingOption || option.totalPrice < existingOption.totalPrice) {
      optionByKey.set(key, option);
    }
  });

  return Array.from(optionByKey.values());
}

function childWithoutBedRoomCombinations(
  adultCount: number,
  childCount: number,
  roomPolicy?: RoomPolicy
): RoomType[][] {
  const policy = normalizeRoomPolicy(roomPolicy);

  if (
    adultCount === 0 ||
    childCount === 0 ||
    !policy.allowChildBedSharing ||
    policy.maxChildrenWithoutExtraBedPerRoom === 0
  ) {
    return [];
  }

  const minimumRooms = Math.min(
    adultCount,
    Math.max(1, Math.ceil(childCount / policy.maxChildrenWithoutExtraBedPerRoom))
  );
  const combinations: RoomType[][] = [];

  for (let count = minimumRooms; count <= adultCount; count += 1) {
    combinations.push(Array.from({ length: count }, () => "double" as RoomType));

    if (count <= 3) {
      combinations.push(Array.from({ length: count }, () => "twin" as RoomType));
    }
  }

  return combinations;
}

function assertChildAgeInputs({
  departure,
  travellers,
}: {
  departure: PricedDeparture;
  travellers: Traveller[];
}) {
  travellers
    .filter((traveller) => traveller.type === "child")
    .forEach((traveller) => {
      if (!traveller.dateOfBirth || !departure.departureDate) {
        throw new Error("Child date of birth is required for pricing.");
      }

      calculateAgeOnDate(traveller.dateOfBirth, departure.departureDate);
    });
}

function safeCreateOption(createOption: () => AccommodationOption | null) {
  try {
    return createOption();
  } catch {
    return null;
  }
}

function createNormalOption({
  childPricingRules,
  departure,
  roomPolicy,
  roomTypeList,
  travellers,
}: {
  childPricingRules: ChildPricingRule[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  roomTypeList: RoomType[];
  travellers: Traveller[];
}) {
  const rooms = allocateTravellersToRooms({
    childPricingRules,
    departure,
    roomPolicy,
    roomTypes: roomTypeList,
    travellers,
  });
  const option = createOption({
    departure,
    recommended:
      roomTypeList.every((roomType) => roomType === "double" || roomType === "twin") ||
      (roomTypeList.filter((roomType) => roomType === "single").length === 1 &&
        roomTypeList.every(
          (roomType) => roomType === "single" || roomType === "double" || roomType === "twin"
        )),
    rooms,
    travellers,
  });

  return validateAccommodationOption(
    option,
    travellers,
    roomPolicy,
    childPricingRules
  ).length === 0
    ? option
    : null;
}

function createChildWithoutBedOption({
  childPricingRules,
  departure,
  roomPolicy,
  roomTypeList,
  travellers,
}: {
  childPricingRules: ChildPricingRule[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  roomTypeList: RoomType[];
  travellers: Traveller[];
}) {
  const rooms = allocateChildrenWithoutExtraBed({
    childPricingRules,
    departure,
    roomPolicy,
    roomTypes: roomTypeList,
    travellers,
  });
  const option = createOption({
    departure,
    idPrefix: "child-without-bed",
    rooms,
    title: `${getRoomTitle(roomTypeList)} with Child Without Extra Bed`,
    travellers,
  });

  return validateAccommodationOption(
    option,
    travellers,
    roomPolicy,
    childPricingRules
  ).length === 0
    ? option
    : null;
}

function getDepartureDate(departure: PricedDeparture) {
  const departureDate = departure.departureDate
    ? new Date(departure.departureDate)
    : null;

  if (!departureDate || Number.isNaN(departureDate.getTime())) {
    throw new Error("Child date of birth is required for pricing.");
  }

  return departureDate;
}

function hydrateChildrenForGeneration(
  children: Traveller[],
  departure: PricedDeparture
) {
  const departureDate = getDepartureDate(departure);

  return children.map((child) => ({
    ...child,
    ageOnDeparture:
      child.ageOnDeparture ?? calculateAgeOnDate(child.dateOfBirth || "", departureDate),
  }));
}

function getReadableRoomName(roomType: "double" | "twin") {
  return roomType === "double" ? "Double Room" : "Twin Room";
}

function getTripleRoomType(roomType: "double" | "twin"): RoomType {
  return roomType === "double" ? "triple_double" : "triple_twin";
}

function canChildUseExtraBed({
  child,
  childPricingRules,
  roomPolicy,
}: {
  child: Traveller;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
}) {
  const policy = normalizeRoomPolicy(roomPolicy);
  const matchingRule = findChildPricingRule(
    child.ageOnDeparture,
    childPricingRules
  );

  return policy.allowExtraBed && (!matchingRule || matchingRule.allowExtraBed);
}

function canChildShareWithoutExtraBed({
  child,
  childPricingRules,
  roomPolicy,
}: {
  child: Traveller;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
}) {
  const policy = normalizeRoomPolicy(roomPolicy);
  const matchingRule = findChildPricingRule(
    child.ageOnDeparture,
    childPricingRules
  );

  return (
    policy.allowChildBedSharing &&
    policy.maxChildrenWithoutExtraBedPerRoom > 0 &&
    Boolean(matchingRule?.allowWithoutExtraBed)
  );
}

function canChildUseSingleRoom(roomPolicy?: RoomPolicy) {
  return normalizeRoomPolicy(roomPolicy).allowChildSingleRoom;
}

function createPlannedOption({
  childPricingRules,
  departure,
  description,
  idPrefix,
  recommended,
  plans,
  roomPolicy,
  title,
  travellers,
}: {
  childPricingRules: ChildPricingRule[];
  departure: PricedDeparture;
  description?: string;
  idPrefix?: string;
  recommended?: boolean;
  plans: PlannedRoomAllocation[];
  roomPolicy?: RoomPolicy;
  title: string;
  travellers: Traveller[];
}): AccommodationOption | null {
  const rooms = allocatePlannedRooms({
    childPricingRules,
    departure,
    plans,
    roomPolicy,
  });
  const option = createOption({
    departure,
    description,
    idPrefix,
    recommended,
    rooms,
    title,
    travellers,
  });

  return validateAccommodationOption(
    option,
    travellers,
    roomPolicy,
    childPricingRules
  ).length === 0
    ? option
    : null;
}

function createChildSingleRoomOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: ChildPricingRule[];
  children: Traveller[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  travellers: Traveller[];
}) {
  if (!canChildUseSingleRoom(roomPolicy)) {
    return [];
  }

  const options: AccommodationOption[] = [];
  const childSinglePlans = children.map(
    (child): PlannedRoomAllocation => ({
      roomType: "single",
      assignments: [{ traveller: child, bedType: "single_room" }],
    })
  );
  const allSingleOption = safeCreateOption(() =>
    createPlannedOption({
      childPricingRules,
      departure,
      idPrefix: "child-single-room",
      plans: [
        ...adults.map(
          (adult): PlannedRoomAllocation => ({
            roomType: "single",
            assignments: [{ traveller: adult, bedType: "single_room" }],
          })
        ),
        ...childSinglePlans,
      ],
      roomPolicy,
      title: `${travellers.length} Single Rooms`,
      travellers,
    })
  );

  if (allSingleOption) {
    options.push(allSingleOption);
  }

  if (adults.length === 2) {
    (["double", "twin"] as const).forEach((roomType) => {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-single-room",
          plans: [
            {
              roomType,
              assignments: adults.map((adult) => ({
                traveller: adult,
                bedType: "standard_bed" as const,
              })),
            },
            ...childSinglePlans,
          ],
          roomPolicy,
          title: `${getReadableRoomName(roomType)} + ${
            children.length === 1
              ? "Child Single Room"
              : `${children.length} Child Single Rooms`
          }`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    });
  }

  return options;
}

function generateTwoAdultsOneChildOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: ChildPricingRule[];
  children: Traveller[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  travellers: Traveller[];
}) {
  const child = children[0];
  const options: AccommodationOption[] = [];

  (["double", "twin"] as const).forEach((roomType) => {
    const roomName = getReadableRoomName(roomType);

    if (canChildUseExtraBed({ child, childPricingRules, roomPolicy })) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "option",
          plans: [
            {
              roomType: getTripleRoomType(roomType),
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                { traveller: child, bedType: "extra_bed" as const },
              ],
            },
          ],
          recommended: true,
          roomPolicy,
          title: `${roomName} + Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }

    if (canChildShareWithoutExtraBed({ child, childPricingRules, roomPolicy })) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: [
            {
              roomType,
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                { traveller: child, bedType: "without_extra_bed" as const },
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} - Child Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }
  });

  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function generateOneAdultTwoChildrenOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: ChildPricingRule[];
  children: Traveller[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  travellers: Traveller[];
}) {
  const adult = adults[0];
  const options: AccommodationOption[] = [];
  const policy = normalizeRoomPolicy(roomPolicy);

  (["double", "twin"] as const).forEach((roomType) => {
    const roomName = getReadableRoomName(roomType);

    children.forEach((extraBedChild, extraBedIndex) => {
      const sharingChild = children.find(
        (_child, index) => index !== extraBedIndex
      );

      if (
        !sharingChild ||
        !canChildUseExtraBed({ child: extraBedChild, childPricingRules, roomPolicy })
      ) {
        return;
      }

      if (
        canChildShareWithoutExtraBed({
          child: sharingChild,
          childPricingRules,
          roomPolicy,
        })
      ) {
        const option = safeCreateOption(() =>
          createPlannedOption({
            childPricingRules,
            departure,
            idPrefix: "option",
            plans: [
              {
                roomType: getTripleRoomType(roomType),
                assignments: [
                  { traveller: adult, bedType: "standard_bed" },
                  { traveller: extraBedChild, bedType: "extra_bed" },
                  { traveller: sharingChild, bedType: "without_extra_bed" },
                ],
              },
            ],
            recommended: true,
            roomPolicy,
            title: `${roomName} + Extra Bed - Child Without Extra Bed`,
            travellers,
          })
        );

        if (option) {
          options.push(option);
        }
      }

      const standardBedOption = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "option",
          plans: [
            {
              roomType: getTripleRoomType(roomType),
              assignments: [
                { traveller: adult, bedType: "standard_bed" },
                { traveller: sharingChild, bedType: "standard_bed" },
                { traveller: extraBedChild, bedType: "extra_bed" },
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} + Extra Bed`,
          travellers,
        })
      );

      if (standardBedOption) {
        options.push(standardBedOption);
      }
    });

    if (
      policy.maxChildrenWithoutExtraBedPerRoom >= 2 &&
      children.every((child) =>
        canChildShareWithoutExtraBed({ child, childPricingRules, roomPolicy })
      )
    ) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: [
            {
              roomType,
              assignments: [
                { traveller: adult, bedType: "standard_bed" },
                ...children.map((child) => ({
                  traveller: child,
                  bedType: "without_extra_bed" as const,
                })),
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} - 2 Children Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }
  });

  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function generateTwoAdultsTwoChildrenOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: ChildPricingRule[];
  children: Traveller[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  travellers: Traveller[];
}) {
  const options: AccommodationOption[] = [];
  const policy = normalizeRoomPolicy(roomPolicy);
  const familyRoomSets: Array<{
    roomTypes: ["double" | "twin", "double" | "twin"];
    title: string;
  }> = [
    { roomTypes: ["double", "double"], title: "2 Double Rooms" },
    { roomTypes: ["twin", "twin"], title: "2 Twin Rooms" },
    { roomTypes: ["double", "twin"], title: "Double Room + Twin Room" },
  ];

  familyRoomSets.forEach(({ roomTypes, title }) => {
    const standardOption = safeCreateOption(() =>
      createPlannedOption({
        childPricingRules,
        departure,
        idPrefix: "option",
        plans: roomTypes.map((roomType, index) => ({
          roomType,
          assignments: [
            { traveller: adults[index], bedType: "standard_bed" as const },
            { traveller: children[index], bedType: "standard_bed" as const },
          ],
        })),
        recommended: true,
        roomPolicy,
        title,
        travellers,
      })
    );

    if (standardOption) {
      options.push(standardOption);
    }

    if (
      children.every((child) =>
        canChildShareWithoutExtraBed({ child, childPricingRules, roomPolicy })
      )
    ) {
      const sharingOption = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: roomTypes.map((roomType, index) => ({
            roomType,
            assignments: [
              { traveller: adults[index], bedType: "standard_bed" as const },
              { traveller: children[index], bedType: "without_extra_bed" as const },
            ],
          })),
          roomPolicy,
          title: `${title} - Children Without Extra Bed`,
          travellers,
        })
      );

      if (sharingOption) {
        options.push(sharingOption);
      }
    }
  });

  (["double", "twin"] as const).forEach((roomType) => {
    const roomName = getReadableRoomName(roomType);

    if (
      policy.maxChildrenWithoutExtraBedPerRoom >= 2 &&
      children.every((child) =>
        canChildShareWithoutExtraBed({ child, childPricingRules, roomPolicy })
      )
    ) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: [
            {
              roomType,
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                ...children.map((child) => ({
                  traveller: child,
                  bedType: "without_extra_bed" as const,
                })),
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} - 2 Children Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }

    children.forEach((extraBedChild, extraBedIndex) => {
      const sharingChild = children.find(
        (_child, index) => index !== extraBedIndex
      );

      if (
        !sharingChild ||
        !canChildUseExtraBed({ child: extraBedChild, childPricingRules, roomPolicy }) ||
        !canChildShareWithoutExtraBed({
          child: sharingChild,
          childPricingRules,
          roomPolicy,
        })
      ) {
        return;
      }

      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "option",
          plans: [
            {
              roomType: getTripleRoomType(roomType),
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                { traveller: extraBedChild, bedType: "extra_bed" },
                { traveller: sharingChild, bedType: "without_extra_bed" },
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} + Extra Bed - Child Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    });
  });

  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function getAdultRoomTypeLists(adultCount: number): RoomType[][] {
  if (adultCount === 1) {
    return [["single"], ["twin"], ["triple_twin"]];
  }

  if (adultCount === 2) {
    return [["double"], ["twin"], ["single", "single"]];
  }

  if (adultCount === 3) {
    return [
      ["triple_double"],
      ["triple_twin"],
      ["double", "single"],
      ["twin", "single"],
      ["single", "single", "single"],
    ];
  }

  if (adultCount === 4) {
    return [
      ["double", "double"],
      ["twin", "twin"],
      ["double", "twin"],
      ["single", "single", "single", "single"],
    ];
  }

  return generateRoomCombinations(adultCount);
}

function createAdultPlans(
  adults: Traveller[],
  roomTypeList: RoomType[]
): PlannedRoomAllocation[] {
  let adultCursor = 0;

  return roomTypeList.map((roomType) => {
    const capacity = ROOM_TYPES[roomType].capacity;
    const roomAdults = adults.slice(adultCursor, adultCursor + capacity);

    adultCursor += capacity;

    return {
      roomType,
      assignments: roomAdults.map((adult, occupantIndex) => ({
        traveller: adult,
        bedType:
          roomType === "single"
            ? "single_room"
            : roomType.startsWith("triple") && occupantIndex === 2
              ? "extra_bed"
              : "standard_bed",
      })),
    };
  });
}

function generateGenericFamilyOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: ChildPricingRule[];
  children: Traveller[];
  departure: PricedDeparture;
  roomPolicy?: RoomPolicy;
  travellers: Traveller[];
}) {
  const options: AccommodationOption[] = [];
  const pairedChildrenCount = Math.min(adults.length, children.length);

  if (pairedChildrenCount > 0) {
    (["double", "twin"] as const).forEach((roomType) => {
      const pairedRooms = Array.from(
        { length: pairedChildrenCount },
        (_item, index): PlannedRoomAllocation => ({
          roomType,
          assignments: [
            { traveller: adults[index], bedType: "standard_bed" },
            { traveller: children[index], bedType: "standard_bed" },
          ],
        })
      );
      const remainingAdults = adults.slice(pairedChildrenCount);
      const remainingChildren = children.slice(pairedChildrenCount);

      if (remainingChildren.length > 0) {
        return;
      }

      const remainingAdultRoomTypes =
        remainingAdults.length > 0
          ? getAdultRoomTypeLists(remainingAdults.length).slice(0, 3)
          : [[]];

      remainingAdultRoomTypes.forEach((adultRoomTypes) => {
        const adultPlans = createAdultPlans(remainingAdults, adultRoomTypes);
        const option = safeCreateOption(() =>
          createPlannedOption({
            childPricingRules,
            departure,
            idPrefix: "option",
            plans: [...pairedRooms, ...adultPlans],
            roomPolicy,
            title: getRoomTitle([
              ...pairedRooms.map((room) => room.roomType),
              ...adultPlans.map((room) => room.roomType),
            ]),
            travellers,
          })
        );

        if (option) {
          options.push(option);
        }
      });
    });
  }

  const childWithoutBedOptions = childWithoutBedRoomCombinations(
    adults.length,
    children.length,
    roomPolicy
  )
    .map((roomTypeList) =>
      safeCreateOption(() =>
        createChildWithoutBedOption({
          childPricingRules,
          departure,
          roomPolicy,
          roomTypeList,
          travellers,
        })
      )
    )
    .filter((option): option is AccommodationOption => Boolean(option));

  options.push(...childWithoutBedOptions);
  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function createSoloSharingOption({
  departure,
  preferredSharingType,
  roomPolicy,
  roomType,
  travellers,
}: {
  departure: PricedDeparture;
  preferredSharingType: "twin" | "triple";
  roomPolicy?: RoomPolicy;
  roomType: RoomType;
  travellers: Traveller[];
}): AccommodationOption {
  const rooms = allocateTravellersToRooms({
    childPricingRules: departure.childPricingRules,
    departure,
    roomPolicy,
    roomTypes: [roomType],
    travellers,
  });
  const option = createOption({
    departure,
    idPrefix: "solo-sharing",
    rooms,
    title:
      preferredSharingType === "twin"
        ? "Sharing in Twin Occupancy"
        : "Sharing in Triple Occupancy",
    description: "Traveller sharing with another tour guest",
    travellers,
  });

  return {
    ...option,
    requiresRoommateMatching: true,
    preferredSharingType,
  };
}

function limitVisibleOptions(options: AccommodationOption[], limit: number) {
  const ranked = rankAccommodationOptions(options);
  const allSingle = ranked.find((option) =>
    option.rooms.every((room) => room.roomType === "single")
  );
  const extraBedOption = ranked.find(
    (option) => option.pricingBreakdown.extraBedCount > 0
  );
  const includeRequiredOption = (
    visibleOptions: AccommodationOption[],
    requiredOption: AccommodationOption | undefined,
    protectedIds = new Set<string>()
  ) => {
    if (
      !requiredOption ||
      limit <= 0 ||
      visibleOptions.some((option) => option.id === requiredOption.id)
    ) {
      return visibleOptions;
    }

    if (visibleOptions.length < limit) {
      return [...visibleOptions, requiredOption];
    }

    const replaceIndex = [...visibleOptions]
      .reverse()
      .findIndex((option) => !protectedIds.has(option.id));

    if (replaceIndex === -1) {
      return visibleOptions;
    }

    const nextVisibleOptions = [...visibleOptions];

    nextVisibleOptions[visibleOptions.length - 1 - replaceIndex] =
      requiredOption;

    return nextVisibleOptions;
  };

  if (ranked[0]?.totalTravellers && ranked[0].totalTravellers >= 5) {
    const visible: AccommodationOption[] = [];
    const addOption = (option: AccommodationOption | undefined) => {
      if (option && !visible.some((item) => item.id === option.id)) {
        visible.push(option);
      }
    };
    const counts = (option: AccommodationOption) => {
      const singles = option.rooms.filter((room) => room.roomType === "single").length;
      const standards = option.rooms.filter(
        (room) => room.roomType === "double" || room.roomType === "twin"
      ).length;
      const triples = option.rooms.filter((room) =>
        room.roomType.startsWith("triple")
      ).length;

      return { singles, standards, triples };
    };
    const matches = (
      predicate: (values: ReturnType<typeof counts>) => boolean
    ) => ranked.filter((option) => predicate(counts(option)));

    addOption(matches(({ triples, standards, singles }) => triples === 0 && standards > 0 && singles <= 1)[0]);

    const tripleStandard = matches(
      ({ triples, standards, singles }) => triples > 0 && standards > 0 && singles === 0
    );
    addOption(tripleStandard[0]);
    addOption(tripleStandard[tripleStandard.length - 1]);
    addOption(matches(({ triples, standards, singles }) => triples > 0 && standards === 0 && singles === 0)[0]);
    addOption(matches(({ triples, standards, singles }) => triples === 0 && standards > 0 && singles > 1)[0]);
    addOption(matches(({ triples, standards, singles }) => triples > 0 && standards === 0 && singles > 0)[0]);
    addOption(matches(({ triples, standards, singles }) => triples > 0 && standards > 0 && singles > 0)[0]);
    addOption(allSingle);

    ranked.forEach((option) => {
      if (visible.length < limit) {
        addOption(option);
      }
    });

    const limitedVisible = visible.slice(0, limit);

    if (allSingle && !limitedVisible.some((option) => option.id === allSingle.id)) {
      limitedVisible.splice(Math.max(0, limit - 1), 1, allSingle);
    }

    return includeRequiredOption(
      limitedVisible,
      extraBedOption,
      new Set(allSingle ? [allSingle.id] : [])
    );
  }

  let visible = ranked.slice(0, limit);

  if (allSingle && !visible.some((option) => option.id === allSingle.id)) {
    visible.splice(Math.max(0, limit - 1), 1, allSingle);
  }

  visible = includeRequiredOption(
    visible,
    extraBedOption,
    new Set(allSingle ? [allSingle.id] : [])
  );

  return visible;
}

export function generateAccommodationOptions({
  childPricingRules,
  departure,
  includeSoloTripleSharing = true,
  maxVisibleOptions = MAX_VISIBLE_OPTIONS,
  roomPolicy,
  travellers,
}: {
  travellers: Traveller[];
  departure: PricedDeparture;
  childPricingRules?: ChildPricingRule[];
  includeSoloTripleSharing?: boolean;
  maxVisibleOptions?: number;
  roomPolicy?: RoomPolicy;
}): AccommodationOption[] {
  if (travellers.length === 0) {
    throw new Error("At least one traveller is required.");
  }

  if (travellers.length > 25) {
    throw new Error("A maximum of 25 travellers can be booked at once.");
  }

  const rules = childPricingRules || departure.childPricingRules;
  const resolvedRoomPolicy = normalizeRoomPolicy(roomPolicy || departure.roomPolicy);
  const adults = travellers.filter((traveller) => traveller.type === "adult");
  const children = travellers.filter((traveller) => traveller.type === "child");
  const uniqueTravellerIds = new Set(
    travellers.map((traveller) => traveller.id)
  );

  assertChildAgeInputs({
    departure,
    travellers,
  });

  if (uniqueTravellerIds.size !== travellers.length) {
    throw new Error("Traveller IDs must be unique.");
  }

  const hydratedChildren = children.length
    ? hydrateChildrenForGeneration(children, departure)
    : [];
  const resolvedTravellers = [...adults, ...hydratedChildren];

  if (children.length === 0 && travellers.length === 1 && adults.length === 1) {
    return [
      createNormalOption({
        childPricingRules: rules,
        departure,
        roomPolicy: resolvedRoomPolicy,
        roomTypeList: ["single"],
        travellers: resolvedTravellers,
      }),
      createSoloSharingOption({
        departure,
        preferredSharingType: "twin",
        roomPolicy: resolvedRoomPolicy,
        roomType: "twin",
        travellers: resolvedTravellers,
      }),
      includeSoloTripleSharing
        ? createSoloSharingOption({
            departure,
            preferredSharingType: "triple",
            roomPolicy: resolvedRoomPolicy,
            roomType: "triple_twin",
            travellers: resolvedTravellers,
          })
        : null,
    ].filter((option): option is AccommodationOption => Boolean(option));
  }

  if (children.length === 0) {
    const adultOptions = getAdultRoomTypeLists(adults.length)
      .map((roomTypeList) =>
        safeCreateOption(() =>
          createNormalOption({
            childPricingRules: rules,
            departure,
            roomPolicy: resolvedRoomPolicy,
            roomTypeList,
            travellers: resolvedTravellers,
          })
        )
      )
      .filter((option): option is AccommodationOption => Boolean(option));

    return limitVisibleOptions(
      deduplicateAccommodationOptions(adultOptions),
      maxVisibleOptions
    );
  }

  const childAwareOptions =
    adults.length === 2 && hydratedChildren.length === 1
      ? generateTwoAdultsOneChildOptions({
          adults,
          childPricingRules: rules,
          children: hydratedChildren,
          departure,
          roomPolicy: resolvedRoomPolicy,
          travellers: resolvedTravellers,
        })
      : adults.length === 1 && hydratedChildren.length === 2
        ? generateOneAdultTwoChildrenOptions({
            adults,
            childPricingRules: rules,
            children: hydratedChildren,
            departure,
            roomPolicy: resolvedRoomPolicy,
            travellers: resolvedTravellers,
          })
        : adults.length === 2 && hydratedChildren.length === 2
          ? generateTwoAdultsTwoChildrenOptions({
              adults,
              childPricingRules: rules,
              children: hydratedChildren,
              departure,
              roomPolicy: resolvedRoomPolicy,
              travellers: resolvedTravellers,
            })
          : generateGenericFamilyOptions({
              adults,
              childPricingRules: rules,
              children: hydratedChildren,
              departure,
              roomPolicy: resolvedRoomPolicy,
              travellers: resolvedTravellers,
            });
  const options = deduplicateAccommodationOptions(childAwareOptions);

  return limitVisibleOptions(options, maxVisibleOptions);
}

export function validateDepartureForBooking(
  departure: PricedDeparture,
  requestedTravellers: number,
  today = new Date()
): string[] {
  const errors: string[] = [];
  const departureDate = toDate(departure.departureDate);
  const returnDate = toDate(departure.returnDate);
  const bookingDeadline = toDate(departure.bookingDeadline);

  if (requestedTravellers <= 0) {
    errors.push("At least one traveller is required.");
  }

  if (requestedTravellers > 25) {
    errors.push("A maximum of 25 travellers can be booked at once.");
  }

  if (departure.status === "coming_soon") {
    errors.push("This departure is coming soon and cannot be booked yet.");
  }

  if (departure.status === "closed") {
    errors.push("Bookings are closed for this departure.");
  }

  if (departure.status === "cancelled") {
    errors.push("This departure has been cancelled.");
  }

  if (departure.status === "scheduled") {
    if (!departureDate || !returnDate) {
      errors.push("Scheduled departures require departure and return dates.");
    } else if (returnDate.getTime() <= departureDate.getTime()) {
      errors.push("Return date must be after departure date.");
    }
  }

  if (
    bookingDeadline &&
    new Date(today).setHours(0, 0, 0, 0) >
      new Date(bookingDeadline).setHours(0, 0, 0, 0)
  ) {
    errors.push("Bookings are closed for this departure.");
  }

  if (requestedTravellers > departure.seatsAvailable) {
    errors.push("Requested travellers exceed available seats.");
  }

  return errors;
}

export function calculateDeposit({
  depositAppliesTo,
  depositType,
  depositValue,
  grandTotal,
  totalTravellers,
}: {
  depositType: DepositType;
  depositValue: number;
  depositAppliesTo: DepositAppliesTo;
  grandTotal: number;
  totalTravellers: number;
}) {
  const rawDeposit =
    depositType === "percentage"
      ? (grandTotal * depositValue) / 100
      : depositAppliesTo === "per_person"
        ? depositValue * totalTravellers
        : depositValue;

  return Math.min(Math.max(0, Math.round(rawDeposit)), Math.max(0, grandTotal));
}

export function calculateBalance(grandTotal: number, depositAmount: number) {
  return Math.max(0, Math.round(grandTotal - depositAmount));
}

export function calculateBalanceDueDate(
  departureDate: string | null,
  balanceDueDaysBefore: number
) {
  const date = toDate(departureDate);

  if (!date) {
    return null;
  }

  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() - Math.max(0, balanceDueDaysBefore));

  return dueDate;
}
