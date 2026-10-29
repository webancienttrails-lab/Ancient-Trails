import { model, models, Schema, type Model } from "mongoose";

export interface IAuthSession {
  _id: string; userId: string; audience: "traveller" | "admin";
  refreshHash: string; expiresAt: Date; revokedAt: Date | null;
}
const schema = new Schema<IAuthSession>({
  _id: { type: String, required: true }, userId: { type: String, required: true },
  audience: { type: String, enum: ["traveller", "admin"], required: true },
  refreshHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true }, revokedAt: { type: Date, default: null },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AuthSession = (models.AuthSession as Model<IAuthSession> | undefined) || model<IAuthSession>("AuthSession", schema);

interface IRevokedAccessToken { _id: string; expiresAt: Date }
const revokedSchema = new Schema<IRevokedAccessToken>({ _id: { type: String, required: true }, expiresAt: { type: Date, required: true } });
revokedSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RevokedAccessToken = (models.RevokedAccessToken as Model<IRevokedAccessToken> | undefined)
  || model<IRevokedAccessToken>("RevokedAccessToken", revokedSchema);
