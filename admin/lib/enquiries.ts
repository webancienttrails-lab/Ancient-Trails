import { apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type EnquirySource = "Contact Form" | "Email" | "Phone Call" | "Website";
export type EnquiryStatus = "Closed" | "In Progress" | "New" | "Replied";

export type AdminEnquiry = {
  id: string;
  enquiryReference: string;
  name: string;
  gender?: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  tourId?: string;
  tourName?: string;
  replies?: Array<{ message: string; sentAt: string }>;
  isBlacklisted?: boolean;
  blacklistedAt?: string | null;
  socialMediaReferral?: string;
  source: EnquirySource;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryPayload = Omit<AdminEnquiry, "id" | "enquiryReference" | "createdAt" | "updatedAt">;

function headers(): HeadersInit {
  const session = getAdminSession();
  return session?.sessionId ? { "X-Session-Id": session.sessionId } : {};
}

export async function listAdminEnquiries() {
  return apiRequest<{ enquiries: AdminEnquiry[] }>("/api/admin/enquiries", {
    headers: headers(),
  });
}

export async function createAdminEnquiry(payload: EnquiryPayload) {
  return apiRequest<{ enquiry: AdminEnquiry }>("/api/admin/enquiries", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminEnquiry(id: string, payload: EnquiryPayload) {
  return apiRequest<{ enquiry: AdminEnquiry }>(`/api/admin/enquiries/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminEnquiryStatus(id: string, status: EnquiryStatus) {
  return apiRequest<{ enquiry: AdminEnquiry }>(`/api/admin/enquiries/${id}/status`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ status }),
  });
}

export async function addAdminEnquiryReply(id: string, message: string) {
  return apiRequest<{ enquiry: AdminEnquiry }>(`/api/admin/enquiries/${id}/replies`, {
    method: "POST", headers: headers(), body: JSON.stringify({ message }),
  });
}

export async function setAdminEnquiryBlacklist(id: string, isBlacklisted: boolean) {
  return apiRequest<{ enquiry: AdminEnquiry }>(`/api/admin/enquiries/${id}/blacklist`, {
    method: "PATCH", headers: headers(), body: JSON.stringify({ isBlacklisted }),
  });
}
