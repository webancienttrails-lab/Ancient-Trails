import type { Request, Response, NextFunction } from "express";
import { AuthSession, RevokedAccessToken } from "../models/authSession.model";
import { accessCookieName, authTokenHash } from "../services/auth-session.service";
import { verifyAuthToken } from "../utils/jwt";
import { HttpError } from "../utils/httpError";

// All bearer-authenticated HTTP routes pass this gate before any route handler.
export async function requireActiveAuthSession(request: Request, _response: Response, next: NextFunction) {
  if (request.path === "/auth/refresh") { next(); return; }
  try {
    const expectedSession = request.get("X-Session-Id");
    if (!request.headers.authorization && expectedSession) {
      // Custom headers require an approved CORS preflight, including on GET.
      if (request.get("X-Requested-With") !== "XMLHttpRequest") throw new HttpError(403, "Invalid session request");
      const audience = request.get("X-Session-Audience");
      if (audience !== "traveller" && audience !== "admin") throw new HttpError(400, "Invalid session audience");
      const cookie = request.cookies?.[accessCookieName(audience)];
      if (typeof cookie === "string") request.headers.authorization = "Bearer " + cookie;
    }
    if (!request.headers.authorization || request.path === "/auth/logout") { next(); return; }
    const [scheme, token] = request.headers.authorization.split(" ");
    if (scheme !== "Bearer" || !token) throw new HttpError(401, "Invalid auth session");
    const claims = verifyAuthToken(token);
    if (expectedSession && claims.sid !== expectedSession) throw new HttpError(401, "Your session changed. Please sign in again.");
    if (!claims.exp) throw new HttpError(401, "Invalid auth session");
    if (claims.sid) {
      const active = await AuthSession.exists({ _id: claims.sid, userId: claims.userId, revokedAt: null, expiresAt: { $gt: new Date() } });
      if (!active) throw new HttpError(401, "Auth session expired. Please sign in again.");
    } else if (await RevokedAccessToken.exists({ _id: authTokenHash(token) })) {
      throw new HttpError(401, "Auth session expired. Please sign in again.");
    }
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(503, "Unable to check your session. Please try again."));
  }
}
