import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import { Booking } from "../models/booking.model";
import { Destination } from "../models/destination.model";
import { Tour, type TourDocument } from "../models/tour.model";
import {
  TourDeparture,
  type TourDepartureDocument,
} from "../models/tourDeparture.model";
import {
  TourItinerary,
  type TourItineraryDocument,
} from "../models/tourItinerary.model";
import {
  departureStatuses,
  depositAppliesToValues,
  depositTypes,
} from "../services/departure/departure.types";
import { validateDepartureSchedule } from "../services/departure/departure.validation";
import { HttpError } from "../utils/httpError";

const textField = (max: number) => z.string().trim().max(max).default("");
const codePattern = /^[A-Za-z0-9_-]+$/;
const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);
const requiredCodeField = (fieldName: string, max: number) =>
  requiredTextField(fieldName, max)
    .regex(
      codePattern,
      `${fieldName} can contain letters, numbers, hyphens, and underscores only`
    )
    .transform((value) => value.toUpperCase());
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
const optionalDateField = (fieldName: string) =>
  z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform((value, context) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const date = value instanceof Date ? value : new Date(value.trim());

      if (Number.isNaN(date.getTime())) {
        context.addIssue({
          code: "custom",
          message: `${fieldName} must be a valid date`,
        });

        return z.NEVER;
      }

      return date;
    });
const tourUploadDirectory = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage",
  "tours"
);
const imageMimeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const videoMimeExtensions: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};
const tourUploadMimeExtensions: Record<string, string> = {
  ...imageMimeExtensions,
  ...videoMimeExtensions,
};

mkdirSync(tourUploadDirectory, { recursive: true });

function createSafeFileName(file: Express.Multer.File): string {
  const baseName =
    path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "tour";
  const extension =
    tourUploadMimeExtensions[file.mimetype] ||
    path.extname(file.originalname).toLowerCase() ||
    ".jpg";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${baseName}-${suffix}${extension}`;
}

function getUploadUrl(file: Express.Multer.File): string {
  return `/uploads/tours/${file.filename}`;
}

export const tourMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, tourUploadDirectory);
    },
    filename: (_request, file, callback) => {
      callback(null, createSafeFileName(file));
    },
  }),
  fileFilter: (_request, file, callback) => {
    const allowedMimeExtensions =
      file.fieldname === "video" ? videoMimeExtensions : imageMimeExtensions;

    if (file.mimetype in allowedMimeExtensions) {
      callback(null, true);
      return;
    }

    const message =
      file.fieldname === "video"
        ? "Only MP4, MOV, and WebM videos are allowed"
        : "Only JPG, PNG, WebP, and GIF images are allowed";

    callback(new HttpError(400, message));
  },
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 22,
  },
});

const stringListSchema = z
  .array(z.string().trim().min(1).max(300))
  .max(50)
  .default([])
  .transform((values) => Array.from(new Set(values)));
const destinationIdsSchema = z
  .preprocess((value) => {
    if (Array.isArray(value)) {
      return value.filter(
        (item) => typeof item !== "string" || item.trim().length > 0
      );
    }

    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }, z.array(requiredCodeField("Destination ID", 40)).max(50))
  .default([])
  .transform((values) => Array.from(new Set(values)));

const tourPayloadSchema = z
  .object({
    tourId: requiredCodeField("Tour ID", 40),
    tourName: requiredTextField("Tour name", 140),
    tourType: requiredTextField("Tour type", 80),
    destinationId: optionalCodeField("Destination ID", 40),
    destinationIds: destinationIdsSchema,
    durationDn: requiredTextField("Duration (D/N)", 40),
    category: textField(100),
    difficulty: textField(80),
    bestSeason: textField(120),
    description: textField(3000),
    inclusions: stringListSchema,
    exclusions: stringListSchema,
    expertId: optionalCodeField("Expert ID", 40),
    notes: textField(1000),
    bannerImage: textField(500),
    galleryImages: stringListSchema,
    video: textField(500),
  })
  .transform((payload, context) => {
    const destinationIds = Array.from(
      new Set([payload.destinationId, ...payload.destinationIds].filter(Boolean))
    );

    if (destinationIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["destinationIds"],
        message: "At least one destination is required",
      });

      return z.NEVER;
    }

    return {
      ...payload,
      destinationId: destinationIds[0],
      destinationIds,
    };
  });

const childPricingRulePayloadSchema = z
  .object({
    minAge: z.coerce.number().int().min(0).max(120),
    maxAge: z.coerce.number().int().min(0).max(120),
    allowExtraBed: z.coerce.boolean().default(true),
    allowWithoutExtraBed: z.coerce.boolean().default(true),
  })
  .superRefine((rule, context) => {
    if (rule.maxAge < rule.minAge) {
      context.addIssue({
        code: "custom",
        path: ["maxAge"],
        message: "Maximum age must be greater than or equal to minimum age",
      });
    }
  });

const roomPolicyPayloadSchema = z
  .object({
    allowChildBedSharing: z.coerce.boolean().default(true),
    maxChildrenWithoutExtraBedPerRoom: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .default(1),
    allowExtraBed: z.coerce.boolean().default(true),
    allowChildSingleRoom: z.coerce.boolean().default(false),
  })
  .default({
    allowChildBedSharing: true,
    maxChildrenWithoutExtraBedPerRoom: 1,
    allowExtraBed: true,
    allowChildSingleRoom: false,
  });

const tourDeparturePayloadSchema = z
  .object({
    departureId: requiredTextField("Departure ID", 40)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Departure ID can contain letters, numbers, hyphens, and underscores only"
      )
      .transform((value) => value.toUpperCase()),
    tourId: requiredCodeField("Tour ID", 40),
    destinationId: optionalCodeField("Destination ID", 40),
    departureDate: optionalDateField("Departure date"),
    returnDate: optionalDateField("Return date"),
    seatsAvailable: nonNegativeNumberField("Seats available", 100000),
    priceAdult: nonNegativeNumberField("Adult price", 100000000),
    priceExtraBed: nonNegativeNumberField("Extra bed price", 100000000),
    priceChildWithoutExtraBed: nonNegativeNumberField(
      "Child without extra bed price",
      100000000
    ),
    singleOccupancy: nonNegativeNumberField(
      "Single occupancy price",
      100000000
    ),
    depositType: z.enum(depositTypes).default("fixed"),
    depositValue: nonNegativeNumberField("Deposit value", 100000000),
    depositAppliesTo: z.enum(depositAppliesToValues).default("per_person"),
    balanceDueDaysBefore: nonNegativeNumberField(
      "Balance due days before",
      3650
    ),
    earlyBirdOffer: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((value) => {
        const offer = typeof value === "string" ? value.trim() : "";

        return offer && offer.toUpperCase() !== "NIL" ? offer : null;
      }),
    bookingDeadline: optionalDateField("Booking deadline"),
    status: z.enum(departureStatuses).default("scheduled"),
    childPricingRules: z.array(childPricingRulePayloadSchema).default([]),
    roomPolicy: roomPolicyPayloadSchema,
  })
  .superRefine((payload, context) => {
    const validation = validateDepartureSchedule(payload);

    validation.errors.forEach((message) => {
      context.addIssue({
        code: "custom",
        path: ["departureDate"],
        message,
      });
    });
  });

type TourDeparturePayloadInput = z.infer<typeof tourDeparturePayloadSchema>;

const tourItineraryDayPayloadSchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(365),
  title: requiredTextField("Day title", 140),
  summary: textField(1000),
  placesVisited: stringListSchema,
  transport: textField(240),
  walkingDifficulty: textField(240),
  meals: textField(400),
});

const tourItineraryPayloadSchema = z.object({
  tourId: requiredCodeField("Tour ID", 40),
  itinerarySummary: requiredTextField("Itinerary summary", 3000),
  days: z.array(tourItineraryDayPayloadSchema).min(1).max(365),
});

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

function normalizeDestinationIds(...sources: Array<string | string[] | undefined>) {
  return Array.from(
    new Set(
      sources
        .flatMap((source) => (Array.isArray(source) ? source : [source]))
        .map((destinationId) => destinationId?.trim().toUpperCase() || "")
        .filter(Boolean)
    )
  );
}

function getTourDestinationIds(tour: Pick<TourDocument, "destinationId" | "destinationIds">) {
  return normalizeDestinationIds(tour.destinationId, tour.destinationIds);
}

function formatTour(tour: TourDocument) {
  const destinationIds = getTourDestinationIds(tour);

  return {
    id: tour._id.toString(),
    tourId: tour.tourId,
    tourName: tour.tourName,
    tourType: tour.tourType,
    destinationId: destinationIds[0] || tour.destinationId,
    destinationIds,
    durationDn: tour.durationDn,
    category: tour.category,
    difficulty: tour.difficulty,
    bestSeason: tour.bestSeason,
    description: tour.description,
    inclusions: tour.inclusions,
    exclusions: tour.exclusions,
    expertId: tour.expertId,
    notes: tour.notes,
    bannerImage: tour.bannerImage,
    galleryImages: tour.galleryImages,
    video: tour.video,
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
    priceExtraBed: departure.priceExtraBed,
    priceChildWithoutExtraBed: departure.priceChildWithoutExtraBed,
    singleOccupancy: departure.singleOccupancy,
    depositType: departure.depositType,
    depositValue: departure.depositValue,
    depositAppliesTo: departure.depositAppliesTo,
    balanceDueDaysBefore: departure.balanceDueDaysBefore,
    earlyBirdOffer: departure.earlyBirdOffer,
    bookingDeadline: departure.bookingDeadline,
    status: departure.status,
    childPricingRules: departure.childPricingRules.map((rule) => ({
      minAge: rule.minAge,
      maxAge: rule.maxAge,
      allowExtraBed: rule.allowExtraBed,
      allowWithoutExtraBed: rule.allowWithoutExtraBed,
    })),
    roomPolicy: {
      allowChildBedSharing:
        departure.roomPolicy?.allowChildBedSharing ?? true,
      maxChildrenWithoutExtraBedPerRoom:
        departure.roomPolicy?.maxChildrenWithoutExtraBedPerRoom ?? 1,
      allowExtraBed: departure.roomPolicy?.allowExtraBed ?? true,
      allowChildSingleRoom:
        departure.roomPolicy?.allowChildSingleRoom ?? false,
    },
    createdAt: departure.createdAt,
    updatedAt: departure.updatedAt,
  };
}

function formatTourItinerary(itinerary: TourItineraryDocument) {
  return {
    id: itinerary._id.toString(),
    tourId: itinerary.tourId,
    itinerarySummary: itinerary.itinerarySummary,
    days: itinerary.days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      summary: day.summary,
      placesVisited: day.placesVisited,
      transport: day.transport,
      walkingDifficulty: day.walkingDifficulty,
      meals: day.meals,
    })),
    createdAt: itinerary.createdAt,
    updatedAt: itinerary.updatedAt,
  };
}

async function assertDestinationsExist(destinationIds: string[]): Promise<void> {
  const normalizedDestinationIds = normalizeDestinationIds(destinationIds);

  if (normalizedDestinationIds.length === 0) {
    throw new HttpError(400, "At least one destination is required");
  }

  const destinations = await Destination.find({
    destinationId: { $in: normalizedDestinationIds },
  })
    .select({ destinationId: 1 })
    .lean();
  const existingDestinationIds = new Set(
    destinations.map((destination) => destination.destinationId)
  );
  const missingDestinationIds = normalizedDestinationIds.filter(
    (destinationId) => !existingDestinationIds.has(destinationId)
  );

  if (missingDestinationIds.length > 0) {
    throw new HttpError(
      400,
      `Destination ID ${missingDestinationIds.join(", ")} does not exist`
    );
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
  const linkedDestinationIds = getTourDestinationIds(tour);
  const linkedDestinationId = destinationId || linkedDestinationIds[0] || "";

  await assertDestinationsExist(linkedDestinationIds);

  if (destinationId && !linkedDestinationIds.includes(destinationId)) {
    throw new HttpError(
      400,
      `Destination ID ${destinationId} is not linked to Tour ID ${tourId}`
    );
  }

  return {
    ...payload,
    destinationId: linkedDestinationId,
  };
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);

  return left.every((value) => rightSet.has(value));
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
  const filterClauses: Record<string, unknown>[] = [];

  if (search) {
    filterClauses.push({
      $or: [
        { tourId: new RegExp(search, "i") },
        { tourName: new RegExp(search, "i") },
        { tourType: new RegExp(search, "i") },
        { destinationId: new RegExp(search, "i") },
        { destinationIds: new RegExp(search, "i") },
        { category: new RegExp(search, "i") },
        { difficulty: new RegExp(search, "i") },
        { bestSeason: new RegExp(search, "i") },
        { expertId: new RegExp(search, "i") },
      ],
    });
  }

  if (destinationId) {
    filterClauses.push({
      $or: [{ destinationId }, { destinationIds: destinationId }],
    });
  }

  const filters =
    filterClauses.length > 0 ? { $and: filterClauses } : {};

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
    await assertDestinationsExist(payload.destinationIds);

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
    await assertDestinationsExist(payload.destinationIds);

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

    const existingDestinationIds = getTourDestinationIds(existingTour);
    const nextDestinationIds = getTourDestinationIds(tour);

    if (
      existingTour.tourId !== tour.tourId ||
      !sameStringSet(existingDestinationIds, nextDestinationIds)
    ) {
      await Promise.all([
        TourDeparture.updateMany(
          { tourId: existingTour.tourId },
          {
            $set: {
              tourId: tour.tourId,
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
        TourItinerary.updateMany(
          { tourId: existingTour.tourId },
          {
            $set: {
              tourId: tour.tourId,
            },
          }
        ),
      ]);
      await TourDeparture.updateMany(
        {
          tourId: tour.tourId,
          destinationId: { $nin: nextDestinationIds },
        },
        {
          $set: {
            destinationId: tour.destinationId,
          },
        }
      );
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

export async function uploadTourMedia(
  request: Request,
  response: Response
): Promise<void> {
  const files = request.files as
    | {
        bannerImage?: Express.Multer.File[];
        galleryImages?: Express.Multer.File[];
        video?: Express.Multer.File[];
      }
    | undefined;
  const bannerImage = files?.bannerImage?.[0]
    ? getUploadUrl(files.bannerImage[0])
    : "";
  const galleryImages = (files?.galleryImages || []).map(getUploadUrl);
  const video = files?.video?.[0] ? getUploadUrl(files.video[0]) : "";

  if (!bannerImage && galleryImages.length === 0 && !video) {
    throw new HttpError(400, "Please select at least one file to upload");
  }

  response.status(201).json({
    success: true,
    message: "Media uploaded successfully",
    data: {
      bannerImage,
      galleryImages,
      video,
    },
  });
}

export async function listTourItineraries(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const tourId =
    typeof request.query.tourId === "string"
      ? request.query.tourId.trim().toUpperCase()
      : "";
  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
      { tourId: new RegExp(search, "i") },
      { itinerarySummary: new RegExp(search, "i") },
      { "days.title": new RegExp(search, "i") },
      { "days.summary": new RegExp(search, "i") },
      { "days.placesVisited": new RegExp(search, "i") },
      { "days.transport": new RegExp(search, "i") },
      { "days.walkingDifficulty": new RegExp(search, "i") },
      { "days.meals": new RegExp(search, "i") },
    ];
  }

  if (tourId) {
    filters.tourId = tourId;
  }

  const itineraries = await TourItinerary.find(filters)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(200);

  response.status(200).json({
    success: true,
    message: "Tour itineraries fetched successfully",
    data: {
      itineraries: itineraries.map(formatTourItinerary),
    },
  });
}

export async function createTourItinerary(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourItineraryPayloadSchema, request.body);

  try {
    await getLinkedTour(payload.tourId);

    const itinerary = await TourItinerary.create(payload);

    response.status(201).json({
      success: true,
      message: "Tour itinerary created successfully",
      data: {
        itinerary: formatTourItinerary(itinerary),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Tour itinerary already exists");
    }

    throw error;
  }
}

export async function updateTourItinerary(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourItineraryPayloadSchema, request.body);

  try {
    await getLinkedTour(payload.tourId);

    const itinerary = await TourItinerary.findByIdAndUpdate(
      request.params.id,
      payload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!itinerary) {
      throw new HttpError(404, "Tour itinerary not found");
    }

    response.status(200).json({
      success: true,
      message: "Tour itinerary updated successfully",
      data: {
        itinerary: formatTourItinerary(itinerary),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Tour itinerary already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid tour itinerary ID");
    }

    throw error;
  }
}

export async function deleteTourItinerary(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const itinerary = await TourItinerary.findByIdAndDelete(request.params.id);

    if (!itinerary) {
      throw new HttpError(404, "Tour itinerary not found");
    }

    response.status(200).json({
      success: true,
      message: "Tour itinerary deleted successfully",
      data: {
        itinerary: formatTourItinerary(itinerary),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid tour itinerary ID");
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
