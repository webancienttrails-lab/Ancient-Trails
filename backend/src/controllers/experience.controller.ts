import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import {
  calculateExperienceOverallRating,
  Experience,
  ExperienceStatus,
  type ExperienceDocument,
} from "../models/experience.model";
import { Tour } from "../models/tour.model";
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
const optionalCodeField = (fieldName: string, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !value || /^[A-Za-z0-9_-]+$/.test(value),
      `${fieldName} can contain letters, numbers, hyphens, and underscores only`
    )
    .transform((value) => value.toUpperCase())
    .default("");
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
const indexedTextListSchema = z
  .array(z.string().trim().max(160))
  .max(60)
  .default([]);
const attractionPhotoListSchema = z
  .array(
    z.preprocess(
      (value) =>
        typeof value === "string"
          ? {
              image: value,
              name: "",
            }
          : value,
      z.object({
        image: z.string().trim().min(1, "Attraction photo is required").max(500),
        name: textField(120),
      })
    )
  )
  .max(60)
  .default([])
  .transform((items) => {
    const seenImages = new Set<string>();

    return items
      .map((item) => ({
        image: item.image.trim(),
        name: item.name.trim(),
      }))
      .filter((item) => {
        if (!item.image || seenImages.has(item.image)) {
          return false;
        }

        seenImages.add(item.image);

        return true;
      });
  });

const experiencePayloadSchema = z.object({
  experienceId: optionalCodeField("Experience ID", 40),
  tourId: requiredCodeField("Tour ID", 40),
  travellerName: textField(120),
  travellerEmail: z
    .string()
    .trim()
    .email("Traveller email must be valid")
    .max(160)
    .or(z.literal(""))
    .default(""),
  title: textField(160),
  writtenReview: textField(3000),
  thingsToKnow: stringListSchema,
  travellerPhotoGallery: mediaListSchema,
  travellerVideos: mediaListSchema,
  travellerVideoTitles: indexedTextListSchema,
  attractionPhotoGallery: attractionPhotoListSchema,
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

async function assertTourExists(tourId: string): Promise<void> {
  const tour = await Tour.findOne({ tourId })
    .select({ tourId: 1 })
    .lean();

  if (!tour) {
    throw new HttpError(400, `Tour ID ${tourId} does not exist`);
  }
}

async function createTourNameMap(tourIds: string[]) {
  if (tourIds.length === 0) {
    return new Map<string, string>();
  }

  const tours = await Tour.find({
    tourId: { $in: Array.from(new Set(tourIds)) },
  })
    .select({ tourId: 1, tourName: 1 })
    .lean();

  return new Map(
    tours.map((tour) => [
      tour.tourId,
      tour.tourName,
    ])
  );
}

function createGeneratedExperienceId(tourId: string): string {
  const prefix =
    tourId
      .replace(/[^A-Z0-9_-]+/g, "")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "EXP";
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

  return `${prefix}-${suffix}`.slice(0, 40);
}

function createGeneratedExperienceTitle(
  payload: z.infer<typeof experiencePayloadSchema>
): string {
  const travellerName = payload.travellerName.trim();

  if (travellerName) {
    return `${travellerName} traveller experience`;
  }

  return `${payload.tourId} traveller experience`;
}

function formatExperience(
  experience: ExperienceDocument,
  tourNameById = new Map<string, string>()
) {
  return {
    id: experience._id.toString(),
    experienceId: experience.experienceId,
    tourId: experience.tourId,
    tourName: tourNameById.get(experience.tourId) || "",
    travellerName: experience.travellerName,
    travellerEmail: experience.travellerEmail,
    title: experience.title,
    writtenReview: experience.writtenReview,
    thingsToKnow: experience.thingsToKnow,
    travellerPhotoGallery: experience.travellerPhotoGallery,
    travellerVideos: experience.travellerVideos,
    travellerVideoTitles: experience.travellerVideoTitles || [],
    attractionPhotoGallery: experience.attractionPhotoGallery || [],
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
  payload: z.infer<typeof experiencePayloadSchema>,
  mode: "create" | "update"
) {
  const experiencePayload = {
    tourId: payload.tourId,
    travellerName: payload.travellerName,
    travellerEmail: payload.travellerEmail,
    writtenReview: payload.writtenReview,
    thingsToKnow: payload.thingsToKnow,
    travellerPhotoGallery: payload.travellerPhotoGallery,
    travellerVideos: payload.travellerVideos,
    travellerVideoTitles: payload.travellerVideoTitles,
    attractionPhotoGallery: payload.attractionPhotoGallery,
    ratingItinerary: payload.ratingItinerary,
    ratingLocalTransport: payload.ratingLocalTransport,
    ratingAccommodation: payload.ratingAccommodation,
    ratingTourExpert: payload.ratingTourExpert,
    overallRating: calculateExperienceOverallRating(payload),
    status: payload.status,
  };

  return {
    ...experiencePayload,
    ...(payload.experienceId
      ? { experienceId: payload.experienceId }
      : mode === "create"
        ? { experienceId: createGeneratedExperienceId(payload.tourId) }
        : {}),
    ...(payload.title
      ? { title: payload.title }
      : mode === "create"
        ? { title: createGeneratedExperienceTitle(payload) }
        : {}),
  };
}

export async function listExperiences(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const tourId =
    typeof request.query.tourId === "string"
      ? request.query.tourId.trim().toUpperCase()
      : "";
  const status =
    typeof request.query.status === "string" ? request.query.status : "";
  const filterClauses: Record<string, unknown>[] = [];

  if (search) {
    filterClauses.push({
      $or: [
        { tourId: new RegExp(search, "i") },
        { travellerName: new RegExp(search, "i") },
        { travellerEmail: new RegExp(search, "i") },
        { writtenReview: new RegExp(search, "i") },
        { thingsToKnow: new RegExp(search, "i") },
        { travellerVideoTitles: new RegExp(search, "i") },
        { "attractionPhotoGallery.name": new RegExp(search, "i") },
      ],
    });
  }

  if (tourId) {
    filterClauses.push({ tourId });
  }

  if (status === ExperienceStatus.DRAFT || status === ExperienceStatus.PUBLISHED) {
    filterClauses.push({ status });
  }

  const filters = filterClauses.length > 0 ? { $and: filterClauses } : {};
  const experiences = await Experience.find(filters)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(300);
  const tourNameById = await createTourNameMap(
    experiences.map((experience) => experience.tourId)
  );

  response.status(200).json({
    success: true,
    message: "Experiences fetched successfully",
    data: {
      experiences: experiences.map((experience) =>
        formatExperience(experience, tourNameById)
      ),
    },
  });
}

export async function listPublishedExperiences(
  request: Request,
  response: Response
): Promise<void> {
  const tourId =
    typeof request.query.tourId === "string"
      ? request.query.tourId.trim().toUpperCase()
      : "";
  const filters: Record<string, unknown> = {
    status: ExperienceStatus.PUBLISHED,
  };

  if (tourId) {
    filters.tourId = tourId;
  }

  const experiences = await Experience.find(filters)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(120);
  const tourNameById = await createTourNameMap(
    experiences.map((experience) => experience.tourId)
  );

  response.status(200).json({
    success: true,
    message: "Experiences fetched successfully",
    data: {
      experiences: experiences.map((experience) =>
        formatExperience(experience, tourNameById)
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

    const tourNameById = await createTourNameMap([
      experience.tourId,
    ]);

    response.status(200).json({
      success: true,
      message: "Experience fetched successfully",
      data: {
        experience: formatExperience(experience, tourNameById),
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
    await assertTourExists(payload.tourId);

    const experience = await Experience.create(
      createExperiencePayload(payload, "create")
    );
    const tourNameById = await createTourNameMap([
      experience.tourId,
    ]);

    response.status(201).json({
      success: true,
      message: "Experience created successfully",
      data: {
        experience: formatExperience(experience, tourNameById),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Experience already exists");
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
    await assertTourExists(payload.tourId);

    const experience = await Experience.findByIdAndUpdate(
      request.params.id,
      createExperiencePayload(payload, "update"),
      {
        new: true,
        runValidators: true,
      }
    );

    if (!experience) {
      throw new HttpError(404, "Experience not found");
    }

    const tourNameById = await createTourNameMap([
      experience.tourId,
    ]);

    response.status(200).json({
      success: true,
      message: "Experience updated successfully",
      data: {
        experience: formatExperience(experience, tourNameById),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Experience already exists");
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

    const tourNameById = await createTourNameMap([
      experience.tourId,
    ]);

    response.status(200).json({
      success: true,
      message: "Experience deleted successfully",
      data: {
        experience: formatExperience(experience, tourNameById),
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
        attractionPhotoGallery?: Express.Multer.File[];
      }
    | undefined;
  const travellerPhotoGallery = (files?.travellerPhotoGallery || []).map(
    getUploadUrl
  );
  const travellerVideos = (files?.travellerVideos || []).map(getUploadUrl);
  const attractionPhotoGallery = (files?.attractionPhotoGallery || []).map(
    getUploadUrl
  );

  if (
    travellerPhotoGallery.length === 0 &&
    travellerVideos.length === 0 &&
    attractionPhotoGallery.length === 0
  ) {
    throw new HttpError(400, "Please select at least one file to upload");
  }

  response.status(201).json({
    success: true,
    message: "Experience media uploaded successfully",
    data: {
      travellerPhotoGallery,
      travellerVideos,
      attractionPhotoGallery,
    },
  });
}
