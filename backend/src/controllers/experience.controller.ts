import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import { Destination } from "../models/destination.model";
import {
  calculateExperienceOverallRating,
  Experience,
  ExperienceStatus,
  type ExperienceDocument,
} from "../models/experience.model";
import { HttpError } from "../utils/httpError";

const textField = (max: number) => z.string().trim().max(max).default("");
const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);
const requiredCodeField = (fieldName: string, max: number) =>
  requiredTextField(fieldName, max)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      `${fieldName} can contain letters, numbers, hyphens, and underscores only`
    )
    .transform((value) => value.toUpperCase());
const ratingPayloadField = (fieldName: string) =>
  z.coerce
    .number()
    .min(1, `${fieldName} must be at least 1`)
    .max(5, `${fieldName} cannot be more than 5`)
    .default(5);
const experienceUploadDirectory = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage",
  "experiences"
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
const uploadMimeExtensions: Record<string, string> = {
  ...imageMimeExtensions,
  ...videoMimeExtensions,
};

mkdirSync(experienceUploadDirectory, { recursive: true });

function createSafeFileName(file: Express.Multer.File): string {
  const baseName =
    path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "experience";
  const extension =
    uploadMimeExtensions[file.mimetype] ||
    path.extname(file.originalname).toLowerCase() ||
    ".jpg";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${baseName}-${suffix}${extension}`;
}

function getUploadUrl(file: Express.Multer.File): string {
  return `/uploads/experiences/${file.filename}`;
}

export const experienceMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, experienceUploadDirectory);
    },
    filename: (_request, file, callback) => {
      callback(null, createSafeFileName(file));
    },
  }),
  fileFilter: (_request, file, callback) => {
    const allowedMimeExtensions =
      file.fieldname === "travellerVideos"
        ? videoMimeExtensions
        : imageMimeExtensions;

    if (file.mimetype in allowedMimeExtensions) {
      callback(null, true);
      return;
    }

    const message =
      file.fieldname === "travellerVideos"
        ? "Only MP4, MOV, and WebM videos are allowed"
        : "Only JPG, PNG, WebP, and GIF images are allowed";

    callback(new HttpError(400, message));
  },
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const stringListSchema = z
  .array(z.string().trim().min(1).max(500))
  .max(50)
  .default([])
  .transform((values) => Array.from(new Set(values)));
const mediaListSchema = z
  .array(z.string().trim().min(1).max(500))
  .max(60)
  .default([])
  .transform((values) => Array.from(new Set(values)));

const experiencePayloadSchema = z.object({
  experienceId: requiredCodeField("Experience ID", 40),
  destinationId: requiredCodeField("Destination ID", 40),
  travellerName: textField(120),
  travellerEmail: z
    .string()
    .trim()
    .email("Traveller email must be valid")
    .max(160)
    .or(z.literal(""))
    .default(""),
  title: requiredTextField("Experience title", 160),
  writtenReview: textField(3000),
  thingsToKnow: stringListSchema,
  travellerPhotoGallery: mediaListSchema,
  travellerVideos: mediaListSchema,
  ratingItinerary: ratingPayloadField("Itinerary rating"),
  ratingLocalTransport: ratingPayloadField("Local transport rating"),
  ratingAccommodation: ratingPayloadField("Accommodation rating"),
  ratingTourExpert: ratingPayloadField("Tour expert rating"),
  status: z
    .enum([ExperienceStatus.DRAFT, ExperienceStatus.PUBLISHED])
    .default(ExperienceStatus.DRAFT),
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

async function assertDestinationExists(destinationId: string): Promise<void> {
  const destination = await Destination.findOne({ destinationId })
    .select({ destinationId: 1 })
    .lean();

  if (!destination) {
    throw new HttpError(400, `Destination ID ${destinationId} does not exist`);
  }
}

async function createDestinationNameMap(destinationIds: string[]) {
  if (destinationIds.length === 0) {
    return new Map<string, string>();
  }

  const destinations = await Destination.find({
    destinationId: { $in: Array.from(new Set(destinationIds)) },
  })
    .select({ destinationId: 1, destinationName: 1 })
    .lean();

  return new Map(
    destinations.map((destination) => [
      destination.destinationId,
      destination.destinationName,
    ])
  );
}

function formatExperience(
  experience: ExperienceDocument,
  destinationNameById = new Map<string, string>()
) {
  return {
    id: experience._id.toString(),
    experienceId: experience.experienceId,
    destinationId: experience.destinationId,
    destinationName: destinationNameById.get(experience.destinationId) || "",
    travellerName: experience.travellerName,
    travellerEmail: experience.travellerEmail,
    title: experience.title,
    writtenReview: experience.writtenReview,
    thingsToKnow: experience.thingsToKnow,
    travellerPhotoGallery: experience.travellerPhotoGallery,
    travellerVideos: experience.travellerVideos,
    ratingItinerary: experience.ratingItinerary,
    ratingLocalTransport: experience.ratingLocalTransport,
    ratingAccommodation: experience.ratingAccommodation,
    ratingTourExpert: experience.ratingTourExpert,
    overallRating: experience.overallRating,
    status: experience.status,
    createdAt: experience.createdAt,
    updatedAt: experience.updatedAt,
  };
}

function createExperiencePayload(
  payload: z.infer<typeof experiencePayloadSchema>
) {
  return {
    ...payload,
    overallRating: calculateExperienceOverallRating(payload),
  };
}

export async function listExperiences(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const destinationId =
    typeof request.query.destinationId === "string"
      ? request.query.destinationId.trim().toUpperCase()
      : "";
  const status =
    typeof request.query.status === "string" ? request.query.status : "";
  const filterClauses: Record<string, unknown>[] = [];

  if (search) {
    filterClauses.push({
      $or: [
        { experienceId: new RegExp(search, "i") },
        { destinationId: new RegExp(search, "i") },
        { travellerName: new RegExp(search, "i") },
        { travellerEmail: new RegExp(search, "i") },
        { title: new RegExp(search, "i") },
        { writtenReview: new RegExp(search, "i") },
        { thingsToKnow: new RegExp(search, "i") },
      ],
    });
  }

  if (destinationId) {
    filterClauses.push({ destinationId });
  }

  if (status === ExperienceStatus.DRAFT || status === ExperienceStatus.PUBLISHED) {
    filterClauses.push({ status });
  }

  const filters = filterClauses.length > 0 ? { $and: filterClauses } : {};
  const experiences = await Experience.find(filters)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(300);
  const destinationNameById = await createDestinationNameMap(
    experiences.map((experience) => experience.destinationId)
  );

  response.status(200).json({
    success: true,
    message: "Experiences fetched successfully",
    data: {
      experiences: experiences.map((experience) =>
        formatExperience(experience, destinationNameById)
      ),
    },
  });
}

export async function listPublishedExperiences(
  request: Request,
  response: Response
): Promise<void> {
  const destinationId =
    typeof request.query.destinationId === "string"
      ? request.query.destinationId.trim().toUpperCase()
      : "";
  const filters: Record<string, unknown> = {
    status: ExperienceStatus.PUBLISHED,
  };

  if (destinationId) {
    filters.destinationId = destinationId;
  }

  const experiences = await Experience.find(filters)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(120);
  const destinationNameById = await createDestinationNameMap(
    experiences.map((experience) => experience.destinationId)
  );

  response.status(200).json({
    success: true,
    message: "Experiences fetched successfully",
    data: {
      experiences: experiences.map((experience) =>
        formatExperience(experience, destinationNameById)
      ),
    },
  });
}

export async function getExperience(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const experience = await Experience.findById(request.params.id);

    if (!experience) {
      throw new HttpError(404, "Experience not found");
    }

    const destinationNameById = await createDestinationNameMap([
      experience.destinationId,
    ]);

    response.status(200).json({
      success: true,
      message: "Experience fetched successfully",
      data: {
        experience: formatExperience(experience, destinationNameById),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid experience ID");
    }

    throw error;
  }
}

export async function createExperience(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(experiencePayloadSchema, request.body);

  try {
    await assertDestinationExists(payload.destinationId);

    const experience = await Experience.create(createExperiencePayload(payload));
    const destinationNameById = await createDestinationNameMap([
      experience.destinationId,
    ]);

    response.status(201).json({
      success: true,
      message: "Experience created successfully",
      data: {
        experience: formatExperience(experience, destinationNameById),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Experience ID already exists");
    }

    throw error;
  }
}

export async function updateExperience(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(experiencePayloadSchema, request.body);

  try {
    await assertDestinationExists(payload.destinationId);

    const experience = await Experience.findByIdAndUpdate(
      request.params.id,
      createExperiencePayload(payload),
      {
        new: true,
        runValidators: true,
      }
    );

    if (!experience) {
      throw new HttpError(404, "Experience not found");
    }

    const destinationNameById = await createDestinationNameMap([
      experience.destinationId,
    ]);

    response.status(200).json({
      success: true,
      message: "Experience updated successfully",
      data: {
        experience: formatExperience(experience, destinationNameById),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Experience ID already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid experience ID");
    }

    throw error;
  }
}

export async function deleteExperience(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const experience = await Experience.findByIdAndDelete(request.params.id);

    if (!experience) {
      throw new HttpError(404, "Experience not found");
    }

    const destinationNameById = await createDestinationNameMap([
      experience.destinationId,
    ]);

    response.status(200).json({
      success: true,
      message: "Experience deleted successfully",
      data: {
        experience: formatExperience(experience, destinationNameById),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid experience ID");
    }

    throw error;
  }
}

export async function uploadExperienceMedia(
  request: Request,
  response: Response
): Promise<void> {
  const files = request.files as
    | {
        travellerPhotoGallery?: Express.Multer.File[];
        travellerVideos?: Express.Multer.File[];
      }
    | undefined;
  const travellerPhotoGallery = (files?.travellerPhotoGallery || []).map(
    getUploadUrl
  );
  const travellerVideos = (files?.travellerVideos || []).map(getUploadUrl);

  if (travellerPhotoGallery.length === 0 && travellerVideos.length === 0) {
    throw new HttpError(400, "Please select at least one file to upload");
  }

  response.status(201).json({
    success: true,
    message: "Experience media uploaded successfully",
    data: {
      travellerPhotoGallery,
      travellerVideos,
    },
  });
}
