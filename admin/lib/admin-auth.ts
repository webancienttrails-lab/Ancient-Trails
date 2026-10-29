import { disableBrowserPush } from "@/lib/notification-push";
import { ApiError, apiRequest } from "@/lib/api";

export type AdminUser = {
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

export type AdminSession = {
  sessionId: string;
  user: AdminUser;
};

export type AdminLoginPayload = {
  email: string;
  password: string;
};

const adminTokenKey = "ancient_trails_admin_token";
const adminSessionIdKey = "ancient_trails_admin_session_id";
const adminUserKey = "ancient_trails_admin_user";
const adminSessionEvent = "ancient-trails-admin-session-change";

export function isAdminRole(role: string): boolean {
  return (
    role === "admin" ||
    role === "expert" ||
    role === "staff" ||
    role === "super_admin" ||
    role.endsWith("_admin")
  );
}

export async function loginAdmin(payload: AdminLoginPayload) {
  return apiRequest<AdminSession>("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveAdminSession(session: AdminSession): void {
  if (typeof window === "undefined") return;
  if (!session.sessionId || !session.user?.id) throw new Error("Invalid session response. Please sign in again.");
  // Only a non-secret identifier and display profile are cached; credentials are HttpOnly.
  window.localStorage.removeItem(adminTokenKey);
  window.localStorage.setItem(adminSessionIdKey, session.sessionId);
  window.localStorage.setItem(adminUserKey, JSON.stringify(session.user));
  window.dispatchEvent(new Event(adminSessionEvent));
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  // Purge credentials left by older builds instead of keeping a readable JWT.
  window.localStorage.removeItem(adminTokenKey);
  const sessionId = window.localStorage.getItem(adminSessionIdKey);
  const user = window.localStorage.getItem(adminUserKey);
  if (!sessionId || !user) return null;
  try { return { sessionId, user: JSON.parse(user) as AdminUser }; }
  catch { clearAdminSession(); return null; }
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  const session = getAdminSessionForPush();
  if (session) void disableBrowserPush(session).catch(() => {});
  removeAdminSessionFromBrowser();
}

function getAdminSessionForPush(): AdminSession | null {
  try {
    const sessionId = window.localStorage.getItem(adminSessionIdKey);
    const user = JSON.parse(window.localStorage.getItem(adminUserKey) || "null");
    return sessionId && user?.id ? { sessionId, user } : null;
  } catch { return null; }
}

export function hasValidAdminSession(): boolean {
  const session = getAdminSession();

  if (!session?.sessionId) {
    return false;
  }

  const isAdmin = session.user.roles.some(isAdminRole);
  const isActive = session.user.status === "active";

  if (!isAdmin || !isActive) {
    clearAdminSession();
    return false;
  }

  return true;
}

export function listenForAdminSessionChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === adminTokenKey || event.key === adminSessionIdKey || event.key === adminUserKey) {
      listener();
    }
  };

  window.addEventListener(adminSessionEvent, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(adminSessionEvent, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

let refreshAdminFlight: Promise<AdminSession | null> | null = null;
let logoutAdminFlight: Promise<void> | null = null;

function removeAdminSessionFromBrowser() {
  window.localStorage.removeItem(adminTokenKey);
  window.localStorage.removeItem(adminSessionIdKey);
  window.localStorage.removeItem(adminUserKey);
  window.dispatchEvent(new Event(adminSessionEvent));
}

export async function refreshAdminSession(expectedSessionId: string): Promise<AdminSession | null> {
  const current = getAdminSession();
  if (!current || logoutAdminFlight || current.sessionId !== expectedSessionId) return null;
  if (!refreshAdminFlight) {
    refreshAdminFlight = (async () => {
      try {
        const result = await apiRequest<AdminSession>("/api/auth/refresh", {
          method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "X-Session-Id": expectedSessionId }, body: JSON.stringify({ audience: "admin" }),
        });
        if (logoutAdminFlight || getAdminSession()?.sessionId !== expectedSessionId || result.data.user.id !== current.user.id || result.data.sessionId !== expectedSessionId) return null;
        saveAdminSession(result.data);
        return result.data;
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401 && getAdminSession()?.sessionId === expectedSessionId) clearAdminSession();
        throw error;
      }
    })().finally(() => { refreshAdminFlight = null; });
  }
  return refreshAdminFlight;
}

export function logoutAdminSession(): Promise<void> {
  if (logoutAdminFlight) return logoutAdminFlight;
  const session = getAdminSession();
  if (!session) { clearAdminSession(); return Promise.resolve(); }
  void disableBrowserPush(session).catch(() => {});
  logoutAdminFlight = (async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST", headers: { "X-Session-Id": session.sessionId }, body: JSON.stringify({ audience: "admin" }) });
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
    }
    if (!getAdminSession() || getAdminSession()?.sessionId === session.sessionId) removeAdminSessionFromBrowser();
  })().finally(() => { logoutAdminFlight = null; });
  return logoutAdminFlight;
}
