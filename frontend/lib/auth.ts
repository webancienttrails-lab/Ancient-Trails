import { disableBrowserPush } from "@/lib/notification-push";
import { ApiError, apiRequest } from "@/lib/api";

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
  sessionId: string;
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

export type VerifyTravellerProfileMobileChangeData = TravellerSession & {
  mobileNumber: string;
};

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
  mobileNumberOtp?: string;
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
const travellerSessionIdKey = "ancient_trails_session_id";
const travellerUserKey = "ancient_trails_user";
const travellerSessionEvent = "ancient-trails-session-change";
export const travellerProfileCompletionPath = "/me/account";

export function isTravellerProfileComplete(user: TravellerUser | null) {
  if (!user) {
    return false;
  }

  return Boolean(
    user.firstName?.trim() &&
      user.lastName?.trim() &&
      user.email?.trim() &&
      user.mobileNumber?.trim()
  );
}

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

  if (!session?.sessionId) {
    throw new Error("Please sign in to verify your mobile number.");
  }

  return apiRequest<RequestTravellerOtpData>(
    "/api/auth/traveller/profile/request-mobile-change-otp",
    {
      method: "POST",
      headers: {
        "X-Session-Id": session.sessionId,
      },
      body: JSON.stringify({ mobileNumber }),
    }
  );
}

export async function verifyTravellerProfileMobileChangeOtp(
  payload: VerifyTravellerOtpPayload
) {
  const session = getTravellerSession();

  if (!session?.sessionId) {
    throw new Error("Please sign in to verify your mobile number.");
  }

  return apiRequest<VerifyTravellerProfileMobileChangeData>(
    "/api/auth/traveller/profile/verify-mobile-change-otp",
    {
      method: "POST",
      headers: {
        "X-Session-Id": session.sessionId,
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function updateTravellerProfile(
  payload: UpdateTravellerProfilePayload
) {
  const session = getTravellerSession();

  if (!session?.sessionId) {
    throw new Error("Please sign in to update your profile.");
  }

  return apiRequest<TravellerSession>("/api/auth/traveller/profile", {
    method: "PATCH",
    headers: {
      "X-Session-Id": session.sessionId,
    },
    body: JSON.stringify(payload),
  });
}

export function saveTravellerSession(session: TravellerSession): void {
  if (typeof window === "undefined") return;
  if (!session.sessionId || !session.user?.id) throw new Error("Invalid session response. Please sign in again.");
  // Only a non-secret identifier and display profile are cached; credentials are HttpOnly.
  window.localStorage.removeItem(travellerTokenKey);
  window.localStorage.setItem(travellerSessionIdKey, session.sessionId);
  window.localStorage.setItem(travellerUserKey, JSON.stringify(session.user));
  window.dispatchEvent(new Event(travellerSessionEvent));
}

export function getTravellerSession(): TravellerSession | null {
  if (typeof window === "undefined") return null;
  // Purge credentials left by older builds instead of keeping a readable JWT.
  window.localStorage.removeItem(travellerTokenKey);
  const sessionId = window.localStorage.getItem(travellerSessionIdKey);
  const user = window.localStorage.getItem(travellerUserKey);
  if (!sessionId || !user) return null;
  try { return { sessionId, user: JSON.parse(user) as TravellerUser }; }
  catch { clearTravellerSession(); return null; }
}

export function clearTravellerSession(): void {
  if (typeof window === "undefined") return;
  const session = getTravellerSessionForPush();
  if (session) void disableBrowserPush(session).catch(() => {});
  removeTravellerSessionFromBrowser();
}

function getTravellerSessionForPush(): TravellerSession | null {
  try {
    const sessionId = window.localStorage.getItem(travellerSessionIdKey);
    const user = JSON.parse(window.localStorage.getItem(travellerUserKey) || "null");
    return sessionId && user?.id ? { sessionId, user } : null;
  } catch { return null; }
}

export function listenForTravellerSessionChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === travellerTokenKey || event.key === travellerSessionIdKey || event.key === travellerUserKey) {
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

let refreshTravellerFlight: Promise<TravellerSession | null> | null = null;
let logoutTravellerFlight: Promise<void> | null = null;

function removeTravellerSessionFromBrowser() {
  window.localStorage.removeItem(travellerTokenKey);
  window.localStorage.removeItem(travellerSessionIdKey);
  window.localStorage.removeItem(travellerUserKey);
  window.dispatchEvent(new Event(travellerSessionEvent));
}

export async function refreshTravellerSession(expectedSessionId: string): Promise<TravellerSession | null> {
  const current = getTravellerSession();
  if (!current || logoutTravellerFlight || current.sessionId !== expectedSessionId) return null;
  if (!refreshTravellerFlight) {
    refreshTravellerFlight = (async () => {
      try {
        const result = await apiRequest<TravellerSession>("/api/auth/refresh", {
          method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "X-Session-Id": expectedSessionId }, body: JSON.stringify({ audience: "traveller" }),
        });
        if (logoutTravellerFlight || getTravellerSession()?.sessionId !== expectedSessionId || result.data.user.id !== current.user.id || result.data.sessionId !== expectedSessionId) return null;
        saveTravellerSession(result.data);
        return result.data;
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401 && getTravellerSession()?.sessionId === expectedSessionId) clearTravellerSession();
        throw error;
      }
    })().finally(() => { refreshTravellerFlight = null; });
  }
  return refreshTravellerFlight;
}

export function logoutTravellerSession(): Promise<void> {
  if (logoutTravellerFlight) return logoutTravellerFlight;
  const session = getTravellerSession();
  if (!session) { clearTravellerSession(); return Promise.resolve(); }
  void disableBrowserPush(session).catch(() => {});
  logoutTravellerFlight = (async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST", headers: { "X-Session-Id": session.sessionId }, body: JSON.stringify({ audience: "traveller" }) });
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
    }
    if (!getTravellerSession() || getTravellerSession()?.sessionId === session.sessionId) removeTravellerSessionFromBrowser();
  })().finally(() => { logoutTravellerFlight = null; });
  return logoutTravellerFlight;
}
