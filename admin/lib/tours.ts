import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type AdminTour = {
  id: string;
  tourId: string;
  tourName: string;
  tourType: string;
  destinationId: string;
  durationDn: string;
  category: string;
  difficulty: string;
  bestSeason: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  expertId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TourPayload = {
  tourId: string;
  tourName: string;
  tourType: string;
  destinationId: string;
  durationDn: string;
  category: string;
  difficulty: string;
  bestSeason: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  expertId: string;
  notes: string;
};

export type AdminTourDeparture = {
  id: string;
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: string;
  returnDate: string;
  seatsAvailable: number;
  priceAdult: number;
  priceChild: number;
  singleOccupancy: number;
  depositType: string;
  depositValue: number;
  balanceDueDaysBefore: number;
  earlyBirdOffer: string;
  bookingDeadline: string;
  createdAt: string;
  updatedAt: string;
};

export type TourDeparturePayload = {
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: string;
  returnDate: string;
  seatsAvailable: number;
  priceAdult: number;
  priceChild: number;
  singleOccupancy: number;
  depositType: string;
  depositValue: number;
  balanceDueDaysBefore: number;
  earlyBirdOffer: string;
  bookingDeadline: string;
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

export async function listAdminTours() {
  return apiRequest<{ tours: AdminTour[] }>("/api/admin/tours", {
    headers: getAdminHeaders(),
  });
}

export async function createAdminTour(payload: TourPayload) {
  return apiRequest<{ tour: AdminTour }>("/api/admin/tours", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTour(id: string, payload: TourPayload) {
  return apiRequest<{ tour: AdminTour }>(`/api/admin/tours/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminTour(id: string) {
  return apiRequest<{ tour: AdminTour }>(`/api/admin/tours/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}

export async function listAdminTourDepartures() {
  return apiRequest<{ departures: AdminTourDeparture[] }>(
    "/api/admin/tours/departures",
    {
      headers: getAdminHeaders(),
    }
  );
}

export async function createAdminTourDeparture(payload: TourDeparturePayload) {
  return apiRequest<{ departure: AdminTourDeparture }>(
    "/api/admin/tours/departures",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminTourDeparture(
  id: string,
  payload: TourDeparturePayload
) {
  return apiRequest<{ departure: AdminTourDeparture }>(
    `/api/admin/tours/departures/${id}`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteAdminTourDeparture(id: string) {
  return apiRequest<{ departure: AdminTourDeparture }>(
    `/api/admin/tours/departures/${id}`,
    {
      method: "DELETE",
      headers: getAdminHeaders(),
    }
  );
}
