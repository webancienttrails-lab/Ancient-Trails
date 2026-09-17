import { apiRequest } from "@/lib/api";

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
