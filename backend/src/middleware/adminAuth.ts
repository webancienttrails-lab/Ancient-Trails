import type { NextFunction, Request, Response } from "express";

import { User, UserRole, UserStatus } from "../models/user.model";
import { HttpError } from "../utils/httpError";
import { verifyAuthToken } from "../utils/jwt";

function getBearerToken(request: Request): string {
  const authorizationHeader = request.headers.authorization;
  const [scheme, token] = authorizationHeader?.split(" ") || [];

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Please sign in to continue");
  }

  return token;
}

function isAdminRole(role: string): boolean {
  return role === "admin" || role === UserRole.SUPER_ADMIN || role.endsWith("_admin");
}

export async function requireAdmin(
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = getBearerToken(request);
    const payload = verifyAuthToken(token);

    if (!payload.roles.some(isAdminRole)) {
      throw new HttpError(403, "Admin access is required");
    }

    const user = await User.findById(payload.userId);

    if (!user || user.status !== UserStatus.ACTIVE || !user.roles.some(isAdminRole)) {
      throw new HttpError(403, "Admin access is required");
    }

    next();
  } catch (error) {
    next(error);
  }
}
