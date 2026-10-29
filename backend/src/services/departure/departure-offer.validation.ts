import type { PricedDeparture } from "./departure.types";

export type DepartureIssue = { path: string; message: string };

// Dates in this product are calendar days in India, rather than elapsed 24-hour periods.
export function travelDay(value: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function validateDepartureOffer(
  departure: Pick<PricedDeparture, "departureDate" | "returnDate" | "bookingDeadline" | "priceAdult" | "singleOccupancy" | "depositType" | "depositValue" | "status">,
  _durationDn = "",
  now = new Date()
): DepartureIssue[] {
  const issues: DepartureIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const start = travelDay(departure.departureDate);
  const end = travelDay(departure.returnDate);
  const deadline = travelDay(departure.bookingDeadline);

  if (departure.status !== "coming_soon") {
    if (!start) add("departureDate", "A valid departure date is required.");
    if (!end || (start && end < start)) add("returnDate", "Return date must be on or after departure date.");
    if (departure.bookingDeadline && (!deadline || !start || deadline >= start)) {
      add("bookingDeadline", "Booking deadline must be before the departure date.");
    }
  }
  if (departure.status === "scheduled" && start && start < travelDay(now)) {
    add("departureDate", "A past departure cannot be scheduled for booking.");
  }
  if (departure.status === "scheduled" && departure.priceAdult <= 0) {
    add("priceAdult", "Adult price must be greater than zero for a scheduled departure.");
  }
  if (departure.depositType === "percentage") {
    if (departure.depositValue > 100) add("depositValue", "Percentage deposit cannot exceed 100%.");
  } else if (departure.depositValue > departure.priceAdult) {
    add("depositValue", "Fixed deposit cannot exceed the adult price.");
  }
  return issues;
}
