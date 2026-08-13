import type { AccommodationOption, RoomType } from "./accommodation.types";

export const MAX_VISIBLE_OPTIONS = 6;

function roomTypesFromOption(option: AccommodationOption): RoomType[] {
  return option.rooms.map((room) => room.roomType);
}

function hasOnlySingles(roomTypes: RoomType[]) {
  return roomTypes.every((roomType) => roomType === "single");
}

function hasTriple(roomTypes: RoomType[]) {
  return roomTypes.some((roomType) => roomType.startsWith("triple"));
}

function hasSingle(roomTypes: RoomType[]) {
  return roomTypes.some((roomType) => roomType === "single");
}

function hasStandard(roomTypes: RoomType[]) {
  return roomTypes.some((roomType) => roomType === "double" || roomType === "twin");
}

function countSingles(roomTypes: RoomType[]) {
  return roomTypes.filter((roomType) => roomType === "single").length;
}

function getOptionRank(option: AccommodationOption) {
  if (option.recommended) {
    return 0;
  }

  const roomTypes = roomTypesFromOption(option);

  if (hasOnlySingles(roomTypes)) {
    return 90;
  }

  if (
    !hasTriple(roomTypes) &&
    hasStandard(roomTypes) &&
    countSingles(roomTypes) <= 1
  ) {
    return 10;
  }

  if (hasTriple(roomTypes) && hasStandard(roomTypes) && !hasSingle(roomTypes)) {
    return 20;
  }

  if (hasTriple(roomTypes) && hasStandard(roomTypes) && countSingles(roomTypes) <= 1) {
    return 25;
  }

  if (!hasTriple(roomTypes) && hasStandard(roomTypes) && hasSingle(roomTypes)) {
    return 30;
  }

  if (hasTriple(roomTypes) && hasSingle(roomTypes)) {
    return 40;
  }

  return 60;
}

export function rankAccommodationOptions(options: AccommodationOption[]) {
  return [...options].sort((left, right) => {
    const rankDifference = getOptionRank(left) - getOptionRank(right);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const roomDifference = left.rooms.length - right.rooms.length;

    if (roomDifference !== 0) {
      return roomDifference;
    }

    return left.totalPrice - right.totalPrice;
  });
}
