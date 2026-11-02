import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { hash } from "bcryptjs";

import { User, UserRole, UserStatus, type UserDocument } from "../models/user.model";
import { isAdminRole } from "../middleware/adminAuth";
import { HttpError } from "../utils/httpError";
import { verifyAuthToken } from "../utils/jwt";
import { adminTabs } from "../services/admin-access";

const adminCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).default(""),
  profession: z.string().trim().max(120).default(""),
  email: z.string().trim().toLowerCase().email().max(254),
  mobileNumber: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10 digit phone number").optional().or(z.literal("")),
  role: z.enum(["admin", "staff"]),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 bytes"),
  adminTabs: z.array(z.enum(adminTabs)).min(1).max(adminTabs.length),
}).strict();

type AdminCreateProfile = Omit<z.infer<typeof adminCreateSchema>, "password">;

function getDuplicateUserField(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const keyPattern = "keyPattern" in error && typeof error.keyPattern === "object" && error.keyPattern !== null
    ? error.keyPattern as Record<string, unknown>
    : {};
  const keyValue = "keyValue" in error && typeof error.keyValue === "object" && error.keyValue !== null
    ? error.keyValue as Record<string, unknown>
    : {};
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return Object.keys(keyPattern)[0] || Object.keys(keyValue)[0] || message.match(/index:\s*([\w.]+)_1\b/i)?.[1];
}

function duplicateUserError(error: unknown): HttpError {
  const field = getDuplicateUserField(error);
  if (field === "mobileNumber") return new HttpError(409, "The mobile number is already linked to another account.");
  if (field === "email") return new HttpError(409, "Email is already registered");
  if (field === "firebaseUid") return new HttpError(409, "This linked sign-in identity is already attached to another account.");
  return new HttpError(409, field ? `The account detail \"${field}\" is already in use.` : "A unique account detail is already in use.");
}

async function grantAdminAccessToExistingUser(
  existingUser: UserDocument,
  profile: AdminCreateProfile,
  password: string,
  response: Response
): Promise<void> {
  if (existingUser.status !== UserStatus.ACTIVE) {
    throw new HttpError(409, "This email belongs to a blocked account. Unblock it before granting admin access.");
  }
  if (existingUser.roles.includes(UserRole.SUPER_ADMIN)) {
    throw new HttpError(409, "This account is already a super admin.");
  }
  if (existingUser.roles.some(isAdminRole)) {
    throw new HttpError(409, "This account already has admin access. Manage its dashboard access from Users.");
  }

  existingUser.roles = [...new Set([...existingUser.roles, profile.role])];
  existingUser.adminTabs = [...new Set(profile.adminTabs)];
  if (profile.profession) existingUser.profession = profile.profession;
  if (profile.mobileNumber) existingUser.mobileNumber = profile.mobileNumber;
  const keepsExistingPassword = Boolean(existingUser.passwordHash);
  if (!keepsExistingPassword) existingUser.passwordHash = await hash(password, 12);
  try {
    await existingUser.save();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw duplicateUserError(error);
    }
    throw error;
  }
  response.status(200).json({
    success: true,
    message: keepsExistingPassword
      ? "Existing account granted admin access. The user should sign in with their current password."
      : "Existing account granted admin access. The user should sign in with the password entered here.",
    data: { user: formatUser(existingUser) },
  });
}

export async function createAdminUser(request: Request, response: Response): Promise<void> {
  const [scheme, token] = request.headers.authorization?.split(" ") || [];
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Please sign in to continue");
  const actor = await User.findById(verifyAuthToken(token).userId);
  if (!actor || actor.status !== UserStatus.ACTIVE || !actor.roles.includes(UserRole.SUPER_ADMIN)) {
    throw new HttpError(403, "Only a super admin can create administrator accounts");
  }
  const result = adminCreateSchema.safeParse(request.body);
  if (!result.success) throw new HttpError(400, "Validation failed", result.error.issues.map((issue) => ({
    path: issue.path.join("."), message: issue.message,
  })));
  const { password, ...profile } = result.data;
  const emailPattern = new RegExp(`^${profile.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const existingUser = await User.findOne({ email: emailPattern }).select("+passwordHash");
  if (existingUser) {
    await grantAdminAccessToExistingUser(existingUser, profile, password, response);
    return;
  }
  try {
    const user = await User.create({
      ...profile,
      // Do not persist empty unique identity fields on admin-only accounts.
      mobileNumber: undefined,
      firebaseUid: undefined,
      adminTabs: [...new Set(profile.adminTabs)],
      passwordHash: await hash(password, 12),
      ...(profile.mobileNumber ? { mobileNumber: profile.mobileNumber } : {}),
      roles: [profile.role],
      status: UserStatus.ACTIVE,
      isMobileVerified: false,
    });
    response.status(201).json({ success: true, message: "Admin user created successfully", data: { user: formatUser(user) } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      const duplicateField = getDuplicateUserField(error);
      const duplicateEmail = duplicateField === "email";
      if (duplicateEmail) {
        const conflictingUser = await User.findOne({ email: emailPattern }).select("+passwordHash");
        if (conflictingUser) {
          await grantAdminAccessToExistingUser(conflictingUser, profile, password, response);
          return;
        }
        throw new HttpError(409, "This email is already attached to another account.");
      }
      throw duplicateUserError(error);
    }
    throw error;
  }
}

const userUpdateSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(254).or(z.literal("")).optional(),
  mobileNumber: z.string().trim().regex(/^\d{10,15}$/, "Enter a valid 10 to 15 digit phone number").or(z.literal("")).optional(),
  profession: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "staff", "expert"]).optional(),
  adminTabs: z.array(z.enum(adminTabs)).min(1).max(adminTabs.length).optional(),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 bytes").optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.BLOCKED]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes provided");

export async function updateAdminUser(request: Request, response: Response): Promise<void> {
  if (!isValidObjectId(request.params.id)) {
    throw new HttpError(400, "Invalid user ID");
  }
  const result = userUpdateSchema.safeParse(request.body);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.issues.map((issue) => ({
      path: issue.path.join("."), message: issue.message,
    })));
  }
  const [scheme, token] = request.headers.authorization?.split(" ") || [];
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Please sign in to continue");
  const actor = await User.findById(verifyAuthToken(token).userId);
  if (!actor || actor.status !== UserStatus.ACTIVE || !actor.roles.some(isAdminRole)) {
    throw new HttpError(403, "Admin access is required");
  }
  const user = await User.findById(String(request.params.id));
  if (!user) throw new HttpError(404, "User not found");
  if (user.roles.includes(UserRole.SUPER_ADMIN) ||
      (user.roles.some(isAdminRole) && !actor.roles.includes(UserRole.SUPER_ADMIN))) {
    throw new HttpError(403, "Only a super admin can manage other administrator accounts");
  }
  const changes = result.data;
  if (changes.mobileNumber && user.roles.some(isAdminRole) && !/^\d{10}$/.test(changes.mobileNumber)) {
    throw new HttpError(400, "Admin and staff phone numbers must contain exactly 10 digits");
  }
  if (changes.status === UserStatus.BLOCKED && user._id.toString() === actor._id.toString()) {
    throw new HttpError(400, "You cannot deactivate your own account");
  }
  if (changes.role && !actor.roles.includes(UserRole.SUPER_ADMIN)) {
    throw new HttpError(403, "Only a super admin can change administrator roles");
  }
  if (changes.firstName !== undefined) user.firstName = changes.firstName;
  if (changes.lastName !== undefined) user.lastName = changes.lastName;
  if (changes.email !== undefined) user.email = changes.email || undefined;
  if (changes.mobileNumber !== undefined) user.mobileNumber = changes.mobileNumber || undefined;
  if (changes.profession !== undefined) user.profession = changes.profession;
  if (changes.role) {
    const nonAdminRoles = user.roles.filter((role) => !isAdminRole(role));
    user.roles = [...new Set([...nonAdminRoles, changes.role])];
  }
  if (changes.adminTabs !== undefined) user.adminTabs = [...new Set(changes.adminTabs)];
  if (changes.password) user.passwordHash = await hash(changes.password, 12);
  if (changes.status !== undefined) user.status = changes.status;
  try {
    await user.save();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw duplicateUserError(error);
    }
    throw error;
  }
  response.json({ success: true, message: "User updated successfully", data: { user: formatUser(user) } });
}

function getAge(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const month = today.getMonth() - birthDate.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function formatUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || "",
    mobileNumber: user.mobileNumber || "",
    roles: user.roles,
    profession: user.profession || "",
    adminTabs: user.adminTabs,
    status: user.status,
    isMobileVerified: user.isMobileVerified,
    lastLoginAt: user.lastLoginAt,
    dateOfBirth: user.dateOfBirth || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listAdminUsers(
  _request: Request,
  response: Response
): Promise<void> {
  const users = await User.find({
    roles: { $ne: UserRole.SUPER_ADMIN },
  }).sort({ createdAt: -1 }).limit(1000);

  const travellers = users.filter((user) => user.roles.includes(UserRole.TRAVELLER));
  const admins = users.filter((user) => user.roles.some((role) => role !== UserRole.TRAVELLER));
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  response.json({
    success: true,
    message: "Users fetched successfully",
    data: {
      users: users.map(formatUser),
      stats: {
        travellers: {
          total: travellers.length,
          adults: travellers.filter((user) => {
            const age = getAge(user.dateOfBirth);
            return age === null || age >= 18;
          }).length,
          children: travellers.filter((user) => {
            const age = getAge(user.dateOfBirth);
            return age !== null && age < 18;
          }).length,
          newThisMonth: travellers.filter((user) => user.createdAt >= currentMonth).length,
        },
        admins: {
          expert: admins.filter((user) => user.roles.includes("expert")).length,
          staff: admins.filter((user) => user.roles.includes("staff")).length,
          admin: admins.filter((user) =>
            user.roles.some((role) => role === "admin" || role.endsWith("_admin"))
          ).length,
        },
      },
    },
  });
}
