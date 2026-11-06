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

export type EnquiryCategory = "group" | "customise" | "normal";

export function createCustomiseEnquiryPayload(form: EnquiryPayload, guests: { adults: number; children: number; infants: number }): EnquiryPayload {
  const whichTour = form.subject.trim();
  return {
    ...form,
    tourId: "",
    tourName: whichTour,
    subject: `Customised tour enquiry - ${whichTour}`,
    message: [
      form.message.trim(),
      `Tour: ${whichTour}`,
      `Guests: ${guests.adults} Adult, ${guests.children} Child, ${guests.infants} Infant`,
    ].filter(Boolean).join("\n"),
    status: "New",
  };
}

export function getEnquiryTourName(enquiry: Pick<AdminEnquiry, "tourName" | "subject" | "message">): string {
  return enquiry.tourName?.trim()
    || enquiry.message.match(/^Tour:\s*([^\r\n]+)$/im)?.[1].trim()
    || enquiry.subject.match(/^Tour enquiry\s*-\s*(.+)$/i)?.[1].trim()
    || "-";
}

export function getCustomiseEnquiryTourName(enquiry: Pick<AdminEnquiry, "tourName" | "subject" | "message">): string {
  return enquiry.tourName?.trim()
    || enquiry.message.match(/^Tour:[ \t]*([^\r\n]+)$/im)?.[1].trim()
    || enquiry.subject.match(/^Customi[sz]ed? tour (?:enquiry|request)\s*-\s*(.+)$/i)?.[1].trim()
    || enquiry.message.match(/^Preferred destination:[ \t]*([^\r\n]+)$/im)?.[1].trim()
    || "-";
}

export function getEnquiryCategory(enquiry: Pick<AdminEnquiry, "subject" | "message" | "tourId" | "tourName">): EnquiryCategory {
  if (/^customi[sz]ed? tour (request|enquiry)\b/i.test(enquiry.subject.trim())) {
    return "customise";
  }

  // Public tour enquiries store tour details in the message, including older records.
  if (enquiry.tourId?.trim() || enquiry.tourName?.trim() ||
      /^(?:Tour enquiry\s*-|Specialised tour enquiry:)/i.test(enquiry.subject.trim()) ||
      /^Tour(?: ID)?:\s*\S+/im.test(enquiry.message)) {
    return "group";
  }

  return "normal";
}

export function getEnquiryDisplayDetails(enquiry: Pick<AdminEnquiry, "subject" | "message" | "tourId" | "tourName">) {
  const details = {
    tourName: getEnquiryTourName(enquiry),
    tourId: enquiry.tourId || "",
    city: "",
    guests: "",
    travelDate: "",
    message: enquiry.message,
  };
  if (getEnquiryCategory(enquiry) === "normal") return details;

  // Tour forms append a structured block after the customer's actual message.
  // Only separate that trailing block; preserve any labelled lines in the query.
  const lines = enquiry.message.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const start = lines.findLastIndex((line) => /^Tour:[ \t]*\S/i.test(line));
  if (start < 0) return details;
  const block = lines.slice(start);
  if (!block.every((line) => /^(?:Tour|Tour ID|Current City|Guests|Travel Date):[ \t]*.*$/i.test(line) || !line.trim())) {
    return details;
  }

  const values = new Map(block.flatMap((line) => {
    const match = line.match(/^(Tour|Tour ID|Current City|Guests|Travel Date):[ \t]*(.*)$/i);
    return match ? [[match[1].toLowerCase(), match[2].trim()] as const] : [];
  }));
  return {
    tourName: enquiry.tourName?.trim() || values.get("tour") || details.tourName,
    tourId: values.get("tour id") || details.tourId,
    city: values.get("current city") || "",
    guests: values.get("guests") || "",
    travelDate: values.get("travel date") || "",
    message: lines.slice(0, start).join("\n").trim(),
  };
}

function headers(): HeadersInit {
  const session = getAdminSession();
  return session?.sessionId ? { "X-Session-Id": session.sessionId } : {};
}

export async function listAdminEnquiries() {
  return apiRequest<{ enquiries: AdminEnquiry[] }>("/api/admin/enquiries", {
    headers: headers(),
  });
}

export async function getAdminEnquiry(id: string) {
  return apiRequest<{ enquiry: AdminEnquiry }>(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
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
