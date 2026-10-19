import type { Request, Response } from "express";
import { z } from "zod";
import { defaultFaqCategories } from "../data/faq-defaults";
import { FaqPage, type FaqPageDocument } from "../models/faqPage.model";
import { HttpError } from "../utils/httpError";

const identifier = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/, "Invalid FAQ identifier");
const itemSchema = z.object({
  id: identifier,
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(8000),
});
export const faqPagePayloadSchema = z.object({
  categories: z.array(z.object({
    id: identifier,
    title: z.string().trim().min(1, "Subject is required").max(120),
    items: z.array(itemSchema).max(100),
  })).max(30),
}).superRefine((payload, ctx) => {
  const subjects = new Set<string>(), questions = new Set<string>();
  let count = 0;
  payload.categories.forEach((category, index) => {
    if (subjects.has(category.id)) ctx.addIssue({ code: "custom", path: ["categories", index, "id"], message: "Subject identifiers must be unique" });
    subjects.add(category.id);
    category.items.forEach((item, itemIndex) => {
      count++;
      if (questions.has(item.id)) ctx.addIssue({ code: "custom", path: ["categories", index, "items", itemIndex, "id"], message: "Question identifiers must be unique" });
      questions.add(item.id);
    });
  });
  if (count > 500) ctx.addIssue({ code: "custom", path: ["categories"], message: "A maximum of 500 FAQs is supported" });
});

function formatFaqPage(page: FaqPageDocument | null) {
  return {
    id: page?._id.toString() || "faq",
    categories: page?.categories ?? defaultFaqCategories,
    createdAt: page?.createdAt || null,
    updatedAt: page?.updatedAt || null,
  };
}
export async function getFaqPage(_request: Request, response: Response): Promise<void> {
  const page = await FaqPage.findOne({ pageKey: "faq" });
  response.status(200).json({ success: true, message: "FAQ page fetched successfully", data: { faq: formatFaqPage(page) } });
}
export async function updateFaqPage(request: Request, response: Response): Promise<void> {
  const parsed = faqPagePayloadSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Validation failed", parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })));
  const page = await FaqPage.findOneAndUpdate({ pageKey: "faq" }, {
    $set: { categories: parsed.data.categories }, $setOnInsert: { pageKey: "faq" },
  }, { new: true, runValidators: true, upsert: true });
  if (!page) throw new HttpError(500, "FAQ page could not be saved");
  response.status(200).json({ success: true, message: "FAQ page saved successfully", data: { faq: formatFaqPage(page) } });
}
