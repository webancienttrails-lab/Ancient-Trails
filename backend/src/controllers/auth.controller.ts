import type { Request, Response } from "express";
import { compare } from "bcryptjs";
import { z } from "zod";

import {
  User,
  UserRole,
  UserStatus,
  type UserDocument,
} from "../models/user.model";
import { verifyFirebaseIdToken } from "../services/firebase-admin.service";
import { sendOtp, verifyOtp } from "../services/msg91.service";
import { validateTravellerEmailAddress } from "../utils/email";
import { HttpError } from "../utils/httpError";
import {
  signAuthToken,
  signTravellerGoogleRegistrationToken,
  signTravellerRegistrationToken,
  verifyAuthToken,
  verifyTravellerGoogleRegistrationToken,
  verifyTravellerRegistrationToken,
} from "../utils/jwt";
import { normalizeMobileNumber } from "../utils/mobileNumber";

const mobileNumberSchema = z
  .string()
  .min(1, "Mobile number is required")
  .transform((value, context) => {
    try {
      return normalizeMobileNumber(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "Invalid mobile number",
      });

      return z.NEVER;
    }
  });

const nameSchema = z.string().trim().min(1).max(80);

const requestTravellerOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
});

const requestTravellerProfileMobileOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
});

const verifyTravellerOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
  otp: z
    .string()
    .trim()
    .regex(/^\d{4,9}$/, "OTP must be 4 to 9 digits"),
});

const completeTravellerProfileSchema = z.object({
  registrationToken: z.string().trim().min(1, "Registration token is required"),
  firstName: nameSchema,
  lastName: nameSchema,
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
});

const completeGoogleTravellerProfileSchema = z.object({
  registrationToken: z.string().trim().min(1, "Registration token is required"),
  firstName: nameSchema,
  lastName: nameSchema,
  mobileNumber: mobileNumberSchema,
});

const updateTravellerProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  mobileNumber: mobileNumberSchema,
  gender: z.enum(["Male", "Female"]).or(z.literal("")).optional().default(""),
  mobileNumberOtp: z
    .string()
    .trim()
    .regex(/^\d{4,9}$/, "OTP must be 4 to 9 digits")
    .optional(),
  nationality: z
    .string()
    .trim()
    .max(80)
    .refine(
      (nationality) => nationality.toLowerCase() !== "other",
      "Please enter your country name"
    )
    .optional()
    .default(""),
  dateOfBirth: z.string().trim().max(40).optional().default(""),
});

const googleTravellerLoginSchema = z.object({
  idToken: z.string().trim().min(1, "Google ID token is required"),
});

const defaultSuperAdminEmail = "web.ancienttrails@gmail.com";
const defaultSuperAdminPassword = "trails_web@26";

const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1, "Password is required").max(128),
});

function parseRequestBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new HttpError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  return result.data;
}

function formatUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobileNumber: user.mobileNumber || "",
    gender: user.gender || "",
    nationality: user.nationality || "",
    dateOfBirth: user.dateOfBirth || "",
    roles: user.roles,
    status: user.status,
    isMobileVerified: user.isMobileVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function getBearerToken(request: Request): string {
  const authorizationHeader = request.headers.authorization;
  const [scheme, token] = authorizationHeader?.split(" ") || [];

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Please sign in to continue");
  }

  return token;
}

function getConfiguredAdminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || defaultSuperAdminEmail;
}

async function isValidConfiguredAdminPassword(password: string): Promise<boolean> {
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminPasswordHash) {
    return compare(password, adminPasswordHash);
  }

  if (adminPassword) {
    return password === adminPassword;
  }

  return password === defaultSuperAdminPassword;
}

function getAdminDisplayName() {
  const configuredName = process.env.ADMIN_NAME?.trim() || "Super Admin";
  const [firstName = "Admin", ...lastNameParts] = configuredName
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName,
    lastName: lastNameParts.join(" ") || "User",
  };
}

function isAdminRole(role: string): boolean {
  return role === "admin" || role === UserRole.SUPER_ADMIN || role.endsWith("_admin");
}

export async function loginAdminWithPassword(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(adminLoginSchema, request.body);
  const adminEmail = getConfiguredAdminEmail();
  const isConfiguredSuperAdminEmail = payload.email === adminEmail;
  const hasValidConfiguredPassword =
    isConfiguredSuperAdminEmail &&
    (await isValidConfiguredAdminPassword(payload.password));

  let admin = await User.findOne({
    email: payload.email,
  }).select("+passwordHash");

  if (admin?.status === UserStatus.BLOCKED) {
    throw new HttpError(403, "This admin account is blocked");
  }

  if (hasValidConfiguredPassword && !admin) {
    const { firstName, lastName } = getAdminDisplayName();

    admin = await User.create({
      firstName,
      lastName,
      email: payload.email,
      roles: [UserRole.SUPER_ADMIN],
      status: UserStatus.ACTIVE,
      isMobileVerified: true,
      lastLoginAt: new Date(),
    });
  } else if (hasValidConfiguredPassword && admin) {
    if (!admin.roles.includes(UserRole.SUPER_ADMIN)) {
      admin.roles.push(UserRole.SUPER_ADMIN);
    }

    admin.lastLoginAt = new Date();
    await admin.save();
  } else if (admin?.passwordHash && admin.roles.some(isAdminRole)) {
    const hasValidUserPassword = await compare(
      payload.password,
      admin.passwordHash
    );

    if (!hasValidUserPassword) {
      throw new HttpError(401, "Invalid admin email or password");
    }

    admin.lastLoginAt = new Date();
    await admin.save();
  } else {
    throw new HttpError(401, "Invalid admin email or password");
  }

  const token = signAuthToken(admin);

  response.status(200).json({
    success: true,
    message: "Admin logged in successfully",
    data: {
      token,
      user: formatUser(admin),
    },
  });
}

async function createOrUpdateTravellerProfile({
  mobileNumber,
  firstName,
  lastName,
  email,
}: {
  mobileNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<{ traveller: UserDocument; isNewTraveller: boolean }> {
  const existingEmailUser = await User.findOne({
    email,
    mobileNumber: { $ne: mobileNumber },
  });

  if (existingEmailUser) {
    throw new HttpError(409, "Email is already registered");
  }

  const existingMobileUser = await User.findOne({ mobileNumber });

  if (existingMobileUser) {
    if (existingMobileUser.status === UserStatus.BLOCKED) {
      throw new HttpError(403, "This traveller account is blocked");
    }

    existingMobileUser.firstName = firstName;
    existingMobileUser.lastName = lastName;
    existingMobileUser.email = email;
    existingMobileUser.isMobileVerified = true;
    existingMobileUser.lastLoginAt = new Date();

    if (!existingMobileUser.roles.includes(UserRole.TRAVELLER)) {
      existingMobileUser.roles.push(UserRole.TRAVELLER);
    }

    await existingMobileUser.save();

    return {
      traveller: existingMobileUser,
      isNewTraveller: false,
    };
  }

  try {
    const traveller = await User.create({
      firstName,
      lastName,
      email,
      mobileNumber,
      roles: [UserRole.TRAVELLER],
      status: UserStatus.ACTIVE,
      isMobileVerified: true,
      lastLoginAt: new Date(),
    });

    return {
      traveller,
      isNewTraveller: true,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(
        409,
        "Traveller already exists with this mobile number or email"
      );
    }

    throw error;
  }
}

export async function requestTravellerProfileMobileChangeOtp(
  request: Request,
  response: Response
): Promise<void> {
  const { mobileNumber } = parseRequestBody(
    requestTravellerProfileMobileOtpSchema,
    request.body
  );
  const authPayload = verifyAuthToken(getBearerToken(request));

  if (!authPayload.roles.includes(UserRole.TRAVELLER)) {
    throw new HttpError(403, "Traveller access is required");
  }

  const traveller = await User.findById(authPayload.userId);

  if (!traveller || !traveller.roles.includes(UserRole.TRAVELLER)) {
    throw new HttpError(404, "Traveller profile not found");
  }

  if (traveller.status === UserStatus.BLOCKED) {
    throw new HttpError(403, "This traveller account is blocked");
  }

  if (traveller.mobileNumber === mobileNumber) {
    throw new HttpError(400, "Please enter a different mobile number");
  }

  const existingMobileUser = await User.findOne({
    _id: { $ne: traveller._id },
    mobileNumber,
  });

  if (existingMobileUser) {
    throw new HttpError(409, "Mobile number is already registered");
  }

  await sendOtp(mobileNumber);

  response.status(200).json({
    success: true,
    message: "OTP sent to your new mobile number",
    data: {
      mobileNumber,
    },
  });
}

export async function updateTravellerProfile(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(updateTravellerProfileSchema, request.body);
  const token = getBearerToken(request);
  const authPayload = verifyAuthToken(token);

  if (!authPayload.roles.includes(UserRole.TRAVELLER)) {
    throw new HttpError(403, "Traveller access is required");
  }

  const traveller = await User.findById(authPayload.userId);

  if (!traveller || !traveller.roles.includes(UserRole.TRAVELLER)) {
    throw new HttpError(404, "Traveller profile not found");
  }

  if (traveller.status === UserStatus.BLOCKED) {
    throw new HttpError(403, "This traveller account is blocked");
  }

  if (traveller.email !== payload.email) {
    await validateTravellerEmailAddress(payload.email);
  }

  const existingEmailUser = await User.findOne({
    _id: { $ne: traveller._id },
    email: payload.email,
  });

  if (existingEmailUser) {
    throw new HttpError(409, "Email is already registered");
  }

  const existingMobileUser = await User.findOne({
    _id: { $ne: traveller._id },
    mobileNumber: payload.mobileNumber,
  });

  if (existingMobileUser) {
    throw new HttpError(409, "Mobile number is already registered");
  }

  const didMobileNumberChange = traveller.mobileNumber !== payload.mobileNumber;

  if (didMobileNumberChange) {
    if (!payload.mobileNumberOtp) {
      throw new HttpError(400, "Please verify your new mobile number with OTP");
    }

    await verifyOtp(payload.mobileNumber, payload.mobileNumberOtp);
  }

  traveller.firstName = payload.firstName;
  traveller.lastName = payload.lastName;
  traveller.email = payload.email;
  traveller.mobileNumber = payload.mobileNumber;
  traveller.gender = payload.gender;
  traveller.nationality = payload.nationality;
  traveller.dateOfBirth = payload.dateOfBirth;
  traveller.lastLoginAt = new Date();

  if (didMobileNumberChange) {
    traveller.isMobileVerified = true;
  }

  await traveller.save();

  response.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      token,
      user: formatUser(traveller),
    },
  });
}

function getGoogleTravellerName({
  email,
  displayName,
}: {
  email: string;
  displayName?: string;
}) {
  const nameParts = displayName?.trim().split(/\s+/).filter(Boolean) || [];
  const fallbackName = email.split("@")[0] || "Traveller";
  const firstName = nameParts[0] || fallbackName;
  const lastName = nameParts.slice(1).join(" ") || "Traveller";

  return {
    firstName,
    lastName,
  };
}

function normalizeOptionalFirebasePhoneNumber(
  phoneNumber: string | undefined
): string | undefined {
  if (!phoneNumber) {
    return undefined;
  }

  try {
    return normalizeMobileNumber(phoneNumber);
  } catch {
    return undefined;
  }
}

async function attachFirebaseMobileNumberIfAvailable(
  traveller: UserDocument,
  mobileNumber: string | undefined
) {
  if (!mobileNumber || traveller.mobileNumber) {
    return;
  }

  const existingMobileUser = await User.findOne({
    _id: { $ne: traveller._id },
    mobileNumber,
  });

  if (existingMobileUser) {
    return;
  }

  traveller.mobileNumber = mobileNumber;
  traveller.isMobileVerified = true;
}

export async function requestTravellerOtp(
  request: Request,
  response: Response
): Promise<void> {
  const { mobileNumber } = parseRequestBody(
    requestTravellerOtpSchema,
    request.body
  );

  const traveller = await User.findOne({
    mobileNumber,
    roles: UserRole.TRAVELLER,
  });

  if (traveller?.status === UserStatus.BLOCKED) {
    throw new HttpError(403, "This traveller account is blocked");
  }

  await sendOtp(mobileNumber);

  response.status(200).json({
    success: true,
    message: "OTP sent successfully",
    data: {
      mobileNumber,
    },
  });
}

export async function verifyTravellerOtpAndLogin(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(verifyTravellerOtpSchema, request.body);

  await verifyOtp(payload.mobileNumber, payload.otp);

  let traveller = await User.findOne({
    mobileNumber: payload.mobileNumber,
    roles: UserRole.TRAVELLER,
  });

  if (!traveller) {
    const registrationToken = signTravellerRegistrationToken(
      payload.mobileNumber
    );

    response.status(200).json({
      success: true,
      message: "OTP verified successfully. Complete your traveller profile.",
      data: {
        requiresProfile: true,
        mobileNumber: payload.mobileNumber,
        registrationToken,
      },
    });

    return;
  }

  if (traveller.status === UserStatus.BLOCKED) {
    throw new HttpError(403, "This traveller account is blocked");
  }

  traveller.isMobileVerified = true;
  traveller.lastLoginAt = new Date();
  await traveller.save();

  const token = signAuthToken(traveller);

  response.status(200).json({
    success: true,
    message: "Traveller logged in successfully",
    data: {
      requiresProfile: false,
      token,
      user: formatUser(traveller),
    },
  });
}

export async function loginTravellerWithGoogle(
  request: Request,
  response: Response
): Promise<void> {
  const { idToken } = parseRequestBody(googleTravellerLoginSchema, request.body);
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  const email = firebaseUser.email?.trim().toLowerCase();

  if (!email) {
    throw new HttpError(400, "Google account must include an email address");
  }

  if (firebaseUser.email_verified === false) {
    throw new HttpError(403, "Google account email is not verified");
  }

  const firebaseUid = firebaseUser.uid;
  const mobileNumber = normalizeOptionalFirebasePhoneNumber(
    firebaseUser.phone_number
  );
  const profileName = getGoogleTravellerName({
    email,
    displayName: firebaseUser.name,
  });

  const travellerIdentityFilters: Array<
    { firebaseUid: string } | { email: string } | { mobileNumber: string }
  > = [{ firebaseUid }, { email }];

  if (mobileNumber) {
    travellerIdentityFilters.push({ mobileNumber });
  }

  const traveller = await User.findOne({
    $or: travellerIdentityFilters,
  });

  if (traveller) {
    if (traveller.status === UserStatus.BLOCKED) {
      throw new HttpError(403, "This traveller account is blocked");
    }

    if (traveller.firebaseUid && traveller.firebaseUid !== firebaseUid) {
      throw new HttpError(
        409,
        "This email is already linked to another Google account"
      );
    }

    if (traveller.email !== email) {
      const existingEmailUser = await User.findOne({
        _id: { $ne: traveller._id },
        email,
      });

      if (existingEmailUser) {
        throw new HttpError(
          409,
          "This email is already registered with another traveller"
        );
      }

      traveller.email = email;
    }

    traveller.firebaseUid = firebaseUid;
    traveller.lastLoginAt = new Date();

    if (!traveller.roles.includes(UserRole.TRAVELLER)) {
      traveller.roles.push(UserRole.TRAVELLER);
    }

    await attachFirebaseMobileNumberIfAvailable(traveller, mobileNumber);
    await traveller.save();

    const token = signAuthToken(traveller);

    response.status(200).json({
      success: true,
      message: "Traveller logged in with Google successfully",
      data: {
        requiresProfile: false,
        token,
        user: formatUser(traveller),
      },
    });

    return;
  }

  const registrationToken = signTravellerGoogleRegistrationToken({
    firebaseUid,
    email,
    ...profileName,
  });

  response.status(200).json({
    success: true,
    message: "Google sign-in verified. Complete your traveller profile.",
    data: {
      requiresProfile: true,
      provider: "google",
      registrationToken,
      email,
      mobileNumber: mobileNumber || "",
      ...profileName,
    },
  });
}

export async function completeTravellerProfile(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(
    completeTravellerProfileSchema,
    request.body
  );
  await validateTravellerEmailAddress(payload.email);

  const mobileNumber = verifyTravellerRegistrationToken(
    payload.registrationToken
  );
  const { traveller, isNewTraveller } = await createOrUpdateTravellerProfile({
    mobileNumber,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
  });
  const token = signAuthToken(traveller);

  response.status(isNewTraveller ? 201 : 200).json({
    success: true,
    message: isNewTraveller
      ? "Traveller profile completed successfully"
      : "Traveller profile updated successfully",
    data: {
      token,
      user: formatUser(traveller),
    },
  });
}

export async function completeGoogleTravellerProfile(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(
    completeGoogleTravellerProfileSchema,
    request.body
  );
  const googleProfile = verifyTravellerGoogleRegistrationToken(
    payload.registrationToken
  );

  let traveller = await User.findOne({
    $or: [
      { firebaseUid: googleProfile.firebaseUid },
      { email: googleProfile.email },
    ],
  });

  if (traveller) {
    if (traveller.status === UserStatus.BLOCKED) {
      throw new HttpError(403, "This traveller account is blocked");
    }

    if (
      traveller.firebaseUid &&
      traveller.firebaseUid !== googleProfile.firebaseUid
    ) {
      throw new HttpError(
        409,
        "This email is already linked to another Google account"
      );
    }

    const existingMobileUser = await User.findOne({
      _id: { $ne: traveller._id },
      mobileNumber: payload.mobileNumber,
    });

    if (existingMobileUser) {
      throw new HttpError(
        409,
        "Mobile number is already registered. Please sign in with mobile OTP."
      );
    }
  } else {
    traveller = await User.findOne({ mobileNumber: payload.mobileNumber });

    if (traveller) {
      if (traveller.status === UserStatus.BLOCKED) {
        throw new HttpError(403, "This traveller account is blocked");
      }

      if (
        traveller.firebaseUid &&
        traveller.firebaseUid !== googleProfile.firebaseUid
      ) {
        throw new HttpError(
          409,
          "This mobile number is already linked to another Google account"
        );
      }

      if (traveller.email !== googleProfile.email) {
        throw new HttpError(
          409,
          "Mobile number is already registered. Please sign in with mobile OTP."
        );
      }
    }
  }

  if (traveller) {
    traveller.firstName = payload.firstName;
    traveller.lastName = payload.lastName;
    traveller.email = googleProfile.email;
    traveller.mobileNumber = payload.mobileNumber;
    traveller.firebaseUid = googleProfile.firebaseUid;
    traveller.lastLoginAt = new Date();

    if (!traveller.roles.includes(UserRole.TRAVELLER)) {
      traveller.roles.push(UserRole.TRAVELLER);
    }

    await traveller.save();
  } else {
    try {
      traveller = await User.create({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: googleProfile.email,
        mobileNumber: payload.mobileNumber,
        firebaseUid: googleProfile.firebaseUid,
        roles: [UserRole.TRAVELLER],
        status: UserStatus.ACTIVE,
        isMobileVerified: false,
        lastLoginAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new HttpError(
          409,
          "Traveller already exists with this mobile number, email, or Google account"
        );
      }

      throw error;
    }
  }

  const token = signAuthToken(traveller);

  response.status(201).json({
    success: true,
    message: "Traveller profile completed successfully",
    data: {
      token,
      user: formatUser(traveller),
    },
  });
}
