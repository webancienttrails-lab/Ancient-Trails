import type { Request, Response } from "express";

import {
  Booking,
  type BookingDocument,
} from "../models/booking.model";
import {
  Destination,
  type DestinationDocument,
} from "../models/destination.model";
import { Enquiry, EnquiryStatus } from "../models/enquiry.model";
import {
  TourDeparture,
  type TourDepartureDocument,
} from "../models/tourDeparture.model";
import { Tour, type TourDocument } from "../models/tour.model";
import { User, UserRole } from "../models/user.model";

type TrendMetric = {
  current: number;
  previous: number;
  trend: string;
  value: number;
};

type BookingStatusKey =
  | "cancelled"
  | "completed"
  | "confirmed"
  | "pending"
  | "refunded";

type EnquiryStatusKey = "closed" | "inProgress" | "new" | "replied";

type ChartBucket = {
  current: number;
  label: string;
  previous: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function getMonthEnd(date: Date) {
  return addMonths(startOfMonth(date), 1);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "Coming Soon";
  }

  return dateFormatter.format(value).replace(",", "");
}

function formatMonth(value: Date) {
  return monthFormatter.format(value);
}

function formatTrendPercentage(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  const roundedValue = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));

  return `${roundedValue}%`;
}

function createTrend({
  current,
  previous,
  previousMonth,
  value,
}: {
  current: number;
  previous: number;
  previousMonth: Date;
  value: number;
}): TrendMetric {
  const percentage = formatTrendPercentage(current, previous);
  const sign = percentage >= 0 ? "+" : "";

  return {
    current,
    previous,
    trend: `${sign}${formatPercent(percentage)} from ${formatMonth(previousMonth)}`,
    value,
  };
}

function getBookingAmount(booking: BookingDocument) {
  return (
    booking.amountPaid ||
    booking.grandTotal ||
    booking.depositAmount ||
    booking.subtotal ||
    0
  );
}

function getLeadGuestName(booking: BookingDocument) {
  const leadGuest = booking.guestDetails[0];
  const name = [leadGuest?.firstName, leadGuest?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || leadGuest?.email || "Traveller";
}

function getInitials(name: string) {
  const nameParts = name.split(/\s+/).filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || "AT";
}

function getBookingStatusKey(
  booking: BookingDocument,
  departure: TourDepartureDocument | undefined,
  today: Date
): BookingStatusKey {
  if (booking.paymentStatus === "refunded") {
    return "refunded";
  }

  if (booking.paymentStatus === "failed") {
    return "cancelled";
  }

  if (booking.paymentStatus === "pending") {
    return "pending";
  }

  if (
    booking.paymentStatus === "paid" &&
    departure?.returnDate &&
    departure.returnDate.getTime() < today.getTime()
  ) {
    return "completed";
  }

  return "confirmed";
}

function getEnquiryStatusKey(status: EnquiryStatus): EnquiryStatusKey {
  switch (status) {
    case EnquiryStatus.CLOSED:
      return "closed";
    case EnquiryStatus.IN_PROGRESS:
      return "inProgress";
    case EnquiryStatus.REPLIED:
      return "replied";
    case EnquiryStatus.NEW:
      return "new";
  }
}

function getTourImage(tour: TourDocument | undefined) {
  return (
    tour?.thumbnailImage ||
    tour?.bannerImage ||
    tour?.galleryImages?.[0] ||
    ""
  );
}

function getDestinationImage(destination: DestinationDocument | undefined) {
  return (
    destination?.bannerImage ||
    destination?.galleryImages?.[0] ||
    destination?.photos?.[0] ||
    ""
  );
}

function createMonthBuckets(monthStart: Date) {
  const monthEnd = getMonthEnd(monthStart);
  const buckets: Array<{ end: Date; label: string; start: Date }> = [];

  for (let day = 1; day <= 29; day += 7) {
    const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);

    if (start >= monthEnd) {
      break;
    }

    const nextBucketStart = addDays(start, 7);
    const end = nextBucketStart < monthEnd ? nextBucketStart : monthEnd;

    buckets.push({
      end,
      label: shortDateFormatter.format(start),
      start,
    });
  }

  return buckets;
}

function countBookingsByBuckets(
  bookings: BookingDocument[],
  buckets: Array<{ end: Date; label: string; start: Date }>
) {
  return buckets.map((bucket) =>
    bookings.filter(
      (booking) =>
        booking.createdAt >= bucket.start && booking.createdAt < bucket.end
    ).length
  );
}

function createBookingChart(
  bookings: BookingDocument[],
  currentMonthStart: Date,
  previousMonthStart: Date
): ChartBucket[] {
  const currentBuckets = createMonthBuckets(currentMonthStart);
  const previousBuckets = createMonthBuckets(previousMonthStart);
  const currentValues = countBookingsByBuckets(bookings, currentBuckets);
  const previousValues = countBookingsByBuckets(bookings, previousBuckets);

  return currentBuckets.map((bucket, index) => ({
    current: currentValues[index] || 0,
    label: bucket.label,
    previous: previousValues[index] || 0,
  }));
}

function createStatusItems(counts: Record<BookingStatusKey, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (Object.keys(counts) as BookingStatusKey[]).map((key) => ({
    key,
    percentage: total > 0 ? (counts[key] / total) * 100 : 0,
    value: counts[key],
  }));
}

function createEnquiryItems(counts: Record<EnquiryStatusKey, number>) {
  return (Object.keys(counts) as EnquiryStatusKey[]).map((key) => ({
    key,
    value: counts[key],
  }));
}

export async function getAdminDashboardSummary(
  _request: Request,
  response: Response
): Promise<void> {
  const today = startOfDay(new Date());
  const currentMonthStart = startOfMonth(today);
  const nextMonthStart = addMonths(currentMonthStart, 1);
  const previousMonthStart = addMonths(currentMonthStart, -1);

  const [
    totalBookings,
    totalDestinations,
    totalUsers,
    totalEnquiries,
    upcomingTourCount,
    currentMonthBookings,
    previousMonthBookings,
    currentMonthDepartures,
    previousMonthDepartures,
    currentMonthDestinations,
    previousMonthDestinations,
    currentMonthUsers,
    previousMonthUsers,
    currentMonthEnquiries,
    previousMonthEnquiries,
    bookings,
    recentBookings,
    tours,
    departures,
    destinations,
    enquiries,
    upcomingDepartures,
  ] = await Promise.all([
    Booking.countDocuments({}),
    Destination.countDocuments({}),
    User.countDocuments({ roles: UserRole.TRAVELLER }),
    Enquiry.countDocuments({}),
    TourDeparture.countDocuments({
      departureDate: { $gte: today },
      status: "scheduled",
    }),
    Booking.countDocuments({
      createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
    }),
    Booking.countDocuments({
      createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
    }),
    TourDeparture.countDocuments({
      departureDate: { $gte: currentMonthStart, $lt: nextMonthStart },
      status: "scheduled",
    }),
    TourDeparture.countDocuments({
      departureDate: { $gte: previousMonthStart, $lt: currentMonthStart },
      status: "scheduled",
    }),
    Destination.countDocuments({
      createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
    }),
    Destination.countDocuments({
      createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
    }),
    User.countDocuments({
      createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
      roles: UserRole.TRAVELLER,
    }),
    User.countDocuments({
      createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
      roles: UserRole.TRAVELLER,
    }),
    Enquiry.countDocuments({
      createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
    }),
    Enquiry.countDocuments({
      createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
    }),
    Booking.find({}).sort({ createdAt: -1 }),
    Booking.find({}).sort({ createdAt: -1 }).limit(5),
    Tour.find({}),
    TourDeparture.find({}),
    Destination.find({}),
    Enquiry.find({}),
    TourDeparture.find({
      departureDate: { $gte: today },
      status: "scheduled",
    })
      .sort({ departureDate: 1 })
      .limit(4),
  ]);

  const tourById = new Map(tours.map((tour) => [tour.tourId, tour]));
  const departureById = new Map(
    departures.map((departure) => [departure.departureId, departure])
  );
  const destinationById = new Map(
    destinations.map((destination) => [destination.destinationId, destination])
  );
  const departureBookingCounts = new Map<string, number>();
  const destinationBookingCounts = new Map<string, number>();
  const bookingStatusCounts: Record<BookingStatusKey, number> = {
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    completed: 0,
    refunded: 0,
  };
  const enquiryStatusCounts: Record<EnquiryStatusKey, number> = {
    new: 0,
    inProgress: 0,
    replied: 0,
    closed: 0,
  };

  bookings.forEach((booking) => {
    const departure = booking.departureId
      ? departureById.get(booking.departureId)
      : undefined;
    const tour = tourById.get(booking.tourId);
    const destinationId = departure?.destinationId || tour?.destinationId || "";
    const statusKey = getBookingStatusKey(booking, departure, today);

    bookingStatusCounts[statusKey] += 1;

    if (booking.departureId) {
      departureBookingCounts.set(
        booking.departureId,
        (departureBookingCounts.get(booking.departureId) || 0) + 1
      );
    }

    if (destinationId) {
      destinationBookingCounts.set(
        destinationId,
        (destinationBookingCounts.get(destinationId) || 0) + 1
      );
    }
  });

  enquiries.forEach((enquiry) => {
    enquiryStatusCounts[getEnquiryStatusKey(enquiry.status)] += 1;
  });

  const topDestinations = Array.from(destinationBookingCounts.entries())
    .map(([destinationId, count]) => {
      const destination = destinationById.get(destinationId);

      return {
        bookings: count,
        destinationId,
        image: getDestinationImage(destination),
        name: destination?.destinationName || destinationId,
      };
    })
    .sort((left, right) => right.bookings - left.bookings)
    .slice(0, 5);

  response.status(200).json({
    success: true,
    message: "Dashboard summary fetched successfully",
    data: {
      bookingChart: createBookingChart(
        bookings,
        currentMonthStart,
        previousMonthStart
      ),
      bookingStatus: createStatusItems(bookingStatusCounts),
      enquiryStats: createEnquiryItems(enquiryStatusCounts),
      metrics: {
        totalBookings: createTrend({
          current: currentMonthBookings,
          previous: previousMonthBookings,
          previousMonth: previousMonthStart,
          value: totalBookings,
        }),
        totalDestinations: createTrend({
          current: currentMonthDestinations,
          previous: previousMonthDestinations,
          previousMonth: previousMonthStart,
          value: totalDestinations,
        }),
        totalEnquiries: createTrend({
          current: currentMonthEnquiries,
          previous: previousMonthEnquiries,
          previousMonth: previousMonthStart,
          value: totalEnquiries,
        }),
        totalUsers: createTrend({
          current: currentMonthUsers,
          previous: previousMonthUsers,
          previousMonth: previousMonthStart,
          value: totalUsers,
        }),
        upcomingTours: createTrend({
          current: currentMonthDepartures,
          previous: previousMonthDepartures,
          previousMonth: previousMonthStart,
          value: upcomingTourCount,
        }),
      },
      notificationCount:
        enquiryStatusCounts.new + bookingStatusCounts.pending,
      recentBookings: recentBookings.map((booking) => {
        const name = getLeadGuestName(booking);
        const departure = booking.departureId
          ? departureById.get(booking.departureId)
          : undefined;
        const tour = tourById.get(booking.tourId);

        return {
          amount: getBookingAmount(booking),
          date: formatDate(booking.createdAt),
          id: booking._id.toString(),
          initials: getInitials(name),
          name,
          status: getBookingStatusKey(booking, departure, today),
          tour: tour?.tourName || booking.tourId,
        };
      }),
      topDestinations,
      upcomingTours: upcomingDepartures.map((departure) => {
        const tour = tourById.get(departure.tourId);
        const destination = destinationById.get(departure.destinationId);

        return {
          bookings: departureBookingCounts.get(departure.departureId) || 0,
          date: formatDate(departure.departureDate),
          departureId: departure.departureId,
          image: getTourImage(tour) || getDestinationImage(destination),
          title: tour?.tourName || departure.tourId,
          tourId: departure.tourId,
        };
      }),
    },
  });
}
