import type { Request, Response } from "express";
import { z } from "zod";

import {
  Enquiry,
  EnquirySource,
  EnquiryStatus,
  type EnquiryDocument,
} from "../models/enquiry.model";
import { HttpError } from "../utils/httpError";

const enquirySchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(1).max(24),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().max(3000).default(""),
  source: z.nativeEnum(EnquirySource),
  status: z.nativeEnum(EnquiryStatus),
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

function formatEnquiry(enquiry: EnquiryDocument) {
  return {
    id: enquiry._id.toString(),
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    subject: enquiry.subject,
    message: enquiry.message,
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
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const filters: Record<string, unknown> = {};

  if (search) {
    filters.$or = [
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
  const enquiry = await Enquiry.create(parsePayload(request.body));

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
