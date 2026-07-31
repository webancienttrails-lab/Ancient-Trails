import { apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type BookingGuestDetails = {
  title: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
};

export type BookingChildDetails = {
  age: number;
};

export type BookingAccommodationDetails = {
  singleOccupancyOneRoom: number;
  singleOccupancyTwoRooms: number;
  doubleOccupancy: number;
  twinOccupancy: number;
  tripleOccupancy: number;
};

export type AdminBooking = {
  id: string;
  tourId: string;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: BookingChildDetails[];
  guestDetails: BookingGuestDetails[];
  accommodationDetails: BookingAccommodationDetails;
  createdAt: string;
  updatedAt: string;
};

export type BookingPayload = {
  tourId: string;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: BookingChildDetails[];
  guestDetails: BookingGuestDetails[];
  accommodationDetails: BookingAccommodationDetails;
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

export async function listAdminBookings() {
  return apiRequest<{ bookings: AdminBooking[] }>("/api/admin/bookings", {
    headers: getAdminHeaders(),
  });
}

export async function createAdminBooking(payload: BookingPayload) {
  return apiRequest<{ booking: AdminBooking }>("/api/admin/bookings", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBooking(id: string, payload: BookingPayload) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBooking(id: string) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}
