import assert from "node:assert/strict";
import test from "node:test";

import {
  deduplicateAccommodationOptions,
  generateAccommodationOptions,
  generateRoomCombinations,
} from "./accommodation/accommodation.generator";
import type {
  AccommodationOption,
  Traveller,
} from "./accommodation/accommodation.types";
import { calculateDeposit, calculateBalance } from "./booking/booking.deposit";
import { createPricingSnapshot } from "./booking/booking.snapshot";
import type { PricedDeparture } from "./departure/departure.types";
import {
  calculateBalanceDueDate,
  validateDepartureForBooking,
} from "./departure/departure.validation";

const departure: PricedDeparture = {
  departureId: "DEP001",
  tourId: "TOUR001",
  destinationId: "DOM001",
  departureDate: "2026-12-13T00:00:00.000Z",
  returnDate: "2026-12-18T00:00:00.000Z",
  seatsAvailable: 25,
  priceAdult: 35500,
  priceExtraBed: 31950,
  priceChildWithoutExtraBed: 28400,
  singleOccupancy: 44375,
  depositType: "fixed",
  depositValue: 20000,
  depositAppliesTo: "per_person",
  balanceDueDaysBefore: 15,
  earlyBirdOffer: null,
  bookingDeadline: "2026-11-30T00:00:00.000Z",
  status: "scheduled",
  childPricingRules: [
    {
      minAge: 0,
      maxAge: 11,
      allowExtraBed: true,
      allowWithoutExtraBed: true,
    },
  ],
  roomPolicy: {
    allowChildBedSharing: true,
    maxChildrenWithoutExtraBedPerRoom: 1,
    allowExtraBed: true,
    allowChildSingleRoom: false,
  },
};

function adultTravellers(count: number): Traveller[] {
  return Array.from({ length: count }, (_item, index) => ({
    id: `A${index + 1}`,
    type: "adult",
  }));
}

function childTravellers(count: number, birthYear = 2018): Traveller[] {
  return Array.from({ length: count }, (_item, index) => ({
    id: `C${index + 1}`,
    type: "child",
    dateOfBirth: `${birthYear}-01-01`,
  }));
}

function travellers(adults: number, children = 0): Traveller[] {
  return [...adultTravellers(adults), ...childTravellers(children)];
}

function canonicalKey(option: AccommodationOption) {
  return option.rooms
    .map((room) => room.roomType)
    .sort()
    .join("|");
}

function findByRoomTypes(
  options: AccommodationOption[],
  roomTypes: string[],
  idPrefix = "option"
) {
  const key = [...roomTypes].sort().join("|");

  return options.find(
    (option) => option.id.startsWith(idPrefix) && canonicalKey(option) === key
  );
}

function hasRoomCounts(
  options: AccommodationOption[],
  counts: {
    singles?: number;
    standards?: number;
    triples?: number;
  }
) {
  return options.some((option) => {
    const singles = option.rooms.filter((room) => room.roomType === "single").length;
    const standards = option.rooms.filter(
      (room) => room.roomType === "double" || room.roomType === "twin"
    ).length;
    const triples = option.rooms.filter((room) =>
      room.roomType.startsWith("triple")
    ).length;

    return (
      singles === (counts.singles || 0) &&
      standards === (counts.standards || 0) &&
      triples === (counts.triples || 0)
    );
  });
}

function assertEveryTravellerAssignedExactlyOnce(
  option: AccommodationOption,
  sourceTravellers: Traveller[]
) {
  const expectedIds = sourceTravellers.map((traveller) => traveller.id).sort();
  const allocatedIds = option.rooms
    .flatMap((room) => room.allocations.map((allocation) => allocation.travellerId))
    .sort();

  assert.deepEqual(allocatedIds, expectedIds);
  assert.equal(new Set(allocatedIds).size, expectedIds.length);
}

function assertNoRoomExceedsCapacity(option: AccommodationOption) {
  option.rooms.forEach((room) => {
    const childWithoutBedCount = room.allocations.filter(
      (allocation) => allocation.bedType === "without_extra_bed"
    ).length;
    const bedOccupantCount = room.allocations.length - childWithoutBedCount;
    const maxPeopleInRoom =
      room.roomType === "single"
        ? 1
        : room.capacity +
          (departure.roomPolicy?.maxChildrenWithoutExtraBedPerRoom || 1);

    assert.ok(bedOccupantCount <= room.capacity);
    assert.ok(room.allocations.length <= maxPeopleInRoom);
  });
}

function assertOptionIntegrity(
  option: AccommodationOption,
  sourceTravellers: Traveller[]
) {
  assertEveryTravellerAssignedExactlyOnce(option, sourceTravellers);
  assertNoRoomExceedsCapacity(option);
  assert.equal(
    option.totalPrice,
    option.rooms
      .flatMap((room) => room.allocations)
      .reduce((sum, allocation) => sum + allocation.price, 0)
  );
}

test("adult accommodation options are generated and priced from explicit departure prices", () => {
  const cases = [
    { count: 1, expectedTotal: 44375, roomTypes: ["single"] },
    { count: 2, expectedTotal: 71000, roomTypes: ["double"] },
    { count: 3, expectedTotal: 102950, roomTypes: ["triple_double"] },
    { count: 4, expectedTotal: 142000, roomTypes: ["double", "double"] },
  ];

  cases.forEach(({ count, expectedTotal, roomTypes }) => {
    const sourceTravellers = adultTravellers(count);
    const options = generateAccommodationOptions({
      travellers: sourceTravellers,
      departure,
    });
    const option = findByRoomTypes(options, roomTypes);

    assert.ok(option, `${count} adult option missing`);
    assert.equal(option.totalPrice, expectedTotal);
    assertOptionIntegrity(option, sourceTravellers);
  });

  const threeAdultOptions = generateAccommodationOptions({
    travellers: adultTravellers(3),
    departure,
  });
  assert.equal(
    findByRoomTypes(threeAdultOptions, ["double", "single"])?.totalPrice,
    115375
  );
  assert.equal(
    findByRoomTypes(threeAdultOptions, ["single", "single", "single"])
      ?.totalPrice,
    133125
  );
});

test("larger groups return practical, deduplicated options with all single retained", () => {
  [5, 6, 7, 8, 10, 15, 24, 25].forEach((count) => {
    const sourceTravellers = adultTravellers(count);
    const options = generateAccommodationOptions({
      travellers: sourceTravellers,
      departure,
    });
    const keys = options.map(canonicalKey);

    assert.ok(options.length <= 6);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(
      options.some((option) =>
        option.rooms.every((room) => room.roomType === "single")
      )
    );
    options.forEach((option) => assertOptionIntegrity(option, sourceTravellers));
  });

  const twentyFiveOptions = generateAccommodationOptions({
    travellers: adultTravellers(25),
    departure,
  });

  assert.ok(hasRoomCounts(twentyFiveOptions, { standards: 12, singles: 1 }));
  assert.ok(hasRoomCounts(twentyFiveOptions, { standards: 11, triples: 1 }));
  assert.ok(hasRoomCounts(twentyFiveOptions, { triples: 8, singles: 1 }));
});

test("solo sharing options do not create a fake second traveller", () => {
  const sourceTravellers = adultTravellers(1);
  const options = generateAccommodationOptions({
    travellers: sourceTravellers,
    departure,
  });
  const twinSharing = options.find(
    (option) => option.preferredSharingType === "twin"
  );
  const tripleSharing = options.find(
    (option) => option.preferredSharingType === "triple"
  );

  assert.ok(twinSharing);
  assert.ok(tripleSharing);
  assert.equal(twinSharing.requiresRoommateMatching, true);
  assert.equal(tripleSharing.requiresRoommateMatching, true);
  assert.equal(twinSharing.totalTravellers, 1);
  assert.equal(twinSharing.rooms[0].travellerIds.length, 1);
  assert.equal(twinSharing.rooms[0].allocations.length, 1);
  assert.equal(twinSharing.totalPrice, departure.priceAdult);
});

test("child allocations honor age rules and bed allocation", () => {
  const twoAdultsOneChild = travellers(2, 1);
  const options = generateAccommodationOptions({
    travellers: twoAdultsOneChild,
    departure,
  });
  const childWithoutBed = findByRoomTypes(
    options,
    ["double"],
    "child-without-bed"
  );
  const childWithExtraBed = findByRoomTypes(options, ["triple_double"]);

  assert.ok(childWithoutBed);
  assert.ok(childWithExtraBed);
  assert.equal(childWithoutBed.totalPrice, 99400);
  assert.equal(childWithExtraBed.totalPrice, 102950);
  assertOptionIntegrity(childWithoutBed, twoAdultsOneChild);
  assertOptionIntegrity(childWithExtraBed, twoAdultsOneChild);
  assert.equal(childWithoutBed.pricingBreakdown.childWithoutExtraBedCount, 1);
  assert.equal(childWithExtraBed.pricingBreakdown.extraBedCount, 1);

  const oneAdultTwoChildren = travellers(1, 2);
  const oneAdultOptions = generateAccommodationOptions({
    travellers: oneAdultTwoChildren,
    departure,
  });
  const oneAdultMixedBedOption = findByRoomTypes(
    oneAdultOptions,
    ["triple_double"]
  );

  assert.ok(oneAdultMixedBedOption);
  assert.equal(
    oneAdultMixedBedOption.totalPrice,
    departure.priceAdult +
      departure.priceChildWithoutExtraBed +
      departure.priceExtraBed
  );

  const twoAdultsTwoChildren = travellers(2, 2);
  const twoChildOptions = generateAccommodationOptions({
    travellers: twoAdultsTwoChildren,
    departure,
  });
  assert.equal(
    findByRoomTypes(twoChildOptions, ["double", "double"], "child-without-bed")
      ?.totalPrice,
    127800
  );

  const twoAdultsTwoChildrenShared = generateAccommodationOptions({
    travellers: twoAdultsTwoChildren,
    departure,
    roomPolicy: {
      allowChildBedSharing: true,
      maxChildrenWithoutExtraBedPerRoom: 2,
      allowExtraBed: true,
      allowChildSingleRoom: false,
    },
  });

  assert.equal(
    findByRoomTypes(twoAdultsTwoChildrenShared, ["double"], "child-without-bed")
      ?.totalPrice,
    departure.priceAdult * 2 + departure.priceChildWithoutExtraBed * 2
  );
});

test("two adults and one child only get child-aware primary options by default", () => {
  const sourceTravellers = travellers(2, 1);
  const options = generateAccommodationOptions({
    travellers: sourceTravellers,
    departure,
    maxVisibleOptions: 20,
  });
  const titles = options.map((option) => option.title).sort();

  assert.deepEqual(titles, [
    "Double Room + Extra Bed",
    "Double Room - Child Without Extra Bed",
    "Twin Room + Extra Bed",
    "Twin Room - Child Without Extra Bed",
  ].sort());
  assert.equal(findByRoomTypes(options, ["double", "single"]), undefined);
  assert.equal(findByRoomTypes(options, ["twin", "single"]), undefined);
  assert.equal(
    findByRoomTypes(options, ["single", "single", "single"]),
    undefined
  );

  const childSingleOptions = generateAccommodationOptions({
    travellers: sourceTravellers,
    departure,
    maxVisibleOptions: 20,
    roomPolicy: {
      ...departure.roomPolicy!,
      allowChildSingleRoom: true,
    },
  });

  assert.ok(
    findByRoomTypes(childSingleOptions, ["double", "single"], "child-single-room")
  );
  childSingleOptions.forEach((option) =>
    assertOptionIntegrity(option, sourceTravellers)
  );
});

test("two adults and two children never use triple capacity without explicit bed sharing", () => {
  const sourceTravellers = travellers(2, 2);
  const options = generateAccommodationOptions({
    travellers: sourceTravellers,
    departure,
    maxVisibleOptions: 20,
  });

  assert.ok(options.length > 0);
  options.forEach((option) => {
    assertOptionIntegrity(option, sourceTravellers);
    option.rooms.forEach((room) => {
      if (!room.roomType.startsWith("triple")) {
        return;
      }

      const childrenWithoutExtraBed = room.allocations.filter(
        (allocation) => allocation.bedType === "without_extra_bed"
      );

      assert.ok(room.allocations.length <= room.capacity || childrenWithoutExtraBed.length > 0);
    });
  });
});

test("child pricing uses age on departure date and configured bed rules", () => {
  const twoAdultsOneEligibleChild = [
    ...adultTravellers(2),
    {
      id: "C1",
      type: "child" as const,
      dateOfBirth: "2015-12-14",
    },
  ];
  const eligibleChildOptions = generateAccommodationOptions({
    travellers: twoAdultsOneEligibleChild,
    departure,
  });
  const childWithoutBed = findByRoomTypes(
    eligibleChildOptions,
    ["double"],
    "child-without-bed"
  );
  const childWithExtraBed = findByRoomTypes(
    eligibleChildOptions,
    ["triple_double"]
  );

  assert.ok(childWithoutBed);
  assert.ok(childWithExtraBed);
  assert.equal(
    childWithoutBed.totalPrice,
    departure.priceAdult * 2 + departure.priceChildWithoutExtraBed
  );
  assert.equal(
    childWithExtraBed.totalPrice,
    departure.priceAdult * 2 + departure.priceExtraBed
  );

  const birthdayAfterDeparture = childWithoutBed.rooms
    .flatMap((room) => room.allocations)
    .find((allocation) => allocation.travellerId === "C1");

  assert.equal(
    birthdayAfterDeparture?.pricingCategory,
    "child_without_extra_bed"
  );
  assert.equal(birthdayAfterDeparture?.bedType, "without_extra_bed");
  assert.equal(birthdayAfterDeparture?.ageOnDeparture, 10);

  const oneAdultOneNonEligibleChild = [
    ...adultTravellers(1),
    {
      id: "C1",
      type: "child" as const,
      dateOfBirth: "2014-12-13",
    },
  ];
  const adultPricedChildOptions = generateAccommodationOptions({
    travellers: oneAdultOneNonEligibleChild,
    departure,
  });

  assert.equal(
    findByRoomTypes(adultPricedChildOptions, ["double"])?.totalPrice,
    departure.priceAdult * 2
  );
});

test("children default to adult pricing when no child age rule matches", () => {
  const oneAdultOneChild = [
    ...adultTravellers(1),
    ...childTravellers(1, 2018),
  ];
  const options = generateAccommodationOptions({
    travellers: oneAdultOneChild,
    departure: {
      ...departure,
      childPricingRules: [],
    },
  });

  assert.equal(
    findByRoomTypes(options, ["double"])?.totalPrice,
    departure.priceAdult * 2
  );
});

test("invalid traveller counts are rejected", () => {
  assert.throws(() =>
    generateAccommodationOptions({
      travellers: [],
      departure,
    })
  );
  assert.throws(() =>
    generateAccommodationOptions({
      travellers: adultTravellers(26),
      departure,
    })
  );
});

test("room combinations are canonical and duplicate-free", () => {
  const combinations = generateRoomCombinations(7);
  const keys = combinations.map((roomTypes) =>
    roomTypes.map((roomType) => roomType).sort().join("|")
  );
  const options = generateAccommodationOptions({
    travellers: adultTravellers(7),
    departure,
    maxVisibleOptions: 20,
  });

  assert.equal(new Set(keys).size, keys.length);
  assert.equal(
    deduplicateAccommodationOptions([options[0], options[0]]).length,
    1
  );
});

test("departure validation catches booking blockers", () => {
  assert.deepEqual(
    validateDepartureForBooking(
      {
        ...departure,
        seatsAvailable: 1,
      },
      2
    ).errors,
    ["Requested travellers exceed available seats."]
  );
  assert.ok(
    validateDepartureForBooking(
      {
        ...departure,
        bookingDeadline: "2026-01-01T00:00:00.000Z",
      },
      1,
      new Date("2026-01-02T00:00:00.000Z")
    ).errors.includes("Bookings are closed for this departure.")
  );
  assert.ok(
    validateDepartureForBooking(
      {
        ...departure,
        departureDate: null,
        returnDate: null,
        status: "coming_soon",
      },
      1
    ).errors.includes("This departure is coming soon and cannot be booked yet.")
  );
  assert.ok(
    validateDepartureForBooking(
      {
        ...departure,
        returnDate: "2026-12-12T00:00:00.000Z",
      },
      1
    ).errors.includes("Return date must be after departure date.")
  );
});

test("deposit, balance, and due date calculations are configurable and capped", () => {
  assert.equal(
    calculateDeposit({
      depositAppliesTo: "per_person",
      depositType: "fixed",
      depositValue: 20000,
      grandTotal: 100000,
      totalTravellers: 3,
    }),
    60000
  );
  assert.equal(
    calculateDeposit({
      depositAppliesTo: "per_booking",
      depositType: "fixed",
      depositValue: 20000,
      grandTotal: 100000,
      totalTravellers: 3,
    }),
    20000
  );
  assert.equal(
    calculateDeposit({
      depositAppliesTo: "per_booking",
      depositType: "percentage",
      depositValue: 25,
      grandTotal: 100000,
      totalTravellers: 3,
    }),
    25000
  );
  assert.equal(
    calculateDeposit({
      depositAppliesTo: "per_person",
      depositType: "fixed",
      depositValue: 20000,
      grandTotal: 30000,
      totalTravellers: 3,
    }),
    30000
  );
  assert.equal(calculateBalance(100000, 25000), 75000);
  assert.equal(
    calculateBalanceDueDate(
      departure.departureDate,
      departure.balanceDueDaysBefore
    )?.toISOString(),
    "2026-11-28T00:00:00.000Z"
  );
});

test("pricing snapshots remain immutable when departure prices change later", () => {
  const sourceTravellers = adultTravellers(3);
  const option = findByRoomTypes(
    generateAccommodationOptions({
      travellers: sourceTravellers,
      departure,
    }),
    ["triple_double"]
  );

  assert.ok(option);

  const snapshot = createPricingSnapshot({
    accommodationOption: option,
    departure,
    gstPercentage: 5,
  });
  const editedDeparture = {
    ...departure,
    priceAdult: 1,
    priceExtraBed: 1,
    singleOccupancy: 1,
  };

  assert.equal(editedDeparture.priceAdult, 1);
  assert.equal(snapshot.priceAdult, 35500);
  assert.equal(snapshot.accommodation.totalPrice, 102950);
  assert.equal(snapshot.gstAmount, 5148);
  assert.equal(snapshot.grandTotal, 108098);
  assert.equal(snapshot.depositAmount, 60000);
  assert.equal(snapshot.balanceAmount, 48098);
});
