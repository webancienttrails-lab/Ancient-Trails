import { normalizeMobileNumber } from "../utils/mobileNumber";
import { PUBLIC_BOOKING_GST_PERCENTAGE } from "../config/booking-pricing";
import { withPaymentOrderLock } from "../services/booking/booking.order-lock";
import { queueBookingNotifications, stageNotificationEvent } from "../services/notifications/notification-events.service";
import { queueBookingPaymentLifecycle, runBookingPaymentLifecycleMaintenance, type PaymentLifecycleHooks } from "../services/booking/booking.payment-lifecycle";
import { verifiedPaymentMethod } from "../services/booking/booking.payment-method";
import { assertAdminLeadVerification } from "./bookingLead.controller";
import { resolveBookingEmergencyContact } from "../services/booking/booking.emergency-contact";
import { isAirfareExcluded, calculateAirfareTotals, creditAirfarePayment } from "../services/booking/booking.airfare";
import { notifyOfflineBookingAdmins, retryOfflineBookingAlerts } from "../services/booking/offline-booking-alert.service";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import Razorpay from "razorpay";
import { z } from "zod";

import {
  Booking,
  type BookingDocument,
  type IBookingChildDetails,
  type IBookingGuestDetails,
  type IBookingKycDocument,
  type IBookingTraveller,
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
  BookingPaymentLinkRequest,
  type BookingPaymentLinkPurpose,
  type BookingPaymentLinkRequestDocument,
} from "../models/bookingPaymentLinkRequest.model";
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
  sendBookingKycCompletedAlertEmail,
  sendBookingRecoveryEmail,
  type BookingConfirmationEmailPayload,
} from "../services/booking-confirmation-email.service";
import {
  sendBookingConfirmationWhatsapp,
  sendBookingPaymentLinkWhatsapp,
  sendBookingRecoveryWhatsapp,
} from "../services/msg91-whatsapp.service";
import { SmartCollectAccount, SmartCollectTransfer } from "../models/smartCollect.model";
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
const bookingKycUploadDirectory = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage",
  "booking-kyc"
);
const bookingKycMimeExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const bookingKycDocumentLabels: Record<IBookingKycDocument["documentType"], string> = {
  aadhaar_card: "Aadhaar Card",
  driving_license: "Driving License",
  voter_id: "Voter ID",
  passport: "Passport",
  pan_card: "PAN Card",
};

mkdirSync(bookingKycUploadDirectory, { recursive: true });

const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);

const optionalTextField = (max: number) => z.string().trim().max(max).default("");

const bookingKycUploadPayloadSchema = z.object({
  documentType: z.enum([
    "aadhaar_card",
    "driving_license",
    "voter_id",
    "passport",
    "pan_card",
  ]),
  travellerId: requiredTextField("Traveller ID", 80),
});

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
  email: optionalEmailField,
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
    emergencyContactName: z.string().trim().max(120).optional(),
    emergencyContactMobileNumber: optionalMobileNumberField.optional(),
    tourId: requiredCodeField("Tour ID", 40),
    departureId: requiredCodeField("Departure ID", 40).optional(),
    selectedAccommodationOptionId: z.string().trim().max(200).optional(),
    paymentOption: z.enum(["advance", "full"]).default("advance"),
    paymentMethod: z.enum(["cash", "cheque", "neft", "imps", "rtgs", "upi", "netbanking", "card", "wallet", "emi", "razorpay", "bank_transfer"]).optional(),
    paymentMode: z.enum(["online", "offline", "bank_transfer"]).optional(),
    leadVerificationToken: z.string().optional(),
    amountPaid: z.coerce.number().min(0).max(1000000000).optional(),
    airFlightCharges: z.coerce.number().min(0).max(1000000000).default(0),
    airfareIncludedInTotal: z.boolean().optional(),
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
    if (payload.guestDetails.length > 0 && !payload.guestDetails[0].email) {
      context.addIssue({
        code: "custom",
        path: ["guestDetails", 0, "email"],
        message: "Lead traveller email is required",
      });
    }

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

const airFlightChargesPayloadSchema = z.object({
  airfareIncludedInTotal: z.boolean().optional(),
  airFlightCharges: z.number().int("Airfare must be a whole rupee amount").min(0).max(1000000000),
});

const paymentVerificationPayloadSchema = z.object({
  razorpay_order_id: requiredTextField("Razorpay order ID", 120),
  razorpay_payment_id: requiredTextField("Razorpay payment ID", 120),
  razorpay_signature: requiredTextField("Razorpay signature", 256),
});

const paymentCancellationPayloadSchema = z.object({
  orderId: requiredTextField("Razorpay order ID", 120),
});

const adminPaymentLinkPurposeSchema = z.enum([
  "final",
  "additional",
  "partial",
  "custom",
]);

const adminPaymentLinkPayloadSchema = z.object({
  additionalChargeAlreadyApplied: z.boolean().default(false),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number")
    .min(1, "Amount must be greater than zero")
    .max(1000000000, "Amount is too high")
    .optional(),
  description: optionalTextField(500),
  purpose: adminPaymentLinkPurposeSchema,
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

function createSafeKycFileName(file: Express.Multer.File): string {
  const baseName =
    path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "kyc-document";
  const extension =
    bookingKycMimeExtensions[file.mimetype] ||
    path.extname(file.originalname).toLowerCase() ||
    ".pdf";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${baseName}-${suffix}${extension}`;
}

function getBookingKycUploadUrl(file: Express.Multer.File): string {
  return `/uploads/booking-kyc/${file.filename}`;
}

export const bookingKycUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, bookingKycUploadDirectory);
    },
    filename: (_request, file, callback) => {
      callback(null, createSafeKycFileName(file));
    },
  }),
  fileFilter: (_request, file, callback) => {
    if (file.mimetype in bookingKycMimeExtensions) {
      callback(null, true);
      return;
    }

    callback(new HttpError(400, "Only PDF, JPG, PNG, and WebP files are allowed"));
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

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

// Booking result links are identifiers, not bearer credentials. Authorize the verified lead phone.
export async function getAuthenticatedTravellerBookingById(request: Request, bookingId = String(request.params.id)) {
  if (!mongoose.isValidObjectId(bookingId)) throw new HttpError(400, "Invalid booking ID");
  const traveller = await getAuthenticatedTraveller(request);
  if (!traveller.isMobileVerified) throw new HttpError(403, "Verify your mobile number to view this booking");
  const phones = getMobileSearchValues(traveller.mobileNumber);
  if (!phones.length) throw new HttpError(403, "A verified mobile number is required");
  const booking = await Booking.findOne({
    _id: bookingId,
    "guestDetails.0.mobileNumber": { $in: phones.map(createLooseDigitsRegex) },
  });
  if (!booking) throw new HttpError(404, "Booking not found for this account");
  const lead = booking.guestDetails[0];
  const leadDigits = (lead?.mobileNumber || "").replace(/\D/g, "");
  const countryCode = (lead?.countryCode || "").replace(/\D/g, "");
  const leadPhone = leadDigits.length > 10 && leadDigits.startsWith(countryCode)
    ? leadDigits : countryCode + leadDigits;
  if (leadPhone !== normalizeMobileNumber(traveller.mobileNumber || "")) {
    throw new HttpError(404, "Booking not found for this account");
  }
  return booking;
}

function setPrivateBookingHeaders(response: Response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
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
    bookingStatus: { $nin: ["cancelled", "expired"] },
    paymentStatus: "paid",
  };
}

function getBookingDepartureId(booking: BookingDocument) {
  return booking.departureId || booking.pricingSnapshot?.departureId || "";
}

function hasActiveSeatHold(booking: BookingDocument, now = new Date()) {
  return (
    (booking.heldSeatCount || 0) > 0 &&
    Boolean(booking.holdExpiresAt) &&
    booking.holdExpiresAt!.getTime() > now.getTime()
  );
}

function getBookingReservedSeatCount(booking: BookingDocument, now = new Date()) {
  const bookingStatus = booking.bookingStatus || "payment_pending";

  if (
    booking.paymentStatus === "paid" &&
    bookingStatus !== "cancelled" &&
    bookingStatus !== "expired"
  ) {
    return Math.max(0, booking.totalGuest || 0);
  }

  if (
    booking.paymentStatus !== "paid" &&
    bookingStatus === "payment_pending" &&
    hasActiveSeatHold(booking, now)
  ) {
    return Math.max(0, booking.heldSeatCount || 0);
  }

  return 0;
}

function shouldRestoreDeletedBookingSeats(booking: BookingDocument) {
  return (
    Boolean(getBookingDepartureId(booking)) &&
    getBookingReservedSeatCount(booking) > 0
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

function formatKycDocument(document: IBookingKycDocument) {
  return {
    id: document.id,
    documentType: document.documentType,
    documentLabel: document.documentLabel,
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    mimeType: document.mimeType,
    uploadedBy: document.uploadedBy,
    uploadedAt: document.uploadedAt,
  };
}

export function formatBooking(booking: BookingDocument, tour?: { inclusions?: string[]; exclusions?: string[] } | null) {
  return {
    id: booking._id.toString(),
    cancellation: booking.cancellation || null,
    ...resolveBookingEmergencyContact(booking),
    bookingReference:
      booking.bookingReference || getBookingReference(booking),
    bookingStatus:
      booking.bookingStatus ||
      (booking.paymentStatus === "paid" ? "confirmed" : "payment_pending"),
    tourId: booking.tourId,
    departureId: booking.departureId || "",
    selectedAccommodationOptionId: booking.selectedAccommodationOptionId || "",
    paymentOption: booking.paymentOption || "advance",
    paymentMode: booking.paymentMode || "online",
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
      kycDocuments: (traveller.kycDocuments || []).map(formatKycDocument),
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
    airFlightCharges: booking.airFlightCharges || 0,
    airfareIncludedInTotal: booking.airfareIncludedInTotal || false,
    airfareExcluded: booking.airfareExcluded ?? (tour ? isAirfareExcluded(tour) : undefined),
    airfareAddedAt: booking.airfareAddedAt,
    airfareHistory: booking.airfareHistory || [],
    collectionHistory: booking.collectionHistory || [],
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
    finalPaymentUrl: getFinalPaymentUrl(booking),
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
    totalSeats: departure.totalSeats,
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
  payload: z.infer<typeof bookingPayloadSchema>,
  existingBooking?: BookingDocument
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

  if (
    existingBooking &&
    getBookingDepartureId(existingBooking) === payload.departureId
  ) {
    pricedDeparture.seatsAvailable += getBookingReservedSeatCount(existingBooking);
  }

  const departureValidation = validateDepartureForBooking(
    pricedDeparture,
    payload.totalGuest,
    new Date(),
    (await Tour.findOne({ tourId: departure.tourId }))?.durationDn
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

export async function reserveDepartureSeats(
  departureId: string | undefined,
  totalGuest: number,
  session?: mongoose.ClientSession
) {
  const updatedDeparture = await TourDeparture.findOneAndUpdate(
    createScheduledDepartureReservationFilter(departureId, totalGuest),
    {
      $inc: {
        seatsAvailable: -totalGuest,
      },
    },
    {
      new: true,
      session,
    }
  );

  if (!updatedDeparture) {
    return null;
  }

  const seatsBeforeReservation = Math.max(
    0,
    (updatedDeparture.seatsAvailable || 0) + totalGuest
  );

  if ((updatedDeparture.totalSeats || 0) < seatsBeforeReservation) {
    updatedDeparture.totalSeats = seatsBeforeReservation;
    await updatedDeparture.save({ session });
  }

  return updatedDeparture;
}

export async function restoreDepartureSeats(
  departureId: string | undefined,
  seatCount: number,
  session?: mongoose.ClientSession
) {
  const seatsToRestore = Math.max(0, Math.trunc(seatCount || 0));

  if (!departureId || seatsToRestore <= 0) {
    return;
  }

  const departure = await TourDeparture.findOne({ departureId }).session(
    session || null
  );

  if (!departure) {
    return;
  }

  const restoredSeatsAvailable = (departure.seatsAvailable || 0) + seatsToRestore;
  const totalSeats =
    (departure.totalSeats || 0) > 0
      ? Math.max(0, departure.totalSeats || 0)
      : restoredSeatsAvailable;

  departure.totalSeats = totalSeats;
  departure.seatsAvailable = Math.min(
    restoredSeatsAvailable,
    departure.totalSeats
  );
  await departure.save({ session });
  return departure;
}

async function createBookingDraft(
  payload: BookingPayload,
  snapshotPayload: BookingSnapshotPayload,
  savedAirfareEligibility?: boolean,
  existingBooking?: BookingDocument
): Promise<BookingDraft> {
  const tour = await Tour.findOne({ tourId: payload.tourId });
  const airfareExcluded = savedAirfareEligibility ?? isAirfareExcluded(tour);
  if (payload.airFlightCharges > 0 && !airfareExcluded) {
    throw new HttpError(400, "Additional airfare is only allowed when flights are excluded from the tour price");
  }
  const airfareIncludedInTotal = existingBooking?.airfareIncludedInTotal ?? payload.airfareIncludedInTotal ?? false;
  const bookingPayload = { ...payload, airfareExcluded, airfareIncludedInTotal, ...resolveBookingEmergencyContact(payload, existingBooking) };
  const airFlightCharges = toPaymentAmount(payload.airFlightCharges);

  if (!snapshotPayload) {
    return {
      ...bookingPayload,
      airFlightCharges,
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
    airFlightCharges,
    travellers: snapshotPayload.travellers,
    pricingSnapshot: snapshotPayload.pricingSnapshot,
    subtotal: snapshotPayload.pricingSnapshot.subtotal,
    gstPercentage: snapshotPayload.pricingSnapshot.gstPercentage,
    gstAmount: snapshotPayload.pricingSnapshot.gstAmount,
    grandTotal: snapshotPayload.pricingSnapshot.grandTotal + (airfareIncludedInTotal ? 0 : airFlightCharges),
    depositAmount: snapshotPayload.pricingSnapshot.depositAmount,
    balanceAmount: snapshotPayload.pricingSnapshot.balanceAmount + (airfareIncludedInTotal ? 0 : airFlightCharges),
    balanceDueDate: snapshotPayload.pricingSnapshot.balanceDueDate,
  };
}

function mergeTravellerKycDocuments(
  nextTravellers: IBookingTraveller[],
  existingTravellers: IBookingTraveller[] = []
) {
  const documentsByTravellerId = new Map(
    existingTravellers.map((traveller) => [
      traveller.id,
      traveller.kycDocuments || [],
    ])
  );

  return nextTravellers.map((traveller) => ({
    ...traveller,
    kycDocuments: documentsByTravellerId.get(traveller.id) || traveller.kycDocuments || [],
  }));
}

function hasKycForEveryTraveller(booking: BookingDocument) {
  return (
    booking.travellers.length > 0 &&
    booking.travellers.every((traveller) => (traveller.kycDocuments || []).length > 0)
  );
}

async function sendKycCompletionAlertIfNeeded(booking: BookingDocument) {
  if (!hasKycForEveryTraveller(booking) || booking.kycCompletionEmailSentAt) {
    return;
  }

  booking.kycCompletionEmailAttemptedAt = new Date();
  booking.kycCompletionEmailError = "";
  await booking.save();

  try {
    const [tour] = await Promise.all([
      Tour.findOne({ tourId: booking.tourId }),
    ]);
    const leadGuest = booking.guestDetails[0];
    const result = await sendBookingKycCompletedAlertEmail({
      bookingReference: getBookingReference(booking),
      documentSummary: booking.travellers.map((traveller, index) => ({
        documents: (traveller.kycDocuments || []).map(
          (document) => document.documentLabel
        ),
        travellerName:
          [traveller.firstName, traveller.lastName]
            .map((value) => value?.trim() || "")
            .filter(Boolean)
            .join(" ") || `Traveller ${index + 1}`,
      })),
      tourName: tour?.tourName || booking.tourId,
      travellerEmail: leadGuest?.email || "",
      travellerName: getGuestFullName(leadGuest) || "Traveller",
      travellerPhone: leadGuest
        ? `${leadGuest.countryCode} ${leadGuest.mobileNumber}`.trim()
        : "",
      travellersLabel: formatTravellerCountLabel(
        booking.adultCount,
        booking.childCount
      ),
    });

    booking.kycCompletionEmailSentAt =
      result.recipients.length > 0 ? new Date() : null;
    booking.kycCompletionEmailError = "";
    await booking.save();
  } catch (error) {
    booking.kycCompletionEmailError =
      error instanceof Error ? error.message.slice(0, 500) : "KYC alert failed";
    await booking.save();
    console.error(
      `[booking-kyc-email] Failed KYC alert for booking ${booking._id.toString()}: ${booking.kycCompletionEmailError}`
    );
  }
}

export function getRazorpayCredentials() {
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

export function createRazorpayClient() {
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
  const amountPaid = toPaymentAmount(bookingDraft.amountPaid || 0);
  const total = getBookingDraftTotalAmount(bookingDraft);
  if (total > 0 && amountPaid > total) throw new HttpError(400, "Amount received cannot exceed the booking total");
  return amountPaid;
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
  requestHash,
  idempotencyKey,
}: {
  amount: number;
  amountRupees: number;
  bookingDraft: BookingDraft;
  orderId: string;
  pendingBookingKey: string;
  receipt: string;
  requestHash?: string;
  idempotencyKey?: string;
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
          await restoreDepartureSeats(
            bookingToHold.departureId,
            bookingToHold.heldSeatCount || 0,
            databaseSession
          );
        }

        const updatedDeparture = await reserveDepartureSeats(
          bookingDraft.departureId,
          bookingDraft.totalGuest,
          databaseSession
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
            requestHash,
            idempotencyKeys: idempotencyKey ? [idempotencyKey] : undefined,
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

      const departureId = booking ? getBookingDepartureId(booking) : "";

      if (
        releaseHeldSeats &&
        booking &&
        booking.paymentStatus !== "paid" &&
        (booking.heldSeatCount || 0) > 0 &&
        departureId
      ) {
        await restoreDepartureSeats(
          departureId,
          booking.heldSeatCount || 0,
          databaseSession
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

  const departureId = booking ? getBookingDepartureId(booking) : "";

  if (!booking || !departureId || (booking.heldSeatCount || 0) <= 0) {
    return false;
  }

  await restoreDepartureSeats(
    departureId,
    booking.heldSeatCount || 0,
    databaseSession
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

  const departureId = activeHoldBooking
    ? getBookingDepartureId(activeHoldBooking)
    : "";
  const heldSeatCount = activeHoldBooking?.heldSeatCount || 0;

  if (departureId && heldSeatCount > 0) {
    await restoreDepartureSeats(
      departureId,
      heldSeatCount,
      databaseSession
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
  await retryOfflineBookingAlerts();
  await runBookingPaymentLifecycleMaintenance(bookingPaymentLifecycleHooks());
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

export async function getAuthenticatedTravellerPaidBookingById(request: Request) {
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
  paymentMethod,
  signature,
  session,
}: {
  paymentId: string;
  paymentMethod?: string;
  signature: string;
  session: BookingBalancePaymentSessionDocument;
}): Promise<BookingDocument> {
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
      const amountPaid = Math.round((booking.amountPaid || 0) + claimedSession.amountRupees);
      if (!recordAirfareCollection(booking, paymentId, claimedSession.amountRupees)) {
        updatedBooking = booking;
        return;
      }
      const balanceAmount = Math.max(0, Math.round(totalAmount - amountPaid));

      booking.amountPaid = amountPaid;
      booking.balanceAmount = balanceAmount;
      booking.paymentCurrency = claimedSession.currency;
      booking.paymentId = paymentId;
      booking.paymentOrderId = claimedSession.razorpayOrderId;
      booking.paymentProvider = "razorpay";
      booking.paymentMethod = verifiedPaymentMethod(paymentMethod);
      booking.paymentStatus = "paid";
      booking.paymentCapturedAt = new Date();
      booking.balanceDueDate = balanceAmount > 0 ? booking.balanceDueDate : null;

      await booking.save({ session: databaseSession });

      updatedBooking = booking;
    });
  } finally {
    await databaseSession.endSession();
  }

  if (!updatedBooking) {
    throw new HttpError(500, "Balance payment could not be applied");
  }

  queueAirfareConfirmation(updatedBooking);
  const confirmedBooking = updatedBooking as BookingDocument | null;
  if (confirmedBooking?.bookingStatus === "confirmed") queueBookingConfirmationNotifications(confirmedBooking);
  return updatedBooking;
}

async function applyVerifiedPaymentLinkRequest({
  paymentId,
  paymentLinkRequest,
}: {
  paymentId: string;
  paymentLinkRequest: BookingPaymentLinkRequestDocument;
}): Promise<BookingDocument | null> {
  if (paymentLinkRequest.status === "paid") return Booking.findById(paymentLinkRequest.bookingId);
  const razorpay = createRazorpayClient();
  const link = await razorpay.paymentLink.fetch(paymentLinkRequest.razorpayPaymentLinkId);
  const linkedPaymentId = getPaymentLinkPaidPaymentId(link);
  if (link.status !== "paid" || Number(link.amount) !== paymentLinkRequest.amount
      || Number(link.amount_paid) !== paymentLinkRequest.amount || link.currency !== paymentLinkRequest.currency
      || !linkedPaymentId || (paymentId && linkedPaymentId !== paymentId)) {
    throw new HttpError(400, "Payment link settlement does not match the booking payment request");
  }
  paymentId = linkedPaymentId;
  const capturedPayment = await captureVerifiedPayment({ amount: paymentLinkRequest.amount, currency: paymentLinkRequest.currency,
    paymentId, razorpay });
  let updatedBooking: BookingDocument | null = null;
  const databaseSession = await mongoose.startSession();

  try {
    await databaseSession.withTransaction(async () => {
      const claimedRequest = await BookingPaymentLinkRequest.findOneAndUpdate(
        {
          _id: paymentLinkRequest._id,
          status: { $in: ["created", "sent", "failed", "expired"] },
        },
        {
          $set: {
            paidAt: new Date(),
            razorpayPaymentId: paymentId,
            status: "paid",
          },
        },
        {
          new: true,
          session: databaseSession,
        }
      );

      if (!claimedRequest) {
        updatedBooking = await Booking.findById(
          paymentLinkRequest.bookingId
        ).session(databaseSession);
        return;
      }

      const booking = await Booking.findById(claimedRequest.bookingId).session(
        databaseSession
      );

      if (!booking) {
        throw new HttpError(404, "Booking not found");
      }

      if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "expired") {
        claimedRequest.status = "failed";
        claimedRequest.failureReason =
          "Payment received for cancelled or expired booking; booking was not reactivated";
        await claimedRequest.save({ session: databaseSession });
        updatedBooking = booking;
        return;
      }

      const amountRupees = toPaymentAmount(claimedRequest.amountRupees);
      const totalAmount = toPaymentAmount(booking.grandTotal || 0);
      const currentPaid = toPaymentAmount(booking.amountPaid || 0);

      if (!recordAirfareCollection(booking, paymentId, amountRupees)) {
        updatedBooking = booking;
        return;
      }
      if (claimedRequest.purpose === "additional") {
        if (!claimedRequest.additionalChargeAppliedAt) {
          booking.grandTotal = totalAmount + amountRupees;
          claimedRequest.additionalChargeAppliedAt = new Date();
        }

        booking.amountPaid = currentPaid + amountRupees;
        booking.balanceAmount = Math.max(
          0,
          toPaymentAmount(booking.grandTotal || 0) - booking.amountPaid
        );
      } else {
        booking.amountPaid = currentPaid + amountRupees;
        booking.balanceAmount = Math.max(0, totalAmount - booking.amountPaid);
      }

      booking.bookingStatus =
        booking.bookingStatus === "payment_pending" || booking.bookingStatus === "draft"
          ? "confirmed"
          : booking.bookingStatus;
      booking.paymentCapturedAt = new Date();
      booking.paymentCurrency = claimedRequest.currency;
      booking.paymentId = paymentId;
      booking.paymentMethod = verifiedPaymentMethod(capturedPayment.method);
      booking.paymentOrderId = claimedRequest.razorpayPaymentLinkId;
      booking.paymentProvider = "razorpay";
      booking.paymentStatus = "paid";
      booking.balanceDueDate =
        (booking.balanceAmount || 0) > 0 ? booking.balanceDueDate : null;
      booking.confirmationToken =
        booking.confirmationToken || createConfirmationToken();

      await claimedRequest.save({ session: databaseSession });
      await booking.save({ session: databaseSession });
      updatedBooking = booking;
    });
  } finally {
    await databaseSession.endSession();
  }

  queueAirfareConfirmation(updatedBooking);
  const confirmedBooking = updatedBooking as BookingDocument | null;
  if (confirmedBooking?.bookingStatus === "confirmed") queueBookingConfirmationNotifications(confirmedBooking);
  return updatedBooking;
}

function createConfirmationToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function ensureBookingConfirmationToken(booking: BookingDocument) {
  if (booking.confirmationToken) {
    return booking.confirmationToken;
  }

  booking.confirmationToken = createConfirmationToken();
  await booking.save();

  return booking.confirmationToken;
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
  return hasActiveSeatHold(booking, now);
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

  return `${frontendBaseUrl}/booking/recover/${booking._id.toString()}`;
}

function getFinalPaymentUrl(booking: BookingDocument) {
  const frontendBaseUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");

  if (
    !frontendBaseUrl ||
    !isAirFlightFinalPaymentEligible(booking)
  ) {
    return "";
  }

  return `${frontendBaseUrl}/me/bookings/${booking._id.toString()}`;
}

const paymentLinkPurposeLabels: Record<BookingPaymentLinkPurpose, string> = {
  additional: "Additional Charges",
  custom: "Custom Payment",
  final: "Final Payment",
  partial: "Partial Payment",
};

function getPaymentLinkExpiryDate(now = new Date()) {
  const expiryHours = Number(process.env.RAZORPAY_PAYMENT_LINK_EXPIRY_HOURS || 72);

  return new Date(now.getTime() + Math.max(1, expiryHours) * 60 * 60 * 1000);
}

function getPaymentLinkReturnUrl(booking: BookingDocument) {
  const frontendBaseUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");

  if (!frontendBaseUrl) {
    return undefined;
  }

  return `${frontendBaseUrl}/me/bookings/${booking._id.toString()}`;
}

function formatRupeeAmountForTemplate(amount: number) {
  return String(Math.max(0, Math.round(amount)));
}

function getBookingOutstandingAmount(booking: BookingDocument) {
  const { balanceAmount, totalAmount, amountPaid } = getBookingEmailAmounts(booking);

  if (totalAmount > 0) {
    return Math.max(0, Math.round(totalAmount - amountPaid));
  }

  return Math.max(0, Math.round(balanceAmount));
}

function getPaymentLinkObligationKey({
  amountRupees,
  description,
  purpose,
}: {
  amountRupees: number;
  description: string;
  purpose: BookingPaymentLinkPurpose;
}) {
  if (purpose === "final") {
    return "final";
  }

  const normalizedDescription = description
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 120);

  return `${purpose}:${amountRupees}:${normalizedDescription}`;
}

function isActivePaymentLinkRequest(
  request: BookingPaymentLinkRequestDocument,
  now = new Date()
) {
  return (
    (request.status === "created" || request.status === "sent") &&
    Boolean(request.paymentLinkUrl) &&
    (!request.expiresAt || request.expiresAt.getTime() > now.getTime())
  );
}

function formatPaymentLinkRequest(request: BookingPaymentLinkRequestDocument) {
  return {
    id: request._id.toString(),
    bookingId: request.bookingId.toString(),
    purpose: request.purpose,
    purposeLabel: request.purposeLabel,
    amount: request.amount,
    amountRupees: request.amountRupees,
    currency: request.currency,
    description: request.description || "",
    razorpayPaymentLinkId: request.razorpayPaymentLinkId,
    razorpayPaymentId: request.razorpayPaymentId || "",
    paymentLinkUrl: request.paymentLinkUrl,
    status: request.status,
    whatsappStatus: request.whatsappStatus,
    whatsappRecipient: request.whatsappRecipient || "",
    whatsappRequestId: request.whatsappRequestId || "",
    whatsappError: request.whatsappError || "",
    expiresAt: request.expiresAt || null,
    paidAt: request.paidAt || null,
    cancelledAt: request.cancelledAt || null,
    failureReason: request.failureReason || "",
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

async function listPaymentLinkRequestsForBooking(bookingId: mongoose.Types.ObjectId) {
  return BookingPaymentLinkRequest.find({ bookingId }).sort({ createdAt: -1 });
}

async function sendWhatsappForPaymentLinkRequest({
  booking,
  paymentLinkRequest,
  tour,
}: {
  booking: BookingDocument;
  paymentLinkRequest: BookingPaymentLinkRequestDocument;
  tour: TourDocument | null;
}) {
  const leadGuest = booking.guestDetails[0];
  const recipientNumber = normalizeWhatsappRecipientNumber(leadGuest);

  assertWhatsappLinkCanBeDelivered(paymentLinkRequest.paymentLinkUrl);

  try {
    const result = await sendBookingPaymentLinkWhatsapp({
      amount: formatRupeeAmountForTemplate(paymentLinkRequest.amountRupees),
      bookingReference: getBookingReference(booking),
      crqId: `booking_payment_link_${paymentLinkRequest._id.toString()}_${crypto.randomUUID()}`,
      paymentPurpose: paymentLinkRequest.purposeLabel,
      paymentUrl: paymentLinkRequest.paymentLinkUrl,
      recipientNumber,
      tourName: tour?.tourName || booking.tourId,
      travellerName: getGuestFullName(leadGuest) || "Traveller",
    });

    paymentLinkRequest.status =
      paymentLinkRequest.status === "created" ? "sent" : paymentLinkRequest.status;
    paymentLinkRequest.whatsappError = "";
    paymentLinkRequest.whatsappRecipient = recipientNumber;
    paymentLinkRequest.whatsappRequestId = result.requestId;
    paymentLinkRequest.whatsappStatus = "sent";
  } catch (error) {
    paymentLinkRequest.whatsappError = truncateNotificationError(
      getWhatsappErrorMessage(error)
    );
    paymentLinkRequest.whatsappRecipient = recipientNumber;
    paymentLinkRequest.whatsappStatus = "failed";
  }

  await paymentLinkRequest.save();
  return paymentLinkRequest;
}

function getPaymentLinkPaidPaymentId(
  paymentLink: {
    payments?: unknown;
  },
  fallback = ""
) {
  const payments = paymentLink.payments;

  if (Array.isArray(payments)) {
    const paidPayment = payments.find(
      (item) =>
        item &&
        typeof item === "object" &&
        "payment_id" in item &&
        ((item as { status?: unknown }).status === "captured" ||
          (item as { status?: unknown }).status === "paid")
    ) as { payment_id?: unknown } | undefined;

    return typeof paidPayment?.payment_id === "string"
      ? paidPayment.payment_id
      : fallback;
  }

  if (payments && typeof payments === "object" && "payment_id" in payments) {
    const paymentId = (payments as { payment_id?: unknown }).payment_id;

    return typeof paymentId === "string" ? paymentId : fallback;
  }

  return fallback;
}

async function syncPaymentLinkRequestsForBookings(
  bookingIds: mongoose.Types.ObjectId[]
) {
  const uniqueBookingIds = Array.from(
    new Set(bookingIds.map((bookingId) => bookingId.toString()))
  );

  if (uniqueBookingIds.length === 0) {
    return;
  }

  const paymentLinkRequests = await BookingPaymentLinkRequest.find({
    bookingId: { $in: uniqueBookingIds },
    status: { $in: ["created", "sent", "failed", "expired"] },
  });

  if (paymentLinkRequests.length === 0) {
    return;
  }

  let razorpay: Razorpay;

  try {
    razorpay = createRazorpayClient();
  } catch (error) {
    console.error("[payment-link-sync] Razorpay client is unavailable:", error);
    return;
  }

  await Promise.all(
    paymentLinkRequests.map(async (paymentLinkRequest) => {
      try {
        const paymentLink = await razorpay.paymentLink.fetch(
          paymentLinkRequest.razorpayPaymentLinkId
        );

        if (paymentLink.status === "paid") {
          await applyVerifiedPaymentLinkRequest({
            paymentId: getPaymentLinkPaidPaymentId(
              paymentLink,
              paymentLinkRequest.razorpayPaymentId || ""
            ),
            paymentLinkRequest,
          });
          return;
        }

        if (paymentLink.status === "cancelled") {
          await BookingPaymentLinkRequest.updateOne(
            {
              _id: paymentLinkRequest._id,
              status: { $ne: "paid" },
            },
            {
              $set: {
                cancelledAt: paymentLinkRequest.cancelledAt || new Date(),
                failureReason:
                  paymentLinkRequest.failureReason ||
                  "Razorpay payment link is cancelled",
                status: "cancelled",
              },
            }
          );
          return;
        }

        if (paymentLink.status === "expired") {
          await BookingPaymentLinkRequest.updateOne(
            {
              _id: paymentLinkRequest._id,
              status: { $nin: ["paid", "cancelled"] },
            },
            {
              $set: {
                failureReason:
                  paymentLinkRequest.failureReason ||
                  "Razorpay payment link expired",
                status: "expired",
              },
            }
          );
        }
      } catch (error) {
        console.error(
          `[payment-link-sync] Failed to sync ${paymentLinkRequest.razorpayPaymentLinkId}:`,
          error
        );
      }
    })
  );
}

function isPrivateHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost")
  ) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedHostname)) {
    const [first = 0, second = 0] = normalizedHostname
      .split(".")
      .map((part) => Number(part));

    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  return false;
}

function assertWhatsappLinkCanBeDelivered(link: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(link);
  } catch {
    throw new HttpError(500, "Final payment URL is invalid");
  }

  if (parsedUrl.protocol !== "https:" || isPrivateHostname(parsedUrl.hostname)) {
    throw new HttpError(
      400,
      "WhatsApp payment links must use a public HTTPS FRONTEND_URL. Localhost/private URLs can be accepted by MSG91 but will not deliver correctly to travellers."
    );
  }
}

async function createPaidBookingFromPaymentSession({
  paymentId,
  paymentMethod,
  signature,
  session,
}: {
  paymentId: string;
  paymentMethod?: string;
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
          const departureId = getBookingDepartureId(booking);

          if ((booking.heldSeatCount || 0) > 0 && departureId) {
            await restoreDepartureSeats(
              departureId,
              booking.heldSeatCount || 0,
              databaseSession
            );
          }

          const updatedDeparture = await reserveDepartureSeats(
            departureId,
            booking.totalGuest,
            databaseSession
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
        booking.paymentMethod = verifiedPaymentMethod(paymentMethod);
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

  return `${frontendBaseUrl}/booking-confirmed/${booking._id.toString()}`;
}

function getBookingEmailAmounts(booking: BookingDocument) {
  const snapshot = booking.pricingSnapshot;
  const totalAmount =
    toPaymentAmount(booking.grandTotal || snapshot?.grandTotal || booking.subtotal || 0);
  const savedAmountPaid = toPaymentAmount(booking.amountPaid || 0);
  const savedBalanceAmount = toPaymentAmount(
    booking.balanceAmount ?? snapshot?.balanceAmount ?? 0
  );
  const amountPaid =
    savedAmountPaid > 0
      ? savedAmountPaid
      : savedBalanceAmount > 0 && totalAmount > 0
        ? Math.max(0, totalAmount - savedBalanceAmount)
      : booking.paymentOption === "full" && totalAmount > 0
        ? totalAmount
        : 0;
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

function getBookingPaidAmountForChargeUpdate(booking: BookingDocument) {
  const currentTotal = toPaymentAmount(booking.grandTotal || 0);
  const currentBalance = toPaymentAmount(booking.balanceAmount || 0);
  const savedAmountPaid = toPaymentAmount(booking.amountPaid || 0);

  if (savedAmountPaid > 0) {
    return savedAmountPaid;
  }

  if (currentTotal > 0 && currentBalance > 0) {
    return Math.max(0, currentTotal - currentBalance);
  }

  if (booking.paymentOption === "full" && booking.paymentStatus === "paid") {
    return currentTotal;
  }

  return 0;
}

function isAirFlightFinalPaymentEligible(booking: BookingDocument) {
  const airFlightCharges = toPaymentAmount(booking.airFlightCharges || 0);
  const { amountPaid, balanceAmount, totalAmount } =
    getBookingEmailAmounts(booking);
  const originalPackageTotal = Math.max(0, totalAmount - airFlightCharges);

  return Boolean(
    booking.paymentStatus === "paid" &&
      airFlightCharges > 0 &&
      balanceAmount > 0 &&
      originalPackageTotal > 0 &&
      amountPaid >= originalPackageTotal
  );
}

function applyAirFlightChargesToBooking(
  booking: BookingDocument,
  airFlightCharges: number,
  includedInTotal = booking.airfareIncludedInTotal || false
) {
  const previousAirFlightCharges = toPaymentAmount(
    booking.airFlightCharges || 0
  );
  const currentTotal = toPaymentAmount(booking.grandTotal || 0);
  const nextAirFlightCharges = toPaymentAmount(airFlightCharges);
  const amountPaid = getBookingPaidAmountForChargeUpdate(booking);
  let totals;
  try {
    totals = calculateAirfareTotals(currentTotal, previousAirFlightCharges, nextAirFlightCharges, amountPaid, {
      previousIncluded: booking.airfareIncludedInTotal || false, included: includedInTotal,
    });
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid airfare");
  }
  const { grandTotal: nextTotal, balanceAmount } = totals;

  booking.airfareIncludedInTotal = includedInTotal;
  booking.airFlightCharges = nextAirFlightCharges;
  booking.grandTotal = nextTotal;
  booking.amountPaid = amountPaid;
  booking.balanceAmount = balanceAmount;
  booking.balanceDueDate =
    balanceAmount > 0
      ? booking.balanceDueDate ||
        booking.pricingSnapshot?.balanceDueDate ||
        null
      : null;

  // Updating charges does not represent another payment or booking confirmation.
}

function createBookingDraftFromBooking(booking: BookingDocument): BookingDraft {
  return {
    ...resolveBookingEmergencyContact(booking),
    accommodationDetails: booking.accommodationDetails,
    adultCount: booking.adultCount,
    airFlightCharges: booking.airFlightCharges || 0,
    airfareIncludedInTotal: booking.airfareIncludedInTotal || false,
    airfareExcluded: booking.airfareExcluded,
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
  return getAuthenticatedTravellerBookingById(request);
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
        bookingStatus: "confirmed",
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
      airFlightCharges: claimedBooking.airFlightCharges || 0,
      airfareIncludedInTotal: claimedBooking.airfareIncludedInTotal || false,
      airfareExcluded: claimedBooking.airfareExcluded ?? isAirfareExcluded(tour),
      airfareAddedAt: claimedBooking.airfareAddedAt,
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
        bookingStatus: "confirmed",
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
    const { amountPaid, balanceAmount } = getBookingEmailAmounts(claimedBooking);
    const result = await sendBookingConfirmationWhatsapp({
      amountPaid: formatRupeeAmountForTemplate(amountPaid),
      paymentStatus: balanceAmount > 0 ? "Partially Paid" : "Paid in Full",
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

export function queueBookingConfirmationNotifications(booking: BookingDocument) {
  queueBookingNotifications(booking.id);
  queueBookingPaymentLifecycle(booking, bookingPaymentLifecycleHooks());
  void Promise.allSettled([
    sendBookingConfirmationWhatsappIfNeeded(booking),
    sendBookingConfirmationEmailIfNeeded(booking),
  ]).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[booking-notification] Background ${
            index === 0 ? "WhatsApp" : "email"
          } confirmation task failed for booking ${booking._id.toString()}: ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`
        );
      }
    });
  });
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
    totalSeats: Math.max(
      departure.totalSeats || 0,
      departure.seatsAvailable || 0
    ),
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

export async function createOfflineBooking(request: Request, response: Response): Promise<void> {
  const payload = parseRequestBody(bookingPayloadSchema, {
    ...request.body,
    gstPercentage: PUBLIC_BOOKING_GST_PERCENTAGE,
    amountPaid: 0,
    airFlightCharges: 0,
    airfareIncludedInTotal: false,
    paymentMethod: undefined,
  });
  if (!payload.departureId || !payload.selectedAccommodationOptionId) {
    throw new HttpError(400, "Select a departure and accommodation before requesting offline payment");
  }
  await assertTourExists(payload.tourId);
  const pendingBookingKey = 'offline:' + crypto.createHash('sha256').update(createPendingBookingKey(payload) + JSON.stringify(payload.guestDetails) + JSON.stringify(payload.travellers)).digest('hex');
  let booking = await Booking.findOne({ pendingBookingKey });
  if (!booking) {
    const snapshot = await createSnapshotPayload(payload);
    if (!snapshot) throw new HttpError(400, "Booking prices could not be calculated");
    const draft = await createBookingDraft(payload, snapshot);
    try {
      booking = await Booking.create({
        ...draft,
        pendingBookingKey,
        paymentMode: "offline",
        offlineSubmissionToken: createConfirmationToken(),
        amountPaid: 0,
        balanceAmount: draft.grandTotal,
        paymentStatus: "pending",
        bookingStatus: "payment_pending",
        paymentCapturedAt: null,
        paymentCurrency: PAYMENT_CURRENCY,
        heldSeatCount: 0,
        holdExpiresAt: null,
        recoveryExpiresAt: null,
        recoveryEmailStatus: "disabled",
        whatsappRecoveryStatus: "disabled",
        offlineAdminEmailStatus: "pending",
        offlineAdminWhatsappStatus: "pending",
      });
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
      booking = await Booking.findOne({ pendingBookingKey });
      if (!booking) throw error;
    }
  }
  if (!booking.offlineSubmissionToken) {
    const updated = await Booking.findOneAndUpdate({
      _id: booking._id,
      $or: [{ offlineSubmissionToken: { $exists: false } }, { offlineSubmissionToken: "" }, { offlineSubmissionToken: null }],
    }, { $set: { offlineSubmissionToken: createConfirmationToken() } }, { new: true });
    booking = updated || await Booking.findById(booking._id);
    if (!booking) throw new HttpError(404, "Booking request not found");
  }
  if (booking.paymentStatus !== "paid") {
    void notifyOfflineBookingAdmins(booking._id.toString()).catch(error => console.error("[offline-booking-alert]", error));
  }
  response.status(201).json({
    success: true,
    message: booking.paymentStatus === "paid"
      ? "This booking has already been paid. Please check My Bookings."
      : "Offline payment request received. Your booking will be confirmed after our team records your payment. Seats are subject to availability until then.",
    data: { booking: { id: booking._id.toString(), bookingReference: getBookingReference(booking) }, submissionToken: booking.offlineSubmissionToken },
  });
}

export async function createBookingPaymentOrder(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(bookingPayloadSchema, {
    ...request.body, gstPercentage: PUBLIC_BOOKING_GST_PERCENTAGE,
  });
  if (payload.airFlightCharges !== 0 || payload.airfareIncludedInTotal) throw new HttpError(400, "Only an administrator can add actual airfare");
  const tour = await Tour.findOne({ tourId: payload.tourId });

  if (!tour) {
    throw new HttpError(400, `Tour ID ${payload.tourId} does not exist`);
  }

  const tourName = tour.tourName;
  const lead = getLeadGuest(payload);
  const scope = crypto.createHash("sha256").update([
    payload.tourId, payload.departureId || "",
    normalizeContactValue(lead.countryCode) + normalizeContactValue(lead.mobileNumber),
  ].join("|")).digest("hex");
  const rawKey = request.get("Idempotency-Key");
  if (rawKey && !/^[a-zA-Z0-9_-]{16,128}$/.test(rawKey)) {
    throw new HttpError(400, "Invalid Idempotency-Key");
  }
  const idempotencyKey = rawKey
    ? crypto.createHash("sha256").update(scope + ":" + rawKey).digest("hex") : undefined;
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  await withPaymentOrderLock(scope, async () => {
    let existingSession = idempotencyKey
      ? await BookingPaymentSession.findOne({ idempotencyKeys: idempotencyKey }) : null;
    if (existingSession && existingSession.requestHash !== requestHash) {
      throw new HttpError(409, "This payment key was already used for different booking details");
    }
    if (!existingSession) {
      existingSession = await BookingPaymentSession.findOne({ requestHash, status: "pending" });
    }
    if (existingSession) {
      const booking = existingSession.bookingId ? await Booking.findById(existingSession.bookingId) : null;
      if (existingSession.status === "pending" && booking && isActiveHold(booking)
          && booking.bookingStatus === "payment_pending" && booking.paymentStatus !== "paid") {
        if (idempotencyKey) {
          await BookingPaymentSession.updateOne({ _id: existingSession._id }, { $addToSet: { idempotencyKeys: idempotencyKey } });
        }
        sendPaymentOrder(existingSession);
        return;
      }
      if (idempotencyKey && existingSession.idempotencyKeys?.includes(idempotencyKey)) {
        throw new HttpError(410, "This payment attempt has ended. Please start a new payment attempt.");
      }
    }

    await releaseSupersededPendingPaymentReservations(payload);

    const snapshotPayload = await createSnapshotPayload(payload);

    if (!snapshotPayload) {
      throw new HttpError(400, "Complete booking details are required for payment");
    }

    const bookingDraft = await createBookingDraft(payload, snapshotPayload);
    const pendingBookingKey = createPendingBookingKey(payload);
    const amountRupees = getPaymentAmountRupees(
      bookingDraft,
      payload.paymentOption
    );
    const amount = amountRupees * 100;
    const receipt = createReceipt();
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
      requestHash,
      idempotencyKey,
    });

    sendPaymentOrder(paymentSession);
  });

  function sendPaymentOrder(paymentSession: BookingPaymentSessionDocument) {
    const { keyId } = getRazorpayCredentials();
    const leadGuest = getLeadGuest(payload);
    const { amount, amountRupees } = paymentSession;
    response.status(201).json({
      success: true,
      message: "Payment order created successfully",
      data: {
        checkout: {
          key: keyId,
          orderId: paymentSession.razorpayOrderId,
          amount,
          amountRupees,
          currency: PAYMENT_CURRENCY,
          name: "Ancient Trails",
          description: `${tourName} booking payment`,
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
}

async function createBookingBalancePaymentOrderInternal(
  request: Request,
  response: Response
): Promise<void> {
  try {
    await assertNoSmartCollectIdentifier(String(request.params.id));
    let booking = await getAuthenticatedTravellerPaidBookingById(request);
    await syncPaymentLinkRequestsForBookings([booking._id]);
    booking = await getAuthenticatedTravellerPaidBookingById(request);
    const amountRupees = getBalancePaymentAmountRupees(booking);

    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      throw new HttpError(400, "Balance payment is already complete");
    }

    const activePaymentLink = await BookingPaymentLinkRequest.findOne({
      bookingId: booking._id,
      status: { $in: ["created", "sent"] },
      paymentLinkUrl: { $ne: "" },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: -1 });

    if (activePaymentLink && isActivePaymentLinkRequest(activePaymentLink)) {
      assertWhatsappLinkCanBeDelivered(activePaymentLink.paymentLinkUrl);
      response.status(200).json({
        success: true,
        message: "Existing payment link is available",
        data: { paymentLinkUrl: activePaymentLink.paymentLinkUrl },
      });
      return;
    }

    const amount = amountRupees * 100;
    const receipt = createReceipt();
    const { keyId } = getRazorpayCredentials();
    const razorpay = createRazorpayClient();
    const tour = await Tour.findOne({ tourId: booking.tourId });

    const existingSession = await BookingBalancePaymentSession.findOne({
      bookingId: booking._id, status: "pending", amount,
    });
    const order = existingSession ? { id: existingSession.razorpayOrderId } : await razorpay.orders.create({
      amount,
      currency: PAYMENT_CURRENCY,
      receipt,
      notes: {
        bookingId: booking._id.toString(),
        paymentPurpose: "balance",
        tourId: booking.tourId,
      },
    });
    const paymentSession = existingSession || await createBalancePaymentSession({
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

    const confirmationToken = await ensureBookingConfirmationToken(booking);
    queueBookingConfirmationNotifications(booking);

    response.status(200).json({
      success: true,
      message: "Booking already confirmed",
      data: {
        booking: formatBooking(booking),
        confirmationToken,
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
    paymentMethod: capturedPayment.method,
    session: paymentSession,
    signature: payload.razorpay_signature,
  });
  const confirmationToken = await ensureBookingConfirmationToken(booking);

  queueBookingConfirmationNotifications(booking);

  response.status(200).json({
    success: true,
    message: "Booking confirmed successfully",
    data: {
      booking: formatBooking(booking),
      confirmationToken,
    },
  });
}

export async function getBookingPaymentOrderStatus(
  request: Request,
  response: Response
): Promise<void> {
  const orderId =
    typeof request.params.orderId === "string"
      ? request.params.orderId.trim()
      : "";

  if (!orderId) {
    throw new HttpError(400, "Payment order ID is required");
  }

  const paymentSession = await BookingPaymentSession.findOne({
    razorpayOrderId: orderId,
  });

  if (!paymentSession) {
    throw new HttpError(404, "Payment session not found");
  }

  setPrivateBookingHeaders(response);
  if (!paymentSession.bookingId) throw new HttpError(404, "Booking not found");
  const booking = await getAuthenticatedTravellerBookingById(request, String(paymentSession.bookingId));
  const isConfirmed = Boolean(
    booking &&
      paymentSession.status === "paid" &&
      booking.paymentStatus === "paid" &&
      (booking.bookingStatus || "payment_pending") === "confirmed"
  );
  const confirmationToken =
    isConfirmed && booking
      ? await ensureBookingConfirmationToken(booking)
      : undefined;

  if (isConfirmed && booking) {
    queueBookingConfirmationNotifications(booking);
  }

  response.status(200).json({
    success: true,
    message: isConfirmed
      ? "Booking payment is confirmed"
      : "Booking payment is not confirmed yet",
    data: {
      booking: booking ? formatBooking(booking) : null,
      confirmationToken,
      isConfirmed,
      paymentSession: formatPaymentSession(paymentSession),
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
      paymentMethod: capturedPayment.method,
      session: paymentSession,
      signature: payload.razorpay_signature,
    });
    const latestPaymentSession =
      (await BookingBalancePaymentSession.findById(paymentSession._id)) ||
      paymentSession;

    if ((updatedBooking.balanceAmount || 0) <= 0) {
      queueBookingConfirmationNotifications(updatedBooking);
    }

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

export async function getBookingConfirmation(request: Request, response: Response): Promise<void> {
  await getBookingResult(request, response);
}

export async function getOfflineBookingSubmission(request: Request, response: Response): Promise<void> {
  await getBookingResult(request, response, true);
}

async function getBookingResult(
  request: Request,
  response: Response,
  offlineSubmission = false
): Promise<void> {
  setPrivateBookingHeaders(response);
  try {
    const booking = await getAuthenticatedTravellerBookingById(request);
    const unavailable = ["cancelled", "expired"].includes(booking.bookingStatus || "");
    if (unavailable || (offlineSubmission ? booking.paymentMode !== "offline"
      : booking.paymentStatus !== "paid" || !((booking.amountPaid || 0) > 0))) {
      throw new HttpError(404, offlineSubmission ? "Booking request not found" : "Booking confirmation not found");
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
      message: offlineSubmission ? "Booking request fetched successfully" : "Booking confirmation fetched successfully",
      data: {
        booking: formatBooking(booking, tour),
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
  setPrivateBookingHeaders(response);
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

export async function sendBookingFinalPaymentWhatsappManually(
  request: Request,
  response: Response
): Promise<void> {
  await withBookingCollectionLock(request, () => createAdminBookingPaymentLinkInternal(request, response, true));
}

export async function listAdminBookingPaymentLinks(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const paymentLinkRequests = await listPaymentLinkRequestsForBooking(
      booking._id
    );

    response.status(200).json({
      success: true,
      message: "Payment link requests fetched successfully",
      data: {
        booking: formatBooking(booking),
        paymentLinkRequests: paymentLinkRequests.map(formatPaymentLinkRequest),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function prepareBookingPaymentLink(
  booking: BookingDocument,
  payload: z.infer<typeof adminPaymentLinkPayloadSchema>,
  options: { expiresAt?: Date } = {}
) {
  await assertNoSmartCollectIdentifier(booking._id.toString());
  if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "expired") {
    throw new HttpError(
      400,
      "Payment links cannot be generated for cancelled or expired bookings"
    );
  }

  if ((booking.airFlightCharges || 0) > 0 && await BookingBalancePaymentSession.exists({
    bookingId: booking._id, status: "pending",
  })) throw new HttpError(409, "A customer balance payment is already in progress");
  const outstandingAmount = getBookingOutstandingAmount(booking);
  const amountRupees =
    payload.purpose === "final"
      ? outstandingAmount
      : toPaymentAmount(payload.amount || 0);

  if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
    throw new HttpError(400, "Payment amount must be greater than zero");
  }

  if (
    payload.purpose !== "additional" &&
    amountRupees > outstandingAmount
  ) {
    throw new HttpError(400, "Payment amount cannot exceed the outstanding balance");
  }

  if (
    payload.purpose === "additional" &&
    payload.additionalChargeAlreadyApplied &&
    amountRupees > outstandingAmount
  ) {
    throw new HttpError(400, "Payment amount cannot exceed the outstanding balance");
  }

  if (payload.purpose === "final" && outstandingAmount <= 0) {
    throw new HttpError(400, "Final payment is already complete");
  }

  if (payload.additionalChargeAlreadyApplied && !(booking.airFlightCharges || 0)) {
    throw new HttpError(400, "No airfare has been added to this booking");
  }
  let reservedAirfareLink: BookingPaymentLinkRequestDocument | null = null;
  if ((booking.airFlightCharges || 0) > 0) {
    const openLink = await BookingPaymentLinkRequest.findOne({
      bookingId: booking._id, status: { $in: ["created", "sent"] },
    });
    if (openLink && payload.purpose === "additional" &&
        Boolean(openLink.additionalChargeAppliedAt) !== payload.additionalChargeAlreadyApplied) {
      throw new HttpError(409, "The existing payment link has a different charge basis; cancel it before creating another collection");
    }
    reservedAirfareLink = openLink;
    if (openLink && (openLink.amountRupees !== amountRupees || openLink.purpose !== payload.purpose)) {
      throw new HttpError(409, "Cancel the existing payment link before creating another collection");
    }
  }
  const purposeLabel = payload.additionalChargeAlreadyApplied ? "Air-Flight Charges (Additional)" : paymentLinkPurposeLabels[payload.purpose];
  const description =
    payload.description ||
    `${purposeLabel} for booking ${getBookingReference(booking)}`;
  const obligationKey = getPaymentLinkObligationKey({
    amountRupees,
    description,
    purpose: payload.purpose,
  });
  const existingActiveRequest = reservedAirfareLink || await BookingPaymentLinkRequest.findOne({
    bookingId: booking._id,
    obligationKey,
    status: { $in: ["created", "sent"] },
  }).sort({ createdAt: -1 });
  const tour = await Tour.findOne({ tourId: booking.tourId });
  let paymentLinkRequest = existingActiveRequest;

  if (
    paymentLinkRequest &&
    payload.purpose === "final" &&
    isActivePaymentLinkRequest(paymentLinkRequest) &&
    (paymentLinkRequest.amountRupees !== amountRupees || Boolean(options.expiresAt && paymentLinkRequest.expiresAt && paymentLinkRequest.expiresAt < options.expiresAt))
  ) {
    const razorpay = createRazorpayClient();

    await razorpay.paymentLink.cancel(paymentLinkRequest.razorpayPaymentLinkId);
    paymentLinkRequest.cancelledAt = new Date();
    paymentLinkRequest.failureReason =
      "Superseded by a new final payment balance";
    paymentLinkRequest.status = "cancelled";
    await paymentLinkRequest.save();
    paymentLinkRequest = null;
  }

  if (
    paymentLinkRequest &&
    !isActivePaymentLinkRequest(paymentLinkRequest)
  ) {
    paymentLinkRequest.status = "expired";
    paymentLinkRequest.failureReason =
      paymentLinkRequest.failureReason || "Payment link expired";
    await paymentLinkRequest.save();
    paymentLinkRequest = null;
  }

  if (!paymentLinkRequest) {
    const leadGuest = booking.guestDetails[0];
    const receipt = createReceipt();
    const expiresAt = options.expiresAt || getPaymentLinkExpiryDate();
    const razorpay = createRazorpayClient();
    const referenceId = `ATPL-${booking._id.toString().slice(-8)}-${Date.now()
      .toString(36)
      .toUpperCase()}`.slice(0, 80);
    const paymentLink = await razorpay.paymentLink.create({
      accept_partial: false,
      amount: amountRupees * 100,
      callback_method: "get",
      ...(getPaymentLinkReturnUrl(booking)
        ? { callback_url: getPaymentLinkReturnUrl(booking) }
        : {}),
      currency: PAYMENT_CURRENCY,
      customer: {
        contact: leadGuest
          ? `${leadGuest.countryCode}${leadGuest.mobileNumber}`.replace(
              /[^\d+]/g,
              ""
            )
          : "",
        email: leadGuest?.email || "",
        name: getGuestFullName(leadGuest) || "Traveller",
      },
      description,
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      notes: {
        bookingId: booking._id.toString(),
        bookingReference: getBookingReference(booking),
        paymentPurpose: payload.purpose,
        receipt,
        tourId: booking.tourId,
      },
      notify: {
        email: false,
        sms: false,
        whatsapp: false,
      },
      reference_id: referenceId,
      reminder_enable: false,
    });

    paymentLinkRequest = await BookingPaymentLinkRequest.create({
      amount: amountRupees * 100,
      amountRupees,
      bookingId: booking._id,
      currency: PAYMENT_CURRENCY,
      description,
      additionalChargeAppliedAt:
        payload.purpose === "additional" &&
        payload.additionalChargeAlreadyApplied
          ? new Date()
          : null,
      expiresAt,
      obligationKey,
      paymentLinkUrl: paymentLink.short_url,
      purpose: payload.purpose,
      purposeLabel,
      razorpayPaymentLinkId: paymentLink.id,
      razorpayReferenceId: referenceId,
      status: "created",
      whatsappRecipient: "",
      whatsappStatus: "pending",
    });
  }


  return { booking, paymentLinkRequest, tour };
}

async function createAdminBookingPaymentLinkInternal(
  request: Request,
  response: Response,
  finalPaymentOnly = false
): Promise<void> {
  try {
    await assertNoSmartCollectIdentifier(String(request.params.id));
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (finalPaymentOnly && !isAirFlightFinalPaymentEligible(booking)) {
      throw new HttpError(
        400,
        "Final payment link is available only for fully paid bookings with pending air-flight charges"
      );
    }

    const payload = parseRequestBody(
      adminPaymentLinkPayloadSchema,
      finalPaymentOnly
        ? {
            additionalChargeAlreadyApplied: true,
            amount: getBookingOutstandingAmount(booking),
            description: "Air-flight charge payment",
            purpose: "additional",
          }
        : request.body
    );

    const { paymentLinkRequest, tour } = await prepareBookingPaymentLink(booking, payload);

    const sentPaymentLinkRequest = await sendWhatsappForPaymentLinkRequest({
      booking,
      paymentLinkRequest,
      tour,
    });

    if (finalPaymentOnly) {
      if (sentPaymentLinkRequest.whatsappStatus !== "sent") {
        throw new HttpError(
          502,
          sentPaymentLinkRequest.whatsappError || "WhatsApp payment link could not be sent"
        );
      }

      response.status(200).json({
        success: true,
        message: "Final payment WhatsApp link sent successfully",
        data: {
          booking: formatBooking(booking),
          finalPaymentUrl: sentPaymentLinkRequest.paymentLinkUrl,
          requestId: sentPaymentLinkRequest.whatsappRequestId,
        },
      });
      return;
    }

    response.status(201).json({
      success: true,
      message:
        sentPaymentLinkRequest.whatsappStatus === "sent"
          ? "Payment link generated and sent successfully"
          : "Payment link generated, but WhatsApp could not be sent",
      data: {
        booking: formatBooking(booking),
        paymentLinkRequest: formatPaymentLinkRequest(sentPaymentLinkRequest),
        paymentLinkRequests: (
          await listPaymentLinkRequestsForBooking(booking._id)
        ).map(formatPaymentLinkRequest),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function resendAdminBookingPaymentLinkWhatsapp(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const paymentLinkRequest = await BookingPaymentLinkRequest.findOne({
      _id: request.params.linkId,
      bookingId: booking._id,
    });

    if (!paymentLinkRequest) {
      throw new HttpError(404, "Payment link request not found");
    }

    if (!isActivePaymentLinkRequest(paymentLinkRequest)) {
      throw new HttpError(400, "Only active payment links can be resent");
    }

    const tour = await Tour.findOne({ tourId: booking.tourId });
    const sentPaymentLinkRequest = await sendWhatsappForPaymentLinkRequest({
      booking,
      paymentLinkRequest,
      tour,
    });

    response.status(200).json({
      success: true,
      message:
        sentPaymentLinkRequest.whatsappStatus === "sent"
          ? "Payment link WhatsApp resent successfully"
          : "WhatsApp could not be sent",
      data: {
        booking: formatBooking(booking),
        paymentLinkRequest: formatPaymentLinkRequest(sentPaymentLinkRequest),
        paymentLinkRequests: (
          await listPaymentLinkRequestsForBooking(booking._id)
        ).map(formatPaymentLinkRequest),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid payment link request ID");
    }

    throw error;
  }
}

export async function refreshAdminBookingPaymentLinkStatus(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const paymentLinkRequest = await BookingPaymentLinkRequest.findOne({
      _id: request.params.linkId,
      bookingId: booking._id,
    });

    if (!paymentLinkRequest) {
      throw new HttpError(404, "Payment link request not found");
    }

    const razorpay = createRazorpayClient();
    const paymentLink = await razorpay.paymentLink.fetch(
      paymentLinkRequest.razorpayPaymentLinkId
    );

    if (paymentLink.status === "paid") {
      await applyVerifiedPaymentLinkRequest({
        paymentId: getPaymentLinkPaidPaymentId(paymentLink),
        paymentLinkRequest,
      });
    } else if (paymentLink.status === "cancelled") {
      paymentLinkRequest.cancelledAt = paymentLinkRequest.cancelledAt || new Date();
      paymentLinkRequest.status = "cancelled";
      await paymentLinkRequest.save();
    } else if (paymentLink.status === "expired") {
      paymentLinkRequest.status = "expired";
      paymentLinkRequest.failureReason =
        paymentLinkRequest.failureReason || "Razorpay payment link expired";
      await paymentLinkRequest.save();
    }

    const latestBooking = (await Booking.findById(booking._id)) || booking;

    response.status(200).json({
      success: true,
      message: "Payment link status refreshed successfully",
      data: {
        booking: formatBooking(latestBooking),
        paymentLinkRequests: (
          await listPaymentLinkRequestsForBooking(booking._id)
        ).map(formatPaymentLinkRequest),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid payment link request ID");
    }

    throw error;
  }
}

export async function cancelAdminBookingPaymentLink(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const paymentLinkRequest = await BookingPaymentLinkRequest.findOne({
      _id: request.params.linkId,
      bookingId: booking._id,
    });

    if (!paymentLinkRequest) {
      throw new HttpError(404, "Payment link request not found");
    }

    if (paymentLinkRequest.status === "paid") {
      throw new HttpError(400, "Paid payment links cannot be cancelled");
    }

    if (isActivePaymentLinkRequest(paymentLinkRequest)) {
      const razorpay = createRazorpayClient();
      await razorpay.paymentLink.cancel(paymentLinkRequest.razorpayPaymentLinkId);
    }

    paymentLinkRequest.cancelledAt = paymentLinkRequest.cancelledAt || new Date();
    paymentLinkRequest.status = "cancelled";
    paymentLinkRequest.failureReason = "Cancelled by admin";
    await paymentLinkRequest.save();

    response.status(200).json({
      success: true,
      message: "Payment link cancelled successfully",
      data: {
        booking: formatBooking(booking),
        paymentLinkRequests: (
          await listPaymentLinkRequestsForBooking(booking._id)
        ).map(formatPaymentLinkRequest),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid payment link request ID");
    }

    throw error;
  }
}

export async function cancelPendingBooking(
  request: Request,
  response: Response
): Promise<void> {
  const parsed = z.object({
    reason: z.string().trim().min(3).max(1000),
    chargePercentage: z.number().int().min(0).max(100),
    requestedBy: z.enum(["Customer", "Admin", "Tour Operator"]),
    notes: z.string().trim().max(2000).default(""),
  }).strict().safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, "Provide a cancellation reason, charge percentage, and requested by");
  }
  try {
    const session = await mongoose.startSession();
    let booking: BookingDocument | null = null;
    let releasedSeatCount = 0;

    try {
      await session.withTransaction(async () => {
        releasedSeatCount = 0;
        booking = await Booking.findById(request.params.id).session(session);

        if (!booking) {
          throw new HttpError(404, "Booking not found");
        }

        // Transaction retries and repeated clicks must never release seats twice.
        if (booking.bookingStatus === "cancelled") return;
        if (booking.bookingStatus === "expired") {
          throw new HttpError(409, "Expired bookings cannot be cancelled");
        }
        const departureId = getBookingDepartureId(booking);
        const reservedSeatCount = booking.paymentStatus === "paid"
          ? Math.max(0, booking.totalGuest || 0)
          : Math.max(0, booking.heldSeatCount || 0);

        if (reservedSeatCount > 0) {
          const departure = await restoreDepartureSeats(departureId, reservedSeatCount, session);
          if (!departure) throw new HttpError(409, "Booking departure was not found; seats could not be released");
          releasedSeatCount = reservedSeatCount;
        }

        booking.cancellation = { ...parsed.data, cancelledAt: new Date() };
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

        await BookingPaymentLinkRequest.updateMany(
          {
            bookingId: booking._id,
            status: { $in: ["created", "sent"] },
          },
          {
            $set: {
              failureReason: "Booking cancelled",
              status: "cancelled",
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

    const savedBooking = booking as BookingDocument;
    queueBookingNotifications(savedBooking.id);
    const departureId = getBookingDepartureId(savedBooking);
    const departure = departureId
      ? await TourDeparture.findOne({ departureId }).select("seatsAvailable").lean()
      : null;

    response.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking: formatBooking(savedBooking),
        availability: { departureId, seatsReleased: releasedSeatCount, seatsAvailable: departure?.seatsAvailable ?? null },
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
        await BookingPaymentLinkRequest.updateMany(
          {
            bookingId: booking._id,
            status: { $in: ["created", "sent"] },
          },
          {
            $set: {
              failureReason: "Booking expired",
              status: "expired",
            },
          },
          { session }
        );
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
      payment_link?: {
        entity?: {
          id?: string;
          status?: string;
          amount?: number;
          amount_paid?: number;
          payments?: unknown;
        };
      };
      payment?: {
        entity?: {
          amount?: number;
          currency?: string;
          id?: string;
          method?: string;
          notes?: Record<string, unknown>;
          order_id?: string;
          status?: string;
        };
      };
    };
  };
  if (eventPayload.event === "refund.processed") {
    const refund = (eventPayload.payload as unknown as { refund?: { entity?: { id?: string } } })?.refund?.entity;
    if (!refund?.id || !/^rfnd_[a-zA-Z0-9]+$/.test(refund.id)) throw new HttpError(400, "Invalid refund event");
    await stageNotificationEvent("refund:" + refund.id, "refund_candidate", { refundId: refund.id });
    response.status(200).json({ success: true, message: "Refund verification queued", data: {} });
    return;
  }
  const payment = eventPayload.payload?.payment?.entity;
  const paymentLink = eventPayload.payload?.payment_link?.entity;

  if (paymentLink?.id) {
    const paymentLinkRequest = await BookingPaymentLinkRequest.findOne({
      razorpayPaymentLinkId: paymentLink.id,
    });

    if (!paymentLinkRequest) {
      response.status(200).json({
        success: true,
        message: "Payment link request not found; webhook ignored",
        data: {},
      });
      return;
    }

    if (
      eventPayload.event === "payment_link.paid" ||
      paymentLink.status === "paid" ||
      payment?.status === "captured"
    ) {
      const updatedBooking = await applyVerifiedPaymentLinkRequest({
        paymentId:
          payment?.id || getPaymentLinkPaidPaymentId(paymentLink, ""),
        paymentLinkRequest,
      });

      if (updatedBooking && (updatedBooking.balanceAmount || 0) <= 0) {
        queueBookingConfirmationNotifications(updatedBooking);
      }
    } else if (
      eventPayload.event === "payment_link.cancelled" ||
      paymentLink.status === "cancelled"
    ) {
      await BookingPaymentLinkRequest.updateOne(
        {
          _id: paymentLinkRequest._id,
          status: { $ne: "paid" },
        },
        {
          $set: {
            cancelledAt: new Date(),
            failureReason: "Razorpay reported payment link cancellation",
            status: "cancelled",
          },
        }
      );
    } else if (
      eventPayload.event === "payment_link.expired" ||
      paymentLink.status === "expired"
    ) {
      await BookingPaymentLinkRequest.updateOne(
        {
          _id: paymentLinkRequest._id,
          status: { $nin: ["paid", "cancelled"] },
        },
        {
          $set: {
            failureReason: "Razorpay reported payment link expiry",
            status: "expired",
          },
        }
      );
    } else if (eventPayload.event === "payment.failed" || payment?.status === "failed") {
      await BookingPaymentLinkRequest.updateOne(
        {
          _id: paymentLinkRequest._id,
          status: { $in: ["created", "sent"] },
        },
        {
          $set: {
            failureReason: "Razorpay reported payment failure",
            status: "failed",
          },
        }
      );
    }

    response.status(200).json({
      success: true,
      message: "Webhook processed",
      data: {},
    });
    return;
  }

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
    const noteBookingId =
      typeof payment.notes?.bookingId === "string"
        ? payment.notes.bookingId
        : "";
    const paymentAmount =
      typeof payment.amount === "number" ? payment.amount : 0;
    const paymentLinkRequest =
      noteBookingId && mongoose.Types.ObjectId.isValid(noteBookingId)
        ? await BookingPaymentLinkRequest.findOne({
            amount: paymentAmount,
            bookingId: noteBookingId,
            status: { $in: ["created", "sent", "failed", "expired"] },
          }).sort({ createdAt: -1 })
        : null;

    if (
      paymentLinkRequest &&
      (eventPayload.event === "payment.captured" ||
        payment.status === "captured")
    ) {
      const updatedBooking = await applyVerifiedPaymentLinkRequest({
        paymentId: payment.id,
        paymentLinkRequest,
      });

      if (updatedBooking && (updatedBooking.balanceAmount || 0) <= 0) {
        queueBookingConfirmationNotifications(updatedBooking);
      }

      response.status(200).json({
        success: true,
        message: "Webhook processed",
        data: {},
      });
      return;
    }

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
      paymentMethod: payment.method,
      session: paymentSession,
      signature,
    });

    queueBookingConfirmationNotifications(booking);
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

async function attachKycDocumentToBooking(
  booking: BookingDocument,
  request: Request,
  uploadedBy: IBookingKycDocument["uploadedBy"]
) {
  const file = request.file;

  if (!file) {
    throw new HttpError(400, "Select a KYC document file to upload");
  }

  const payload = parseRequestBody(bookingKycUploadPayloadSchema, request.body);
  const traveller = booking.travellers.find(
    (item) => item.id === payload.travellerId
  );

  if (!traveller) {
    throw new HttpError(404, "Traveller not found for this booking");
  }

  const document: IBookingKycDocument = {
    id: crypto.randomUUID(),
    documentType: payload.documentType,
    documentLabel: bookingKycDocumentLabels[payload.documentType],
    fileName: file.originalname,
    fileUrl: getBookingKycUploadUrl(file),
    mimeType: file.mimetype,
    uploadedBy,
    uploadedAt: new Date(),
  };

  traveller.kycDocuments = [
    ...(traveller.kycDocuments || []).filter(
      (item) => item.documentType !== document.documentType
    ),
    document,
  ];

  if (
    typeof booking.pendingBookingKey === "string" &&
    booking.pendingBookingKey.trim().length === 0
  ) {
    booking.pendingBookingKey = undefined;
  }

  booking.markModified("travellers");

  await booking.save();

  return booking;
}

export async function uploadTravellerBookingKycDocument(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await getAuthenticatedTravellerPaidBookingById(request);
    const updatedBooking = await attachKycDocumentToBooking(
      booking,
      request,
      "traveller"
    );

    await sendKycCompletionAlertIfNeeded(updatedBooking);

    response.status(200).json({
      success: true,
      message: "KYC document uploaded successfully",
      data: {
        booking: formatBooking(updatedBooking),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function uploadAdminBookingKycDocument(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const updatedBooking = await attachKycDocumentToBooking(
      booking,
      request,
      "admin"
    );

    response.status(200).json({
      success: true,
      message: "KYC document uploaded successfully",
      data: {
        booking: formatBooking(updatedBooking),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid booking ID");
    }

    throw error;
  }
}

export async function listTravellerBookings(
  request: Request,
  response: Response
): Promise<void> {
  const traveller = await getAuthenticatedTraveller(request);
  let bookings = await Booking.find({
    ...createTravellerBookingFilters(traveller),
    ...createPaidBookingFilter(),
  })
    .sort({ createdAt: -1 })
    .limit(300);

  await syncPaymentLinkRequestsForBookings(
    bookings.map((booking) => booking._id)
  );

  bookings = await Booking.find({
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
          booking: formatBooking(booking, tour),
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

  let bookings = await Booking.find(filters)
    .sort({ createdAt: -1 })
    .limit(300);

  await syncPaymentLinkRequestsForBookings(
    bookings.map((booking) => booking._id)
  );

  bookings = await Booking.find(filters)
    .sort({ createdAt: -1 })
    .limit(300);

  const airfareTours = await Tour.find({ tourId: { $in: [...new Set(bookings.map(booking => booking.tourId))] } })
    .select("tourId inclusions exclusions");
  const airfareToursById = new Map(airfareTours.map(tour => [tour.tourId, tour]));
  const bankTransferBookingIds = process.env.RAZORPAY_KEY_ID && bookings.length
    ? await SmartCollectAccount.distinct("bookingId", {
        bookingId: { $in: bookings.map(booking => booking._id) },
        scope: crypto.createHash("sha256").update(process.env.RAZORPAY_KEY_ID).digest("hex"),
      })
    : [];
  const bankTransferBookings = new Set(bankTransferBookingIds.map(id => String(id)));
  const bankPaymentIds = bookings.map(booking => booking.paymentId).filter((id): id is string => Boolean(id));
  const latestBankTransfers = process.env.RAZORPAY_KEY_ID && bankPaymentIds.length ? await SmartCollectTransfer.find({
    scope: crypto.createHash("sha256").update(process.env.RAZORPAY_KEY_ID).digest("hex"),
    bookingId: { $in: bookings.map(booking => booking._id) }, amountApplied: { $gt: 0 },
    paymentId: { $in: bankPaymentIds },
  }).select("paymentId mode") : [];
  const bankMethods = new Map(latestBankTransfers.map(transfer => [transfer.paymentId, verifiedPaymentMethod(transfer.mode, "bank_transfer")]));
  response.status(200).json({
    success: true,
    message: "Bookings fetched successfully",
    data: {
      bookings: bookings.map(booking => ({
        ...formatBooking(booking, airfareToursById.get(booking.tourId)),
        paymentMethod: bankMethods.get(booking.paymentId || "") || (bankTransferBookings.has(String(booking._id)) && !(booking.amountPaid || 0) ? "bank_transfer" : booking.paymentMethod || (booking.paymentMode === "bank_transfer" ? "bank_transfer" : "")),
        hasBankTransfer: bankTransferBookings.has(String(booking._id)),
      })),
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
    totalTravellers,
    new Date(),
    (await Tour.findOne({ tourId: departure.tourId }))?.durationDn
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

  assertAdminLeadVerification(request, payload.guestDetails[0], payload.leadVerificationToken);
  delete payload.leadVerificationToken;
  const paymentMode = payload.paymentMode || (payload.paymentMethod === "bank_transfer" ? "bank_transfer" : payload.paymentMethod === "razorpay" ? "online" : "offline");
  if (paymentMode === "offline" && !["cash", "cheque", "neft", "imps", "rtgs"].includes(payload.paymentMethod || "")) {
    throw new HttpError(400, "Choose the actual offline payment method");
  }
  if (paymentMode !== "offline" && (payload.amountPaid || 0) > 0) {
    throw new HttpError(400, "Online and bank-transfer payments must be verified by the payment provider");
  }
  await assertTourExists(payload.tourId);

  const snapshotPayload = await createSnapshotPayload(payload);
  let booking!: BookingDocument;

  if (snapshotPayload && (payload.amountPaid || 0) > 0) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const updatedDeparture = await reserveDepartureSeats(
          payload.departureId,
          payload.totalGuest,
          session
        );

        if (!updatedDeparture) {
          throw new HttpError(
            409,
            "Requested travellers exceed available seats."
          );
        }

        const bookingDraft = applyAdminOfflinePaymentToDraft(
          await createBookingDraft(payload, snapshotPayload)
        );
        const createdBookings = await Booking.create(
          [
            {
              ...bookingDraft,
              bookingStatus: "confirmed",
              paymentCapturedAt: new Date(),
              paymentCurrency: PAYMENT_CURRENCY,
              paymentMode,
              confirmationToken: createConfirmationToken(),
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
      ...await createBookingDraft(payload, snapshotPayload),
      balanceAmount: Math.max(0, (snapshotPayload?.pricingSnapshot.grandTotal || 0) + (payload.airfareIncludedInTotal ? 0 : payload.airFlightCharges) - amountPaid),
      paymentMode,
      confirmationToken: amountPaid > 0 ? createConfirmationToken() : undefined,
      ...(paymentMode === "online" ? { recoveryToken: createRecoveryToken(), recoveryExpiresAt: new Date(Date.now() + RECOVERY_EXPIRY_HOURS * 3600000), recoveryEmailStatus: "pending", whatsappRecoveryStatus: "pending" } : {}),
      amountPaid,
      paymentCapturedAt: amountPaid > 0 ? new Date() : null,
      bookingStatus: amountPaid > 0 ? "confirmed" : "payment_pending",
      paymentCurrency: PAYMENT_CURRENCY,
      paymentMethod: payload.paymentMethod,
      paymentStatus: amountPaid > 0 ? "paid" : "pending",
    });
  }

  if ((booking.airFlightCharges || 0) > 0) {
    booking.airfareAddedAt = new Date();
    booking.airfareHistory = [{ previousAmount: 0, amount: booking.airFlightCharges || 0,
      changedBy: verifyAuthToken(getBearerToken(request)).userId, changedAt: new Date() }];
    await booking.save();
  }
  if (booking.paymentStatus === "paid") {
    queueBookingConfirmationNotifications(booking);
  }

  response.status(201).json({
    success: true,
    message: "Booking created successfully",
    data: {
      booking: formatBooking(booking),
    },
  });
}

async function updateBookingInternal(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(bookingPayloadSchema, request.body);

  try {
    await assertNoSmartCollectIdentifier(String(request.params.id));
    await assertTourExists(payload.tourId);
    const existingBooking = await Booking.findById(request.params.id);

    if (!existingBooking) {
      throw new HttpError(404, "Booking not found");
    }

    if ((existingBooking.airFlightCharges || 0) !== payload.airFlightCharges) {
      throw new HttpError(400, "Use the airfare editor to update charges and preserve the audit history");
    }
    const snapshotPayload = await createSnapshotPayload(payload, existingBooking);
    if (existingBooking.paymentMode === "offline" && existingBooking.paymentStatus !== "paid" && (payload.amountPaid || 0) > 0 &&
        !["cash", "cheque"].includes(payload.paymentMethod || "")) {
      throw new HttpError(400, "Choose cash or cheque to record an offline payment");
    }
    if ((existingBooking.paymentProvider === "razorpay" || existingBooking.paymentMode === "online" && existingBooking.paymentMethod === "razorpay") && (payload.amountPaid !== existingBooking.amountPaid || payload.paymentMethod !== existingBooking.paymentMethod)) {
      throw new HttpError(400, "Provider-verified payment details cannot be changed manually");
    }
    const draft = await createBookingDraft(payload, snapshotPayload, existingBooking.airfareExcluded, existingBooking);
    const updatePayload = existingBooking.paymentMode === "offline" && !payload.amountPaid
      ? { ...draft, amountPaid: 0, balanceAmount: draft.grandTotal }
      : applyAdminOfflinePaymentToDraft(draft);

    updatePayload.travellers = mergeTravellerKycDocuments(
      updatePayload.travellers,
      existingBooking.travellers
    );
    if ((existingBooking.airFlightCharges || 0) > 0 &&
        (updatePayload.grandTotal !== existingBooking.grandTotal || updatePayload.amountPaid !== existingBooking.amountPaid)) {
      await assertNoOpenAirfareCollection(existingBooking);
    }
    updatePayload.airfareExcluded = existingBooking.airfareExcluded ?? updatePayload.airfareExcluded;
    const isPaid = (updatePayload.amountPaid || 0) > 0;
    const previousAirFlightCharges = toPaymentAmount(
      existingBooking.airFlightCharges || 0
    );
    const nextAirFlightCharges = toPaymentAmount(
      updatePayload.airFlightCharges || 0
    );
    const hasAirFlightChargeDue =
      nextAirFlightCharges !== previousAirFlightCharges &&
      (updatePayload.balanceAmount || 0) > 0;
    const bookingUpdate = {
      ...updatePayload,
      paymentLifecyclePending: Boolean(existingBooking.paymentLifecyclePending || isPaid && ((updatePayload.amountPaid || 0) >= (updatePayload.grandTotal || 0) || updatePayload.airfareExcluded && !updatePayload.airfareIncludedInTotal && (updatePayload.airFlightCharges || 0) > 0 && (updatePayload.amountPaid || 0) >= (updatePayload.grandTotal || 0) - (updatePayload.airFlightCharges || 0))),
      bookingStatus: isPaid ? "confirmed" : "payment_pending",
      confirmationToken: isPaid ? existingBooking.confirmationToken || createConfirmationToken() : existingBooking.confirmationToken,
      paymentCapturedAt: isPaid ? (updatePayload.amountPaid || 0) > (existingBooking.amountPaid || 0) ? new Date() : existingBooking.paymentCapturedAt || new Date() : null,
      paymentCurrency: PAYMENT_CURRENCY,
      paymentMethod: payload.paymentMethod,
      paymentStatus: isPaid ? "paid" : "pending",
      ...(hasAirFlightChargeDue
        ? {
            emailBookingConfirmationAttemptedAt: null,
            emailBookingConfirmationSentAt: null,
            emailBookingConfirmationStatus: "pending" as const,
            whatsappBookingConfirmationAttemptedAt: null,
            whatsappBookingConfirmationSentAt: null,
            whatsappBookingConfirmationStatus: "pending" as const,
          }
        : {}),
    };
    const previousDepartureId = getBookingDepartureId(existingBooking);
    const previousReservedSeats = getBookingReservedSeatCount(existingBooking);
    const nextDepartureId =
      updatePayload.departureId || updatePayload.pricingSnapshot?.departureId || "";
    const nextReservedSeats = isPaid ? Math.max(0, updatePayload.totalGuest || 0) : 0;
    let booking: BookingDocument | null = null;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        if (previousDepartureId && previousReservedSeats > 0) {
          await restoreDepartureSeats(
            previousDepartureId,
            previousReservedSeats,
            session
          );
        }

        if (nextDepartureId && nextReservedSeats > 0) {
          const updatedDeparture = await reserveDepartureSeats(
            nextDepartureId,
            nextReservedSeats,
            session
          );

          if (!updatedDeparture) {
            throw new HttpError(
              409,
              "Requested travellers exceed available seats."
            );
          }
        }

        booking = await Booking.findByIdAndUpdate(
          request.params.id,
          bookingUpdate,
          {
            new: true,
            runValidators: true,
            session,
          }
        );
      });
    } finally {
      await session.endSession();
    }

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    if (existingBooking.paymentStatus !== "paid" && isPaid) {
      queueBookingConfirmationNotifications(booking);
    } else if (isPaid) {
      queueBookingPaymentLifecycle(booking, bookingPaymentLifecycleHooks());
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

async function updateBookingAirFlightChargesInternal(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(airFlightChargesPayloadSchema, request.body);

  try {
    const booking = await Booking.findById(request.params.id);

    if (!booking) {
      throw new HttpError(404, "Booking not found");
    }

    const isConfirmedBooking = booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid";
    const isPendingOfflineBooking = booking.paymentMode === "offline" &&
      booking.bookingStatus === "payment_pending" && booking.paymentStatus === "pending";
    if (!isConfirmedBooking && !isPendingOfflineBooking) {
      throw new HttpError(400, "Airfare can only be updated on a confirmed booking or a pending offline booking");
    }
    const tour = await Tour.findOne({ tourId: booking.tourId });
    if (!(booking.airfareExcluded ?? isAirfareExcluded(tour))) {
      throw new HttpError(400, "This package does not explicitly exclude flights");
    }
    const previousAmount = booking.airFlightCharges || 0;
    const previousIncludedInTotal = booking.airfareIncludedInTotal || false;
    const includedInTotal = payload.airfareIncludedInTotal ?? previousIncludedInTotal;
    const previousTotal = booking.grandTotal || 0;
    if (previousAmount !== payload.airFlightCharges || includedInTotal !== previousIncludedInTotal || !booking.airfareAddedAt) {
      await assertNoOpenAirfareCollection(booking);
      applyAirFlightChargesToBooking(booking, payload.airFlightCharges, includedInTotal);
      booking.airfareExcluded = true;
      booking.airfareAddedAt = new Date();
      booking.airfareHistory = [...(booking.airfareHistory || []), {
        previousAmount, amount: payload.airFlightCharges,
        previousIncludedInTotal, includedInTotal, previousTotal, total: booking.grandTotal,
        changedBy: verifyAuthToken(getBearerToken(request)).userId, changedAt: new Date(),
      }];
      booking.$where = { updatedAt: booking.updatedAt };
      try { await booking.save(); } catch (error) {
        if (error instanceof mongoose.Error.DocumentNotFoundError) throw new HttpError(409, "Booking changed while airfare was being updated; reload and retry");
        throw error;
      }
      if (!booking.airfareIncludedInTotal && isAirFlightFinalPaymentEligible(booking)) {
        queueBookingPaymentLifecycle(booking, bookingPaymentLifecycleHooks());
      }
    }

    response.status(200).json({
      success: true,
      message: "Air-flight charges updated successfully",
      data: {
        booking: formatBooking(booking),
        finalPaymentUrl: getFinalPaymentUrl(booking),
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
        const departureId = getBookingDepartureId(booking);

        await restoreDepartureSeats(
          departureId,
          getBookingReservedSeatCount(booking),
          session
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

      await BookingPaymentLinkRequest.updateMany(
        {
          bookingId: booking._id,
          status: { $in: ["created", "sent"] },
        },
        {
          $set: {
            failureReason: "Booking deleted before payment completion",
            status: "cancelled",
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


export function recordAirfareCollection(booking: BookingDocument, paymentId: string, amount: number) {
  if (!(booking.airFlightCharges || 0)) return true;
  const credit = creditAirfarePayment({
    grandTotal: booking.grandTotal || 0,
    airfare: booking.airFlightCharges || 0,
    amountPaid: booking.amountPaid || 0,
    history: booking.collectionHistory || [],
  }, { paymentId, amount, paidAt: new Date() });
  if (!credit.credited) return false;
  booking.collectionHistory = credit.history;
  booking.emailBookingConfirmationStatus = "pending";
  booking.emailBookingConfirmationAttemptedAt = null;
  booking.emailBookingConfirmationSentAt = null;
  return true;
}

async function assertNoOpenAirfareCollection(booking: BookingDocument) {
  const [link, order, bank] = await Promise.all([
    BookingPaymentLinkRequest.exists({ bookingId: booking._id, status: { $in: ["created", "sent"] } }),
    BookingBalancePaymentSession.exists({ bookingId: booking._id, status: "pending" }),
    SmartCollectAccount.exists({ bookingId: booking._id, activeKey: { $exists: true } }),
  ]);
  if (link || order || bank) throw new HttpError(409, "An existing payment collection must be completed or cancelled before changing airfare");
}

export async function withBookingCollectionLockById<T>(bookingId: string, action: () => Promise<T>): Promise<T> {
  const token = crypto.randomUUID();
  const booking = await Booking.findOneAndUpdate({
    _id: bookingId,
    $or: [{ collectionLockUntil: null }, { collectionLockUntil: { $lt: new Date() } }],
  }, { $set: { collectionLockToken: token, collectionLockUntil: new Date(Date.now() + 120000) } });
  if (!booking) throw new HttpError(409, "Booking is unavailable or another payment update is in progress; please retry");
  try { return await action(); }
  finally { await Booking.updateOne({ _id: bookingId, collectionLockToken: token },
    { $unset: { collectionLockToken: "", collectionLockUntil: "" } }); }
}

export async function withBookingCollectionLock(request: Request, action: () => Promise<void>) {
  await withBookingCollectionLockById(String(request.params.id), action);
}

export async function updateBookingAirFlightCharges(request: Request, response: Response): Promise<void> {
  await withBookingCollectionLock(request, () => updateBookingAirFlightChargesInternal(request, response));
}

export async function createAdminBookingPaymentLink(request: Request, response: Response): Promise<void> {
  await withBookingCollectionLock(request, () => createAdminBookingPaymentLinkInternal(request, response));
}

export async function createBookingBalancePaymentOrder(request: Request, response: Response): Promise<void> {
  await getAuthenticatedTravellerPaidBookingById(request);
  await withBookingCollectionLock(request, () => createBookingBalancePaymentOrderInternal(request, response));
}

export async function updateBooking(request: Request, response: Response): Promise<void> {
  await withBookingCollectionLock(request, () => updateBookingInternal(request, response));
}

function queueAirfareConfirmation(booking: BookingDocument | null) {
  if (booking && (booking.airFlightCharges || 0) > 0) queueBookingConfirmationNotifications(booking);
}

export async function assertNoSmartCollectIdentifier(bookingId: string) {
  if (await SmartCollectAccount.exists({ bookingId, activeKey: { $exists: true } })) {
    throw new HttpError(409, "Close and reconcile the active bank-transfer identifier before changing pricing or using another payment method");
  }
}

export async function createSmartCollectBookingDraft(body: unknown, scope: string) {
  const payload = parseRequestBody(bookingPayloadSchema, {
    ...(body as Record<string, unknown>), amountPaid: 0, airFlightCharges: 0,
    gstPercentage: PUBLIC_BOOKING_GST_PERCENTAGE,
    airfareIncludedInTotal: false, paymentMethod: undefined,
  });
  if (!payload.departureId || !payload.selectedAccommodationOptionId) throw new HttpError(400, "Select a departure and accommodation");
  await assertTourExists(payload.tourId);
  const pendingBookingKey = "bank:" + crypto.createHash("sha256")
    .update(scope + ":" + createPendingBookingKey(payload) + JSON.stringify(payload.guestDetails) + JSON.stringify(payload.travellers)).digest("hex");
  let booking = await Booking.findOne({ pendingBookingKey }).select("+bankTransferToken");
  if (!booking) {
    const snapshot = await createSnapshotPayload(payload);
    if (!snapshot) throw new HttpError(400, "Booking prices could not be calculated");
    const draft = await createBookingDraft(payload, snapshot);
    try {
      booking = await Booking.create({
        ...draft, pendingBookingKey, paymentMode: "bank_transfer", bankTransferToken: createConfirmationToken(),
        amountPaid: 0, balanceAmount: draft.grandTotal, paymentStatus: "pending",
        bookingStatus: "payment_pending", paymentCapturedAt: null, paymentCurrency: PAYMENT_CURRENCY,
        heldSeatCount: 0, holdExpiresAt: null,
        recoveryExpiresAt: new Date(Date.now() + RECOVERY_EXPIRY_HOURS * 3600000),
        recoveryEmailStatus: "disabled", whatsappRecoveryStatus: "disabled",
      });
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
      booking = await Booking.findOne({ pendingBookingKey }).select("+bankTransferToken");
      if (!booking) throw error;
    }
  }
  if (["cancelled", "expired"].includes(booking.bookingStatus || "") ||
      (booking.paymentStatus !== "paid" && booking.recoveryExpiresAt && booking.recoveryExpiresAt <= new Date())) {
    throw new HttpError(409, "This bank-transfer booking has expired; contact our team before sending payment");
  }
  return booking;
}

function bookingPaymentLifecycleHooks(): PaymentLifecycleHooks {
  return {
    withLock: withBookingCollectionLockById,
    syncPayments: syncPaymentLinkRequestsForBookings,
    closePaidLinks: async booking => {
      const links = await BookingPaymentLinkRequest.find({ bookingId: booking._id, status: { $in: ["created", "sent"] },
        $or: [{ purpose: "final" }, { purpose: "additional", additionalChargeAppliedAt: { $ne: null } }],
      });
      for (const link of links) {
        if (isActivePaymentLinkRequest(link)) await createRazorpayClient().paymentLink.cancel(link.razorpayPaymentLinkId);
        link.status = "cancelled"; link.cancelledAt = new Date();
        link.failureReason = "Booking fully paid; remaining payment collection closed";
        await link.save();
      }
    },
    prepareLink: async (booking, airfare, expiresAt) => {
      if (await BookingBalancePaymentSession.exists({ bookingId: booking._id, status: "pending" })) {
        throw new HttpError(409, "An existing balance checkout must finish before another collection is created");
      }
      const otherCollection = await BookingPaymentLinkRequest.findOne({ bookingId: booking._id, status: { $in: ["created", "sent"] },
        purpose: { $ne: airfare ? "additional" : "final" },
      });
      if (otherCollection && isActivePaymentLinkRequest(otherCollection)) {
        throw new HttpError(409, "An existing payment collection must finish before another link is created");
      }
      const result = await prepareBookingPaymentLink(booking, {
        purpose: airfare ? "additional" : "final",
        additionalChargeAlreadyApplied: airfare,
        amount: getBookingOutstandingAmount(booking),
        description: airfare ? "Air-flight charge payment" : "",
      }, { expiresAt });
      return result.paymentLinkRequest;
    },
  };
}
