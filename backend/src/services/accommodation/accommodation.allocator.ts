import { getPriceForCategory } from "../departure/departure.pricing";
import type {
  ChildPricingRule,
  PricedDeparture,
  PricingCategory,
  RoomPolicy,
} from "../departure/departure.types";
import {
  calculateAgeOnDate,
  normalizeRoomPolicy,
  resolveChildPricing,
} from "./accommodation.validation";
import {
  ROOM_TYPES,
  type AllocationBedType,
  type ChildBedType,
  type RoomAllocation,
  type RoomType,
  type Traveller,
  type TravellerAllocation,
} from "./accommodation.types";

function getDepartureDate(departure: PricedDeparture): Date {
  const date =
    departure.departureDate instanceof Date
      ? departure.departureDate
      : new Date(departure.departureDate || "");

  if (Number.isNaN(date.getTime())) {
    throw new Error("A scheduled departure date is required for allocation.");
  }

  return date;
}

function hydrateTravellerAge(
  traveller: Traveller,
  departure: PricedDeparture
): Traveller {
  if (traveller.type !== "child" || traveller.ageOnDeparture !== undefined) {
    return traveller;
  }

  if (!traveller.dateOfBirth) {
    throw new Error(`Date of birth is required for child ${traveller.id}.`);
  }

  return {
    ...traveller,
    ageOnDeparture: calculateAgeOnDate(
      traveller.dateOfBirth,
      getDepartureDate(departure)
    ),
  };
}

function priceAllocation(
  traveller: Traveller,
  roomId: string,
  roomType: RoomType,
  bedType: AllocationBedType,
  category: PricingCategory,
  departure: PricedDeparture
): TravellerAllocation {
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

export type RoomTravellerAssignment = {
  traveller: Traveller;
  bedType: AllocationBedType;
};

export type PlannedRoomAllocation = {
  roomType: RoomType;
  assignments: RoomTravellerAssignment[];
};

export function assignPricing({
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

export function allocatePlannedRooms({
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

      return priceAllocation(
        assignment.traveller,
        roomId,
        plan.roomType,
        pricing.bedType,
        pricing.pricingCategory,
        departure
      );
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

function getRoomTitleParts(roomTypes: RoomType[]) {
  const counts = roomTypes.reduce(
    (map, roomType) => {
      map[roomType] = (map[roomType] || 0) + 1;
      return map;
    },
    {} as Partial<Record<RoomType, number>>
  );

  return Object.entries(counts).map(([roomType, count]) => {
    const config = ROOM_TYPES[roomType as RoomType];

    return `${count} ${config.title}`;
  });
}

export function createAccommodationTitle(roomTypes: RoomType[]) {
  return getRoomTitleParts(roomTypes).join(" + ");
}

export function createAccommodationDescription(roomTypes: RoomType[]) {
  return getRoomTitleParts(roomTypes).join(", ");
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

      return priceAllocation(
        traveller,
        roomId,
        roomType,
        pricing.bedType,
        pricing.pricingCategory,
        departure
      );
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

export function allocateChildrenWithoutExtraBed({
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
  const adultTravellers = travellers.filter((traveller) => traveller.type === "adult");
  const childTravellers = travellers
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
    if (adultCursor >= adultTravellers.length || room.roomType === "single") {
      return;
    }

    const traveller = adultTravellers[adultCursor];
    const pricing = assignPricing({
      bedType: "standard_bed",
      childPricingRules,
      roomPolicy,
      traveller,
    });
    const allocation = priceAllocation(
      traveller,
      room.id,
      room.roomType,
      pricing.bedType,
      pricing.pricingCategory,
      departure
    );

    room.travellerIds.push(traveller.id);
    room.allocations.push(allocation);
    adultCursor += 1;
  });

  rooms.forEach((room) => {
    while (adultCursor < adultTravellers.length && room.allocations.length < room.capacity) {
      const traveller = adultTravellers[adultCursor];
      const pricing = assignPricing({
        bedType: "standard_bed",
        childPricingRules,
        roomPolicy,
        traveller,
      });
      const allocation = priceAllocation(
        traveller,
        room.id,
        room.roomType,
        pricing.bedType,
        pricing.pricingCategory,
        departure
      );

      room.travellerIds.push(traveller.id);
      room.allocations.push(allocation);
      adultCursor += 1;
    }
  });

  if (adultCursor < adultTravellers.length) {
    throw new Error("Adults could not be allocated safely.");
  }

  childTravellers.forEach((traveller) => {
    if (!policy.allowChildBedSharing) {
      throw new Error("Children without extra bed are not allowed.");
    }

    const room = rooms
      .filter((candidate) => candidate.roomType !== "single")
      .filter((candidate) =>
        candidate.allocations.some((allocation) =>
          adultTravellers.some((adult) => adult.id === allocation.travellerId)
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
    const allocation = priceAllocation(
      traveller,
      room.id,
      room.roomType,
      pricing.bedType,
      pricing.pricingCategory,
      departure
    );

    room.travellerIds.push(traveller.id);
    room.allocations.push(allocation);
  });

  if (rooms.some((room) => room.allocations.length === 0)) {
    throw new Error("Room allocation created an empty room.");
  }

  return rooms;
}
