import type {
  ChildPricingRule,
  PricedDeparture,
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
export type ChildBedType = "standard_bed" | "extra_bed" | "without_extra_bed";
export type AllocationBedType = ChildBedType | "single_room";

export interface Traveller {
  id: string;
  type: TravellerType;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ageOnDeparture?: number;
}

export interface TravellerAllocation {
  travellerId: string;
  roomId: string;
  roomType: RoomType;
  bedType: AllocationBedType;
  pricingCategory: PricingCategory;
  price: number;
  ageOnDeparture?: number;
}

export interface RoomAllocation {
  id: string;
  roomType: RoomType;
  capacity: number;
  travellerIds: string[];
  allocations: TravellerAllocation[];
}

export interface AccommodationOption {
  id: string;
  title: string;
  description?: string;
  rooms: RoomAllocation[];
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
  };
  totalPrice: number;
  recommended?: boolean;
  requiresRoommateMatching?: boolean;
  preferredSharingType?: "twin" | "triple";
}

export interface RoomTypeConfig {
  capacity: number;
  title: string;
  description: string;
}

export const ROOM_TYPES: Record<RoomType, RoomTypeConfig> = {
  single: {
    capacity: 1,
    title: "Single Occupancy",
    description: "One person in one room",
  },
  double: {
    capacity: 2,
    title: "Double Occupancy",
    description: "One double bed in a room",
  },
  twin: {
    capacity: 2,
    title: "Twin Occupancy",
    description: "Two single beds in a room",
  },
  triple_double: {
    capacity: 3,
    title: "Double Room + Extra Bed",
    description: "One double bed plus one extra bed",
  },
  triple_twin: {
    capacity: 3,
    title: "Twin Room + Extra Bed",
    description: "Two single beds plus one extra bed",
  },
};

export const DEFAULT_ROOM_POLICY: RoomPolicy = {
  allowChildBedSharing: true,
  maxChildrenWithoutExtraBedPerRoom: 1,
  allowExtraBed: true,
  allowChildSingleRoom: false,
};

export interface GenerateAccommodationOptionsInput {
  travellers: Traveller[];
  departure: PricedDeparture;
  childPricingRules?: ChildPricingRule[];
  includeSoloTripleSharing?: boolean;
  maxVisibleOptions?: number;
  roomPolicy?: RoomPolicy;
}
