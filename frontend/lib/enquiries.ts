import { apiRequest } from "@/lib/api";

export async function createCallbackEnquiry(payload: { name: string; phone: string }) {
  return apiRequest<{ enquiry: { id: string } }>("/api/enquiries/callback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ContactEnquiryPayload = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export async function createContactEnquiry(payload: ContactEnquiryPayload) {
  return apiRequest<{ enquiry: { id: string } }>("/api/enquiries/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type TourEnquiryPayload = {
  city: string;
  email: string;
  guests: string;
  message: string;
  name: string;
  phone: string;
  tourId: string;
  tourName: string;
  travelDate: string;
};

export async function createTourEnquiry(payload: TourEnquiryPayload) {
  return apiRequest<{ enquiry: { id: string } }>("/api/enquiries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
