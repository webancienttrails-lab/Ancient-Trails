import type { Request, Response } from "express";
import { z } from "zod";

import { Expert, type ExpertDocument } from "../models/expert.model";
import { HttpError } from "../utils/httpError";

const textField = (max: number) => z.string().trim().max(max).default("");
const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);

const stringListSchema = z
  .array(z.string().trim().min(1).max(300))
  .max(40)
  .default([])
  .transform((values) => Array.from(new Set(values)));

const expertPayloadSchema = z.object({
  expertId: requiredTextField("Expert ID", 40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Expert ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  fullName: requiredTextField("Full name", 120),
  fullBiography: textField(3000),
  expertiseTags: stringListSchema,
  qualifications: stringListSchema,
  languages: stringListSchema,
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

function formatExpert(expert: ExpertDocument) {
  return {
    id: expert._id.toString(),
    expertId: expert.expertId,
    fullName: expert.fullName,
    fullBiography: expert.fullBiography,
    expertiseTags: expert.expertiseTags,
    qualifications: expert.qualifications,
    languages: expert.languages,
    createdAt: expert.createdAt,
    updatedAt: expert.updatedAt,
  };
}

export async function listExperts(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
      { expertId: new RegExp(search, "i") },
      { fullName: new RegExp(search, "i") },
      { fullBiography: new RegExp(search, "i") },
      { expertiseTags: new RegExp(search, "i") },
      { qualifications: new RegExp(search, "i") },
      { languages: new RegExp(search, "i") },
    ];
  }

  const experts = await Expert.find(filters).sort({ createdAt: -1 }).limit(200);

  response.status(200).json({
    success: true,
    message: "Experts fetched successfully",
    data: {
      experts: experts.map(formatExpert),
    },
  });
}

export async function createExpert(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(expertPayloadSchema, request.body);

  try {
    const expert = await Expert.create(payload);

    response.status(201).json({
      success: true,
      message: "Expert created successfully",
      data: {
        expert: formatExpert(expert),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Expert ID already exists");
    }

    throw error;
  }
}

export async function updateExpert(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(expertPayloadSchema, request.body);

  try {
    const expert = await Expert.findByIdAndUpdate(request.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!expert) {
      throw new HttpError(404, "Expert not found");
    }

    response.status(200).json({
      success: true,
      message: "Expert updated successfully",
      data: {
        expert: formatExpert(expert),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Expert ID already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid expert ID");
    }

    throw error;
  }
}

export async function deleteExpert(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const expert = await Expert.findByIdAndDelete(request.params.id);

    if (!expert) {
      throw new HttpError(404, "Expert not found");
    }

    response.status(200).json({
      success: true,
      message: "Expert deleted successfully",
      data: {
        expert: formatExpert(expert),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid expert ID");
    }

    throw error;
  }
}
