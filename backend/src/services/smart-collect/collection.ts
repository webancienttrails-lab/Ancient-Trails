import { verifiedPaymentMethod } from "../booking/booking.payment-method";
import crypto from "node:crypto";
import { SmartCollectGatewayError } from "./gateway";
import mongoose, { type ClientSession } from "mongoose";
import { Booking, type BookingDocument } from "../../models/booking.model";
import { SmartCollectAccount, SmartCollectTransfer, type ISmartCollectAccount } from "../../models/smartCollect.model";
import { HttpError } from "../../utils/httpError";
import { outstanding, paise, paymentDecision } from "./policy";
import type { SmartCollectGateway, VirtualAccount } from "./gateway";

let indexesReady: Promise<unknown> | undefined;
export function ensureSmartCollectIndexes() {
  if (!indexesReady) indexesReady = Promise.all([
    SmartCollectAccount.createIndexes(), SmartCollectTransfer.createIndexes(),
  ]).catch((error: unknown) => { indexesReady = undefined; throw error; });
  return indexesReady;
}

export type CollectionHooks = {
  reserveSeats: (id: string, count: number, session: ClientSession) => Promise<unknown>;
  restoreSeats: (id: string, count: number, session: ClientSession) => Promise<unknown>;
  recordCollection: (booking: BookingDocument, paymentId: string, amount: number) => boolean;
  notifyConfirmation: (booking: BookingDocument) => void;
};
export function assertAccountOwnership(account: { _id: unknown; bookingId: unknown; scope: string; virtualAccountId?: string }, remote: VirtualAccount) {
  if ((account.virtualAccountId && account.virtualAccountId !== remote.id) || remote.notes?.local_id !== String(account._id) || remote.notes?.booking_id !== String(account.bookingId) ||
      remote.notes?.scope !== account.scope) throw new HttpError(409, "Identifier ownership could not be verified");
}
async function saveRemote(account: mongoose.HydratedDocument<ISmartCollectAccount>, remote: VirtualAccount) {
  assertAccountOwnership(account, remote);
  const bank = remote.receivers?.find(receiver => receiver.entity === "bank_account");
  if (!bank?.account_number || !bank.ifsc || !bank.name) throw new HttpError(502, "Bank account details were not returned");
  account.virtualAccountId = remote.id;
  account.beneficiaryName = bank.name;
  account.accountNumber = bank.account_number;
  account.ifsc = bank.ifsc;
  account.bankName = bank.bank_name || "";
  account.status = remote.status === "closed" ? "closed" : "active";
  if (remote.status === "closed") {
    account.closedAt = remote.closed_at ? new Date(remote.closed_at * 1000) : (account.closedAt || new Date());
    account.activeKey = undefined;
  }
  account.error = "";
  await account.save();
  return account;
}
export async function recoverIdentifier(account: mongoose.HydratedDocument<ISmartCollectAccount>, gateway: SmartCollectGateway) {
  if (account.virtualAccountId) return account;
  // Do not re-POST after a timeout: the gateway may already have created the account.
  for (let skip = 0; skip < 100000; skip += 100) {
    const items = await gateway.list(skip);
    const found = items.find(item => item.notes?.local_id === String(account._id));
    if (found) return saveRemote(account, found);
    if (items.length < 100) break;
  }
  throw new HttpError(409, "Identifier creation is awaiting reconciliation; no duplicate bank account was created");
}
export async function closeIdentifier(account: mongoose.HydratedDocument<ISmartCollectAccount>, gateway: SmartCollectGateway) {
  if (!account.virtualAccountId) account = await recoverIdentifier(account, gateway);
  if (account.status !== "closed") {
    const remote = await gateway.close(account.virtualAccountId!);
    if (remote.status !== "closed") throw new HttpError(502, "Razorpay has not closed this identifier");
    await saveRemote(account, remote);
  }
  return account;
}
export async function createIdentifier(booking: BookingDocument, amountRequested: number, gateway: SmartCollectGateway) {
  await ensureSmartCollectIndexes();
  if (!Number.isSafeInteger(amountRequested) || amountRequested <= 0 || amountRequested > outstanding(booking)) {
    throw new HttpError(400, "Requested transfer exceeds the outstanding balance");
  }
  const activeKey = String(booking._id) + ":" + gateway.scope;
  let account = await SmartCollectAccount.findOne({ activeKey });
  if (account) {
    if (account.status === "creating" || account.status === "creation_unknown") return recoverIdentifier(account, gateway);
    if (account.status === "active" && account.expiresAt > new Date()) {
      account.amountRequested = amountRequested + account.amountApplied;
      await account.save();
      return account;
    }
    await closeIdentifier(account, gateway);
  }
  const configuredHours = Number(process.env.RAZORPAY_SMART_COLLECT_EXPIRY_HOURS || 48);
  const hours = Number.isFinite(configuredHours) ? Math.max(1, Math.min(720, configuredHours)) : 48;
  let expiresAt = new Date(Date.now() + hours * 3600000);
  if (booking.paymentStatus !== "paid" && booking.recoveryExpiresAt && booking.recoveryExpiresAt < expiresAt) expiresAt = booking.recoveryExpiresAt;
  if (expiresAt <= new Date()) throw new HttpError(409, "Booking payment window has expired");
  try {
    account = await SmartCollectAccount.create({
      bookingId: booking._id, bookingReference: booking.bookingReference,
      scope: gateway.scope, environment: gateway.environment, activeKey,
      amountRequested, expiresAt, status: "creating",
    });
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
    const winner = await SmartCollectAccount.findOne({ activeKey });
    if (!winner) throw error;
    return winner.virtualAccountId ? winner : recoverIdentifier(winner, gateway);
  }
  try {
    const remote = await gateway.create({
      receivers: { types: ["bank_account"] },
      description: "Ancient Trails " + booking.bookingReference,
      close_by: Math.floor(expiresAt.getTime() / 1000),
      notes: { local_id: String(account._id), booking_id: String(booking._id), booking_reference: booking.bookingReference, scope: gateway.scope },
    });
    return await saveRemote(account, remote);
  } catch (error) {
    const rejected = error instanceof SmartCollectGatewayError && error.definitiveRejection;
    account.status = rejected ? "failed" : "creation_unknown";
    account.error = rejected ? "Gateway rejected identifier creation" : "Creation outcome unknown; reconciliation required";
    if (rejected) account.activeKey = undefined;
    await account.save();
    throw new HttpError(502, account.error);
  }
}

export async function processBankPayment(accountId: string, paymentId: string, gateway: SmartCollectGateway, hooks: CollectionHooks) {
  await ensureSmartCollectIndexes();
  const originalAccount = await SmartCollectAccount.findOne({ _id: accountId, scope: gateway.scope });
  if (!originalAccount?.virtualAccountId) throw new HttpError(404, "Identifier not found in this Razorpay environment");
  const prior = await SmartCollectTransfer.findById(gateway.scope + ":" + paymentId);
  if (prior?.processedAt) {
    if (String(prior.accountId) !== accountId) throw new HttpError(400, "Payment belongs to another identifier");
    return null;
  }
  const [payment, transfer, remote] = await Promise.all([
    gateway.payment(paymentId), gateway.transfer(paymentId), gateway.fetch(originalAccount.virtualAccountId),
  ]);
  assertAccountOwnership(originalAccount, remote);
  if (payment.id !== paymentId || transfer.payment_id !== paymentId || transfer.virtual_account_id !== originalAccount.virtualAccountId ||
      transfer.amount !== payment.amount || payment.currency !== "INR" || payment.method !== "bank_transfer") {
    throw new HttpError(400, "Bank transfer does not match the booking identifier");
  }
  const ledgerId = gateway.scope + ":" + paymentId;
  if (payment.status !== "captured" || payment.captured !== true) {
    await SmartCollectTransfer.updateOne({ _id: ledgerId, processedAt: null }, { $setOnInsert: {
      bookingId: originalAccount.bookingId, accountId: originalAccount._id, scope: gateway.scope, paymentId,
      amount: Math.max(0, payment.amount), status: payment.status === "failed" ? "failed" : "pending",
      receivedAt: new Date(payment.created_at * 1000),
    } }, { upsert: true }).catch((error: unknown) => {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
    });
    return null;
  }
  const session = await mongoose.startSession();
  let result: BookingDocument | null = null;
  let credited = false;
  try {
    await session.withTransaction(async () => {
      credited = false;
      const existing = await SmartCollectTransfer.findById(ledgerId).session(session);
      if (existing?.processedAt) return;
      const account = await SmartCollectAccount.findOne({ _id: accountId, scope: gateway.scope }).session(session);
      const booking = await Booking.findById(originalAccount.bookingId).session(session);
      if (!account) throw new HttpError(404, "Bank transfer identifier not found");
      if (!booking) {
        if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) throw new HttpError(400, "Invalid bank transfer amount");
        const record = {
          bookingId: account.bookingId, accountId: account._id, scope: gateway.scope, paymentId,
          amount: payment.amount, amountApplied: 0, amountReview: payment.amount,
          status: "review" as const, mode: transfer.mode || "Bank Transfer", utr: transfer.bank_reference || "",
          reason: "Booking no longer exists; received funds require admin reconciliation",
          receivedAt: new Date(payment.created_at * 1000), processedAt: new Date(),
        };
        if (existing) { Object.assign(existing, record); await existing.save({ session }); }
        else await SmartCollectTransfer.create([{ _id: ledgerId, ...record }], { session });
        account.amountReceived += payment.amount;
        account.amountReview += payment.amount;
        await account.save({ session });
        return;
      }
      if (remote.closed_at) {
        account.closedAt = new Date(remote.closed_at * 1000);
        account.status = "closed";
        account.activeKey = undefined;
      }
      const decision = paymentDecision(booking, account, payment);
      let credit = decision.credit, review = decision.review, reason = decision.reason;
      if (credit > 0 && decision.confirms && booking.bookingStatus !== "confirmed") {
        const departureId = booking.departureId || booking.pricingSnapshot?.departureId || "";
        // Preserve old finite holds if this is a migrated or admin-created booking.
        const held = booking.heldSeatCount || 0;
        const activeHold = held >= booking.totalGuest && Boolean(booking.holdExpiresAt && booking.holdExpiresAt > new Date());
        if (!activeHold) {
          if (held > 0) {
            await hooks.restoreSeats(departureId, held, session);
            booking.heldSeatCount = 0;
            booking.holdExpiresAt = null;
            await booking.save({ session });
          }
          const reserved = await hooks.reserveSeats(departureId, booking.totalGuest, session);
          if (!reserved) { credit = 0; review = payment.amount; reason = "Seats unavailable; payment requires admin review"; }
        }
      }
      if (credit > 0) {
        if (!hooks.recordCollection(booking, paymentId, credit / 100)) throw new HttpError(409, "Payment is already present in booking history");
        booking.amountPaid = (paise(booking.amountPaid) + credit) / 100;
        booking.balanceAmount = outstanding(booking) / 100;
        booking.paymentMethod = verifiedPaymentMethod(transfer.mode, "bank_transfer");
        booking.paymentProvider = "razorpay";
        booking.paymentId = paymentId;
        booking.paymentOrderId = account.virtualAccountId;
        booking.paymentCurrency = "INR";
        booking.paymentCapturedAt = decision.receivedAt;
        if (decision.confirms) {
          booking.bookingStatus = "confirmed";
          booking.paymentStatus = "paid";
          booking.heldSeatCount = 0;
          booking.holdExpiresAt = null;
          booking.pendingBookingKey = undefined;
          booking.confirmationToken ||= crypto.randomBytes(24).toString("hex");
          booking.recoveryEmailStatus = "disabled";
          booking.whatsappRecoveryStatus = "disabled";
        }
        if (!booking.balanceAmount) booking.balanceDueDate = null;
        await booking.save({ session });
        credited = true;
      }
      const record = {
        bookingId: booking._id, accountId: account._id, scope: gateway.scope, paymentId,
        amount: payment.amount, amountApplied: credit, amountReview: review,
        status: review > 0 ? "review" as const : "applied" as const, mode: transfer.mode || "Bank Transfer",
        utr: transfer.bank_reference || "", reason, receivedAt: decision.receivedAt, processedAt: new Date(),
      };
      if (existing) { Object.assign(existing, record); await existing.save({ session }); }
      else await SmartCollectTransfer.create([{ _id: ledgerId, ...record }], { session });
      account.amountReceived += payment.amount;
      account.amountApplied += credit;
      account.amountReview += review;
      await account.save({ session });
      result = booking;
    });
  } catch (error) {
    // Another transaction may have committed the unique payment ledger first.
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000 ||
        !await SmartCollectTransfer.exists({ _id: ledgerId, processedAt: { $ne: null } })) throw error;
  } finally { await session.endSession(); }
  if (credited && result && (result as BookingDocument).bookingStatus === "confirmed") hooks.notifyConfirmation(result);
  return result;
}

export async function reconcileIdentifier(accountId: string, gateway: SmartCollectGateway, hooks: CollectionHooks) {
  let account = await SmartCollectAccount.findOne({ _id: accountId, scope: gateway.scope });
  if (!account) throw new HttpError(404, "Identifier not found in this Razorpay environment");
  if (!account.virtualAccountId) account = await recoverIdentifier(account, gateway);
  const remote = await gateway.fetch(account.virtualAccountId!);
  await saveRemote(account, remote);
  for (let skip = 0; ; skip += 100) {
    const payments = await gateway.payments(account.virtualAccountId!, skip);
    for (const payment of payments) {
      // Failed entries may not yet have bank-transfer metadata; retry captured entries only.
      if (payment.method !== "bank_transfer") continue;
      if (payment.status === "captured") await processBankPayment(String(account._id), payment.id, gateway, hooks);
      else await SmartCollectTransfer.updateOne(
        { _id: gateway.scope + ":" + payment.id, processedAt: null },
        { $set: { status: payment.status === "failed" ? "failed" : "pending" }, $setOnInsert: {
          bookingId: account.bookingId, accountId: account._id, scope: gateway.scope,
          paymentId: payment.id, amount: Math.max(0, payment.amount), receivedAt: new Date(payment.created_at * 1000),
        } }, { upsert: true }
      ).catch((error: unknown) => {
        if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
      });
    }
    if (payments.length < 100) break;
  }
  account = await SmartCollectAccount.findById(account._id);
  if (account?.status === "active") {
    const booking = await Booking.findById(account.bookingId);
    if (!booking || outstanding(booking) === 0 || ["cancelled", "expired"].includes(booking.bookingStatus || "") || account.expiresAt <= new Date()) {
      await closeIdentifier(account, gateway);
    }
  }
}

export async function closeCompletedIdentifier(accountId: string, gateway: SmartCollectGateway) {
  const account = await SmartCollectAccount.findOne({ _id: accountId, scope: gateway.scope, status: "active" });
  if (!account) return;
  const booking = await Booking.findById(account.bookingId);
  if (!booking || outstanding(booking) === 0 || ["cancelled", "expired"].includes(booking.bookingStatus || "") ||
      account.expiresAt <= new Date()) await closeIdentifier(account, gateway);
}
