import { apiBaseUrl, apiRequest, ApiError } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-auth";

export type DashboardMetric = {
  current: number;
  previous: number;
  trend: string;
  value: number;
};

export type DashboardMetricKey =
  | "totalBookings"
  | "totalDestinations"
  | "totalEnquiries"
  | "totalUsers"
  | "upcomingTours";

export type DashboardBookingStatusKey =
  | "cancelled"
  | "completed"
  | "confirmed"
  | "pending"
  | "refunded";

export type DashboardEnquiryStatusKey =
  | "closed"
  | "inProgress"
  | "new"
  | "replied";

export type DashboardChartBucket = {
  current: number;
  label: string;
  previous: number;
};

export type DashboardStatusItem = {
  key: DashboardBookingStatusKey;
  percentage: number;
  value: number;
};

export type DashboardEnquiryItem = {
  key: DashboardEnquiryStatusKey;
  value: number;
};

export type DashboardRecentBooking = {
  amount: number;
  date: string;
  id: string;
  initials: string;
  name: string;
  status: DashboardBookingStatusKey;
  tour: string;
};

export type DashboardUpcomingTour = {
  bookings: number;
  date: string;
  departureId: string;
  image: string;
  title: string;
  tourId: string;
};

export type DashboardTopDestination = {
  bookings: number;
  destinationId: string;
  image: string;
  name: string;
};

export type AdminDashboardSummary = {
  bookingChart: DashboardChartBucket[];
  bookingStatus: DashboardStatusItem[];
  enquiryStats: DashboardEnquiryItem[];
  metrics: Record<DashboardMetricKey, DashboardMetric>;
  notificationCount: number;
  recentBookings: DashboardRecentBooking[];
  topDestinations: DashboardTopDestination[];
  upcomingTours: DashboardUpcomingTour[];
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

export function getDashboardMediaUrl(source: string): string {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (trimmedSource.startsWith("/uploads/")) {
    return `${apiBaseUrl}${trimmedSource}`;
  }

  return trimmedSource;
}

export async function getAdminDashboardSummary() {
  return apiRequest<AdminDashboardSummary>("/api/admin/dashboard", {
    headers: getAdminHeaders(),
  });
}
