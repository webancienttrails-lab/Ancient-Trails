import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import type { UserDocument } from "../models/user.model";
import { HttpError } from "./httpError";

const travellerRegistrationPurpose = "traveller_registration";
const travellerGoogleRegistrationPurpose = "traveller_google_registration";

export type TravellerGoogleRegistrationPayload = {
  firebaseUid: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AuthTokenPayload = {
  userId: string;
  roles: string[];
};

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing from the environment");
  }

  return jwtSecret;
}

export function signAuthToken(user: UserDocument): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ||
      "7d") as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      userId: user._id.toString(),
      roles: user.roles,
    },
    getJwtSecret(),
    options
  );
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (typeof payload === "string" || !isAuthTokenPayload(payload)) {
      throw new HttpError(401, "Invalid auth session");
    }

    return {
      userId: payload.userId,
      roles: payload.roles,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Auth session expired. Please sign in again.");
  }
}

export function signTravellerRegistrationToken(mobileNumber: string): string {
  const options: SignOptions = {
    expiresIn: (process.env.TRAVELLER_REGISTRATION_TOKEN_EXPIRES_IN ||
      "15m") as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      purpose: travellerRegistrationPurpose,
      mobileNumber,
    },
    getJwtSecret(),
    options
  );
}

export function signTravellerGoogleRegistrationToken(
  payload: TravellerGoogleRegistrationPayload
): string {
  const options: SignOptions = {
    expiresIn: (process.env.TRAVELLER_REGISTRATION_TOKEN_EXPIRES_IN ||
      "15m") as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      purpose: travellerGoogleRegistrationPurpose,
      ...payload,
    },
    getJwtSecret(),
    options
  );
}

export function verifyTravellerRegistrationToken(token: string): string {
  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (
      typeof payload === "string" ||
      !isTravellerRegistrationPayload(payload)
    ) {
      throw new HttpError(401, "Invalid registration session");
    }

    return payload.mobileNumber;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Registration session expired. Please verify OTP again.");
  }
}

export function verifyTravellerGoogleRegistrationToken(
  token: string
): TravellerGoogleRegistrationPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (
      typeof payload === "string" ||
      !isTravellerGoogleRegistrationPayload(payload)
    ) {
      throw new HttpError(401, "Invalid registration session");
    }

    return {
      firebaseUid: payload.firebaseUid,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      401,
      "Registration session expired. Please sign in with Google again."
    );
  }
}

function isAuthTokenPayload(
  payload: JwtPayload
): payload is JwtPayload & AuthTokenPayload {
  return (
    typeof payload.userId === "string" &&
    payload.userId.trim().length > 0 &&
    Array.isArray(payload.roles) &&
    payload.roles.every((role) => typeof role === "string")
  );
}

function isTravellerRegistrationPayload(
  payload: JwtPayload
): payload is JwtPayload & { purpose: string; mobileNumber: string } {
  return (
    payload.purpose === travellerRegistrationPurpose &&
    typeof payload.mobileNumber === "string" &&
    /^\d{10,15}$/.test(payload.mobileNumber)
  );
}

function isTravellerGoogleRegistrationPayload(
  payload: JwtPayload
): payload is JwtPayload & TravellerGoogleRegistrationPayload {
  return (
    payload.purpose === travellerGoogleRegistrationPurpose &&
    typeof payload.firebaseUid === "string" &&
    payload.firebaseUid.trim().length > 0 &&
    typeof payload.email === "string" &&
    payload.email.trim().length > 0 &&
    typeof payload.firstName === "string" &&
    payload.firstName.trim().length > 0 &&
    typeof payload.lastName === "string" &&
    payload.lastName.trim().length > 0
  );
}
