import { model, models, Schema, type HydratedDocument, type Model } from "mongoose";

export interface IFaqItem { id: string; question: string; answer: string; }
export interface IFaqCategory { id: string; title: string; items: IFaqItem[]; }
export interface IFaqPage { pageKey: string; categories: IFaqCategory[]; createdAt: Date; updatedAt: Date; }
export type FaqPageDocument = HydratedDocument<IFaqPage>;

const itemSchema = new Schema<IFaqItem>({
  id: { type: String, required: true, maxlength: 80 },
  question: { type: String, required: true, trim: true, maxlength: 500 },
  answer: { type: String, required: true, trim: true, maxlength: 8000 },
}, { _id: false });
const categorySchema = new Schema<IFaqCategory>({
  id: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  items: { type: [itemSchema], default: [] },
}, { _id: false });
const faqPageSchema = new Schema<IFaqPage>({
  pageKey: { type: String, required: true, immutable: true, unique: true },
  categories: { type: [categorySchema], default: [] },
}, { timestamps: true });
export const FaqPage = (models.FaqPage as Model<IFaqPage> | undefined) || model<IFaqPage>("FaqPage", faqPageSchema);
