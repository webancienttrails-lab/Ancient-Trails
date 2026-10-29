import { model, models, Schema, type Model } from "mongoose";

interface IOtpChallenge {
  _id: string;
  generation: string;
  expiresAt: Date;
  attempts: number;
  consumed: boolean;
  lockedUntil: Date;
  sendAfter: Date;
  verificationId: string;
  verifyingUntil: Date;
  cleanupAt: Date;
}

const schema = new Schema<IOtpChallenge>({
  _id: { type: String, required: true },
  generation: { type: String, default: "" },
  expiresAt: { type: Date, default: () => new Date(0) },
  attempts: { type: Number, default: 0 },
  consumed: { type: Boolean, default: true },
  lockedUntil: { type: Date, default: () => new Date(0) },
  sendAfter: { type: Date, default: () => new Date(0) },
  verificationId: { type: String, default: "" },
  verifyingUntil: { type: Date, default: () => new Date(0) },
  cleanupAt: { type: Date, required: true },
});
schema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });
export const OtpChallenge = (models.OtpChallenge as Model<IOtpChallenge> | undefined)
  || model<IOtpChallenge>("OtpChallenge", schema);

interface IOtpSendLimit { _id: string; count: number; cleanupAt: Date }
const limitSchema = new Schema<IOtpSendLimit>({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
  cleanupAt: { type: Date, required: true },
});
limitSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });
export const OtpSendLimit = (models.OtpSendLimit as Model<IOtpSendLimit> | undefined)
  || model<IOtpSendLimit>("OtpSendLimit", limitSchema);
