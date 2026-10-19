import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type { PricingSnapshot } from "../services/booking/booking.snapshot";
import { Tour } from "./tour.model";
import { allocateBookingReference } from "../services/booking/booking-reference.service";

export interface IBookingGuestDetails {
  title: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  email: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  dateOfBirth: Date;
  gender: string;
  address: string;
  panNumber?: string;
}

export interface IBookingChildDetails {
  age: number;
}

export interface IBookingAccommodationDetails {
  singleOccupancyOneRoom: number;
  singleOccupancyTwoRooms: number;
  doubleOccupancy: number;
  twinOccupancy: number;
  tripleOccupancy: number;
}

export interface IBookingKycDocument {
  id: string;
  documentType:
    | "aadhaar_card"
    | "driving_license"
    | "voter_id"
    | "passport"
    | "pan_card";
  documentLabel: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedBy: "traveller" | "admin";
  uploadedAt: Date;
}

export interface IBookingTraveller {
  id: string;
  type: "adult" | "child";
  title?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  mobileNumber?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  panNumber?: string;
  ageOnDeparture?: number;
  kycDocuments?: IBookingKycDocument[];
}

export interface IBooking {
  cancellation?: {
    reason: string;
    chargePercentage: number;
    requestedBy: "Customer" | "Admin" | "Tour Operator";
    notes: string;
    cancelledAt: Date;
  };
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
  bookingReference?: string;
  pendingBookingKey?: string;
  bookingStatus?:
    | "draft"
    | "payment_pending"
    | "payment_processing"
    | "confirmed"
    | "expired"
    | "cancelled";
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: "advance" | "full";
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: IBookingChildDetails[];
  guestDetails: IBookingGuestDetails[];
  travellers: IBookingTraveller[];
  accommodationDetails: IBookingAccommodationDetails;
  pricingSnapshot?: PricingSnapshot;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  grandTotal?: number;
  airFlightCharges?: number;
  airfareIncludedInTotal?: boolean;
  airfareExcluded?: boolean;
  airfareAddedAt?: Date | null;
  paymentLifecyclePending?: boolean;
  notificationOwnerId?: string;
  collectionLockToken?: string;
  collectionLockUntil?: Date | null;
  airfareHistory?: Array<{ previousAmount: number; amount: number; changedBy: string; changedAt: Date; previousIncludedInTotal?: boolean; includedInTotal?: boolean; previousTotal?: number; total?: number; reason?: string }>;
  collectionHistory?: Array<{ paymentId: string; amount: number; airfareAmount: number; paidAt: Date }>;
  depositAmount?: number;
  balanceAmount?: number;
  balanceDueDate?: Date | null;
  paymentMode?: "online" | "offline" | "bank_transfer";
  bankTransferToken?: string;
  offlineSubmissionToken?: string;
  offlineAdminEmailStatus?: "pending" | "sending" | "sent" | "failed";
  offlineAdminWhatsappStatus?: "pending" | "sending" | "sent" | "failed";
  offlineAdminEmailAttemptedAt?: Date | null;
  offlineAdminWhatsappAttemptedAt?: Date | null;
  offlineAdminEmailError?: string;
  offlineAdminWhatsappError?: string;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: "cash" | "cheque" | "neft" | "imps" | "rtgs" | "upi" | "netbanking" | "card" | "wallet" | "emi" | "razorpay" | "bank_transfer";
  paymentProvider?: "razorpay";
  paymentOrderId?: string;
  paymentId?: string;
  paymentSignature?: string;
  paymentCurrency?: string;
  amountPaid?: number;
  paymentCapturedAt?: Date | null;
  heldSeatCount?: number;
  holdExpiresAt?: Date | null;
  recoveryExpiresAt?: Date | null;
  recoveryToken?: string;
  recoveryEmailStatus?: "pending" | "sending" | "sent" | "failed" | "disabled";
  recoveryEmailAttemptedAt?: Date | null;
  recoveryEmailSentAt?: Date | null;
  recoveryEmailError?: string;
  whatsappMarketingConsent?: boolean;
  whatsappRecoveryStatus?:
    | "pending"
    | "sending"
    | "sent"
    | "failed"
    | "disabled";
  whatsappRecoveryAttemptedAt?: Date | null;
  whatsappRecoverySentAt?: Date | null;
  whatsappRecoveryRecipient?: string;
  whatsappRecoveryRequestId?: string;
  whatsappRecoveryError?: string;
  recoveryReminderCount?: number;
  recoveryLastReminderSentAt?: Date | null;
  confirmationToken?: string;
  archivedAt?: Date | null;
  emailBookingConfirmationStatus?:
    | "pending"
    | "sending"
    | "sent"
    | "failed";
  emailBookingConfirmationAttemptedAt?: Date | null;
  emailBookingConfirmationSentAt?: Date | null;
  emailBookingConfirmationRecipient?: string;
  emailBookingConfirmationMessageId?: string;
  emailBookingConfirmationError?: string;
  whatsappBookingConfirmationStatus?:
    | "pending"
    | "sending"
    | "sent"
    | "failed";
  whatsappBookingConfirmationAttemptedAt?: Date | null;
  whatsappBookingConfirmationSentAt?: Date | null;
  whatsappBookingConfirmationRecipient?: string;
  whatsappBookingConfirmationRequestId?: string;
  whatsappBookingConfirmationError?: string;
  kycCompletionEmailAttemptedAt?: Date | null;
  kycCompletionEmailSentAt?: Date | null;
  kycCompletionEmailError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingDocument = HydratedDocument<IBooking>;

const trimmedString = {
  type: String,
  trim: true,
  default: "",
};

const optionalUniqueTrimmedString = {
  type: String,
  trim: true,
  default: undefined,
  set(value: unknown) {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  },
};

const requiredTrimmedString = {
  type: String,
  required: true,
  trim: true,
};

const nonNegativeNumber = {
  type: Number,
  min: 0,
  default: 0,
};

const guestDetailsSchema = new Schema<IBookingGuestDetails>(
  {
    title: {
      ...requiredTrimmedString,
      maxlength: 20,
    },
    firstName: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    lastName: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    countryCode: {
      ...requiredTrimmedString,
      maxlength: 8,
    },
    mobileNumber: {
      ...requiredTrimmedString,
      maxlength: 20,
    },
    email: {
      ...trimmedString,
      lowercase: true,
      maxlength: 160,
    },
    emergencyContactName: {
      ...trimmedString,
      maxlength: 120,
    },
    emergencyContactMobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      ...requiredTrimmedString,
      maxlength: 40,
    },
    address: {
      ...requiredTrimmedString,
      maxlength: 500,
    },
    panNumber: {
      ...trimmedString,
      maxlength: 20,
    },
  },
  {
    _id: false,
  }
);

const childDetailsSchema = new Schema<IBookingChildDetails>(
  {
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 17,
    },
  },
  {
    _id: false,
  }
);

const kycDocumentSchema = new Schema<IBookingKycDocument>(
  {
    id: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    documentType: {
      type: String,
      enum: [
        "aadhaar_card",
        "driving_license",
        "voter_id",
        "passport",
        "pan_card",
      ],
      required: true,
    },
    documentLabel: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    fileName: {
      ...requiredTrimmedString,
      maxlength: 180,
    },
    fileUrl: {
      ...requiredTrimmedString,
      maxlength: 500,
    },
    mimeType: {
      ...requiredTrimmedString,
      maxlength: 120,
    },
    uploadedBy: {
      type: String,
      enum: ["traveller", "admin"],
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const travellerSchema = new Schema<IBookingTraveller>(
  {
    id: {
      ...requiredTrimmedString,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: ["adult", "child"],
      required: true,
    },
    title: {
      ...trimmedString,
      maxlength: 20,
    },
    firstName: {
      ...trimmedString,
      maxlength: 80,
    },
    lastName: {
      ...trimmedString,
      maxlength: 80,
    },
    countryCode: {
      ...trimmedString,
      maxlength: 8,
    },
    mobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    email: {
      ...trimmedString,
      lowercase: true,
      maxlength: 160,
    },
    emergencyContactName: {
      ...trimmedString,
      maxlength: 120,
    },
    emergencyContactMobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      ...trimmedString,
      maxlength: 40,
    },
    address: {
      ...trimmedString,
      maxlength: 500,
    },
    panNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    ageOnDeparture: {
      ...nonNegativeNumber,
      max: 120,
    },
    kycDocuments: {
      type: [kycDocumentSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const accommodationDetailsSchema = new Schema<IBookingAccommodationDetails>(
  {
    singleOccupancyOneRoom: {
      ...nonNegativeNumber,
      max: 100,
    },
    singleOccupancyTwoRooms: {
      ...nonNegativeNumber,
      max: 100,
    },
    doubleOccupancy: {
      ...nonNegativeNumber,
      max: 100,
    },
    twinOccupancy: {
      ...nonNegativeNumber,
      max: 100,
    },
    tripleOccupancy: {
      ...nonNegativeNumber,
      max: 100,
    },
  },
  {
    _id: false,
  }
);

const bookingSchema = new Schema<IBooking>(
  {
    cancellation: {
      type: new Schema({
        reason: { type: String, trim: true, required: true, maxlength: 1000 },
        chargePercentage: { type: Number, required: true, min: 0, max: 100 },
        requestedBy: { type: String, enum: ["Customer", "Admin", "Tour Operator"], required: true },
        notes: { type: String, trim: true, default: "", maxlength: 2000 },
        cancelledAt: { type: Date, required: true },
      }, { _id: false }),
      default: undefined,
    },
    emergencyContactName: {
      ...trimmedString,
      maxlength: 120,
    },
    emergencyContactMobileNumber: {
      ...trimmedString,
      maxlength: 20,
    },
    tourId: {
      ...requiredTrimmedString,
      uppercase: true,
      maxlength: 40,
    },
    bookingReference: {
      ...trimmedString,
      uppercase: true,
      maxlength: 40,
    },
    pendingBookingKey: {
      ...optionalUniqueTrimmedString,
      maxlength: 128,
    },
    bookingStatus: {
      type: String,
      enum: [
        "draft",
        "payment_pending",
        "payment_processing",
        "confirmed",
        "expired",
        "cancelled",
      ],
      default: "payment_pending",
    },
    departureId: {
      ...trimmedString,
      uppercase: true,
      maxlength: 40,
    },
    selectedAccommodationOptionId: {
      ...trimmedString,
      maxlength: 200,
    },
    paymentOption: {
      type: String,
      enum: ["advance", "full"],
      default: "advance",
    },
    totalGuest: {
      ...nonNegativeNumber,
      min: 1,
      max: 1000,
      required: true,
    },
    adultCount: {
      ...nonNegativeNumber,
      max: 1000,
      required: true,
    },
    childCount: {
      ...nonNegativeNumber,
      max: 1000,
      required: true,
    },
    childDetails: {
      type: [childDetailsSchema],
      default: [],
    },
    guestDetails: {
      type: [guestDetailsSchema],
      default: [],
      validate: {
        validator(values: IBookingGuestDetails[]) {
          return values.length > 0;
        },
        message: "At least one guest detail is required",
      },
    },
    travellers: {
      type: [travellerSchema],
      default: [],
    },
    accommodationDetails: {
      type: accommodationDetailsSchema,
      required: true,
      default: {},
    },
    pricingSnapshot: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    subtotal: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    gstPercentage: {
      ...nonNegativeNumber,
      max: 100,
    },
    gstAmount: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    grandTotal: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    airfareIncludedInTotal: { type: Boolean, default: false },
    airfareExcluded: { type: Boolean, default: undefined },
    airfareAddedAt: { type: Date, default: null },
    notificationOwnerId: { type: Schema.Types.ObjectId, ref: "User" },
    paymentLifecyclePending: { type: Boolean, default: false },
    collectionLockToken: { type: String, default: "" },
    collectionLockUntil: { type: Date, default: null },
    airfareHistory: { type: [{ _id: false, previousAmount: Number, amount: Number, changedBy: String, changedAt: Date, previousIncludedInTotal: Boolean, includedInTotal: Boolean, previousTotal: Number, total: Number, reason: String }], default: [] },
    collectionHistory: { type: [{ _id: false, paymentId: String, amount: Number, airfareAmount: Number, paidAt: Date }], default: [] },
    airFlightCharges: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    depositAmount: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    balanceAmount: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    balanceDueDate: {
      type: Date,
      default: null,
    },
    paymentMode: { type: String, enum: ["online", "offline", "bank_transfer"], default: "online" },
    bankTransferToken: { type: String, select: false },
    offlineSubmissionToken: { ...trimmedString, maxlength: 128 },
    offlineAdminEmailStatus: { type: String, enum: ["pending", "sending", "sent", "failed"] },
    offlineAdminWhatsappStatus: { type: String, enum: ["pending", "sending", "sent", "failed"] },
    offlineAdminEmailAttemptedAt: Date,
    offlineAdminWhatsappAttemptedAt: Date,
    offlineAdminEmailError: String,
    offlineAdminWhatsappError: String,
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "cheque", "neft", "imps", "rtgs", "upi", "netbanking", "card", "wallet", "emi", "razorpay", "bank_transfer"],
      default: undefined,
    },
    paymentProvider: {
      type: String,
      enum: ["razorpay"],
      default: undefined,
    },
    paymentOrderId: {
      ...trimmedString,
      maxlength: 120,
    },
    paymentId: {
      ...trimmedString,
      maxlength: 120,
    },
    paymentSignature: {
      ...trimmedString,
      maxlength: 256,
    },
    paymentCurrency: {
      ...trimmedString,
      uppercase: true,
      maxlength: 10,
    },
    amountPaid: {
      ...nonNegativeNumber,
      max: 1000000000,
    },
    paymentCapturedAt: {
      type: Date,
      default: null,
    },
    heldSeatCount: {
      ...nonNegativeNumber,
      max: 100000,
    },
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    recoveryExpiresAt: {
      type: Date,
      default: null,
    },
    recoveryToken: {
      ...trimmedString,
      maxlength: 128,
    },
    recoveryEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "disabled"],
      default: "pending",
    },
    recoveryEmailAttemptedAt: {
      type: Date,
      default: null,
    },
    recoveryEmailSentAt: {
      type: Date,
      default: null,
    },
    recoveryEmailError: {
      ...trimmedString,
      maxlength: 500,
    },
    whatsappMarketingConsent: {
      type: Boolean,
      default: true,
    },
    whatsappRecoveryStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "disabled"],
      default: "pending",
    },
    whatsappRecoveryAttemptedAt: {
      type: Date,
      default: null,
    },
    whatsappRecoverySentAt: {
      type: Date,
      default: null,
    },
    whatsappRecoveryRecipient: {
      ...trimmedString,
      maxlength: 20,
    },
    whatsappRecoveryRequestId: {
      ...trimmedString,
      maxlength: 160,
    },
    whatsappRecoveryError: {
      ...trimmedString,
      maxlength: 500,
    },
    recoveryReminderCount: {
      ...nonNegativeNumber,
      max: 10,
    },
    recoveryLastReminderSentAt: {
      type: Date,
      default: null,
    },
    confirmationToken: {
      ...trimmedString,
      maxlength: 128,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    emailBookingConfirmationStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    emailBookingConfirmationAttemptedAt: {
      type: Date,
      default: null,
    },
    emailBookingConfirmationSentAt: {
      type: Date,
      default: null,
    },
    emailBookingConfirmationRecipient: {
      ...trimmedString,
      lowercase: true,
      maxlength: 160,
    },
    emailBookingConfirmationMessageId: {
      ...trimmedString,
      maxlength: 200,
    },
    emailBookingConfirmationError: {
      ...trimmedString,
      maxlength: 500,
    },
    whatsappBookingConfirmationStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    whatsappBookingConfirmationAttemptedAt: {
      type: Date,
      default: null,
    },
    whatsappBookingConfirmationSentAt: {
      type: Date,
      default: null,
    },
    whatsappBookingConfirmationRecipient: {
      ...trimmedString,
      maxlength: 20,
    },
    whatsappBookingConfirmationRequestId: {
      ...trimmedString,
      maxlength: 160,
    },
    whatsappBookingConfirmationError: {
      ...trimmedString,
      maxlength: 500,
    },
    kycCompletionEmailAttemptedAt: {
      type: Date,
      default: null,
    },
    kycCompletionEmailSentAt: {
      type: Date,
      default: null,
    },
    kycCompletionEmailError: {
      ...trimmedString,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.pre("save", function queuePaymentLifecycleDelivery() {
  if (this.bookingStatus !== "confirmed" || this.paymentStatus !== "paid" || this.archivedAt) return;
  if (!this.isNew && !this.isModified("amountPaid") && !this.isModified("grandTotal") && !this.isModified("airFlightCharges")) return;
  const total = this.grandTotal || 0;
  const paid = this.amountPaid || 0;
  const fare = this.airFlightCharges || 0;
  // Price changes alone must not create a new full-payment confirmation.
  const paymentReceived = this.isNew || this.isModified("amountPaid");
  if (total > 0 && paid > 0 && (paymentReceived && paid >= total || this.airfareExcluded && !this.airfareIncludedInTotal && fare > 0 && this.airfareAddedAt && paid >= total - fare)) {
    this.paymentLifecyclePending = true;
  }
});

bookingSchema.pre("save", async function assignBookingReference() {
  if (!this.isNew || this.bookingReference?.trim()) return;
  const session = this.$session() || undefined;
  const tour = await Tour.findOne({ tourId: this.tourId }).select("tourType").session(session || null);
  if (!tour) throw new Error("Tour not found while generating booking ID");
  this.bookingReference = await allocateBookingReference(tour.tourType, session);
});

bookingSchema.pre("validate", function requireLeadTravellerEmail() {
  if (this.guestDetails.length > 0 && !this.guestDetails[0].email?.trim()) {
    this.invalidate("guestDetails.0.email", "Lead traveller email is required");
  }
});

bookingSchema.pre("validate", function normalizePendingBookingKey() {
  if (
    typeof this.pendingBookingKey === "string" &&
    this.pendingBookingKey.trim().length === 0
  ) {
    this.pendingBookingKey = undefined;
  }
});

bookingSchema.index({ tourId: 1 });
bookingSchema.index({ bookingReference: 1 }, { sparse: true });
bookingSchema.index({ pendingBookingKey: 1 }, { unique: true, sparse: true });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ paymentLifecyclePending: 1, bookingStatus: 1 });
bookingSchema.index({ balanceDueDate: 1, bookingStatus: 1 });
bookingSchema.index({ departureId: 1 });
bookingSchema.index({ "guestDetails.email": 1 });
bookingSchema.index({ paymentOrderId: 1 }, { sparse: true });
bookingSchema.index({ paymentId: 1 }, { sparse: true });
bookingSchema.index({ confirmationToken: 1 }, { sparse: true });
bookingSchema.index({ recoveryToken: 1 }, { sparse: true });
bookingSchema.index({ holdExpiresAt: 1 });
bookingSchema.index({ recoveryExpiresAt: 1 });
bookingSchema.index({ archivedAt: 1 });
bookingSchema.index({ emailBookingConfirmationStatus: 1 });
bookingSchema.index({ whatsappBookingConfirmationStatus: 1 });
bookingSchema.index({ whatsappRecoveryStatus: 1 });
bookingSchema.index({ kycCompletionEmailSentAt: 1 });
bookingSchema.index({
  tourId: "text",
  "guestDetails.firstName": "text",
  "guestDetails.lastName": "text",
  "guestDetails.email": "text",
  "guestDetails.mobileNumber": "text",
});

bookingSchema.virtual("tour", {
  ref: "Tour",
  localField: "tourId",
  foreignField: "tourId",
  justOne: true,
});

bookingSchema.set("toJSON", { virtuals: true });
bookingSchema.set("toObject", { virtuals: true });

// Queue asynchronously; source reconciliation catches a process restart between commit and enqueue.
bookingSchema.post("save", function (doc) {
  if (doc.db.readyState === 1) setImmediate(() => { void import("../services/notifications/notification-events.service.js").then(service => service.queueBookingNotifications(doc.id)).catch(() => {}); });
});
bookingSchema.post("findOneAndUpdate", function (doc) {
  const update = this.getUpdate() as Record<string, any> | null;
  if (!doc || doc.db.readyState !== 1 || !update) return;
  const keys = Object.keys(update.$set || update);
  if (!keys.some(key => ["paymentStatus", "bookingStatus", "amountPaid", "paymentCapturedAt", "cancellation"].includes(key))) return;
  setImmediate(() => { void import("../services/notifications/notification-events.service.js").then(service => service.queueBookingNotifications(String(doc._id))).catch(() => {}); });
});
bookingSchema.index({ updatedAt: 1, _id: 1 });

export const Booking =
  (models.Booking as Model<IBooking> | undefined) ||
  model<IBooking>("Booking", bookingSchema);
