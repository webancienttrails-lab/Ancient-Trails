import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { User } from "../models/user.model";
import { Tour } from "../models/tour.model";
import { TourDeparture } from "../models/tourDeparture.model";
import { Notification, NotificationEvent, PushDelivery, PushRegistration } from "../models/notification.model";
import { verifyAuthToken } from "../utils/jwt";
import { HttpError } from "../utils/httpError";
import { isAdminRole } from "../middleware/adminAuth";
import { encryptRegistration, notificationKey, registrationHash } from "../services/notifications/notification-security";
import { stageNotificationEvent } from "../services/notifications/notification-events.service";

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, "Validation failed", result.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })));
  return result.data;
}
export async function requireNotificationUser(request: Request, response: Response, next: NextFunction) {
  try {
    const audience = request.params.audience;
    if (audience !== "admin" && audience !== "customer") throw new HttpError(404, "Notification inbox not found");
    const [scheme, token] = request.headers.authorization?.split(" ") || [];
    if (scheme !== "Bearer" || !token) throw new HttpError(401, "Please sign in to continue");
    const claims = verifyAuthToken(token), user = await User.findById(claims.userId);
    if (!user || user.status !== "active" || !(audience === "admin" ? user.roles.some(isAdminRole) : user.roles.includes("traveller"))) throw new HttpError(403, "Notification access is not permitted");
    response.locals.notificationOwner = { recipientId: user.id, audience }; next();
  } catch (error) { next(error); }
}
const owner = (response: Response) => response.locals.notificationOwner as { recipientId: string; audience: "admin" | "customer" };
export async function listNotifications(request: Request, response: Response) {
  const { limit, cursor, unreadOnly } = parse(z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(300).optional(), unreadOnly: z.enum(["true", "false"]).optional() }), request.query);
  const filter: Record<string, unknown> = { ...owner(response), ...(unreadOnly === "true" ? { readAt: null } : {}) };
  if (cursor) {
    try {
      const value = parse(z.object({ at: z.string().datetime(), id: z.string().regex(/^[a-f0-9]{64}$/) }), JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
      filter.$or = [{ createdAt: { $lt: new Date(value.at) } }, { createdAt: new Date(value.at), _id: { $lt: value.id } }];
    } catch { throw new HttpError(400, "Invalid notification cursor"); }
  }
  const [rows, unreadCount] = await Promise.all([Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(), Notification.countDocuments({ ...owner(response), readAt: null })]);
  const notifications = rows.slice(0, limit), last = notifications[notifications.length - 1];
  response.json({ success: true, message: "Notifications fetched", data: { notifications, unreadCount,
    nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ at: new Date(last.createdAt).toISOString(), id: last._id })).toString("base64url") : null,
  } });
}
export async function readNotification(request: Request, response: Response) {
  const { read } = parse(z.object({ read: z.boolean() }), request.body);
  const notice = await Notification.findOneAndUpdate({ _id: request.params.id, ...owner(response) }, { $set: { readAt: read ? new Date() : null } }, { new: true });
  if (!notice) throw new HttpError(404, "Notification not found");
  response.json({ success: true, message: "Notification updated", data: { notification: notice } });
}
export async function readAllNotifications(_request: Request, response: Response) {
  const at = new Date(); await Notification.updateMany({ ...owner(response), readAt: null, createdAt: { $lte: at } }, { $set: { readAt: at } });
  response.json({ success: true, message: "All notifications marked read", data: {} });
}
export async function getNotification(request: Request, response: Response) {
  const notice = await Notification.findOne({ _id: request.params.id, ...owner(response) }).lean();
  if (!notice) throw new HttpError(404, "Notification not found");
  response.json({ success: true, message: "Notification fetched", data: { notification: notice } });
}
export const registrationPayloadSchema = z.object({ fid: z.string().regex(/^[a-zA-Z0-9_-]{22}$/, "Invalid Firebase Installation ID"), deviceKey: z.string().regex(/^[a-f0-9]{64}$/) });
export async function registerPush(request: Request, response: Response) {
  const { fid, deviceKey } = parse(registrationPayloadSchema, request.body), { recipientId: userId, audience } = owner(response);
  const identifierHash = registrationHash(fid), deviceKeyHash = registrationHash(deviceKey);
  const existing = await PushRegistration.findOne({ audience, identifierHash }).select("+deviceKeyHash");
  if (existing && existing.userId !== userId && existing.deviceKeyHash !== deviceKeyHash) throw new HttpError(409, "This browser registration is already bound to another account");
  if (!existing && await PushRegistration.countDocuments({ userId, audience, active: true }) >= 50) throw new HttpError(429, "Too many registered devices");
  const bindingId = existing?.active && existing.userId === userId && existing.deviceKeyHash === deviceKeyHash ? existing.bindingId : randomUUID();
  try {
    const filter = existing ? { _id: existing._id, userId: existing.userId, bindingId: existing.bindingId } : { audience, identifierHash };
    const device = await PushRegistration.findOneAndUpdate(filter, { $set: { userId, audience, identifierHash, encryptedIdentifier: encryptRegistration(fid), deviceKeyHash, bindingId, active: true, lastSeenAt: new Date() } }, { upsert: !existing, new: true, runValidators: true });
    if (!device) throw new HttpError(409, "Browser registration changed. Please retry.");
    await PushRegistration.updateMany({ audience, deviceKeyHash, _id: { $ne: device._id } }, { $set: { active: false } });
    response.json({ success: true, message: "Browser notifications enabled", data: { bindingId } });
  } catch (error) { if ((error as { code?: number }).code === 11000) throw new HttpError(409, "Browser registration changed. Please retry."); throw error; }
}
export async function unregisterPush(request: Request, response: Response) {
  const { deviceKey } = parse(z.object({ deviceKey: z.string().regex(/^[a-f0-9]{64}$/) }), request.body), { recipientId: userId, audience } = owner(response);
  await PushRegistration.updateMany({ userId, audience, deviceKeyHash: registrationHash(deviceKey) }, { $set: { active: false } });
  response.json({ success: true, message: "Browser notifications disabled", data: {} });
}
export async function publishTourUpdate(request: Request, response: Response) {
  const auth = owner(response); if (auth.audience !== "admin") throw new HttpError(403, "Admin access required");
  const payload = parse(z.object({ tourId: z.string().trim().min(1).max(40), departureId: z.string().trim().max(40).optional(), title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(1500), requestId: z.string().uuid() }), request.body);
  if (!await Tour.exists({ tourId: payload.tourId })) throw new HttpError(404, "Tour not found");
  if (payload.departureId && !await TourDeparture.exists({ tourId: payload.tourId, departureId: payload.departureId })) throw new HttpError(404, "Departure not found for this tour");
  const key = "manual-tour-update:" + auth.recipientId + ":" + payload.requestId;
  const previous = await NotificationEvent.findById(notificationKey(key));
  if (previous && JSON.stringify(previous.payload) !== JSON.stringify(payload)) throw new HttpError(409, "This update request was already used for different content");
  await stageNotificationEvent(key, "tour_update", payload);
  response.status(202).json({ success: true, message: "Tour update queued for registered customers with confirmed bookings", data: {} });
}
export async function retryFailedNotifications(_request: Request, response: Response) {
  if (owner(response).audience !== "admin") throw new HttpError(403, "Admin access required");
  for (const model of [NotificationEvent, PushDelivery]) await (model as any).updateMany({ status: "failed" }, { $set: { status: "pending", attempts: 0, nextAttemptAt: new Date() }, $unset: { leaseUntil: "", leaseToken: "" } });
  response.json({ success: true, message: "Failed notification jobs queued for retry", data: {} });
}
