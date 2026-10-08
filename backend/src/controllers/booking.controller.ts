import crypto from "node:crypto";

import type { Request, Response } from "express";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { z } from "zod";

import {
  Booking,
  type BookingDocument,
  type IBookingChildDetails,
  type IBookingGuestDetails,
} from "../models/booking.model";
import {
  BookingBalancePaymentSession,
  type BookingBalancePaymentSessionDocument,
} from "../models/bookingBalancePaymentSession.model";
import {
  BookingPaymentSession,
  type BookingDraft,
  type BookingPaymentSessionDocument,
} from "../models/bookingPaymentSession.model";
import {
  Destination,
  type DestinationDocument,
} from "../models/destination.model";
import { Expert, type ExpertDocument } from "../models/expert.model";
import { Tour, type TourDocument } from "../models/tour.model";
import {
  TourDeparture,
  type TourDepartureDocument,
} from "../models/tourDeparture.model";
import {
  User,
  UserRole,
  UserStatus,
  type UserDocument,
} from "../models/user.model";
import { generateOccupancyOptions } from "../services/accommodation/accommodation.generator";
import { createPricingSnapshot } from "../services/booking/booking.snapshot";
import type { PricedDeparture } from "../services/departure/departure.types";
import { validateDepartureForBooking } from "../services/departure/departure.validation";
import { calculateAgeOnDate } from "../services/accommodation/accommodation.validation";
import {
  sendBookingAlertEmail,
  sendBookingConfirmationEmail,
  sendBookingRecoveryEmail,
  type BookingConfirmationEmailPayload,
} from "../services/booking-confirmation-email.service";
import {
  sendBookingConfirmationWhatsapp,
  sendBookingRecoveryWhatsapp,
} from "../services/msg91-whatsapp.service";
import { HttpError } from "../utils/httpError";
import { verifyAuthToken } from "../utils/jwt";

const PAYMENT_CURRENCY = "INR";
const SEAT_HOLD_MINUTES = Number(process.env.BOOKING_SEAT_HOLD_MINUTES || 15);
const RECOVERY_EXPIRY_HOURS = Number(
  process.env.BOOKING_RECOVERY_EXPIRY_HOURS || 48
);
const RECOVERY_REMINDER_MINUTES = Number(
  process.env.BOOKING_RECOVERY_REMINDER_MINUTES || 60
);

const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);

const optionalTextField = (max: number) => z.string().trim().max(max).default("");

const optionalEmailField = z
  .string()
  .trim()
  .max(160)
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "Email must be valid",
  })
  .transform((value) => value.toLowerCase())
  .default("");

const optionalCountryCodeField = z
  .string()
  .trim()
  .max(8)
  .refine((value) => !value || /^\+[0-9]{1,4}$/.test(value), {
    message: "Country code must start with + and contain digits only",
  })
  .default("");

const optionalMobileNumberField = z
  .string()
  .trim()
  .max(20)
  .refine((value) => !value || /^[0-9\s-]{5,20}$/.test(value), {
    message: "Mobile number can contain digits, spaces, and hyphens only",
  })
  .default("");

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
  emergencyContactName: optionalTextField(120),
  emergencyContactMobileNumber: optionalMobileNumberField,
  dateOfBirth: requiredDateField("Date of birth"),
  gender: requiredTextField("Gender", 40),
  address: requiredTextField("Address", 500),
  panNumber: optionalTextField(20),
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

const adminAccommodationOptionsPayloadSchema = z.object({
  departureId: requiredCodeField("Departure ID", 40),
  adultCount: nonNegativeIntegerField("Adult count", 25).min(
    1,
    "At least one adult is required"
  ),
  childDetails: z.array(childDetailsPayloadSchema).max(25).default([]),
  gstPercentage: z.coerce.number().min(0).max(100).default(0),
});

const travellerPayloadSchema = z.object({
  id: requiredTextField("Traveller ID", 80),
  type: z.enum(["adult", "child"]),
  title: optionalTextField(20),
  firstName: optionalTextField(80),
  lastName: optionalTextField(80),
  countryCode: optionalCountryCodeField,
  mobileNumber: optionalMobileNumberField,
  email: optionalEmailField,
  emergencyContactName: optionalTextField(120),
  emergencyContactMobileNumber: optionalMobileNumberField,
  dateOfBirth: z.string().trim().optional(),
  gender: optionalTextField(40),
  address: optionalTextField(500),
  panNumber: optionalTextField(20),
  ageOnDeparture: z.coerce.number().int().min(0).max(120).optional(),
});

const bookingPayloadSchema = z
  .object({
    tourId: requiredCodeField("Tour ID", 40),
    departureId: requiredCodeField("Departure ID", 40).optional(),
    selectedAccommodationOptionId: z.string().trim().max(200).optional(),
    paymentOption: z.enum(["advance", "full"]).default("advance"),
    paymentMethod: z.enum(["cash", "cheque", "neft"]).optional(),
    amountPaid: z.coerce.number().min(0).max(1000000000).optional(),
    totalGuest: nonNegativeIntegerField("Total guest", 1000).min(
      1,
      "Total guest must be at least 1"
    ),
    adultCount: nonNegativeIntegerField("Adult count", 1000),
    childCount: nonNegativeIntegerField("Child count", 1000),
    childDetails: z.array(childDetailsPayloadSchema).max(1000).default([]),
    guestDetails: z.array(guestDetailsPayloadSchema).max(1000).default([]),
    travellers: z.array(travellerPayloadSchema).max(25).default([]),
    whatsappMarketingConsent: z.boolean().default(true),
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

const paymentVerificationPayloadSchema = z.object({
  razorpay_order_id: requiredTextField("Razorpay order ID", 120),
  razorpay_payment_id: requiredTextField("Razorpay payment ID", 120),
  razorpay_signature: requiredTextField("Razorpay signature", 256),
});

const paymentCancellationPayloadSchema = z.object({
  orderId: requiredTextField("Razorpay order ID", 120),
});

const recoveryTokenQuerySchema = z.object({
  token: requiredTextField("Recovery token", 128),
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

function getBearerToken(request: Request): string {
  const authorizationHeader = request.headers.authorization;
  const [scheme, token] = authorizationHeader?.split(" ") || [];

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Please sign in to continue");
  }

  return token;
}

async function getAuthenticatedTraveller(
  request: Request
): Promise<UserDocument> {
  const authPayload = verifyAuthToken(getBearerToken(request));

  if (!authPayload.roles.includes(UserRole.TRAVELLER)) {
    throw new HttpError(403, "Traveller access is required");
  }

  const traveller = await User.findById(authPayload.userId);

  if (
    !traveller ||
    traveller.status !== UserStatus.ACTIVE ||
    !traveller.roles.includes(UserRole.TRAVELLER)
  ) {
    throw new HttpError(403, "Traveller access is required");
  }

  return traveller;
}

function createLooseDigitsRegex(value: string): RegExp {
  return new RegExp(`^\\D*${value.split("").join("\\D*")}\\D*$`);
}

function getMobileSearchValues(value: string | undefined): string[] {
  const digits = (value || "").replace(/\D/g, "");
  const values = new Set<string>();

  if (digits) {
    values.add(digits);
  }

  if (digits.length > 10) {
    values.add(digits.slice(-10));
  }

  return Array.from(values);
}

function createTravellerBookingFilters(traveller: UserDocument) {
  const filters: Array<Record<string, unknown>> = [];
  const email = traveller.email?.trim().toLowerCase();

  if (email) {
    filters.push({ "guestDetails.email": email });
  }

  getMobileSearchValues(traveller.mobileNumber).forEach((mobileNumber) => {
    filters.push({
      "guestDetails.mobileNumber": createLooseDigitsRegex(mobileNumber),
    });
  });

  if (filters.length === 0) {
    throw new HttpError(400, "Traveller profile is missing contact details");
  }

  return {
    $or: filters,
  };
}

function createPaidBookingFilter(): Record<string, unknown> {
  return {
    amountPaid: { $gt: 0 },
    paymentStatus: "paid",
  };
}

function shouldRestoreDeletedBookingSeats(booking: BookingDocument) {
  return (
    Boolean(booking.departureId) &&
    ((booking.paymentStatus === "paid" && booking.totalGuest > 0) ||
      ((booking.heldSeatCount || 0) > 0 &&
        Boolean(booking.holdExpiresAt) &&
        booking.holdExpiresAt!.getTime() > Date.now()))
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
    emergencyContactName: guest.emergencyContactName || "",
    emergencyContactMobileNumber: guest.emergencyContactMobileNumber || "",
    dateOfBirth: guest.dateOfBirth,
    gender: guest.gender,
    address: guest.address,
    panNumber: guest.panNumber || "",
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
    bookingReference:
      booking.bookingReference || getBookingReference(booking),
    bookingStatus:
      booking.bookingStatus ||
      (booking.paymentStatus === "paid" ? "confirmed" : "payment_pending"),
    tourId: booking.tourId,
    departureId: booking.departureId || "",
    selectedAccommodationOptionId: booking.selectedAccommodationOptionId || "",
    paymentOption: booking.paymentOption || "advance",
    totalGuest: booking.totalGuest,
    adultCount: booking.adultCount,
    childCount: booking.childCount,
    childDetails: booking.childDetails.map(formatChildDetails),
    guestDetails: booking.guestDetails.map(formatGuestDetails),
    travellers: booking.travellers.map((traveller) => ({
      id: traveller.id,
      type: traveller.type,
      title: traveller.title,
      firstName: traveller.firstName,
      lastName: traveller.lastName,
      countryCode: traveller.countryCode,
      mobileNumber: traveller.mobileNumber,
      email: traveller.email,
      emergencyContactName: traveller.emergencyContactName,
      emergencyContactMobileNumber: traveller.emergencyContactMobileNumber,
      dateOfBirth: traveller.dateOfBirth,
      gender: traveller.gender,
      address: traveller.address,
      panNumber: traveller.panNumber,
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
    paymentStatus: booking.paymentStatus || "pending",
    paymentMethod: booking.paymentMethod || "",
    paymentProvider: booking.paymentProvider || "",
    paymentOrderId: booking.paymentOrderId || "",
    paymentId: booking.paymentId || "",
    paymentCurrency: booking.paymentCurrency || "",
    amountPaid: booking.amountPaid || 0,
    paymentCapturedAt: booking.paymentCapturedAt,
    heldSeatCount: booking.heldSeatCount || 0,
    holdExpiresAt: booking.holdExpiresAt || null,
    recoveryExpiresAt: booking.recoveryExpiresAt || null,
    recoveryUrl: getRecoveryUrl(booking),
    recoveryEmailStatus: booking.recoveryEmailStatus || "pending",
    whatsappMarketingConsent: booking.whatsappMarketingConsent !== false,
    whatsappRecoveryStatus: booking.whatsappRecoveryStatus || "pending",
    recoveryReminderCount: booking.recoveryReminderCount || 0,
    archivedAt: booking.archivedAt || null,
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
      title: traveller.title,
      firstName: traveller.firstName,
      lastName: traveller.lastName,
      countryCode: traveller.countryCode,
      mobileNumber: traveller.mobileNumber,
      email: traveller.email,
      emergencyContactName: traveller.emergencyContactName,
      emergencyContactMobileNumber: traveller.emergencyContactMobileNumber,
      dateOfBirth,
      gender: traveller.gender,
      address: traveller.address,
      panNumber: traveller.panNumber,
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

  const options = generateOccupancyOptions({
    adults: payload.adultCount,
    children: payload.travellers
      .filter((traveller) => traveller.type === "child")
      .map((traveller) => ({
        id: traveller.id,
        age: traveller.ageOnDeparture,
        dateOfBirth: traveller.dateOfBirth,
      })),
    selectedDeparture: pricedDeparture,
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

type BookingPayload = z.infer<typeof bookingPayloadSchema>;
type BookingSnapshotPayload = Awaited<ReturnType<typeof createSnapshotPayload>>;
const scheduledDepartureStatusFilter = {
  $or: [
    { status: "scheduled" },
    { status: { $exists: false } },
    { status: "" },
    { status: null },
  ],
};

function createScheduledDepartureReservationFilter(
  departureId: string | undefined,
  totalGuest: number
): Record<string, unknown> {
  return {
    departureId,
    seatsAvailable: { $gte: totalGuest },
    ...scheduledDepartureStatusFilter,
  };
}

function createBookingDraft(
  payload: BookingPayload,
  snapshotPayload: BookingSnapshotPayload
): BookingDraft {
  const bookingPayload = payload;

  if (!snapshotPayload) {
    return {
      ...bookingPayload,
      travellers: bookingPayload.travellers.map((traveller) => ({
        ...traveller,
        dateOfBirth: traveller.dateOfBirth
          ? new Date(traveller.dateOfBirth)
          : undefined,
      })),
    };
  }

  return {
    ...bookingPayload,
    travellers: snapshotPayload.travellers,
    pricingSnapshot: snapshotPayload.pricingSnapshot,
    subtotal: snapshotPayload.pricingSnapshot.subtotal,
    gstPercentage: snapshotPayload.pricingSnapshot.gstPercentage,
    gstAmount: snapshotPayload.pricingSnapshot.gstAmount,
    grandTotal: snapshotPayload.pricingSnapshot.grandTotal,
    depositAmount: snapshotPayload.pricingSnapshot.depositAmount,
    balanceAmount: snapshotPayload.pricingSnapshot.balanceAmount,
    balanceDueDate: snapshotPayload.pricingSnapshot.balanceDueDate,
  };
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new HttpError(500, "Razorpay credentials are not configured");
  }

  return {
    keyId,
    keySecret,
  };
}

function createRazorpayClient() {
  const { keyId, keySecret } = getRazorpayCredentials();

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function getPaymentAmountRupees(
  bookingDraft: BookingDraft,
  paymentOption: BookingPayload["paymentOption"]
) {
  const depositAmount = bookingDraft.depositAmount || 0;
  const grandTotal = bookingDraft.grandTotal || 0;
  const amount =
    paymentOption === "full"
      ? grandTotal
      : depositAmount > 0
        ? depositAmount
        : grandTotal;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Payment amount could not be calculated");
  }

  return Math.round(amount);
}

function toPaymentAmount(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(Number(value)));
}

function getBookingDraftTotalAmount(bookingDraft: BookingDraft) {
  return toPaymentAmount(
    bookingDraft.grandTotal ||
      bookingDraft.pricingSnapshot?.grandTotal ||
      bookingDraft.subtotal ||
      0
  );
}

function getAdminOfflineAmountPaid(bookingDraft: BookingDraft) {
  const totalAmount = getBookingDraftTotalAmount(bookingDraft);

  if (bookingDraft.paymentOption === "full" && totalAmount > 0) {
    return totalAmount;
  }

  if (typeof bookingDraft.amountPaid === "number" && bookingDraft.amountPaid > 0) {
    const amountPaid = toPaymentAmount(bookingDraft.amountPaid);

    return totalAmount > 0 ? Math.min(amountPaid, totalAmount) : amountPaid;
  }

  return toPaymentAmount(bookingDraft.depositAmount || totalAmount);
}

function applyAdminOfflinePaymentToDraft(
  bookingDraft: BookingDraft
): BookingDraft {
  const totalAmount = getBookingDraftTotalAmount(bookingDraft);
  const amountPaid = getAdminOfflineAmountPaid(bookingDraft);
  const balanceAmount =
    totalAmount > 0
      ? Math.max(0, totalAmount - amountPaid)
      : toPaymentAmount(bookingDraft.balanceAmount);

  return {
    ...bookingDraft,
    amountPaid,
    balanceAmount,
    balanceDueDate: balanceAmount > 0 ? bookingDraft.balanceDueDate : null,
  };
}

function createReceipt() {
  return `AT${Date.now().toString(36)}${crypto
    .randomBytes(5)
    .toString("hex")}`.slice(0, 40);
}

async function createReservedBookingForPayment({
  amount,
  amountRupees,
  bookingDraft,
  orderId,
  pendingBookingKey,
  receipt,
}: {
  amount: number;
  amountRupees: number;
  bookingDraft: BookingDraft;
  orderId: string;
  pendingBookingKey: string;
  receipt: string;
}): Promise<{
  booking: BookingDocument;
  paymentSession: BookingPaymentSessionDocument;
}> {
  let booking!: BookingDocument;
  let paymentSession!: BookingPaymentSessionDocument;
  const databaseSession = await mongoose.startSession();

  try {
    await databaseSession.withTransaction(async () => {
      const now = new Date();
      const existingBooking = await Booking.findOne({
        pendingBookingKey,
        paymentStatus: { $ne: "paid" },
        bookingStatus: "payment_pending",
        recoveryExpiresAt: { $gt: now },
      }).session(databaseSession);
      const recoveryToken = existingBooking?.recoveryToken || createRecoveryToken();
      const recoveryExpiresAt =
        existingBooking?.recoveryExpiresAt && existingBooking.recoveryExpiresAt > now
          ? existingBooking.recoveryExpiresAt
          : createRecoveryExpiry(now);
      let bookingToHold = existingBooking;

      if (!bookingToHold) {
        const createdBookings = await Booking.create(
          [
            {
              ...bookingDraft,
              amountPaid: 0,
              bookingReference: "",
              bookingStatus: "payment_pending",
              heldSeatCount: 0,
              holdExpiresAt: null,
              paymentCapturedAt: null,
              paymentCurrency: PAYMENT_CURRENCY,
              paymentOrderId: orderId,
              paymentProvider: "razorpay",
              paymentStatus: "pending",
              pendingBookingKey,
              recoveryExpiresAt,
              recoveryToken,
            },
          ],
          {
            session: databaseSession,
          }
        );

        bookingToHold = createdBookings[0];
        bookingToHold.bookingReference = getBookingReference(bookingToHold);
      } else {
        bookingToHold.set({
          ...bookingDraft,
          amountPaid: bookingToHold.amountPaid || 0,
          bookingStatus: "payment_pending",
          paymentCurrency: PAYMENT_CURRENCY,
          paymentOrderId: orderId,
          paymentProvider: "razorpay",
          paymentStatus: "pending",
          recoveryExpiresAt,
          recoveryToken,
        });
      }

      if (!isActiveHold(bookingToHold, now)) {
        if ((bookingToHold.heldSeatCount || 0) > 0 && bookingToHold.departureId) {
          await TourDeparture.updateOne(
            { departureId: bookingToHold.departureId },
            { $inc: { seatsAvailable: bookingToHold.heldSeatCount || 0 } },
            { session: databaseSession }
          );
        }

        const updatedDeparture = await TourDeparture.findOneAndUpdate(
          createScheduledDepartureReservationFilter(
            bookingDraft.departureId,
            bookingDraft.totalGuest
          ),
          {
            $inc: {
              seatsAvailable: -bookingDraft.totalGuest,
            },
          },
          {
            new: true,
            session: databaseSession,
          }
        );

        if (!updatedDeparture) {
          throw new HttpError(409, "Requested travellers exceed available seats.");
        }

        bookingToHold.heldSeatCount = bookingDraft.totalGuest;
      }

      bookingToHold.holdExpiresAt = createHoldExpiry(now);
      await bookingToHold.save({ session: databaseSession });
      booking = bookingToHold;

      const createdPaymentSessions = await BookingPaymentSession.create(
        [
          {
            amount,
            amountRupees,
            bookingDraft,
            bookingId: bookingToHold._id,
            currency: PAYMENT_CURRENCY,
            razorpayOrderId: orderId,
            receipt,
            status: "pending",
          },
        ],
        {
          session: databaseSession,
        }
      );

      paymentSession = createdPaymentSessions[0];
    });
  } finally {
    await databaseSession.endSession();
  }

  return {
    booking,
    paymentSession,
  };
}

async function releasePaymentSessionReservation(
  paymentSession: BookingPaymentSessionDocument,
  failureReason: string,
  sessionStatus: "failed" | "expired" = "failed",
  releaseHeldSeats = false
) {
  if (paymentSession.status !== "pending") {
    return;
  }

  const databaseSession = await mongoose.startSession();

  try {
    await databaseSession.withTransaction(async () => {
      const claimedPaymentSession =
        await BookingPaymentSession.findOneAndUpdate(
          {
            _id: paymentSession._id,
            status: "pending",
          },
          {
            $set: {
              failureReason,
              status: sessionStatus,
            },
          },
          {
            new: true,
            session: databaseSession,
          }
        );

      if (!claimedPaymentSession) {
        return;
      }

      if (!claimedPaymentSession.bookingId) {
        paymentSession.status = claimedPaymentSession.status;
        paymentSession.failureReason = claimedPaymentSession.failureReason;
        return;
      }

      const booking = await Booking.findById(claimedPaymentSession.bookingId).session(
        databaseSession
      );

      if (
        releaseHeldSeats &&
        booking &&
        booking.paymentStatus !== "paid" &&
        (booking.heldSeatCount || 0) > 0 &&
        booking.departureId
      ) {
        await TourDeparture.updateOne(
          { departureId: booking.departureId },
          { $inc: { seatsAvailable: booking.heldSeatCount || 0 } },
          { session: databaseSession }
        );
        booking.heldSeatCount = 0;
        booking.holdExpiresAt = null;
      }

      if (booking && booking.paymentStatus !== "paid") {
        booking.paymentStatus = "failed";
        booking.bookingStatus = "payment_pending";
        await booking.save({ session: databaseSession });
      }

      paymentSession.status = claimedPaymentSession.status;
      paymentSession.failureReason = claimedPaymentSession.failureReason;
    });
  } finally {
    await databaseSession.endSession();
  }
}

async function releaseExpiredHoldForBooking(
  bookingId: mongoose.Types.ObjectId | string,
  databaseSession?: mongoose.ClientSession
) {
  const now = new Date();
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      heldSeatCount: { $gt: 0 },
      holdExpiresAt: { $lte: now },
      paymentStatus: { $ne: "paid" },
    },
    {
      $set: {
        heldSeatCount: 0,
        holdExpiresAt: null,
      },
    },
    {
      new: false,
      session: databaseSession,
    }
  );

  if (!booking || !booking.departureId || (booking.heldSeatCount || 0) <= 0) {
    return false;
  }

  await TourDeparture.updateOne(
    {
      departureId: booking.departureId,
    },
    {
      $inc: {
        seatsAvailable: booking.heldSeatCount || 0,
      },
    },
    {
      session: databaseSession,
    }
  );

  await BookingPaymentSession.updateMany(
    {
      bookingId: booking._id,
      status: "pending",
    },
    {
      $set: {
        failureReason: "Seat hold expired before payment completion",
        status: "expired",
      },
    },
    {
      session: databaseSession,
    }
  );

  return true;
}

async function expireRecoveryForBooking(
  bookingId: mongoose.Types.ObjectId | string,
  databaseSession?: mongoose.ClientSession
) {
  await releaseExpiredHoldForBooking(bookingId, databaseSession);

  const activeHoldBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      heldSeatCount: { $gt: 0 },
      paymentStatus: { $ne: "paid" },
      recoveryExpiresAt: { $lte: new Date() },
    },
    {
      $set: {
        heldSeatCount: 0,
        holdExpiresAt: null,
      },
    },
    {
      new: false,
      session: databaseSession,
    }
  );

  if (
    activeHoldBooking?.departureId &&
    (activeHoldBooking.heldSeatCount || 0) > 0
  ) {
    await TourDeparture.updateOne(
      { departureId: activeHoldBooking.departureId },
      { $inc: { seatsAvailable: activeHoldBooking.heldSeatCount || 0 } },
      { session: databaseSession }
    );
  }

  await Booking.updateOne(
    {
      _id: bookingId,
      bookingStatus: "payment_pending",
      paymentStatus: { $ne: "paid" },
      recoveryExpiresAt: { $lte: new Date() },
    },
    {
      $set: {
        bookingStatus: "expired",
        holdExpiresAt: null,
        recoveryEmailStatus: "disabled",
        whatsappRecoveryStatus: "disabled",
      },
      $unset: {
        pendingBookingKey: "",
      },
    },
    {
      session: databaseSession,
    }
  );
}

export async function runBookingRecoveryMaintenance(): Promise<void> {
  const now = new Date();
  const expiredHoldBookings = await Booking.find({
    heldSeatCount: { $gt: 0 },
    holdExpiresAt: { $lte: now },
    paymentStatus: { $ne: "paid" },
  })
    .select("_id")
    .limit(100);

  for (const booking of expiredHoldBookings) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await releaseExpiredHoldForBooking(booking._id, session);
      });
    } catch (error) {
      console.error("[booking-recovery] Failed to release expired hold", error);
    } finally {
      await session.endSession();
    }
  }

  const expiredRecoveries = await Booking.find({
    bookingStatus: "payment_pending",
    paymentStatus: { $ne: "paid" },
    recoveryExpiresAt: { $lte: now },
  })
    .select("_id")
    .limit(100);

  for (const booking of expiredRecoveries) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await expireRecoveryForBooking(booking._id, session);
      });
    } catch (error) {
      console.error("[booking-recovery] Failed to expire booking", error);
    } finally {
      await session.endSession();
    }
  }

  await sendDueRecoveryEmails();
}

async function releaseSupersededPendingPaymentReservations(payload: BookingPayload) {
  if (!payload.departureId) {
    return;
  }

  const leadGuest = getLeadGuest(payload);
  const contactFilters: Record<string, unknown>[] = [];

  if (leadGuest.email) {
    contactFilters.push({ "bookingDraft.guestDetails.0.email": leadGuest.email });
  }

  if (leadGuest.mobileNumber) {
    contactFilters.push({
      "bookingDraft.guestDetails.0.countryCode": leadGuest.countryCode,
      "bookingDraft.guestDetails.0.mobileNumber": leadGuest.mobileNumber,
    });
  }

  if (contactFilters.length === 0) {
    return;
  }

  const pendingSessions = await BookingPaymentSession.find({
    $or: contactFilters,
    "bookingDraft.departureId": payload.departureId,
    "bookingDraft.tourId": payload.tourId,
    status: "pending",
  }).limit(20);

  for (const paymentSession of pendingSessions) {
    await releasePaymentSessionReservation(
      paymentSession,
      "New payment attempt started",
      "failed",
      true
    );
  }
}

function getLeadGuest(payload: BookingPayload) {
  return payload.guestDetails[0];
}

function normalizeContactValue(value: string | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function createPendingBookingKey(payload: BookingPayload) {
  const leadGuest = getLeadGuest(payload);
  const email = normalizeContactValue(leadGuest.email);
  const phone = `${normalizeContactValue(leadGuest.countryCode)}${normalizeContactValue(
    leadGuest.mobileNumber
  ).replace(/\D/g, "")}`;

  return crypto
    .createHash("sha256")
    .update(
      [
        payload.tourId,
        payload.departureId || "",
        payload.selectedAccommodationOptionId || "",
        payload.paymentOption || "advance",
        payload.totalGuest,
        email,
        phone,
      ].join("|")
    )
    .digest("hex");
}

function getGuestFullName(guest: IBookingGuestDetails | undefined) {
  return [guest?.firstName, guest?.lastName]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function verifyRazorpaySignature({
  keySecret,
  orderId,
  paymentId,
  signature,
}: {
  keySecret: string;
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  if (!/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

async function captureVerifiedPayment({
  amount,
  currency,
  paymentId,
  razorpay,
}: {
  amount: number;
  currency: string;
  paymentId: string;
  razorpay: Razorpay;
}) {
  const payment = await razorpay.payments.fetch(paymentId);

  if (Number(payment.amount) !== amount) {
    throw new HttpError(400, "Payment amount does not match the booking amount");
  }

  if (payment.currency !== currency) {
    throw new HttpError(400, "Payment currency does not match the booking currency");
  }

  if (payment.status === "captured" || payment.captured) {
    return payment;
  }

  if (payment.status !== "authorized") {
    throw new HttpError(400, "Payment has not been authorised by Razorpay");
  }

  const capturedPayment = await razorpay.payments.capture(
    paymentId,
    amount,
    currency
  );

  if (capturedPayment.status !== "captured" && !capturedPayment.captured) {
    throw new HttpError(400, "Payment could not be captured");
  }

  return capturedPayment;
}

function formatPaymentSession(session: BookingPaymentSessionDocument) {
  return {
    id: session._id.toString(),
    orderId: session.razorpayOrderId,
    amount: session.amount,
    amountRupees: session.amountRupees,
    currency: session.currency,
    status: session.status,
  };
}

function formatBalancePaymentSession(
  session: BookingBalancePaymentSessionDocument
) {
  return {
    id: session._id.toString(),
    orderId: session.razorpayOrderId,
    amount: session.amount,
    amountRupees: session.amountRupees,
    currency: session.currency,
    status: session.status,
  };
}

async function getAuthenticatedTravellerPaidBookingById(request: Request) {
  const traveller = await getAuthenticatedTraveller(request);
  const booking = await Booking.findOne({
    _id: request.params.id,
    ...createTravellerBookingFilters(traveller),
    ...createPaidBookingFilter(),
  });

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  return booking;
}

function getBalancePaymentAmountRupees(booking: BookingDocument) {
  const { balanceAmount } = getBookingEmailAmounts(booking);

  return Math.round(balanceAmount);
}

function getBalancePaymentCheckoutPrefill(booking: BookingDocument) {
  const leadGuest = booking.guestDetails[0];

  return {
    contact: leadGuest
      ? `${leadGuest.countryCode}${leadGuest.mobileNumber}`.replace(/[^\d+]/g, "")
      : "",
    email: leadGuest?.email || "",
    name: getGuestFullName(leadGuest),
  };
}

async function createBalancePaymentSession({
  amount,
  amountRupees,
  booking,
  orderId,
  receipt,
}: {
  amount: number;
  amountRupees: number;
  booking: BookingDocument;
  orderId: string;
  receipt: string;
}) {
  await BookingBalancePaymentSession.updateMany(
    {
      bookingId: booking._id,
      status: "pending",
    },
    {
      $set: {
        failureReason: "Superseded by new balance payment attempt",
        status: "expired",
      },
    }
  );

  return BookingBalancePaymentSession.create({
    amount,
    amountRupees,
    bookingId: booking._id,
    currency: PAYMENT_CURRENCY,
    razorpayOrderId: orderId,
    receipt,
    status: "pending",
  });
}

async function applyVerifiedBalancePayment({
  paymentId,
  signature,
  session,
}: {
  paymentId: string;
  signature: string;
  session: BookingBalancePaymentSessionDocument;
}) {
  let updatedBooking: BookingDocument | null = null;
  const databaseSession = await mongoose.startSession();

  try {
    await databaseSession.withTransaction(async () => {
      const claimedSession =
        await BookingBalancePaymentSession.findOneAndUpdate(
          {
            _id: session._id,
            status: "pending",
          },
          {
            $set: {
              paidAt: new Date(),
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
              status: "paid",
            },
          },
          {
            new: true,
            session: databaseSession,
          }
        );

      if (!claimedSession) {
        updatedBooking = await Booking.findById(session.bookingId).session(
          databaseSession
        );
        return;
      }

      const booking = await Booking.findById(claimedSession.bookingId).session(
        databaseSession
      );

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      const { totalAmount } = getBookingEmailAmounts(booking);
      const amountPaid = Math.min(
        Math.round((booking.amountPaid || 0) + claimedSession.amountRupees),
        Math.round(totalAmount)
      );
      const balanceAmount = Math.max(0, Math.round(totalAmount - amountPaid));

      booking.amountPaid = amountPaid;
      booking.balanceAmount = balanceAmount;
      booking.paymentCurrency = claimedSession.currency;
      booking.paymentId = paymentId;
      booking.paymentOrderId = claimedSession.razorpayOrderId;
      booking.paymentProvider = "razorpay";
      booking.paymentStatus = "paid";

      await booking.save({ session: databaseSession });

      updatedBooking = booking;
    });
  } finally {
    await databaseSession.endSession();
  }

  if (!updatedBooking) {
    throw new HttpError(500, "Balance payment could not be applied");
  }

  return updatedBooking;
}

function createConfirmationToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getBookingReference(booking: BookingDocument) {
  return booking.bookingReference || `AT-${booking._id.toString().slice(-6).toUpperCase()}`;
}

function createRecoveryToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createHoldExpiry(now = new Date()) {
  return new Date(now.getTime() + Math.max(1, SEAT_HOLD_MINUTES) * 60 * 1000);
}

function createRecoveryExpiry(now = new Date()) {
  return new Date(now.getTime() + Math.max(1, RECOVERY_EXPIRY_HOURS) * 60 * 60 * 1000);
}

function isActiveHold(booking: BookingDocument, now = new Date()) {
  return (
    (booking.heldSeatCount || 0) > 0 &&
    Boolean(booking.holdExpiresAt) &&
    booking.holdExpiresAt!.getTime() > now.getTime()
  );
}

function isRecoverableBooking(booking: BookingDocument, now = new Date()) {
  return (
    (booking.bookingStatus || "payment_pending") === "payment_pending" &&
    booking.paymentStatus !== "paid" &&
    Boolean(booking.recoveryExpiresAt) &&
    booking.recoveryExpiresAt!.getTime() > now.getTime()
  );
}

function getRecoveryUrl(booking: BookingDocument) {
  const frontendBaseUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");

  if (!frontendBaseUrl || !booking.recoveryToken) {
    return "";
  }

  return `${frontendBaseUrl}/booking/recover/${booking._id.toString()}?token=${encodeURIComponent(
    booking.recoveryToken
  )}`;
}

async function createPaidBookingFromPaymentSession({
  paymentId,
  signature,
  session,
}: {
  paymentId: string;
  signature: string;
  session: BookingPaymentSessionDocument;
}): Promise<BookingDocument> {
  let booking: BookingDocument | null = null;
  const databaseSession = await mongoose.startSession();

  try {
    await databaseSession.withTransaction(async () => {
      booking =
        (session.bookingId
          ? await Booking.findById(session.bookingId).session(databaseSession)
          : null) ||
        (await Booking.findOne({
          paymentOrderId: session.razorpayOrderId,
        }).session(databaseSession));

      if (!booking) {
        throw new HttpError(
          500,
          "Payment booking reservation was not found. Please contact support."
        );
      }

      if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "expired") {
        throw new HttpError(
          400,
          "Payment order is closed. Please start a new payment."
        );
      }

      if (booking.paymentStatus !== "paid") {
        const now = new Date();
        const hasActiveHold = isActiveHold(booking, now);

        if (!hasActiveHold) {
          if ((booking.heldSeatCount || 0) > 0 && booking.departureId) {
            await TourDeparture.updateOne(
              { departureId: booking.departureId },
              { $inc: { seatsAvailable: booking.heldSeatCount || 0 } },
              { session: databaseSession }
            );
          }

          const updatedDeparture = await TourDeparture.findOneAndUpdate(
            createScheduledDepartureReservationFilter(
              booking.departureId,
              booking.totalGuest
            ),
            {
              $inc: {
                seatsAvailable: -booking.totalGuest,
              },
            },
            {
              new: true,
              session: databaseSession,
            }
          );

          if (!updatedDeparture) {
            throw new HttpError(
              409,
              "Seats are no longer available for this departure. Please contact support if your payment was debited."
            );
          }
        }

        const totalAmount = booking.grandTotal || session.bookingDraft.grandTotal || 0;
        const amountPaid = totalAmount > 0
          ? Math.min(session.amountRupees, Math.round(totalAmount))
          : session.amountRupees;

        booking.bookingStatus = "confirmed";
        booking.bookingReference = getBookingReference(booking);
        booking.paymentStatus = "paid";
        booking.paymentProvider = "razorpay";
        booking.paymentOrderId = session.razorpayOrderId;
        booking.paymentId = paymentId;
        booking.paymentSignature = signature;
        booking.paymentCurrency = session.currency;
        booking.amountPaid = amountPaid;
        if (totalAmount > 0) {
          booking.balanceAmount = Math.max(0, Math.round(totalAmount - amountPaid));
        }
        booking.paymentCapturedAt = new Date();
        booking.heldSeatCount = 0;
        booking.holdExpiresAt = null;
        booking.recoveryEmailStatus = "disabled";
        booking.whatsappRecoveryStatus = "disabled";
        booking.confirmationToken =
          booking.confirmationToken || createConfirmationToken();
        booking.pendingBookingKey = undefined;

        await booking.save({ session: databaseSession });
      }

      await BookingPaymentSession.updateOne(
        {
          _id: session._id,
        },
        {
          $set: {
            bookingId: booking._id,
            paidAt: new Date(),
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
            status: "paid",
          },
        },
        {
          session: databaseSession,
        }
      );
    });
  } finally {
    await databaseSession.endSession();
  }

  if (!booking) {
    throw new HttpError(500, "Booking could not be confirmed");
  }

  return booking as BookingDocument;
}

function getWhatsappErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown WhatsApp send error";
}

function getEmailErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown email send error";
}

function truncateNotificationError(message: string) {
  return message.slice(0, 500);
}

function normalizeBookingConfirmationEmailRecipient(
  guest: IBookingGuestDetails | undefined
) {
  const email = guest?.email?.trim().toLowerCase() || "";

  if (!email) {
    throw new Error("Lead traveller email is missing");
  }

  return email;
}

function formatTravellerCountLabel(adultCount: number, childCount: number) {
  const parts: string[] = [];

  if (adultCount > 0) {
    parts.push(`${adultCount} Adult${adultCount === 1 ? "" : "s"}`);
  }

  if (childCount > 0) {
    parts.push(`${childCount} Child${childCount === 1 ? "" : "ren"}`);
  }

  return parts.join(", ") || "1 Traveller";
}

function getValidDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getFallbackDurationLabel(
  departureDate: Date | string | null | undefined,
  returnDate: Date | string | null | undefined
) {
  const startDate = getValidDate(departureDate);
  const endDate = getValidDate(returnDate);

  if (!startDate || !endDate) {
    return "";
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const durationDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1;

  if (durationDays <= 0) {
    return "";
  }

  const nights = Math.max(0, durationDays - 1);

  return `${durationDays} Day${durationDays === 1 ? "" : "s"} / ${nights} Night${
    nights === 1 ? "" : "s"
  }`;
}

function getBookingConfirmationUrl(booking: BookingDocument) {
  const frontendBaseUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");

  if (!frontendBaseUrl || !booking.confirmationToken) {
    return "";
  }

  return `${frontendBaseUrl}/booking-confirmed/${booking._id.toString()}?token=${encodeURIComponent(
    booking.confirmationToken
  )}`;
}

function getBookingEmailAmounts(booking: BookingDocument) {
  const snapshot = booking.pricingSnapshot;
  const totalAmount =
    toPaymentAmount(booking.grandTotal || snapshot?.grandTotal || booking.subtotal || 0);
  const amountPaid =
    booking.paymentOption === "full" && totalAmount > 0
      ? totalAmount
      : toPaymentAmount(booking.amountPaid || 0);
  const calculatedBalanceAmount =
    totalAmount > 0 ? Math.max(0, totalAmount - amountPaid) : 0;
  const balanceAmount =
    totalAmount > 0
      ? calculatedBalanceAmount
      : toPaymentAmount(booking.balanceAmount ?? snapshot?.balanceAmount ?? 0);

  return {
    amountPaid,
    balanceAmount,
    totalAmount,
  };
}

function createBookingDraftFromBooking(booking: BookingDocument): BookingDraft {
  return {
    accommodationDetails: booking.accommodationDetails,
    adultCount: booking.adultCount,
    amountPaid: booking.amountPaid,
    balanceAmount: booking.balanceAmount,
    balanceDueDate: booking.balanceDueDate,
    childCount: booking.childCount,
    childDetails: booking.childDetails,
    departureId: booking.departureId,
    depositAmount: booking.depositAmount,
    grandTotal: booking.grandTotal,
    gstAmount: booking.gstAmount,
    gstPercentage: booking.gstPercentage,
    guestDetails: booking.guestDetails,
    paymentOption: booking.paymentOption,
    pricingSnapshot: booking.pricingSnapshot,
    selectedAccommodationOptionId: booking.selectedAccommodationOptionId,
    subtotal: booking.subtotal,
    totalGuest: booking.totalGuest,
    tourId: booking.tourId,
    travellers: booking.travellers,
  };
}

function formatBookingRecoveryPayload({
  booking,
  departure,
  tour,
}: {
  booking: BookingDocument;
  departure: TourDepartureDocument | null;
  tour: TourDocument | null;
}) {
  const now = new Date();
  const isConfirmed =
    booking.paymentStatus === "paid" ||
    (booking.bookingStatus || "payment_pending") === "confirmed";
  const isExpired =
    (booking.bookingStatus || "payment_pending") === "expired" ||
    Boolean(booking.recoveryExpiresAt && booking.recoveryExpiresAt <= now);
  const isCancelled = booking.bookingStatus === "cancelled";
  const selfHeldSeats = isActiveHold(booking, now) ? booking.heldSeatCount || 0 : 0;
  const availableSeats = (departure?.seatsAvailable || 0) + selfHeldSeats;
  const hasAvailability = availableSeats >= booking.totalGuest;

  return {
    booking: formatBooking(booking),
    canRetry: !isConfirmed && !isExpired && !isCancelled && hasAvailability,
    isCancelled,
    isConfirmed,
    isExpired,
    hasAvailability,
    recoveryUrl: getRecoveryUrl(booking),
    requiredSeats: booking.totalGuest,
    availableSeats,
    departure: formatPublicDeparture(departure),
    tour: formatPublicTour(tour),
  };
}

async function getRecoveryBookingOrThrow(request: Request) {
  const { token } = parseRequestBody(recoveryTokenQuerySchema, request.query);
  const booking = await Booking.findOne({
    _id: request.params.id,
    recoveryToken: token,
  });

  if (!booking) {
    throw new HttpError(404, "Booking recovery link is invalid");
  }

  return booking;
}

async function sendRecoveryEmailForBooking(booking: BookingDocument) {
  const recoveryUrl = getRecoveryUrl(booking);
  const leadGuest = booking.guestDetails[0];
  const recipientEmail = normalizeBookingConfirmationEmailRecipient(leadGuest);

  if (!recoveryUrl) {
    throw new Error("Booking recovery URL could not be generated");
  }

  const [tour, departure] = await Promise.all([
    Tour.findOne({ tourId: booking.tourId }),
    booking.departureId
      ? TourDeparture.findOne({ departureId: booking.departureId })
      : Promise.resolve(null),
  ]);
  const amounts = getBookingEmailAmounts(booking);
  const result = await sendBookingRecoveryEmail({
    amount:
      booking.paymentOption === "full"
        ? amounts.totalAmount
        : amounts.amountPaid || booking.depositAmount || amounts.totalAmount,
    bookingReference: getBookingReference(booking),
    departureDate: departure?.departureDate || booking.pricingSnapshot?.departureDate,
    recoveryUrl,
    recipientEmail,
    tourName: tour?.tourName || booking.tourId,
    travellerName: getGuestFullName(leadGuest) || "Traveller",
    travellersLabel: formatTravellerCountLabel(
      booking.adultCount,
      booking.childCount
    ),
  });

  return result;
}

function hasWhatsappMarketingConsent(booking: BookingDocument) {
  return booking.whatsappMarketingConsent !== false;
}

async function sendRecoveryWhatsappIfNeeded(booking: BookingDocument) {
  const now = new Date();

  if (
    !isRecoverableBooking(booking, now) ||
    !hasWhatsappMarketingConsent(booking) ||
    booking.whatsappRecoveryStatus === "disabled" ||
    booking.whatsappRecoverySentAt
  ) {
    return;
  }

  let claimedBooking: BookingDocument | null = null;

  try {
    claimedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        bookingStatus: "payment_pending",
        paymentStatus: { $ne: "paid" },
        recoveryExpiresAt: { $gt: now },
        whatsappMarketingConsent: { $ne: false },
        whatsappRecoverySentAt: null,
        $or: [
          { whatsappRecoveryStatus: { $exists: false } },
          { whatsappRecoveryStatus: "pending" },
          { whatsappRecoveryStatus: "failed" },
        ],
      },
      {
        $set: {
          whatsappRecoveryAttemptedAt: now,
          whatsappRecoveryStatus: "sending",
        },
        $unset: {
          whatsappRecoveryError: "",
        },
      },
      {
        new: true,
      }
    );

    if (!claimedBooking) {
      return;
    }

    const recoveryUrl = getRecoveryUrl(claimedBooking);

    if (!recoveryUrl) {
      throw new Error("Booking recovery URL could not be generated");
    }

    const leadGuest = claimedBooking.guestDetails[0];
    const recipientNumber = normalizeWhatsappRecipientNumber(leadGuest);
    const tour = await Tour.findOne({ tourId: claimedBooking.tourId });
    const result = await sendBookingRecoveryWhatsapp({
      crqId: `booking_recovery_${claimedBooking._id.toString()}`,
      recipientNumber,
      recoveryUrl,
      tourName: tour?.tourName || claimedBooking.tourId,
      travellerName: getGuestFullName(leadGuest) || "Traveller",
    });

    await Booking.updateOne(
      {
        _id: claimedBooking._id,
        paymentStatus: { $ne: "paid" },
        bookingStatus: "payment_pending",
      },
      {
        $set: {
          whatsappRecoveryRecipient: recipientNumber,
          whatsappRecoveryRequestId: result.requestId,
          whatsappRecoverySentAt: new Date(),
          whatsappRecoveryStatus: "sent",
        },
        $unset: {
          whatsappRecoveryError: "",
        },
      }
    );

    console.info(
      `[booking-whatsapp] Sent ancient_trails_booking_reminder for booking ${claimedBooking._id.toString()} to ${recipientNumber}`
    );
  } catch (error) {
    const message = truncateNotificationError(getWhatsappErrorMessage(error));

    console.error(
      `[booking-whatsapp] Failed ancient_trails_booking_reminder for booking ${booking._id.toString()}: ${message}`
    );

    if (claimedBooking) {
      try {
        await Booking.updateOne(
          {
            _id: claimedBooking._id,
          },
          {
            $set: {
              whatsappRecoveryError: message,
              whatsappRecoveryStatus: "failed",
            },
          }
        );
      } catch (updateError) {
        console.error(
          `[booking-whatsapp] Failed to persist WhatsApp recovery failure for booking ${claimedBooking._id.toString()}: ${getWhatsappErrorMessage(updateError)}`
        );
      }
    }
  }
}

async function sendBookingRecoveryEmailIfNeeded(
  booking: BookingDocument,
  options: { ignoreDelay?: boolean } = {}
) {
  const now = new Date();
  const reminderCount = booking.recoveryReminderCount || 0;

  if (
    !isRecoverableBooking(booking, now) ||
    booking.recoveryEmailStatus === "disabled" ||
    reminderCount > 0 ||
    (!options.ignoreDelay &&
      now.getTime() - booking.createdAt.getTime() <
        Math.max(1, RECOVERY_REMINDER_MINUTES) * 60 * 1000)
  ) {
    return;
  }

  const claimedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      bookingStatus: "payment_pending",
      paymentStatus: { $ne: "paid" },
      recoveryReminderCount: 0,
      recoveryExpiresAt: { $gt: now },
      $or: [
        { recoveryEmailStatus: { $exists: false } },
        { recoveryEmailStatus: "pending" },
        { recoveryEmailStatus: "failed" },
      ],
    },
    {
      $set: {
        recoveryEmailAttemptedAt: now,
        recoveryEmailStatus: "sending",
      },
      $unset: {
        recoveryEmailError: "",
      },
    },
    {
      new: true,
    }
  );

  if (!claimedBooking) {
    return;
  }

  try {
    await sendRecoveryEmailForBooking(claimedBooking);
    await Booking.updateOne(
      { _id: claimedBooking._id },
      {
        $inc: { recoveryReminderCount: 1 },
        $set: {
          recoveryEmailSentAt: new Date(),
          recoveryEmailStatus: "sent",
          recoveryLastReminderSentAt: new Date(),
        },
      }
    );
  } catch (error) {
    await Booking.updateOne(
      { _id: claimedBooking._id },
      {
        $set: {
          recoveryEmailError: truncateNotificationError(getEmailErrorMessage(error)),
          recoveryEmailStatus: "failed",
        },
      }
    );
  }

  await sendRecoveryWhatsappIfNeeded(claimedBooking);
}

async function sendDueRecoveryEmails() {
  const cutoff = new Date(
    Date.now() - Math.max(1, RECOVERY_REMINDER_MINUTES) * 60 * 1000
  );
  const bookings = await Booking.find({
    bookingStatus: "payment_pending",
    createdAt: { $lte: cutoff },
    paymentStatus: { $ne: "paid" },
    recoveryExpiresAt: { $gt: new Date() },
    recoveryReminderCount: 0,
    $or: [
      { recoveryEmailStatus: { $exists: false } },
      { recoveryEmailStatus: "pending" },
      { recoveryEmailStatus: "failed" },
    ],
  }).limit(50);

  for (const booking of bookings) {
    await sendBookingRecoveryEmailIfNeeded(booking);
  }
}

function normalizeWhatsappRecipientNumber(guest: IBookingGuestDetails | undefined) {
  if (!guest) {
    throw new Error("Lead traveller details are missing");
  }

  const countryCode = guest.countryCode.replace(/\D/g, "") || "91";
  let mobileNumber = guest.mobileNumber.replace(/\D/g, "");

  if (!mobileNumber) {
    throw new Error("Lead traveller mobile number is missing");
  }

  if (mobileNumber.startsWith(countryCode) && mobileNumber.length > 10) {
    return mobileNumber;
  }

  mobileNumber = mobileNumber.replace(/^0+/, "");

  return `${countryCode}${mobileNumber}`;
}

function formatWhatsappDepartureDate(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "To be announced";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "To be announced";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function sendBookingConfirmationEmailIfNeeded(
  booking: BookingDocument
) {
  let claimedBooking: BookingDocument | null = null;

  try {
    claimedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        emailBookingConfirmationSentAt: null,
        paymentStatus: "paid",
        $or: [
          { emailBookingConfirmationStatus: { $exists: false } },
          { emailBookingConfirmationStatus: "pending" },
        ],
      },
      {
        $set: {
          emailBookingConfirmationAttemptedAt: new Date(),
          emailBookingConfirmationStatus: "sending",
        },
        $unset: {
          emailBookingConfirmationError: "",
        },
      },
      {
        new: true,
      }
    );

    if (!claimedBooking) {
      console.info(
        `[booking-email] Skipped duplicate confirmation for booking ${booking._id.toString()}`
      );
      return;
    }

    const [tour, departure] = await Promise.all([
      Tour.findOne({ tourId: claimedBooking.tourId }),
      claimedBooking.departureId
        ? TourDeparture.findOne({ departureId: claimedBooking.departureId })
        : Promise.resolve(null),
    ]);
    const destinationId = departure?.destinationId || tour?.destinationId || "";
    const destination = destinationId
      ? await Destination.findOne({ destinationId })
      : null;
    const leadGuest = claimedBooking.guestDetails[0];
    const recipientEmail = normalizeBookingConfirmationEmailRecipient(leadGuest);
    const departureDate =
      departure?.departureDate || claimedBooking.pricingSnapshot?.departureDate;
    const returnDate =
      departure?.returnDate || claimedBooking.pricingSnapshot?.returnDate;
    const amounts = getBookingEmailAmounts(claimedBooking);
    const payload: BookingConfirmationEmailPayload = {
      ...amounts,
      balanceDueDate:
        claimedBooking.balanceDueDate ||
        claimedBooking.pricingSnapshot?.balanceDueDate ||
        null,
      bookingId: claimedBooking._id.toString(),
      bookingReference: getBookingReference(claimedBooking),
      confirmationUrl: getBookingConfirmationUrl(claimedBooking),
      confirmedAt: claimedBooking.paymentCapturedAt || claimedBooking.createdAt,
      departureDate: departureDate || null,
      destinationName: destination?.destinationName || "",
      durationLabel:
        tour?.durationDn || getFallbackDurationLabel(departureDate, returnDate),
      paymentId: claimedBooking.paymentId,
      recipientEmail,
      returnDate: returnDate || null,
      totalAmount: amounts.totalAmount,
      tourName: tour?.tourName || claimedBooking.tourId,
      travellerName: getGuestFullName(leadGuest) || "Traveller",
      travellersLabel: formatTravellerCountLabel(
        claimedBooking.adultCount,
        claimedBooking.childCount
      ),
    };
    const result = await sendBookingConfirmationEmail(payload);

    try {
      const alertResult = await sendBookingAlertEmail({
        ...payload,
        travellerEmail: recipientEmail,
        travellerPhone: leadGuest
          ? `${leadGuest.countryCode} ${leadGuest.mobileNumber}`.trim()
          : "",
      });

      if (alertResult.recipients.length > 0) {
        console.info(
          `[booking-email] Sent booking alert for booking ${claimedBooking._id.toString()} to ${alertResult.recipients.join(
            ", "
          )}`
        );
      }
    } catch (alertError) {
      console.error(
        `[booking-email] Failed booking alert for booking ${claimedBooking._id.toString()}: ${truncateNotificationError(
          getEmailErrorMessage(alertError)
        )}`
      );
    }

    await Booking.updateOne(
      {
        _id: claimedBooking._id,
      },
      {
        $set: {
          emailBookingConfirmationMessageId: result.messageId,
          emailBookingConfirmationRecipient: recipientEmail,
          emailBookingConfirmationSentAt: new Date(),
          emailBookingConfirmationStatus: "sent",
        },
        $unset: {
          emailBookingConfirmationError: "",
        },
      }
    );

    console.info(
      `[booking-email] Sent booking confirmation for booking ${claimedBooking._id.toString()} to ${recipientEmail}`
    );
  } catch (error) {
    const message = truncateNotificationError(getEmailErrorMessage(error));

    console.error(
      `[booking-email] Failed booking confirmation for booking ${booking._id.toString()}: ${message}`
    );

    if (claimedBooking) {
      try {
        await Booking.updateOne(
          {
            _id: claimedBooking._id,
          },
          {
            $set: {
              emailBookingConfirmationError: message,
              emailBookingConfirmationStatus: "failed",
            },
          }
        );
      } catch (updateError) {
        console.error(
          `[booking-email] Failed to persist email failure for booking ${claimedBooking._id.toString()}: ${getEmailErrorMessage(updateError)}`
        );
      }
    }
  }
}

async function sendBookingConfirmationWhatsappIfNeeded(
  booking: BookingDocument
) {
  let claimedBooking: BookingDocument | null = null;

  try {
    claimedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        paymentStatus: "paid",
        whatsappBookingConfirmationSentAt: null,
        $or: [
          { whatsappBookingConfirmationStatus: { $exists: false } },
          { whatsappBookingConfirmationStatus: "pending" },
        ],
      },
      {
        $set: {
          whatsappBookingConfirmationAttemptedAt: new Date(),
          whatsappBookingConfirmationStatus: "sending",
        },
        $unset: {
          whatsappBookingConfirmationError: "",
        },
      },
      {
        new: true,
      }
    );

    if (!claimedBooking) {
      console.info(
        `[booking-whatsapp] Skipped duplicate confirmation for booking ${booking._id.toString()}`
      );
      return;
    }

    const [tour, departure] = await Promise.all([
      Tour.findOne({ tourId: claimedBooking.tourId }),
      claimedBooking.departureId
        ? TourDeparture.findOne({ departureId: claimedBooking.departureId })
        : Promise.resolve(null),
    ]);
    const leadGuest = claimedBooking.guestDetails[0];
    const recipientNumber = normalizeWhatsappRecipientNumber(leadGuest);
    const travellerName = getGuestFullName(leadGuest) || "Traveller";
    const tourName = tour?.tourName || claimedBooking.tourId;
    const departureDate = formatWhatsappDepartureDate(
      departure?.departureDate || claimedBooking.pricingSnapshot?.departureDate
    );
    const result = await sendBookingConfirmationWhatsapp({
      crqId: `booking_confirmation_${claimedBooking._id.toString()}`,
      departureDate,
      recipientNumber,
      tourName,
      travellerName,
    });

    await Booking.updateOne(
      {
        _id: claimedBooking._id,
      },
      {
        $set: {
          whatsappBookingConfirmationRecipient: recipientNumber,
          whatsappBookingConfirmationRequestId: result.requestId,
          whatsappBookingConfirmationSentAt: new Date(),
          whatsappBookingConfirmationStatus: "sent",
        },
        $unset: {
          whatsappBookingConfirmationError: "",
        },
      }
    );

    console.info(
      `[booking-whatsapp] Sent booking_confirmation for booking ${claimedBooking._id.toString()} to ${recipientNumber}`
    );
  } catch (error) {
    const message = truncateNotificationError(getWhatsappErrorMessage(error));

    console.error(
      `[booking-whatsapp] Failed booking_confirmation for booking ${booking._id.toString()}: ${message}`
    );

    if (claimedBooking) {
      try {
        await Booking.updateOne(
          {
            _id: claimedBooking._id,
          },
          {
            $set: {
              whatsappBookingConfirmationError: message,
              whatsappBookingConfirmationStatus: "failed",
            },
          }
        );
      } catch (updateError) {
        console.error(
          `[booking-whatsapp] Failed to persist WhatsApp failure for booking ${claimedBooking._id.toString()}: ${getWhatsappErrorMessage(updateError)}`
        );
      }
    }
  }
}

function formatPublicTour(tour: TourDocument | null) {
  if (!tour) {
    return null;
  }

  return {
    tourId: tour.tourId,
    tourName: tour.tourName,
    durationDn: tour.durationDn,
    destinationId: tour.destinationId,
    destinationIds: tour.destinationIds,
    category: tour.category,
    expertId: tour.expertId,
    thumbnailImage: tour.thumbnailImage || "",
    bannerImage: tour.bannerImage,
    galleryImages: tour.galleryImages,
  };
}

function formatPublicDeparture(
  departure: TourDepartureDocument | null
) {
  if (!departure) {
    return null;
  }

  return {
    departureId: departure.departureId,
    departureDate: departure.departureDate,
    returnDate: departure.returnDate,
    seatsAvailable: departure.seatsAvailable,
    status: departure.status,
  };
}

function formatPublicDestination(destination: DestinationDocument | null) {
  if (!destination) {
    return null;
  }

  return {
    destinationId: destination.destinationId,
    destinationName: destination.destinationName,
    countryRegion: destination.countryRegion,
    state: destination.state,
    city: destination.city,
    bannerImage: destination.bannerImage,
    galleryImages: destination.galleryImages,
  };
}

function formatPublicExpert(expert: ExpertDocument | null) {
  if (!expert) {
    return null;
  }

  return {
    expertId: expert.expertId,
    fullName: expert.fullName,
    image: expert.image,
    expertiseTags: expert.expertiseTags,
  };
}

export async function createBookingPaymentOrder(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(bookingPayloadSchema, request.body);
  const tour = await Tour.findOne({ tourId: payload.tourId });

  if (!tour) {
    throw new HttpError(400, `Tour ID ${payload.tourId} does not exist`);
  }

  await releaseSupersededPendingPaymentReservations(payload);

  const snapshotPayload = await createSnapshotPayload(payload);

  if (!snapshotPayload) {
    throw new HttpError(400, "Complete booking details are required for payment");
  }

  const bookingDraft = createBookingDraft(payload, snapshotPayload);
  const pendingBookingKey = createPendingBookingKey(payload);
  const amountRupees = getPaymentAmountRupees(
    bookingDraft,
    payload.paymentOption
  );
  const amount = amountRupees * 100;
  const receipt = createReceipt();
  const leadGuest = getLeadGuest(payload);
  const { keyId } = getRazorpayCredentials();
  const razorpay = createRazorpayClient();

  const order = await razorpay.orders.create({
    amount,
    currency: PAYMENT_CURRENCY,
    receipt,
    notes: {
      tourId: payload.tourId,
      departureId: payload.departureId || "",
      paymentOption: payload.paymentOption,
      travellers: payload.totalGuest,
    },
  });
  const { paymentSession } = await createReservedBookingForPayment({
    amount,
    amountRupees,
    bookingDraft,
    orderId: order.id,
    pendingBookingKey,
    receipt,
  });

  response.status(201).json({
    success: true,
    message: "Payment order created successfully",
    data: {
      checkout: {
        key: keyId,
        orderId: order.id,
        amount,
        amountRupees,
        currency: PAYMENT_CURRENCY,
        name: "Ancient Trails",
        description: `${tour.tourName} booking payment`,
        prefill: {
          name: getGuestFullName(leadGuest),
          email: leadGuest.email,
          contact: `${leadGuest.countryCode}${leadGuest.mobileNumber}`.replace(
            /[^\d+]/g,
            ""
          ),
        },
      },
      paymentSession: formatPaymentSession(paymentSession),
    },
  });
}

export async function createBookingBalancePaymentOrder(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await getAuthenticatedTravellerPaidBookingById(request);
    const amountRupees = getBalancePaymentAmountRupees(booking);

    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      throw new HttpError(400, "Balance payment is already complete");
    }

    const amount = amountRupees * 100;
    const receipt = createReceipt();
    const { keyId } = getRazorpayCredentials();
    const razorpay = createRazorpayClient();
    const tour = await Tour.findOne({ tourId: booking.tourId });
    const order = await razorpay.orders.create({
      amount,
      currency: PAYMENT_CURRENCY,
      receipt,
      notes: {
        bookingId: booking._id.toString(),
        paymentPurpose: "balance",
        tourId: booking.tourId,
      },
    });
    const paymentSession = await createBalancePaymentSession({
      amount,
      amountRupees,
      booking,
      orderId: order.id,
      receipt,
    });

    response.status(201).json({
      success: true,
      message: "Balance payment order created successfully",
      data: {
        checkout: {
          key: keyId,
          orderId: order.id,
          amount,
          amountRupees,
          currency: PAYMENT_CURRENCY,
          name: "Ancient Trails",
          description: `${tour?.tourName || booking.tourId} balance payment`,
          prefill: getBalancePaymentCheckoutPrefill(booking),
        },
        paymentSession: formatBalancePaymentSession(paymentSession),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function verifyBookingPayment(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(paymentVerificationPayloadSchema, request.body);
  const { keySecret } = getRazorpayCredentials();
  const paymentSession = await BookingPaymentSession.findOne({
    razorpayOrderId: payload.razorpay_order_id,
  });

  if (!paymentSession) {
    throw new HttpError(404, "Payment session not found");
  }

  if (paymentSession.status === "paid" && paymentSession.bookingId) {
    const booking = await Booking.findById(paymentSession.bookingId);

    if (!booking) {
      throw new HttpError(404, "Confirmed booking not found");
    }

    await sendBookingConfirmationWhatsappIfNeeded(booking);
    await sendBookingConfirmationEmailIfNeeded(booking);

    response.status(200).json({
      success: true,
      message: "Booking already confirmed",
      data: {
        booking: formatBooking(booking),
        confirmationToken: booking.confirmationToken,
      },
    });
    return;
  }

  if (paymentSession.status === "failed" || paymentSession.status === "expired") {
    throw new HttpError(
      400,
      paymentSession.failureReason ||
        "Payment order is closed. Please start a new payment."
    );
  }

  const isValidSignature = verifyRazorpaySignature({
    keySecret,
    orderId: paymentSession.razorpayOrderId,
    paymentId: payload.razorpay_payment_id,
    signature: payload.razorpay_signature,
  });

  if (!isValidSignature) {
    await releasePaymentSessionReservation(
      paymentSession,
      "Razorpay signature verification failed"
    );
    throw new HttpError(400, "Payment signature verification failed");
  }

  const razorpay = createRazorpayClient();
  const capturedPayment = await captureVerifiedPayment({
    amount: paymentSession.amount,
    currency: paymentSession.currency,
    paymentId: payload.razorpay_payment_id,
    razorpay,
  });

  if (capturedPayment.order_id !== paymentSession.razorpayOrderId) {
    throw new HttpError(400, "Payment does not belong to this booking order");
  }

  const booking = await createPaidBookingFromPaymentSession({
    paymentId: payload.razorpay_payment_id,
    session: paymentSession,
    signature: payload.razorpay_signature,
  });

  await sendBookingConfirmationWhatsappIfNeeded(booking);
  await sendBookingConfirmationEmailIfNeeded(booking);

  response.status(200).json({
    success: true,
    message: "Booking confirmed successfully",
    data: {
      booking: formatBooking(booking),
      confirmationToken: booking.confirmationToken,
    },
  });
}

export async function verifyBookingBalancePayment(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const payload = parseRequestBody(paymentVerificationPayloadSchema, request.body);
    const booking = await getAuthenticatedTravellerPaidBookingById(request);
    const paymentSession = await BookingBalancePaymentSession.findOne({
      bookingId: booking._id,
      razorpayOrderId: payload.razorpay_order_id,
    });

    if (!paymentSession) {
      throw new HttpError(404, "Balance payment session not found");
    }

    if (paymentSession.status === "paid") {
      const latestBooking = await Booking.findById(booking._id);

      response.status(200).json({
        success: true,
        message: "Balance payment already confirmed",
        data: {
          booking: formatBooking(latestBooking || booking),
          paymentSession: formatBalancePaymentSession(paymentSession),
        },
      });
      return;
    }

    if (paymentSession.status === "failed" || paymentSession.status === "expired") {
      throw new HttpError(
        400,
        paymentSession.failureReason ||
          "Balance payment order is closed. Please start a new payment."
      );
    }

    const { keySecret } = getRazorpayCredentials();
    const isValidSignature = verifyRazorpaySignature({
      keySecret,
      orderId: paymentSession.razorpayOrderId,
      paymentId: payload.razorpay_payment_id,
      signature: payload.razorpay_signature,
    });

    if (!isValidSignature) {
      await BookingBalancePaymentSession.updateOne(
        {
          _id: paymentSession._id,
          status: "pending",
        },
        {
          $set: {
            failureReason: "Razorpay signature verification failed",
            status: "failed",
          },
        }
      );
      throw new HttpError(400, "Payment signature verification failed");
    }

    const razorpay = createRazorpayClient();
    const capturedPayment = await captureVerifiedPayment({
      amount: paymentSession.amount,
      currency: paymentSession.currency,
      paymentId: payload.razorpay_payment_id,
      razorpay,
    });

    if (capturedPayment.order_id !== paymentSession.razorpayOrderId) {
      throw new HttpError(400, "Payment does not belong to this balance order");
    }

    const updatedBooking = await applyVerifiedBalancePayment({
      paymentId: payload.razorpay_payment_id,
      session: paymentSession,
      signature: payload.razorpay_signature,
    });
    const latestPaymentSession =
      (await BookingBalancePaymentSession.findById(paymentSession._id)) ||
      paymentSession;

    response.status(200).json({
      success: true,
      message: "Balance payment confirmed successfully",
      data: {
        booking: formatBooking(updatedBooking),
        paymentSession: formatBalancePaymentSession(latestPaymentSession),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function cancelBookingPaymentOrder(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(paymentCancellationPayloadSchema, request.body);
  const paymentSession = await BookingPaymentSession.findOne({
    razorpayOrderId: payload.orderId,
  });

  if (!paymentSession) {
    response.status(200).json({
      success: true,
      message: "Payment order is already closed",
      data: {
        paymentSession: null,
      },
    });
    return;
  }

  if (paymentSession.status === "pending") {
    await releasePaymentSessionReservation(
      paymentSession,
      "Payment cancelled before completion"
    );

    if (paymentSession.bookingId) {
      const booking = await Booking.findById(paymentSession.bookingId);

      if (booking) {
        await sendBookingRecoveryEmailIfNeeded(booking, { ignoreDelay: true });
      }
    }
  }

  response.status(200).json({
    success: true,
    message: "Payment order cancelled",
    data: {
      paymentSession: formatPaymentSession(paymentSession),
    },
  });
}

export async function getBookingConfirmation(
  request: Request,
  response: Response
): Promise<void> {
  const token =
    typeof request.query.token === "string" ? request.query.token.trim() : "";

  if (!token) {
    throw new HttpError(400, "Confirmation token is required");
  }

  try {
    const booking = await Booking.findOne({
      _id: request.params.id,
      confirmationToken: token,
      ...createPaidBookingFilter(),
    });

    if (!booking) {
      throw new HttpError(404, "Booking confirmation not found");
    }

    const tour = await Tour.findOne({ tourId: booking.tourId });
    const departure = booking.departureId
      ? await TourDeparture.findOne({ departureId: booking.departureId })
      : null;
    const expert = tour?.expertId
      ? await Expert.findOne({ expertId: tour.expertId })
      : null;

    response.status(200).json({
      success: true,
      message: "Booking confirmation fetched successfully",
      data: {
        booking: formatBooking(booking),
        departure: formatPublicDeparture(departure),
        expert: formatPublicExpert(expert),
        tour: formatPublicTour(tour),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function getBookingRecovery(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await getRecoveryBookingOrThrow(request);
    await expireRecoveryForBooking(booking._id);
    await releaseExpiredHoldForBooking(booking._id);

    const freshBooking = (await Booking.findById(booking._id)) || booking;
    const [tour, departure] = await Promise.all([
      Tour.findOne({ tourId: freshBooking.tourId }),
      freshBooking.departureId
        ? TourDeparture.findOne({ departureId: freshBooking.departureId })
        : Promise.resolve(null),
    ]);

    if (freshBooking.paymentStatus === "paid" && freshBooking.confirmationToken) {
      response.status(200).json({
        success: true,
        message: "Booking is already confirmed",
        data: {
          ...formatBookingRecoveryPayload({
            booking: freshBooking,
            departure,
            tour,
          }),
          confirmationToken: freshBooking.confirmationToken,
        },
      });
      return;
    }

    response.status(200).json({
      success: true,
      message: "Booking recovery fetched successfully",
      data: formatBookingRecoveryPayload({
        booking: freshBooking,
        departure,
        tour,
      }),
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function createBookingRecoveryPaymentOrder(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await getRecoveryBookingOrThrow(request);
    await expireRecoveryForBooking(booking._id);
    await releaseExpiredHoldForBooking(booking._id);

    const freshBooking = await Booking.findById(booking._id);

    if (!freshBooking) {
      throw new HttpError(404, "Booking recovery link is invalid");
    }

    if (freshBooking.paymentStatus === "paid") {
      throw new HttpError(400, "This booking is already confirmed");
    }

    if (!isRecoverableBooking(freshBooking)) {
      throw new HttpError(410, "This booking link has expired. Please start a new booking.");
    }

    const [tour, departure] = await Promise.all([
      Tour.findOne({ tourId: freshBooking.tourId }),
      freshBooking.departureId
        ? TourDeparture.findOne({ departureId: freshBooking.departureId })
        : Promise.resolve(null),
    ]);
    const recoveryState = formatBookingRecoveryPayload({
      booking: freshBooking,
      departure,
      tour,
    });

    if (!recoveryState.hasAvailability) {
      throw new HttpError(
        409,
        "This departure is currently unavailable for the selected number of travellers. Please choose another departure or contact Ancient Trails."
      );
    }

    const bookingDraft = createBookingDraftFromBooking(freshBooking);
    const amountRupees = getPaymentAmountRupees(
      bookingDraft,
      freshBooking.paymentOption || "advance"
    );
    const amount = amountRupees * 100;
    const receipt = createReceipt();
    const { keyId } = getRazorpayCredentials();
    const razorpay = createRazorpayClient();
    const order = await razorpay.orders.create({
      amount,
      currency: PAYMENT_CURRENCY,
      receipt,
      notes: {
        bookingId: freshBooking._id.toString(),
        paymentPurpose: "recovery",
        tourId: freshBooking.tourId,
      },
    });
    const pendingBookingKey =
      freshBooking.pendingBookingKey ||
      crypto
        .createHash("sha256")
        .update(
          [
            freshBooking.tourId,
            freshBooking.departureId || "",
            freshBooking.selectedAccommodationOptionId || "",
            freshBooking.paymentOption || "advance",
            freshBooking.totalGuest,
            freshBooking._id.toString(),
          ].join("|")
        )
        .digest("hex");
    if (!freshBooking.pendingBookingKey) {
      freshBooking.pendingBookingKey = pendingBookingKey;
      await freshBooking.save();
    }
    const { paymentSession } = await createReservedBookingForPayment({
      amount,
      amountRupees,
      bookingDraft,
      orderId: order.id,
      pendingBookingKey,
      receipt,
    });
    const leadGuest = freshBooking.guestDetails[0];

    response.status(201).json({
      success: true,
      message: "Recovery payment order created successfully",
      data: {
        checkout: {
          key: keyId,
          orderId: order.id,
          amount,
          amountRupees,
          currency: PAYMENT_CURRENCY,
          name: "Ancient Trails",
          description: `${tour?.tourName || freshBooking.tourId} booking payment`,
          prefill: {
            name: getGuestFullName(leadGuest),
            email: leadGuest.email,
            contact: `${leadGuest.countryCode}${leadGuest.mobileNumber}`.replace(
              /[^\d+]/g,
              ""
            ),
          },
        },
        paymentSession: formatPaymentSession(paymentSession),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function sendBookingRecoveryEmailManually(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (!isRecoverableBooking(booking)) {
      throw new HttpError(400, "Booking is not recoverable");
    }

    await sendRecoveryEmailForBooking(booking);
    booking.recoveryEmailAttemptedAt = new Date();
    booking.recoveryEmailSentAt = new Date();
    booking.recoveryEmailStatus = "sent";
    booking.recoveryLastReminderSentAt = new Date();
    booking.recoveryReminderCount = (booking.recoveryReminderCount || 0) + 1;
    booking.recoveryEmailError = "";
    await booking.save();
    await sendRecoveryWhatsappIfNeeded(booking);

    response.status(200).json({
      success: true,
      message: "Recovery email sent successfully",
      data: {
        booking: formatBooking(booking),
        recoveryUrl: getRecoveryUrl(booking),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function cancelPendingBooking(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const session = await mongoose.startSession();
    let booking: BookingDocument | null = null;

    try {
      await session.withTransaction(async () => {
        booking = await Booking.findById(request.params.id).session(session);

        if (!booking) {
          throw new HttpError(404, "Booking not found");
        }

        if (booking.paymentStatus === "paid") {
          throw new HttpError(400, "Confirmed bookings cannot be cancelled here");
        }

        if ((booking.heldSeatCount || 0) > 0 && booking.departureId) {
          await TourDeparture.updateOne(
            { departureId: booking.departureId },
            { $inc: { seatsAvailable: booking.heldSeatCount || 0 } },
            { session }
          );
        }

        booking.bookingStatus = "cancelled";
        booking.heldSeatCount = 0;
        booking.holdExpiresAt = null;
        booking.recoveryEmailStatus = "disabled";
        booking.whatsappRecoveryStatus = "disabled";
        booking.pendingBookingKey = undefined;
        await booking.save({ session });

        await BookingPaymentSession.updateMany(
          {
            bookingId: booking._id,
            status: "pending",
          },
          {
            $set: {
              failureReason: "Booking cancelled",
              status: "expired",
            },
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    response.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
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

export async function markPendingBookingExpired(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const booking = await Booking.findById(request.params.id).session(session);

        if (!booking) {
          throw new HttpError(404, "Booking not found");
        }

        if (booking.paymentStatus === "paid") {
          throw new HttpError(400, "Confirmed bookings cannot be marked expired");
        }

        booking.recoveryExpiresAt = new Date(0);
        await booking.save({ session });
        await expireRecoveryForBooking(booking._id, session);
      });
    } finally {
      await session.endSession();
    }

    const booking = await Booking.findById(request.params.id);

    response.status(200).json({
      success: true,
      message: "Booking marked expired successfully",
      data: {
        booking: booking ? formatBooking(booking) : null,
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function verifyRazorpayWebhook(
  request: Request,
  response: Response
): Promise<void> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new HttpError(503, "Razorpay webhook secret is not configured");
  }

  const rawBody = Buffer.isBuffer(request.body)
    ? request.body
    : Buffer.from(JSON.stringify(request.body));
  const signature = String(request.headers["x-razorpay-signature"] || "");
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (
    !/^[a-f0-9]+$/i.test(signature) ||
    expectedSignature.length !== signature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    )
  ) {
    throw new HttpError(400, "Invalid Razorpay webhook signature");
  }

  const eventPayload = JSON.parse(rawBody.toString("utf8")) as {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
        };
      };
    };
  };
  const payment = eventPayload.payload?.payment?.entity;

  if (!payment?.order_id || !payment.id) {
    response.status(200).json({
      success: true,
      message: "Webhook ignored",
      data: {},
    });
    return;
  }

  const paymentSession = await BookingPaymentSession.findOne({
    razorpayOrderId: payment.order_id,
  });

  if (!paymentSession) {
    response.status(200).json({
      success: true,
      message: "Payment session not found; webhook ignored",
      data: {},
    });
    return;
  }

  if (eventPayload.event === "payment.captured" || payment.status === "captured") {
    const booking = await createPaidBookingFromPaymentSession({
      paymentId: payment.id,
      session: paymentSession,
      signature,
    });

    await sendBookingConfirmationWhatsappIfNeeded(booking);
    await sendBookingConfirmationEmailIfNeeded(booking);
  } else if (eventPayload.event === "payment.failed" || payment.status === "failed") {
    await releasePaymentSessionReservation(
      paymentSession,
      "Razorpay reported payment failure"
    );
  }

  response.status(200).json({
    success: true,
    message: "Webhook processed",
    data: {},
  });
}

export async function listTravellerBookings(
  request: Request,
  response: Response
): Promise<void> {
  const traveller = await getAuthenticatedTraveller(request);
  const bookings = await Booking.find({
    ...createTravellerBookingFilters(traveller),
    ...createPaidBookingFilter(),
  })
    .sort({ createdAt: -1 })
    .limit(300);
  const tourIds: string[] = Array.from(
    new Set(bookings.map((booking) => booking.tourId).filter(Boolean))
  );
  const departureIds: string[] = Array.from(
    new Set(
      bookings
        .map((booking) => booking.departureId)
        .filter((departureId): departureId is string => Boolean(departureId))
    )
  );
  const [tours, departures] = await Promise.all([
    Tour.find({ tourId: { $in: tourIds } }).exec(),
    TourDeparture.find({ departureId: { $in: departureIds } }).exec(),
  ]);
  const toursById = new Map(tours.map((tour) => [tour.tourId, tour]));
  const departuresById = new Map(
    departures.map((departure) => [departure.departureId, departure])
  );
  const destinationIds: string[] = Array.from(
    new Set(
      bookings
        .map((booking) => {
          const departure = booking.departureId
            ? departuresById.get(booking.departureId)
            : null;
          const tour = toursById.get(booking.tourId);

          return departure?.destinationId || tour?.destinationId || "";
        })
        .filter((destinationId): destinationId is string =>
          Boolean(destinationId)
        )
    )
  );
  const destinations = await Destination.find({
    destinationId: { $in: destinationIds },
  }).exec();
  const destinationsById = new Map(
    destinations.map((destination) => [destination.destinationId, destination])
  );

  response.status(200).json({
    success: true,
    message: "Traveller bookings fetched successfully",
    data: {
      bookings: bookings.map((booking) => {
        const tour = toursById.get(booking.tourId) || null;
        const departure = booking.departureId
          ? departuresById.get(booking.departureId) || null
          : null;
        const destinationId =
          departure?.destinationId || tour?.destinationId || "";

        return {
          booking: formatBooking(booking),
          departure: formatPublicDeparture(departure),
          destination: formatPublicDestination(
            destinationId ? destinationsById.get(destinationId) || null : null
          ),
          tour: formatPublicTour(tour),
        };
      }),
    },
  });
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
  const filters: Record<string, unknown> = {
    archivedAt: null,
  };

  if (search) {
    filters.$or = [
      { tourId: new RegExp(search, "i") },
      { bookingReference: new RegExp(search, "i") },
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

export async function listBookingAccommodationOptions(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(
    adminAccommodationOptionsPayloadSchema,
    request.body
  );
  const departure = await TourDeparture.findOne({
    departureId: payload.departureId,
  });

  if (!departure) {
    throw new HttpError(400, `Departure ID ${payload.departureId} does not exist`);
  }

  const pricedDeparture = toPricedDeparture(departure);
  const totalTravellers = payload.adultCount + payload.childDetails.length;
  const departureValidation = validateDepartureForBooking(
    pricedDeparture,
    totalTravellers
  );

  if (!departureValidation.isValid) {
    throw new HttpError(400, departureValidation.errors[0], departureValidation.errors);
  }

  const options = generateOccupancyOptions({
    adults: payload.adultCount,
    children: payload.childDetails.map((child, index) => ({
      id: `child-${index + 1}`,
      age: child.age,
    })),
    selectedDeparture: pricedDeparture,
  }).map((option) => {
    const snapshot = createPricingSnapshot({
      accommodationOption: option,
      departure: pricedDeparture,
      gstPercentage: payload.gstPercentage,
    });

    return {
      id: option.id,
      title: option.title,
      description: option.description || "",
      total: option.total,
      rooms: option.rooms,
      pricingBreakdown: option.pricingBreakdown,
      recommended: option.recommended || false,
      requiresRoommateMatching: option.requiresRoommateMatching || false,
      preferredSharingType: option.preferredSharingType || "",
      subtotal: snapshot.subtotal,
      gstPercentage: snapshot.gstPercentage,
      gstAmount: snapshot.gstAmount,
      grandTotal: snapshot.grandTotal,
      depositAmount: snapshot.depositAmount,
      balanceAmount: snapshot.balanceAmount,
      balanceDueDate: snapshot.balanceDueDate,
    };
  });

  response.status(200).json({
    success: true,
    message: "Accommodation options fetched successfully",
    data: {
      options,
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
          createScheduledDepartureReservationFilter(
            payload.departureId,
            payload.totalGuest
          ),
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

        const bookingDraft = applyAdminOfflinePaymentToDraft(
          createBookingDraft(payload, snapshotPayload)
        );
        const createdBookings = await Booking.create(
          [
            {
              ...bookingDraft,
              bookingStatus: "confirmed",
              paymentCapturedAt: new Date(),
              paymentCurrency: PAYMENT_CURRENCY,
              paymentMethod: payload.paymentMethod,
              paymentStatus: "paid",
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
    const amountPaid = Math.round(payload.amountPaid || 0);

    booking = await Booking.create({
      ...payload,
      amountPaid,
      paymentCapturedAt: amountPaid > 0 ? new Date() : null,
      bookingStatus: amountPaid > 0 ? "confirmed" : "payment_pending",
      paymentCurrency: PAYMENT_CURRENCY,
      paymentMethod: payload.paymentMethod,
      paymentStatus: amountPaid > 0 ? "paid" : "pending",
    });
  }

  if (booking.paymentStatus === "paid") {
    await sendBookingConfirmationWhatsappIfNeeded(booking);
    await sendBookingConfirmationEmailIfNeeded(booking);
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
    const updatePayload = applyAdminOfflinePaymentToDraft(
      createBookingDraft(payload, snapshotPayload)
    );
    const isPaid = (updatePayload.amountPaid || 0) > 0;

    const booking = await Booking.findByIdAndUpdate(
      request.params.id,
      {
        ...updatePayload,
        bookingStatus: isPaid ? "confirmed" : "payment_pending",
        paymentCapturedAt: isPaid ? new Date() : null,
        paymentCurrency: PAYMENT_CURRENCY,
        paymentMethod: payload.paymentMethod,
        paymentStatus: isPaid ? "paid" : "pending",
      },
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

export async function archiveBooking(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findByIdAndUpdate(
      request.params.id,
      {
        archivedAt: new Date(),
      },
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
      message: "Booking archived successfully",
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
  const session = await mongoose.startSession();

  try {
    let booking: BookingDocument | null = null;

    await session.withTransaction(async () => {
      booking = await Booking.findByIdAndDelete(request.params.id).session(
        session
      );

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      if (shouldRestoreDeletedBookingSeats(booking)) {
        await TourDeparture.updateOne(
          {
            departureId: booking.departureId,
          },
          {
            $inc: {
              seatsAvailable:
                booking.paymentStatus === "paid"
                  ? booking.totalGuest
                  : booking.heldSeatCount || 0,
            },
          },
          {
            session,
          }
        );
      }

      await BookingPaymentSession.updateMany(
        {
          bookingId: booking._id,
          status: "pending",
        },
        {
          $set: {
            failureReason: "Booking deleted before payment completion",
            status: "expired",
          },
        },
        {
          session,
        }
      );
    });

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
  } finally {
    await session.endSession();
  }
}
