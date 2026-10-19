import { apiRequest } from "@/lib/api";
export type FaqItem = { id: string; question: string; answer: string; };
export type FaqCategory = { id: string; title: string; items: FaqItem[]; };
export type FaqContent = { id: string; categories: FaqCategory[]; createdAt: string | null; updatedAt: string | null; };

export function getPublicFaq() { return apiRequest<{ faq: FaqContent }>("/api/faq", { cache: "no-store" }); }
