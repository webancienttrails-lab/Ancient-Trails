import assert from "node:assert/strict";
import test from "node:test";

import { generateOccupancyOptions } from "./accommodation/accommodation.generator";
import type { AccommodationOption } from "./accommodation/accommodation.types";
import { calculateBalance, calculateDeposit } from "./booking/booking.deposit";
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
  childPricingRules: [],
};

function options(
  adults: number,
  childAges: number[] = [],
  selectedDeparture: PricedDeparture = departure
) {
  return generateOccupancyOptions({
    adults,
    children: childAges.map((age, index) => ({
      id: `child-${index + 1}`,
      age,
    })),
    selectedDeparture,
  });
}

function optionByTitle(
  generatedOptions: AccommodationOption[],
  title: string
) {
  return generatedOptions.find((option) => option.title === title);
}

function roomTypes(option: AccommodationOption) {
  return option.rooms.map((room) => room.roomType);
}

function assertOptionIntegrity(
  option: AccommodationOption,
  adultCount: number,
  childCount: number
) {
  const allocations = option.rooms.flatMap((room) => room.allocations);
  const allocatedAdults = allocations.filter(
    (allocation) => allocation.travellerType === "adult"
  );
  const allocatedChildren = allocations.filter(
    (allocation) => allocation.travellerType === "child"
  );
  const allocationIds = allocations.map((allocation) => allocation.travellerId);
  const total = option.breakdown.reduce((sum, item) => sum + item.amount, 0);

  assert.equal(allocatedAdults.length, adultCount);
  assert.equal(allocatedChildren.length, childCount);
  assert.equal(new Set(allocationIds).size, allocationIds.length);
  assert.equal(option.breakdown.length, allocations.length);
  assert.equal(option.total, total);

  allocations.forEach((allocation) => {
    assert.ok(allocation.rateType);
    assert.equal(allocation.amount, allocation.price);

    if (allocation.rateType === "EXTRA_BED") {
      assert.equal(allocation.bedType, "extra_bed");
    }

    if (allocation.rateType === "FREE_CHILD") {
      assert.equal(allocation.amount, 0);
    }
  });

  option.rooms.forEach((room) => {
    const bedOccupants = room.allocations.filter(
      (allocation) => allocation.bedType !== "without_extra_bed"
    ).length;
    const extraBeds = room.allocations.filter(
      (allocation) => allocation.bedType === "extra_bed"
    ).length;
    const sharingChildren = room.allocations.filter(
      (allocation) => allocation.bedType === "without_extra_bed"
    ).length;

    if (room.roomType === "single") {
      assert.equal(room.allocations.length, 1);
      assert.equal(bedOccupants, 1);
    } else if (room.roomType === "double" || room.roomType === "twin") {
      assert.ok(bedOccupants <= 2);
      assert.equal(extraBeds, 0);
      assert.ok(sharingChildren <= 2);
    } else {
      assert.ok(bedOccupants <= 3);
      assert.equal(extraBeds, 1);
      assert.ok(sharingChildren <= 1);
    }
  });
}

function assertAllOptionsValid(
  generatedOptions: AccommodationOption[],
  adultCount: number,
  childCount: number
) {
  assert.ok(generatedOptions.length > 0);
  generatedOptions.forEach((option) =>
    assertOptionIntegrity(option, adultCount, childCount)
  );
}

test("adult occupancy options use only final departure rates", () => {
  const oneAdult = options(1);
  const oneAdultTitles = oneAdult.map((option) => option.title);

  assert.deepEqual(oneAdultTitles, ["Single Occupancy", "Twin Sharing"]);
  assert.equal(
    optionByTitle(oneAdult, "Single Occupancy")?.total,
    departure.singleOccupancy
  );
  assert.equal(optionByTitle(oneAdult, "Twin Sharing")?.total, departure.priceAdult);
  assert.equal(
    oneAdult.some((option) => option.preferredSharingType === "triple"),
    false
  );
  assertAllOptionsValid(oneAdult, 1, 0);

  const twoAdults = options(2);
  assert.equal(
    optionByTitle(twoAdults, "Double Occupancy")?.total,
    departure.priceAdult * 2
  );
  assert.equal(
    optionByTitle(twoAdults, "Twin Occupancy")?.total,
    departure.priceAdult * 2
  );
  assert.equal(
    optionByTitle(twoAdults, "Separate Single Occupancy")?.total,
    departure.singleOccupancy * 2
  );
  assertAllOptionsValid(twoAdults, 2, 0);

  const threeAdults = options(3);
  assert.equal(
    optionByTitle(threeAdults, "Double + Extra Bed")?.total,
    departure.priceAdult * 2 + departure.priceExtraBed
  );
  assert.equal(
    optionByTitle(threeAdults, "Twin + Extra Bed")?.total,
    departure.priceAdult * 2 + departure.priceExtraBed
  );
  assert.equal(
    optionByTitle(threeAdults, "Double + Single")?.total,
    departure.priceAdult * 2 + departure.singleOccupancy
  );
  assert.equal(
    optionByTitle(threeAdults, "Twin + Single")?.total,
    departure.priceAdult * 2 + departure.singleOccupancy
  );
  assert.equal(
    optionByTitle(threeAdults, "All Single")?.total,
    departure.singleOccupancy * 3
  );
  assertAllOptionsValid(threeAdults, 3, 0);

  const fourAdults = options(4);
  assert.equal(
    optionByTitle(fourAdults, "Two Double Rooms")?.total,
    departure.priceAdult * 4
  );
  assert.equal(
    optionByTitle(fourAdults, "Two Twin Rooms")?.total,
    departure.priceAdult * 4
  );
  assert.equal(
    optionByTitle(fourAdults, "Double + Twin")?.total,
    departure.priceAdult * 4
  );
  assert.equal(
    optionByTitle(fourAdults, "All Single")?.total,
    departure.singleOccupancy * 4
  );
  assertAllOptionsValid(fourAdults, 4, 0);
});

test("larger adult groups are generated dynamically", () => {
  const fiveAdults = options(5);
  const sharedRooms = optionByTitle(fiveAdults, "Shared Rooms");

  assert.ok(sharedRooms);
  assert.deepEqual(roomTypes(sharedRooms), ["double", "triple_double"]);
  assert.equal(
    sharedRooms.total,
    departure.priceAdult * 4 + departure.priceExtraBed
  );
  assert.ok(optionByTitle(fiveAdults, "All Single"));
  assertAllOptionsValid(fiveAdults, 5, 0);

  [6, 7, 8, 10, 25].forEach((adultCount) => {
    assertAllOptionsValid(options(adultCount), adultCount, 0);
  });
});

test("two adults and one child show extra-bed and without-bed options together", () => {
  const eligibleChildOptions = options(2, [8]);
  const childWithoutBed = optionByTitle(
    eligibleChildOptions,
    "Double - Child Without Extra Bed"
  );
  const childWithExtraBed = optionByTitle(
    eligibleChildOptions,
    "Double + Extra Bed"
  );

  assert.ok(childWithoutBed);
  assert.ok(childWithExtraBed);
  assert.equal(
    childWithoutBed.total,
    departure.priceAdult * 2 + departure.priceChildWithoutExtraBed
  );
  assert.equal(
    childWithExtraBed.total,
    departure.priceAdult * 2 + departure.priceExtraBed
  );
  assert.ok(optionByTitle(eligibleChildOptions, "Twin - Child Without Extra Bed"));
  assert.ok(optionByTitle(eligibleChildOptions, "Twin + Extra Bed"));
  assertAllOptionsValid(eligibleChildOptions, 2, 1);

  const complimentaryChildOptions = options(2, [4]);
  const complimentaryOption = optionByTitle(
    complimentaryChildOptions,
    "Double - Child Without Extra Bed"
  );

  assert.ok(complimentaryOption);
  assert.equal(complimentaryOption.total, departure.priceAdult * 2);
  assert.equal(
    complimentaryOption.breakdown.some(
      (item) => item.rateType === "FREE_CHILD" && item.amount === 0
    ),
    true
  );
  assert.equal(
    optionByTitle(complimentaryChildOptions, "Double + Extra Bed"),
    undefined
  );
  assert.equal(
    optionByTitle(complimentaryChildOptions, "Twin + Extra Bed"),
    undefined
  );
  assertAllOptionsValid(complimentaryChildOptions, 2, 1);
});

test("one adult with two children prices each child independently", () => {
  const generatedOptions = options(1, [8, 4]);
  const withoutBed = optionByTitle(
    generatedOptions,
    "Double - Children Without Extra Bed"
  );
  const withExtraBed = optionByTitle(
    generatedOptions,
    "Double + Extra Bed - Child 1"
  );

  assert.ok(withoutBed);
  assert.ok(withExtraBed);
  assert.equal(
    withoutBed.total,
    departure.priceAdult + departure.priceChildWithoutExtraBed
  );
  assert.equal(
    withExtraBed.total,
    departure.priceAdult + departure.priceExtraBed
  );
  assert.equal(
    withExtraBed.breakdown.some((item) => item.rateType === "FREE_CHILD"),
    true
  );
  assertAllOptionsValid(generatedOptions, 1, 2);
});

test("two adults and two children allocate and price all four guests", () => {
  const generatedOptions = options(2, [8, 4]);
  const twoRooms = optionByTitle(generatedOptions, "Two Double Rooms");
  const withoutExtraBeds = optionByTitle(
    generatedOptions,
    "Double - 2 Children Without Extra Bed"
  );
  const tripleArrangement = optionByTitle(
    generatedOptions,
    "Double + Extra Bed - Child 1"
  );

  assert.ok(twoRooms);
  assert.equal(twoRooms.total, departure.priceAdult * 3);
  assert.ok(withoutExtraBeds);
  assert.equal(
    withoutExtraBeds.total,
    departure.priceAdult * 2 + departure.priceChildWithoutExtraBed
  );
  assert.ok(tripleArrangement);
  assert.equal(
    tripleArrangement.total,
    departure.priceAdult * 2 + departure.priceExtraBed
  );

  [twoRooms, withoutExtraBeds, tripleArrangement].forEach((option) => {
    assert.equal(
      option.rooms.flatMap((room) => room.allocations).length,
      4
    );
    assert.equal(
      option.breakdown.some((item) => item.rateType === "FREE_CHILD"),
      true
    );
  });
  assertAllOptionsValid(generatedOptions, 2, 2);
});

test("missing final rates hide dependent options instead of falling back", () => {
  const noExtraBed = options(2, [8], {
    ...departure,
    priceExtraBed: 0,
  });

  assert.ok(optionByTitle(noExtraBed, "Double - Child Without Extra Bed"));
  assert.equal(optionByTitle(noExtraBed, "Double + Extra Bed"), undefined);

  const noChildWithoutBed = options(2, [8], {
    ...departure,
    priceChildWithoutExtraBed: 0,
  });

  assert.equal(
    optionByTitle(noChildWithoutBed, "Double - Child Without Extra Bed"),
    undefined
  );
  assert.ok(optionByTitle(noChildWithoutBed, "Double + Extra Bed"));

  const complimentaryWithoutChildRate = options(2, [4], {
    ...departure,
    priceChildWithoutExtraBed: 0,
  });

  assert.equal(
    optionByTitle(complimentaryWithoutChildRate, "Double - Child Without Extra Bed")
      ?.total,
    departure.priceAdult * 2
  );

  const noSingleOccupancy = options(1, [], {
    ...departure,
    singleOccupancy: 0,
  });

  assert.equal(optionByTitle(noSingleOccupancy, "Single Occupancy"), undefined);
  assert.ok(optionByTitle(noSingleOccupancy, "Twin Sharing"));
});

test("child age is required and can be resolved from departure date", () => {
  const generatedOptions = generateOccupancyOptions({
    adults: 2,
    children: [{ id: "child-1", dateOfBirth: "2021-12-14" }],
    selectedDeparture: departure,
  });
  const option = optionByTitle(
    generatedOptions,
    "Double - Child Without Extra Bed"
  );

  assert.ok(option);
  assert.equal(option.total, departure.priceAdult * 2);
  assert.equal(
    option.rooms
      .flatMap((room) => room.allocations)
      .find((allocation) => allocation.travellerId === "child-1")
      ?.ageOnDeparture,
    4
  );

  assert.throws(() =>
    generateOccupancyOptions({
      adults: 2,
      children: [{ id: "child-1" }],
      selectedDeparture: departure,
    })
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

test("deposit, balance, and due date calculations are preserved", () => {
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

test("pricing snapshots use the selected occupancy option total", () => {
  const option = optionByTitle(options(3), "Double + Extra Bed");

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
  assert.equal(snapshot.accommodation.total, option.total);
  assert.equal(snapshot.accommodation.totalPrice, option.total);
  assert.equal(snapshot.subtotal, option.total);
  assert.equal(snapshot.gstAmount, 5148);
  assert.equal(snapshot.grandTotal, 108098);
  assert.equal(snapshot.depositAmount, 60000);
  assert.equal(snapshot.balanceAmount, 48098);
});
