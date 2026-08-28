import type {
  PricingCategory,
  RoomPolicy,
} from "../departure/departure.types";

export const roomTypes = [
  "single",
  "double",
  "twin",
  "triple_double",
  "triple_twin",
] as const;

export type RoomType = (typeof roomTypes)[number];
export type TravellerType = "adult" | "child";
export type AllocationBedType =
  | "single_room"
  | "standard_bed"
  | "extra_bed"
  | "without_extra_bed";

export type OccupancyRateType =
  | "ADULT"
  | "SINGLE_OCCUPANCY"
  | "EXTRA_BED"
  | "CHILD_WITHOUT_EXTRA_BED"
  | "FREE_CHILD";

export interface Traveller {
  id: string;
  type: TravellerType;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ageOnDeparture?: number;
}

export interface OccupancyBreakdownItem {
  label: string;
  rateType: OccupancyRateType;
  amount: number;
}

export interface TravellerAllocation {
  travellerId: string;
  travellerType: TravellerType;
  label: string;
  roomId: string;
  roomType: RoomType;
  bedType: AllocationBedType;
  rateType: OccupancyRateType;
  pricingCategory: PricingCategory;
  amount: number;
  price: number;
  ageOnDeparture?: number;
}

export interface RoomAllocation {
  id: string;
  title: string;
  roomType: RoomType;
  bedSummary: string;
  capacity: number;
  travellerIds: string[];
  allocations: TravellerAllocation[];
}

export interface AccommodationOption {
  id: string;
  title: string;
  rooms: RoomAllocation[];
  breakdown: OccupancyBreakdownItem[];
  total: number;
  description?: string;
  totalTravellers: number;
  pricingBreakdown: {
    adultCount: number;
    adultUnitPrice: number;
    extraBedCount: number;
    extraBedUnitPrice: number;
    childWithoutExtraBedCount: number;
    childWithoutExtraBedUnitPrice: number;
    singleOccupancyCount: number;
    singleOccupancyUnitPrice: number;
    freeChildCount: number;
    freeChildUnitPrice: number;
  };
  recommended?: boolean;
  requiresRoommateMatching?: boolean;
  preferredSharingType?: "twin" | "triple";
}

export interface RoomTypeConfig {
  capacity: number;
  title: string;
  description: string;
  bedSummary: string;
}

export const ROOM_TYPES: Record<RoomType, RoomTypeConfig> = {
  single: {
    capacity: 1,
    title: "Single Occupancy",
    description: "One person in one room",
    bedSummary: "1 single bed",
  },
  double: {
    capacity: 2,
    title: "Double Occupancy",
    description: "One double or king bed in a room",
    bedSummary: "1 double/king bed",
  },
  twin: {
    capacity: 2,
    title: "Twin Occupancy",
    description: "Two single beds in a room",
    bedSummary: "2 separate single beds",
  },
  triple_double: {
    capacity: 3,
    title: "Double + Extra Bed",
    description: "One double bed plus one extra bed",
    bedSummary: "1 double bed + 1 extra bed",
  },
  triple_twin: {
    capacity: 3,
    title: "Twin + Extra Bed",
    description: "Two single beds plus one extra bed",
    bedSummary: "2 single beds + 1 extra bed",
  },
};

export const DEFAULT_ROOM_POLICY: RoomPolicy = {
  allowChildBedSharing: true,
  maxChildrenWithoutExtraBedPerRoom: 2,
  allowExtraBed: true,
  allowChildSingleRoom: false,
};
