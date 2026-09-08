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

export type BookingPaymentOption = "advance" | "full";
export type BookingPaymentMethod = "cash" | "cheque" | "neft";

export type BookingTravellerDetails = {
  id: string;
  type: "adult" | "child";
  title?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  mobileNumber?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  ageOnDeparture?: number;
};

export type BookingAccommodationOption = {
  id: string;
  title: string;
  description: string;
  total: number;
  rooms: Array<{
    id: string;
    title: string;
    bedSummary: string;
    roomType: string;
    allocations: Array<{
      label: string;
      price: number;
    }>;
  }>;
  recommended: boolean;
  requiresRoommateMatching: boolean;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  balanceDueDate: string | null;
};

export type AdminBooking = {
  id: string;
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: BookingPaymentOption;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: BookingChildDetails[];
  guestDetails: BookingGuestDetails[];
  travellers?: BookingTravellerDetails[];
  accommodationDetails: BookingAccommodationDetails;
  pricingSnapshot?: {
    accommodation?: {
      optionTitle?: string;
      rooms?: BookingAccommodationOption["rooms"];
    };
  };
  subtotal?: number;
  grandTotal?: number;
  depositAmount?: number;
  balanceAmount?: number;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  paymentMethod?: BookingPaymentMethod | "";
  paymentCurrency?: string;
  amountPaid?: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingPayload = {
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  paymentOption?: BookingPaymentOption;
  paymentMethod?: BookingPaymentMethod;
  amountPaid?: number;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: BookingChildDetails[];
  guestDetails: BookingGuestDetails[];
  travellers?: BookingTravellerDetails[];
  accommodationDetails: BookingAccommodationDetails;
  gstPercentage?: number;
};

export type BookingAccommodationOptionsPayload = {
  departureId: string;
  adultCount: number;
  childDetails: BookingChildDetails[];
  gstPercentage?: number;
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

export async function listAdminBookingAccommodationOptions(
  payload: BookingAccommodationOptionsPayload
) {
  return apiRequest<{ options: BookingAccommodationOption[] }>(
    "/api/admin/bookings/accommodation-options",
    {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function updateAdminBooking(id: string, payload: BookingPayload) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function archiveAdminBooking(id: string) {
  return apiRequest<{ booking: AdminBooking }>(
    `/api/admin/bookings/${id}/archive`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );
}

export async function deleteAdminBooking(id: string) {
  return apiRequest<{ booking: AdminBooking }>(`/api/admin/bookings/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
}
