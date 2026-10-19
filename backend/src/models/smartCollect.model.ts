import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ISmartCollectAccount {
  bookingId: Types.ObjectId;
  bookingReference: string;
  scope: string;
  environment: "test" | "live";
  activeKey?: string;
  virtualAccountId?: string;
  status: "creating" | "active" | "closed" | "failed" | "creation_unknown";
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  amountRequested: number;
  amountReceived: number;
  amountApplied: number;
  amountReview: number;
  expiresAt: Date;
  closedAt?: Date | null;
  error: string;
  emailInstructionStatus: string;
  whatsappInstructionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}
const accountSchema = new Schema<ISmartCollectAccount>({
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
  bookingReference: { type: String, required: true },
  scope: { type: String, required: true },
  environment: { type: String, enum: ["test", "live"], required: true },
  activeKey: { type: String },
  virtualAccountId: { type: String },
  status: { type: String, enum: ["creating", "active", "closed", "failed", "creation_unknown"], required: true },
  beneficiaryName: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  ifsc: { type: String, default: "" },
  bankName: { type: String, default: "" },
  amountRequested: { type: Number, required: true, min: 1 },
  amountReceived: { type: Number, default: 0, min: 0 },
  amountApplied: { type: Number, default: 0, min: 0 },
  amountReview: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, required: true },
  closedAt: { type: Date, default: null },
  error: { type: String, default: "" },
  emailInstructionStatus: { type: String, default: "pending" },
  whatsappInstructionStatus: { type: String, default: "pending" },
}, { timestamps: true });
accountSchema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } });
accountSchema.index({ scope: 1, virtualAccountId: 1 }, { unique: true, partialFilterExpression: { virtualAccountId: { $type: "string" } } });
accountSchema.index({ bookingId: 1, scope: 1, createdAt: -1 });

export interface ISmartCollectTransfer {
  _id: string;
  bookingId: Types.ObjectId;
  accountId: Types.ObjectId;
  scope: string;
  paymentId: string;
  amount: number;
  amountApplied: number;
  amountReview: number;
  status: "applied" | "review" | "failed" | "pending";
  mode: string;
  utr: string;
  reason: string;
  receivedAt: Date;
  processedAt?: Date | null;
  receiptEmailStatus: string;
  createdAt: Date;
  updatedAt: Date;
}
const transferSchema = new Schema<ISmartCollectTransfer>({
  _id: { type: String, required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
  accountId: { type: Schema.Types.ObjectId, ref: "SmartCollectAccount", required: true },
  scope: { type: String, required: true },
  paymentId: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  amountApplied: { type: Number, default: 0, min: 0 },
  amountReview: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["applied", "review", "failed", "pending"], required: true },
  mode: { type: String, default: "" },
  utr: { type: String, default: "" },
  reason: { type: String, default: "" },
  receivedAt: { type: Date, required: true },
  processedAt: { type: Date, default: null },
  receiptEmailStatus: { type: String, default: "pending" },
}, { timestamps: true });
transferSchema.index({ bookingId: 1, scope: 1, receivedAt: -1 });
export const SmartCollectAccount = (models.SmartCollectAccount as Model<ISmartCollectAccount> | undefined) ||
  model<ISmartCollectAccount>("SmartCollectAccount", accountSchema);
export const SmartCollectTransfer = (models.SmartCollectTransfer as Model<ISmartCollectTransfer> | undefined) ||
  model<ISmartCollectTransfer>("SmartCollectTransfer", transferSchema);
