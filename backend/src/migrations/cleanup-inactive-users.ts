import "dotenv/config";
import mongoose from "mongoose";
import { User, UserStatus } from "../models/user.model";
import { AuthSession } from "../models/authSession.model";
import {
  Notification,
  NotificationEvent,
  PushRegistration,
} from "../models/notification.model";
import { Booking } from "../models/booking.model";
import { Enquiry } from "../models/enquiry.model";
import { BookingPaymentSession } from "../models/bookingPaymentSession.model";
import { BookingBalancePaymentSession } from "../models/bookingBalancePaymentSession.model";
import { BookingPaymentLinkRequest } from "../models/bookingPaymentLinkRequest.model";
import { BookingPaymentNotice } from "../models/bookingPaymentNotice.model";
import { BookingCancellationRequest } from "../models/bookingCancellationRequest.model";
import { SmartCollectAccount, SmartCollectTransfer } from "../models/smartCollect.model";
import { OtpChallenge } from "../models/otpChallenge.model";
import crypto from "node:crypto";

const hasApplyFlag = process.argv.includes("--apply");

function identityValues(users: Array<{ email?: string; mobileNumber?: string }>) {
  return {
    emails: [...new Set(users.map((user) => user.email?.trim().toLowerCase()).filter((value): value is string => Boolean(value)))],
    phones: [...new Set(users.map((user) => user.mobileNumber?.replace(/\D/g, "")).filter((value): value is string => Boolean(value)))],
  };
}

function identityClauses(emailPath: string, phonePath: string, emails: string[], phones: string[]) {
  const clauses: Record<string, unknown>[] = [];
  if (emails.length) clauses.push({ [emailPath]: { $in: emails } });
  if (phones.length) clauses.push({ [phonePath]: { $in: phones } });
  return clauses;
}

function orQuery(clauses: Record<string, unknown>[]) {
  return clauses.length ? { $or: clauses } : { _id: { $in: [] } };
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");

  try {
    await mongoose.connect(databaseUrl, { serverSelectionTimeoutMS: 10000 });
    const [inactiveUsers, activeUsers] = await Promise.all([
      User.find({ status: { $ne: UserStatus.ACTIVE } }).select("_id email mobileNumber").lean(),
      User.find({ status: UserStatus.ACTIVE }).select("_id email mobileNumber").lean(),
    ]);
    const inactiveIds = inactiveUsers.map((user) => String(user._id));
    const activeIds = activeUsers.map((user) => String(user._id));
    const inactiveIdentity = identityValues(inactiveUsers);
    const activeIdentity = identityValues(activeUsers);
    const activeEmails = new Set(activeIdentity.emails);
    const activePhones = new Set(activeIdentity.phones);
    const emails = inactiveIdentity.emails.filter((email) => !activeEmails.has(email));
    const phones = inactiveIdentity.phones.filter((phone) => !activePhones.has(phone));
    const userObjectIds = inactiveUsers.map((user) => user._id);

    const bookingConditions = [
      ...(userObjectIds.length ? [{ notificationOwnerId: { $in: userObjectIds } }] : []),
      ...identityClauses("guestDetails.email", "guestDetails.mobileNumber", emails, phones),
    ];
    const activeBookingConditions = [
      ...(activeUsers.length ? [{ notificationOwnerId: { $in: activeUsers.map((user) => user._id) } }] : []),
      ...identityClauses("guestDetails.email", "guestDetails.mobileNumber", activeIdentity.emails, activeIdentity.phones),
    ];
    const bookingQuery = bookingConditions.length
      ? { $and: [{ $or: bookingConditions }, ...(activeBookingConditions.length ? [{ $nor: activeBookingConditions }] : [])] }
      : { _id: { $in: [] } };
    const affectedBookings = await Booking.find(bookingQuery).select("_id").lean();
    const bookingIds = affectedBookings.map((booking) => booking._id);

    const enquiryConditions = identityClauses("email", "phone", emails, phones);
    const activeEnquiryConditions = identityClauses("email", "phone", activeIdentity.emails, activeIdentity.phones);
    const enquiryQuery = enquiryConditions.length
      ? { $and: [{ $or: enquiryConditions }, ...(activeEnquiryConditions.length ? [{ $nor: activeEnquiryConditions }] : [])] }
      : { _id: { $in: [] } };

    const paymentDraftConditions = identityClauses("bookingDraft.guestDetails.email", "bookingDraft.guestDetails.mobileNumber", emails, phones);
    const activePaymentDraftConditions = identityClauses("bookingDraft.guestDetails.email", "bookingDraft.guestDetails.mobileNumber", activeIdentity.emails, activeIdentity.phones);
    const paymentSessionConditions = [
      ...(bookingIds.length ? [{ bookingId: { $in: bookingIds } }] : []),
      ...paymentDraftConditions,
    ];
    const paymentSessionQuery = paymentSessionConditions.length
      ? { $and: [{ $or: paymentSessionConditions }, ...(activePaymentDraftConditions.length ? [{ $nor: activePaymentDraftConditions }] : [])] }
      : { _id: { $in: [] } };

    const filters = {
      authSessions: { userId: { $in: inactiveIds } },
      notifications: { recipientId: { $in: inactiveIds } },
      pushRegistrations: { userId: { $in: inactiveIds } },
      notificationEvents: { $or: [
        { "payload.userId": { $in: inactiveIds } },
        ...(bookingIds.length ? [{ "payload.bookingId": { $in: bookingIds.map(String) } }] : []),
      ] },
      bookings: bookingQuery,
      bookingPaymentSessions: paymentSessionQuery,
      bookingBalancePaymentSessions: { bookingId: { $in: bookingIds } },
      bookingPaymentLinkRequests: { bookingId: { $in: bookingIds } },
      bookingPaymentNotices: { bookingId: { $in: bookingIds } },
      bookingCancellationRequests: { bookingId: { $in: bookingIds } },
      smartCollectAccounts: { bookingId: { $in: bookingIds } },
      smartCollectTransfers: { bookingId: { $in: bookingIds } },
      enquiries: enquiryQuery,
      otpChallenges: { _id: { $in: phones.map((phone) => crypto.createHash("sha256").update(phone).digest("hex")) } },
    };

    const counts = {
      inactiveUsers: inactiveUsers.length,
      activeUsersPreserved: activeUsers.length,
      linkedRecords: {
        authSessions: await AuthSession.countDocuments(filters.authSessions),
        notifications: await Notification.countDocuments(filters.notifications),
        pushRegistrations: await PushRegistration.countDocuments(filters.pushRegistrations),
        notificationEvents: await NotificationEvent.countDocuments(filters.notificationEvents),
        bookings: affectedBookings.length,
        bookingPaymentSessions: await BookingPaymentSession.countDocuments(filters.bookingPaymentSessions),
        bookingBalancePaymentSessions: await BookingBalancePaymentSession.countDocuments(filters.bookingBalancePaymentSessions),
        bookingPaymentLinkRequests: await BookingPaymentLinkRequest.countDocuments(filters.bookingPaymentLinkRequests),
        bookingPaymentNotices: await BookingPaymentNotice.countDocuments(filters.bookingPaymentNotices),
        bookingCancellationRequests: await BookingCancellationRequest.countDocuments(filters.bookingCancellationRequests),
        smartCollectAccounts: await SmartCollectAccount.countDocuments(filters.smartCollectAccounts),
        smartCollectTransfers: await SmartCollectTransfer.countDocuments(filters.smartCollectTransfers),
        enquiries: await Enquiry.countDocuments(filters.enquiries),
        otpChallenges: await OtpChallenge.countDocuments(filters.otpChallenges),
      },
      invoiceRecords: "Invoices are generated from booking records; no separate invoice collection exists.",
    };
    console.log(JSON.stringify({ mode: hasApplyFlag ? "apply" : "dry-run", counts }, null, 2));

    if (!hasApplyFlag) return;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const options = { session };
        await AuthSession.deleteMany(filters.authSessions, options);
        await Notification.deleteMany(filters.notifications, options);
        await PushRegistration.deleteMany(filters.pushRegistrations, options);
        await NotificationEvent.deleteMany(filters.notificationEvents, options);
        await OtpChallenge.deleteMany(filters.otpChallenges, options);
        await BookingPaymentSession.deleteMany(filters.bookingPaymentSessions, options);
        await BookingBalancePaymentSession.deleteMany(filters.bookingBalancePaymentSessions, options);
        await BookingPaymentLinkRequest.deleteMany(filters.bookingPaymentLinkRequests, options);
        await BookingPaymentNotice.deleteMany(filters.bookingPaymentNotices, options);
        await BookingCancellationRequest.deleteMany(filters.bookingCancellationRequests, options);
        await SmartCollectAccount.deleteMany(filters.smartCollectAccounts, options);
        await SmartCollectTransfer.deleteMany(filters.smartCollectTransfers, options);
        await Enquiry.deleteMany(filters.enquiries, options);
        await Booking.deleteMany(filters.bookings, options);
        await User.deleteMany({ _id: { $in: userObjectIds } }, options);
      });
    } finally {
      await session.endSession();
    }
    console.log("Inactive user accounts and linked records removed.");
  } finally {
    await mongoose.disconnect();
  }
}

void run().catch(() => {
  console.error("Inactive user cleanup failed; no cleanup result is available. Check database connectivity and configuration.");
  process.exitCode = 1;
});
