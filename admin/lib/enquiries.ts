import { apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type EnquirySource = "Contact Form" | "Email" | "Phone Call" | "Website";
export type EnquiryStatus = "Closed" | "In Progress" | "New" | "Replied";

export type AdminEnquiry = {
  id: string;
  enquiryReference: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  socialMediaReferral?: string;
  source: EnquirySource;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryPayload = Omit<AdminEnquiry, "id" | "enquiryReference" | "createdAt" | "updatedAt">;

function headers(): HeadersInit {
  const session = getAdminSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
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
