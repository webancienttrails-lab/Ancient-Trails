import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type AdminExpert = {
  id: string;
  expertId: string;
  fullName: string;
  fullBiography: string;
  expertiseTags: string[];
  qualifications: string[];
  languages: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExpertPayload = {
  expertId: string;
  fullName: string;
  fullBiography: string;
  expertiseTags: string[];
  qualifications: string[];
  languages: string[];
};

function getAdminHeaders(): HeadersInit {
  const session = getAdminSession();

  if (!session?.token) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export async function listAdminExperts() {
  return apiRequest<{ experts: AdminExpert[] }>("/api/admin/experts", {
    headers: getAdminHeaders(),
  });
}

export async function createAdminExpert(payload: ExpertPayload) {
  return apiRequest<{ expert: AdminExpert }>("/api/admin/experts", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminExpert(
  id: string,
  payload: ExpertPayload
) {
  return apiRequest<{ expert: AdminExpert }>(`/api/admin/experts/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminExpert(id: string) {
  return apiRequest<{ expert: AdminExpert }>(`/api/admin/experts/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}
