import crypto from "node:crypto";
import { OtpChallenge, OtpSendLimit } from "../models/otpChallenge.model";
import { HttpError } from "../utils/httpError";

export const OTP_VALIDITY_MS = 5 * 60_000;
const LOCK_MS = 15 * 60_000;
const epoch = new Date(0);
const fingerprint = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const lockedError = () => new HttpError(429, "Too many OTP attempts. Try again in 15 minutes.");
const expiredError = () => new HttpError(401, "Code expired or already used. Request a new OTP.");

async function initialize(write: () => PromiseLike<unknown>) {
  try { await write(); }
  catch (error) {
    // A simultaneous first request may have inserted the same unique key.
    if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
  }
}

async function countSend(key: string, limit: number, now: number) {
  const window = Math.floor(now / LOCK_MS);
  const _id = fingerprint(key + ":" + window);
  await initialize(() => OtpSendLimit.updateOne({ _id }, {
    $setOnInsert: { count: 0, cleanupAt: new Date((window + 2) * LOCK_MS) },
  }, { upsert: true }));
  const reserved = await OtpSendLimit.findOneAndUpdate({ _id, count: { $lt: limit } }, { $inc: { count: 1 } });
  if (!reserved) throw new HttpError(429, "Too many OTP requests. Try again in 15 minutes.");
}

export async function guardedOtpSend<T>(mobile: string, ip: string, deliver: () => Promise<T>): Promise<T> {
  const now = Date.now(), _id = fingerprint(mobile), generation = crypto.randomUUID();
  await initialize(() => OtpChallenge.updateOne({ _id }, {
    $setOnInsert: { cleanupAt: new Date(now + 86400_000) },
  }, { upsert: true }));
  const current = await OtpChallenge.findById(_id);
  if (current && current.verifyingUntil.getTime() > now) throw new HttpError(429, "OTP verification is already in progress. Please wait.");
  if (current && current.lockedUntil.getTime() > now) throw lockedError();
  if (current && current.sendAfter.getTime() > now) throw new HttpError(429, "Please wait 60 seconds before requesting another OTP.");
  // Shared counters cover all login, booking and profile OTP entry points.
  await countSend("phone:" + mobile, 5, now);
  await countSend("ip:" + ip, 30, now);
  const reserved = await OtpChallenge.findOneAndUpdate({
    _id, lockedUntil: { $lte: new Date(now) }, sendAfter: { $lte: new Date(now) },
    verifyingUntil: { $lte: new Date(now) },
  }, { $set: {
    generation, attempts: 0, consumed: true, expiresAt: epoch, verificationId: "",
    sendAfter: new Date(now + 60_000), cleanupAt: new Date(now + 86400_000),
  } });
  if (!reserved) throw new HttpError(429, "An OTP request is already in progress. Please wait before trying again.");
  const result = await deliver();
  await OtpChallenge.updateOne({ _id, generation }, { $set: {
    consumed: false, expiresAt: new Date(now + OTP_VALIDITY_MS),
  } });
  return result;
}

export async function guardedOtpVerification<T>(mobile: string, otp: string, verify: () => Promise<T>): Promise<T> {
  if (!/^\d{6}$/.test(otp)) throw new HttpError(400, "OTP must be 6 digits");
  const now = Date.now(), _id = fingerprint(mobile), verificationId = crypto.randomUUID();
  const current = await OtpChallenge.findById(_id);
  if (current && current.verifyingUntil.getTime() > now) throw new HttpError(429, "OTP verification is already in progress. Please wait.");
  if (current && current.lockedUntil.getTime() > now) throw lockedError();
  const challenge = await OtpChallenge.findOneAndUpdate({
    _id, consumed: false, expiresAt: { $gt: new Date(now) }, attempts: { $lt: 5 },
    lockedUntil: { $lte: new Date(now) }, verifyingUntil: { $lte: new Date(now) },
  }, { $inc: { attempts: 1 }, $set: {
    verificationId, verifyingUntil: new Date(now + 30_000), lockedUntil: new Date(now + LOCK_MS),
  } }, { new: true });
  if (!challenge) throw expiredError();
  const filter = { _id, generation: challenge.generation, verificationId };
  let result: T;
  try { result = await verify(); }
  catch (error) {
    const wrongCode = error instanceof HttpError && [400, 401].includes(error.statusCode);
    await OtpChallenge.updateOne(filter, {
      $set: { verifyingUntil: epoch, lockedUntil: wrongCode && challenge.attempts >= 5 ? new Date(Date.now() + LOCK_MS) : epoch },
      ...(!wrongCode ? { $inc: { attempts: -1 } } : {}),
    });
    if (wrongCode && challenge.attempts >= 5) throw lockedError();
    throw error;
  }
  // Check the deadline again: a slow provider response cannot extend validity.
  const consumed = await OtpChallenge.updateOne({ ...filter, consumed: false, expiresAt: { $gt: new Date(Date.now()) } }, {
    $set: { consumed: true, verifyingUntil: epoch, lockedUntil: epoch },
  });
  if (consumed.modifiedCount !== 1) {
    await OtpChallenge.updateOne(filter, { $set: { consumed: true, verifyingUntil: epoch, lockedUntil: epoch } });
    throw expiredError();
  }
  return result;
}
