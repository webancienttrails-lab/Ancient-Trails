import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { User, UserRole, UserStatus, type UserDocument } from "../models/user.model";
import { isAdminRole } from "../middleware/adminAuth";
import { HttpError } from "../utils/httpError";
import { verifyAuthToken } from "../utils/jwt";

const userUpdateSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(254).or(z.literal("")).optional(),
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
  if (changes.status === UserStatus.BLOCKED && user._id.toString() === actor._id.toString()) {
    throw new HttpError(400, "You cannot deactivate your own account");
  }
  if (changes.firstName !== undefined) user.firstName = changes.firstName;
  if (changes.lastName !== undefined) user.lastName = changes.lastName;
  if (changes.email !== undefined) user.email = changes.email || undefined;
  if (changes.status !== undefined) user.status = changes.status;
  try {
    await user.save();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new HttpError(409, "Email is already registered");
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
