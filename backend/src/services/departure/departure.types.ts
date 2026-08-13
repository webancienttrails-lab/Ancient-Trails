export const depositTypes = ["fixed", "percentage"] as const;
export const depositAppliesToValues = ["per_person", "per_booking"] as const;
export const departureStatuses = [
  "scheduled",
  "coming_soon",
  "closed",
  "cancelled",
] as const;
export const pricingCategories = [
  "adult",
  "extra_bed",
  "child_without_extra_bed",
  "single_occupancy",
] as const;

export type DepositType = (typeof depositTypes)[number];
export type DepositAppliesTo = (typeof depositAppliesToValues)[number];
export type DepartureStatus = (typeof departureStatuses)[number];
export type PricingCategory = (typeof pricingCategories)[number];

export type ChildPricingRule = {
  minAge: number;
  maxAge: number;
  allowExtraBed: boolean;
  allowWithoutExtraBed: boolean;
};

export type RoomPolicy = {
  allowChildBedSharing: boolean;
  maxChildrenWithoutExtraBedPerRoom: number;
  allowExtraBed: boolean;
  allowChildSingleRoom: boolean;
};

export type PricedDeparture = {
  departureId: string;
  tourId: string;
  destinationId: string;
  departureDate: Date | string | null;
  returnDate: Date | string | null;
  seatsAvailable: number;
  priceAdult: number;
  priceExtraBed: number;
  priceChildWithoutExtraBed: number;
  singleOccupancy: number;
  depositType: DepositType;
  depositValue: number;
  depositAppliesTo: DepositAppliesTo;
  balanceDueDaysBefore: number;
  earlyBirdOffer: string | null;
  bookingDeadline: Date | string | null;
  status: DepartureStatus;
  childPricingRules: ChildPricingRule[];
  roomPolicy?: RoomPolicy;
};
