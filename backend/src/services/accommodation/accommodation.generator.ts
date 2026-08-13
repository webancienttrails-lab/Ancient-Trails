import {
  allocateChildrenWithoutExtraBed,
  allocatePlannedRooms,
  allocateTravellersToRooms,
  createAccommodationDescription,
  createAccommodationTitle,
  type PlannedRoomAllocation,
} from "./accommodation.allocator";
import {
  calculateAccommodationTotal,
  createPricingBreakdown,
} from "./accommodation.pricing";
import {
  MAX_VISIBLE_OPTIONS,
  rankAccommodationOptions,
} from "./accommodation.ranking";
import {
  ROOM_TYPES,
  type AccommodationOption,
  type GenerateAccommodationOptionsInput,
  type RoomAllocation,
  type RoomType,
  type Traveller,
} from "./accommodation.types";
import {
  calculateAgeOnDate,
  findChildPricingRule,
  normalizeRoomPolicy,
  validateAccommodationOption,
} from "./accommodation.validation";

const roomCombinationTypes: RoomType[] = [
  "single",
  "double",
  "twin",
  "triple_double",
  "triple_twin",
];

function canonicalRoomCombinationKey(roomTypeList: RoomType[]): string {
  return [...roomTypeList].sort().join("|");
}

function getRoomCount(roomTypeList: RoomType[], matcher: (roomType: RoomType) => boolean) {
  return roomTypeList.filter(matcher).length;
}

function createPracticalTitle(roomTypeList: RoomType[]) {
  if (roomTypeList.length === 1) {
    return ROOM_TYPES[roomTypeList[0]].title;
  }

  return createAccommodationTitle(roomTypeList)
    .replace(/Double Occupancy/g, "Double Room")
    .replace(/Twin Occupancy/g, "Twin Room")
    .replace(/Triple Occupancy/g, "Triple Room")
    .replace(/Single Occupancy/g, "Single Room");
}

function createPricedOption({
  departure,
  description,
  idPrefix,
  recommended,
  rooms,
  title,
  travellers,
}: {
  departure: GenerateAccommodationOptionsInput["departure"];
  description?: string;
  idPrefix?: string;
  recommended?: boolean;
  rooms: RoomAllocation[];
  title?: string;
  travellers: Traveller[];
}): AccommodationOption {
  const allocations = rooms.flatMap((room) => room.allocations);
  const roomTypeList = rooms.map((room) => room.roomType);

  return {
    id: `${idPrefix || "option"}-${canonicalRoomCombinationKey(roomTypeList)}`,
    title: title || createPracticalTitle(roomTypeList),
    description: description || createAccommodationDescription(roomTypeList),
    rooms,
    totalTravellers: travellers.length,
    pricingBreakdown: createPricingBreakdown(allocations, departure),
    totalPrice: calculateAccommodationTotal(allocations),
    recommended,
  };
}

function assertTravellerCount(travellers: Traveller[]) {
  if (travellers.length === 0) {
    throw new Error("At least one traveller is required.");
  }

  if (travellers.length > 25) {
    throw new Error("A maximum of 25 travellers can be booked at once.");
  }

  const uniqueIds = new Set(travellers.map((traveller) => traveller.id));

  if (uniqueIds.size !== travellers.length) {
    throw new Error("Traveller IDs must be unique.");
  }
}

function assertChildAgeInputs({
  departure,
  travellers,
}: {
  departure: GenerateAccommodationOptionsInput["departure"];
  travellers: Traveller[];
}) {
  travellers
    .filter((traveller) => traveller.type === "child")
    .forEach((traveller) => {
      const departureDate =
        departure.departureDate instanceof Date
          ? departure.departureDate
          : new Date(departure.departureDate || "");

      if (!traveller.dateOfBirth || Number.isNaN(departureDate.getTime())) {
        throw new Error("Child date of birth is required for pricing.");
      }

      calculateAgeOnDate(traveller.dateOfBirth, departureDate);
    });
}

function safeCreateOption(createOption: () => AccommodationOption | null) {
  try {
    return createOption();
  } catch {
    return null;
  }
}

function createNormalOption({
  childPricingRules,
  departure,
  roomPolicy,
  roomTypeList,
  travellers,
}: {
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  roomTypeList: RoomType[];
  travellers: Traveller[];
}): AccommodationOption | null {
  const rooms = allocateTravellersToRooms({
    childPricingRules: childPricingRules || departure.childPricingRules,
    departure,
    roomPolicy,
    roomTypes: roomTypeList,
    travellers,
  });
  const option = createPricedOption({
    departure,
    recommended:
      roomTypeList.every((roomType) => roomType === "double" || roomType === "twin") ||
      (getRoomCount(roomTypeList, (roomType) => roomType === "single") === 1 &&
        roomTypeList.every(
          (roomType) => roomType === "single" || roomType === "double" || roomType === "twin"
        )),
    rooms,
    travellers,
  });
  const errors = validateAccommodationOption(
    option,
    travellers,
    roomPolicy,
    childPricingRules || departure.childPricingRules
  );

  return errors.length === 0 ? option : null;
}

function createChildWithoutBedOption({
  childPricingRules,
  departure,
  roomPolicy,
  roomTypeList,
  travellers,
}: {
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  roomTypeList: RoomType[];
  travellers: Traveller[];
}): AccommodationOption | null {
  const rooms = allocateChildrenWithoutExtraBed({
    childPricingRules: childPricingRules || departure.childPricingRules,
    departure,
    roomPolicy,
    roomTypes: roomTypeList,
    travellers,
  });
  const option = createPricedOption({
    departure,
    idPrefix: "child-without-bed",
    rooms,
    title: `${createPracticalTitle(roomTypeList)} with Child Without Extra Bed`,
    travellers,
  });
  const errors = validateAccommodationOption(
    option,
    travellers,
    roomPolicy,
    childPricingRules || departure.childPricingRules
  );

  return errors.length === 0 ? option : null;
}

function getDepartureDate(
  departure: GenerateAccommodationOptionsInput["departure"]
) {
  const departureDate =
    departure.departureDate instanceof Date
      ? departure.departureDate
      : new Date(departure.departureDate || "");

  if (Number.isNaN(departureDate.getTime())) {
    throw new Error("Child date of birth is required for pricing.");
  }

  return departureDate;
}

function hydrateChildrenForGeneration(
  children: Traveller[],
  departure: GenerateAccommodationOptionsInput["departure"]
) {
  const departureDate = getDepartureDate(departure);

  return children.map((child) => ({
    ...child,
    ageOnDeparture:
      child.ageOnDeparture ?? calculateAgeOnDate(child.dateOfBirth || "", departureDate),
  }));
}

function getReadableRoomName(roomType: "double" | "twin") {
  return roomType === "double" ? "Double Room" : "Twin Room";
}

function getTripleRoomType(roomType: "double" | "twin"): RoomType {
  return roomType === "double" ? "triple_double" : "triple_twin";
}

function canChildUseExtraBed({
  child,
  childPricingRules,
  roomPolicy,
}: {
  child: Traveller;
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
}) {
  const policy = normalizeRoomPolicy(roomPolicy);
  const matchingRule = findChildPricingRule(
    child.ageOnDeparture,
    childPricingRules || []
  );

  return policy.allowExtraBed && (!matchingRule || matchingRule.allowExtraBed);
}

function canChildShareWithoutExtraBed({
  child,
  childPricingRules,
  roomPolicy,
}: {
  child: Traveller;
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
}) {
  const policy = normalizeRoomPolicy(roomPolicy);
  const matchingRule = findChildPricingRule(
    child.ageOnDeparture,
    childPricingRules || []
  );

  return (
    policy.allowChildBedSharing &&
    policy.maxChildrenWithoutExtraBedPerRoom > 0 &&
    Boolean(matchingRule?.allowWithoutExtraBed)
  );
}

function canChildUseSingleRoom(
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"]
) {
  return normalizeRoomPolicy(roomPolicy).allowChildSingleRoom;
}

function createPlannedOption({
  childPricingRules,
  departure,
  description,
  idPrefix,
  recommended,
  plans,
  roomPolicy,
  title,
  travellers,
}: {
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  departure: GenerateAccommodationOptionsInput["departure"];
  description?: string;
  idPrefix?: string;
  recommended?: boolean;
  plans: PlannedRoomAllocation[];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  title: string;
  travellers: Traveller[];
}): AccommodationOption | null {
  const rules = childPricingRules || departure.childPricingRules;
  const rooms = allocatePlannedRooms({
    childPricingRules: rules,
    departure,
    plans,
    roomPolicy,
  });
  const option = createPricedOption({
    departure,
    description,
    idPrefix,
    recommended,
    rooms,
    title,
    travellers,
  });
  const errors = validateAccommodationOption(
    option,
    travellers,
    roomPolicy,
    rules
  );

  return errors.length === 0 ? option : null;
}

function createChildSingleRoomOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  children: Traveller[];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  travellers: Traveller[];
}) {
  if (!canChildUseSingleRoom(roomPolicy)) {
    return [];
  }

  const options: AccommodationOption[] = [];
  const childSinglePlans = children.map(
    (child): PlannedRoomAllocation => ({
      roomType: "single",
      assignments: [{ traveller: child, bedType: "single_room" }],
    })
  );
  const allSingleOption = safeCreateOption(() =>
    createPlannedOption({
      childPricingRules,
      departure,
      idPrefix: "child-single-room",
      plans: [
        ...adults.map(
          (adult): PlannedRoomAllocation => ({
            roomType: "single",
            assignments: [{ traveller: adult, bedType: "single_room" }],
          })
        ),
        ...childSinglePlans,
      ],
      roomPolicy,
      title: `${travellers.length} Single Rooms`,
      travellers,
    })
  );

  if (allSingleOption) {
    options.push(allSingleOption);
  }

  if (adults.length === 2) {
    (["double", "twin"] as const).forEach((roomType) => {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-single-room",
          plans: [
            {
              roomType,
              assignments: adults.map((adult) => ({
                traveller: adult,
                bedType: "standard_bed" as const,
              })),
            },
            ...childSinglePlans,
          ],
          roomPolicy,
          title: `${getReadableRoomName(roomType)} + ${
            children.length === 1
              ? "Child Single Room"
              : `${children.length} Child Single Rooms`
          }`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    });
  }

  return options;
}

function generateTwoAdultsOneChildOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  children: Traveller[];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  travellers: Traveller[];
}) {
  const child = children[0];
  const options: AccommodationOption[] = [];

  (["double", "twin"] as const).forEach((roomType) => {
    const roomName = getReadableRoomName(roomType);

    if (
      canChildUseExtraBed({
        child,
        childPricingRules,
        roomPolicy,
      })
    ) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "option",
          plans: [
            {
              roomType: getTripleRoomType(roomType),
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                { traveller: child, bedType: "extra_bed" as const },
              ],
            },
          ],
          recommended: true,
          roomPolicy,
          title: `${roomName} + Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }

    if (
      canChildShareWithoutExtraBed({
        child,
        childPricingRules,
        roomPolicy,
      })
    ) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: [
            {
              roomType,
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                { traveller: child, bedType: "without_extra_bed" as const },
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} - Child Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }
  });

  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function generateOneAdultTwoChildrenOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  children: Traveller[];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  travellers: Traveller[];
}) {
  const adult = adults[0];
  const options: AccommodationOption[] = [];
  const policy = normalizeRoomPolicy(roomPolicy);

  (["double", "twin"] as const).forEach((roomType) => {
    const roomName = getReadableRoomName(roomType);

    children.forEach((extraBedChild, extraBedIndex) => {
      const sharingChild = children.find(
        (_child, index) => index !== extraBedIndex
      );

      if (
        !sharingChild ||
        !canChildUseExtraBed({
          child: extraBedChild,
          childPricingRules,
          roomPolicy,
        })
      ) {
        return;
      }

      if (
        canChildShareWithoutExtraBed({
          child: sharingChild,
          childPricingRules,
          roomPolicy,
        })
      ) {
        const option = safeCreateOption(() =>
          createPlannedOption({
            childPricingRules,
            departure,
            idPrefix: "option",
            plans: [
              {
                roomType: getTripleRoomType(roomType),
                assignments: [
                  { traveller: adult, bedType: "standard_bed" },
                  { traveller: extraBedChild, bedType: "extra_bed" },
                  { traveller: sharingChild, bedType: "without_extra_bed" },
                ],
              },
            ],
            recommended: true,
            roomPolicy,
            title: `${roomName} + Extra Bed - Child Without Extra Bed`,
            travellers,
          })
        );

        if (option) {
          options.push(option);
        }
      }

      const standardChild = sharingChild;
      const standardBedOption = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "option",
          plans: [
            {
              roomType: getTripleRoomType(roomType),
              assignments: [
                { traveller: adult, bedType: "standard_bed" },
                { traveller: standardChild, bedType: "standard_bed" },
                { traveller: extraBedChild, bedType: "extra_bed" },
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} + Extra Bed`,
          travellers,
        })
      );

      if (standardBedOption) {
        options.push(standardBedOption);
      }
    });

    if (
      policy.maxChildrenWithoutExtraBedPerRoom >= 2 &&
      children.every((child) =>
        canChildShareWithoutExtraBed({
          child,
          childPricingRules,
          roomPolicy,
        })
      )
    ) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: [
            {
              roomType,
              assignments: [
                { traveller: adult, bedType: "standard_bed" },
                ...children.map((child) => ({
                  traveller: child,
                  bedType: "without_extra_bed" as const,
                })),
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} - 2 Children Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }
  });

  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function generateTwoAdultsTwoChildrenOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  children: Traveller[];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  travellers: Traveller[];
}) {
  const options: AccommodationOption[] = [];
  const policy = normalizeRoomPolicy(roomPolicy);
  const familyRoomSets: Array<{
    roomTypes: ["double" | "twin", "double" | "twin"];
    title: string;
  }> = [
    { roomTypes: ["double", "double"], title: "2 Double Rooms" },
    { roomTypes: ["twin", "twin"], title: "2 Twin Rooms" },
    { roomTypes: ["double", "twin"], title: "Double Room + Twin Room" },
  ];

  familyRoomSets.forEach(({ roomTypes, title }) => {
    const standardOption = safeCreateOption(() =>
      createPlannedOption({
        childPricingRules,
        departure,
        idPrefix: "option",
        plans: roomTypes.map((roomType, index) => ({
          roomType,
          assignments: [
            { traveller: adults[index], bedType: "standard_bed" as const },
            { traveller: children[index], bedType: "standard_bed" as const },
          ],
        })),
        recommended: true,
        roomPolicy,
        title,
        travellers,
      })
    );

    if (standardOption) {
      options.push(standardOption);
    }

    if (
      children.every((child) =>
        canChildShareWithoutExtraBed({
          child,
          childPricingRules,
          roomPolicy,
        })
      )
    ) {
      const sharingOption = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: roomTypes.map((roomType, index) => ({
            roomType,
            assignments: [
              { traveller: adults[index], bedType: "standard_bed" as const },
              { traveller: children[index], bedType: "without_extra_bed" as const },
            ],
          })),
          roomPolicy,
          title: `${title} - Children Without Extra Bed`,
          travellers,
        })
      );

      if (sharingOption) {
        options.push(sharingOption);
      }
    }
  });

  (["double", "twin"] as const).forEach((roomType) => {
    const roomName = getReadableRoomName(roomType);

    if (
      policy.maxChildrenWithoutExtraBedPerRoom >= 2 &&
      children.every((child) =>
        canChildShareWithoutExtraBed({
          child,
          childPricingRules,
          roomPolicy,
        })
      )
    ) {
      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "child-without-bed",
          plans: [
            {
              roomType,
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                ...children.map((child) => ({
                  traveller: child,
                  bedType: "without_extra_bed" as const,
                })),
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} - 2 Children Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    }

    children.forEach((extraBedChild, extraBedIndex) => {
      const sharingChild = children.find(
        (_child, index) => index !== extraBedIndex
      );

      if (
        !sharingChild ||
        !canChildUseExtraBed({
          child: extraBedChild,
          childPricingRules,
          roomPolicy,
        }) ||
        !canChildShareWithoutExtraBed({
          child: sharingChild,
          childPricingRules,
          roomPolicy,
        })
      ) {
        return;
      }

      const option = safeCreateOption(() =>
        createPlannedOption({
          childPricingRules,
          departure,
          idPrefix: "option",
          plans: [
            {
              roomType: getTripleRoomType(roomType),
              assignments: [
                ...adults.map((adult) => ({
                  traveller: adult,
                  bedType: "standard_bed" as const,
                })),
                { traveller: extraBedChild, bedType: "extra_bed" },
                { traveller: sharingChild, bedType: "without_extra_bed" },
              ],
            },
          ],
          roomPolicy,
          title: `${roomName} + Extra Bed - Child Without Extra Bed`,
          travellers,
        })
      );

      if (option) {
        options.push(option);
      }
    });
  });

  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function getAdultRoomTypeLists(adultCount: number): RoomType[][] {
  if (adultCount === 1) {
    return [["single"], ["twin"], ["triple_twin"]];
  }

  if (adultCount === 2) {
    return [["double"], ["twin"], ["single", "single"]];
  }

  if (adultCount === 3) {
    return [
      ["triple_double"],
      ["triple_twin"],
      ["double", "single"],
      ["twin", "single"],
      ["single", "single", "single"],
    ];
  }

  if (adultCount === 4) {
    return [
      ["double", "double"],
      ["twin", "twin"],
      ["double", "twin"],
      ["single", "single", "single", "single"],
    ];
  }

  return generateRoomCombinations(adultCount);
}

function createAdultPlans(
  adults: Traveller[],
  roomTypeList: RoomType[]
): PlannedRoomAllocation[] {
  let adultCursor = 0;

  return roomTypeList.map((roomType) => {
    const capacity = ROOM_TYPES[roomType].capacity;
    const roomAdults = adults.slice(adultCursor, adultCursor + capacity);

    adultCursor += capacity;

    return {
      roomType,
      assignments: roomAdults.map((adult, occupantIndex) => ({
        traveller: adult,
        bedType:
          roomType === "single"
            ? "single_room"
            : roomType.startsWith("triple") && occupantIndex === 2
              ? "extra_bed"
              : "standard_bed",
      })),
    };
  });
}

function generateGenericFamilyOptions({
  adults,
  childPricingRules,
  children,
  departure,
  roomPolicy,
  travellers,
}: {
  adults: Traveller[];
  childPricingRules: GenerateAccommodationOptionsInput["childPricingRules"];
  children: Traveller[];
  departure: GenerateAccommodationOptionsInput["departure"];
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  travellers: Traveller[];
}) {
  const options: AccommodationOption[] = [];
  const pairedChildrenCount = Math.min(adults.length, children.length);

  if (pairedChildrenCount > 0) {
    (["double", "twin"] as const).forEach((roomType) => {
      const pairedRooms = Array.from(
        { length: pairedChildrenCount },
        (_item, index): PlannedRoomAllocation => ({
          roomType,
          assignments: [
            { traveller: adults[index], bedType: "standard_bed" },
            { traveller: children[index], bedType: "standard_bed" },
          ],
        })
      );
      const remainingAdults = adults.slice(pairedChildrenCount);
      const remainingChildren = children.slice(pairedChildrenCount);

      if (remainingChildren.length > 0) {
        return;
      }

      const remainingAdultRoomTypes =
        remainingAdults.length > 0
          ? getAdultRoomTypeLists(remainingAdults.length).slice(0, 3)
          : [[]];

      remainingAdultRoomTypes.forEach((adultRoomTypes) => {
        const adultPlans = createAdultPlans(remainingAdults, adultRoomTypes);
        const option = safeCreateOption(() =>
          createPlannedOption({
            childPricingRules,
            departure,
            idPrefix: "option",
            plans: [...pairedRooms, ...adultPlans],
            roomPolicy,
            title: createPracticalTitle([
              ...pairedRooms.map((room) => room.roomType),
              ...adultPlans.map((room) => room.roomType),
            ]),
            travellers,
          })
        );

        if (option) {
          options.push(option);
        }
      });
    });
  }

  const childWithoutBedOptions = getChildWithoutBedRoomCombinations(
    adults.length,
    children.length,
    roomPolicy
  )
    .map((roomTypeList) =>
      safeCreateOption(() =>
        createChildWithoutBedOption({
          childPricingRules,
          departure,
          roomPolicy,
          roomTypeList,
          travellers,
        })
      )
    )
    .filter((option): option is AccommodationOption => Boolean(option));

  options.push(...childWithoutBedOptions);
  options.push(
    ...createChildSingleRoomOptions({
      adults,
      childPricingRules,
      children,
      departure,
      roomPolicy,
      travellers,
    })
  );

  return options;
}

function createSoloSharingOption({
  departure,
  preferredSharingType,
  roomPolicy,
  roomType,
  travellers,
}: {
  departure: GenerateAccommodationOptionsInput["departure"];
  preferredSharingType: "twin" | "triple";
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"];
  roomType: RoomType;
  travellers: Traveller[];
}): AccommodationOption {
  const rooms = allocateTravellersToRooms({
    childPricingRules: departure.childPricingRules,
    departure,
    roomPolicy,
    roomTypes: [roomType],
    travellers,
  });
  const option = createPricedOption({
    departure,
    idPrefix: "solo-sharing",
    rooms,
    title:
      preferredSharingType === "twin"
        ? "Sharing in Twin Occupancy"
        : "Sharing in Triple Occupancy",
    description: "Traveller sharing with another tour guest",
    travellers,
  });

  return {
    ...option,
    requiresRoommateMatching: true,
    preferredSharingType,
  };
}

function getChildWithoutBedRoomCombinations(
  adultCount: number,
  childCount: number,
  roomPolicy: GenerateAccommodationOptionsInput["roomPolicy"]
): RoomType[][] {
  const policy = normalizeRoomPolicy(roomPolicy);

  if (
    adultCount === 0 ||
    childCount === 0 ||
    !policy.allowChildBedSharing ||
    policy.maxChildrenWithoutExtraBedPerRoom === 0
  ) {
    return [];
  }

  const roomCount = Math.max(
    1,
    Math.ceil(childCount / policy.maxChildrenWithoutExtraBedPerRoom)
  );
  const minimumRooms = Math.min(adultCount, roomCount);
  const maximumRooms = adultCount;
  const combinations: RoomType[][] = [];

  for (let count = minimumRooms; count <= maximumRooms; count += 1) {
    combinations.push(Array.from({ length: count }, () => "double" as RoomType));

    if (count <= 3) {
      combinations.push(Array.from({ length: count }, () => "twin" as RoomType));
    }
  }

  return combinations;
}

function limitVisibleOptions(
  options: AccommodationOption[],
  maxVisibleOptions: number
) {
  const ranked = rankAccommodationOptions(options);
  const allSingle = ranked.find((option) =>
    option.rooms.every((room) => room.roomType === "single")
  );
  const extraBedOption = ranked.find(
    (option) => option.pricingBreakdown.extraBedCount > 0
  );
  const includeRequiredOption = (
    visibleOptions: AccommodationOption[],
    requiredOption: AccommodationOption | undefined,
    protectedIds = new Set<string>()
  ) => {
    if (
      !requiredOption ||
      maxVisibleOptions <= 0 ||
      visibleOptions.some((option) => option.id === requiredOption.id)
    ) {
      return visibleOptions;
    }

    if (visibleOptions.length < maxVisibleOptions) {
      return [...visibleOptions, requiredOption];
    }

    const replaceIndex = [...visibleOptions]
      .reverse()
      .findIndex((option) => !protectedIds.has(option.id));

    if (replaceIndex === -1) {
      return visibleOptions;
    }

    const nextVisibleOptions = [...visibleOptions];

    nextVisibleOptions[visibleOptions.length - 1 - replaceIndex] =
      requiredOption;

    return nextVisibleOptions;
  };

  if (ranked[0]?.totalTravellers && ranked[0].totalTravellers >= 5) {
    const visible: AccommodationOption[] = [];
    const addOption = (option: AccommodationOption | undefined) => {
      if (option && !visible.some((item) => item.id === option.id)) {
        visible.push(option);
      }
    };
    const counts = (option: AccommodationOption) => {
      const singles = option.rooms.filter((room) => room.roomType === "single").length;
      const standards = option.rooms.filter(
        (room) => room.roomType === "double" || room.roomType === "twin"
      ).length;
      const triples = option.rooms.filter((room) =>
        room.roomType.startsWith("triple")
      ).length;

      return { singles, standards, triples };
    };
    const matches = (
      predicate: (values: ReturnType<typeof counts>) => boolean
    ) => ranked.filter((option) => predicate(counts(option)));

    addOption(matches(({ triples, standards, singles }) => triples === 0 && standards > 0 && singles <= 1)[0]);

    const tripleStandard = matches(
      ({ triples, standards, singles }) => triples > 0 && standards > 0 && singles === 0
    );
    addOption(tripleStandard[0]);
    addOption(tripleStandard[tripleStandard.length - 1]);
    addOption(matches(({ triples, standards, singles }) => triples > 0 && standards === 0 && singles === 0)[0]);
    addOption(matches(({ triples, standards, singles }) => triples === 0 && standards > 0 && singles > 1)[0]);
    addOption(matches(({ triples, standards, singles }) => triples > 0 && standards === 0 && singles > 0)[0]);
    addOption(matches(({ triples, standards, singles }) => triples > 0 && standards > 0 && singles > 0)[0]);
    addOption(allSingle);

    ranked.forEach((option) => {
      if (visible.length < maxVisibleOptions) {
        addOption(option);
      }
    });

    const limitedVisible = visible.slice(0, maxVisibleOptions);

    if (
      allSingle &&
      !limitedVisible.some((option) => option.id === allSingle.id) &&
      maxVisibleOptions > 0
    ) {
      limitedVisible.splice(maxVisibleOptions - 1, 1, allSingle);
    }

    return includeRequiredOption(
      limitedVisible,
      extraBedOption,
      new Set(allSingle ? [allSingle.id] : [])
    );
  }

  let visible = ranked.slice(0, maxVisibleOptions);

  if (
    allSingle &&
    !visible.some((option) => option.id === allSingle.id) &&
    maxVisibleOptions > 0
  ) {
    visible.splice(maxVisibleOptions - 1, 1, allSingle);
  }

  visible = includeRequiredOption(
    visible,
    extraBedOption,
    new Set(allSingle ? [allSingle.id] : [])
  );

  return visible;
}

export function generateRoomCombinations(totalTravellers: number): RoomType[][] {
  if (totalTravellers < 1 || totalTravellers > 25) {
    return [];
  }

  const combinations: RoomType[][] = [];

  function walk(startIndex: number, remainingCapacity: number, current: RoomType[]) {
    if (remainingCapacity === 0) {
      combinations.push([...current]);
      return;
    }

    roomCombinationTypes.slice(startIndex).forEach((roomType, offset) => {
      const capacity = ROOM_TYPES[roomType].capacity;

      if (capacity > remainingCapacity) {
        return;
      }

      current.push(roomType);
      walk(startIndex + offset, remainingCapacity - capacity, current);
      current.pop();
    });
  }

  walk(0, totalTravellers, []);

  return combinations;
}

export function deduplicateAccommodationOptions(
  options: AccommodationOption[]
): AccommodationOption[] {
  const optionByKey = new Map<string, AccommodationOption>();

  options.forEach((option) => {
    const key = canonicalRoomCombinationKey(
      option.rooms.map((room) => room.roomType)
    );
    const existingOption = optionByKey.get(key);

    if (!existingOption || option.totalPrice < existingOption.totalPrice) {
      optionByKey.set(key, option);
    }
  });

  return Array.from(optionByKey.values());
}

export function generateAccommodationOptions({
  childPricingRules,
  departure,
  includeSoloTripleSharing = true,
  maxVisibleOptions = MAX_VISIBLE_OPTIONS,
  roomPolicy,
  travellers,
}: GenerateAccommodationOptionsInput): AccommodationOption[] {
  assertTravellerCount(travellers);
  assertChildAgeInputs({
    departure,
    travellers,
  });

  const adults = travellers.filter((traveller) => traveller.type === "adult");
  const children = travellers.filter((traveller) => traveller.type === "child");
  const rules = childPricingRules || departure.childPricingRules;
  const hydratedChildren = children.length
    ? hydrateChildrenForGeneration(children, departure)
    : [];
  const resolvedTravellers = [...adults, ...hydratedChildren];
  const resolvedRoomPolicy = normalizeRoomPolicy(roomPolicy || departure.roomPolicy);

  if (children.length === 0 && travellers.length === 1 && adults.length === 1) {
    const singleOption = createNormalOption({
      childPricingRules: rules,
      departure,
      roomPolicy: resolvedRoomPolicy,
      roomTypeList: ["single"],
      travellers: resolvedTravellers,
    });
    const options = [
      singleOption,
      createSoloSharingOption({
        departure,
        preferredSharingType: "twin",
        roomPolicy: resolvedRoomPolicy,
        roomType: "twin",
        travellers: resolvedTravellers,
      }),
      includeSoloTripleSharing
        ? createSoloSharingOption({
            departure,
            preferredSharingType: "triple",
            roomPolicy: resolvedRoomPolicy,
            roomType: "triple_twin",
            travellers: resolvedTravellers,
          })
        : null,
    ].filter((option): option is AccommodationOption => Boolean(option));

    return options;
  }

  if (children.length === 0) {
    const adultOptions = getAdultRoomTypeLists(adults.length)
      .map((roomTypeList) =>
        safeCreateOption(() =>
          createNormalOption({
            childPricingRules: rules,
            departure,
            roomPolicy: resolvedRoomPolicy,
            roomTypeList,
            travellers: resolvedTravellers,
          })
        )
      )
      .filter((option): option is AccommodationOption => Boolean(option));

    return limitVisibleOptions(
      deduplicateAccommodationOptions(adultOptions),
      maxVisibleOptions
    );
  }

  const childAwareOptions =
    adults.length === 2 && hydratedChildren.length === 1
      ? generateTwoAdultsOneChildOptions({
          adults,
          childPricingRules: rules,
          children: hydratedChildren,
          departure,
          roomPolicy: resolvedRoomPolicy,
          travellers: resolvedTravellers,
        })
      : adults.length === 1 && hydratedChildren.length === 2
        ? generateOneAdultTwoChildrenOptions({
            adults,
            childPricingRules: rules,
            children: hydratedChildren,
            departure,
            roomPolicy: resolvedRoomPolicy,
            travellers: resolvedTravellers,
          })
        : adults.length === 2 && hydratedChildren.length === 2
          ? generateTwoAdultsTwoChildrenOptions({
              adults,
              childPricingRules: rules,
              children: hydratedChildren,
              departure,
              roomPolicy: resolvedRoomPolicy,
              travellers: resolvedTravellers,
            })
          : generateGenericFamilyOptions({
              adults,
              childPricingRules: rules,
              children: hydratedChildren,
              departure,
              roomPolicy: resolvedRoomPolicy,
              travellers: resolvedTravellers,
            });

  return limitVisibleOptions(
    deduplicateAccommodationOptions(childAwareOptions),
    maxVisibleOptions
  );
}
