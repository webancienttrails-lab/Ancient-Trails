export const reportRanges = [30, 90, 180, 365] as const;
export type ReportDays = typeof reportRanges[number];

export type ReportBooking = {
  tourId: string; departureId?: string; createdAt: Date;
  bookingStatus?: string; paymentStatus?: string; paymentCurrency?: string;
  amountPaid?: number; totalGuest: number;
};
export type ReportTour = { tourId: string; tourName: string; category: string; tourType: string };
export type ReportDeparture = { departureId: string; tourId: string; totalSeats?: number; seatsAvailable: number };
export type ReportEnquiry = { createdAt: Date; status: string };

const day = 86_400_000;
const ist = 330 * 60_000;
const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function getReportPeriod(days: ReportDays, now = new Date()) {
  const local = new Date(now.getTime() + ist);
  const end = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - ist);
  const start = new Date(end.getTime() - days * day);
  return { start, end, previousStart: new Date(start.getTime() - days * day) };
}

function amount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value || 0) : 0;
}
function active(booking: ReportBooking) {
  return !["draft", "expired", "cancelled"].includes(booking.bookingStatus || "") &&
    !["failed", "refunded"].includes(booking.paymentStatus || "");
}
function revenue(booking: ReportBooking) {
  return booking.paymentStatus === "paid" && (!booking.paymentCurrency || booking.paymentCurrency === "INR")
    ? amount(booking.amountPaid) : 0;
}
function sumRevenue(bookings: ReportBooking[]) {
  return Math.round(bookings.reduce((sum, booking) => sum + revenue(booking), 0) * 100) / 100;
}
function metric(current: number, previous: number) {
  return { value: current, previous, change: previous > 0 ? (current - previous) / previous * 100 : current > 0 ? null : 0 };
}

export function buildAdminReport(input: {
  days: ReportDays; now?: Date; bookings: ReportBooking[]; tours: ReportTour[];
  departures: ReportDeparture[]; enquiries: ReportEnquiry[];
}) {
  const now = input.now || new Date();
  const { start, end, previousStart } = getReportPeriod(input.days, now);
  const within = (date: Date, from: Date, until: Date) => date >= from && date < until;
  const eligible = input.bookings.filter(active);
  const current = eligible.filter(booking => within(booking.createdAt, start, end));
  const previous = eligible.filter(booking => within(booking.createdAt, previousStart, start));
  const enquiries = input.enquiries.filter(enquiry => within(enquiry.createdAt, start, end));
  const priorEnquiries = input.enquiries.filter(enquiry => within(enquiry.createdAt, previousStart, start));
  const statuses = ["New", "In Progress", "Replied", "Closed"];
  const pipeline = statuses.map(status => ({ status, count: enquiries.filter(enquiry => enquiry.status === status).length }));
  const tourMap = new Map(input.tours.map(tour => [tour.tourId, tour]));
  const category = (tourId: string) => {
    const tour = tourMap.get(tourId);
    return tour?.category?.trim() || tour?.tourType?.trim() || "Uncategorised";
  };
  const categories = new Map<string, number>();
  for (const booking of current) {
    const paid = revenue(booking);
    if (paid > 0) categories.set(category(booking.tourId), (categories.get(category(booking.tourId)) || 0) + paid);
  }
  const totalRevenue = sumRevenue(current);
  const topTours = [...new Set(current.map(booking => booking.tourId))].map(tourId => {
    const bookings = current.filter(booking => booking.tourId === tourId);
    const ids = new Set(bookings.map(booking => booking.departureId).filter(Boolean));
    const departures = input.departures.filter(departure => departure.tourId === tourId && ids.has(departure.departureId) && (departure.totalSeats || 0) > 0);
    const seats = departures.reduce((sum, departure) => sum + (departure.totalSeats || 0), 0);
    const occupied = departures.reduce((sum, departure) => sum + Math.max(0, (departure.totalSeats || 0) - Math.max(0, departure.seatsAvailable)), 0);
    return {
      tourId, name: tourMap.get(tourId)?.tourName || tourId, category: category(tourId),
      bookings: bookings.length, revenue: sumRevenue(bookings),
      fillRate: seats ? Math.min(100, occupied / seats * 100) : null,
    };
  }).sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue || a.name.localeCompare(b.name)).slice(0, 6);

  // Use real booking dates, rather than distributing totals across arbitrary points.
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  if (input.days < 180) {
    for (let index = 0; index < 7; index++) {
      const from = new Date(start.getTime() + Math.floor(index * input.days / 7) * day);
      const until = new Date(start.getTime() + Math.floor((index + 1) * input.days / 7) * day);
      buckets.push({ start: from, end: until, label: dateLabel.format(from) });
    }
  } else {
    const local = new Date(start.getTime() + ist);
    let from = start;
    let month = local.getUTCMonth();
    while (from < end) {
      const next = new Date(Date.UTC(local.getUTCFullYear(), ++month, 1) - ist);
      const until = next < end ? next : end;
      buckets.push({ start: from, end: until, label: new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).format(from) });
      from = until;
    }
  }
  return {
    days: input.days, generatedAt: now.toISOString(), currency: "INR" as const,
    period: { start: start.toISOString(), end: end.toISOString(), previousStart: previousStart.toISOString() },
    metrics: {
      revenue: metric(totalRevenue, sumRevenue(previous)),
      bookings: metric(current.length, previous.length),
      openEnquiries: metric(enquiries.filter(enquiry => enquiry.status !== "Closed").length, priorEnquiries.filter(enquiry => enquiry.status !== "Closed").length),
      travellers: metric(current.reduce((sum, booking) => sum + amount(booking.totalGuest), 0), previous.reduce((sum, booking) => sum + amount(booking.totalGuest), 0)),
    },
    trend: buckets.map(bucket => {
      const bookings = current.filter(booking => within(booking.createdAt, bucket.start, bucket.end));
      return { label: bucket.label, start: bucket.start.toISOString(), end: bucket.end.toISOString(), bookings: bookings.length, revenue: sumRevenue(bookings) };
    }),
    categories: [...categories].map(([name, value]) => ({ name, revenue: Math.round(value * 100) / 100, percentage: totalRevenue > 0 ? value / totalRevenue * 100 : 0 })).sort((a, b) => b.revenue - a.revenue),
    topTours, pipeline, enquiryTotal: enquiries.length,
    closedPercentage: enquiries.length ? (pipeline.find(item => item.status === "Closed")?.count || 0) / enquiries.length * 100 : 0,
    excludedCurrencyBookings: current.filter(booking => booking.paymentStatus === "paid" && booking.paymentCurrency && booking.paymentCurrency !== "INR").length,
  };
}
