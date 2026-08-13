import type { Request, Response } from "express";
import { z } from "zod";

import { Destination } from "../models/destination.model";
import {
  HomePage,
  type HomePageDocument,
  type IHomeTrendingDestination,
  type IHomeUpcomingTour,
} from "../models/homePage.model";
import { Tour } from "../models/tour.model";
import { TourDeparture } from "../models/tourDeparture.model";
import { HttpError } from "../utils/httpError";

const homePageKey = "home";

const defaultMarkerPositions = [
  { markerX: 43.3, markerY: 42.5 },
  { markerX: 41.9, markerY: 52.1 },
  { markerX: 64.1, markerY: 49.7 },
  { markerX: 51.2, markerY: 74.8 },
  { markerX: 58.2, markerY: 56.5 },
  { markerX: 37.2, markerY: 28.2 },
  { markerX: 51.6, markerY: 73.1 },
  { markerX: 49.6, markerY: 69.4 },
];
const keywordMarkerPositions: Array<{
  keywords: string[];
  markerX: number;
  markerY: number;
}> = [
  { keywords: ["amritsar", "punjab"], markerX: 37.2, markerY: 28.2 },
  { keywords: ["leh", "ladakh"], markerX: 47.8, markerY: 21.8 },
  { keywords: ["delhi"], markerX: 45.3, markerY: 36.4 },
  { keywords: ["agra"], markerX: 47.6, markerY: 42.6 },
  { keywords: ["jaipur"], markerX: 43.3, markerY: 42.5 },
  { keywords: ["udaipur"], markerX: 41.9, markerY: 52.1 },
  { keywords: ["ajanta"], markerX: 49.4, markerY: 60.5 },
  { keywords: ["ellora"], markerX: 49.7, markerY: 62.5 },
  { keywords: ["badami"], markerX: 49.6, markerY: 69.4 },
  { keywords: ["hampi"], markerX: 51.2, markerY: 74.8 },
  {
    keywords: ["hoysala", "hoysalas", "belur", "halebidu"],
    markerX: 51.6,
    markerY: 73.1,
  },
  { keywords: ["khajuraho"], markerX: 58.2, markerY: 56.5 },
  { keywords: ["varanasi", "banaras", "kashi"], markerX: 64.1, markerY: 49.7 },
  { keywords: ["bodhgaya", "gaya"], markerX: 63.2, markerY: 53.8 },
  { keywords: ["kolkata", "west bengal"], markerX: 70.1, markerY: 56.2 },
  { keywords: ["puri", "odisha"], markerX: 63.5, markerY: 64.7 },
  { keywords: ["mumbai"], markerX: 43.8, markerY: 63.2 },
  { keywords: ["goa"], markerX: 46.7, markerY: 70.7 },
  { keywords: ["hyderabad"], markerX: 53.7, markerY: 65.8 },
  { keywords: ["bengaluru", "bangalore", "mysore"], markerX: 52.1, markerY: 76.5 },
  { keywords: ["chennai"], markerX: 56.3, markerY: 79.9 },
  { keywords: ["madurai"], markerX: 54.2, markerY: 87.5 },
  { keywords: ["kochi", "cochin", "kerala"], markerX: 49.2, markerY: 83.5 },
  { keywords: ["rajasthan"], markerX: 42.6, markerY: 45.8 },
  { keywords: ["karnataka"], markerX: 51.1, markerY: 72.6 },
  { keywords: ["madhya pradesh"], markerX: 55.2, markerY: 55.2 },
  { keywords: ["uttar pradesh"], markerX: 58.8, markerY: 47.8 },
  { keywords: ["maharashtra"], markerX: 49.2, markerY: 62.6 },
  { keywords: ["gujarat"], markerX: 38.7, markerY: 55.6 },
  { keywords: ["tamil nadu"], markerX: 55.2, markerY: 84.5 },
];

const requiredCodeField = (fieldName: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .max(max)
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
    .regex(
      /^[A-Za-z0-9_-]*$/,
      `${fieldName} can contain letters, numbers, hyphens, and underscores only`
    )
    .default("")
    .transform((value) => value.toUpperCase());
const sortOrderField = z.coerce.number().int().min(0).max(99).default(0);

const homeUpcomingTourPayloadSchema = z.object({
  tourId: requiredCodeField("Tour ID", 40),
  departureId: optionalCodeField("Departure ID", 40),
  sortOrder: sortOrderField,
});

const homeTrendingDestinationPayloadSchema = z.object({
  destinationId: requiredCodeField("Destination ID", 40),
  markerX: z.coerce.number().min(0).max(100).default(50),
  markerY: z.coerce.number().min(0).max(100).default(50),
  sortOrder: sortOrderField,
});

const homePagePayloadSchema = z.object({
  upcomingTours: z.array(homeUpcomingTourPayloadSchema).max(6).default([]),
  trendingDestinations: z
    .array(homeTrendingDestinationPayloadSchema)
    .max(8)
    .default([]),
});

type HomePagePayload = z.infer<typeof homePagePayloadSchema>;

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

function sortBySortOrder<TItem extends { sortOrder: number }>(items: TItem[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
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

function formatHomePage(page: HomePageDocument) {
  return {
    id: page._id.toString(),
    upcomingTours: sortBySortOrder(page.upcomingTours).map((tour, index) => ({
      id: getSubdocumentId(tour, `home-tour-${index}`),
      tourId: tour.tourId,
      departureId: tour.departureId,
      sortOrder: tour.sortOrder,
    })),
    trendingDestinations: sortBySortOrder(page.trendingDestinations).map(
      (destination, index) => ({
        id: getSubdocumentId(destination, `home-destination-${index}`),
        destinationId: destination.destinationId,
        markerX: destination.markerX,
        markerY: destination.markerY,
        sortOrder: destination.sortOrder,
      })
    ),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

function getDefaultDestinationMarker(
  destination: {
    city: string;
    countryRegion: string;
    destinationName: string;
    primaryHeritageFocus: string;
    state: string;
  },
  index: number
) {
  const markerText = [
    destination.destinationName,
    destination.city,
    destination.state,
    destination.countryRegion,
    destination.primaryHeritageFocus,
  ]
    .join(" ")
    .toLowerCase();
  const matchedPosition = keywordMarkerPositions.find((position) =>
    position.keywords.some((keyword) => markerText.includes(keyword))
  );

  if (matchedPosition) {
    return matchedPosition;
  }

  return defaultMarkerPositions[index % defaultMarkerPositions.length];
}

async function createDefaultUpcomingTours(): Promise<IHomeUpcomingTour[]> {
  const departures = await TourDeparture.find({})
    .sort({ departureDate: 1, createdAt: -1 })
    .limit(50);
  const tourIds = new Set<string>();
  const upcomingTours: IHomeUpcomingTour[] = [];

  departures.forEach((departure) => {
    if (upcomingTours.length >= 6 || tourIds.has(departure.tourId)) {
      return;
    }

    tourIds.add(departure.tourId);
    upcomingTours.push({
      departureId: departure.departureId,
      tourId: departure.tourId,
      sortOrder: upcomingTours.length,
    });
  });

  if (upcomingTours.length >= 6) {
    return upcomingTours;
  }

  const tours = await Tour.find({}).sort({ createdAt: -1 }).limit(50);

  tours.forEach((tour) => {
    if (upcomingTours.length >= 6 || tourIds.has(tour.tourId)) {
      return;
    }

    tourIds.add(tour.tourId);
    upcomingTours.push({
      departureId: "",
      tourId: tour.tourId,
      sortOrder: upcomingTours.length,
    });
  });

  return upcomingTours;
}

async function createDefaultTrendingDestinations(): Promise<
  IHomeTrendingDestination[]
> {
  const destinations = await Destination.find({}).sort({ createdAt: -1 }).limit(8);

  return destinations.map((destination, index) => {
    const position = getDefaultDestinationMarker(destination, index);

    return {
      destinationId: destination.destinationId,
      markerX: position.markerX,
      markerY: position.markerY,
      sortOrder: index,
    };
  });
}

async function getOrCreateHomePage(): Promise<HomePageDocument> {
  const existingPage = await HomePage.findOne({ pageKey: homePageKey });

  if (existingPage) {
    return existingPage;
  }

  const [upcomingTours, trendingDestinations] = await Promise.all([
    createDefaultUpcomingTours(),
    createDefaultTrendingDestinations(),
  ]);

  return HomePage.create({
    pageKey: homePageKey,
    upcomingTours,
    trendingDestinations,
  });
}

async function validateUpcomingTours(
  upcomingTours: HomePagePayload["upcomingTours"]
) {
  const errors: Array<{ path: string; message: string }> = [];

  await Promise.all(
    upcomingTours.map(async (tour, index) => {
      const tourExists = await Tour.exists({ tourId: tour.tourId });

      if (!tourExists) {
        errors.push({
          path: `upcomingTours.${index}.tourId`,
          message: `Tour ID ${tour.tourId} does not exist`,
        });
        return;
      }

      if (!tour.departureId) {
        return;
      }

      const departureExists = await TourDeparture.exists({
        departureId: tour.departureId,
        tourId: tour.tourId,
      });

      if (!departureExists) {
        errors.push({
          path: `upcomingTours.${index}.departureId`,
          message: `Departure ID ${tour.departureId} does not belong to ${tour.tourId}`,
        });
      }
    })
  );

  return errors;
}

async function validateTrendingDestinations(
  trendingDestinations: HomePagePayload["trendingDestinations"]
) {
  const errors: Array<{ path: string; message: string }> = [];

  await Promise.all(
    trendingDestinations.map(async (destination, index) => {
      const destinationExists = await Destination.exists({
        destinationId: destination.destinationId,
      });

      if (!destinationExists) {
        errors.push({
          path: `trendingDestinations.${index}.destinationId`,
          message: `Destination ID ${destination.destinationId} does not exist`,
        });
      }
    })
  );

  return errors;
}

async function validateHomePayload(payload: HomePagePayload) {
  const [upcomingErrors, destinationErrors] = await Promise.all([
    validateUpcomingTours(payload.upcomingTours),
    validateTrendingDestinations(payload.trendingDestinations),
  ]);
  const errors = [...upcomingErrors, ...destinationErrors];

  if (errors.length > 0) {
    throw new HttpError(400, "Validation failed", errors);
  }
}

export async function getHomePage(
  _request: Request,
  response: Response
): Promise<void> {
  const page = await getOrCreateHomePage();

  response.status(200).json({
    success: true,
    message: "Home page content fetched successfully",
    data: {
      home: formatHomePage(page),
    },
  });
}

export async function updateHomePage(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(homePagePayloadSchema, request.body);

  await validateHomePayload(payload);

  const page = await HomePage.findOneAndUpdate(
    { pageKey: homePageKey },
    {
      $set: {
        upcomingTours: payload.upcomingTours,
        trendingDestinations: payload.trendingDestinations,
      },
      $setOnInsert: {
        pageKey: homePageKey,
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );

  if (!page) {
    throw new HttpError(500, "Unable to update home page content");
  }

  response.status(200).json({
    success: true,
    message: "Home page content updated successfully",
    data: {
      home: formatHomePage(page),
    },
  });
}
