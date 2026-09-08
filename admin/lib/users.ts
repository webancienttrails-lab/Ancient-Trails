import { apiRequest } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type AdminDirectoryUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  roles: string[];
  status: string;
  isMobileVerified: boolean;
  lastLoginAt?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserStats = {
  travellers: {
    total: number;
    adults: number;
    children: number;
    newThisMonth: number;
  };
  admins: {
    expert: number;
    staff: number;
    admin: number;
  };
};

function headers(): HeadersInit {
  const session = getAdminSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export async function listAdminUsers() {
  return apiRequest<{
    users: AdminDirectoryUser[];
    stats: AdminUserStats;
  }>("/api/admin/users", { headers: headers() });
}
