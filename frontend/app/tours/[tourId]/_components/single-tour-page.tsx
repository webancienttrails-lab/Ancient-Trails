"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  BarChart3,
  BedDouble,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  Landmark,
  Mail,
  Minus,
  PhoneCall,
  Plus,
  TrendingUp,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  fallbackUpcomingTours,
  getHomeMediaUrl,
  getTourDestinationIds,
  listPublicDestinations,
  listPublicExperts,
  listPublicTourDepartures,
  listPublicTourItineraries,
  listPublicTours,
  type PublicDestination,
  type PublicExpert,
  type PublicTour,
  type PublicTourDeparture,
  type PublicTourItinerary,
} from "@/lib/home-travel";
import {
  calculateBalance,
  calculateAgeOnDate,
  calculateBalanceDueDate,
  calculateDeposit,
  generateOccupancyOptions,
  ROOM_TYPES,
  validateDepartureForBooking,
  type AccommodationOption,
  type PricedDeparture,
  type PricingCategory,
} from "@/lib/tour-booking";
import {
  cancelBookingPaymentOrder,
  createBookingPaymentOrder,
  verifyBookingPayment,
  type BookingPayload,
  type BookingPaymentOrder,
} from "@/lib/booking-payment";
import {
  getTravellerSession,
  listenForTravellerSessionChanges,
  type TravellerUser,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";

type TourTab = "summary" | "itinerary" | "inclusions" | "pricing" | "expert";

type TourDetailData = {
  departures: PublicTourDeparture[];
  destinations: PublicDestination[];
  expert: PublicExpert;
  itinerary: PublicTourItinerary | null;
  primaryDestination: PublicDestination;
  tour: PublicTour;
};

type TourFact = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type ItineraryDay = {
  dayNumber: number;
  meals?: string;
  placesVisited?: string[];
  summary: string;
  title: string;
  transport?: string;
  walkingDifficulty?: string;
};

type TravellerCounts = {
  adults: number;
  children: number;
  infants: number;
};

type TravellerCountKey = keyof TravellerCounts;

type TravellerDetailForm = {
  address: string;
  dateOfBirth: string;
  email: string;
  firstName: string;
  gender: "" | "female" | "male";
  lastName: string;
  mobileNumber: string;
  phoneCountryCode: string;
  title: string;
};

type TravellerDetailField = keyof TravellerDetailForm;

type TravellerDetailTab = {
  description: string;
  heading: string;
  id: string;
  label: string;
  travellerType: "adult" | "child" | "infant";
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const datePickerMonthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const datePickerWeekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type CheckoutStatus = "idle" | "creating" | "gateway_open" | "verifying";

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    description?: string;
    reason?: string;
  };
};

type RazorpayCheckoutInstance = {
  on: (
    event: "payment.failed",
    handler: (response: RazorpayFailureResponse) => void
  ) => void;
  open: () => void;
};

type RazorpayCheckoutOptions = {
  amount: number;
  currency: string;
  description: string;
  handler: (response: RazorpayPaymentResponse) => void;
  key: string;
  modal: {
    ondismiss: () => void;
  };
  name: string;
  order_id: string;
  prefill: {
    contact: string;
    email: string;
    name: string;
  };
  retry: {
    enabled: boolean;
  };
  theme: {
    color: string;
  };
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions
    ) => RazorpayCheckoutInstance;
  }
}

let razorpayCheckoutScriptPromise: Promise<void> | null = null;

const fallbackGalleryImages = [
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Egypt.webp",
];

const tabs: Array<{
  icon: LucideIcon;
  label: string;
  sectionId: string;
  value: TourTab;
}> = [
  { value: "summary", label: "Summary", icon: BookOpen, sectionId: "summary" },
  {
    value: "itinerary",
    label: "Itinerary",
    icon: CalendarDays,
    sectionId: "itinerary",
  },
  {
    value: "inclusions",
    label: "Inclusions / Exclusions",
    icon: BedDouble,
    sectionId: "inclusions",
  },
  {
    value: "pricing",
    label: "Departure & Pricing",
    icon: CalendarDays,
    sectionId: "departure-pricing",
  },
  {
    value: "expert",
    label: "Tour Expert",
    icon: UserRound,
    sectionId: "tour-expert",
  },
];

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean))
  );
}

function formatCurrency(value: number) {
  if (!value || value <= 0) {
    return "Price on request";
  }

  return currencyFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Coming Soon";
  }

  return shortDateFormatter.format(date).replace(",", "");
}

function formatDatePickerValue(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return shortDateFormatter.format(date).replace(",", "");
}

function formatDatePickerStorageValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDatePickerValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getDepartureIdentifier(departure: PublicTourDeparture) {
  return departure.id || departure.departureId || departure.departureDate || "";
}

function isClientFallbackDeparture(departure: PublicTourDeparture) {
  return departure.id.startsWith("fallback-departure-");
}

function sortDeparturesByDate(departures: PublicTourDeparture[]) {
  return departures
    .slice()
    .sort(
      (left, right) =>
        getDateValue(left.departureDate) - getDateValue(right.departureDate)
    );
}

function isUpcomingDeparture(departure: PublicTourDeparture) {
  const departureDate = getDateValue(departure.departureDate);

  if (!departureDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return departureDate >= today.getTime();
}

function validateDeparturePaymentReadiness(
  departure: PublicTourDeparture,
  requestedTravellers: number
) {
  const errors = validateDepartureForBooking(
    toPricedDeparture(departure),
    requestedTravellers
  );

  if (isClientFallbackDeparture(departure)) {
    errors.push("Live departure details are required before payment.");
  }

  if (!departure.departureId.trim()) {
    errors.push("Departure ID is missing.");
  }

  if (!Number.isFinite(departure.priceAdult) || departure.priceAdult <= 0) {
    errors.push("Adult pricing is required before payment.");
  }

  return Array.from(new Set(errors));
}

function isDeparturePaymentReady(
  departure: PublicTourDeparture,
  requestedTravellers = 1
) {
  return validateDeparturePaymentReadiness(departure, requestedTravellers).length === 0;
}

function getSelectedDeparture(
  departures: PublicTourDeparture[],
  selectedDepartureId: string
) {
  const selectedDeparture = departures.find(
    (departure) => getDepartureIdentifier(departure) === selectedDepartureId
  );

  if (selectedDeparture) {
    return selectedDeparture;
  }

  return getBestDeparture(departures);
}

function getTotalTravellers(counts: TravellerCounts) {
  return counts.adults + counts.children + counts.infants;
}

const defaultTravellerDetailForm: TravellerDetailForm = {
  address: "",
  dateOfBirth: "",
  email: "",
  firstName: "",
  gender: "",
  lastName: "",
  mobileNumber: "",
  phoneCountryCode: "India +91",
  title: "Mr",
};

function formatOrdinal(value: number) {
  const remainder = value % 100;

  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function createTravellerDetailTabs(
  counts: TravellerCounts
): TravellerDetailTab[] {
  const adultTabs = Array.from({ length: counts.adults }, (_item, index) => {
    const travellerNumber = index + 1;
    const isLeadTraveller = index === 0;

    return {
      id: `adult-${travellerNumber}`,
      label: isLeadTraveller
        ? "Lead Traveller"
        : `${formatOrdinal(travellerNumber)} Traveller`,
      heading: isLeadTraveller
        ? "Lead Traveller"
        : `${formatOrdinal(travellerNumber)} Traveller`,
      description: isLeadTraveller
        ? "This traveller will serve as the contact person for the booking."
        : "Add this traveller's details for the booking.",
      travellerType: "adult" as const,
    };
  });

  const childTabs = Array.from({ length: counts.children }, (_item, index) => {
    const travellerNumber = counts.adults + index + 1;

    return {
      id: `child-${index + 1}`,
      label: `${formatOrdinal(travellerNumber)} Traveller`,
      heading: `${formatOrdinal(travellerNumber)} Traveller`,
      description: "Add this child traveller's details for the booking.",
      travellerType: "child" as const,
    };
  });

  const infantTabs = Array.from({ length: counts.infants }, (_item, index) => {
    const travellerNumber = counts.adults + counts.children + index + 1;

    return {
      id: `infant-${index + 1}`,
      label: `${formatOrdinal(travellerNumber)} Traveller`,
      heading: `${formatOrdinal(travellerNumber)} Traveller`,
      description: "Add this infant traveller's details for the booking.",
      travellerType: "infant" as const,
    };
  });

  return [...adultTabs, ...childTabs, ...infantTabs];
}

function getCompleteTravellerDetailForms(
  counts: TravellerCounts,
  forms: Record<string, TravellerDetailForm>
) {
  return Object.fromEntries(
    createTravellerDetailTabs(counts).map((tab) => [
      tab.id,
      {
        ...defaultTravellerDetailForm,
        ...(forms[tab.id] || {}),
      },
    ])
  ) as Record<string, TravellerDetailForm>;
}

function getProfileMobileDigits(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function getProfilePhoneCountryCode(value?: string) {
  const digits = getProfileMobileDigits(value);

  if (digits.length > 10) {
    if (digits.startsWith("44")) {
      return "UK +44";
    }

    if (digits.startsWith("61")) {
      return "Australia +61";
    }

    if (digits.startsWith("1")) {
      return "US +1";
    }
  }

  return "India +91";
}

function getProfileMobileNumber(value?: string) {
  let digits = getProfileMobileDigits(value);
  const countryCode = getProfilePhoneCountryCode(value);

  if (digits.length > 10) {
    if (countryCode === "India +91" && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (countryCode === "UK +44" && digits.startsWith("44")) {
      digits = digits.slice(2);
    } else if (countryCode === "Australia +61" && digits.startsWith("61")) {
      digits = digits.slice(2);
    } else if (countryCode === "US +1" && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
  }

  if (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 15);
}

function getTravellerProfileGender(gender?: string): TravellerDetailForm["gender"] {
  const normalizedGender = gender?.trim().toLowerCase();

  if (normalizedGender === "male") {
    return "male";
  }

  if (normalizedGender === "female") {
    return "female";
  }

  return "";
}

function getTravellerProfileDateOfBirth(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatDatePickerStorageValue(date);
}

function isValidStoredBirthDate(value: string) {
  const date = parseDatePickerValue(value);

  if (!date) {
    return false;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return date <= today;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidMobileNumber(value: string) {
  return /^[0-9\s-]{5,20}$/.test(sanitizeMobileNumber(value));
}

function isTravellerDetailFormComplete(form: TravellerDetailForm) {
  return Boolean(
      form.firstName.trim() &&
      form.lastName.trim() &&
      isValidEmail(form.email) &&
      form.address.trim() &&
      extractPhoneCountryCode(form.phoneCountryCode) &&
      isValidMobileNumber(form.mobileNumber) &&
      form.gender &&
      isValidStoredBirthDate(form.dateOfBirth)
  );
}

function hasCompletedTravellerProfile(user: TravellerUser | null) {
  if (!user) {
    return false;
  }

  return Boolean(
    user.firstName?.trim() &&
      user.lastName?.trim() &&
      user.email?.trim() &&
      getProfileMobileNumber(user.mobileNumber)
  );
}

function getLeadTravellerFormFromProfile(
  user: TravellerUser | null
): TravellerDetailForm | null {
  if (!hasCompletedTravellerProfile(user)) {
    return null;
  }

  const gender = getTravellerProfileGender(user?.gender);

  return {
    ...defaultTravellerDetailForm,
    title: gender === "female" ? "Ms" : "Mr",
    firstName: user?.firstName?.trim() || "",
    lastName: user?.lastName?.trim() || "",
    email: user?.email?.trim() || "",
    mobileNumber: getProfileMobileNumber(user?.mobileNumber),
    phoneCountryCode: getProfilePhoneCountryCode(user?.mobileNumber),
    gender,
    dateOfBirth: getTravellerProfileDateOfBirth(user?.dateOfBirth),
  };
}

function createInitialTravellerDetailForms(): Record<string, TravellerDetailForm> {
  const leadTravellerForm = getLeadTravellerFormFromProfile(
    getTravellerSession()?.user ?? null
  );

  return leadTravellerForm ? { "adult-1": leadTravellerForm } : {};
}

function hasEditedLeadTravellerForm(form?: TravellerDetailForm) {
  if (!form) {
    return false;
  }

  return Boolean(
    form.firstName.trim() ||
      form.lastName.trim() ||
      form.email.trim() ||
      form.mobileNumber.trim() ||
      form.address.trim() ||
      form.gender ||
      form.dateOfBirth.trim()
  );
}

function extractPhoneCountryCode(value: string) {
  return value.match(/\+[0-9]{1,4}/)?.[0] || "+91";
}

function sanitizeMobileNumber(value: string) {
  return value.replace(/[^\d\s-]/g, "").trim();
}

function createAccommodationDetails(option?: AccommodationOption) {
  const singleRooms =
    option?.rooms.filter((room) => room.roomType === "single").length || 0;

  return {
    singleOccupancyOneRoom: singleRooms === 1 ? 1 : 0,
    singleOccupancyTwoRooms: singleRooms > 1 ? singleRooms : 0,
    doubleOccupancy:
      option?.rooms.filter((room) => room.roomType === "double").length || 0,
    twinOccupancy:
      option?.rooms.filter((room) => room.roomType === "twin").length || 0,
    tripleOccupancy:
      option?.rooms.filter((room) => room.roomType.startsWith("triple")).length ||
      0,
  };
}

function getTravellerAgeOnDeparture(
  form: TravellerDetailForm,
  departure: PublicTourDeparture
) {
  if (!form.dateOfBirth || !departure.departureDate) {
    return 0;
  }

  try {
    return calculateAgeOnDate(form.dateOfBirth, departure.departureDate);
  } catch {
    return 0;
  }
}

function createBookingPayload({
  accommodationOption,
  departure,
  forms,
  tour,
  travellerCounts,
}: {
  accommodationOption: AccommodationOption;
  departure: PublicTourDeparture;
  forms: Record<string, TravellerDetailForm>;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
}): BookingPayload {
  const travellerTabs = createTravellerDetailTabs(travellerCounts);
  const totalGuests = getTotalTravellers(travellerCounts);
  const childTabs = travellerTabs.filter((tab) => tab.travellerType !== "adult");

  return {
    tourId: tour.tourId,
    departureId: departure.departureId,
    selectedAccommodationOptionId: accommodationOption.id,
    totalGuest: totalGuests,
    adultCount: travellerCounts.adults,
    childCount: travellerCounts.children + travellerCounts.infants,
    childDetails: childTabs.map((tab) => ({
      age: getTravellerAgeOnDeparture(forms[tab.id], departure),
    })),
    guestDetails: travellerTabs.map((tab) => {
      const form = forms[tab.id];
      const address = form.address.trim() || "Not provided";

      return {
        title: form.title,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        countryCode: extractPhoneCountryCode(form.phoneCountryCode),
        mobileNumber: sanitizeMobileNumber(form.mobileNumber),
        email: form.email.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        address,
      };
    }),
    travellers: travellerTabs.map((tab) => {
      const form = forms[tab.id];
      const countryCode = extractPhoneCountryCode(form.phoneCountryCode);
      const mobileNumber = sanitizeMobileNumber(form.mobileNumber);

      return {
        id: tab.id,
        type: tab.travellerType === "adult" ? "adult" : "child",
        title: form.title,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        countryCode,
        mobileNumber,
        email: form.email.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        address: form.address.trim() || "Not provided",
        ageOnDeparture:
          tab.travellerType === "adult"
            ? undefined
            : getTravellerAgeOnDeparture(form, departure),
      };
    }),
    accommodationDetails: createAccommodationDetails(accommodationOption),
    gstPercentage: GST_PERCENTAGE,
  };
}

function loadRazorpayCheckoutScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is available in browser only"));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (razorpayCheckoutScriptPromise) {
    return razorpayCheckoutScriptPromise;
  }

  razorpayCheckoutScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          razorpayCheckoutScriptPromise = null;
          reject(new Error("Razorpay checkout could not be loaded"));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayCheckoutScriptPromise = null;
      reject(new Error("Razorpay checkout could not be loaded"));
    };
    document.body.appendChild(script);
  });

  return razorpayCheckoutScriptPromise;
}

function parseDurationDays(duration: string) {
  const dayMatch = duration.match(/(\d+)\s*(?:d|day)/i);
  const numericMatch = dayMatch || duration.match(/(\d+)/);
  const days = numericMatch ? Number(numericMatch[1]) : 8;

  return Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 8;
}

function getDurationLabel(tour: PublicTour) {
  const days = parseDurationDays(tour.durationDn);

  return `${days} ${days === 1 ? "Day" : "Days"}`;
}

function getDifficultyLabel(tour: PublicTour) {
  return tour.difficulty || "Moderate";
}

function getDestinationTitle(destination: PublicDestination) {
  return (
    destination.destinationName ||
    destination.city ||
    destination.state ||
    destination.countryRegion ||
    "Ancient Trails"
  );
}

function getRouteLabel(
  tour: PublicTour,
  destinations: PublicDestination[],
  primaryDestination: PublicDestination
) {
  if (tour.tourId === "WALKING-AMALFI-COAST") {
    return "Bomerano to Agerola";
  }

  const destinationNames = uniqueValues(
    destinations.map((destination) => getDestinationTitle(destination))
  );

  if (destinationNames.length > 1) {
    return `${destinationNames[0]} to ${destinationNames[destinationNames.length - 1]}`;
  }

  return (
    primaryDestination.city ||
    primaryDestination.destinationName ||
    primaryDestination.state ||
    "Ancient Trails"
  );
}

function getStartEndLabel(
  tour: PublicTour,
  destinations: PublicDestination[],
  primaryDestination: PublicDestination
) {
  return getRouteLabel(tour, destinations, primaryDestination);
}

function getTourImages(
  tour: PublicTour,
  destinations: PublicDestination[]
) {
  const images = uniqueValues([
    tour.thumbnailImage,
    tour.bannerImage,
    ...tour.galleryImages,
    ...destinations.flatMap((destination) => [
      destination.bannerImage,
      ...destination.galleryImages,
    ]),
    fallbackUpcomingTours.find((item) => item.tourId === tour.tourId)?.image,
  ]).map(getHomeMediaUrl);

  return images.length > 0 ? images : fallbackGalleryImages;
}

function getBestDeparture(departures: PublicTourDeparture[]) {
  const sortedDepartures = sortDeparturesByDate(departures);

  return (
    sortedDepartures.find(
      (departure) =>
        isUpcomingDeparture(departure) && isDeparturePaymentReady(departure)
    ) ||
    sortedDepartures.find((departure) => isDeparturePaymentReady(departure)) ||
    sortedDepartures[0]
  );
}

function getLowestPrice(departures: PublicTourDeparture[]) {
  const payableDepartures = departures.filter((departure) =>
    isDeparturePaymentReady(departure)
  );
  const priceSource =
    payableDepartures.length > 0 ? payableDepartures : departures;
  const prices = priceSource
    .map((departure) => departure.priceAdult)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

function getDepartureFillProgress(departure: PublicTourDeparture) {
  const totalSeats = getDepartureTotalSeats(departure);
  const filledSeats = getDepartureFilledSeats(departure);

  return Math.min(100, Math.max(0, (filledSeats / totalSeats) * 100));
}

function getDepartureTotalSeats(departure: PublicTourDeparture) {
  return Math.max(
    departure.totalSeats || 0,
    departure.seatsAvailable || 0,
    25
  );
}

function getDepartureFilledSeats(departure: PublicTourDeparture) {
  const totalSeats = getDepartureTotalSeats(departure);

  return Math.min(
    totalSeats,
    Math.max(
      0,
      typeof departure.filledSeats === "number"
        ? departure.filledSeats
        : totalSeats - (departure.seatsAvailable || 0)
    )
  );
}

function getSeatProgressColorClass(filledPercent: number) {
  if (filledPercent >= 70) {
    return "bg-[#d6452f]";
  }

  if (filledPercent >= 25) {
    return "bg-[#f5b82e]";
  }

  return "bg-[#2faa5d]";
}

function createFallbackExpert(): PublicExpert {
  return {
    id: "fallback-expert-girinath",
    expertId: "GIRINATH-BHARADE",
    fullName: "Mr. Girinath Bharade",
    image: "/home assets/Khajuraho.webp",
    fullBiography:
      "Founder of Ancient Trails and an avid traveller. An Indologist, a teacher by heart, a heritage researcher and a cultural storyteller with special interest in temple architecture and ancient traditions.",
    expertiseTags: ["South Indian Temple Architecture"],
    qualifications: ["Indologist", "Heritage Researcher"],
    languages: ["English", "Hindi", "Marathi"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackDestination(): PublicDestination {
  return {
    id: "fallback-destination-amalfi",
    destinationId: "AMALFI-COAST",
    destinationName: "Amalfi Coast",
    destinationType: "International",
    countryRegion: "Italy",
    state: "Campania",
    city: "Amalfi",
    primaryHeritageFocus: "Coastal Heritage",
    unescoSite: true,
    keyLandmarks: [
      "Path of the Gods",
      "Positano",
      "Praiano",
      "Amalfi",
      "Ravello",
    ],
    recommendedDurationDays: 8,
    shortDescription:
      "Experience scenic coastal trails, layered villages and Mediterranean heritage along one of Italy's most memorable walking routes.",
    dressCode: "Light layers and sun protection",
    footwear: "Comfortable walking shoes",
    permits: "Details shared before travel",
    idRequirement: "Passport required",
    restrictions: "Some trails include steps and uneven paths",
    bannerImage: "/home assets/Khajuraho.webp",
    galleryImages: [
      "/home assets/destination/Hampi.webp",
      "/home assets/destination/Udaipur.webp",
      "/home assets/destination/Varanasi.webp",
      "/home assets/Egypt.webp",
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackTour(requestedTourId: string): PublicTour {
  const matchedFallback = fallbackUpcomingTours.find(
    (tour) =>
      normalizeCode(tour.tourId) === normalizeCode(requestedTourId) ||
      slugify(tour.title) === slugify(requestedTourId)
  );

  if (matchedFallback) {
    return {
      id: `fallback-${matchedFallback.tourId}`,
      tourId: matchedFallback.tourId,
      tourName: matchedFallback.title,
      tourType: "Heritage Walk",
      tourFormat: "Heritage Tours",
      destinationId: matchedFallback.destinationId,
      destinationIds: [matchedFallback.destinationId],
      durationDn: matchedFallback.duration,
      category: "Heritage Walk",
      isBestseller: true,
      difficulty: "Moderate",
      bestSeason: "October to March",
      description:
        "A carefully designed heritage journey with guided walks, local stories, landmark visits and meaningful cultural encounters.",
      inclusions: [
        "Expert-led sightseeing and storytelling",
        "Curated heritage walks",
        "Accommodation on twin sharing basis",
        "Local transfers as per itinerary",
      ],
      exclusions: [
        "Flights and personal expenses",
        "Meals not listed in the itinerary",
        "Camera fees and monument charges unless specified",
      ],
      expertId: "GIRINATH-BHARADE",
      notes: "",
      bannerImage: matchedFallback.image,
      galleryImages: fallbackGalleryImages.filter(
        (image) => image !== matchedFallback.image
      ),
      video: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: "fallback-walking-amalfi-coast",
    tourId: "WALKING-AMALFI-COAST",
    tourName: "Walking the Amalfi Coast",
    tourType: "Heritage Walk",
    tourFormat: "Short Trails",
    destinationId: "AMALFI-COAST",
    destinationIds: ["AMALFI-COAST"],
    durationDn: "8 Days / 7 Nights",
    category: "Heritage Walk",
    isBestseller: false,
    difficulty: "Moderate",
    bestSeason: "April to October",
    description:
      "Experience the breathtaking beauty of the Amalfi Coast on this unforgettable 8-day guided hiking tour. Walk scenic coastal trails, explore charming villages, and enjoy authentic Italian hospitality from Bomerano to Agerola.",
    inclusions: [
      "Expert tour leader and local guide assistance",
      "Accommodation on private double room basis",
      "Daily breakfast and selected meals",
      "Curated walking routes and heritage visits",
      "Ground transfers as mentioned in the itinerary",
    ],
    exclusions: [
      "International and domestic flights",
      "Personal expenses and optional activities",
      "Travel insurance and visa charges",
      "Meals not mentioned in the itinerary",
      "Tips, porterage and camera charges",
    ],
    expertId: "GIRINATH-BHARADE",
    notes: "Average elevation: 450 - 650 m",
    bannerImage: "/home assets/Khajuraho.webp",
    galleryImages: [
      "/home assets/destination/Hampi.webp",
      "/home assets/destination/Udaipur.webp",
      "/home assets/destination/Varanasi.webp",
      "/home assets/Egypt.webp",
    ],
    video: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackDeparture(tour: PublicTour): PublicTourDeparture {
  const departureDate = new Date();
  departureDate.setDate(departureDate.getDate() + 45);
  const returnDate = new Date(departureDate);
  returnDate.setDate(departureDate.getDate() + parseDurationDays(tour.durationDn) - 1);

  return {
    id: `fallback-departure-${tour.tourId}`,
    departureId: `${tour.tourId}-DEP-1`,
    tourId: tour.tourId,
    destinationId: tour.destinationId,
    departureDate: departureDate.toISOString(),
    returnDate: returnDate.toISOString(),
    seatsAvailable: 12,
    priceAdult: tour.tourId === "WALKING-AMALFI-COAST" ? 1950 : 35500,
    priceExtraBed: tour.tourId === "WALKING-AMALFI-COAST" ? 1755 : 31950,
    priceChildWithoutExtraBed:
      tour.tourId === "WALKING-AMALFI-COAST" ? 1560 : 28400,
    singleOccupancy: tour.tourId === "WALKING-AMALFI-COAST" ? 2438 : 44375,
    depositType: "percentage",
    depositValue: 25,
    depositAppliesTo: "per_booking",
    balanceDueDaysBefore: 45,
    earlyBirdOffer:
      tour.tourId === "WALKING-AMALFI-COAST" ? "11% Early Bird Discount" : null,
    bookingDeadline: departureDate.toISOString(),
    status: "scheduled",
    childPricingRules: [
      {
        minAge: 0,
        maxAge: 11,
        allowExtraBed: true,
        allowWithoutExtraBed: true,
      },
    ],
    roomPolicy: {
      allowChildBedSharing: true,
      maxChildrenWithoutExtraBedPerRoom: 1,
      allowExtraBed: true,
      allowChildSingleRoom: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createFallbackDetail(requestedTourId: string): TourDetailData {
  const fallbackTour = createFallbackTour(requestedTourId);
  const fallbackDestination =
    fallbackTour.destinationId === "AMALFI-COAST"
      ? createFallbackDestination()
      : {
          ...createFallbackDestination(),
          destinationId: fallbackTour.destinationId,
          destinationName: fallbackTour.tourName,
          city: fallbackTour.tourName,
          countryRegion: "India",
          state: "",
          primaryHeritageFocus: fallbackTour.category,
          bannerImage: fallbackTour.bannerImage,
          galleryImages: fallbackTour.galleryImages,
        };

  return {
    tour: fallbackTour,
    departures: [createFallbackDeparture(fallbackTour)],
    destinations: [fallbackDestination],
    itinerary: null,
    primaryDestination: fallbackDestination,
    expert: createFallbackExpert(),
  };
}

function createItineraryDays(
  tour: PublicTour,
  destinations: PublicDestination[],
  itinerary: PublicTourItinerary | null
) {
  if (itinerary?.days.length) {
    return [...itinerary.days]
      .sort((left, right) => left.dayNumber - right.dayNumber)
      .map((day, index) => ({
        dayNumber: day.dayNumber || index + 1,
        meals: day.meals,
        placesVisited: day.placesVisited,
        summary:
          day.summary ||
          "A guided day with curated visits, local context and time to explore.",
        title: day.title || `Day ${day.dayNumber || index + 1}`,
        transport: day.transport,
        walkingDifficulty: day.walkingDifficulty,
      }));
  }

  if (tour.tourId === "WALKING-AMALFI-COAST") {
    return [
      {
        dayNumber: 1,
        title: "Arrive in Bomerano",
        summary:
          "Arrive in Bomerano and transfer to your hotel. Meet your guide and enjoy a welcome dinner.",
      },
      {
        dayNumber: 2,
        title: "Path of the Gods",
        summary:
          "Hike the famous Path of the Gods with breathtaking views of the coastline. Descend to Nocelle and visit Positano.",
      },
      {
        dayNumber: 3,
        title: "Amalfi Exploration",
        summary:
          "Explore the historic town of Amalfi, visit the Cathedral and enjoy free time by the sea.",
      },
      {
        dayNumber: 4,
        title: "Ravello Day",
        summary:
          "Hike to Ravello through lemon terraces and enjoy panoramic views. Visit Villa Rufolo.",
      },
      {
        dayNumber: 5,
        title: "Agerola Trails",
        summary:
          "Discover the trails around Agerola and traditional local villages.",
      },
      {
        dayNumber: 6,
        title: "Coastal Boat Day",
        summary:
          "Enjoy a scenic boat ride along the Amalfi Coast with stops for swimming.",
      },
      {
        dayNumber: 7,
        title: "Free Day",
        summary: "Leisure time to relax, explore local markets or optional activities.",
      },
      {
        dayNumber: 8,
        title: "Departure",
        summary: "After breakfast, check out and transfer to Agerola.",
      },
    ];
  }

  const days = parseDurationDays(tour.durationDn);
  const primaryDestination = destinations[0];
  const landmarks = uniqueValues(
    destinations.flatMap((destination) => [
      ...destination.keyLandmarks,
      destination.destinationName,
      destination.city,
    ])
  );
  const route = getRouteLabel(tour, destinations, primaryDestination);

  return Array.from({ length: days }, (_item, index) => {
    const dayNumber = index + 1;
    const landmark = landmarks[index % Math.max(landmarks.length, 1)];

    if (dayNumber === 1) {
      return {
        dayNumber,
        title: `Arrive in ${getDestinationTitle(primaryDestination)}`,
        summary:
          "Arrive, settle in and meet your tour expert for a journey briefing.",
      };
    }

    if (dayNumber === days) {
      return {
        dayNumber,
        title: "Departure",
        summary: "After breakfast, check out and continue with onward travel.",
      };
    }

    return {
      dayNumber,
      title: landmark ? `${landmark} Exploration` : `${route} Trail`,
      summary:
        "Follow a guided day of heritage walks, cultural interpretation and local experiences.",
    };
  });
}

function createFacts(
  tour: PublicTour,
  departures: PublicTourDeparture[],
  destinations: PublicDestination[],
  primaryDestination: PublicDestination
): TourFact[] {
  const bestDeparture = getBestDeparture(departures);
  const seatCount = bestDeparture?.seatsAvailable || 0;
  const seats = bestDeparture
    ? seatCount > 0
      ? `${seatCount} ${seatCount === 1 ? "Seat" : "Seats"}`
      : "Sold Out"
    : "Seats on Request";

  return [
    {
      icon: Clock3,
      label: "Duration",
      value: getDurationLabel(tour),
    },
    {
      icon: TrendingUp,
      label: "Start / End",
      value: getStartEndLabel(tour, destinations, primaryDestination),
    },
    {
      icon: Users,
      label: "Seats",
      value: seats,
    },
    {
      icon: BarChart3,
      label: "Activity Level",
      value: getDifficultyLabel(tour),
    },
  ];
}

function getExpertImage(expert: PublicExpert) {
  return getHomeMediaUrl(expert.image || "/home assets/Khajuraho.webp");
}

function getExpertRole(expert: PublicExpert) {
  return (
    expert.expertiseTags[0] ||
    expert.qualifications[0] ||
    "Heritage Specialist"
  );
}

function getExpertBio(expert: PublicExpert) {
  return (
    expert.fullBiography ||
    "A heritage researcher and cultural storyteller who brings history, architecture and local traditions into clear focus."
  );
}

function getPrimaryDestinationForTour(
  tour: PublicTour,
  destinations: PublicDestination[]
) {
  const destinationIds = getTourDestinationIds(tour);

  return (
    destinationIds
      .map((destinationId) =>
        destinations.find((destination) => destination.destinationId === destinationId)
      )
      .find(Boolean) ||
    destinations.find((destination) => destination.destinationId === tour.destinationId)
  );
}

function enrichTourData(
  tour: PublicTour,
  departures: PublicTourDeparture[],
  destinations: PublicDestination[],
  experts: PublicExpert[],
  itineraries: PublicTourItinerary[],
  requestedTourId: string
): TourDetailData {
  const destinationIds = getTourDestinationIds(tour);
  const linkedDestinations = destinationIds
    .map((destinationId) =>
      destinations.find((destination) => destination.destinationId === destinationId)
    )
    .filter((destination): destination is PublicDestination => Boolean(destination));
  const primaryDestination =
    getPrimaryDestinationForTour(tour, linkedDestinations) ||
    getPrimaryDestinationForTour(tour, destinations) ||
    createFallbackDetail(requestedTourId).primaryDestination;
  const tourDepartures = departures
    .filter((departure) => departure.tourId === tour.tourId)
    .sort(
      (left, right) =>
        getDateValue(left.departureDate) - getDateValue(right.departureDate)
    );
  const expert =
    experts.find((item) => item.expertId === tour.expertId) ||
    createFallbackExpert();
  const itinerary =
    itineraries.find((item) => item.tourId === tour.tourId) || null;

  return {
    tour,
    departures:
      tourDepartures.length > 0
        ? tourDepartures
        : [createFallbackDeparture(tour)],
    destinations:
      linkedDestinations.length > 0 ? linkedDestinations : [primaryDestination],
    itinerary,
    primaryDestination,
    expert,
  };
}

function findRequestedTour(tours: PublicTour[], requestedTourId: string) {
  const requestedCode = normalizeCode(decodeURIComponent(requestedTourId));
  const requestedSlug = slugify(decodeURIComponent(requestedTourId));

  return (
    tours.find(
      (tour) =>
        normalizeCode(tour.tourId) === requestedCode ||
        slugify(tour.tourName) === requestedSlug ||
        tour.id === requestedTourId
    ) || null
  );
}

export function SingleTourPage({ tourId }: { tourId: string }) {
  const router = useRouter();
  const fallbackDetail = useMemo(() => createFallbackDetail(tourId), [tourId]);
  const [detail, setDetail] = useState<TourDetailData>(fallbackDetail);
  const [activeTab, setActiveTab] = useState<TourTab>("summary");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartureId, setSelectedDepartureId] = useState("");
  const [travellerCounts, setTravellerCounts] = useState<TravellerCounts>({
    adults: 1,
    children: 0,
    infants: 0,
  });
  const [selectedAccommodationOptionId, setSelectedAccommodationOptionId] =
    useState("");
  const [acceptedBookingTermsKey, setAcceptedBookingTermsKey] = useState("");
  const [areTravellerDetailsComplete, setAreTravellerDetailsComplete] =
    useState(false);
  const [travellerDetailForms, setTravellerDetailForms] = useState<
    Record<string, TravellerDetailForm>
  >({});
  const [checkoutStatus, setCheckoutStatus] =
    useState<CheckoutStatus>("idle");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const paymentOrderRef = useRef<BookingPaymentOrder | null>(null);
  const pendingPaymentCancellationRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTour() {
      setIsLoading(true);

      try {
        const [
          toursResponse,
          departuresResponse,
          destinationsResponse,
          expertsResponse,
          itinerariesResponse,
        ] = await Promise.all([
          listPublicTours(),
          listPublicTourDepartures(),
          listPublicDestinations(),
          listPublicExperts(),
          listPublicTourItineraries().catch(() => null),
        ]);
        const matchedTour = findRequestedTour(toursResponse.data.tours, tourId);

        if (isMounted && matchedTour) {
          setDetail(
            enrichTourData(
              matchedTour,
              departuresResponse.data.departures,
              destinationsResponse.data.destinations,
              expertsResponse.data.experts,
              itinerariesResponse?.data.itineraries || [],
              tourId
            )
          );
        }
      } catch {
        if (isMounted) {
          setDetail(createFallbackDetail(tourId));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTour();

    return () => {
      isMounted = false;
    };
  }, [tourId]);

  const galleryImages = useMemo(
    () => getTourImages(detail.tour, detail.destinations),
    [detail]
  );
  const selectedImage = galleryImages[selectedImageIndex] || galleryImages[0];
  const bestDeparture = useMemo(
    () => getBestDeparture(detail.departures),
    [detail.departures]
  );
  const price = getLowestPrice(detail.departures);
  const selectedDeparture = useMemo(
    () => getSelectedDeparture(detail.departures, selectedDepartureId),
    [detail.departures, selectedDepartureId]
  );
  const selectedDepartureKey = selectedDeparture
    ? getDepartureIdentifier(selectedDeparture)
    : "";
  const selectedPricedDeparture = useMemo(
    () => (selectedDeparture ? toPricedDeparture(selectedDeparture) : null),
    [selectedDeparture]
  );
  const selectedChildren = useMemo(
    () =>
      createChildInputs(
        travellerCounts.children,
        travellerCounts.infants,
        travellerDetailForms
      ),
    [
      travellerCounts.children,
      travellerCounts.infants,
      travellerDetailForms,
    ]
  );
  const totalTravellers = getTotalTravellers(travellerCounts);
  const completeTravellerDetailForms = useMemo(
    () => getCompleteTravellerDetailForms(travellerCounts, travellerDetailForms),
    [travellerCounts, travellerDetailForms]
  );
  const travellerDetailsKey = useMemo(
    () => JSON.stringify(completeTravellerDetailForms),
    [completeTravellerDetailForms]
  );
  const bookingValidationErrors = selectedDeparture
    ? validateDeparturePaymentReadiness(selectedDeparture, totalTravellers)
    : ["Select a scheduled departure."];
  const bookingValidationKey = bookingValidationErrors.join("|");
  const selectedAccommodationOption = useMemo(() => {
    if (!selectedPricedDeparture || bookingValidationKey) {
      return undefined;
    }

    try {
      const accommodationOptions = generateOccupancyOptions({
        adults: travellerCounts.adults,
        children: selectedChildren,
        selectedDeparture: selectedPricedDeparture,
      });

      return (
        accommodationOptions.find(
          (option) => option.id === selectedAccommodationOptionId
        ) || accommodationOptions[0]
      );
    } catch {
      return undefined;
    }
  }, [
    bookingValidationKey,
    selectedAccommodationOptionId,
    selectedPricedDeparture,
    selectedChildren,
    travellerCounts.adults,
  ]);
  const bookingSubtotal = selectedAccommodationOption?.total ?? 0;
  const resolvedSelectedAccommodationOptionId =
    selectedAccommodationOption?.id || selectedAccommodationOptionId;
  const isAccommodationSelected = Boolean(resolvedSelectedAccommodationOptionId);
  const canBookSeat = Boolean(
    !isLoading &&
      selectedDepartureKey &&
      isAccommodationSelected &&
      areTravellerDetailsComplete &&
      selectedAccommodationOption &&
      bookingSubtotal > 0 &&
      bookingValidationErrors.length === 0
  );
  const bookingCompletionKey = canBookSeat
    ? [
        selectedDepartureKey,
        resolvedSelectedAccommodationOptionId,
        totalTravellers,
        bookingSubtotal,
        travellerDetailsKey,
      ].join("|")
    : "";
  const hasAcceptedBookingTerms = Boolean(
    bookingCompletionKey && acceptedBookingTermsKey === bookingCompletionKey
  );
  const facts = useMemo(
    () =>
      createFacts(
        detail.tour,
        detail.departures,
        detail.destinations,
        detail.primaryDestination
      ),
    [detail]
  );
  const itineraryDays = useMemo(
    () => createItineraryDays(detail.tour, detail.destinations, detail.itinerary),
    [detail]
  );

  useEffect(() => {
    const root = document.documentElement;
    let frameId = 0;

    const updateDockedState = () => {
      frameId = 0;

      const panel = document.getElementById("tour-detail-panel");
      root.classList.toggle(
        "tour-tabs-docked",
        Boolean(panel && panel.getBoundingClientRect().top <= 0)
      );
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateDockedState);
    };

    updateDockedState();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      root.classList.remove("tour-tabs-docked");
    };
  }, []);

  const cancelPaymentOrder = useCallback((orderId: string) => {
    const cancellation = cancelBookingPaymentOrder(orderId)
      .catch(() => undefined)
      .then(() => undefined);

    pendingPaymentCancellationRef.current = cancellation;

    void cancellation.finally(() => {
      if (pendingPaymentCancellationRef.current === cancellation) {
        pendingPaymentCancellationRef.current = null;
      }
    });

    return cancellation;
  }, []);

  const clearPaymentOrderState = useCallback(() => {
    paymentOrderRef.current = null;

    setPaymentFeedback("");
  }, []);

  const resetPaymentAttempt = useCallback(() => {
    const orderId = paymentOrderRef.current?.checkout.orderId;

    if (orderId) {
      void cancelPaymentOrder(orderId);
    }

    clearPaymentOrderState();
  }, [cancelPaymentOrder, clearPaymentOrderState]);

  const handleSelectedDepartureIdChange = useCallback(
    (value: SetStateAction<string>) => {
      resetPaymentAttempt();
      setSelectedDepartureId(value);
    },
    [resetPaymentAttempt]
  );

  const handleSelectedAccommodationOptionIdChange = useCallback(
    (value: SetStateAction<string>) => {
      resetPaymentAttempt();
      setSelectedAccommodationOptionId(value);
    },
    [resetPaymentAttempt]
  );

  const handleTravellerCountsChange = useCallback(
    (value: SetStateAction<TravellerCounts>) => {
      resetPaymentAttempt();
      setTravellerCounts(value);
    },
    [resetPaymentAttempt]
  );

  const handleTravellerDetailsChange = useCallback(
    (forms: Record<string, TravellerDetailForm>) => {
      resetPaymentAttempt();
      setTravellerDetailForms(forms);
    },
    [resetPaymentAttempt]
  );

  async function openRazorpayCheckout(order: BookingPaymentOrder) {
    await loadRazorpayCheckoutScript();

    if (!window.Razorpay) {
      throw new Error("Razorpay checkout could not be opened");
    }

    const cancelOpenPaymentOrder = () => {
      void cancelPaymentOrder(order.checkout.orderId);
      clearPaymentOrderState();
    };
    let didReceivePaymentResponse = false;
    const checkout = new window.Razorpay({
      amount: order.checkout.amount,
      currency: order.checkout.currency,
      description: order.checkout.description,
      key: order.checkout.key,
      name: order.checkout.name,
      order_id: order.checkout.orderId,
      prefill: order.checkout.prefill,
      retry: {
        enabled: false,
      },
      theme: {
        color: "#d47220",
      },
      handler: (paymentResponse) => {
        didReceivePaymentResponse = true;
        setCheckoutStatus("verifying");
        setPaymentFeedback("Verifying payment and confirming your booking...");

        verifyBookingPayment(paymentResponse)
          .then((verificationResponse) => {
            const { booking, confirmationToken } = verificationResponse.data;

            router.push(
              `/booking-confirmed/${booking.id}?token=${encodeURIComponent(
                confirmationToken
              )}`
            );
          })
          .catch((error: unknown) => {
            setCheckoutStatus("idle");
            setPaymentFeedback(
              error instanceof Error
                ? error.message
                : "Payment verification failed. Please contact support."
            );
          });
      },
      modal: {
        ondismiss: () => {
          if (didReceivePaymentResponse) {
            return;
          }

          setCheckoutStatus("idle");
          cancelOpenPaymentOrder();
          setPaymentFeedback(
            "Payment cancelled. You can start a new payment from this page."
          );
        },
      },
    });

    checkout.on("payment.failed", (failureResponse) => {
      setCheckoutStatus("idle");
      cancelOpenPaymentOrder();
      setPaymentFeedback(
        failureResponse.error?.description ||
          failureResponse.error?.reason ||
          "Payment failed. You can start a new payment from this page."
      );
    });

    flushSync(() => setCheckoutStatus("gateway_open"));
    checkout.open();
  }

  async function handleBookSeat() {
    if (
      !canBookSeat ||
      !hasAcceptedBookingTerms ||
      !selectedAccommodationOption ||
      !selectedDeparture ||
      checkoutStatus !== "idle"
    ) {
      return;
    }

    setCheckoutStatus("creating");
    setPaymentFeedback("");

    try {
      await pendingPaymentCancellationRef.current;

      const order = (
        await createBookingPaymentOrder(
          createBookingPayload({
            accommodationOption: selectedAccommodationOption,
            departure: selectedDeparture,
            forms: completeTravellerDetailForms,
            tour: detail.tour,
            travellerCounts,
          })
        )
      ).data;

      paymentOrderRef.current = order;
      await openRazorpayCheckout(order);
    } catch (error) {
      setCheckoutStatus("idle");
      setPaymentFeedback(
        error instanceof Error
          ? error.message
          : "Payment could not be started. Please try again."
      );
    }
  }

  return (
    <main className="min-h-screen bg-background text-secondary">
      <Header />
      <PaymentProceedingOverlay checkoutStatus={checkoutStatus} />

      <section className="mx-auto grid w-full max-w-[1300px] gap-5 px-5 pb-7 pt-10 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-0">
        <div className="min-w-0">
          <Breadcrumbs tourName={detail.tour.tourName} />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
                {detail.tour.tourName}
              </h1>
              <TourMeta
                destinations={detail.destinations}
                primaryDestination={detail.primaryDestination}
                tour={detail.tour}
              />
            </div>
            {isLoading ? (
              <span className="h-7 w-24 animate-pulse rounded-full bg-border" />
            ) : null}
          </div>

          <TourGallery
            images={galleryImages}
            selectedImage={selectedImage}
            selectedImageIndex={selectedImageIndex}
            title={detail.tour.tourName}
            tourType={detail.tour.category || detail.tour.tourType}
            onSelectImage={setSelectedImageIndex}
          />

          <TourTabs
            activeTab={activeTab}
            departures={detail.departures}
            facts={facts}
            itineraryDays={itineraryDays}
            onTabChange={setActiveTab}
            itinerary={detail.itinerary}
            primaryDestination={detail.primaryDestination}
            expert={detail.expert}
            selectedAccommodationOptionId={selectedAccommodationOptionId}
            selectedDepartureId={selectedDepartureId}
            setSelectedAccommodationOptionId={
              handleSelectedAccommodationOptionIdChange
            }
            setSelectedDepartureId={handleSelectedDepartureIdChange}
            setTravellerCounts={handleTravellerCountsChange}
            onTravellerDetailsCompleteChange={setAreTravellerDetailsComplete}
            onTravellerDetailsChange={handleTravellerDetailsChange}
            tour={detail.tour}
            travellerCounts={travellerCounts}
          />
        </div>

        <aside className="space-y-2.5 lg:sticky lg:top-[112px] lg:self-start">
          <PriceCard
            bestDeparture={bestDeparture}
            price={price}
            tour={detail.tour}
          />
          <SidebarBookingSummary
            selectedAccommodationOption={selectedAccommodationOption}
            selectedDeparture={selectedDeparture}
            subtotal={bookingSubtotal}
            tour={detail.tour}
            travellerCounts={travellerCounts}
          />
          <SeatBookingActionCard
            accepted={hasAcceptedBookingTerms}
            canBook={canBookSeat}
            checkoutStatus={checkoutStatus}
            onAcceptedChange={(accepted) =>
              setAcceptedBookingTermsKey(accepted ? bookingCompletionKey : "")
            }
            onBook={handleBookSeat}
            paymentFeedback={paymentFeedback}
            selectedDeparture={selectedDeparture}
            tour={detail.tour}
          />
          <HelpCard />
        </aside>
      </section>
    </main>
  );
}

function PaymentProceedingOverlay({
  checkoutStatus,
}: {
  checkoutStatus: CheckoutStatus;
}) {
  const shouldShowOverlay =
    checkoutStatus === "creating" || checkoutStatus === "verifying";

  useEffect(() => {
    if (!shouldShowOverlay) {
      return;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [shouldShowOverlay]);

  if (!shouldShowOverlay || typeof document === "undefined") {
    return null;
  }

  const message =
    checkoutStatus === "verifying"
      ? "Confirming your payment. Please wait..."
      : "Please wait while we open the secure payment window.";

  return createPortal(
    <div
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[2147483647] grid place-items-center bg-white px-5 text-center text-secondary"
      role="status"
    >
      <div className="grid max-w-[360px] place-items-center">
        <span className="size-14 animate-spin rounded-full border-4 border-primary/18 border-t-primary" />
        <h2 className="mt-5 font-heading text-[28px] font-bold leading-tight">
          Payment proceeding...
        </h2>
        <p className="mt-3 font-sans text-[14px] font-medium leading-[1.6] text-secondary/68">
          {message}
        </p>
      </div>
    </div>,
    document.body
  );
}

function Breadcrumbs({ tourName }: { tourName: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-2.5 font-sans text-[15px] font-medium text-secondary/52">
      <Link href="/" className="transition-colors hover:text-primary">
        Home
      </Link>
      <ChevronRight className="size-3.5 text-secondary/35" />
      <Link href="/tour-calendar" className="transition-colors hover:text-primary">
        Tours
      </Link>
      <ChevronRight className="size-3.5 text-secondary/35" />
      <span className="font-semibold text-secondary/62">{tourName}</span>
    </nav>
  );
}

function TourMeta({
  destinations,
  primaryDestination,
  tour,
}: {
  destinations: PublicDestination[];
  primaryDestination: PublicDestination;
  tour: PublicTour;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-[15px] font-semibold text-secondary">
      <MetaItem icon={Clock3} label={getDurationLabel(tour)} />
      <MetaItem
        icon={Users}
        label={`From ${getRouteLabel(tour, destinations, primaryDestination)}`}
      />
      <MetaItem icon={TrendingUp} label={getDifficultyLabel(tour)} />
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 text-primary" strokeWidth={1.9} />
      {label}
    </span>
  );
}

function TourGallery({
  images,
  onSelectImage,
  selectedImage,
  selectedImageIndex,
  title,
  tourType,
}: {
  images: string[];
  onSelectImage: (index: number) => void;
  selectedImage: string;
  selectedImageIndex: number;
  title: string;
  tourType: string;
}) {
  const thumbnails = images.slice(0, 5);

  function moveImage(direction: number) {
    const nextIndex =
      (selectedImageIndex + direction + thumbnails.length) % thumbnails.length;

    onSelectImage(nextIndex);
  }

  return (
    <section className="mt-5">
      <div className="relative aspect-[1.95/1] overflow-hidden rounded-[8px] bg-border shadow-[0_12px_30px_rgba(67,43,27,0.1)]">
        <Image
          src={selectedImage}
          alt={title}
          fill
          priority
          sizes="(min-width: 1024px) 860px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_58%,rgba(0,0,0,0.42)_100%)]" />
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-[6px] border border-white/45 bg-secondary/75 px-3 py-2 font-sans text-[15px] font-normal text-white shadow-[0_10px_20px_rgba(0,0,0,0.18)] backdrop-blur-sm">
          {tourType || "Heritage Walk"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-2">
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => moveImage(-1)}
          className="grid size-9 place-items-center rounded-full border border-border bg-white text-primary shadow-[0_8px_18px_rgba(67,43,27,0.08)] transition-colors hover:bg-primary hover:text-white"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="grid min-w-0 grid-cols-5 gap-2">
          {thumbnails.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`View tour photo ${index + 1}`}
              onClick={() => onSelectImage(index)}
              className={cn(
                "relative h-[68px] overflow-hidden rounded-[8px] border bg-border transition-all sm:h-[74px]",
                index === selectedImageIndex
                  ? "border-primary shadow-[0_0_0_3px_rgba(212,114,32,0.16)]"
                  : "border-transparent hover:border-primary/60"
              )}
            >
              <Image
                src={image}
                alt={`${title} thumbnail ${index + 1}`}
                fill
                sizes="150px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => moveImage(1)}
          className="grid size-9 place-items-center rounded-full border border-border bg-white text-primary shadow-[0_8px_18px_rgba(67,43,27,0.08)] transition-colors hover:bg-primary hover:text-white"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </section>
  );
}

function TourTabs({
  activeTab,
  departures,
  expert,
  facts,
  itinerary,
  itineraryDays,
  onTabChange,
  primaryDestination,
  selectedAccommodationOptionId,
  selectedDepartureId,
  setSelectedAccommodationOptionId,
  setSelectedDepartureId,
  setTravellerCounts,
  onTravellerDetailsCompleteChange,
  onTravellerDetailsChange,
  tour,
  travellerCounts,
}: {
  activeTab: TourTab;
  departures: PublicTourDeparture[];
  expert: PublicExpert;
  facts: TourFact[];
  itinerary: PublicTourItinerary | null;
  itineraryDays: ItineraryDay[];
  onTabChange: (tab: TourTab) => void;
  primaryDestination: PublicDestination;
  selectedAccommodationOptionId: string;
  selectedDepartureId: string;
  setSelectedAccommodationOptionId: Dispatch<SetStateAction<string>>;
  setSelectedDepartureId: Dispatch<SetStateAction<string>>;
  setTravellerCounts: Dispatch<SetStateAction<TravellerCounts>>;
  onTravellerDetailsCompleteChange: (isComplete: boolean) => void;
  onTravellerDetailsChange: (forms: Record<string, TravellerDetailForm>) => void;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
}) {
  useEffect(() => {
    let frameId = 0;

    const updateActiveTab = () => {
      frameId = 0;

      const observedSections = tabs
        .map((tab) => ({
          tab,
          element: document.getElementById(tab.sectionId),
        }))
        .filter(
          (item): item is {
            tab: (typeof tabs)[number];
            element: HTMLElement;
          } => Boolean(item.element)
        );

      if (observedSections.length === 0) {
        return;
      }

      const tabBar = document.querySelector<HTMLElement>("[data-tour-tabs]");
      const activationLine =
        (tabBar?.getBoundingClientRect().height || 56) + 40;
      const activeSection = observedSections.reduce(
        (current, section) =>
          section.element.getBoundingClientRect().top <= activationLine
            ? section
            : current,
        observedSections[0]
      );

      if (activeSection.tab.value !== activeTab) {
        onTabChange(activeSection.tab.value);
      }
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateActiveTab);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [activeTab, onTabChange]);

  function handleTabClick(tab: (typeof tabs)[number]) {
    onTabChange(tab.value);
    document
      .getElementById(tab.sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      id="tour-detail-panel"
      className="mt-5"
    >
      <div
        data-tour-tabs
        className="sticky top-0 z-[2147483647] overflow-hidden rounded-[8px] border border-border bg-card shadow-[0_14px_34px_rgba(67,43,27,0.09)]"
      >
        <div className="grid w-full grid-cols-2 sm:grid-cols-3 xl:grid-cols-[0.9fr_0.95fr_1.3fr_1.35fr_1fr]">
          {tabs.map((tab) => {
            const { icon: Icon, label, value } = tab;

            return (
              <button
                key={value}
                type="button"
                aria-controls={tab.sectionId}
                aria-pressed={activeTab === value}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "relative flex min-h-12 items-center justify-center gap-2 border-r border-b border-border px-2 font-sans text-[14px] font-semibold transition-colors last:border-r-0 sm:text-[15px] xl:border-b-0",
                  activeTab === value
                    ? "bg-muted/45 text-primary"
                    : "text-secondary hover:bg-primary/5 hover:text-primary"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="min-w-0 text-center leading-tight">
                  {label}
                </span>
                {activeTab === value ? (
                  <span className="absolute bottom-0 left-5 right-5 h-0.5 bg-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-5">
        <section
          id="summary"
          className="scroll-mt-[64px] rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.07)] sm:p-5"
        >
          <SummaryPanel
            facts={facts}
            tour={tour}
          />
        </section>

        <section
          id="itinerary"
          className="scroll-mt-[64px] rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.07)] sm:p-5"
        >
          <ItineraryPanel
            itinerary={itinerary}
            itineraryDays={itineraryDays}
            primaryDestination={primaryDestination}
            tour={tour}
          />
        </section>

        <section
          id="inclusions"
          className="scroll-mt-[64px] rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.07)] sm:p-5"
        >
          <InclusionsPanel tour={tour} />
        </section>

        <section
          id="departure-pricing"
          className="scroll-mt-[64px] rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.07)] sm:p-5"
        >
          <PricingPanel
            departures={departures}
            selectedAccommodationOptionId={selectedAccommodationOptionId}
            selectedDepartureId={selectedDepartureId}
            setSelectedAccommodationOptionId={setSelectedAccommodationOptionId}
            setSelectedDepartureId={setSelectedDepartureId}
            setTravellerCounts={setTravellerCounts}
            onTravellerDetailsCompleteChange={onTravellerDetailsCompleteChange}
            onTravellerDetailsChange={onTravellerDetailsChange}
            tour={tour}
            travellerCounts={travellerCounts}
          />
        </section>

        <section
          id="tour-expert"
          className="scroll-mt-[64px] rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.07)] sm:p-5"
        >
          <ExpertPanel expert={expert} />
        </section>
      </div>
    </section>
  );
}

function SummaryPanel({
  facts,
  tour,
}: {
  facts: TourFact[];
  tour: PublicTour;
}) {
  return (
    <>
      <SectionTitle title="Tour Overview" />
      <p className="mt-3 max-w-[820px] font-sans text-[15px] font-medium leading-[1.7] text-secondary/82">
        {tour.description ||
          "A thoughtfully designed tour with expert-led storytelling, local culture and curated heritage experiences."}
      </p>
      {tour.notes ? (
        <p className="mt-3 max-w-[820px] rounded-[6px] bg-muted px-3 py-2 font-sans text-[14px] font-semibold leading-[1.6] text-accent">
          {tour.notes}
        </p>
      ) : null}

      <FactGrid facts={facts} />
    </>
  );
}

function ItineraryPanel({
  itinerary,
  itineraryDays,
  primaryDestination,
  tour,
}: {
  itinerary: PublicTourItinerary | null;
  itineraryDays: ItineraryDay[];
  primaryDestination: PublicDestination;
  tour: PublicTour;
}) {
  const summary =
    itinerary?.itinerarySummary ||
    tour.description ||
    primaryDestination.shortDescription ||
    "Each day combines landmark visits, expert interpretation and time to absorb the destination.";

  return (
    <div>
      <SectionTitle title="Detailed Itinerary" />
      <ExpandableItinerarySummary key={summary} text={summary} />
      <DailyItinerary days={itineraryDays} />
    </div>
  );
}

function ExpandableItinerarySummary({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const summaryElement = summaryRef.current;

    if (!summaryElement) {
      return;
    }

    const updateCanExpand = () => {
      const lineHeight = Number.parseFloat(
        window.getComputedStyle(summaryElement).lineHeight
      );

      setCanExpand(
        Number.isFinite(lineHeight) &&
          summaryElement.scrollHeight > lineHeight * 5 + 1
      );
    };

    updateCanExpand();
    window.addEventListener("resize", updateCanExpand);

    return () => window.removeEventListener("resize", updateCanExpand);
  }, [text]);

  return (
    <div className="mt-3 max-w-[820px]">
      <p
        ref={summaryRef}
        className={cn(
          "font-sans text-[15px] font-medium leading-[1.7] text-secondary/78",
          !isExpanded && "line-clamp-5"
        )}
      >
        {text}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-2 font-sans text-[15px] font-bold text-primary transition-colors hover:text-accent"
        >
          {isExpanded ? "Read Less" : "Read More"}
        </button>
      ) : null}
    </div>
  );
}

function InclusionsPanel({ tour }: { tour: PublicTour }) {
  const inclusions =
    tour.inclusions.length > 0
      ? tour.inclusions
      : [
          "Expert-led tour guidance",
          "Curated sightseeing and heritage walks",
          "Accommodation on twin sharing basis",
          "Local transfers as mentioned in itinerary",
        ];
  const exclusions =
    tour.exclusions.length > 0
      ? tour.exclusions
      : [
          "Airfare, visa and travel insurance",
          "Personal expenses and optional activities",
          "Meals not mentioned in the itinerary",
          "Tips, porterage and camera charges",
        ];

  return (
    <div>
      <SectionTitle title="Inclusions / Exclusions" />
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <ListBlock icon={Check} items={inclusions} title="Inclusions" />
        <ListBlock icon={X} items={exclusions} title="Exclusions" />
      </div>
    </div>
  );
}

const GST_PERCENTAGE = 5;

function toPricedDeparture(departure: PublicTourDeparture): PricedDeparture {
  return {
    departureId: departure.departureId,
    tourId: departure.tourId,
    destinationId: departure.destinationId,
    departureDate: departure.departureDate,
    returnDate: departure.returnDate,
    seatsAvailable: departure.seatsAvailable,
    priceAdult: departure.priceAdult,
    priceExtraBed: departure.priceExtraBed,
    priceChildWithoutExtraBed: departure.priceChildWithoutExtraBed,
    singleOccupancy: departure.singleOccupancy,
    depositType: departure.depositType || "fixed",
    depositValue: departure.depositValue || 0,
    depositAppliesTo: departure.depositAppliesTo || "per_person",
    balanceDueDaysBefore: departure.balanceDueDaysBefore || 0,
    earlyBirdOffer: departure.earlyBirdOffer || null,
    bookingDeadline: departure.bookingDeadline,
    status: departure.status || "scheduled",
    childPricingRules: departure.childPricingRules || [],
    roomPolicy: departure.roomPolicy,
  };
}

function createChildInputs(
  childCount: number,
  infantCount = 0,
  travellerDetailForms?: Record<string, TravellerDetailForm>
) {
  const childInputs = Array.from({ length: childCount }, (_item, index) => {
    const id = `child-${index + 1}`;
    const dateOfBirth = travellerDetailForms?.[id]?.dateOfBirth.trim();

    return dateOfBirth ? { id, dateOfBirth } : { id, age: 7 };
  });
  const infantInputs = Array.from({ length: infantCount }, (_item, index) => {
    const id = `infant-${index + 1}`;
    const dateOfBirth = travellerDetailForms?.[id]?.dateOfBirth.trim();

    return dateOfBirth ? { id, dateOfBirth } : { id, age: 2 };
  });

  return [...childInputs, ...infantInputs];
}

function formatTravellerSummary(counts: TravellerCounts) {
  return [
    counts.adults
      ? `${counts.adults} ${counts.adults === 1 ? "Adult" : "Adults"}`
      : "",
    counts.children
      ? `${counts.children} ${counts.children === 1 ? "Child" : "Children"}`
      : "",
    counts.infants
      ? `${counts.infants} ${counts.infants === 1 ? "Infant" : "Infants"}`
      : "",
  ]
    .filter(Boolean)
    .join(", ") || "1 Adult";
}

function formatPricingCategory(category: PricingCategory) {
  switch (category) {
    case "adult":
      return "Standard Guests";
    case "extra_bed":
      return "Extra Bed";
    case "child_without_extra_bed":
      return "Child Without Extra Bed";
    case "single_occupancy":
      return "Single Occupancy";
    case "free_child":
      return "Complimentary Child";
  }
}

type PricingRow = {
  category: PricingCategory;
  count: number;
  key: string;
  unitPrice: number;
};

const pricingCategorySortOrder: Record<PricingCategory, number> = {
  adult: 1,
  extra_bed: 2,
  child_without_extra_bed: 3,
  single_occupancy: 4,
  free_child: 5,
};

function getPricingRows(option: AccommodationOption) {
  const rows = new Map<string, PricingRow>();

  option.rooms
    .flatMap((room) => room.allocations)
    .forEach((allocation) => {
      const key = [allocation.pricingCategory, allocation.price].join("-");
      const existingRow = rows.get(key);

      if (existingRow) {
        existingRow.count += 1;
        return;
      }

      rows.set(key, {
        category: allocation.pricingCategory,
        count: 1,
        key,
        unitPrice: allocation.price,
      });
    });

  return Array.from(rows.values()).sort((left, right) => {
    const categoryDifference =
      pricingCategorySortOrder[left.category] -
      pricingCategorySortOrder[right.category];

    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    return right.unitPrice - left.unitPrice;
  });
}

function formatBalanceDueDate(value: Date | null) {
  return value ? formatDate(value.toISOString()) : "-";
}

function DateOfBirthPicker({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const selectedDate = parseDatePickerValue(value);
  const today = new Date();
  const currentYear = today.getFullYear();
  const defaultBirthYear = currentYear - 30;
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    selectedDate?.getMonth() ?? today.getMonth()
  );
  const [visibleYear, setVisibleYear] = useState(
    selectedDate?.getFullYear() ?? defaultBirthYear
  );
  const pickerRef = useRef<HTMLDivElement>(null);
  const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate();
  const firstWeekday = new Date(visibleYear, visibleMonth, 1).getDay();
  const selectedValue = selectedDate ? formatDatePickerStorageValue(selectedDate) : "";
  const displayValue = formatDatePickerValue(value);
  const yearOptions = Array.from({ length: 101 }, (_item, index) => currentYear - index);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  function selectDate(day: number) {
    const nextDate = new Date(visibleYear, visibleMonth, day);

    if (nextDate > today) {
      return;
    }

    onChange(formatDatePickerStorageValue(nextDate));
    setIsOpen(false);
  }

  function moveMonth(direction: number) {
    const nextMonthDate = new Date(visibleYear, visibleMonth + direction, 1);

    setVisibleMonth(nextMonthDate.getMonth());
    setVisibleYear(nextMonthDate.getFullYear());
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15",
          displayValue ? "text-secondary" : "text-secondary/40",
          isOpen && "border-primary ring-3 ring-primary/15"
        )}
      >
        <span>{displayValue || "Date of Birth *"}</span>
        <CalendarDays className="size-4 text-primary" strokeWidth={1.8} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-2rem))] rounded-[8px] border border-primary/25 bg-card p-3 font-sans text-secondary shadow-[0_18px_42px_rgba(67,43,27,0.16)]">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Select month</span>
              <select
                aria-label="Select birth month"
                className="h-9 w-full appearance-none rounded-[6px] border border-border bg-background px-2 pr-7 text-[13px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
                value={visibleMonth}
                onChange={(event) => setVisibleMonth(Number(event.target.value))}
              >
                {datePickerMonthLabels.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
            </label>

            <label className="relative w-[96px]">
              <span className="sr-only">Select year</span>
              <select
                aria-label="Select birth year"
                className="h-9 w-full appearance-none rounded-[6px] border border-border bg-background px-2 pr-7 text-[13px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
                value={visibleYear}
                onChange={(event) => setVisibleYear(Number(event.target.value))}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
            </label>

            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-white text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-white text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {datePickerWeekdayLabels.map((weekday) => (
              <span
                key={weekday}
                className="py-1 text-[11px] font-semibold uppercase text-secondary/48"
              >
                {weekday}
              </span>
            ))}
            {Array.from({ length: firstWeekday }, (_item, index) => (
              <span key={`empty-${index}`} aria-hidden="true" />
            ))}
            {Array.from({ length: daysInMonth }, (_item, index) => {
              const day = index + 1;
              const date = new Date(visibleYear, visibleMonth, day);
              const storageValue = formatDatePickerStorageValue(date);
              const isSelected = storageValue === selectedValue;
              const isFutureDate = date > today;

              return (
                <button
                  key={storageValue}
                  type="button"
                  disabled={isFutureDate}
                  onClick={() => selectDate(day)}
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-[12px] font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-white"
                      : "text-secondary hover:bg-primary/10 hover:text-primary",
                    isFutureDate &&
                      "cursor-not-allowed text-secondary/28 hover:bg-transparent hover:text-secondary/28"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PricingPanel({
  departures,
  selectedAccommodationOptionId,
  selectedDepartureId,
  setSelectedAccommodationOptionId,
  setSelectedDepartureId,
  setTravellerCounts,
  onTravellerDetailsCompleteChange,
  onTravellerDetailsChange,
  tour,
  travellerCounts,
}: {
  departures: PublicTourDeparture[];
  selectedAccommodationOptionId: string;
  selectedDepartureId: string;
  setSelectedAccommodationOptionId: Dispatch<SetStateAction<string>>;
  setSelectedDepartureId: Dispatch<SetStateAction<string>>;
  setTravellerCounts: Dispatch<SetStateAction<TravellerCounts>>;
  onTravellerDetailsCompleteChange: (isComplete: boolean) => void;
  onTravellerDetailsChange: (forms: Record<string, TravellerDetailForm>) => void;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
}) {
  const selectedDeparture = getSelectedDeparture(departures, selectedDepartureId);
  const pricedDeparture = selectedDeparture
    ? toPricedDeparture(selectedDeparture)
    : null;
  const resolvedSelectedDepartureId = selectedDeparture
    ? getDepartureIdentifier(selectedDeparture)
    : "";
  const selectedDepartureIndex = Math.max(
    0,
    departures.findIndex(
      (departure) =>
        getDepartureIdentifier(departure) === resolvedSelectedDepartureId
    )
  );
  const maxTravellers =
    selectedDeparture?.seatsAvailable && selectedDeparture.seatsAvailable > 0
      ? selectedDeparture.seatsAvailable
      : 12;
  const totalTravellers = getTotalTravellers(travellerCounts);
  const travellerDetailTabs = useMemo(
    () => createTravellerDetailTabs(travellerCounts),
    [travellerCounts]
  );
  const [activeTravellerDetailId, setActiveTravellerDetailId] =
    useState("adult-1");
  const [travellerDetailForms, setTravellerDetailForms] = useState<
    Record<string, TravellerDetailForm>
  >(createInitialTravellerDetailForms);
  const activeTravellerDetailTab =
    travellerDetailTabs.find((tab) => tab.id === activeTravellerDetailId) ||
    travellerDetailTabs[0] || {
      description: "This traveller will serve as the contact person for the booking.",
      heading: "Lead Traveller",
      id: "adult-1",
      label: "Lead Traveller",
      travellerType: "adult",
    };
  const activeTravellerDetails = {
    ...defaultTravellerDetailForm,
    ...(travellerDetailForms[activeTravellerDetailTab.id] || {}),
  };
  const areAllTravellerDetailsComplete = useMemo(
    () =>
      travellerDetailTabs.length > 0 &&
      travellerDetailTabs.every((tab) => {
        const travellerDetails = {
          ...defaultTravellerDetailForm,
          ...(travellerDetailForms[tab.id] || {}),
        };
        return isTravellerDetailFormComplete(travellerDetails);
      }),
    [travellerDetailForms, travellerDetailTabs]
  );
  const childInputs = useMemo(
    () =>
      createChildInputs(
        travellerCounts.children,
        travellerCounts.infants,
        travellerDetailForms
      ),
    [travellerCounts.children, travellerCounts.infants, travellerDetailForms]
  );
  const departureValidationErrors = selectedDeparture
    ? validateDeparturePaymentReadiness(selectedDeparture, totalTravellers)
    : ["Select a scheduled departure."];
  const accommodationResult = (() => {
    if (!pricedDeparture || departureValidationErrors.length > 0) {
      return {
        options: [] as AccommodationOption[],
        error: "",
      };
    }

    try {
      return {
        options: generateOccupancyOptions({
          adults: travellerCounts.adults,
          children: childInputs,
          selectedDeparture: pricedDeparture,
        }),
        error: "",
      };
    } catch (error) {
      return {
        options: [] as AccommodationOption[],
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Accommodation options could not be generated.",
      };
    }
  })();
  const accommodationOptions = accommodationResult.options;
  const selectedAccommodationOption =
    accommodationOptions.find(
      (option) => option.id === selectedAccommodationOptionId
    ) || accommodationOptions[0];
  const resolvedSelectedAccommodationOptionId =
    selectedAccommodationOption?.id || "";
  const subtotal = selectedAccommodationOption?.total ?? 0;
  const gstAmount = Math.round((subtotal * GST_PERCENTAGE) / 100);
  const grandTotal = subtotal + gstAmount;
  const depositAmount =
    pricedDeparture && selectedAccommodationOption
      ? calculateDeposit({
          depositAppliesTo: pricedDeparture.depositAppliesTo,
          depositType: pricedDeparture.depositType,
          depositValue: pricedDeparture.depositValue,
          grandTotal,
          totalTravellers,
        })
      : 0;
  const balanceAmount = calculateBalance(grandTotal, depositAmount);
  const balanceDueDate = pricedDeparture
    ? calculateBalanceDueDate(
        pricedDeparture.departureDate,
        pricedDeparture.balanceDueDaysBefore
      )
    : null;

  useEffect(
    () =>
      listenForTravellerSessionChanges(() => {
        const leadTravellerForm = getLeadTravellerFormFromProfile(
          getTravellerSession()?.user ?? null
        );

        if (!leadTravellerForm) {
          return;
        }

        setTravellerDetailForms((current) => {
          if (hasEditedLeadTravellerForm(current["adult-1"])) {
            return current;
          }

          return {
            ...current,
            "adult-1": leadTravellerForm,
          };
        });
      }),
    []
  );

  useEffect(() => {
    onTravellerDetailsCompleteChange(areAllTravellerDetailsComplete);
  }, [areAllTravellerDetailsComplete, onTravellerDetailsCompleteChange]);

  useEffect(() => {
    onTravellerDetailsChange(
      getCompleteTravellerDetailForms(travellerCounts, travellerDetailForms)
    );
  }, [onTravellerDetailsChange, travellerCounts, travellerDetailForms]);

  function updateTravellerCount(key: TravellerCountKey, delta: number) {
    setTravellerCounts((current) => {
      const minimum = key === "adults" ? 1 : 0;
      const nextValue = Math.max(minimum, current[key] + delta);
      const nextCounts = {
        ...current,
        [key]: nextValue,
      };

      if (delta > 0 && getTotalTravellers(nextCounts) > maxTravellers) {
        return current;
      }

      return nextCounts;
    });
  }

  function moveDeparture(direction: number) {
    if (departures.length === 0) {
      return;
    }

    const nextIndex =
      (selectedDepartureIndex + direction + departures.length) %
      departures.length;

    setSelectedDepartureId(getDepartureIdentifier(departures[nextIndex]));
  }

  function updateActiveTravellerDetail(
    field: TravellerDetailField,
    value: TravellerDetailForm[TravellerDetailField]
  ) {
    setTravellerDetailForms((current) => ({
      ...current,
      [activeTravellerDetailTab.id]: {
        ...defaultTravellerDetailForm,
        ...(current[activeTravellerDetailTab.id] || {}),
        [field]: value,
      },
    }));
  }

  return (
    <div className="space-y-4">
      <BookingStep
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous departure"
              onClick={() => moveDeparture(-1)}
              className="grid size-8 place-items-center rounded-full border border-border bg-background text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next departure"
              onClick={() => moveDeparture(1)}
              className="grid size-8 place-items-center rounded-full border border-border bg-background text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
        step="1"
        title="Select Your Dates"
      >
        <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
          {departures.map((departure) => {
            const departureId = getDepartureIdentifier(departure);
            const isSelected = departureId === resolvedSelectedDepartureId;
            const fillProgress = getDepartureFillProgress(departure);
            const filledSeats = getDepartureFilledSeats(departure);
            const totalSeats = getDepartureTotalSeats(departure);

            return (
              <button
                key={departureId}
                type="button"
                onClick={() => setSelectedDepartureId(departureId)}
                className={cn(
                  "group/departure relative flex h-full w-full flex-col overflow-hidden rounded-[8px] border bg-card p-3 text-left font-sans shadow-[0_6px_14px_rgba(67,43,27,0.04)] transition-all hover:border-primary hover:shadow-[0_10px_20px_rgba(67,43,27,0.06)]",
                  isSelected
                    ? "border-primary ring-3 ring-primary/15"
                    : "border-primary/28"
                )}
              >
                <span className="grid gap-2 sm:grid-cols-2">
                  <span className="rounded-[7px] border border-primary/24 bg-primary/10 px-3 py-2 shadow-[0_8px_18px_rgba(158,92,54,0.08)]">
                    <span className="block text-[11px] font-semibold uppercase leading-none text-primary">
                      Start Date
                    </span>
                    <strong className="mt-1.5 block text-[16px] font-bold leading-none text-secondary">
                      {formatDate(departure.departureDate)}
                    </strong>
                  </span>
                  <span className="rounded-[7px] border border-accent/24 bg-accent/10 px-3 py-2 shadow-[0_8px_18px_rgba(74,46,30,0.08)]">
                    <span className="block text-[11px] font-semibold uppercase leading-none text-accent">
                      Return Date
                    </span>
                    <strong className="mt-1.5 block text-[16px] font-bold leading-none text-secondary">
                      {formatDate(departure.returnDate)}
                    </strong>
                  </span>
                </span>

                <span className="mt-3 block border-t border-border pt-3">
                  <span className="mb-2 flex items-center justify-between gap-3 text-[12px] font-semibold leading-none text-secondary/62">
                    <span>Seats</span>
                    <span className="font-bold text-primary">
                      {filledSeats}/{totalSeats}
                    </span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-[#e8edf1]">
                    <span
                      className={cn(
                        "block h-full rounded-full transition-[width] duration-300",
                        getSeatProgressColorClass(fillProgress)
                      )}
                      style={{ width: `${fillProgress}%` }}
                    />
                  </span>
                </span>

                <span className="sr-only">
                  {isSelected ? "Selected departure" : "Select departure"}
                </span>
              </button>
            );
          })}
        </div>
      </BookingStep>

      <BookingStep step="2" title="Add Traveller Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <TravellerCounter
            ageLabel="Above 12 years"
            label="Adult"
            minimum={1}
            value={travellerCounts.adults}
            onDecrease={() => updateTravellerCount("adults", -1)}
            onIncrease={() => updateTravellerCount("adults", 1)}
          />
          <TravellerCounter
            ageLabel="Above 6 to 12 years"
            label="Child"
            value={travellerCounts.children}
            onDecrease={() => updateTravellerCount("children", -1)}
            onIncrease={() => updateTravellerCount("children", 1)}
          />
          <TravellerCounter
            ageLabel="Below 6 years"
            label="Infant"
            value={travellerCounts.infants}
            onDecrease={() => updateTravellerCount("infants", -1)}
            onIncrease={() => updateTravellerCount("infants", 1)}
          />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-[6px] bg-muted px-3 py-2 font-sans text-[14px] font-medium leading-[1.5] text-secondary/72">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>
            <strong className="font-medium text-secondary">Please Note :</strong> Traveller
            details should match information on passport.
          </span>
        </div>

        {travellerDetailTabs.length > 1 ? (
          <div
            aria-label="Traveller detail tabs"
            className="mt-4 flex gap-2 overflow-x-auto rounded-[7px] border border-border bg-muted/35 p-1"
            role="tablist"
          >
            {travellerDetailTabs.map((travellerTab) => {
              const isSelected = travellerTab.id === activeTravellerDetailTab.id;

              return (
                <button
                  key={travellerTab.id}
                  aria-controls={`traveller-panel-${travellerTab.id}`}
                  aria-selected={isSelected}
                  className={cn(
                    "h-9 shrink-0 rounded-[6px] px-3 font-sans text-[14px] font-medium transition-colors focus:outline-none focus:ring-3 focus:ring-primary/15",
                    isSelected
                      ? "bg-primary text-white shadow-[0_5px_12px_rgba(212,114,32,0.18)]"
                      : "text-secondary/68 hover:bg-background hover:text-secondary"
                  )}
                  id={`traveller-tab-${travellerTab.id}`}
                  onClick={() => setActiveTravellerDetailId(travellerTab.id)}
                  role="tab"
                  type="button"
                >
                  {travellerTab.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          aria-labelledby={
            travellerDetailTabs.length > 1
              ? `traveller-tab-${activeTravellerDetailTab.id}`
              : undefined
          }
          className="mt-5"
          id={`traveller-panel-${activeTravellerDetailTab.id}`}
          role="tabpanel"
        >
          <h3 className="font-sans text-[14px] font-bold text-secondary">
            {activeTravellerDetailTab.heading}
          </h3>
          <p className="mt-1 font-sans text-[14px] font-medium text-secondary/64">
            {activeTravellerDetailTab.description}
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-[0.55fr_1.25fr_1.25fr]">
            <select
              aria-label={`${activeTravellerDetailTab.label} title`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.title}
              onChange={(event) =>
                updateActiveTravellerDetail("title", event.target.value)
              }
            >
              <option>Mr</option>
              <option>Ms</option>
              <option>Mrs</option>
              <option>Dr</option>
            </select>
            <input
              aria-label={`${activeTravellerDetailTab.label} first name`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.firstName}
              onChange={(event) =>
                updateActiveTravellerDetail("firstName", event.target.value)
              }
              placeholder="First Name *"
              type="text"
            />
            <input
              aria-label={`${activeTravellerDetailTab.label} last name`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.lastName}
              onChange={(event) =>
                updateActiveTravellerDetail("lastName", event.target.value)
              }
              placeholder="Last Name *"
              type="text"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              aria-label={`${activeTravellerDetailTab.label} email`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.email}
              onChange={(event) =>
                updateActiveTravellerDetail("email", event.target.value)
              }
              placeholder="Email *"
              type="email"
            />
            <DateOfBirthPicker
              key={`${activeTravellerDetailTab.id}-date-of-birth`}
              ariaLabel={`${activeTravellerDetailTab.label} date of birth`}
              value={activeTravellerDetails.dateOfBirth}
              onChange={(nextValue) =>
                updateActiveTravellerDetail("dateOfBirth", nextValue)
              }
            />
            <input
              aria-label={`${activeTravellerDetailTab.label} address`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.address}
              onChange={(event) =>
                updateActiveTravellerDetail("address", event.target.value)
              }
              placeholder="Address *"
              type="text"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[0.9fr_1fr_1.2fr]">
            <select
              aria-label={`${activeTravellerDetailTab.label} phone country code`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.phoneCountryCode}
              onChange={(event) =>
                updateActiveTravellerDetail(
                  "phoneCountryCode",
                  event.target.value
                )
              }
            >
              <option>India +91</option>
              <option>US +1</option>
              <option>UK +44</option>
              <option>Australia +61</option>
            </select>
            <input
              aria-label={`${activeTravellerDetailTab.label} mobile number`}
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
              value={activeTravellerDetails.mobileNumber}
              onChange={(event) =>
                updateActiveTravellerDetail("mobileNumber", event.target.value)
              }
              placeholder="Mobile Number *"
              type="tel"
            />
            <div className="flex h-11 items-center gap-4 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary">
              <span className="font-medium">Gender *</span>
              <label className="inline-flex items-center gap-1.5">
                <input
                  checked={activeTravellerDetails.gender === "male"}
                  name={`traveller-gender-${activeTravellerDetailTab.id}`}
                  onChange={() => updateActiveTravellerDetail("gender", "male")}
                  type="radio"
                />
                Male
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  checked={activeTravellerDetails.gender === "female"}
                  name={`traveller-gender-${activeTravellerDetailTab.id}`}
                  onChange={() =>
                    updateActiveTravellerDetail("gender", "female")
                  }
                  type="radio"
                />
                Female
              </label>
            </div>
          </div>
        </div>

        <p className="mt-4 font-sans text-[14px] font-medium text-secondary/72">
          {totalTravellers > 1
            ? "Traveller details can be completed for each traveller before payment."
            : "You will fill the remaining traveller data after payment."}
        </p>
      </BookingStep>

      <BookingStep step="3" title="Select Accommodation">
        <p className="font-sans text-[14px] font-medium text-secondary/68">
          Select an accommodation option for {totalTravellers} traveller
          {totalTravellers === 1 ? "" : "s"}.
        </p>
        {departureValidationErrors.length > 0 ? (
          <div className="mt-3 rounded-[7px] border border-destructive/20 bg-destructive/5 px-3 py-2 font-sans text-[14px] font-medium text-destructive">
            {departureValidationErrors[0]}
          </div>
        ) : null}
        {accommodationResult.error ? (
          <div className="mt-3 rounded-[7px] border border-accent/20 bg-muted px-3 py-2 font-sans text-[14px] font-medium text-accent">
            {accommodationResult.error}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3">
          {accommodationOptions.map((option) => (
            <AccommodationOptionCard
              key={option.id}
              option={option}
              selected={resolvedSelectedAccommodationOptionId === option.id}
              onSelect={() => setSelectedAccommodationOptionId(option.id)}
            />
          ))}
        </div>
        <p className="mt-3 font-sans text-[14px] leading-[1.6] text-secondary/65">
          Pricing is shown for {tour.tourName} and updates with the selected
          departure and traveller count.
        </p>
      </BookingStep>

      <BookingSummary
        balanceAmount={balanceAmount}
        balanceDueDate={balanceDueDate}
        depositAmount={depositAmount}
        grandTotal={grandTotal}
        gstAmount={gstAmount}
        gstPercentage={GST_PERCENTAGE}
        selectedAccommodationOption={selectedAccommodationOption}
        selectedDeparture={selectedDeparture}
        subtotal={subtotal}
        tour={tour}
        travellerCounts={travellerCounts}
      />
    </div>
  );
}

function BookingStep({
  actions,
  children,
  step,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  step: string;
  title: string;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-background p-4 text-[14px] shadow-[0_10px_24px_rgba(67,43,27,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-primary font-sans text-[14px] font-bold leading-none text-white">
            {step}
          </span>
          <h2 className="min-w-0 font-heading text-[21px] font-bold leading-tight text-secondary">
            {title}
          </h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function AccommodationOptionCard({
  onSelect,
  option,
  selected,
}: {
  onSelect: () => void;
  option: AccommodationOption;
  selected: boolean;
}) {
  const roomCounts = option.rooms.reduce(
    (map, room) => {
      map[room.roomType] = (map[room.roomType] || 0) + 1;
      return map;
    },
    {} as Partial<Record<(typeof option.rooms)[number]["roomType"], number>>
  );

  return (
    <label
      className={cn(
        "grid cursor-pointer gap-3 rounded-[8px] border bg-background p-3 font-sans transition-colors hover:bg-muted/40 sm:grid-cols-[22px_minmax(0,1fr)_minmax(300px,0.48fr)]",
        selected ? "border-primary ring-3 ring-primary/15" : "border-border"
      )}
    >
      <input
        checked={selected}
        className="mt-1"
        name="tour-accommodation"
        onChange={onSelect}
        type="radio"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="font-heading text-[15px] font-semibold leading-tight text-secondary">
            {option.title}
          </strong>
          {option.recommended ? (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[12px] font-medium uppercase text-primary">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[14px] font-medium text-secondary/64">
          {option.description}
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          {Object.entries(roomCounts).map(([roomType, count]) => (
            <span
              key={roomType}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-white px-2 py-1 text-[14px] font-medium text-secondary/72"
            >
              <BedDouble className="size-3.5 text-primary" />
              {ROOM_TYPES[roomType as keyof typeof ROOM_TYPES].title}
              {count && count > 1 ? ` x ${count}` : ""}
            </span>
          ))}
        </span>
      </span>
      <span className="grid gap-1.5 rounded-[7px] bg-muted/45 p-3 text-[14px] text-secondary sm:min-w-[300px]">
        {getPricingRows(option).map((row) => (
          <span
            key={row.key}
            className="flex items-center justify-between gap-3"
          >
            <span className="whitespace-nowrap font-medium">
              {formatPricingCategory(row.category)}
            </span>
            <span className="whitespace-nowrap font-medium">
              {row.count} x {formatCurrency(row.unitPrice)}
            </span>
          </span>
        ))}
        <span className="mt-1 flex items-center justify-between border-t border-border pt-2 text-[14px]">
          <strong className="font-medium">Total</strong>
          <strong className="font-medium">{formatCurrency(option.total)}</strong>
        </span>
      </span>
    </label>
  );
}

function BookingSummary({
  balanceAmount,
  balanceDueDate,
  depositAmount,
  grandTotal,
  gstAmount,
  gstPercentage,
  selectedAccommodationOption,
  selectedDeparture,
  subtotal,
  tour,
  travellerCounts,
}: {
  balanceAmount: number;
  balanceDueDate: Date | null;
  depositAmount: number;
  grandTotal: number;
  gstAmount: number;
  gstPercentage: number;
  selectedAccommodationOption?: AccommodationOption;
  selectedDeparture?: PublicTourDeparture;
  subtotal: number;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
}) {
  const travellerSummary = formatTravellerSummary(travellerCounts);
  const departureDate = selectedDeparture
    ? formatDate(selectedDeparture.departureDate)
    : "Coming Soon";

  return (
    <BookingStep step="4" title="Booking Summary">
      <div className="grid gap-2 rounded-[8px] border border-border bg-muted/35 p-3 font-sans text-[14px] text-secondary">
        <SummaryLine
          label="Tour"
          value={tour.tourName}
        />
        <SummaryLine
          label="Departure Date"
          value={departureDate}
        />
        <SummaryLine
          label="Travellers"
          value={travellerSummary}
        />
        <SummaryLine
          label="Accommodation"
          value={selectedAccommodationOption?.title || "Not selected"}
        />
        <SummaryLine
          label="Subtotal"
          value={formatCurrency(subtotal)}
        />
        <SummaryLine
          label={`GST (${gstPercentage}%)`}
          value={formatCurrency(gstAmount)}
        />
        <SummaryLine
          strong
          label="Total"
          value={formatCurrency(grandTotal)}
        />
        <SummaryLine
          label="Deposit Payable"
          value={formatCurrency(depositAmount)}
        />
        <SummaryLine label="Balance" value={formatCurrency(balanceAmount)} />
        <SummaryLine
          label="Balance Due Date"
          value={formatBalanceDueDate(balanceDueDate)}
        />
      </div>
    </BookingStep>
  );
}

function SummaryLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-between gap-4",
        strong && "mt-1 border-t border-border pt-2 text-[14px]"
      )}
    >
      <span className={cn("font-medium", strong && "font-semibold")}>
        {label}
      </span>
      <span className={cn("font-medium", strong && "font-semibold")}>
        {value}
      </span>
    </span>
  );
}

function TravellerCounter({
  ageLabel,
  label,
  minimum = 0,
  onDecrease,
  onIncrease,
  value,
}: {
  ageLabel: string;
  label: string;
  minimum?: number;
  onDecrease: () => void;
  onIncrease: () => void;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[7px] border border-border bg-background px-3 py-2.5">
      <span className="min-w-0 font-sans">
        <span className="block text-[14px] font-medium leading-tight text-secondary">
          {label}
        </span>
        <span className="mt-0.5 block text-[14px] font-medium leading-tight text-secondary/56">
          {ageLabel}
        </span>
      </span>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label} count`}
          disabled={value <= minimum}
          onClick={onDecrease}
          className="grid size-7 place-items-center rounded-full border border-border bg-white text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white disabled:pointer-events-none disabled:opacity-45"
        >
          <Minus className="size-3.5" />
        </button>
        <strong className="w-5 text-center font-sans text-[14px] font-medium text-secondary">
          {value}
        </strong>
        <button
          type="button"
          aria-label={`Increase ${label} count`}
          onClick={onIncrease}
          className="grid size-7 place-items-center rounded-full border border-border bg-white text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
        >
          <Plus className="size-3.5" />
        </button>
      </span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div>
      <h2 className="font-heading text-[22px] font-bold leading-tight text-secondary">
        {title}
      </h2>
      <span className="mt-2 block h-0.5 w-8 bg-primary" />
    </div>
  );
}

function FactGrid({ facts }: { facts: TourFact[] }) {
  return (
    <div className="mt-5 grid gap-3 border-b border-border pb-4 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((fact, index) => (
        <article
          key={fact.label}
          className={cn(
            "flex items-center gap-3",
            index > 0 && "xl:border-l xl:border-border xl:pl-5"
          )}
        >
          <fact.icon className="size-7 shrink-0 text-primary" strokeWidth={1.7} />
          <span className="font-sans">
            <span className="block text-[15px] font-medium text-secondary/72">
              {fact.label}
            </span>
            <strong className="mt-1 block text-[15px] leading-tight text-secondary">
              {fact.value}
            </strong>
          </span>
        </article>
      ))}
    </div>
  );
}

function getDayMetaItems(day: ItineraryDay) {
  return [
    {
      label: "Places",
      value: day.placesVisited?.length ? day.placesVisited.join(", ") : "",
    },
    {
      label: "Transport",
      value: day.transport || "",
    },
    {
      label: "Walk",
      value: day.walkingDifficulty || "",
    },
    {
      label: "Meals",
      value: day.meals || "",
    },
  ].filter((item) => item.value);
}

function DailyItinerary({ days }: { days: ItineraryDay[] }) {
  const [openDayNumber, setOpenDayNumber] = useState(days[0]?.dayNumber || 1);
  const activeDayNumber = days.some((day) => day.dayNumber === openDayNumber)
    ? openDayNumber
    : days[0]?.dayNumber;

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="relative mt-4 pl-5 before:absolute before:bottom-5 before:left-[6px] before:top-4 before:w-px before:bg-primary/45">
      <div className="overflow-hidden rounded-[8px] border border-border bg-background">
        {days.map((day) => {
          const isOpen = day.dayNumber === activeDayNumber;
          const contentId = `itinerary-day-${day.dayNumber}`;
          const metaItems = getDayMetaItems(day);

          return (
            <article
              key={day.dayNumber}
              className="relative border-b border-border last:border-b-0"
            >
              <span className="absolute -left-[20px] top-5 size-3 rounded-full bg-accent ring-4 ring-background" />
              <button
                type="button"
                aria-controls={contentId}
                aria-expanded={isOpen}
                onClick={() => setOpenDayNumber(day.dayNumber)}
                className="grid w-full gap-2 px-3 py-3 text-left font-sans transition-colors hover:bg-muted/35 sm:grid-cols-[58px_minmax(0,1fr)_32px] sm:items-start"
              >
                <span className="inline-flex h-7 w-14 items-center justify-center rounded-[5px] bg-secondary/40 font-sans text-[15px] font-bold text-white">
                  Day {day.dayNumber}
                </span>
                <span className="min-w-0">
                  <strong className="block text-[15px] leading-tight text-secondary">
                    {day.title}
                  </strong>
                  <span className="mt-1 block text-[15px] font-medium leading-[1.55] text-secondary/72">
                    {isOpen ? day.summary : "View day details"}
                  </span>
                </span>
                <span className="grid size-8 place-items-center rounded-full border border-border bg-white text-primary">
                  {isOpen ? (
                    <Minus className="size-3.5" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                </span>
              </button>

              {isOpen ? (
                <div
                  id={contentId}
                  className="px-3 pb-4 font-sans sm:pl-[74px] sm:pr-12"
                >
                  {metaItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {metaItems.map((item) => (
                        <span
                          key={`${day.dayNumber}-${item.label}`}
                          className="rounded-full bg-muted px-2.5 py-1.5 text-[15px] font-normal leading-tight text-accent"
                        >
                          <strong className="text-secondary">{item.label}:</strong>{" "}
                          {item.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ListBlock({
  icon: Icon,
  items,
  title,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
}) {
  return (
    <article>
      <h3 className="font-heading text-[20px] font-bold text-secondary">
        {title}
      </h3>
      <ul className="mt-3 space-y-2.5 font-sans text-[15px] font-semibold leading-[1.55] text-secondary/78">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.1} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PriceCard({
  bestDeparture,
  price,
  tour,
}: {
  bestDeparture?: PublicTourDeparture;
  price: number;
  tour: PublicTour;
}) {
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const offerText = bestDeparture?.earlyBirdOffer?.trim();

  return (
    <>
    <article className="overflow-hidden rounded-[8px] border border-primary/15 bg-card shadow-[0_12px_28px_rgba(67,43,27,0.08)]">
      <div className="border-b border-border bg-[#fff8f1] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 font-sans">
            <span className="block text-[15px] font-semibold text-secondary/72">
              Starts From
            </span>
            <strong className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1 text-[27px] font-bold leading-none text-secondary">
              {formatCurrency(price)}
              <span className="pb-0.5 text-[15px] font-bold leading-none text-secondary/62">
                per person
              </span>
            </strong>
          </div>

       
        </div>
      </div>

      
    </article>
    {isEnquiryOpen ? (
      <EnquiryModal
        bestDeparture={bestDeparture}
        tourName={tour.tourName}
        onClose={() => setIsEnquiryOpen(false)}
      />
    ) : null}
    </>
  );
}

function EnquiryModal({
  bestDeparture,
  onClose,
  tourName,
}: {
  bestDeparture?: PublicTourDeparture;
  onClose: () => void;
  tourName: string;
}) {
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
  }

  const modal = (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-secondary/62 px-4 py-4 backdrop-blur-sm sm:py-6"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Close enquiry form"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[860px] overflow-y-auto rounded-[10px] border border-primary/20 bg-card shadow-[0_28px_80px_rgba(35,24,16,0.34)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border bg-[#fff8f1] px-4 py-3">
          <div>
            <h2 className="font-heading text-[28px] font-bold leading-tight text-secondary">
              Enquire Now
            </h2>
            <p className="mt-0.5 font-sans text-[15px] font-bold text-primary">
              {tourName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close enquiry form"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-white text-secondary shadow-[0_8px_18px_rgba(67,43,27,0.1)] transition-colors hover:border-primary hover:bg-primary hover:text-white"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="max-w-[780px] font-sans text-[15px] font-medium leading-[1.55] text-secondary/78">
            Do you have any questions before you book? Complete the form below
            and our tour team will get back to you shortly.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <EnquiryField label="Your Name *">
              <input required type="text" placeholder="Your Name" />
            </EnquiryField>
            <EnquiryField label="Email address *">
              <input required type="email" placeholder="Email address" />
            </EnquiryField>
            <EnquiryField label="Phone Number *">
              <input required type="tel" placeholder="Phone Number" />
            </EnquiryField>
            <EnquiryField label="Current City *">
              <input required type="text" placeholder="Current City" />
            </EnquiryField>
            <EnquiryField label="Total No. of Guests *">
              <select required defaultValue="2 Adults">
                <option>1 Adult</option>
                <option>2 Adults</option>
                <option>2 Adults, 1 Child</option>
                <option>2 Adults, 2 Children</option>
                <option>Group of 5+</option>
              </select>
            </EnquiryField>
            <EnquiryField label="Date Of Travel *">
              <input
                required
                type="date"
                defaultValue={bestDeparture?.departureDate?.slice(0, 10) || ""}
              />
            </EnquiryField>
          </div>

          <EnquiryField className="mt-3" label="Please write Your Queries. *">
            <textarea
              required
              rows={3}
              placeholder="Tell us what you would like to know."
            />
          </EnquiryField>

          {isSubmitted ? (
            <p className="mt-3 rounded-[8px] border border-primary/20 bg-primary/8 px-3 py-2 font-sans text-[15px] font-bold text-primary">
              Thank you. Your enquiry has been captured for this tour.
            </p>
          ) : null}

          <Button type="submit" className="mt-4 h-10 px-7 text-[15px] font-semibold">
            Send Question
          </Button>
        </div>
      </form>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}

function EnquiryField({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("block font-sans", className)}>
      <span className="mb-1 block text-[15px] font-bold text-secondary/58">
        {label}
      </span>
      <span className="block [&>input]:h-10 [&>input]:w-full [&>input]:rounded-[8px] [&>input]:border [&>input]:border-border [&>input]:bg-background [&>input]:px-3 [&>input]:text-[15px] [&>input]:font-semibold [&>input]:text-secondary [&>input]:outline-none [&>input]:transition-colors [&>input]:placeholder:text-secondary/38 focus-within:[&>input]:border-primary focus-within:[&>input]:ring-3 focus-within:[&>input]:ring-primary/15 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-[8px] [&>select]:border [&>select]:border-border [&>select]:bg-background [&>select]:px-3 [&>select]:text-[15px] [&>select]:font-semibold [&>select]:text-secondary [&>select]:outline-none [&>select]:transition-colors focus-within:[&>select]:border-primary focus-within:[&>select]:ring-3 focus-within:[&>select]:ring-primary/15 [&>textarea]:w-full [&>textarea]:rounded-[8px] [&>textarea]:border [&>textarea]:border-border [&>textarea]:bg-background [&>textarea]:px-3 [&>textarea]:py-2.5 [&>textarea]:text-[15px] [&>textarea]:font-semibold [&>textarea]:text-secondary [&>textarea]:outline-none [&>textarea]:transition-colors [&>textarea]:placeholder:text-secondary/38 focus-within:[&>textarea]:border-primary focus-within:[&>textarea]:ring-3 focus-within:[&>textarea]:ring-primary/15">
        {children}
      </span>
    </label>
  );
}

function SidebarBookingSummary({
  selectedAccommodationOption,
  selectedDeparture,
  subtotal,
  tour,
  travellerCounts,
}: {
  selectedAccommodationOption?: AccommodationOption;
  selectedDeparture?: PublicTourDeparture;
  subtotal: number;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
}) {
  const taxesAndFees = subtotal > 0 ? Math.round((subtotal * GST_PERCENTAGE) / 100) : 0;
  const total = subtotal + taxesAndFees;
  const departureDate = selectedDeparture
    ? formatDate(selectedDeparture.departureDate)
    : "Coming Soon";
  const travellerSummary = formatTravellerSummary(travellerCounts);

  return (
    <article className="rounded-[8px] border border-border bg-card p-3 shadow-[0_10px_24px_rgba(67,43,27,0.06)]">
      <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold text-secondary">
        <BookOpen className="size-3.5 text-primary" strokeWidth={1.8} />
        Booking Summary
      </h2>

      <div className="mt-3 space-y-2 font-sans">
        <SidebarSummaryItem
          icon={BookOpen}
          label="Tour"
          value={tour.tourName}
        />
        <SidebarSummaryItem
          icon={CalendarDays}
          label="Departure Date"
          value={departureDate}
        />
        <SidebarSummaryItem
          icon={Users}
          label="Travellers"
          value={travellerSummary}
        />
        <SidebarSummaryItem
          icon={BedDouble}
          label="Accommodation"
          value={selectedAccommodationOption?.title || "Not selected"}
        />
      </div>

      <div className="mt-3 font-sans text-[14px] text-secondary">
        <SidebarAmountLine label="Subtotal" value={formatCurrency(subtotal)} />
        <SidebarAmountLine label="Taxes & Fees" value={formatCurrency(taxesAndFees)} />
        <SidebarAmountLine strong label="Total" value={formatCurrency(total)} />
      </div>
    </article>
  );
}

function SidebarSummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(132px,1fr)_minmax(96px,1fr)] items-start gap-3 py-1">
      <span className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={1.8} />
        <span className="min-w-0 text-[14px] font-medium leading-tight text-secondary/58">
          {label}
        </span>
      </span>
      <strong className="min-w-0 break-words text-right text-[14px] font-medium leading-tight text-secondary">
        {value}
      </strong>
    </div>
  );
}

function SidebarAmountLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-between gap-4",
        strong ? "mt-1 border-t border-border pb-1 pt-3 text-[14px]" : "py-1"
      )}
    >
      <span className={cn("font-semibold text-secondary/64", strong && "text-secondary")}>
        {label}
      </span>
      <strong className="text-secondary">{value}</strong>
    </span>
  );
}

function SeatBookingActionCard({
  accepted,
  canBook,
  checkoutStatus,
  onAcceptedChange,
  onBook,
  paymentFeedback,
  selectedDeparture,
  tour,
}: {
  accepted: boolean;
  canBook: boolean;
  checkoutStatus: CheckoutStatus;
  onAcceptedChange: (accepted: boolean) => void;
  onBook: () => void;
  paymentFeedback: string;
  selectedDeparture?: PublicTourDeparture;
  tour: PublicTour;
}) {
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const isBusy = checkoutStatus !== "idle";
  const isEnabled = accepted && canBook && !isBusy;
  const buttonLabel =
    checkoutStatus === "creating"
      ? "Opening Payment..."
      : checkoutStatus === "verifying"
        ? "Confirming Booking..."
        : checkoutStatus === "gateway_open"
          ? "Complete Payment..."
          : "Book Now";
  const buttonClassName =
    "inline-flex h-11 w-full items-center justify-center rounded-full font-sans text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20";

  return (
    <>
    <article className="rounded-[8px] border border-border bg-card p-3 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!isEnabled}
          onClick={onBook}
          className={cn(
            buttonClassName,
            "text-white",
            isEnabled
              ? "bg-primary hover:bg-accent"
              : "cursor-not-allowed bg-primary/40"
          )}
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={() => setIsEnquiryOpen(true)}
          className={cn(
            buttonClassName,
            "border border-primary bg-white text-primary hover:bg-primary hover:text-white"
          )}
        >
          Enquire Now
        </button>
      </div>

      <label
        className={cn(
          "mt-3 flex items-start gap-2 font-sans text-[14px] font-medium leading-[1.45]",
          canBook ? "text-secondary" : "text-secondary/48"
        )}
      >
        <input
          checked={accepted}
          className="mt-0.5 size-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!canBook}
          onChange={(event) => onAcceptedChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          I have read and agreed to the Ancient Trail&apos;s{" "}
          {canBook ? (
            <Link
              href="#"
              className="font-semibold text-primary transition-colors hover:text-accent"
            >
              Terms & Conditions.
            </Link>
          ) : (
            <span className="font-semibold text-primary/45">
              Terms & Conditions.
            </span>
          )}
        </span>
      </label>

      {!canBook ? (
        <p className="mt-2 font-sans text-[12px] font-medium leading-[1.4] text-secondary/58">
          Complete date selection, traveller details, and accommodation to continue.
        </p>
      ) : null}

      {paymentFeedback ? (
        <div className="mt-3 rounded-[7px] border border-primary/15 bg-muted/45 px-3 py-2 font-sans text-[12px] font-medium leading-[1.45] text-secondary/72">
          <p>{paymentFeedback}</p>
        </div>
      ) : null}
    </article>
    {isEnquiryOpen ? (
      <EnquiryModal
        bestDeparture={selectedDeparture}
        tourName={tour.tourName}
        onClose={() => setIsEnquiryOpen(false)}
      />
    ) : null}
    </>
  );
}

function HelpCard() {
  return (
    <article className="flex items-center gap-3 rounded-[8px] border border-border bg-card p-4 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      <div className="font-sans text-secondary">
        <h2 className="font-heading text-[18px] font-bold">Need Help?</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[14px] font-semibold">
          <PhoneCall className="size-3.5 text-primary" />
          Call Us : 011-43033003 | 43131313
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[14px] font-semibold">
          <Mail className="size-3.5 text-primary" />
          Mail Us : Holidays@ancient.com
        </p>
      </div>
    </article>
  );
}

function ExpertPanel({ expert }: { expert: PublicExpert }) {
  return (
    <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
      <div className="flex justify-center md:justify-start">
        <span className="relative size-32 overflow-hidden rounded-[8px] bg-border">
          <Image
            src={getExpertImage(expert)}
            alt={expert.fullName}
            fill
            sizes="128px"
            className="object-cover"
          />
        </span>
      </div>

      <div>
        <SectionTitle title="Tour Expert" />
        <h3 className="mt-4 font-heading text-[26px] font-bold leading-tight text-secondary">
          {expert.fullName}
        </h3>
        <p className="mt-2 font-sans text-[15px] font-bold text-primary">
          {getExpertRole(expert)}
        </p>
        <p className="mt-4 font-sans text-[15px] font-medium leading-[1.75] text-secondary/82">
          {getExpertBio(expert)}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-primary">
          <span className="inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-secondary">
            <Landmark className="size-5 text-primary" strokeWidth={1.5} />
            Heritage Context
          </span>
          <span className="inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-secondary">
            <BookOpen className="size-5 text-primary" strokeWidth={1.5} />
            Storytelling
          </span>
          <span className="inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-secondary">
            <Clock3 className="size-5 text-primary" strokeWidth={1.5} />
            Field Experience
          </span>
        </div>

        <Button
          nativeButton={false}
          render={<Link href="/about" />}
          variant="outline"
          className="mt-5 justify-between px-5 text-[16px] font-normal"
        >
          View Profile
          <ButtonArrow className="group-hover/button:brightness-0 group-hover/button:invert" />
        </Button>
      </div>
    </div>
  );
}
