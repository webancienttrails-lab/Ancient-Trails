import type { PricedDeparture } from "../departure/departure.types";
import {
  ROOM_TYPES,
  type AccommodationOption,
  type OccupancyBreakdownItem,
  type OccupancyRateType,
  type RoomAllocation,
  type TravellerAllocation,
  type TravellerType,
  type RoomType,
} from "./accommodation.types";

type ChildInput = {
  id?: string;
  age?: number;
  dateOfBirth?: string;
};

type Guest = {
  id: string;
  index: number;
  type: TravellerType;
  age?: number;
};

type GuestRate = {
  bedType: TravellerAllocation["bedType"];
  rateType: OccupancyRateType;
  amount: number;
};

type RoomGuestPlan = {
  guest: Guest;
  rate: GuestRate;
};

type RoomPlan = {
  roomType: RoomType;
  guests: RoomGuestPlan[];
};

type GeneratedOptionDraft = {
  title: string;
  plans: RoomPlan[];
  description?: string;
  recommended?: boolean;
  requiresRoommateMatching?: boolean;
  preferredSharingType?: "twin" | "triple";
};

const rateCategoryByType: Record<
  OccupancyRateType,
  TravellerAllocation["pricingCategory"]
> = {
  ADULT: "adult",
  SINGLE_OCCUPANCY: "single_occupancy",
  EXTRA_BED: "extra_bed",
  CHILD_WITHOUT_EXTRA_BED: "child_without_extra_bed",
  FREE_CHILD: "free_child",
};

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
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

function hasFinalRate(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getRateAmount(
  selectedDeparture: PricedDeparture,
  rateType: Exclude<OccupancyRateType, "FREE_CHILD">
) {
  switch (rateType) {
    case "ADULT":
      return selectedDeparture.priceAdult;
    case "SINGLE_OCCUPANCY":
      return selectedDeparture.singleOccupancy;
    case "EXTRA_BED":
      return selectedDeparture.priceExtraBed;
    case "CHILD_WITHOUT_EXTRA_BED":
      return selectedDeparture.priceChildWithoutExtraBed;
  }
}

function assertRate(
  selectedDeparture: PricedDeparture,
  rateType: Exclude<OccupancyRateType, "FREE_CHILD">
) {
  const rate = getRateAmount(selectedDeparture, rateType);

  if (!hasFinalRate(rate)) {
    throw new Error(`Required ${rateType} departure price is missing.`);
  }

  return rate;
}

function optionalRate(
  selectedDeparture: PricedDeparture,
  rateType: Exclude<OccupancyRateType, "ADULT" | "FREE_CHILD">
) {
  const rate = getRateAmount(selectedDeparture, rateType);

  return hasFinalRate(rate) ? rate : Number.NaN;
}

function adultRate(selectedDeparture: PricedDeparture): GuestRate {
  return {
    bedType: "standard_bed",
    rateType: "ADULT",
    amount: assertRate(selectedDeparture, "ADULT"),
  };
}

function singleRate(selectedDeparture: PricedDeparture): GuestRate {
  return {
    bedType: "single_room",
    rateType: "SINGLE_OCCUPANCY",
    amount: optionalRate(selectedDeparture, "SINGLE_OCCUPANCY"),
  };
}

function extraBedRate(selectedDeparture: PricedDeparture): GuestRate {
  return {
    bedType: "extra_bed",
    rateType: "EXTRA_BED",
    amount: optionalRate(selectedDeparture, "EXTRA_BED"),
  };
}

function freeChildRate(): GuestRate {
  return {
    bedType: "without_extra_bed",
    rateType: "FREE_CHILD",
    amount: 0,
  };
}

function childWithoutBedRate(
  child: Guest,
  selectedDeparture: PricedDeparture
): GuestRate {
  if ((child.age ?? 0) < 6) {
    return freeChildRate();
  }

  return {
    bedType: "without_extra_bed",
    rateType: "CHILD_WITHOUT_EXTRA_BED",
    amount: optionalRate(selectedDeparture, "CHILD_WITHOUT_EXTRA_BED"),
  };
}

function childStandardBedRate(
  child: Guest,
  selectedDeparture: PricedDeparture
): GuestRate {
  if ((child.age ?? 0) < 6) {
    return freeChildRate();
  }

  return adultRate(selectedDeparture);
}

function getGuestLabel(guest: Guest, rateType?: OccupancyRateType) {
  if (guest.type === "adult") {
    return `Adult ${guest.index}`;
  }

  if (rateType === "EXTRA_BED") {
    return `Child ${guest.index} - Extra Bed`;
  }

  if (rateType === "CHILD_WITHOUT_EXTRA_BED") {
    return `Child ${guest.index} - Without Extra Bed`;
  }

  if (rateType === "FREE_CHILD") {
    return `Child ${guest.index} - Complimentary`;
  }

  if (rateType === "ADULT") {
    return `Child ${guest.index} - Adult Rate`;
  }

  return `Child ${guest.index}`;
}

function createAdults(count: number): Guest[] {
  return Array.from({ length: count }, (_item, index) => ({
    id: `adult-${index + 1}`,
    index: index + 1,
    type: "adult" as const,
  }));
}

function resolveChildAge(
  child: ChildInput,
  selectedDeparture: PricedDeparture,
  index: number
) {
  if (typeof child.age === "number" && Number.isFinite(child.age)) {
    return Math.max(0, Math.floor(child.age));
  }

  if (!child.dateOfBirth) {
    throw new Error(`Child ${index + 1} date of birth is required.`);
  }

  const departureDate = toDate(selectedDeparture.departureDate);

  if (!departureDate) {
    throw new Error("Departure date is required for child pricing.");
  }

  return calculateAgeOnDate(child.dateOfBirth, departureDate);
}

function createChildren(
  children: ChildInput[],
  selectedDeparture: PricedDeparture
): Guest[] {
  return children.map((child, index) => ({
    id: child.id || `child-${index + 1}`,
    index: index + 1,
    type: "child" as const,
    age: resolveChildAge(child, selectedDeparture, index),
  }));
}

function roomTitle(roomType: RoomType, roomNumber: number) {
  return `Room ${roomNumber} - ${ROOM_TYPES[roomType].title}`;
}

function createRoom(plan: RoomPlan, index: number): RoomAllocation {
  const roomNumber = index + 1;
  const roomId = `room-${roomNumber}`;
  const config = ROOM_TYPES[plan.roomType];
  const allocations = plan.guests.map(({ guest, rate }) => ({
    travellerId: guest.id,
    travellerType: guest.type,
    label: getGuestLabel(guest, rate.rateType),
    roomId,
    roomType: plan.roomType,
    bedType: rate.bedType,
    rateType: rate.rateType,
    pricingCategory: rateCategoryByType[rate.rateType],
    amount: rate.amount,
    price: rate.amount,
    ...(guest.type === "child" ? { ageOnDeparture: guest.age } : {}),
  }));

  return {
    id: roomId,
    title: roomTitle(plan.roomType, roomNumber),
    roomType: plan.roomType,
    bedSummary: config.bedSummary,
    capacity: config.capacity,
    travellerIds: allocations.map((allocation) => allocation.travellerId),
    allocations,
  };
}

function createPricingBreakdown(
  breakdown: OccupancyBreakdownItem[],
  selectedDeparture: PricedDeparture
): AccommodationOption["pricingBreakdown"] {
  const count = (rateType: OccupancyRateType) =>
    breakdown.filter((item) => item.rateType === rateType).length;

  return {
    adultCount: count("ADULT"),
    adultUnitPrice: hasFinalRate(selectedDeparture.priceAdult)
      ? selectedDeparture.priceAdult
      : 0,
    extraBedCount: count("EXTRA_BED"),
    extraBedUnitPrice: hasFinalRate(selectedDeparture.priceExtraBed)
      ? selectedDeparture.priceExtraBed
      : 0,
    childWithoutExtraBedCount: count("CHILD_WITHOUT_EXTRA_BED"),
    childWithoutExtraBedUnitPrice: hasFinalRate(
      selectedDeparture.priceChildWithoutExtraBed
    )
      ? selectedDeparture.priceChildWithoutExtraBed
      : 0,
    singleOccupancyCount: count("SINGLE_OCCUPANCY"),
    singleOccupancyUnitPrice: hasFinalRate(selectedDeparture.singleOccupancy)
      ? selectedDeparture.singleOccupancy
      : 0,
    freeChildCount: count("FREE_CHILD"),
    freeChildUnitPrice: 0,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createOption(
  draft: GeneratedOptionDraft,
  selectedDeparture: PricedDeparture,
  sequence: number
): AccommodationOption {
  const rooms = draft.plans.map(createRoom);
  const breakdown = rooms
    .flatMap((room) => room.allocations)
    .map((allocation) => ({
      label: allocation.label,
      rateType: allocation.rateType,
      amount: allocation.amount,
    }));
  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: `${slugify(draft.title)}-${sequence}`,
    title: draft.title,
    description:
      draft.description ||
      rooms.map((room) => `${room.title}: ${room.bedSummary}`).join("; "),
    rooms,
    breakdown,
    total,
    totalTravellers: breakdown.length,
    pricingBreakdown: createPricingBreakdown(breakdown, selectedDeparture),
    recommended: draft.recommended,
    requiresRoommateMatching: draft.requiresRoommateMatching,
    preferredSharingType: draft.preferredSharingType,
  };
}

function validateOption(
  option: AccommodationOption,
  adultCount: number,
  childCount: number
) {
  const allocations = option.rooms.flatMap((room) => room.allocations);
  const ids = new Set(allocations.map((allocation) => allocation.travellerId));
  const allocatedAdults = allocations.filter(
    (allocation) => allocation.travellerType === "adult"
  ).length;
  const allocatedChildren = allocations.filter(
    (allocation) => allocation.travellerType === "child"
  ).length;
  const total = option.breakdown.reduce((sum, item) => sum + item.amount, 0);

  if (allocatedAdults !== adultCount || allocatedChildren !== childCount) {
    return false;
  }

  if (ids.size !== allocations.length || allocations.length !== option.breakdown.length) {
    return false;
  }

  if (total !== option.total) {
    return false;
  }

  return option.rooms.every((room) => {
    const bedOccupants = room.allocations.filter(
      (allocation) =>
        allocation.bedType === "standard_bed" ||
        allocation.bedType === "single_room" ||
        allocation.bedType === "extra_bed"
    ).length;
    const extraBeds = room.allocations.filter(
      (allocation) => allocation.bedType === "extra_bed"
    ).length;
    const sharingChildren = room.allocations.filter(
      (allocation) =>
        allocation.travellerType === "child" &&
        (allocation.bedType === "without_extra_bed" ||
          allocation.rateType === "FREE_CHILD")
    ).length;

    if (room.roomType === "single") {
      return room.allocations.length === 1 && bedOccupants === 1;
    }

    if (room.roomType === "double" || room.roomType === "twin") {
      return bedOccupants <= 2 && extraBeds === 0 && sharingChildren <= 2;
    }

    return bedOccupants <= 3 && extraBeds === 1 && sharingChildren <= 1;
  });
}

function addOption(
  drafts: GeneratedOptionDraft[],
  draft: GeneratedOptionDraft | null
) {
  if (draft) {
    drafts.push(draft);
  }
}

function adultRoomPlan(
  roomType: RoomType,
  roomAdults: Guest[],
  selectedDeparture: PricedDeparture
): RoomPlan {
  return {
    roomType,
    guests: roomAdults.map((adult, index) => ({
      guest: adult,
      rate:
        roomType === "single"
          ? singleRate(selectedDeparture)
          : roomType === "triple_double" || roomType === "triple_twin"
            ? index === 2
              ? extraBedRate(selectedDeparture)
              : adultRate(selectedDeparture)
            : adultRate(selectedDeparture),
    })),
  };
}

function adultOnlyDrafts(
  adults: Guest[],
  selectedDeparture: PricedDeparture
): GeneratedOptionDraft[] {
  const count = adults.length;
  const drafts: GeneratedOptionDraft[] = [];

  if (count === 1) {
    addOption(drafts, {
      title: "Single Occupancy",
      plans: [adultRoomPlan("single", adults, selectedDeparture)],
      recommended: true,
    });
    addOption(drafts, {
      title: "Twin Sharing",
      description: "1 adult shares a twin room with another tour guest",
      plans: [adultRoomPlan("twin", adults, selectedDeparture)],
      requiresRoommateMatching: true,
      preferredSharingType: "twin",
    });
    return drafts;
  }

  if (count === 2) {
    return [
      {
        title: "Double Occupancy",
        plans: [adultRoomPlan("double", adults, selectedDeparture)],
        recommended: true,
      },
      {
        title: "Twin Occupancy",
        plans: [adultRoomPlan("twin", adults, selectedDeparture)],
      },
      {
        title: "Separate Single Occupancy",
        plans: adults.map((adult) =>
          adultRoomPlan("single", [adult], selectedDeparture)
        ),
      },
    ];
  }

  if (count === 3) {
    return [
      {
        title: "Double + Extra Bed",
        plans: [adultRoomPlan("triple_double", adults, selectedDeparture)],
        recommended: true,
      },
      {
        title: "Twin + Extra Bed",
        plans: [adultRoomPlan("triple_twin", adults, selectedDeparture)],
      },
      {
        title: "Double + Single",
        plans: [
          adultRoomPlan("double", adults.slice(0, 2), selectedDeparture),
          adultRoomPlan("single", adults.slice(2), selectedDeparture),
        ],
      },
      {
        title: "Twin + Single",
        plans: [
          adultRoomPlan("twin", adults.slice(0, 2), selectedDeparture),
          adultRoomPlan("single", adults.slice(2), selectedDeparture),
        ],
      },
      {
        title: "All Single",
        plans: adults.map((adult) =>
          adultRoomPlan("single", [adult], selectedDeparture)
        ),
      },
    ];
  }

  if (count === 4) {
    return [
      {
        title: "Two Double Rooms",
        plans: [
          adultRoomPlan("double", adults.slice(0, 2), selectedDeparture),
          adultRoomPlan("double", adults.slice(2, 4), selectedDeparture),
        ],
        recommended: true,
      },
      {
        title: "Two Twin Rooms",
        plans: [
          adultRoomPlan("twin", adults.slice(0, 2), selectedDeparture),
          adultRoomPlan("twin", adults.slice(2, 4), selectedDeparture),
        ],
      },
      {
        title: "Double + Twin",
        plans: [
          adultRoomPlan("double", adults.slice(0, 2), selectedDeparture),
          adultRoomPlan("twin", adults.slice(2, 4), selectedDeparture),
        ],
      },
      {
        title: "All Single",
        plans: adults.map((adult) =>
          adultRoomPlan("single", [adult], selectedDeparture)
        ),
      },
    ];
  }

  return dynamicAdultDrafts(adults, selectedDeparture);
}

function makeRoomSizes(adultCount: number) {
  const sizes: number[] = [];
  let remaining = adultCount;

  if (remaining % 2 === 1) {
    sizes.push(3);
    remaining -= 3;
  }

  while (remaining > 0) {
    sizes.push(2);
    remaining -= 2;
  }

  return sizes.sort((left, right) => left - right);
}

function dynamicAdultDrafts(
  adults: Guest[],
  selectedDeparture: PricedDeparture
): GeneratedOptionDraft[] {
  const sizes = makeRoomSizes(adults.length);
  const createPlans = (mode: "double" | "twin" | "mixed") => {
    let cursor = 0;

    return sizes.map((size, index) => {
      const roomAdults = adults.slice(cursor, cursor + size);
      cursor += size;
      const useTwin = mode === "twin" || (mode === "mixed" && index % 2 === 1);
      const roomType =
        size === 3
          ? useTwin
            ? "triple_twin"
            : "triple_double"
          : useTwin
            ? "twin"
            : "double";

      return adultRoomPlan(roomType, roomAdults, selectedDeparture);
    });
  };

  return [
    {
      title: "Shared Rooms",
      plans: createPlans("double"),
      recommended: true,
    },
    {
      title: "Twin Shared Rooms",
      plans: createPlans("twin"),
    },
    {
      title: "Mixed Shared Rooms",
      plans: createPlans("mixed"),
    },
    {
      title: "All Single",
      plans: adults.map((adult) =>
        adultRoomPlan("single", [adult], selectedDeparture)
      ),
    },
  ];
}

function childPlan(
  child: Guest,
  selectedDeparture: PricedDeparture,
  mode: "without" | "extra" | "standard"
): RoomGuestPlan {
  if (mode === "extra") {
    return {
      guest: child,
      rate: extraBedRate(selectedDeparture),
    };
  }

  if (mode === "standard") {
    return {
      guest: child,
      rate:
        (child.age ?? 0) < 6
          ? freeChildRate()
          : {
              bedType: "standard_bed",
              rateType: "ADULT",
              amount: assertRate(selectedDeparture, "ADULT"),
            },
    };
  }

  return {
    guest: child,
    rate: childWithoutBedRate(child, selectedDeparture),
  };
}

function adultPlan(adult: Guest, selectedDeparture: PricedDeparture): RoomGuestPlan {
  return {
    guest: adult,
    rate: adultRate(selectedDeparture),
  };
}

function twoAdultsOneChildDrafts(
  adults: Guest[],
  children: Guest[],
  selectedDeparture: PricedDeparture
) {
  const child = children[0];
  const drafts: GeneratedOptionDraft[] = [];

  (["double", "twin"] as const).forEach((roomType) => {
    addOption(drafts, {
      title:
        roomType === "double"
          ? "Double - Child Without Extra Bed"
          : "Twin - Child Without Extra Bed",
      plans: [
        {
          roomType,
          guests: [
            ...adults.map((adult) => adultPlan(adult, selectedDeparture)),
            childPlan(child, selectedDeparture, "without"),
          ],
        },
      ],
      recommended: true,
    });

    if ((child.age ?? 0) >= 6) {
      addOption(drafts, {
        title:
          roomType === "double"
            ? "Double + Extra Bed"
            : "Twin + Extra Bed",
        plans: [
          {
            roomType: roomType === "double" ? "triple_double" : "triple_twin",
            guests: [
              ...adults.map((adult) => adultPlan(adult, selectedDeparture)),
              childPlan(child, selectedDeparture, "extra"),
            ],
          },
        ],
      });
    }
  });

  return drafts;
}

function oneAdultChildrenDrafts(
  adults: Guest[],
  children: Guest[],
  selectedDeparture: PricedDeparture
) {
  const drafts: GeneratedOptionDraft[] = [];

  (["double", "twin"] as const).forEach((roomType) => {
    addOption(drafts, {
      title:
        roomType === "double"
          ? "Double - Children Without Extra Bed"
          : "Twin - Children Without Extra Bed",
      plans: [
        {
          roomType,
          guests: [
            adultPlan(adults[0], selectedDeparture),
            ...children.map((child) =>
              childPlan(child, selectedDeparture, "without")
            ),
          ],
        },
      ],
      recommended: true,
    });

    children.forEach((extraBedChild) => {
      if ((extraBedChild.age ?? 0) < 6) {
        return;
      }

      addOption(drafts, {
        title:
          roomType === "double"
            ? `Double + Extra Bed - Child ${extraBedChild.index}`
            : `Twin + Extra Bed - Child ${extraBedChild.index}`,
        plans: [
          {
            roomType: roomType === "double" ? "triple_double" : "triple_twin",
            guests: [
              adultPlan(adults[0], selectedDeparture),
              childPlan(extraBedChild, selectedDeparture, "extra"),
              ...children
                .filter((child) => child.id !== extraBedChild.id)
                .map((child) => childPlan(child, selectedDeparture, "without")),
            ],
          },
        ],
      });
    });
  });

  return drafts;
}

function twoAdultsTwoChildrenDrafts(
  adults: Guest[],
  children: Guest[],
  selectedDeparture: PricedDeparture
) {
  const drafts: GeneratedOptionDraft[] = [];

  (["double", "twin"] as const).forEach((roomType) => {
    addOption(drafts, {
      title: roomType === "double" ? "Two Double Rooms" : "Two Twin Rooms",
      plans: [
        {
          roomType,
          guests: [
            adultPlan(adults[0], selectedDeparture),
            childPlan(children[0], selectedDeparture, "standard"),
          ],
        },
        {
          roomType,
          guests: [
            adultPlan(adults[1], selectedDeparture),
            childPlan(children[1], selectedDeparture, "standard"),
          ],
        },
      ],
    });

    addOption(drafts, {
      title:
        roomType === "double"
          ? "Double - 2 Children Without Extra Bed"
          : "Twin - 2 Children Without Extra Bed",
      plans: [
        {
          roomType,
          guests: [
            ...adults.map((adult) => adultPlan(adult, selectedDeparture)),
            ...children.map((child) =>
              childPlan(child, selectedDeparture, "without")
            ),
          ],
        },
      ],
      recommended: true,
    });

    children.forEach((extraBedChild) => {
      if ((extraBedChild.age ?? 0) < 6) {
        return;
      }

      addOption(drafts, {
        title:
          roomType === "double"
            ? `Double + Extra Bed - Child ${extraBedChild.index}`
            : `Twin + Extra Bed - Child ${extraBedChild.index}`,
        plans: [
          {
            roomType: roomType === "double" ? "triple_double" : "triple_twin",
            guests: [
              ...adults.map((adult) => adultPlan(adult, selectedDeparture)),
              childPlan(extraBedChild, selectedDeparture, "extra"),
              ...children
                .filter((child) => child.id !== extraBedChild.id)
                .map((child) => childPlan(child, selectedDeparture, "without")),
            ],
          },
        ],
      });
    });
  });

  return drafts;
}

function genericFamilyDrafts(
  adults: Guest[],
  children: Guest[],
  selectedDeparture: PricedDeparture
) {
  const drafts: GeneratedOptionDraft[] = [];
  const baseAdultDrafts = adultOnlyDrafts(adults, selectedDeparture).filter(
    (draft) => !draft.plans.some((plan) => plan.roomType === "single")
  );

  baseAdultDrafts.slice(0, 3).forEach((draft) => {
    const plans = draft.plans.map((plan) => ({
      ...plan,
      guests: [...plan.guests],
    }));
    let roomIndex = 0;

    children.forEach((child) => {
      const candidateRooms = plans.filter((plan) => plan.roomType !== "single");
      const targetRoom = candidateRooms[roomIndex % candidateRooms.length];
      roomIndex += 1;

      targetRoom.guests.push(childPlan(child, selectedDeparture, "without"));
    });

    addOption(drafts, {
      title: `${draft.title} - Children Without Extra Bed`,
      plans,
      recommended: draft.recommended,
    });
  });

  return drafts;
}

function familyDrafts(
  adults: Guest[],
  children: Guest[],
  selectedDeparture: PricedDeparture
) {
  if (adults.length === 2 && children.length === 1) {
    return twoAdultsOneChildDrafts(adults, children, selectedDeparture);
  }

  if (adults.length === 1 && children.length >= 1) {
    return oneAdultChildrenDrafts(adults, children, selectedDeparture);
  }

  if (adults.length === 2 && children.length === 2) {
    return twoAdultsTwoChildrenDrafts(adults, children, selectedDeparture);
  }

  return genericFamilyDrafts(adults, children, selectedDeparture);
}

function dedupeOptions(options: AccommodationOption[]) {
  const map = new Map<string, AccommodationOption>();

  options.forEach((option) => {
    const key = option.rooms
      .map((room) =>
        [
          room.roomType,
          ...room.allocations.map(
            (allocation) =>
              `${allocation.travellerId}:${allocation.rateType}:${allocation.amount}`
          ),
        ].join(",")
      )
      .join("|");

    if (!map.has(key)) {
      map.set(key, option);
    }
  });

  return Array.from(map.values());
}

export function generateOccupancyOptions({
  adults,
  children,
  selectedDeparture,
}: {
  adults: number;
  children: ChildInput[];
  selectedDeparture: PricedDeparture;
}): AccommodationOption[] {
  if (adults < 1) {
    throw new Error("At least one adult is required.");
  }

  if (adults + children.length > 25) {
    throw new Error("A maximum of 25 travellers can be booked at once.");
  }

  assertRate(selectedDeparture, "ADULT");

  const adultGuests = createAdults(adults);
  const childGuests = createChildren(children, selectedDeparture);
  const drafts =
    childGuests.length === 0
      ? adultOnlyDrafts(adultGuests, selectedDeparture)
      : familyDrafts(adultGuests, childGuests, selectedDeparture);
  const options = drafts
    .map((draft, index) => {
      try {
        return createOption(draft, selectedDeparture, index + 1);
      } catch {
        return null;
      }
    })
    .filter((option): option is AccommodationOption => Boolean(option))
    .filter((option) =>
      validateOption(option, adultGuests.length, childGuests.length)
    );

  return dedupeOptions(options);
}
