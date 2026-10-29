import crypto from "node:crypto";
import type { Request, Response, CookieOptions } from "express";
import { AuthSession, RevokedAccessToken } from "../models/authSession.model";
import { User, type UserDocument } from "../models/user.model";
import { isAdminRole } from "../middleware/adminAuth";
import { signAuthToken, verifyAuthToken } from "../utils/jwt";
import { HttpError } from "../utils/httpError";

type Audience = "traveller" | "admin";
export const authTokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const refreshLifetime = 7 * 86400000;
const cookieName = (audience: Audience) => audience === "admin" ? "ancient_trails_admin_refresh" : "ancient_trails_refresh";
export const accessCookieName = (audience: Audience) => audience === "admin" ? "ancient_trails_admin_access" : "ancient_trails_access";
function cookieOptions(): CookieOptions {
  const secure = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure, sameSite: "lax", path: "/api/auth" };
}
function setAccessCookie(response: Response, token: string, scope: Audience) {
  response.cookie(accessCookieName(scope), token, { ...cookieOptions(), path: "/api", maxAge: 3600_000 });
}
function audience(request: Request, fallback: Audience = "traveller"): Audience {
  const value = request.body?.audience ?? fallback;
  if (value !== "traveller" && value !== "admin") throw new HttpError(400, "Invalid session audience");
  return value;
}
export async function issueAuthSession(user: UserDocument, _request: Request, response: Response, scope: Audience = "traveller") {
  const id = crypto.randomUUID(), refreshToken = crypto.randomBytes(48).toString("hex");
  await AuthSession.create({ _id: id, userId: user.id, audience: scope,
    refreshHash: authTokenHash(refreshToken), expiresAt: new Date(Date.now() + refreshLifetime), revokedAt: null });
  const token = signAuthToken(user, id);
  response.cookie(cookieName(scope), refreshToken, { ...cookieOptions(), maxAge: refreshLifetime });
  setAccessCookie(response, token, scope);
  response.setHeader("Cache-Control", "no-store");
  return token;
}
export async function refreshAuthSession(request: Request, response: Response) {
  // A custom header requires a CORS preflight and prevents cross-site form refresh requests.
  if (request.get("X-Requested-With") !== "XMLHttpRequest") throw new HttpError(403, "Invalid session refresh request");
  const scope = audience(request), refreshToken = request.cookies?.[cookieName(scope)];
  if (typeof refreshToken !== "string" || !/^[a-f0-9]{96}$/.test(refreshToken)) throw new HttpError(401, "Please sign in again");
  const session = await AuthSession.findOne({ refreshHash: authTokenHash(refreshToken), audience: scope,
    revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!session) throw new HttpError(401, "Auth session expired. Please sign in again.");
  const expectedSession = request.get("X-Session-Id");
  if (expectedSession && session.id !== expectedSession) throw new HttpError(401, "Your session changed. Please sign in again.");
  const user = await User.findById(session.userId);
  if (!user || user.status !== "active" || !(scope === "admin" ? user.roles.some(isAdminRole) : user.roles.includes("traveller"))) {
    throw new HttpError(401, "Please sign in again");
  }
  response.setHeader("Cache-Control", "no-store");
  setAccessCookie(response, signAuthToken(user, session.id), scope);
  return { sessionId: session.id, user };
}
export async function revokeAuthSession(request: Request, response: Response) {
  const [scheme, token] = request.headers.authorization?.split(" ") || [];
  if (scheme !== "Bearer" || !token) {
    if (request.get("X-Requested-With") !== "XMLHttpRequest") throw new HttpError(403, "Invalid logout request");
    const scope = audience(request), refreshToken = request.cookies?.[cookieName(scope)];
    if (typeof refreshToken !== "string") throw new HttpError(401, "Please sign in to continue");
    const session = await AuthSession.findOne({ refreshHash: authTokenHash(refreshToken), audience: scope,
      revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!session || session.id !== request.get("X-Session-Id")) throw new HttpError(401, "Auth session expired. Please sign in again.");
    await AuthSession.updateOne({ _id: session.id, userId: session.userId }, { $set: { revokedAt: new Date() } });
    response.clearCookie(cookieName(scope), cookieOptions());
    response.clearCookie(accessCookieName(scope), { ...cookieOptions(), path: "/api" });
    response.setHeader("Cache-Control", "no-store");
    return;
  }
  // An expired, correctly signed access token can still end its refresh session.
  const claims = verifyAuthToken(token, { ignoreExpiration: true });
  if (request.get("X-Session-Id") && claims.sid !== request.get("X-Session-Id")) throw new HttpError(401, "Your session changed. Please sign in again.");
  const scope = audience(request, claims.roles.includes("traveller") ? "traveller" : "admin");
  if (claims.sid) {
    await AuthSession.updateOne({ _id: claims.sid, userId: claims.userId }, { $set: { revokedAt: new Date() } });
  } else if (claims.exp && claims.exp * 1000 > Date.now()) {
    // Tokens issued before server sessions existed are revoked by fingerprint.
    await RevokedAccessToken.updateOne({ _id: authTokenHash(token) }, {
      $setOnInsert: { expiresAt: new Date(claims.exp * 1000) },
    }, { upsert: true });
  }
  response.clearCookie(cookieName(scope), cookieOptions());
  response.clearCookie(accessCookieName(scope), { ...cookieOptions(), path: "/api" });
  response.setHeader("Cache-Control", "no-store");
}
