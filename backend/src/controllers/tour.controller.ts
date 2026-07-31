import type { Request, Response } from "express";
import { z } from "zod";

import { Booking } from "../models/booking.model";
import { Destination } from "../models/destination.model";
import { Tour, type TourDocument } from "../models/tour.model";
import {
  TourDeparture,
  type TourDepartureDocument,
} from "../models/tourDeparture.model";
import { HttpError } from "../utils/httpError";

const textField = (max: number) => z.string().trim().max(max).default("");
const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);
const optionalCodeField = (fieldName: string, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(
      /^[A-Za-z0-9_-]*$/,
      `${fieldName} can contain letters, numbers, hyphens, and underscores only`
    )
    .default("")
    .transform((value) => value.toUpperCase());
const nonNegativeNumberField = (fieldName: string, max: number) =>
  z.coerce.number().min(0, `${fieldName} cannot be negative`).max(max).default(0);
const requiredDateField = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      `${fieldName} must be a valid date`
    )
    .transform((value) => new Date(value));

const stringListSchema = z
  .array(z.string().trim().min(1).max(300))
  .max(50)
  .default([])
  .transform((values) => Array.from(new Set(values)));

const tourPayloadSchema = z.object({
  tourId: requiredTextField("Tour ID", 40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Tour ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  tourName: requiredTextField("Tour name", 140),
  tourType: requiredTextField("Tour type", 80),
  destinationId: requiredTextField("Destination ID", 40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Destination ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  durationDn: requiredTextField("Duration (D/N)", 40),
  category: textField(100),
  difficulty: textField(80),
  bestSeason: textField(120),
  description: textField(3000),
  inclusions: stringListSchema,
  exclusions: stringListSchema,
  expertId: optionalCodeField("Expert ID", 40),
  notes: textField(1000),
});

const tourDeparturePayloadSchema = z.object({
  departureId: requiredTextField("Departure ID", 40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Departure ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  tourId: requiredTextField("Tour ID", 40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Tour ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  destinationId: optionalCodeField("Destination ID", 40),
  departureDate: requiredDateField("Departure date"),
  returnDate: requiredDateField("Return date"),
  seatsAvailable: nonNegativeNumberField("Seats available", 100000),
  priceAdult: nonNegativeNumberField("Adult price", 100000000),
  priceChild: nonNegativeNumberField("Child price", 100000000),
  singleOccupancy: nonNegativeNumberField("Single occupancy", 100000000),
  depositType: textField(80),
  depositValue: nonNegativeNumberField("Deposit value", 100000000),
  balanceDueDaysBefore: nonNegativeNumberField(
    "Balance due days before",
    3650
  ),
  earlyBirdOffer: textField(500),
  bookingDeadline: requiredDateField("Booking deadline"),
});

type TourDeparturePayloadInput = z.infer<typeof tourDeparturePayloadSchema>;

function parseRequestBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new HttpError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  return result.data;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function isCastError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "CastError"
  );
}

function formatTour(tour: TourDocument) {
  return {
    id: tour._id.toString(),
    tourId: tour.tourId,
    tourName: tour.tourName,
    tourType: tour.tourType,
    destinationId: tour.destinationId,
    durationDn: tour.durationDn,
    category: tour.category,
    difficulty: tour.difficulty,
    bestSeason: tour.bestSeason,
    description: tour.description,
    inclusions: tour.inclusions,
    exclusions: tour.exclusions,
    expertId: tour.expertId,
    notes: tour.notes,
    createdAt: tour.createdAt,
    updatedAt: tour.updatedAt,
  };
}

function formatTourDeparture(departure: TourDepartureDocument) {
  return {
    id: departure._id.toString(),
    departureId: departure.departureId,
    tourId: departure.tourId,
    destinationId: departure.destinationId || "",
    departureDate: departure.departureDate,
    returnDate: departure.returnDate,
    seatsAvailable: departure.seatsAvailable,
    priceAdult: departure.priceAdult,
    priceChild: departure.priceChild,
    singleOccupancy: departure.singleOccupancy,
    depositType: departure.depositType,
    depositValue: departure.depositValue,
    balanceDueDaysBefore: departure.balanceDueDaysBefore,
    earlyBirdOffer: departure.earlyBirdOffer,
    bookingDeadline: departure.bookingDeadline,
    createdAt: departure.createdAt,
    updatedAt: departure.updatedAt,
  };
}

async function assertDestinationExists(destinationId: string): Promise<void> {
  const destinationExists = await Destination.exists({ destinationId });

  if (!destinationExists) {
    throw new HttpError(400, `Destination ID ${destinationId} does not exist`);
  }
}

async function getLinkedTour(tourId: string): Promise<TourDocument> {
  const tour = await Tour.findOne({ tourId });

  if (!tour) {
    throw new HttpError(400, `Tour ID ${tourId} does not exist`);
  }

  return tour;
}

async function createLinkedDeparturePayload(
  payload: TourDeparturePayloadInput
): Promise<TourDeparturePayloadInput & { destinationId: string }> {
  const { tourId, destinationId } = payload;
  const tour = await getLinkedTour(tourId);
  const linkedDestinationId = tour.destinationId;

  await assertDestinationExists(linkedDestinationId);

  if (destinationId && destinationId !== linkedDestinationId) {
    throw new HttpError(
      400,
      `Destination ID ${destinationId} does not match Tour ID ${tourId}`
    );
  }

  return {
    ...payload,
    destinationId: linkedDestinationId,
  };
}

export async function listTours(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const destinationId =
    typeof request.query.destinationId === "string"
      ? request.query.destinationId.trim().toUpperCase()
      : "";
  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
      { tourId: new RegExp(search, "i") },
      { tourName: new RegExp(search, "i") },
      { tourType: new RegExp(search, "i") },
      { destinationId: new RegExp(search, "i") },
      { category: new RegExp(search, "i") },
      { difficulty: new RegExp(search, "i") },
      { bestSeason: new RegExp(search, "i") },
      { expertId: new RegExp(search, "i") },
    ];
  }

  if (destinationId) {
    filters.destinationId = destinationId;
  }

  const tours = await Tour.find(filters).sort({ createdAt: -1 }).limit(200);

  response.status(200).json({
    success: true,
    message: "Tours fetched successfully",
    data: {
      tours: tours.map(formatTour),
    },
  });
}

export async function createTour(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourPayloadSchema, request.body);

  try {
    await assertDestinationExists(payload.destinationId);

    const tour = await Tour.create(payload);

    response.status(201).json({
      success: true,
      message: "Tour created successfully",
      data: {
        tour: formatTour(tour),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Tour ID already exists");
    }

    throw error;
  }
}

export async function updateTour(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourPayloadSchema, request.body);

  try {
    await assertDestinationExists(payload.destinationId);

    const existingTour = await Tour.findById(request.params.id);

    if (!existingTour) {
      throw new HttpError(404, "Tour not found");
    }

    const tour = await Tour.findByIdAndUpdate(request.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!tour) {
      throw new HttpError(404, "Tour not found");
    }

    if (
      existingTour.tourId !== tour.tourId ||
      existingTour.destinationId !== tour.destinationId
    ) {
      await Promise.all([
        TourDeparture.updateMany(
          { tourId: existingTour.tourId },
          {
            $set: {
              tourId: tour.tourId,
              destinationId: tour.destinationId,
            },
          }
        ),
        Booking.updateMany(
          { tourId: existingTour.tourId },
          {
            $set: {
              tourId: tour.tourId,
            },
          }
        ),
      ]);
    }

    response.status(200).json({
      success: true,
      message: "Tour updated successfully",
      data: {
        tour: formatTour(tour),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Tour ID already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid tour ID");
    }

    throw error;
  }
}

export async function deleteTour(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const tour = await Tour.findByIdAndDelete(request.params.id);

    if (!tour) {
      throw new HttpError(404, "Tour not found");
    }

    response.status(200).json({
      success: true,
      message: "Tour deleted successfully",
      data: {
        tour: formatTour(tour),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid tour ID");
    }

    throw error;
  }
}

export async function listTourDepartures(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const tourId =
    typeof request.query.tourId === "string"
      ? request.query.tourId.trim().toUpperCase()
      : "";
  const destinationId =
    typeof request.query.destinationId === "string"
      ? request.query.destinationId.trim().toUpperCase()
      : "";
  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
      { departureId: new RegExp(search, "i") },
      { tourId: new RegExp(search, "i") },
      { destinationId: new RegExp(search, "i") },
      { depositType: new RegExp(search, "i") },
      { earlyBirdOffer: new RegExp(search, "i") },
    ];
  }

  if (tourId) {
    filters.tourId = tourId;
  }

  if (destinationId) {
    filters.destinationId = destinationId;
  }

  const departures = await TourDeparture.find(filters)
    .sort({ departureDate: 1, createdAt: -1 })
    .limit(300);

  response.status(200).json({
    success: true,
    message: "Tour departures fetched successfully",
    data: {
      departures: departures.map(formatTourDeparture),
    },
  });
}

export async function createTourDeparture(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourDeparturePayloadSchema, request.body);

  try {
    const linkedPayload = await createLinkedDeparturePayload(payload);

    const departure = await TourDeparture.create(linkedPayload);

    response.status(201).json({
      success: true,
      message: "Tour departure created successfully",
      data: {
        departure: formatTourDeparture(departure),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Departure ID already exists");
    }

    throw error;
  }
}

export async function updateTourDeparture(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourDeparturePayloadSchema, request.body);

  try {
    const linkedPayload = await createLinkedDeparturePayload(payload);

    const departure = await TourDeparture.findByIdAndUpdate(
      request.params.id,
      linkedPayload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!departure) {
      throw new HttpError(404, "Tour departure not found");
    }

    response.status(200).json({
      success: true,
      message: "Tour departure updated successfully",
      data: {
        departure: formatTourDeparture(departure),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Departure ID already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid tour departure ID");
    }

    throw error;
  }
}

export async function deleteTourDeparture(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const departure = await TourDeparture.findByIdAndDelete(request.params.id);

    if (!departure) {
      throw new HttpError(404, "Tour departure not found");
    }

    response.status(200).json({
      success: true,
      message: "Tour departure deleted successfully",
      data: {
        departure: formatTourDeparture(departure),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid tour departure ID");
    }

    throw error;
  }
}
