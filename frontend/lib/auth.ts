import { apiRequest } from "@/lib/api";

export type TravellerUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  gender?: string;
  nationality?: string;
  dateOfBirth?: string;
  roles: string[];
  status: string;
  isMobileVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RequestTravellerOtpData = {
  mobileNumber: string;
};

export type VerifyTravellerOtpPayload = {
  mobileNumber: string;
  otp: string;
};

export type TravellerSession = {
  token: string;
  user: TravellerUser;
};

export type TravellerProfileRequired = {
  requiresProfile: true;
  mobileNumber: string;
  registrationToken: string;
};

export type TravellerLoginComplete = TravellerSession & {
  requiresProfile: false;
};

export type VerifyTravellerOtpData =
  | TravellerProfileRequired
  | TravellerLoginComplete;

export type CompleteTravellerProfilePayload = {
  registrationToken: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type TravellerGoogleLoginPayload = {
  idToken: string;
};

export type TravellerGoogleProfileRequired = {
  requiresProfile: true;
  provider: "google";
  registrationToken: string;
  email: string;
  mobileNumber: string;
  firstName: string;
  lastName: string;
};

export type TravellerGoogleLoginData =
  | TravellerGoogleProfileRequired
  | TravellerLoginComplete;

export type CompleteGoogleTravellerProfilePayload = {
  registrationToken: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
};

export type UpdateTravellerProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  mobileNumberOtp?: string;
  gender: string;
  nationality: string;
  dateOfBirth: string;
};

const travellerTokenKey = "ancient_trails_token";
const travellerUserKey = "ancient_trails_user";
const travellerSessionEvent = "ancient-trails-session-change";

export async function requestTravellerOtp(mobileNumber: string) {
  return apiRequest<RequestTravellerOtpData>("/api/auth/traveller/request-otp", {
    method: "POST",
    body: JSON.stringify({ mobileNumber }),
  });
}

export async function verifyTravellerOtp(payload: VerifyTravellerOtpPayload) {
  return apiRequest<VerifyTravellerOtpData>("/api/auth/traveller/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeTravellerProfile(
  payload: CompleteTravellerProfilePayload
) {
  return apiRequest<TravellerSession>("/api/auth/traveller/complete-profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginTravellerWithGoogle(
  payload: TravellerGoogleLoginPayload
) {
  return apiRequest<TravellerGoogleLoginData>("/api/auth/traveller/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeGoogleTravellerProfile(
  payload: CompleteGoogleTravellerProfilePayload
) {
  return apiRequest<TravellerSession>(
    "/api/auth/traveller/complete-google-profile",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function requestTravellerProfileMobileChangeOtp(
  mobileNumber: string
) {
  const session = getTravellerSession();

  if (!session?.token) {
    throw new Error("Please sign in to verify your mobile number.");
  }

  return apiRequest<RequestTravellerOtpData>(
    "/api/auth/traveller/profile/request-mobile-change-otp",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ mobileNumber }),
    }
  );
}

export async function updateTravellerProfile(
  payload: UpdateTravellerProfilePayload
) {
  const session = getTravellerSession();

  if (!session?.token) {
    throw new Error("Please sign in to update your profile.");
  }

  return apiRequest<TravellerSession>("/api/auth/traveller/profile", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function saveTravellerSession(session: TravellerSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(travellerTokenKey, session.token);
  window.localStorage.setItem(travellerUserKey, JSON.stringify(session.user));
  window.dispatchEvent(new Event(travellerSessionEvent));
}

export function getTravellerSession(): TravellerSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(travellerTokenKey);
  const user = window.localStorage.getItem(travellerUserKey);

  if (!token || !user) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(user) as TravellerUser,
    };
  } catch {
    clearTravellerSession();

    return null;
  }
}

export function clearTravellerSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(travellerTokenKey);
  window.localStorage.removeItem(travellerUserKey);
  window.dispatchEvent(new Event(travellerSessionEvent));
}

export function listenForTravellerSessionChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === travellerTokenKey || event.key === travellerUserKey) {
      listener();
    }
  };

  window.addEventListener(travellerSessionEvent, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(travellerSessionEvent, listener);
    window.removeEventListener("storage", handleStorage);
  };
}
