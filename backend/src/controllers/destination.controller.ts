import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import {
  Destination,
  DestinationType,
  type DestinationDocument,
} from "../models/destination.model";
import { HttpError } from "../utils/httpError";

const textField = (max: number) => z.string().trim().max(max).default("");
const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);
const destinationUploadDirectory = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage",
  "destinations"
);
const imageMimeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

mkdirSync(destinationUploadDirectory, { recursive: true });

function createSafeFileName(file: Express.Multer.File): string {
  const baseName =
    path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "destination";
  const extension =
    imageMimeExtensions[file.mimetype] ||
    path.extname(file.originalname).toLowerCase() ||
    ".jpg";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${baseName}-${suffix}${extension}`;
}

function getUploadUrl(file: Express.Multer.File): string {
  return `/uploads/destinations/${file.filename}`;
}

export const destinationImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, destinationUploadDirectory);
    },
    filename: (_request, file, callback) => {
      callback(null, createSafeFileName(file));
    },
  }),
  fileFilter: (_request, file, callback) => {
    if (file.mimetype in imageMimeExtensions) {
      callback(null, true);
      return;
    }

    callback(new HttpError(400, "Only JPG, PNG, WebP, and GIF images are allowed"));
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 21,
  },
});

const stringListSchema = z
  .array(z.string().trim().min(1).max(300))
  .max(30)
  .default([])
  .transform((values) => Array.from(new Set(values)));

const destinationPayloadSchema = z.object({
  destinationId: requiredTextField("Destination ID", 40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Destination ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  destinationName: requiredTextField("Destination name", 120),
  destinationType: z.enum([
    DestinationType.DOMESTIC,
    DestinationType.INTERNATIONAL,
  ]),
  countryRegion: requiredTextField("Country / Region", 120),
  state: textField(100),
  city: textField(100),
  primaryHeritageFocus: textField(160),
  unescoSite: z.boolean().default(false),
  keyLandmarks: stringListSchema,
  recommendedDurationDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(1),
  shortDescription: textField(800),
  dressCode: textField(240),
  footwear: textField(240),
  permits: textField(240),
  idRequirement: textField(240),
  restrictions: textField(400),
  bannerImage: textField(500),
  galleryImages: stringListSchema,
  photos: stringListSchema.optional(),
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

function formatDestination(destination: DestinationDocument) {
  return {
    id: destination._id.toString(),
    destinationId: destination.destinationId,
    destinationName: destination.destinationName,
    destinationType: destination.destinationType,
    countryRegion: destination.countryRegion,
    state: destination.state,
    city: destination.city,
    primaryHeritageFocus: destination.primaryHeritageFocus,
    unescoSite: destination.unescoSite,
    keyLandmarks: destination.keyLandmarks,
    recommendedDurationDays: destination.recommendedDurationDays,
    shortDescription: destination.shortDescription,
    dressCode: destination.dressCode,
    footwear: destination.footwear,
    permits: destination.permits,
    idRequirement: destination.idRequirement,
    restrictions: destination.restrictions,
    bannerImage: destination.bannerImage || destination.photos?.[0] || "",
    galleryImages:
      destination.galleryImages?.length > 0
        ? destination.galleryImages
        : destination.photos || [],
    createdAt: destination.createdAt,
    updatedAt: destination.updatedAt,
  };
}

export async function listDestinations(
  request: Request,
  response: Response
): Promise<void> {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const destinationType =
    typeof request.query.destinationType === "string"
      ? request.query.destinationType
      : "";

  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
      { destinationId: new RegExp(search, "i") },
      { destinationName: new RegExp(search, "i") },
      { countryRegion: new RegExp(search, "i") },
      { state: new RegExp(search, "i") },
      { city: new RegExp(search, "i") },
    ];
  }

  if (
    destinationType === DestinationType.DOMESTIC ||
    destinationType === DestinationType.INTERNATIONAL
  ) {
    filters.destinationType = destinationType;
  }

  const destinations = await Destination.find(filters)
    .sort({ createdAt: -1 })
    .limit(200);

  response.status(200).json({
    success: true,
    message: "Destinations fetched successfully",
    data: {
      destinations: destinations.map(formatDestination),
    },
  });
}

export async function createDestination(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(destinationPayloadSchema, request.body);
  const { photos: legacyPhotos = [], ...destinationFields } = payload;
  const destinationPayload = {
    ...destinationFields,
    bannerImage: destinationFields.bannerImage || legacyPhotos[0] || "",
    galleryImages:
      destinationFields.galleryImages.length > 0
        ? destinationFields.galleryImages
        : legacyPhotos.slice(destinationFields.bannerImage ? 0 : 1),
  };

  try {
    const destination = await Destination.create(destinationPayload);

    response.status(201).json({
      success: true,
      message: "Destination created successfully",
      data: {
        destination: formatDestination(destination),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Destination ID already exists");
    }

    throw error;
  }
}

export async function updateDestination(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(destinationPayloadSchema, request.body);
  const { photos: legacyPhotos = [], ...destinationFields } = payload;
  const destinationPayload = {
    ...destinationFields,
    bannerImage: destinationFields.bannerImage || legacyPhotos[0] || "",
    galleryImages:
      destinationFields.galleryImages.length > 0
        ? destinationFields.galleryImages
        : legacyPhotos.slice(destinationFields.bannerImage ? 0 : 1),
  };

  try {
    const destination = await Destination.findByIdAndUpdate(
      request.params.id,
      destinationPayload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!destination) {
      throw new HttpError(404, "Destination not found");
    }

    response.status(200).json({
      success: true,
      message: "Destination updated successfully",
      data: {
        destination: formatDestination(destination),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Destination ID already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid destination ID");
    }

    throw error;
  }
}

export async function uploadDestinationImages(
  request: Request,
  response: Response
): Promise<void> {
  const files = request.files as
    | {
        bannerImage?: Express.Multer.File[];
        galleryImages?: Express.Multer.File[];
      }
    | undefined;
  const bannerImage = files?.bannerImage?.[0]
    ? getUploadUrl(files.bannerImage[0])
    : "";
  const galleryImages = (files?.galleryImages || []).map(getUploadUrl);

  if (!bannerImage && galleryImages.length === 0) {
    throw new HttpError(400, "Please select at least one image to upload");
  }

  response.status(201).json({
    success: true,
    message: "Images uploaded successfully",
    data: {
      bannerImage,
      galleryImages,
    },
  });
}
