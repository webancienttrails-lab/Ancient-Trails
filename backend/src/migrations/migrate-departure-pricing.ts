import "dotenv/config";

import mongoose from "mongoose";

import { TourDeparture } from "../models/tourDeparture.model";
import type {
  DepositAppliesTo,
  DepositType,
} from "../services/departure/departure.types";

const exactDepartureUpdates = [
  {
    departureId: "DEP001",
    tourId: "TOUR001",
    destinationId: "DOM001",
    departureDate: new Date("2026-12-13T00:00:00.000Z"),
    returnDate: new Date("2026-12-18T00:00:00.000Z"),
    seatsAvailable: 25,
    priceAdult: 35500,
    priceExtraBed: 31950,
    priceChildWithoutExtraBed: 28400,
    singleOccupancy: 44375,
    depositType: "fixed" as DepositType,
    depositValue: 20000,
    depositAppliesTo: "per_person" as DepositAppliesTo,
    balanceDueDaysBefore: 15,
    earlyBirdOffer: null,
    bookingDeadline: new Date("2026-11-30T00:00:00.000Z"),
    status: "scheduled",
  },
  {
    departureId: "DEP002",
    tourId: "TOUR001",
    destinationId: "DOM001",
    departureDate: new Date("2027-02-04T00:00:00.000Z"),
    returnDate: new Date("2027-02-09T00:00:00.000Z"),
    seatsAvailable: 25,
    priceAdult: 35500,
    priceExtraBed: 31950,
    priceChildWithoutExtraBed: 28400,
    singleOccupancy: 44375,
    depositType: "fixed" as DepositType,
    depositValue: 20000,
    depositAppliesTo: "per_person" as DepositAppliesTo,
    balanceDueDaysBefore: 15,
    earlyBirdOffer: null,
    bookingDeadline: new Date("2027-01-20T00:00:00.000Z"),
    status: "scheduled",
  },
  {
    departureId: "DEP003",
    tourId: "TOUR002",
    destinationId: "DOM005",
    departureDate: new Date("2027-02-15T00:00:00.000Z"),
    returnDate: new Date("2027-02-18T00:00:00.000Z"),
    seatsAvailable: 25,
    priceAdult: 49900,
    priceExtraBed: 44910,
    priceChildWithoutExtraBed: 39920,
    singleOccupancy: 62375,
    depositType: "fixed" as DepositType,
    depositValue: 25000,
    depositAppliesTo: "per_person" as DepositAppliesTo,
    balanceDueDaysBefore: 15,
    earlyBirdOffer: null,
    bookingDeadline: new Date("2027-02-01T00:00:00.000Z"),
    status: "scheduled",
  },
] as const;

function normalizeDepositType(value: unknown): DepositType {
  const label = String(value || "").trim().toLowerCase();

  if (label.includes("percent")) {
    return "percentage";
  }

  return "fixed";
}

async function migrateExistingDepartures() {
  const departures = await TourDeparture.find();

  for (const departure of departures) {
    const earlyBirdOffer = departure.earlyBirdOffer?.trim();

    departure.priceExtraBed = departure.priceExtraBed || departure.priceAdult;
    departure.priceChildWithoutExtraBed =
      departure.priceChildWithoutExtraBed ||
      departure.priceExtraBed ||
      departure.priceAdult;
    departure.depositType = normalizeDepositType(departure.depositType);
    departure.depositAppliesTo = departure.depositAppliesTo || "per_person";
    departure.earlyBirdOffer =
      earlyBirdOffer && earlyBirdOffer.toUpperCase() !== "NIL"
        ? earlyBirdOffer
        : null;
    departure.status = departure.status || "scheduled";

    if (departure.status === "coming_soon") {
      departure.departureDate = null;
      departure.returnDate = null;
    }

    await departure.save();
  }
}

async function applyExactDepartureUpdates() {
  for (const update of exactDepartureUpdates) {
    await TourDeparture.findOneAndUpdate(
      { departureId: update.departureId },
      {
        $set: update,
      },
      {
        new: true,
        runValidators: true,
      }
    );
  }
}

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from the .env file");
  }

  await mongoose.connect(databaseUrl);

  try {
    await migrateExistingDepartures();
    await applyExactDepartureUpdates();
  } finally {
    await mongoose.disconnect();
  }
}

void runMigration()
  .then(() => {
    console.log("Departure pricing migration completed");
  })
  .catch((error) => {
    console.error("Departure pricing migration failed", error);
    process.exitCode = 1;
  });
