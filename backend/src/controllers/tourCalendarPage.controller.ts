import type { Request, Response } from "express";
import { z } from "zod";

import {
  TourCalendarPage,
  type TourCalendarPageDocument,
} from "../models/tourCalendarPage.model";
import { HttpError } from "../utils/httpError";

const tourCalendarPageKey = "tour-calendar";

const festivalPayloadSchema = z.object({
  title: z.string().trim().min(1, "Festival name is required").max(120),
  date: z
    .string()
    .trim()
    .min(1, "Festival date is required")
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Festival date must be valid"
    ),
  description: z.string().trim().max(300).default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const tourCalendarPagePayloadSchema = z.object({
  festivals: z.array(festivalPayloadSchema).max(200).default([]),
});

type TourCalendarPagePayload = z.infer<typeof tourCalendarPagePayloadSchema>;

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

function getSubdocumentId(item: unknown, fallback: string) {
  if (typeof item !== "object" || item === null || !("_id" in item)) {
    return fallback;
  }

  const id = (item as { _id?: unknown })._id;

  if (
    typeof id === "object" &&
    id !== null &&
    "toString" in id &&
    typeof id.toString === "function"
  ) {
    return id.toString();
  }

  return fallback;
}

function sortByDateThenOrder<
  TItem extends { date: Date | string; sortOrder: number; title: string },
>(items: TItem[]) {
  return [...items].sort((left, right) => {
    const dateDifference =
      new Date(left.date).getTime() - new Date(right.date).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    const orderDifference = left.sortOrder - right.sortOrder;

    return orderDifference || left.title.localeCompare(right.title);
  });
}

function formatTourCalendarPage(page: TourCalendarPageDocument) {
  return {
    id: page._id.toString(),
    festivals: sortByDateThenOrder(page.festivals).map((festival, index) => ({
      id: getSubdocumentId(festival, `festival-${index}`),
      title: festival.title,
      date: festival.date,
      description: festival.description,
      sortOrder: festival.sortOrder,
    })),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

async function getOrCreateTourCalendarPage() {
  const page = await TourCalendarPage.findOne({ pageKey: tourCalendarPageKey });

  if (page) {
    return page;
  }

  return TourCalendarPage.create({
    pageKey: tourCalendarPageKey,
    festivals: [],
  });
}

function createFestivalDocuments(payload: TourCalendarPagePayload) {
  return payload.festivals.map((festival, index) => ({
    title: festival.title,
    date: new Date(festival.date),
    description: festival.description,
    sortOrder: festival.sortOrder ?? index,
  }));
}

export async function getTourCalendarPage(
  _request: Request,
  response: Response
): Promise<void> {
  const page = await getOrCreateTourCalendarPage();

  response.status(200).json({
    success: true,
    message: "Tour calendar page fetched successfully",
    data: {
      tourCalendar: formatTourCalendarPage(page),
    },
  });
}

export async function updateTourCalendarPage(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(tourCalendarPagePayloadSchema, request.body);
  const page = await TourCalendarPage.findOneAndUpdate(
    { pageKey: tourCalendarPageKey },
    {
      $set: {
        festivals: createFestivalDocuments(payload),
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );

  if (!page) {
    throw new HttpError(500, "Tour calendar page could not be saved");
  }

  response.status(200).json({
    success: true,
    message: "Tour calendar page updated successfully",
    data: {
      tourCalendar: formatTourCalendarPage(page),
    },
  });
}
