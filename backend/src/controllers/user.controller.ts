import type { Request, Response } from "express";

import { User, UserRole, UserStatus, type UserDocument } from "../models/user.model";

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
    email: user.email,
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
