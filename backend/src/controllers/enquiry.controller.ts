import type { Request, Response } from "express";
import { z } from "zod";

import {
  Enquiry,
  EnquirySource,
  EnquiryStatus,
  type EnquiryDocument,
} from "../models/enquiry.model";
import { sendTourEnquiryAlertEmail } from "../services/booking-confirmation-email.service";
import { allocateEnquiryReference, ensureEnquiryReferences } from "../services/enquiry-reference.service";
import { HttpError } from "../utils/httpError";

const enquirySchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(1).max(24),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().max(3000).default(""),
  socialMediaReferral: z.string().trim().max(160).optional(),
  source: z.nativeEnum(EnquirySource),
  status: z.nativeEnum(EnquiryStatus),
});

const publicTourEnquirySchema = z.object({
  city: z.string().trim().max(120).default(""),
  email: z.string().trim().email().max(254),
  guests: z.string().trim().max(80).default(""),
  message: z.string().trim().min(1).max(3000),
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(24),
  tourId: z.string().trim().max(80).default(""),
  tourName: z.string().trim().min(1).max(160),
  travelDate: z.string().trim().max(60).default(""),
});

function parsePayload(body: unknown) {
  const result = enquirySchema.safeParse(body);

  if (!result.success) {
    throw new HttpError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  return result.data;
}

function parsePublicTourEnquiryPayload(body: unknown) {
  const result = publicTourEnquirySchema.safeParse(body);

  if (!result.success) {
    throw new HttpError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  return result.data;
}

function formatEnquiry(enquiry: EnquiryDocument) {
  return {
    id: enquiry._id.toString(),
    enquiryReference: enquiry.enquiryReference,
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    subject: enquiry.subject,
    message: enquiry.message,
    socialMediaReferral: enquiry.socialMediaReferral || "",
    source: enquiry.source,
    status: enquiry.status,
    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
  };
}

export async function listEnquiries(
  request: Request,
  response: Response
): Promise<void> {
  await ensureEnquiryReferences();
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
      { enquiryReference: new RegExp(search, "i") },
      { name: new RegExp(search, "i") },
      { email: new RegExp(search, "i") },
      { phone: new RegExp(search, "i") },
      { subject: new RegExp(search, "i") },
      { message: new RegExp(search, "i") },
    ];
  }

  const enquiries = await Enquiry.find(filters).sort({ createdAt: -1 }).limit(500);

  response.json({
    success: true,
    message: "Enquiries fetched successfully",
    data: { enquiries: enquiries.map(formatEnquiry) },
  });
}

export async function createEnquiry(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parsePayload(request.body);
  await ensureEnquiryReferences();
  const enquiry = await Enquiry.create({ ...payload, enquiryReference: await allocateEnquiryReference() });

  response.status(201).json({
    success: true,
    message: "Enquiry created successfully",
    data: { enquiry: formatEnquiry(enquiry) },
  });
}

export async function createPublicContactEnquiry(
  request: Request,
  response: Response
): Promise<void> {
  const result = enquirySchema.pick({
    name: true, email: true, phone: true, subject: true, message: true,
  }).extend({
    message: z.string().trim().min(1).max(3000),
    phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number"),
  }).strict().safeParse(request.body);

  if (!result.success) {
    throw new HttpError(400, "Please check your contact details and message", result.error.issues.map((issue) => ({
      path: issue.path.join("."), message: issue.message,
    })));
  }

  await ensureEnquiryReferences();
  const enquiry = await Enquiry.create({
    ...result.data,
    enquiryReference: await allocateEnquiryReference(),
    source: EnquirySource.WEBSITE,
    status: EnquiryStatus.NEW,
  });
  response.status(201).json({
    success: true,
    message: "Your message has been sent successfully",
    data: { enquiry: formatEnquiry(enquiry) },
  });
}

export async function createPublicTourEnquiry(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parsePublicTourEnquiryPayload(request.body);
  const detailLines = [
    payload.message,
    "",
    `Tour: ${payload.tourName}`,
    payload.tourId ? `Tour ID: ${payload.tourId}` : "",
    payload.city ? `Current City: ${payload.city}` : "",
    payload.guests ? `Guests: ${payload.guests}` : "",
    payload.travelDate ? `Travel Date: ${payload.travelDate}` : "",
  ].filter(Boolean);
  await ensureEnquiryReferences();
  const enquiry = await Enquiry.create({
    enquiryReference: await allocateEnquiryReference(),
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    subject: `Tour enquiry - ${payload.tourName}`,
    message: detailLines.join("\n"),
    source: EnquirySource.WEBSITE,
    status: EnquiryStatus.NEW,
  });

  void sendTourEnquiryAlertEmail({
    city: payload.city,
    email: payload.email,
    guests: payload.guests,
    message: payload.message,
    name: payload.name,
    phone: payload.phone,
    submittedAt: enquiry.createdAt,
    tourId: payload.tourId,
    tourName: payload.tourName,
    travelDate: payload.travelDate,
  }).catch((error: unknown) => {
    console.error(
      `[enquiry-email] Failed to send tour enquiry alert for ${enquiry._id.toString()}:`,
      error
    );
  });

  response.status(201).json({
    success: true,
    message: "Enquiry created successfully",
    data: { enquiry: formatEnquiry(enquiry) },
  });
}

export async function updateEnquiry(
  request: Request,
  response: Response
): Promise<void> {
  await ensureEnquiryReferences();
  const enquiry = await Enquiry.findByIdAndUpdate(
    request.params.id,
    parsePayload(request.body),
    { new: true, runValidators: true }
  );

  if (!enquiry) {
    throw new HttpError(404, "Enquiry not found");
  }

  response.json({
    success: true,
    message: "Enquiry updated successfully",
    data: { enquiry: formatEnquiry(enquiry) },
  });
}

export async function updateEnquiryStatus(request: Request, response: Response): Promise<void> {
  const result = z.object({ status: z.nativeEnum(EnquiryStatus) }).strict().safeParse(request.body);
  if (!result.success) throw new HttpError(400, "Invalid enquiry status");
  await ensureEnquiryReferences();
  const enquiry = await Enquiry.findByIdAndUpdate(
    request.params.id, { $set: { status: result.data.status } }, { new: true, runValidators: true }
  );
  if (!enquiry) throw new HttpError(404, "Enquiry not found");
  response.json({
    success: true,
    message: "Enquiry status updated successfully",
    data: { enquiry: formatEnquiry(enquiry) },
  });
}
