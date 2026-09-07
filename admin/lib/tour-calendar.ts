import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type TourCalendarFestival = {
  id: string;
  title: string;
  date: string;
  description: string;
  sortOrder: number;
};

export type TourCalendarContent = {
  id: string;
  festivals: TourCalendarFestival[];
  createdAt: string;
  updatedAt: string;
};

export type TourCalendarPayload = {
  festivals: Array<Omit<TourCalendarFestival, "id">>;
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

export async function getAdminTourCalendar() {
  return apiRequest<{ tourCalendar: TourCalendarContent }>(
    "/api/admin/tour-calendar",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function updateAdminTourCalendar(payload: TourCalendarPayload) {
  return apiRequest<{ tourCalendar: TourCalendarContent }>(
    "/api/admin/tour-calendar",
    {
      method: "PUT",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}
