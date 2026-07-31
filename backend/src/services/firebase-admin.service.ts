import { createVerify } from "node:crypto";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

import { HttpError } from "../utils/httpError";

const firebaseTokenIssuer = "https://securetoken.google.com/";
const firebasePublicCertUrl =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const clockSkewSeconds = 300;

type FirebaseJwtHeader = {
  alg?: string;
  kid?: string;
};

type FirebaseJwtPayload = Record<string, unknown> & {
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
};

let publicCertCache:
  | {
      expiresAt: number;
      certificates: Record<string, string>;
    }
  | undefined;

function getFirebaseProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();

  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is missing from the environment");
  }

  return projectId;
}

function getPrivateKey(): string | undefined {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function hasFirebaseAdminCredential(): boolean {
  return Boolean(
    (process.env.FIREBASE_CLIENT_EMAIL?.trim() && getPrivateKey()) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  );
}

function getFirebaseApp() {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const projectId = getFirebaseProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = getPrivateKey();

  return initializeApp({
    credential:
      clientEmail && privateKey
        ? cert({
            projectId,
            clientEmail,
            privateKey,
          })
        : applicationDefault(),
    projectId,
  });
}

function decodeJwtSegment<TValue>(segment: string): TValue {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as TValue;
}

function getCertificateCacheExpiry(cacheControl: string | null): number {
  const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  return Date.now() + maxAgeSeconds * 1000;
}

async function getFirebasePublicCertificates(): Promise<Record<string, string>> {
  if (publicCertCache && publicCertCache.expiresAt > Date.now()) {
    return publicCertCache.certificates;
  }

  const response = await fetch(firebasePublicCertUrl);

  if (!response.ok) {
    throw new Error("Unable to fetch Firebase public certificates");
  }

  const certificates = (await response.json()) as Record<string, string>;

  publicCertCache = {
    certificates,
    expiresAt: getCertificateCacheExpiry(response.headers.get("cache-control")),
  };

  return certificates;
}

function verifyTokenClaims(payload: FirebaseJwtPayload, projectId: string) {
  const now = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error("Firebase token audience does not match this project");
  }

  if (payload.iss !== `${firebaseTokenIssuer}${projectId}`) {
    throw new Error("Firebase token issuer does not match this project");
  }

  if (!payload.sub || payload.sub.length > 128) {
    throw new Error("Firebase token subject is invalid");
  }

  if (!payload.exp || payload.exp < now - clockSkewSeconds) {
    throw new Error("Firebase token has expired");
  }

  if (!payload.iat || payload.iat > now + clockSkewSeconds) {
    throw new Error("Firebase token issue time is invalid");
  }
}

async function verifyFirebaseIdTokenWithPublicCertificates(
  idToken: string
): Promise<DecodedIdToken> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Firebase token is malformed");
  }

  const header = decodeJwtSegment<FirebaseJwtHeader>(encodedHeader);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Firebase token header is invalid");
  }

  const certificates = await getFirebasePublicCertificates();
  const certificate = certificates[header.kid];

  if (!certificate) {
    throw new Error("Firebase token signing certificate was not found");
  }

  const verifier = createVerify("RSA-SHA256");

  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const isSignatureValid = verifier.verify(
    certificate,
    Buffer.from(encodedSignature, "base64url")
  );

  if (!isSignatureValid) {
    throw new Error("Firebase token signature is invalid");
  }

  const payload = decodeJwtSegment<FirebaseJwtPayload>(encodedPayload);
  const projectId = getFirebaseProjectId();

  verifyTokenClaims(payload, projectId);

  return {
    ...payload,
    uid: payload.sub,
  } as DecodedIdToken;
}

export async function verifyFirebaseIdToken(
  idToken: string
): Promise<DecodedIdToken> {
  try {
    if (hasFirebaseAdminCredential()) {
      return await getAuth(getFirebaseApp()).verifyIdToken(idToken);
    }

    return await verifyFirebaseIdTokenWithPublicCertificates(idToken);
  } catch {
    throw new HttpError(401, "Invalid Google sign-in session");
  }
}
