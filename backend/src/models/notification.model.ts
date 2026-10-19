import { Schema, model, models, type Model } from "mongoose";
export type NotificationAudience = "admin" | "customer";
export interface INotification { _id: string; recipientId: string; audience: NotificationAudience; eventId: string; kind: string; title: string; body: string; url: string; readAt: Date | null; createdAt: Date; }
const schema = new Schema<INotification>({
  _id: String, recipientId: { type: String, required: true }, audience: { type: String, enum: ["admin", "customer"], required: true },
  eventId: { type: String, required: true }, kind: String, title: String, body: String, url: String,
  readAt: { type: Date, default: null }, createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
schema.index({ recipientId: 1, audience: 1, createdAt: -1, _id: -1 });
schema.index({ recipientId: 1, audience: 1, readAt: 1 });
export const Notification = (models.Notification as Model<INotification> | undefined) || model<INotification>("Notification", schema);

export interface IPushRegistration { _id: string; userId: string; audience: NotificationAudience; identifierHash: string; encryptedIdentifier: string; deviceKeyHash: string; bindingId: string; active: boolean; lastSeenAt: Date; createdAt: Date; updatedAt: Date; }
const deviceSchema = new Schema<IPushRegistration>({
  userId: { type: String, required: true }, audience: { type: String, enum: ["admin", "customer"], required: true },
  identifierHash: { type: String, required: true, select: false }, encryptedIdentifier: { type: String, required: true, select: false },
  deviceKeyHash: { type: String, required: true, select: false }, bindingId: { type: String, required: true },
  active: { type: Boolean, default: true }, lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });
deviceSchema.index({ audience: 1, identifierHash: 1 }, { unique: true });
deviceSchema.index({ userId: 1, audience: 1, deviceKeyHash: 1 });
deviceSchema.index({ userId: 1, audience: 1, active: 1 });
export const PushRegistration = (models.PushRegistration as Model<IPushRegistration> | undefined) || model<IPushRegistration>("PushRegistration", deviceSchema);

export interface INotificationEvent { _id: string; kind: string; payload: Record<string, any>; status: string; attempts: number; nextAttemptAt: Date; leaseUntil: Date | null; leaseToken: string; error: string; createdAt: Date; completedAt?: Date; }
const eventSchema = new Schema<INotificationEvent>({
  _id: String, kind: String, payload: Schema.Types.Mixed, status: { type: String, default: "pending" },
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now }, leaseUntil: Date, leaseToken: String,
  error: String, completedAt: Date, createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
eventSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const NotificationEvent = (models.NotificationEvent as Model<INotificationEvent> | undefined) || model<INotificationEvent>("NotificationEvent", eventSchema);

export interface IPushDelivery { _id: string; notificationId: string; registrationId: string; bindingId: string; status: string; attempts: number; nextAttemptAt: Date; leaseUntil: Date | null; leaseToken: string; error: string; createdAt: Date; sentAt?: Date; }
const deliverySchema = new Schema<IPushDelivery>({
  _id: String, notificationId: String, registrationId: String, bindingId: String,
  status: { type: String, default: "pending" }, attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now }, leaseUntil: Date, leaseToken: String, error: String,
  sentAt: Date, createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
deliverySchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const PushDelivery = (models.PushDelivery as Model<IPushDelivery> | undefined) || model<IPushDelivery>("PushDelivery", deliverySchema);
const cursorSchema = new Schema({ _id: String, at: Date, lastId: String, fingerprint: String }, { versionKey: false });
export const NotificationCursor = models.NotificationCursor || model("NotificationCursor", cursorSchema);
