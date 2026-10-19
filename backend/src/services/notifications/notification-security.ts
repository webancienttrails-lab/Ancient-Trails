import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { HttpError } from "../../utils/httpError";
export const FIREBASE_PUSH_PROJECT = "ancient-trails-e598a";
function key() {
  const secret = process.env.PUSH_REGISTRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new HttpError(503, "Push registration encryption is not configured");
  return createHash("sha256").update("ancient-trails/push/v1:" + secret).digest();
}
export function registrationHash(value: string) { return createHmac("sha256", key()).update(value).digest("hex"); }
export function encryptRegistration(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
}
export function decryptRegistration(value: string) {
  const parts = value.split(".").map(part => Buffer.from(part, "base64url"));
  if (parts.length !== 3) throw new Error("Invalid encrypted registration");
  const decipher = createDecipheriv("aes-256-gcm", key(), parts[0]!); decipher.setAuthTag(parts[1]!);
  return Buffer.concat([decipher.update(parts[2]!), decipher.final()]).toString("utf8");
}
export function notificationKey(...parts: string[]) { return createHash("sha256").update(JSON.stringify(parts)).digest("hex"); }
export function safeNotificationUrl(url: string, audience: "admin" | "customer") {
  return (audience === "admin" ? /^\/(bookings|users|tours)(\/|\?|$)/.test(url) : /^\/me(\/|\?|$)/.test(url)) && !url.includes("\\") && !url.includes("//") ? url : audience === "admin" ? "/bookings" : "/me";
}
export function retryDate(attempts: number, now = new Date()) { return new Date(now.getTime() + Math.min(6 * 3600000, 60000 * 2 ** Math.min(attempts - 1, 8)) + Math.floor(Math.random() * 10000)); }
export function invalidRegistrationCode(code: string) { return ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/installation-id-not-registered"].includes(code); }
