import type { PricedDeparture } from "./departure.types";

export type DepartureValidationResult = {
  isValid: boolean;
  errors: string[];
};

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateBalanceDueDate(
  departureDate: Date | string | null,
  balanceDueDaysBefore: number
): Date | null {
  const date = toDate(departureDate);

  if (!date) {
    return null;
  }

  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() - Math.max(0, balanceDueDaysBefore));

  return dueDate;
}

export function validateDepartureSchedule(
  departure: Pick<PricedDeparture, "departureDate" | "returnDate" | "status">
): DepartureValidationResult {
  const errors: string[] = [];
  const departureDate = toDate(departure.departureDate);
  const returnDate = toDate(departure.returnDate);

  if (departure.status === "coming_soon") {
    return {
      isValid: true,
      errors,
    };
  }

  if (!departureDate || !returnDate) {
    errors.push("Scheduled departures require departure and return dates.");
  } else if (returnDate.getTime() <= departureDate.getTime()) {
    errors.push("Return date must be after departure date.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateDepartureForBooking(
  departure: PricedDeparture,
  requestedTravellers: number,
  today = new Date()
): DepartureValidationResult {
  const errors: string[] = [];
  const bookingDeadline = toDate(departure.bookingDeadline);

  if (requestedTravellers <= 0) {
    errors.push("At least one traveller is required.");
  }

  if (requestedTravellers > 25) {
    errors.push("A maximum of 25 travellers can be booked at once.");
  }

  if (departure.status === "coming_soon") {
    errors.push("This departure is coming soon and cannot be booked yet.");
  }

  if (departure.status === "closed") {
    errors.push("Bookings are closed for this departure.");
  }

  if (departure.status === "cancelled") {
    errors.push("This departure has been cancelled.");
  }

  if (departure.status === "scheduled") {
    errors.push(...validateDepartureSchedule(departure).errors);
  }

  if (
    bookingDeadline &&
    new Date(today).setHours(0, 0, 0, 0) >
      new Date(bookingDeadline).setHours(0, 0, 0, 0)
  ) {
    errors.push("Bookings are closed for this departure.");
  }

  if (requestedTravellers > departure.seatsAvailable) {
    errors.push("Requested travellers exceed available seats.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
