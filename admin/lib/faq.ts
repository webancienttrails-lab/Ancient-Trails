import { ApiError, apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";
export type FaqItem = { id: string; question: string; answer: string; };
export type FaqCategory = { id: string; title: string; items: FaqItem[]; };
export type FaqContent = { id: string; categories: FaqCategory[]; createdAt: string | null; updatedAt: string | null; };

function headers(): HeadersInit {
  const session = getAdminSession();
  if (!session?.sessionId) throw new ApiError(401, "Please sign in to continue");
  return { "X-Session-Id": session.sessionId };
}
export function getAdminFaq() { return apiRequest<{ faq: FaqContent }>("/api/admin/faq", { headers: headers(), cache: "no-store" }); }
export function updateAdminFaq(categories: FaqCategory[]) {
  return apiRequest<{ faq: FaqContent }>("/api/admin/faq", { method: "PUT", headers: headers(), body: JSON.stringify({ categories }) });
}
