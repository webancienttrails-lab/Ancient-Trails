import { model, models, Schema, type Model } from "mongoose";

interface IEnquiryReferenceCounter {
  _id: string;
  value: number;
}

const schema = new Schema<IEnquiryReferenceCounter>({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
}, { versionKey: false });

export const EnquiryReferenceCounter =
  (models.EnquiryReferenceCounter as Model<IEnquiryReferenceCounter> | undefined) ||
  model<IEnquiryReferenceCounter>("EnquiryReferenceCounter", schema);
