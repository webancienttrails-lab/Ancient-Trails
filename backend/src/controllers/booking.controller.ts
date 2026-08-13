import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import {
  Booking,
  type BookingDocument,
  type IBookingChildDetails,
  type IBookingGuestDetails,
} from "../models/booking.model";
import { Tour } from "../models/tour.model";
import {
  TourDeparture,
  type TourDepartureDocument,
} from "../models/tourDeparture.model";
import { generateAccommodationOptions } from "../services/accommodation/accommodation.generator";
import type { Traveller } from "../services/accommodation/accommodation.types";
import { createPricingSnapshot } from "../services/booking/booking.snapshot";
import type { PricedDeparture } from "../services/departure/departure.types";
import { validateDepartureForBooking } from "../services/departure/departure.validation";
import { calculateAgeOnDate } from "../services/accommodation/accommodation.validation";
import { HttpError } from "../utils/httpError";

const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);

const requiredCodeField = (fieldName: string, max: number) =>
  requiredTextField(fieldName, max)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      `${fieldName} can contain letters, numbers, hyphens, and underscores only`
    )
    .transform((value) => value.toUpperCase());

const nonNegativeIntegerField = (fieldName: string, max: number) =>
  z.coerce
    .number()
    .int(`${fieldName} must be a whole number`)
    .min(0, `${fieldName} cannot be negative`)
    .max(max);

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

const childAgeSchema = z.coerce
  .number()
  .int("Child age must be a whole number")
  .min(0, "Child age cannot be negative")
  .max(17, "Child age must be 17 or below");

const guestDetailsPayloadSchema = z.object({
  title: requiredTextField("Title", 20),
  firstName: requiredTextField("First name", 80),
  lastName: requiredTextField("Last name", 80),
  countryCode: requiredTextField("Country code", 8).regex(
    /^\+[0-9]{1,4}$/,
    "Country code must start with + and contain digits only"
  ),
  mobileNumber: requiredTextField("Mobile number", 20).regex(
    /^[0-9\s-]{5,20}$/,
    "Mobile number can contain digits, spaces, and hyphens only"
  ),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Email must be valid")
    .max(160)
    .transform((value) => value.toLowerCase()),
  dateOfBirth: requiredDateField("Date of birth"),
  gender: requiredTextField("Gender", 40),
  address: requiredTextField("Address", 500),
});

const childDetailsPayloadSchema = z.object({
  age: childAgeSchema,
});

const accommodationDetailsPayloadSchema = z.object({
  singleOccupancyOneRoom: nonNegativeIntegerField(
    "Single occupancy with 1 room",
    100
  ),
  singleOccupancyTwoRooms: nonNegativeIntegerField(
    "Single occupancy with 2 rooms",
    100
  ),
  doubleOccupancy: nonNegativeIntegerField("Double occupancy", 100),
  twinOccupancy: nonNegativeIntegerField("Twin occupancy", 100),
  tripleOccupancy: nonNegativeIntegerField("Triple occupancy", 100),
});

const travellerPayloadSchema = z.object({
  id: requiredTextField("Traveller ID", 80),
  type: z.enum(["adult", "child"]),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  dateOfBirth: z.string().trim().optional(),
  ageOnDeparture: z.coerce.number().int().min(0).max(120).optional(),
});

const bookingPayloadSchema = z
  .object({
    tourId: requiredCodeField("Tour ID", 40),
    departureId: requiredCodeField("Departure ID", 40).optional(),
    selectedAccommodationOptionId: z.string().trim().max(200).optional(),
    totalGuest: nonNegativeIntegerField("Total guest", 1000).min(
      1,
      "Total guest must be at least 1"
    ),
    adultCount: nonNegativeIntegerField("Adult count", 1000),
    childCount: nonNegativeIntegerField("Child count", 1000),
    childDetails: z.array(childDetailsPayloadSchema).max(1000).default([]),
    guestDetails: z.array(guestDetailsPayloadSchema).max(1000).default([]),
    travellers: z.array(travellerPayloadSchema).max(25).default([]),
    accommodationDetails: accommodationDetailsPayloadSchema.default({
      singleOccupancyOneRoom: 0,
      singleOccupancyTwoRooms: 0,
      doubleOccupancy: 0,
      twinOccupancy: 0,
      tripleOccupancy: 0,
    }),
    gstPercentage: z.coerce.number().min(0).max(100).default(0),
  })
  .superRefine((payload, context) => {
    if (payload.totalGuest !== payload.adultCount + payload.childCount) {
      context.addIssue({
        code: "custom",
        path: ["totalGuest"],
        message: "Total guest must match adult count plus child count",
      });
    }

    if (payload.guestDetails.length !== payload.totalGuest) {
      context.addIssue({
        code: "custom",
        path: ["guestDetails"],
        message: "Guest details count must match total guest",
      });
    }

    if (payload.childDetails.length !== payload.childCount) {
      context.addIssue({
        code: "custom",
        path: ["childDetails"],
        message: "Child details count must match child count",
      });
    }

    if (payload.travellers.length > 0) {
      const adultCount = payload.travellers.filter(
        (traveller) => traveller.type === "adult"
      ).length;
      const childCount = payload.travellers.filter(
        (traveller) => traveller.type === "child"
      ).length;
      const travellerIds = new Set(
        payload.travellers.map((traveller) => traveller.id)
      );

      if (payload.travellers.length !== payload.totalGuest) {
        context.addIssue({
          code: "custom",
          path: ["travellers"],
          message: "Traveller count must match total guest",
        });
      }

      if (travellerIds.size !== payload.travellers.length) {
        context.addIssue({
          code: "custom",
          path: ["travellers"],
          message: "Traveller IDs must be unique",
        });
      }

      if (adultCount !== payload.adultCount || childCount !== payload.childCount) {
        context.addIssue({
          code: "custom",
          path: ["travellers"],
          message: "Traveller types must match adult and child counts",
        });
      }

      payload.travellers.forEach((traveller, index) => {
        if (traveller.type === "child" && !traveller.dateOfBirth) {
          context.addIssue({
            code: "custom",
            path: ["travellers", index, "dateOfBirth"],
            message: "Date of birth is required for each child",
          });
        }
      });
    }

    if (
      payload.departureId &&
      payload.travellers.length > 0 &&
      !payload.selectedAccommodationOptionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedAccommodationOptionId"],
        message: "Accommodation option is required",
      });
    }
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

function isCastError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "CastError"
  );
}

function formatGuestDetails(guest: IBookingGuestDetails) {
  return {
    title: guest.title,
    firstName: guest.firstName,
    lastName: guest.lastName,
    countryCode: guest.countryCode,
    mobileNumber: guest.mobileNumber,
    email: guest.email,
    dateOfBirth: guest.dateOfBirth,
    gender: guest.gender,
    address: guest.address,
  };
}

function formatChildDetails(child: IBookingChildDetails) {
  return {
    age: child.age,
  };
}

function formatBooking(booking: BookingDocument) {
  return {
    id: booking._id.toString(),
    tourId: booking.tourId,
    departureId: booking.departureId || "",
    selectedAccommodationOptionId: booking.selectedAccommodationOptionId || "",
    totalGuest: booking.totalGuest,
    adultCount: booking.adultCount,
    childCount: booking.childCount,
    childDetails: booking.childDetails.map(formatChildDetails),
    guestDetails: booking.guestDetails.map(formatGuestDetails),
    travellers: booking.travellers.map((traveller) => ({
      id: traveller.id,
      type: traveller.type,
      firstName: traveller.firstName,
      lastName: traveller.lastName,
      dateOfBirth: traveller.dateOfBirth,
      ageOnDeparture: traveller.ageOnDeparture,
    })),
    accommodationDetails: {
      singleOccupancyOneRoom:
        booking.accommodationDetails.singleOccupancyOneRoom,
      singleOccupancyTwoRooms:
        booking.accommodationDetails.singleOccupancyTwoRooms,
      doubleOccupancy: booking.accommodationDetails.doubleOccupancy,
      twinOccupancy: booking.accommodationDetails.twinOccupancy,
      tripleOccupancy: booking.accommodationDetails.tripleOccupancy,
    },
    pricingSnapshot: booking.pricingSnapshot,
    subtotal: booking.subtotal,
    gstPercentage: booking.gstPercentage,
    gstAmount: booking.gstAmount,
    grandTotal: booking.grandTotal,
    depositAmount: booking.depositAmount,
    balanceAmount: booking.balanceAmount,
    balanceDueDate: booking.balanceDueDate,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

async function assertTourExists(tourId: string): Promise<void> {
  const tourExists = await Tour.exists({ tourId });

  if (!tourExists) {
    throw new HttpError(400, `Tour ID ${tourId} does not exist`);
  }
}

function toPricedDeparture(departure: TourDepartureDocument): PricedDeparture {
  return {
    departureId: departure.departureId,
    tourId: departure.tourId,
    destinationId: departure.destinationId,
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
    roomPolicy: departure.roomPolicy,
  };
}

function toAccommodationTravellers(
  travellers: z.infer<typeof travellerPayloadSchema>[]
): Traveller[] {
  return travellers.map((traveller) => ({
    id: traveller.id,
    type: traveller.type,
    firstName: traveller.firstName,
    lastName: traveller.lastName,
    dateOfBirth: traveller.dateOfBirth,
    ageOnDeparture: traveller.ageOnDeparture,
  }));
}

function toBookingTravellers(
  travellers: z.infer<typeof travellerPayloadSchema>[],
  departure: PricedDeparture
) {
  return travellers.map((traveller) => {
    const dateOfBirth = traveller.dateOfBirth
      ? new Date(traveller.dateOfBirth)
      : undefined;
    const ageOnDeparture =
      traveller.type === "child" && dateOfBirth && departure.departureDate
        ? calculateAgeOnDate(dateOfBirth, departure.departureDate)
        : traveller.ageOnDeparture;

    return {
      id: traveller.id,
      type: traveller.type,
      firstName: traveller.firstName,
      lastName: traveller.lastName,
      dateOfBirth,
      ageOnDeparture,
    };
  });
}

async function createSnapshotPayload(
  payload: z.infer<typeof bookingPayloadSchema>
) {
  if (
    !payload.departureId ||
    !payload.selectedAccommodationOptionId ||
    payload.travellers.length === 0
  ) {
    return null;
  }

  const departure = await TourDeparture.findOne({
    departureId: payload.departureId,
  });

  if (!departure) {
    throw new HttpError(400, `Departure ID ${payload.departureId} does not exist`);
  }

  const pricedDeparture = toPricedDeparture(departure);
  const departureValidation = validateDepartureForBooking(
    pricedDeparture,
    payload.totalGuest
  );

  if (!departureValidation.isValid) {
    throw new HttpError(400, departureValidation.errors[0], departureValidation.errors);
  }

  const options = generateAccommodationOptions({
    travellers: toAccommodationTravellers(payload.travellers),
    departure: pricedDeparture,
    childPricingRules: pricedDeparture.childPricingRules,
    roomPolicy: pricedDeparture.roomPolicy,
  });
  const selectedAccommodationOption = options.find(
    (option) => option.id === payload.selectedAccommodationOptionId
  );

  if (!selectedAccommodationOption) {
    throw new HttpError(400, "Selected accommodation option is no longer available");
  }

  const pricingSnapshot = createPricingSnapshot({
    accommodationOption: selectedAccommodationOption,
    departure: pricedDeparture,
    gstPercentage: payload.gstPercentage,
  });

  return {
    departure,
    pricingSnapshot,
    travellers: toBookingTravellers(payload.travellers, pricedDeparture),
  };
}

export async function listBookings(
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
      { "guestDetails.firstName": new RegExp(search, "i") },
      { "guestDetails.lastName": new RegExp(search, "i") },
      { "guestDetails.email": new RegExp(search, "i") },
      { "guestDetails.mobileNumber": new RegExp(search, "i") },
      { "guestDetails.countryCode": new RegExp(search, "i") },
      { "guestDetails.gender": new RegExp(search, "i") },
    ];
  }

  if (tourId) {
    filters.tourId = tourId;
  }

  const bookings = await Booking.find(filters)
    .sort({ createdAt: -1 })
    .limit(300);

  response.status(200).json({
    success: true,
    message: "Bookings fetched successfully",
    data: {
      bookings: bookings.map(formatBooking),
    },
  });
}

export async function createBooking(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(bookingPayloadSchema, request.body);

  await assertTourExists(payload.tourId);

  const snapshotPayload = await createSnapshotPayload(payload);
  let booking!: BookingDocument;

  if (snapshotPayload) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const updatedDeparture = await TourDeparture.findOneAndUpdate(
          {
            departureId: payload.departureId,
            seatsAvailable: { $gte: payload.totalGuest },
            status: "scheduled",
          },
          {
            $inc: {
              seatsAvailable: -payload.totalGuest,
            },
          },
          {
            new: true,
            session,
          }
        );

        if (!updatedDeparture) {
          throw new HttpError(
            409,
            "Requested travellers exceed available seats."
          );
        }

        const createdBookings = await Booking.create(
          [
            {
              ...payload,
              travellers: snapshotPayload.travellers,
              pricingSnapshot: snapshotPayload.pricingSnapshot,
              subtotal: snapshotPayload.pricingSnapshot.subtotal,
              gstPercentage: snapshotPayload.pricingSnapshot.gstPercentage,
              gstAmount: snapshotPayload.pricingSnapshot.gstAmount,
              grandTotal: snapshotPayload.pricingSnapshot.grandTotal,
              depositAmount: snapshotPayload.pricingSnapshot.depositAmount,
              balanceAmount: snapshotPayload.pricingSnapshot.balanceAmount,
              balanceDueDate: snapshotPayload.pricingSnapshot.balanceDueDate,
            },
          ],
          {
            session,
          }
        );

        booking = createdBookings[0];
      });
    } finally {
      await session.endSession();
    }
  } else {
    booking = await Booking.create(payload);
  }

  response.status(201).json({
    success: true,
    message: "Booking created successfully",
    data: {
      booking: formatBooking(booking),
    },
  });
}

export async function updateBooking(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(bookingPayloadSchema, request.body);

  try {
    await assertTourExists(payload.tourId);
    const snapshotPayload = await createSnapshotPayload(payload);
    const updatePayload = snapshotPayload
      ? {
          ...payload,
          travellers: snapshotPayload.travellers,
          pricingSnapshot: snapshotPayload.pricingSnapshot,
          subtotal: snapshotPayload.pricingSnapshot.subtotal,
          gstPercentage: snapshotPayload.pricingSnapshot.gstPercentage,
          gstAmount: snapshotPayload.pricingSnapshot.gstAmount,
          grandTotal: snapshotPayload.pricingSnapshot.grandTotal,
          depositAmount: snapshotPayload.pricingSnapshot.depositAmount,
          balanceAmount: snapshotPayload.pricingSnapshot.balanceAmount,
          balanceDueDate: snapshotPayload.pricingSnapshot.balanceDueDate,
        }
      : payload;

    const booking = await Booking.findByIdAndUpdate(
      request.params.id,
      updatePayload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    response.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: {
        booking: formatBooking(booking),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function deleteBooking(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findByIdAndDelete(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    response.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: {
        booking: formatBooking(booking),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}
