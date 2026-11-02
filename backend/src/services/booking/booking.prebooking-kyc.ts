import jwt from "jsonwebtoken";
import type { IBookingKycDocument } from "../../models/booking.model";
import { HttpError } from "../../utils/httpError";

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing from the environment");
  return process.env.JWT_SECRET;
}

export function signPrebookingKycUpload(document: IBookingKycDocument, travellerId: string, leadPhone: string) {
  return jwt.sign({ purpose: "prebooking_kyc", document, travellerId, leadPhone }, secret(), { expiresIn: "24h", algorithm: "HS256" });
}

export function resolvePrebookingKycUploads(tokens: string[], travellerId: string, leadPhone: string): IBookingKycDocument[] {
  return tokens.map((token) => {
    try {
      const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] });
      if (typeof payload === "string" || payload.purpose !== "prebooking_kyc" ||
          payload.travellerId !== travellerId || payload.leadPhone !== leadPhone ||
          !payload.document || !["visa", "oci"].includes(payload.document.documentType)) {
        throw new Error("Invalid document upload");
      }
      return { ...payload.document, uploadedAt: new Date(payload.document.uploadedAt) };
    } catch {
      throw new HttpError(400, "Visa or OCI upload is invalid or expired. Please upload the document again.");
    }
  });
}
