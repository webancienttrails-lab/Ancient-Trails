import type { Request, Response } from "express";
import { z } from "zod";
import { User, UserRole, UserStatus } from "../models/user.model";
import { sendOtp, verifyOtp } from "../services/msg91.service";
import { HttpError } from "../utils/httpError";
import { normalizeMobileNumber } from "../utils/mobileNumber";
import { signAdminBookingLeadToken, verifyAdminBookingLeadToken, verifyAuthToken } from "../utils/jwt";

const phoneSchema = z.object({ countryCode: z.string().regex(/^\+?\d{1,4}$/), mobileNumber: z.string().trim().min(1).max(25) });
function adminId(request: Request) {
  return verifyAuthToken((request.headers.authorization || "").replace(/^Bearer\s+/i, "")).userId;
}
export function leadMobileNumber(lead: { countryCode: string; mobileNumber: string }) {
  const code = lead.countryCode.replace(/\D/g, "");
  const digits = lead.mobileNumber.replace(/\D/g, "");
  return normalizeMobileNumber(digits.length > 10 && digits.startsWith(code) ? digits : code + digits);
}
async function findTraveller(mobileNumber: string) {
  const user = await User.findOne({ mobileNumber, roles: UserRole.TRAVELLER });
  if (user?.status === UserStatus.BLOCKED) throw new HttpError(403, "This traveller account is blocked");
  return user;
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message || "Invalid verification details");
  return result.data;
}
export async function requestAdminBookingLeadOtp(request: Request, response: Response) {
  const lead = parse(phoneSchema, request.body);
  const mobileNumber = leadMobileNumber(lead);
  await findTraveller(mobileNumber);
  await sendOtp(mobileNumber);
  response.json({ success: true, message: "OTP sent to the lead traveller", data: { mobileNumber } });
}
export async function verifyAdminBookingLeadOtp(request: Request, response: Response) {
  const lead = parse(phoneSchema.extend({ otp: z.string().trim().regex(/^\d{4,9}$/, "Enter a valid OTP") }), request.body);
  const mobileNumber = leadMobileNumber(lead);
  await verifyOtp(mobileNumber, lead.otp);
  const user = await findTraveller(mobileNumber);
  response.json({ success: true, message: "Lead traveller mobile verified", data: {
    verificationToken: signAdminBookingLeadToken(adminId(request), mobileNumber),
    traveller: user ? { firstName: user.firstName, lastName: user.lastName, email: user.email || "", gender: user.gender || "", dateOfBirth: user.dateOfBirth || "" } : null,
  } });
}
export function assertAdminLeadVerification(request: Request, lead: { countryCode: string; mobileNumber: string } | undefined, token?: string) {
  if (!lead || !token) throw new HttpError(400, "Verify the lead traveller's mobile number with OTP before creating the booking");
  verifyAdminBookingLeadToken(token, adminId(request), leadMobileNumber(lead));
}
