import { apiRequest } from "@/lib/api";

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
  token: string;
  user: AdminUser;
};

export type AdminLoginPayload = {
  email: string;
  password: string;
};

const adminTokenKey = "ancient_trails_admin_token";
const adminUserKey = "ancient_trails_admin_user";
const adminSessionEvent = "ancient-trails-admin-session-change";

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin" || role.endsWith("_admin");
}

export async function loginAdmin(payload: AdminLoginPayload) {
  return apiRequest<AdminSession>("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveAdminSession(session: AdminSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(adminTokenKey, session.token);
  window.localStorage.setItem(adminUserKey, JSON.stringify(session.user));
  window.dispatchEvent(new Event(adminSessionEvent));
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(adminTokenKey);
  const user = window.localStorage.getItem(adminUserKey);

  if (!token || !user) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(user) as AdminUser,
    };
  } catch {
    clearAdminSession();

    return null;
  }
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(adminTokenKey);
  window.localStorage.removeItem(adminUserKey);
  window.dispatchEvent(new Event(adminSessionEvent));
}

export function hasValidAdminSession(): boolean {
  const session = getAdminSession();

  if (!session?.token) {
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
    if (event.key === adminTokenKey || event.key === adminUserKey) {
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
