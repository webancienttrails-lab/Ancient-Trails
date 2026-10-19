// Airfare entered by admin is the final supplier amount, inclusive of applicable taxes.
// Tour GST/TCS must never be reapplied to this amount.
export const AIRFARE_NOTE = "Note: Air-flight charges are not included in the above amount and will be added separately based on actual airline fares at the time of booking. Any additional airfare will be reflected in the outstanding balance or collected through a separate payment link.";

export function isAirfareExcluded(tour?: { inclusions?: string[]; exclusions?: string[] } | null) {
  const flight = /\b(flights?|air[ -]?fare|air[ -]?(?:flight|tickets?|travel))\b/i;
  const negative = /\b(not included|excluded|excluding|extra|additional|separate)\b/i;
  if ((tour?.inclusions || []).some(item => flight.test(item) && !negative.test(item))) return false;
  return (tour?.exclusions || []).some(item => flight.test(item))
    || (tour?.inclusions || []).some(item => flight.test(item) && negative.test(item));
}

