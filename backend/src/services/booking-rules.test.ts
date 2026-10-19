import { resolveBookingEmergencyContact } from "./booking/booking.emergency-contact";
import { Booking } from "../models/booking.model";
import { isAirfareExcluded, calculateAirfareTotals, airfarePaymentPortion, creditAirfarePayment } from "./booking/booking.airfare";
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

test("airfare: advance booking adds tax-inclusive fare without changing package taxes", () => {
  assert.deepEqual(calculateAirfareTotals(52500, 0, 15000, 20000), { grandTotal: 67500, balanceAmount: 47500 });
});
test("airfare: fully paid package becomes payable for airfare only", () => {
  assert.deepEqual(calculateAirfareTotals(52500, 0, 15000, 52500), { grandTotal: 67500, balanceAmount: 15000 });
});
test("airfare: repeated save replaces rather than adds, and updates preserve paid money", () => {
  assert.deepEqual(calculateAirfareTotals(67500, 15000, 15000, 20000), { grandTotal: 67500, balanceAmount: 47500 });
  assert.deepEqual(calculateAirfareTotals(67500, 15000, 18000, 60000), { grandTotal: 70500, balanceAmount: 10500 });
});
test("airfare: reject invalid money, overflow, and reduction below paid amount", () => {
  for (const fare of [-1, 1.5, NaN, Infinity, 1000000001]) assert.throws(() => calculateAirfareTotals(52500, 0, fare, 20000));
  assert.throws(() => calculateAirfareTotals(67500, 15000, 5000, 65000));
  assert.throws(() => calculateAirfareTotals(999999999, 0, 2, 0));
});
test("airfare: zero confirmed fare and valid downward corrections", () => {
  assert.deepEqual(calculateAirfareTotals(67500, 15000, 10000, 20000), { grandTotal: 62500, balanceAmount: 42500 });
  assert.deepEqual(calculateAirfareTotals(52500, 0, 0, 52500), { grandTotal: 52500, balanceAmount: 0 });
});
test("airfare: only explicit flight exclusions qualify, included packages take precedence", () => {
  assert.equal(isAirfareExcluded(null), false);
  assert.equal(isAirfareExcluded({ inclusions: ["Hotel"], exclusions: [] }), false);
  assert.equal(isAirfareExcluded({ exclusions: ["Airfare at actual cost"] }), true);
  assert.equal(isAirfareExcluded({ inclusions: ["Flights not included"] }), true);
  assert.equal(isAirfareExcluded({ inclusions: ["Return flights included"], exclusions: ["Any airfare increases"] }), false);
});
test("airfare: payment history separates package and airfare collections", () => {
  assert.equal(airfarePaymentPortion(67500, 15000, 20000, 47500), 15000);
  assert.equal(airfarePaymentPortion(67500, 15000, 52500, 5000), 5000);
  assert.equal(airfarePaymentPortion(67500, 15000, 20000, 10000), 0);
  assert.equal(airfarePaymentPortion(67500, 15000, 67500, 10000), 0);
});

test("airfare: repeated payment verification credits the same receipt once", () => {
  const state = { grandTotal: 67500, airfare: 15000, amountPaid: 52500, history: [] };
  const payment = { paymentId: "pay_airfare_1", amount: 15000, paidAt: new Date("2026-10-15T00:00:00Z") };
  const first = creditAirfarePayment(state, payment);
  assert.equal(first.amountPaid, 67500);
  assert.equal(first.balanceAmount, 0);
  assert.equal(first.history[0]?.airfareAmount, 15000);
  const replay = creditAirfarePayment({ ...state, amountPaid: first.amountPaid, history: first.history }, payment);
  assert.equal(replay.credited, false);
  assert.equal(replay.amountPaid, 67500);
  assert.equal(replay.history.length, 1);
  assert.equal(state.history.length, 0);
});
test("airfare: advance and additional installments keep exact outstanding balances", () => {
  const state = { grandTotal: 67500, airfare: 15000, amountPaid: 20000, history: [] };
  const first = creditAirfarePayment(state, { paymentId: "pay_balance_1", amount: 32500, paidAt: new Date() });
  assert.equal(first.balanceAmount, 15000);
  assert.equal(first.history[0]?.airfareAmount, 0);
  const last = creditAirfarePayment({ ...state, amountPaid: first.amountPaid, history: first.history },
    { paymentId: "pay_airfare_2", amount: 15000, paidAt: new Date() });
  assert.equal(last.amountPaid, 67500);
  assert.equal(last.balanceAmount, 0);
  assert.equal(last.history[1]?.airfareAmount, 15000);
});

test("booking emergency contact is stored on the booking document", () => {
  const contact = resolveBookingEmergencyContact({
    emergencyContactName: " Emergency Person ",
    emergencyContactMobileNumber: " 9876543210 ",
  });
  const booking = new Booking({ ...contact, tourId: "TOUR001" });
  const stored = booking.toObject();
  assert.equal(stored.emergencyContactName, "Emergency Person");
  assert.equal(stored.emergencyContactMobileNumber, "9876543210");
});

test("older booking payloads derive the booking contact from the lead guest or traveller", () => {
  const contact = { emergencyContactName: "Emergency Person", emergencyContactMobileNumber: "9876543210" };
  assert.deepEqual(resolveBookingEmergencyContact({ guestDetails: [contact] }), contact);
  assert.deepEqual(resolveBookingEmergencyContact({ travellers: [{ id: "adult-1", type: "adult", ...contact }] }), contact);
});

test("unrelated admin edits preserve the booking emergency contact", () => {
  const contact = { emergencyContactName: "Emergency Person", emergencyContactMobileNumber: "9876543210" };
  assert.deepEqual(resolveBookingEmergencyContact({ guestDetails: [{}], travellers: [] }, contact), contact);
  assert.deepEqual(resolveBookingEmergencyContact({}, { guestDetails: [contact] }), contact);
  const updated = { emergencyContactName: "New Contact", emergencyContactMobileNumber: "9123456780" };
  assert.deepEqual(resolveBookingEmergencyContact(updated, contact), updated);
});

test("emergency contacts remain specific to their booking", () => {
  const first = resolveBookingEmergencyContact({ emergencyContactName: "First Contact", emergencyContactMobileNumber: "9876543210" });
  const second = resolveBookingEmergencyContact({ emergencyContactName: "Second Contact", emergencyContactMobileNumber: "9123456780" });
  assert.notDeepEqual(first, second);
  assert.deepEqual(resolveBookingEmergencyContact({}), { emergencyContactName: "", emergencyContactMobileNumber: "" });
});

test("only the lead traveller email is required on a booking", async () => {
  const guest = {
    title: "Mr", firstName: "Test", lastName: "Traveller",
    countryCode: "+91", mobileNumber: "9876543210",
    dateOfBirth: new Date("1990-01-01"), gender: "male", address: "Pune",
  };
  const booking = new Booking({
    tourId: "TOUR001", totalGuest: 2, adultCount: 2, childCount: 0,
    guestDetails: [{ ...guest, email: "lead@example.com" }, guest],
  });
  await booking.validate();
  assert.equal(booking.guestDetails[1]?.email, "");
  booking.guestDetails[0]!.email = "";
  await assert.rejects(booking.validate(), /Lead traveller email is required/);
});

test("other traveller emails are retained when supplied", async () => {
  const guest = {
    title: "Ms", firstName: "Test", lastName: "Traveller",
    countryCode: "+91", mobileNumber: "9876543210",
    dateOfBirth: new Date("1990-01-01"), gender: "female", address: "Pune",
  };
  const booking = new Booking({
    tourId: "TOUR001", totalGuest: 2, adultCount: 2, childCount: 0,
    guestDetails: [{ ...guest, email: "lead@example.com" }, { ...guest, email: "other@example.com" }],
  });
  await booking.validate();
  assert.equal(booking.guestDetails[1]?.email, "other@example.com");
});

test("included airfare: correct an additional charge without changing the amount paid", () => {
  assert.deepEqual(calculateAirfareTotals(94550, 20000, 20000, 20000, { included: true }),
    { grandTotal: 74550, balanceAmount: 54550 });
});
test("included airfare: repeated saves and amount updates do not increase the booking total", () => {
  for (const next of [20000, 15000, 25000]) {
    assert.deepEqual(calculateAirfareTotals(74550, 20000, next, 20000, { previousIncluded: true, included: true }),
      { grandTotal: 74550, balanceAmount: 54550 });
  }
});
test("included airfare: reject amounts above the package total and corrections below paid money", () => {
  assert.throws(() => calculateAirfareTotals(74550, 20000, 80000, 20000, { previousIncluded: true, included: true }));
  assert.throws(() => calculateAirfareTotals(94550, 20000, 20000, 90000, { included: true }));
});
test("additional airfare remains backward compatible when inclusion is not selected", () => {
  assert.deepEqual(calculateAirfareTotals(74550, 0, 20000, 20000), { grandTotal: 94550, balanceAmount: 74550 });
});
