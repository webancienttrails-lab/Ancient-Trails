import { ApiError, apiRequest } from "@/lib/api";
import { getTravellerSession } from "@/lib/auth";

export type BookingGuestDetailsPayload = {
  title: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  panNumber?: string;
};

export type BookingTravellerPayload = {
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
  panNumber?: string;
  ageOnDeparture?: number;
};

export type BookingPayload = {
  tourId: string;
  departureId?: string;
  selectedAccommodationOptionId?: string;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: Array<{
    age: number;
  }>;
  guestDetails: BookingGuestDetailsPayload[];
  travellers: BookingTravellerPayload[];
  accommodationDetails: {
    singleOccupancyOneRoom: number;
    singleOccupancyTwoRooms: number;
    doubleOccupancy: number;
    twinOccupancy: number;
    tripleOccupancy: number;
  };
  gstPercentage: number;
};

export type BookingConfirmation = {
  id: string;
  tourId: string;
  departureId: string;
  selectedAccommodationOptionId: string;
  totalGuest: number;
  adultCount: number;
  childCount: number;
  childDetails: Array<{
    age: number;
  }>;
  guestDetails: BookingGuestDetailsPayload[];
  travellers: BookingTravellerPayload[];
  accommodationDetails: BookingPayload["accommodationDetails"];
  pricingSnapshot?: {
    departureDate?: string | null;
    returnDate?: string | null;
    accommodation?: {
      optionTitle?: string;
      rooms?: Array<{
        id: string;
        title: string;
        bedSummary: string;
        allocations?: Array<{
          label: string;
          price: number;
        }>;
      }>;
    };
  };
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  grandTotal?: number;
  depositAmount?: number;
  balanceAmount?: number;
  balanceDueDate?: string | null;
  paymentStatus?: string;
  paymentProvider?: string;
  paymentOrderId?: string;
  paymentId?: string;
  paymentCurrency?: string;
  amountPaid?: number;
  paymentCapturedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingPaymentSession = {
  id: string;
  orderId: string;
  amount: number;
  amountRupees: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "expired";
};

export type RazorpayCheckoutDetails = {
  key: string;
  orderId: string;
  amount: number;
  amountRupees: number;
  currency: string;
  name: string;
  description: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
};

export type BookingPaymentOrder = {
  checkout: RazorpayCheckoutDetails;
  paymentSession: BookingPaymentSession;
};

export type BookingPaymentVerification = {
  booking: BookingConfirmation;
  confirmationToken: string;
};

export type BookingBalancePaymentVerification = {
  booking: BookingConfirmation;
  paymentSession: BookingPaymentSession;
};

export type BookingConfirmationData = {
  booking: BookingConfirmation;
  departure: {
    departureId: string;
    departureDate: string | null;
    returnDate: string | null;
    seatsAvailable: number;
  } | null;
  expert: {
    expertId: string;
    fullName: string;
    image: string;
    expertiseTags: string[];
  } | null;
  tour: {
    tourId: string;
    tourName: string;
    durationDn: string;
    destinationId: string;
    destinationIds: string[];
    category: string;
    expertId: string;
    thumbnailImage?: string;
    bannerImage: string;
    galleryImages: string[];
  } | null;
};

export function createBookingPaymentOrder(payload: BookingPayload) {
  return apiRequest<BookingPaymentOrder>("/api/bookings/payment/order", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelBookingPaymentOrder(orderId: string) {
  return apiRequest<{ paymentSession: BookingPaymentSession | null }>(
    "/api/bookings/payment/cancel",
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }
  );
}

export function verifyBookingPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiRequest<BookingPaymentVerification>("/api/bookings/payment/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getTravellerHeaders(): HeadersInit {
  const session = getTravellerSession();

  if (!session?.token) {
    throw new ApiError(401, "Please sign in to continue");
  }

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export function createBookingBalancePaymentOrder(bookingId: string) {
  return apiRequest<BookingPaymentOrder>(
    `/api/bookings/${encodeURIComponent(bookingId)}/balance-payment/order`,
    {
      headers: getTravellerHeaders(),
      method: "POST",
    }
  );
}

export function verifyBookingBalancePayment(
  bookingId: string,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }
) {
  return apiRequest<BookingBalancePaymentVerification>(
    `/api/bookings/${encodeURIComponent(bookingId)}/balance-payment/verify`,
    {
      body: JSON.stringify(payload),
      headers: getTravellerHeaders(),
      method: "POST",
    }
  );
}

export function getBookingConfirmation(bookingId: string, token: string) {
  return apiRequest<BookingConfirmationData>(
    `/api/bookings/${encodeURIComponent(
      bookingId
    )}/confirmation?token=${encodeURIComponent(token)}`,
    {
      cache: "no-store",
    }
  );
}
