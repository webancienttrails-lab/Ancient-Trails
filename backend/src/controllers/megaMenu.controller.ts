import type { Request, Response } from "express";
import { z } from "zod";

import { Destination, DestinationType } from "../models/destination.model";
import {
  MegaMenuPage,
  type IMegaMenuReference,
  type IMegaMenuRegion,
  type MegaMenuPageDocument,
} from "../models/megaMenu.model";
import { Tour } from "../models/tour.model";
import { HttpError } from "../utils/httpError";

const megaMenuPageKey = "main";
const megaMenuTourLimit = 4;

const referencePayloadSchema = z.object({
  referenceId: z
    .string()
    .trim()
    .min(1, "Reference ID is required")
    .max(40)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Reference ID can contain letters, numbers, hyphens, and underscores only"
    )
    .transform((value) => value.toUpperCase()),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
});

const regionPayloadSchema = z.object({
  title: z.string().trim().min(1, "Region title is required").max(80),
  description: z.string().trim().max(180).default(""),
  image: z.string().trim().max(300).default(""),
  href: z.string().trim().max(220).default(""),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
});

const megaMenuPayloadSchema = z
  .object({
    destinationIndia: z.array(referencePayloadSchema).max(5).default([]),
    destinationIndiaRegions: z.array(regionPayloadSchema).max(5).default([]),
    destinationInternational: z.array(referencePayloadSchema).max(5).default([]),
    destinationInternationalRegions: z.array(regionPayloadSchema).max(5).default([]),
    destinationTopCities: z.array(referencePayloadSchema).max(8).default([]),
    tourHeritage: z.array(referencePayloadSchema).max(megaMenuTourLimit).default([]),
    tourShortTrails: z.array(referencePayloadSchema).max(megaMenuTourLimit).default([]),
  })
  .refine(
    (payload) =>
      payload.tourHeritage.length + payload.tourShortTrails.length <=
      megaMenuTourLimit,
    {
      message: `Tours Mega Menu can show up to ${megaMenuTourLimit} tour links`,
      path: ["tourHeritage"],
    }
  );

type MegaMenuPayload = z.infer<typeof megaMenuPayloadSchema>;

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

function normalizeRegionValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function joinRegionDestinationNames(names: string[]) {
  const uniqueNames = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean))
  );

  return uniqueNames.reduce((description, destinationName) => {
    const nextDescription = description
      ? `${description}, ${destinationName}`
      : destinationName;

    return nextDescription.length <= 180 ? nextDescription : description;
  }, "");
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

function getTourImage(tour: {
  bannerImage?: string;
  galleryImages?: string[];
  thumbnailImage?: string;
}) {
  return tour.thumbnailImage || tour.bannerImage || tour.galleryImages?.[0] || "";
}

function getDestinationImage(destination: {
  bannerImage?: string;
  galleryImages?: string[];
  thumbnailImage?: string;
}) {
  return (
    destination.thumbnailImage ||
    destination.bannerImage ||
    destination.galleryImages?.[0] ||
    ""
  );
}

async function getOrCreateMegaMenuPage(): Promise<MegaMenuPageDocument> {
  const existingPage = await MegaMenuPage.findOne({ pageKey: megaMenuPageKey });

  if (existingPage) {
    return existingPage;
  }

  return MegaMenuPage.create({
    pageKey: megaMenuPageKey,
    destinationIndia: [],
    destinationIndiaRegions: [],
    destinationInternational: [],
    destinationInternationalRegions: [],
    destinationTopCities: [],
    tourHeritage: [],
    tourShortTrails: [],
  });
}

async function validateReferenceIds({
  destinationIndia,
  destinationInternational,
  destinationTopCities,
  tourHeritage,
  tourShortTrails,
}: MegaMenuPayload) {
  const errors: Array<{ path: string; message: string }> = [];

  async function validateTours(
    items: MegaMenuPayload["tourHeritage"],
    pathPrefix: string
  ) {
    await Promise.all(
      items.map(async (item, index) => {
        const exists = await Tour.exists({ tourId: item.referenceId });

        if (!exists) {
          errors.push({
            path: `${pathPrefix}.${index}.referenceId`,
            message: `Tour ID ${item.referenceId} does not exist`,
          });
        }
      })
    );
  }

  async function validateDestinations(
    items: MegaMenuPayload["destinationIndia"],
    pathPrefix: string
  ) {
    await Promise.all(
      items.map(async (item, index) => {
        const exists = await Destination.exists({
          destinationId: item.referenceId,
        });

        if (!exists) {
          errors.push({
            path: `${pathPrefix}.${index}.referenceId`,
            message: `Destination ID ${item.referenceId} does not exist`,
          });
        }
      })
    );
  }

  await Promise.all([
    validateTours(tourHeritage, "tourHeritage"),
    validateTours(tourShortTrails, "tourShortTrails"),
    validateDestinations(destinationIndia, "destinationIndia"),
    validateDestinations(destinationInternational, "destinationInternational"),
    validateDestinations(destinationTopCities, "destinationTopCities"),
  ]);

  if (errors.length > 0) {
    throw new HttpError(400, "Validation failed", errors);
  }
}

async function formatMegaMenu(page: MegaMenuPageDocument) {
  const tourHeritage = sortBySortOrder(page.tourHeritage).slice(
    0,
    megaMenuTourLimit
  );
  const tourShortTrails = sortBySortOrder(page.tourShortTrails).slice(
    0,
    Math.max(0, megaMenuTourLimit - tourHeritage.length)
  );
  const hasIndiaRegions = (page.destinationIndiaRegions || []).length > 0;
  const hasInternationalRegions =
    (page.destinationInternationalRegions || []).length > 0;
  const destinationRegionTypes = [
    ...(hasIndiaRegions ? [DestinationType.DOMESTIC] : []),
    ...(hasInternationalRegions ? [DestinationType.INTERNATIONAL] : []),
  ];
  const tourIds = Array.from(
    new Set(
      [...tourHeritage, ...tourShortTrails].map((item) => item.referenceId)
    )
  );
  const destinationIds = Array.from(
    new Set(
      [
        ...page.destinationIndia,
        ...page.destinationInternational,
        ...page.destinationTopCities,
      ].map((item) => item.referenceId)
    )
  );
  const destinationFilters = [
    ...(destinationIds.length > 0
      ? [{ destinationId: { $in: destinationIds } }]
      : []),
    ...(destinationRegionTypes.length > 0
      ? [{ destinationType: { $in: destinationRegionTypes } }]
      : []),
  ];

  const [tours, destinations] = await Promise.all([
    tourIds.length > 0 ? Tour.find({ tourId: { $in: tourIds } }) : [],
    destinationFilters.length > 0
      ? Destination.find({ $or: destinationFilters })
      : [],
  ]);
  const toursById = new Map(tours.map((tour) => [tour.tourId, tour]));
  const destinationsById = new Map(
    destinations.map((destination) => [
      destination.destinationId,
      destination,
    ])
  );

  function formatReference(item: IMegaMenuReference, index: number) {
    return {
      id: getSubdocumentId(item, `mega-menu-item-${index}`),
      referenceId: item.referenceId,
      sortOrder: item.sortOrder,
    };
  }

  function formatTourReference(item: IMegaMenuReference, index: number) {
    const tour = toursById.get(item.referenceId);

    return {
      ...formatReference(item, index),
      description: tour?.category || tour?.durationDn || "",
      image: tour ? getTourImage(tour) : "",
      tourId: item.referenceId,
      tourName: tour?.tourName || item.referenceId,
    };
  }

  function formatDestinationReference(
    item: IMegaMenuReference,
    index: number
  ) {
    const destination = destinationsById.get(item.referenceId);

    return {
      ...formatReference(item, index),
      city: destination?.city || "",
      countryRegion: destination?.countryRegion || "",
      description:
        destination?.shortDescription ||
        [destination?.city, destination?.state, destination?.countryRegion]
          .filter(Boolean)
          .join(", "),
      destinationId: item.referenceId,
      destinationName: destination?.destinationName || item.referenceId,
      href: "",
      image: destination ? getDestinationImage(destination) : "",
      state: destination?.state || "",
      title: destination?.destinationName || item.referenceId,
    };
  }

  function getRegionDescription(
    item: IMegaMenuRegion,
    destinationType: DestinationType
  ) {
    if (item.description.trim()) {
      return item.description;
    }

    const regionKey = normalizeRegionValue(item.title);

    if (!regionKey) {
      return "";
    }

    return joinRegionDestinationNames(
      destinations
        .filter((destination) => destination.destinationType === destinationType)
        .filter((destination) =>
          [destination.region, destination.countryRegion].some(
            (value) => normalizeRegionValue(value || "") === regionKey
          )
        )
        .map((destination) => destination.destinationName)
    );
  }

  function formatRegionReference(
    item: IMegaMenuRegion,
    index: number,
    destinationType: DestinationType
  ) {
    return {
      id: getSubdocumentId(item, `mega-menu-region-${index}`),
      city: "",
      countryRegion: "",
      description: getRegionDescription(item, destinationType),
      destinationId: "",
      destinationName: item.title,
      href: item.href,
      image: item.image,
      referenceId: item.title,
      sortOrder: item.sortOrder,
      state: "",
      title: item.title,
    };
  }

  const indiaRegionItems = sortBySortOrder(
    page.destinationIndiaRegions || []
  ).map((item, index) =>
    formatRegionReference(item, index, DestinationType.DOMESTIC)
  );
  const internationalRegionItems = sortBySortOrder(
    page.destinationInternationalRegions || []
  ).map((item, index) =>
    formatRegionReference(item, index, DestinationType.INTERNATIONAL)
  );

  return {
    id: page._id.toString(),
    tourMenu: {
      heritageTours: tourHeritage.map(formatTourReference),
      shortTrails: tourShortTrails.map(formatTourReference),
    },
    destinationMenu: {
      india:
        indiaRegionItems.length > 0
          ? indiaRegionItems
          : sortBySortOrder(page.destinationIndia).map(
              formatDestinationReference
            ),
      international:
        internationalRegionItems.length > 0
          ? internationalRegionItems
          : sortBySortOrder(page.destinationInternational).map(
              formatDestinationReference
            ),
      topCities: sortBySortOrder(page.destinationTopCities).map(
        formatDestinationReference
      ),
    },
    destinationIndiaRegions: indiaRegionItems,
    destinationInternationalRegions: internationalRegionItems,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export async function getMegaMenu(
  _request: Request,
  response: Response
): Promise<void> {
  const page = await getOrCreateMegaMenuPage();

  response.status(200).json({
    success: true,
    message: "Mega menu content fetched successfully",
    data: {
      megaMenu: await formatMegaMenu(page),
    },
  });
}

export async function updateMegaMenu(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(megaMenuPayloadSchema, request.body);

  await validateReferenceIds(payload);

  const page = await MegaMenuPage.findOneAndUpdate(
    { pageKey: megaMenuPageKey },
    {
      $set: payload,
      $setOnInsert: {
        pageKey: megaMenuPageKey,
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );

  if (!page) {
    throw new HttpError(500, "Unable to update mega menu content");
  }

  response.status(200).json({
    success: true,
    message: "Mega menu content updated successfully",
    data: {
      megaMenu: await formatMegaMenu(page),
    },
  });
}
