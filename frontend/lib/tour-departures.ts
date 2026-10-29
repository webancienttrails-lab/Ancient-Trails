import type { PublicTourDeparture } from "./home-travel";

function seatCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value)) : 0;
}

export function getDepartureTotalSeats(departure: PublicTourDeparture) {
  return typeof departure.totalSeats === "number" && Number.isFinite(departure.totalSeats)
    ? seatCount(departure.totalSeats)
    : seatCount(departure.seatsAvailable) + seatCount(departure.filledSeats);
}

export function getDepartureFilledSeats(departure: PublicTourDeparture) {
  const total = getDepartureTotalSeats(departure);
  return Math.min(total, typeof departure.filledSeats === "number" && Number.isFinite(departure.filledSeats)
    ? seatCount(departure.filledSeats)
    : Math.max(0, total - seatCount(departure.seatsAvailable)));
}

export function getDepartureSeatsLeft(departure: PublicTourDeparture) {
  return Math.max(0, getDepartureTotalSeats(departure) - getDepartureFilledSeats(departure));
}

// Use the site's calendar day, independent of the visitor's timezone.
function getTravelDay(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function getBookableDepartures(
  departures: PublicTourDeparture[],
  now = new Date()
) {
  const today = getTravelDay(now);
  return departures.filter(departure => {
    if (departure.validationErrors?.length) return false;
    if (departure.status !== "scheduled" || getDepartureSeatsLeft(departure) <= 0) return false;
    if (!departure.departureId?.trim() || departure.id?.startsWith("fallback-departure-")) return false;
    if (!Number.isFinite(departure.priceAdult) || departure.priceAdult <= 0) return false;
    const departureDay = departure.departureDate ? getTravelDay(departure.departureDate) : "";
    if (!departureDay || departureDay < today) return false;
    const returnTime = departure.returnDate ? Date.parse(departure.returnDate) : NaN;
    if (!Number.isFinite(returnTime) || returnTime < Date.parse(departure.departureDate!)) return false;
    if (departure.bookingDeadline) {
      const deadline = getTravelDay(departure.bookingDeadline);
      if (!deadline || deadline < today) return false;
    }
    return true;
  }).sort((left, right) =>
    Date.parse(left.departureDate!) - Date.parse(right.departureDate!)
  );
}

export function getNextBookableDeparture(
  departures: PublicTourDeparture[],
  now = new Date()
) {
  return getBookableDepartures(departures, now)[0];
}
