"use client";
import { useModalFocus } from "@/lib/modal-focus";
import type { TourPageData } from "@/lib/travel-page-data";
import { getRequestedTourAlias } from "@/lib/routes";
import { handleTabKeyDown } from "@/lib/tab-keyboard";
import { formatTourTitle } from "@/lib/tour-title";

import { PaymentRetryNotice } from "@/components/payment-retry-notice";
import { paymentFailureMessage } from "@/lib/payment-failure";

import {
  getBookableDepartures,
  getNextBookableDeparture,
  getDepartureTotalSeats,
  getDepartureFilledSeats,
  getDepartureSeatsLeft,
} from "@/lib/tour-departures";
import { BookingTermExplanation, BookingTermsLink } from "@/components/booking-term-help";

import { createInitialBankTransfer, getBankTransferConfig } from "@/lib/bank-transfer";
import { isAirfareExcluded } from "@/lib/airfare";
import { TourPriceNote } from "@/components/tours/tour-price-note";
import { BookingFlowProvider, BookingProgress, BookingErrorSummary, useBookingFlow, useBookingFieldProps, bookingFieldId, type BookingStage, type BookingFieldIssue } from "@/components/tours/booking-flow";
import { ApiError } from "@/lib/api";
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  BarChart3,
  BedDouble,
  BedSingle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Info,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  Minus,
  Plane,
  PhoneCall,
  Plus,
  Hotel,
  ShieldCheck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  getHomeMediaUrl,
  getTourDestinationIds,
  type PublicDestination,
  type PublicExpert,
  type PublicTour,
  type PublicTourDeparture,
  type PublicTourItinerary,
  type TourCancellationPolicyRow,
  type TourNeedToKnowGroup,
  type TourPaymentPolicyRow,
} from "@/lib/home-travel";
import {
  calculateBalance,
  calculateAgeOnDate,
  calculateBalanceDueDate,
  calculateDeposit,
  generateOccupancyOptions,
  selectAccommodationOption,
  ROOM_TYPES,
  validateDepartureForBooking,
  type AccommodationOption,
  type PricedDeparture,
} from "@/lib/tour-booking";
import {
  cancelBookingPaymentOrder,
  createBookingPaymentOrder,
  getBookingPaymentOrderStatus,
  verifyBookingPayment,
  createOfflineBooking,
  type BookingPayload,
  type BookingPaymentOrder,
} from "@/lib/booking-payment";
import {
  defaultSiteContactSettings,
  getContactCallDisplay,
  getContactEmailDisplay,
  getPublicSiteSettings,
  type SiteContactSettings,
} from "@/lib/site-settings";
import {
  completeTravellerProfile,
  getTravellerSession,
  listenForTravellerSessionChanges,
  requestTravellerProfileMobileChangeOtp,
  requestTravellerOtp,
  saveTravellerSession,
  updateTravellerProfile,
  verifyTravellerProfileMobileChangeOtp,
  verifyTravellerOtp,
  type TravellerSession,
  type TravellerUser,
} from "@/lib/auth";
import { createTourEnquiry } from "@/lib/enquiries";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DownloadItineraryButton } from "./download-itinerary-button";

type TourTab = "itinerary" | "inclusions" | "pricing" | "expert";

type TourDetailData = {
  departures: PublicTourDeparture[];
  destinations: PublicDestination[];
  expert: PublicExpert;
  itinerary: PublicTourItinerary | null;
  primaryDestination: PublicDestination | undefined;
  tour: PublicTour;
};

type ItineraryDay = {
  dayNumber: number;
  hotels?: string;
  meals?: string;
  placesVisited?: string[];
  summary: string;
  title: string;
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
  emergencyContactName: string;
  emergencyContactMobileNumber: string;
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

type CheckoutStatus = "idle" | "creating" | "gateway_open" | "verifying" | "requesting_offline";
type BookingPaymentOption = "advance" | "full";

const BOOKING_TRAVELLER_LIMIT = 6;

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

const tabs: Array<{
  icon: LucideIcon;
  label: string;
  sectionId: string;
  value: TourTab;
}> = [
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

function splitTourCategoryLabels(tour: PublicTour) {
  return uniqueValues(
    [tour.category, tour.tourType]
      .flatMap((value) => (value || "").split(/[,/|]+/))
      .map((value) => value.trim())
      .filter(
        (value) =>
          !["domestic", "international"].includes(value.toLowerCase())
      )
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
  emergencyContactName: "",
  emergencyContactMobileNumber: "",
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

function getLeadTravellerAuthMobileNumber(form: TravellerDetailForm) {
  const countryCode = extractPhoneCountryCode(form.phoneCountryCode).replace(
    /\D/g,
    ""
  );
  const mobileDigits = sanitizeMobileNumber(form.mobileNumber).replace(/\D/g, "");

  if (!countryCode || !mobileDigits) {
    return "";
  }

  if (countryCode === "91") {
    return mobileDigits.length > 10 && mobileDigits.startsWith("91")
      ? mobileDigits
      : `91${mobileDigits}`;
  }

  return `${countryCode}${mobileDigits}`;
}

function getProfileAuthMobileNumber(value?: string) {
  const digits = getProfileMobileDigits(value);

  if (!digits) {
    return "";
  }

  return digits.length === 10 ? `91${digits}` : digits;
}

function getBookingErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function isTravellerDetailFormComplete(form: TravellerDetailForm, isLeadTraveller: boolean) {
  return Boolean(
      form.firstName.trim() &&
      form.lastName.trim() &&
      (isLeadTraveller ? isValidEmail(form.email) : !form.email.trim() || isValidEmail(form.email)) &&
      form.address.trim() &&
      extractPhoneCountryCode(form.phoneCountryCode) &&
      isValidMobileNumber(form.mobileNumber) &&
      form.gender &&
      isValidStoredBirthDate(form.dateOfBirth)
  );
}

type BookingDetailIssue = {
  message: string;
  selector: string;
  travellerId?: string;
};

function getBookingDetailsIssues(
  counts: TravellerCounts,
  forms: Record<string, TravellerDetailForm>
): BookingFieldIssue[] {
  const issues: BookingFieldIssue[] = [];
  const tabs = createTravellerDetailTabs(counts);
  for (const tab of tabs) {
    const form = { ...defaultTravellerDetailForm, ...(forms[tab.id] || {}) };
    const label = tab.label;
    const issue = (message: string, field: string): BookingFieldIssue => {
      const phoneField = field === "mobile number" || field === "phone country code";
      const fieldLabel = (tab.id === "adult-1" && phoneField ? "Lead traveller" : label) + " " + field;
      return {
        id: bookingFieldId(tab.id, field),
        stage: 3,
        message: label + message,
        travellerId: tab.id,
        selector: field === "gender"
          ? 'input[name="traveller-gender-' + tab.id + '"]'
          : '[aria-label=' + JSON.stringify(fieldLabel) + ']',
      };
    };
    if (!form.firstName.trim()) issues.push(issue(": enter the first name.", "first name"));
    if (!form.lastName.trim()) issues.push(issue(": enter the last name.", "last name"));
    if (tab.id === "adult-1" && !form.email.trim()) issues.push(issue(": enter the email address.", "email"));
    if (form.email.trim() && !isValidEmail(form.email)) issues.push(issue(": enter a valid email address.", "email"));
    if (!isValidStoredBirthDate(form.dateOfBirth)) issues.push(issue(": select a valid date of birth.", "date of birth"));
    if (!form.address.trim()) issues.push(issue(": enter the address.", "address"));
    if (!extractPhoneCountryCode(form.phoneCountryCode)) issues.push(issue(": select the phone country code.", "phone country code"));
    if (tab.id === "adult-1" ? !isValidMobileNumber(form.mobileNumber) : !/^[0-9]{10}$/.test(form.mobileNumber)) {
      issues.push(issue(tab.id === "adult-1" ? ": enter a valid mobile number." : ": enter a 10-digit mobile number.", "mobile number"));
    }
    if (!form.gender) issues.push(issue(": select the gender.", "gender"));
  }
  const lead = { ...defaultTravellerDetailForm, ...(forms["adult-1"] || {}) };
  if (!lead.emergencyContactName.trim()) issues.push({
    id: "booking-emergency-contact-name", stage: 3,
    message: "Enter the emergency contact name.",
    selector: '[aria-label="Booking emergency contact name"]',
  });
  if (getMobileDigits(lead.emergencyContactMobileNumber).length !== 10) issues.push({
    id: "booking-emergency-contact-mobile", stage: 3,
    message: "Enter a 10-digit emergency contact number.",
    selector: '[aria-label="Booking emergency contact mobile number"]',
  });
  const warning = getEmergencyContactTravellerWarning(lead, tabs, forms);
  if (warning) issues.push({
    id: "booking-emergency-contact-name", stage: 3,
    message: warning,
    selector: '[aria-label="Booking emergency contact name"]',
  });
  return issues;
}

function getBookingDetailsIssue(counts: TravellerCounts, forms: Record<string, TravellerDetailForm>): BookingDetailIssue | null {
  return getBookingDetailsIssues(counts, forms)[0] || null;
}

function focusBookingDetail(issue: BookingDetailIssue) {
  if (issue.travellerId) {
    const tab = document.getElementById("traveller-tab-" + issue.travellerId) as HTMLButtonElement | null;
    if (tab && !tab.disabled) flushSync(() => tab.click());
  }
  // Wait for the selected traveller's panel to render before finding its field.
  window.requestAnimationFrame(() => {
    let target = document.querySelector<HTMLElement>(issue.selector);
    if (!target || target.matches(":disabled") || !target.getClientRects().length) {
      target = document.querySelector<HTMLElement>('[aria-label="Lead traveller OTP"]:not(:disabled)')
        || document.querySelector<HTMLElement>("[data-booking-send-otp]:not(:disabled)")
        || document.querySelector<HTMLElement>('[aria-label="Lead traveller mobile number"]');
    }
    if (!target) target = document.getElementById("departure-pricing");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function isBookingEmergencyContactComplete(form: TravellerDetailForm) {
  const emergencyContactDigits = getMobileDigits(
    form.emergencyContactMobileNumber
  );

  return Boolean(
    form.emergencyContactName.trim() &&
      emergencyContactDigits.length === 10
  );
}

function normalizeContactName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getMobileDigits(value: string) {
  return sanitizeMobileNumber(value).replace(/\D/g, "");
}

function isSameMobileNumber(value: string, form: TravellerDetailForm) {
  const mobileDigits = getMobileDigits(value);
  const travellerMobileDigits = getMobileDigits(form.mobileNumber);
  const travellerAuthMobileDigits = getLeadTravellerAuthMobileNumber(form);

  if (!mobileDigits || !travellerMobileDigits) {
    return false;
  }

  return (
    mobileDigits === travellerMobileDigits ||
    mobileDigits === travellerAuthMobileDigits ||
    (mobileDigits.length >= 10 &&
      travellerMobileDigits.length >= 10 &&
      mobileDigits.slice(-10) === travellerMobileDigits.slice(-10))
  );
}

function getEmergencyContactTravellerWarning(
  emergencyContact: TravellerDetailForm,
  tabs: TravellerDetailTab[],
  forms: Record<string, TravellerDetailForm>
) {
  const emergencyContactName = normalizeContactName(
    emergencyContact.emergencyContactName
  );

  if (!emergencyContactName && !getMobileDigits(emergencyContact.emergencyContactMobileNumber)) {
    return "";
  }

  const hasSameTraveller = tabs.some((tab) => {
    const travellerForm = {
      ...defaultTravellerDetailForm,
      ...(forms[tab.id] || {}),
    };
    const travellerName = normalizeContactName(
      `${travellerForm.firstName} ${travellerForm.lastName}`
    );
    const hasSameName =
      emergencyContactName && travellerName && emergencyContactName === travellerName;

    return (
      isSameMobileNumber(
        emergencyContact.emergencyContactMobileNumber,
        travellerForm
      ) || hasSameName
    );
  });

  return hasSameTraveller
    ? "Emergency contact cannot be the same as any traveller. Please add a different contact person."
    : "";
}

function getLeadTravellerFormFromProfile(
  user: TravellerUser | null
): TravellerDetailForm | null {
  if (!user) {
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
  paymentOption,
  tour,
  travellerCounts,
}: {
  accommodationOption: AccommodationOption;
  departure: PublicTourDeparture;
  forms: Record<string, TravellerDetailForm>;
  paymentOption: BookingPaymentOption;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
}): BookingPayload {
  const travellerTabs = createTravellerDetailTabs(travellerCounts);
  const totalGuests = getTotalTravellers(travellerCounts);
  const childTabs = travellerTabs.filter((tab) => tab.travellerType !== "adult");
  const leadForm = forms["adult-1"] || defaultTravellerDetailForm;
  const bookingEmergencyContactName = leadForm.emergencyContactName.trim();
  const bookingEmergencyContactMobileNumber = sanitizeMobileNumber(
    leadForm.emergencyContactMobileNumber
  );

  return {
    emergencyContactName: bookingEmergencyContactName,
    emergencyContactMobileNumber: bookingEmergencyContactMobileNumber,
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
      const emergencyContact =
        tab.id === "adult-1"
          ? {
              emergencyContactName: bookingEmergencyContactName,
              emergencyContactMobileNumber: bookingEmergencyContactMobileNumber,
            }
          : {};

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
        ...emergencyContact,
      };
    }),
    travellers: travellerTabs.map((tab) => {
      const form = forms[tab.id];
      const countryCode = extractPhoneCountryCode(form.phoneCountryCode);
      const mobileNumber = sanitizeMobileNumber(form.mobileNumber);
      const emergencyContact =
        tab.id === "adult-1"
          ? {
              emergencyContactName: bookingEmergencyContactName,
              emergencyContactMobileNumber: bookingEmergencyContactMobileNumber,
            }
          : {};

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
        ...emergencyContact,
        ageOnDeparture:
          tab.travellerType === "adult"
            ? undefined
            : getTravellerAgeOnDeparture(form, departure),
      };
    }),
    accommodationDetails: createAccommodationDetails(accommodationOption),
    paymentOption,
  };
}

function getProfileSaveGender(gender: TravellerDetailForm["gender"]) {
  if (gender === "male") {
    return "Male";
  }

  if (gender === "female") {
    return "Female";
  }

  return "";
}

function shouldSyncLeadTravellerProfile(
  user: TravellerUser,
  leadForm: TravellerDetailForm
) {
  const firstName = leadForm.firstName.trim();
  const lastName = leadForm.lastName.trim();
  const email = leadForm.email.trim().toLowerCase();
  const leadAuthMobileNumber = getLeadTravellerAuthMobileNumber(leadForm);
  const profileAuthMobileNumber = getProfileAuthMobileNumber(user.mobileNumber);

  if (
    !firstName ||
    !lastName ||
    !isValidEmail(email) ||
    !leadAuthMobileNumber ||
    profileAuthMobileNumber !== leadAuthMobileNumber
  ) {
    return false;
  }

  return (
    user.firstName?.trim() !== firstName ||
    user.lastName?.trim() !== lastName ||
    (user.email || "").trim().toLowerCase() !== email ||
    (user.gender || "") !== getProfileSaveGender(leadForm.gender) ||
    (user.dateOfBirth || "") !== leadForm.dateOfBirth
  );
}

async function syncLeadTravellerProfileFromBooking(
  forms: Record<string, TravellerDetailForm>
) {
  const session = getTravellerSession();
  const leadForm = forms["adult-1"] || defaultTravellerDetailForm;

  if (!session?.sessionId || !shouldSyncLeadTravellerProfile(session.user, leadForm)) {
    return;
  }

  const response = await updateTravellerProfile({
    firstName: leadForm.firstName.trim(),
    lastName: leadForm.lastName.trim(),
    email: leadForm.email.trim().toLowerCase(),
    mobileNumber: getLeadTravellerAuthMobileNumber(leadForm),
    gender: getProfileSaveGender(leadForm.gender),
    nationality: session.user.nationality || "",
    dateOfBirth: leadForm.dateOfBirth || session.user.dateOfBirth || "",
  });

  saveTravellerSession(response.data);
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
    const timeoutId = window.setTimeout(() => {
      razorpayCheckoutScriptPromise = null;
      reject(new Error("Razorpay checkout took too long to load. Please try again."));
    }, 15000);
    const resolveLoaded = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    const rejectLoad = () => {
      window.clearTimeout(timeoutId);
      razorpayCheckoutScriptPromise = null;
      reject(new Error("Razorpay checkout could not be loaded"));
    };
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      if (window.Razorpay || existingScript.dataset.razorpayLoaded === "true") {
        resolveLoaded();
        return;
      }

      existingScript.addEventListener("load", resolveLoaded, { once: true });
      existingScript.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      script.dataset.razorpayLoaded = "true";
      resolveLoaded();
    };
    script.onerror = rejectLoad;
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

function getDestinationTitle(destination?: PublicDestination) {
  return (
    destination?.destinationName ||
    destination?.city ||
    destination?.state ||
    destination?.countryRegion ||
    "Ancient Trails"
  );
}

function getRouteLabel(
  tour: PublicTour,
  destinations: PublicDestination[],
  primaryDestination: PublicDestination | undefined
) {
  const destinationNames = uniqueValues(
    destinations.map((destination) => getDestinationTitle(destination))
  );

  if (destinationNames.length > 1) {
    return `${destinationNames[0]} to ${destinationNames[destinationNames.length - 1]}`;
  }

  return (
    primaryDestination?.city ||
    primaryDestination?.destinationName ||
    primaryDestination?.state ||
    "Ancient Trails"
  );
}

function getTourImages(tour: PublicTour) {
  return uniqueValues(tour.galleryImages).map(getHomeMediaUrl);
}

function getBestDeparture(departures: PublicTourDeparture[]) {
  return getNextBookableDeparture(departures);
}

function getDepartureFillProgress(departure: PublicTourDeparture) {
  const totalSeats = getDepartureTotalSeats(departure);
  const filledSeats = getDepartureFilledSeats(departure);

  return totalSeats > 0 ? Math.min(100, Math.max(0, (filledSeats / totalSeats) * 100)) : 0;
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
        hotels: day.hotels,
        walkingDifficulty: day.walkingDifficulty,
      }));
  }

  return [];
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
  itineraries: PublicTourItinerary[]
): TourDetailData {
  const destinationIds = getTourDestinationIds(tour);
  const linkedDestinations = destinationIds
    .map((destinationId) =>
      destinations.find((destination) => destination.destinationId === destinationId)
    )
    .filter((destination): destination is PublicDestination => Boolean(destination));
  const primaryDestination =
    getPrimaryDestinationForTour(tour, linkedDestinations) ||
    getPrimaryDestinationForTour(tour, destinations);
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
    departures: getBookableDepartures(tourDepartures),
    destinations:
      linkedDestinations.length > 0 ? linkedDestinations : primaryDestination ? [primaryDestination] : [],
    itinerary,
    primaryDestination,
    expert,
  };
}

function findRequestedTour(tours: PublicTour[], requestedTourId: string) {
  const requestedCode = normalizeCode(decodeURIComponent(requestedTourId));
  const requestedSlug = slugify(decodeURIComponent(requestedTourId));
  const requestedAlias = getRequestedTourAlias(requestedTourId);

  return (
    tours.find(
      (tour) =>
        normalizeCode(tour.tourId) === requestedCode ||
        (requestedAlias &&
          normalizeCode(tour.tourId) === normalizeCode(requestedAlias)) ||
        slugify(tour.tourName) === requestedSlug ||
        tour.id === requestedTourId
    ) || null
  );
}

export function SingleTourPage({ tourId, initialData }: { tourId: string; initialData: TourPageData }) {
  const toast = useToast();
  const router = useRouter();
  const detail = useMemo(() => {
    const tour = findRequestedTour(initialData.tours, tourId);
    if (!tour) throw new Error('Tour data does not match this page.');
    return enrichTourData(tour, initialData.departures, initialData.destinations, initialData.experts, initialData.itineraries);
  }, [initialData, tourId]);
  const [activeTab, setActiveTab] = useState<TourTab>("itinerary");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const isLoading = false;
  const [selectedDepartureId, setSelectedDepartureId] = useState("");
  const [travellerCounts, setTravellerCounts] = useState<TravellerCounts>({
    adults: 1,
    children: 0,
    infants: 0,
  });
  const [selectedAccommodationOptionId, setSelectedAccommodationOptionId] =
    useState("");
  const selectedPaymentOption: BookingPaymentOption = "advance";
  const [isBookingFlowOpen, setIsBookingFlowOpen] = useState(false);
  const bookingScrollFrameRef = useRef(0);
  useEffect(() => () => window.cancelAnimationFrame(bookingScrollFrameRef.current), []);
  const [bookingStage, setBookingStage] = useState<BookingStage>(0);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [isLeadAuthenticated, setIsLeadAuthenticated] = useState(false);
  const [acceptedBookingTermsKey, setAcceptedBookingTermsKey] = useState("");
  const [areTravellerDetailsComplete, setAreTravellerDetailsComplete] =
    useState(false);
  const [travellerDetailForms, setTravellerDetailForms] = useState<
    Record<string, TravellerDetailForm>
  >({});
  const [checkoutStatus, setCheckoutStatus] =
    useState<CheckoutStatus>("idle");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [paymentRetryMessage, setPaymentRetryMessage] = useState<string | null>(null);
  const [isCheckingRetry, setIsCheckingRetry] = useState(false);
  const checkingRetryRef = useRef(false);
  const failedPaymentOrderRef = useRef<string | null>(null);
  const retryPaymentOptionRef = useRef<BookingPaymentOption>("advance");
  const [offlineRequestKey, setOfflineRequestKey] = useState("");
  const [bankTransferEnabled, setBankTransferEnabled] = useState(false);
  useEffect(() => {
    void getBankTransferConfig().then(result => setBankTransferEnabled(result.data.enabled)).catch(() => {});
  }, []);
  const [isTourEnquiryOpen, setIsTourEnquiryOpen] = useState(false);
  const [isPaymentChoiceOpen, setIsPaymentChoiceOpen] = useState(false);
  const bookingSubmissionRef = useRef(false);
  const paymentRequestRef = useRef<{ payload: string; key: string } | null>(null);
  const [siteContact, setSiteContact] = useState<SiteContactSettings>(
    defaultSiteContactSettings
  );
  const paymentOrderRef = useRef<BookingPaymentOrder | null>(null);
  const pendingPaymentCancellationRef = useRef<Promise<void> | null>(null);



  useEffect(() => {
    let isMounted = true;

    async function loadSiteSettings() {
      try {
        const response = await getPublicSiteSettings();

        if (isMounted) {
          setSiteContact(response.data.settings.contact);
        }
      } catch {
        if (isMounted) {
          setSiteContact(defaultSiteContactSettings);
        }
      }
    }

    loadSiteSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const galleryImages = useMemo(
    () => getTourImages(detail.tour),
    [detail.tour]
  );
  const activeImageIndex = Math.min(
    selectedImageIndex,
    Math.max(galleryImages.length - 1, 0)
  );
  const selectedImage = galleryImages[activeImageIndex] || galleryImages[0];
  const bestDeparture = useMemo(
    () => getBestDeparture(detail.departures),
    [detail.departures]
  );
  const selectedDeparture = useMemo(
    () => getSelectedDeparture(detail.departures, selectedDepartureId),
    [detail.departures, selectedDepartureId]
  );
  const price = selectedDeparture?.priceAdult ?? 0;
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
  const bookingValidationErrors = useMemo(
    () =>
      selectedDeparture
        ? validateDeparturePaymentReadiness(selectedDeparture, totalTravellers)
        : ["Select a scheduled departure."],
    [selectedDeparture, totalTravellers]
  );
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

      return selectAccommodationOption(accommodationOptions, selectedAccommodationOptionId);
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
  const accommodationOptions = useMemo(() => {
    if (!selectedPricedDeparture || bookingValidationKey) {
      return [] as AccommodationOption[];
    }

    try {
      return generateOccupancyOptions({
        adults: travellerCounts.adults,
        children: selectedChildren,
        selectedDeparture: selectedPricedDeparture,
      });
    } catch {
      return [] as AccommodationOption[];
    }
  }, [
    bookingValidationKey,
    selectedPricedDeparture,
    selectedChildren,
    travellerCounts.adults,
  ]);
  const bookingSubtotal = selectedAccommodationOption?.total ?? 0;
  const bookingGstAmount = Math.round((bookingSubtotal * GST_PERCENTAGE) / 100);
  const bookingGrandTotal = bookingSubtotal + bookingGstAmount;
  const bookingDepositAmount =
    selectedPricedDeparture && selectedAccommodationOption
      ? calculateDeposit({
          depositAppliesTo: selectedPricedDeparture.depositAppliesTo,
          depositType: selectedPricedDeparture.depositType,
          depositValue: selectedPricedDeparture.depositValue,
          grandTotal: bookingGrandTotal,
          totalTravellers,
        })
      : 0;
  const bookingBalanceAmount = calculateBalance(
    bookingGrandTotal,
    bookingDepositAmount
  );
  const bookingBalanceDueDate = selectedPricedDeparture
    ? calculateBalanceDueDate(
        selectedPricedDeparture.departureDate,
        selectedPricedDeparture.balanceDueDaysBefore
      )
    : null;
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
      totalTravellers <= BOOKING_TRAVELLER_LIMIT &&
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
  const allBookingIssues: BookingFieldIssue[] = getBookingDetailsIssues(travellerCounts, completeTravellerDetailForms).map(issue => {
    if (issue.travellerId && /^(child|infant)-/.test(issue.travellerId) && issue.id.endsWith("-date-of-birth")) {
      const tab = createTravellerDetailTabs(travellerCounts).find(tab => tab.id === issue.travellerId);
      return {...issue, id: bookingFieldId(issue.travellerId, "pricing date of birth"), stage: 1 as BookingStage, selector: '[aria-label=' + JSON.stringify(tab?.label + " pricing date of birth") + ']'};
    }
    return issue;
  });
  if (!isLeadAuthenticated) allBookingIssues.unshift({ id: "booking-lead-auth", stage: 0, message: "Verify the lead traveller's mobile number before continuing.", selector: '[aria-label="Lead traveller mobile number"]' });
  if (!selectedDeparture || bookingValidationErrors.length) allBookingIssues.unshift({ id: "booking-departure", stage: 1, message: bookingValidationErrors[0] || "Select a scheduled departure.", selector: "[data-booking-departure]" });
  if (!selectedAccommodationOption || bookingSubtotal <= 0) allBookingIssues.push({ id: "booking-accommodation", stage: 2, message: "Choose an available accommodation option.", selector: 'input[name="tour-accommodation"]' });
  if (!hasAcceptedBookingTerms) allBookingIssues.push({ id: "booking-terms", stage: 4, message: "Please read and accept the Terms & Conditions before payment.", selector: "[data-booking-terms]" });
  const visibleBookingIssues = validationAttempt ? Array.from(new Map(allBookingIssues.map(issue => [issue.id, issue])).values()) : [];

  function focusBookingIssue(issue: BookingFieldIssue) {
    flushSync(() => {
      setActiveTab("pricing");
      if (window.matchMedia("(max-width: 1023px)").matches) setBookingStage(isLeadAuthenticated ? issue.stage ?? 3 : 0);
    });
    const signInField = !isLeadAuthenticated && issue.id.startsWith("booking-adult-1-")
      ? issue.id.endsWith("-first-name") ? "first name" : issue.id.endsWith("-last-name") ? "last name" : issue.id.endsWith("-email") ? "email" : ""
      : "";
    if (signInField && document.querySelector('[aria-label="Sign-in ' + signInField + '"]')) {
      focusBookingDetail({...issue, selector: '[aria-label="Sign-in ' + signInField + '"]'});
    } else focusBookingDetail(issue);
  }

  const bookingDetailsIssue = getBookingDetailsIssue(travellerCounts, completeTravellerDetailForms);
  const bookingIssue: BookingDetailIssue =
    !selectedDepartureKey
      ? { message: "Select a departure date.", selector: "[data-booking-departure]" }
      : bookingDetailsIssue
      || (bookingValidationErrors[0] ? { message: bookingValidationErrors[0], selector: "[data-booking-departure]" } : null)
      || (!areTravellerDetailsComplete ? {
        message: "Verify the lead traveller's mobile number with OTP before continuing.",
        selector: '[aria-label="Lead traveller OTP"]',
      } : null)
      || (!selectedAccommodationOption || bookingSubtotal <= 0 ? {
        message: "Select an available accommodation option.",
        selector: 'input[name="tour-accommodation"]',
      } : null)
      || (!hasAcceptedBookingTerms ? {
        message: "Please read and accept the Terms & Conditions before payment.",
        selector: "[data-booking-terms]",
      } : null)
      || { message: "Complete the remaining booking details before payment.", selector: "#departure-pricing" };
  const bookingReminder = bookingIssue.message;

  function handleIncompleteBooking() {
    flushSync(() => { setActiveTab("pricing"); setValidationAttempt(attempt => attempt + 1); });
    window.requestAnimationFrame(() => {
      const summary = document.getElementById("booking-form-errors");
      summary?.focus({preventScroll: true});
      summary?.scrollIntoView({behavior: "smooth", block: "start"});
    });
  }
  const itineraryDays = useMemo(
    () => createItineraryDays(detail.tour, detail.destinations, detail.itinerary),
    [detail]
  );

  useEffect(() => {
    const root = document.documentElement;
    let frameId = 0;

    const updateDockedState = () => {
      frameId = 0;

      const tabsShell = document.querySelector<HTMLElement>(
        "[data-tour-tabs-shell]"
      );
      const dockingOffset = window.matchMedia("(max-width: 639.98px)").matches
        ? 60
        : 0;
      const shellRect = tabsShell?.getBoundingClientRect();
      const isDocked = Boolean(tabsShell?.getClientRects().length && shellRect && shellRect.top <= dockingOffset);

      root.classList.toggle(
        "tour-tabs-docked",
        isDocked
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
    paymentRequestRef.current = null;
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

  function redirectToBookingConfirmation(bookingId: string) {
    router.push(
      `/booking-confirmed/${bookingId}`
    );
  }

  async function recoverConfirmedPaymentOrder(orderId: string) {
    const response = await getBookingPaymentOrderStatus(orderId);
    const { booking, isConfirmed } = response.data;

    if (isConfirmed && booking) {
      redirectToBookingConfirmation(booking.id);
      return true;
    }

    return false;
  }

  async function openRazorpayCheckout(order: BookingPaymentOrder) {
    await loadRazorpayCheckoutScript();

    if (!window.Razorpay) {
      throw new Error("Razorpay checkout could not be opened");
    }

    let didReceivePaymentResponse = false;
    let didEndPaymentAttempt = false;
    const endPaymentAttempt = (message: string) => {
      if (didReceivePaymentResponse || didEndPaymentAttempt) return;
      didEndPaymentAttempt = true;
      failedPaymentOrderRef.current = order.checkout.orderId;
      setPaymentRetryMessage(message);
      void cancelPaymentOrder(order.checkout.orderId);
      clearPaymentOrderState();
      setCheckoutStatus("idle");
      setPaymentFeedback(message);
      toast.warning("Payment not completed", message);
    };
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
        if (didReceivePaymentResponse) return;
        didReceivePaymentResponse = true;
        setPaymentRetryMessage(null);
        setCheckoutStatus("verifying");
        setPaymentFeedback("Verifying payment and confirming your booking...");

        verifyBookingPayment(paymentResponse)
          .then((verificationResponse) => {
            const { booking } = verificationResponse.data;

            redirectToBookingConfirmation(booking.id);
          })
          .catch(async (error: unknown) => {
            try {
              if (await recoverConfirmedPaymentOrder(order.checkout.orderId)) {
                return;
              }
            } catch {
              // Keep the original verification error visible below.
            }

            setCheckoutStatus("idle");
            setPaymentFeedback(
              error instanceof Error
                ? error.message
                : "Payment verification failed. If the amount was debited, please contact support with your payment ID."
            );
          });
      },
      modal: {
        ondismiss: () => {
          endPaymentAttempt(paymentFailureMessage());
        },
      },
    });

    checkout.on("payment.failed", (failureResponse) => {
      const reason = failureResponse.error?.description || failureResponse.error?.reason;
      endPaymentAttempt(
        paymentFailureMessage(reason)
      );
    });

    try {
      flushSync(() => setCheckoutStatus("gateway_open"));
      checkout.open();
    } catch (error) {
      endPaymentAttempt(
        paymentFailureMessage(error instanceof Error ? error.message : "Payment could not be opened.")
      );
      throw error;
    }
  }

  function changeBookingStage(stage: BookingStage) {
    setBookingStage(stage);
    window.requestAnimationFrame(() => document.getElementById("departure-pricing")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function continueMobileBooking() {
    if (checkoutStatus !== "idle" || (offlineRequestKey && offlineRequestKey === bookingCompletionKey)) return;
    if (bookingStage === 0 && !isLeadAuthenticated) {
      toast.warning("Sign in to continue", "Verify your mobile number before choosing your trip details.");
      focusBookingDetail({ message: "Verify your mobile number.", selector: '[aria-label="Lead traveller mobile number"]' });
      return;
    }
    if (bookingStage === 1 && (!selectedDeparture || bookingValidationErrors.length > 0)) {
      toast.warning("Check your departure", bookingValidationErrors[0] || "Select a departure.");
      return;
    }
    if (bookingStage === 1 && selectedChildren.some(child => !child.dateOfBirth)) {
      toast.warning("Add birth dates", "Add each child's date of birth to calculate the correct room price.");
      return;
    }
    if (bookingStage === 2 && !selectedAccommodationOption) {
      toast.warning("Choose your room", "Select an available accommodation option to continue.");
      return;
    }
    if (bookingStage === 3 && !canBookSeat) {
      toast.warning("Complete your details", bookingReminder);
      if (!isLeadAuthenticated) changeBookingStage(0);
      handleIncompleteBooking();
      return;
    }
    if (bookingStage < 4) {
      changeBookingStage((bookingStage + 1) as BookingStage);
      return;
    }
    if (!hasAcceptedBookingTerms || !canBookSeat) {
      toast.warning("Complete your booking", bookingReminder);
      if (!canBookSeat) changeBookingStage(isLeadAuthenticated ? 3 : 0);
      handleIncompleteBooking();
      return;
    }
    setIsPaymentChoiceOpen(true);
  }

  function openBookingFlow() {
    if (!bestDeparture) {
      setIsTourEnquiryOpen(true);
      return;
    }
    if (bookingScrollFrameRef.current) return;
    const section = document.getElementById("departure-pricing");
    if (!section) return;
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const offset = mobile ? 76 : 64;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let settled = 0;
    let lastY = window.scrollY;
    window.scrollTo({ top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - offset), behavior: reducedMotion ? "instant" : "smooth" });
    const finishScroll = () => {
      const nearTarget = Math.abs(section.getBoundingClientRect().top - offset) < 3;
      const stationary = Math.abs(window.scrollY - lastY) < 1;
      lastY = window.scrollY;
      settled = nearTarget || (stationary && performance.now() - started > 200) ? settled + 1 : 0;
      if (settled < 3 && performance.now() - started < 1600) {
        bookingScrollFrameRef.current = window.requestAnimationFrame(finishScroll);
        return;
      }
      bookingScrollFrameRef.current = 0;
      // Keep the booking anchor in the same screen position as the phone view compacts.
      const previousTop = section.getBoundingClientRect().top;
      flushSync(() => { setIsBookingFlowOpen(true); setActiveTab("pricing"); });
      document.getElementById("booking-heading")?.focus({ preventScroll: true });
      if (mobile) window.scrollBy({top: section.getBoundingClientRect().top - previousTop, behavior: "instant"});
    };
    bookingScrollFrameRef.current = window.requestAnimationFrame(finishScroll);
  }

  async function retryFailedPayment() {
    if (checkingRetryRef.current || bookingSubmissionRef.current || checkoutStatus !== "idle") return;
    checkingRetryRef.current = true;
    setIsCheckingRetry(true);
    try {
      const orderId = failedPaymentOrderRef.current;
      if (orderId && await recoverConfirmedPaymentOrder(orderId)) {
        setPaymentRetryMessage(null);
        return;
      }
      await handleBookSeat(retryPaymentOptionRef.current);
    } catch {
      setPaymentRetryMessage("We could not check your previous payment. Please check with your bank or contact our team before paying again. Your booking choices are still saved.");
    } finally {
      checkingRetryRef.current = false;
      setIsCheckingRetry(false);
    }
  }

  async function handleBookSeat(paymentOption = selectedPaymentOption, offline = false, bankTransfer = false) {
    if (bookingSubmissionRef.current) return;
    if (offlineRequestKey && offlineRequestKey === bookingCompletionKey) {
      setPaymentFeedback("Your offline payment request is already saved. Our team will confirm your booking after payment.");
      return;
    }
    if (
      !canBookSeat ||
      !hasAcceptedBookingTerms ||
      !selectedAccommodationOption ||
      !selectedDeparture ||
      checkoutStatus !== "idle"
    ) {
      if (checkoutStatus === "idle") handleIncompleteBooking();
      setPaymentFeedback(
        checkoutStatus !== "idle"
          ? "A payment attempt is already in progress."
          : "Complete the booking details and accept the terms before payment."
      );
      setIsPaymentChoiceOpen(false);
      return;
    }

    bookingSubmissionRef.current = true;
    retryPaymentOptionRef.current = paymentOption;
    setPaymentRetryMessage(null);
    setCheckoutStatus(offline ? "requesting_offline" : "creating");
    setPaymentFeedback("");
    setIsPaymentChoiceOpen(false);

    try {
      await pendingPaymentCancellationRef.current;
      await syncLeadTravellerProfileFromBooking(
        completeTravellerDetailForms
      ).catch((error) => {
        console.warn("Traveller profile sync failed before payment", error);
      });

      if (bankTransfer) {
        const response = await createInitialBankTransfer(createBookingPayload({
          accommodationOption: selectedAccommodationOption, departure: selectedDeparture,
          forms: completeTravellerDetailForms, paymentOption, tour: detail.tour, travellerCounts,
        }));
        setCheckoutStatus("idle");
        router.push("/bank-transfer/" + response.data.booking.id);
        return;
      }
      if (offline) {
        const response = await createOfflineBooking(createBookingPayload({
          accommodationOption: selectedAccommodationOption,
          departure: selectedDeparture,
          forms: completeTravellerDetailForms,
          paymentOption,
          tour: detail.tour,
          travellerCounts,
        }));
        setOfflineRequestKey(bookingCompletionKey);
        setPaymentFeedback("Booking " + (response.data.booking.bookingReference || response.data.booking.id) + ": " + response.message);
        setCheckoutStatus("idle");
        router.push(`/booking-submitted/${response.data.booking.id}`);
        return;
      }

      const paymentPayload = createBookingPayload({
        accommodationOption: selectedAccommodationOption,
        departure: selectedDeparture,
        forms: completeTravellerDetailForms,
        paymentOption,
        tour: detail.tour,
        travellerCounts,
      });
      const serializedPayload = JSON.stringify(paymentPayload);
      if (paymentRequestRef.current?.payload !== serializedPayload) {
        paymentRequestRef.current = { payload: serializedPayload, key: crypto.randomUUID() };
      }
      const order = (await createBookingPaymentOrder(paymentPayload, paymentRequestRef.current.key)).data;

      paymentOrderRef.current = order;
      await openRazorpayCheckout(order);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 410) paymentRequestRef.current = null;
      const orderId = paymentOrderRef.current?.checkout.orderId;

      if (orderId) {
        failedPaymentOrderRef.current = orderId;
        void cancelPaymentOrder(orderId);
      }

      paymentOrderRef.current = null;
      setCheckoutStatus("idle");
      const message = error instanceof Error ? error.message : "Payment could not be started. Please try again.";
      setPaymentFeedback(message);
      if (!offline && !bankTransfer) setPaymentRetryMessage(paymentFailureMessage(message));
    } finally {
      bookingSubmissionRef.current = false;
    }
  }

  return (
    <BookingFlowProvider errors={visibleBookingIssues} validationAttempt={validationAttempt} onIssueFocus={focusBookingIssue} stage={bookingStage} onStageChange={changeBookingStage} onAuthReadyChange={setIsLeadAuthenticated} onExit={() => { setIsBookingFlowOpen(false); window.requestAnimationFrame(() => window.scrollTo({top: 0, behavior: "smooth"})); }}>
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-secondary">
      <Header />
      <PaymentProceedingOverlay checkoutStatus={checkoutStatus} />
      <PaymentRetryNotice message={paymentRetryMessage} busy={isCheckingRetry || checkoutStatus !== "idle"} onRetry={() => void retryFailedPayment()} onDismiss={() => setPaymentRetryMessage(null)} />

      <section className="home-wide-frame mx-auto grid w-full gap-5 px-4 pb-7 pt-7 sm:px-5 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-0">
        <div className="min-w-0">
          <Breadcrumbs tourName={detail.tour.tourName} />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-heading text-[27px] font-bold leading-none tracking-normal text-secondary sm:text-title">
                {formatTourTitle(detail.tour.tourName)}
              </h1>
             
            </div>
            {isLoading ? (
              <span className="h-7 w-24 animate-pulse rounded-full bg-border" />
            ) : null}
          </div>

          <div className={isBookingFlowOpen ? "max-lg:hidden" : undefined}>
          <TourGallery
            images={galleryImages}
            selectedImage={selectedImage}
            selectedImageIndex={activeImageIndex}
            title={detail.tour.tourName}
            tour={detail.tour}
            tourType={detail.tour.category || detail.tour.tourType}
            onSelectImage={setSelectedImageIndex}
          />
          </div>

          <div className={cn("mt-4 lg:hidden", isBookingFlowOpen && "hidden")}>
            <TourHighlightCard
              action={
                <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <DownloadItineraryButton
                    departures={detail.departures}
                    destinations={detail.destinations}
                    expert={detail.expert}
                    gstPercentage={GST_PERCENTAGE}
                    itineraryDays={itineraryDays}
                    tour={detail.tour}
                  />
                  <button
                    type="button"
                    onClick={() => setIsTourEnquiryOpen(true)}
                    className="mt-2 inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-button-outline underline-offset-4 transition-colors hover:text-accent hover:underline"
                  >
                    Enquire Now
                  </button>
                </div>
              }
              departure={selectedDeparture || bestDeparture}
              departures={detail.departures}
              expert={detail.expert}
              tour={detail.tour}
            />
          </div>

          <TourTabs
            activeTab={activeTab}
            departures={detail.departures}
            itineraryDays={itineraryDays}
            isBookingFlowOpen={isBookingFlowOpen}
            onTabChange={setActiveTab}
            onOpenBookingFlow={openBookingFlow}
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
          <div className={isBookingFlowOpen ? "max-lg:hidden" : undefined}><TourAdditionalDetails tour={detail.tour} /></div>
        </div>

        <aside className={cn("space-y-2.5 lg:self-start", !isBookingFlowOpen && "lg:sticky lg:top-[90px]", isBookingFlowOpen && bookingStage !== 4 && "max-lg:hidden")}>
          <div className="hidden lg:block">
            <PriceCard
              accommodationOptions={accommodationOptions}
              bestDeparture={bestDeparture}
              balanceAmount={bookingBalanceAmount}
              balanceDueDate={bookingBalanceDueDate}
              canBook={canBookSeat}
              departures={detail.departures}
              destinations={detail.destinations}
              expert={detail.expert}
              gstAmount={bookingGstAmount}
              gstPercentage={GST_PERCENTAGE}
              itineraryDays={itineraryDays}
              paymentOption={selectedPaymentOption}
              price={price}
              selectedAccommodationOption={selectedAccommodationOption}
              selectedDeparture={selectedDeparture}
              subtotal={bookingSubtotal}
              tour={detail.tour}
              travellerCounts={travellerCounts}
              onEnquireNow={() => setIsTourEnquiryOpen(true)}
            />
          </div>
          <div className="hidden lg:block">
            <TourHighlightCard
              departure={selectedDeparture || bestDeparture}
              departures={detail.departures}
              expert={detail.expert}
              tour={detail.tour}
            />
          </div>
          {isBookingFlowOpen && selectedAccommodationOption ? (
            <BookingSummary
              balanceAmount={bookingBalanceAmount}
              balanceDueDate={bookingBalanceDueDate}
              depositAmount={bookingDepositAmount}
              grandTotal={bookingGrandTotal}
              gstAmount={bookingGstAmount}
              gstPercentage={GST_PERCENTAGE}
              paymentFeedback={paymentFeedback}
              paymentOption={selectedPaymentOption}
              selectedAccommodationOption={selectedAccommodationOption}
              selectedDeparture={selectedDeparture}
              subtotal={bookingSubtotal}
              tour={detail.tour}
              travellerCounts={travellerCounts}
            />
          ) : null}
          {bestDeparture ? <BookingTermsCard
            accepted={hasAcceptedBookingTerms}
            canBook={canBookSeat}
            onAcceptedChange={(accepted) =>
              setAcceptedBookingTermsKey(accepted ? bookingCompletionKey : "")
            }
          /> : null}
          <SidebarTourActions
            hasBookableDeparture={Boolean(bestDeparture)}
            bookingReminder={bookingReminder}
            onIncomplete={handleIncompleteBooking}
            showAirfareNotice={isAirfareExcluded(detail.tour)}
            canPay={hasAcceptedBookingTerms && canBookSeat}
            checkoutStatus={checkoutStatus}
            isBookingFlowOpen={isBookingFlowOpen}
            onBook={() => setIsPaymentChoiceOpen(true)}
            hasOfflineRequest={Boolean(offlineRequestKey && offlineRequestKey === bookingCompletionKey)}
            onBookNow={openBookingFlow}
          />
          <div className={isBookingFlowOpen ? "max-lg:hidden" : undefined}><HelpCard contact={siteContact} /></div>
        </aside>
      </section>

      <MobileBookingBar
        suspended={isPaymentChoiceOpen || checkoutStatus !== "idle"}
        isBookingFlowOpen={isBookingFlowOpen}
        bookingStage={bookingStage}
        total={bookingGrandTotal}
        isBusy={checkoutStatus !== "idle" || Boolean(offlineRequestKey && offlineRequestKey === bookingCompletionKey)}
        onContinue={continueMobileBooking}
        isAuthenticated={isLeadAuthenticated}
        airfareExtra={isAirfareExcluded(detail.tour)}
        onBookNow={openBookingFlow}
        price={price}
      />
      {isPaymentChoiceOpen ? (
        <PaymentChoiceModal
          advanceAmount={bookingDepositAmount}
          balanceAmount={bookingBalanceAmount}
          fullAmount={bookingGrandTotal}
          isBusy={checkoutStatus !== "idle"}
          onClose={() => setIsPaymentChoiceOpen(false)}
          onPayAdvance={() => handleBookSeat("advance")}
          onPayFull={() => handleBookSeat("full")}
          onPayOffline={() => handleBookSeat(selectedPaymentOption, true)}
          onPayBankTransfer={bankTransferEnabled ? (option) => void handleBookSeat(option, false, true) : undefined}
        />
      ) : null}
      {isTourEnquiryOpen ? (
        <EnquiryModal
          bestDeparture={selectedDeparture || bestDeparture}
          departures={detail.departures}
          initialTravellerCounts={travellerCounts}
          tourId={detail.tour.tourId}
          tourName={detail.tour.tourName}
          onClose={() => setIsTourEnquiryOpen(false)}
        />
      ) : null}
    </main>
    </BookingFlowProvider>
  );
}

function PaymentProceedingOverlay({
  checkoutStatus,
}: {
  checkoutStatus: CheckoutStatus;
}) {
  const shouldShowOverlay =
    checkoutStatus === "creating" || checkoutStatus === "verifying" || checkoutStatus === "requesting_offline";

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
      : checkoutStatus === "requesting_offline"
        ? "Please wait while we save your offline payment request."
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
          {checkoutStatus === "requesting_offline" ? "Saving your request..." : "Payment proceeding..."}
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
    <nav className="flex flex-wrap items-center gap-1.5 font-sans text-[13px] font-medium text-secondary/52 sm:gap-2.5 sm:text-[15px]">
      <Link prefetch={false} href="/" className="transition-colors hover:text-brand-text">
        Home
      </Link>
      <ChevronRight className="size-3.5 text-secondary/35" />
      <Link prefetch={false} href="/tours" className="transition-colors hover:text-brand-text">
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
  primaryDestination: PublicDestination | undefined;
  tour: PublicTour;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-[14px] font-semibold text-secondary sm:gap-x-5 sm:text-[15px]">
      <MetaItem iconSrc="/Tour-assets/tour-guide.png" label={getDurationLabel(tour)} />
      <MetaItem
        iconSrc="/Tour-assets/bus.png"
        label={`From ${getRouteLabel(tour, destinations, primaryDestination)}`}
      />
      <MetaItem iconSrc="/Tour-assets/footprint.png" label={getDifficultyLabel(tour)} />
    </div>
  );
}

function MetaItem({
  iconSrc,
  label,
}: {
  iconSrc: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={17}
        height={17}
        className="size-[17px] shrink-0 object-contain"
      />
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
  tour,
  tourType,
}: {
  images: string[];
  onSelectImage: (index: number) => void;
  selectedImage: string;
  selectedImageIndex: number;
  title: string;
  tour: PublicTour;
  tourType: string;
}) {
  const thumbnails = images;
  const categoryLabels = splitTourCategoryLabels(tour);
  const bannerCategoryLabels =
    categoryLabels.length > 0 ? categoryLabels : [tourType || "Heritage Walk"];

  useEffect(() => {
    if (images.length < 2) {
      return;
    }

    const autoplayId = window.setInterval(() => {
      onSelectImage((selectedImageIndex + 1) % images.length);
    }, 7000);

    return () => window.clearInterval(autoplayId);
  }, [images.length, onSelectImage, selectedImageIndex]);

  function moveImage(direction: number) {
    if (images.length === 0) {
      return;
    }

    const nextIndex =
      (selectedImageIndex + direction + images.length) % images.length;

    onSelectImage(nextIndex);
  }

  return (
    <section className="mt-5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] bg-border sm:aspect-[1.95/1]">
        {selectedImage ? (
          <Image
            key={selectedImage}
            src={selectedImage}
            alt={title}
            fill
            priority
            sizes="(min-width: 1024px) 860px, 100vw"
            className="animate-[gallery-slide_900ms_cubic-bezier(0.22,1,0.36,1)] object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center font-sans text-sm font-semibold text-secondary/55">
            No gallery images available
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_58%,rgba(0,0,0,0.42)_100%)]" />
        <div className="hidden sm:absolute sm:bottom-4 sm:left-4 sm:right-4 sm:flex sm:max-w-[calc(100%-2rem)] sm:flex-wrap sm:items-center sm:gap-2">
          {bannerCategoryLabels.map((label) => (
            <span
              key={label}
              className="inline-flex h-8 max-w-full items-center rounded-full bg-secondary/60 px-3 font-sans text-[12px] font-semibold leading-none text-white backdrop-blur-[2px] sm:px-4"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {thumbnails.length > 0 ? (
        <div className="mt-3 grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-1.5 sm:grid-cols-[38px_minmax(0,1fr)_38px] sm:gap-2">
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => moveImage(-1)}
          className="grid size-8 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:bg-brand-button-dark hover:text-white sm:size-9"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
          {thumbnails.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`View tour photo ${index + 1}`}
              onClick={() => onSelectImage(index)}
              className={cn(
                "relative h-[52px] w-[92px] shrink-0 overflow-hidden rounded-[8px] border bg-border transition-all min-[420px]:h-[60px] min-[420px]:w-[112px] sm:h-[74px] sm:w-[150px]",
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
          className="grid size-8 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:bg-brand-button-dark hover:text-white sm:size-9"
        >
          <ChevronRight className="size-4" />
        </button>
        </div>
      ) : null}
    </section>
  );
}

function TourTabs({
  activeTab,
  departures,
  expert,
  itinerary,
  itineraryDays,
  isBookingFlowOpen,
  onOpenBookingFlow,
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
  itinerary: PublicTourItinerary | null;
  itineraryDays: ItineraryDay[];
  isBookingFlowOpen: boolean;
  onOpenBookingFlow: () => void;
  onTabChange: (tab: TourTab) => void;
  primaryDestination: PublicDestination | undefined;
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
      if (isBookingFlowOpen && window.matchMedia("(max-width: 1023px)").matches) return;

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
        (tabBar?.getBoundingClientRect().height || 56) +
        (window.matchMedia("(max-width: 639px)").matches ? 76 : 40);
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
  }, [activeTab, onTabChange, isBookingFlowOpen]);

  function handleTabClick(tab: (typeof tabs)[number]) {
    onTabChange(tab.value);
    const section = document.getElementById(tab.sectionId);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      id="tour-detail-panel"
      className="mt-5"
    >
      <div
        data-tour-tabs
        data-tour-tabs-shell
        className={cn(isBookingFlowOpen && "max-lg:hidden", "tour-detail-tabs sticky top-[60px] z-[2147483646] min-h-12 overflow-hidden rounded-[8px] border border-border bg-card shadow-[0_6px_16px_rgba(67,43,27,0.08)] sm:top-0 sm:z-[2147483647] sm:shadow-none")}
      >
        <nav
          aria-label="Tour sections"
          className="grid w-full grid-cols-2 sm:grid-cols-4 xl:grid-cols-[0.95fr_1.3fr_1.35fr_1fr]"
        >
          {tabs.map((tab) => {
            const { icon: Icon, label, value } = tab;

            return (
              <a
                key={value}
                id={`tour-section-link-${value}`}
                href={`#${tab.sectionId}`}
                data-tour-tab-value={value}
                aria-controls={tab.sectionId}
                aria-current={activeTab === value ? "location" : undefined}
                onClick={event => { event.preventDefault(); handleTabClick(tab); }}
                className={cn(
                  "relative flex min-h-12 min-w-0 shrink-0 items-center justify-center gap-1.5 border-r border-b border-border px-3 font-sans text-[14px] font-semibold transition-colors last:border-r-0 sm:min-h-12 sm:min-w-0 sm:shrink sm:gap-2 sm:px-2 sm:text-[15px] xl:border-b-0",
                  activeTab === value
                    ? "bg-muted/45 text-brand-text"
                    : "text-secondary hover:bg-primary/5 hover:text-brand-text"
                )}
              >
                <Icon className="hidden size-3.5 shrink-0 sm:block sm:size-4" strokeWidth={1.8} />
                <span className="min-w-0 whitespace-normal break-words text-center leading-tight">
                  {label}
                </span>
                {activeTab === value ? (
                  <span className="absolute bottom-0 left-5 right-5 h-0.5 bg-primary" />
                ) : null}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 space-y-5">
        <section
          id="itinerary"
          aria-labelledby="tour-section-link-itinerary"
          tabIndex={-1}
          className={cn(isBookingFlowOpen && "max-lg:hidden", "scroll-mt-[168px] rounded-[8px] border border-border bg-card sm:scroll-mt-[64px] p-4 sm:p-5")}
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
          aria-labelledby="tour-section-link-inclusions"
          tabIndex={-1}
          className={cn(isBookingFlowOpen && "max-lg:hidden", "scroll-mt-[168px] rounded-[8px] border border-border bg-card sm:scroll-mt-[64px] p-4  sm:p-5")}
        >
          <InclusionsPanel tour={tour} />
        </section>

        <section
          id="departure-pricing"
          aria-labelledby="booking-heading"
          tabIndex={-1}
          className={cn("booking-mobile-form rounded-[8px] border border-border bg-card p-4 sm:p-5", isBookingFlowOpen ? "scroll-mt-[76px] lg:scroll-mt-[64px]" : "scroll-mt-[168px] sm:scroll-mt-[64px]")}
        >
          <h2 id="booking-heading" tabIndex={-1} className="sr-only">Book {tour.tourName}</h2>
          <PricingPanel
            departures={departures}
            isBookingFlowOpen={isBookingFlowOpen}
            onOpenBookingFlow={onOpenBookingFlow}
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
          aria-labelledby="tour-section-link-expert"
          tabIndex={-1}
          className={cn(isBookingFlowOpen && "max-lg:hidden", "scroll-mt-[168px] rounded-[8px] border border-border bg-card sm:scroll-mt-[64px] p-4 sm:p-5", !getYoutubeEmbedUrl(tour.video) && "max-lg:border-0 max-lg:p-0")}
        >
          <ExpertPanel expert={expert} tour={tour} />
        </section>
      </div>
    </section>
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
  primaryDestination: PublicDestination | undefined;
  tour: PublicTour;
}) {
  const summary =
    itinerary?.itinerarySummary ||
    tour.description ||
    primaryDestination?.shortDescription ||
    "Each day combines landmark visits, expert interpretation and time to absorb the destination.";

  return (
    <div>
      <SectionTitle title="Detailed Itinerary" />
      <ExpandableItinerarySummary key={summary} text={summary} />
      <DailyItinerary
        days={itineraryDays}
        images={getTourImages(tour)}
      />
    </div>
  );
}

type AdditionalTourTab = "flight" | "accommodation" | "reporting";

function TourAdditionalDetails({ tour }: { tour: PublicTour }) {
  const [activeTab, setActiveTab] = useState<AdditionalTourTab>("flight");
  const tabItems: Array<{
    icon: LucideIcon;
    label: string;
    value: AdditionalTourTab;
  }> = [
    { icon: Plane, label: "Flight Details", value: "flight" },
    { icon: Hotel, label: "Accommodation Details", value: "accommodation" },
    { icon: MapPin, label: "Reporting & Dropping", value: "reporting" },
  ];
  const contentByTab: Record<AdditionalTourTab, string[]> = {
    flight: tour.flightDetails || [],
    accommodation: tour.accommodationDetails || [],
    reporting: tour.reportingAndDropping || [],
  };

  return (
    <section className="mt-5 space-y-5">
      <div className="overflow-hidden rounded-[8px] border border-border bg-card">
        <div role="tablist" aria-label="Additional tour details" onKeyDown={handleTabKeyDown} className="flex gap-1 overflow-x-auto overscroll-x-contain border-b border-border bg-transparent p-1 sm:grid sm:grid-cols-3 sm:gap-0 sm:overflow-visible sm:border-b sm:bg-muted/45 sm:p-0">
          {tabItems.map(({ icon: Icon, label, value }, index) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`tour-additional-tab-${value}`}
              aria-controls={`tour-additional-panel-${value}`}
              aria-selected={activeTab === value}
              tabIndex={activeTab === value ? 0 : -1}
              onClick={() => setActiveTab(value)}
              className={cn(
                "flex min-h-10 min-w-[150px] shrink-0 items-center justify-center gap-3 rounded-[7px] border border-border px-2 py-2 text-center font-sans text-[14px] font-semibold leading-[1.3] transition-colors sm:min-h-12 sm:min-w-0 sm:shrink sm:rounded-none sm:border-0 sm:border-b-2 sm:px-3 sm:py-3 sm:text-[14px]",
                index === 2 && "col-span-2 sm:col-span-1",
                activeTab === value
                  ? "border-primary bg-brand-button-dark text-white sm:border-primary sm:bg-brand-button-dark sm:shadow-none"
                  : "bg-white text-secondary/52 hover:border-primary/30 hover:bg-primary/5 hover:text-brand-text sm:border-transparent sm:bg-transparent sm:hover:bg-primary/8"
              )}
            >
              <Icon className="hidden size-4 shrink-0 sm:block" strokeWidth={1.8} />
              <span className="whitespace-nowrap text-[14px] font-semibold leading-[1.35] sm:whitespace-normal sm:break-words sm:text-[14px]">
                {label}
              </span>
            </button>
          ))}
        </div>
        {tabItems.map(({ value }) => (
          <div key={value} role="tabpanel" id={`tour-additional-panel-${value}`}
            aria-labelledby={`tour-additional-tab-${value}`} hidden={activeTab !== value} tabIndex={0}>
            <TourInfoList
              items={contentByTab[value]}
              emptyMessage="Details will be shared by the Ancient Trails team."
            />
          </div>
        ))}
      </div>

      <PolicyPanel
        icon={ShieldCheck}
        items={tour.paymentPolicy || []}
        title="Payment Policy"
        type="payment"
      />
      <PolicyPanel
        icon={ShieldCheck}
        items={tour.cancellationPolicy || []}
        title="Cancellation Policy"
        type="cancellation"
      />
      <PolicyPanel
        icon={Info}
        items={tour.needToKnow || []}
        title="Need to Know"
        type="needToKnow"
      />
    </section>
  );
}

function TourInfoList({
  emptyMessage,
  items,
}: {
  emptyMessage: string;
  items: string[];
}) {
  return (
    <div className="p-5 sm:p-6">
      {items.length > 0 ? (
        <ul className="grid gap-3 font-sans text-[14px] font-medium leading-[1.6] text-secondary/78 sm:text-[15px]">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-sans text-[14px] font-medium text-secondary/55">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function PolicyPanel({
  icon: Icon,
  items,
  title,
  type,
}: {
  icon: LucideIcon;
  items: TourCancellationPolicyRow[] | TourNeedToKnowGroup[] | TourPaymentPolicyRow[];
  title: string;
  type: "payment" | "cancellation" | "needToKnow";
}) {
  return (
    <section className="rounded-[8px] border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="font-heading text-[18px] font-Semibold  tracking-[0.04em] text-secondary sm:text-[20px]">
          {title}
        </h2>
      </div>
      {type === "payment" ? (
        <PaymentPolicyContent />
      ) : type === "cancellation" ? (
        <CancellationPolicyContent />
      ) : (
        <NeedToKnowContent groups={items as TourNeedToKnowGroup[]} />
      )}
    </section>
  );
}

function PaymentPolicyContent() {
  const policies = [
    {
      condition: "If the package cost below \u20b920,000 per person",
      payments: [
        { timing: "", amount: "Full payment at the time of booking." },
      ],
    },
    {
      condition: "If the package cost above \u20b920,000 per person",
      payments: [
        { timing: "At the time of booking", amount: "40% of the package cost" },
        { timing: "30 days prior to departure", amount: "60% of the package cost (Remaining amount)" },
      ],
    },
  ];

  return (
    <div className="pt-4 sm:p-6">
      <div className="space-y-5">
        {policies.map((policy) => (
          <details key={policy.condition} open className="group/payment overflow-hidden rounded-[12px] border border-primary/15 bg-card shadow-[0_6px_18px_rgba(67,43,27,0.04)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 bg-[#fff8f1] px-4 py-3 [&::-webkit-details-marker]:hidden sm:gap-5 sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text">
                <Users className="size-5" strokeWidth={1.8} />
              </span>
              <h3 className="min-w-0 flex-1 font-sans text-[13px] font-semibold leading-tight text-secondary sm:text-[15px]">
                {policy.condition}
              </h3>
              <ChevronDown className="size-5 shrink-0 text-brand-text transition-transform group-open/payment:rotate-180" />
            </summary>
            <div className="px-4 sm:px-7">
              {policy.payments.map(({ timing, amount }) => (
                <div key={amount} className="flex items-center gap-3 py-3 font-sans text-[13px] font-medium leading-[1.55] text-secondary/78 sm:gap-6 sm:text-[15px] sm:font-normal [&+div]:border-t [&+div]:border-border/60">
                  <div className={cn(
                    "min-w-0 flex-1",
                    timing && "grid gap-2 md:grid-cols-2 md:items-center md:gap-4"
                  )}>
                    {timing ? <p>{timing}</p> : null}
                    <p className={cn(
                      !timing && "py-2",
                      timing && "rounded-[9px] bg-[#fff8f1] px-4 py-3 sm:px-5"
                    )}>
                      <PaymentPolicyText text={amount} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
        <div className="rounded-[12px] border border-border bg-muted/35 px-4 sm:px-6">
          <div className="flex items-start gap-3 py-4 font-sans text-[13px] font-medium leading-[1.55] text-secondary/78 sm:gap-5 sm:text-[15px] sm:font-normal">
            <p className="min-w-0">
              Payment can be done via cheque, Demand Draft, NEFT, RTGS, IMPS, Credit Card/ Debit Card or UPI gateway.
              <br />
              Cheque/Demand Draft should be drawn in favor of {"\u201c"}<strong className="font-bold text-brand-text">ANCIENT TRAILS</strong>{"\u201d"}.
            </p>
          </div>
          <div className="flex items-start gap-3 border-t border-border/60 py-4 font-sans text-[13px] font-medium leading-[1.55] text-secondary/78 sm:gap-5 sm:text-[15px] sm:font-normal">
            <p className="min-w-0">
              In case of payment made by cheque, a booking confirmation will be given subject to cheque clearance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentPolicyText({ text }: { text: string }) {
  return text.split(/(\d+(?:\.\d+)?\s*%|ANCIENT TRAILS)/gi).map((part, index) =>
    /^(?:\d+(?:\.\d+)?\s*%|ANCIENT TRAILS)$/i.test(part) ? (
      <strong key={index} className="font-semibold text-brand-text">
        {part}
      </strong>
    ) : <span key={index}>{part}</span>
  );
}

function CancellationPolicyContent() {
  const rows = [
    { days: "0 \u2013 10", charge: "100%" },
    { days: "10 \u2013 20", charge: "50%" },
    { days: "20 \u2013 30", charge: "30%" },
    { days: "30 and above", charge: "10%" },
  ];
  const notes = [
    "For cancellation procedure, a traveler will need to give an application in writing along with an original receipt of booking.",
    "Please note that if air ticket booking is done with NON-REFUNDABLE airfare then cancellation charges to be borne by the customer and the remaining amount will be refunded as per above cancellation policy.",
  ];

  return (
    <div className="space-y-5 pt-4 sm:p-6">
      <details open className="group/cancellation overflow-hidden rounded-[12px] border border-primary/15 bg-card shadow-[0_6px_18px_rgba(67,43,27,0.04)]">
        <summary className="flex cursor-pointer list-none items-center gap-3 bg-[#fff8f1] px-4 py-3 [&::-webkit-details-marker]:hidden sm:gap-5 sm:px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-brand-text">
            <CalendarDays className="size-5" strokeWidth={1.8} />
          </span>
          <h3 className="min-w-0 flex-1 font-sans text-[13px] font-semibold leading-tight text-secondary sm:text-[15px]">
            Cancellation charges applicable per person
          </h3>
          <ChevronDown className="size-5 shrink-0 text-brand-text transition-transform group-open/cancellation:rotate-180" />
        </summary>
        <div className="p-3 sm:p-4">
          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-[10px] border border-border/60">
              <table className="w-full table-fixed border-collapse font-sans text-[13px] leading-[1.55] text-secondary/78 sm:text-[15px]">
                <thead>
                  <tr className="bg-[#fff8f1] text-left font-semibold">
                    <th scope="col" className="w-[55%] px-3 py-4 sm:px-5">
                      Cancellation received no. of days prior to departure
                    </th>
                    <th scope="col" className="px-3 py-4 sm:px-5">
                      Cancellation charges applicable per person
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className={cn("border-t border-border/60", index % 2 ? "bg-muted/35" : "bg-card")}>
                      <td className="px-3 py-2.5 sm:px-5">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <span className="min-w-0 font-medium break-words sm:font-normal">
                            {row.days}
                          </span>
                        </div>
                      </td>
                      <td className="border-l border-border/60 px-2 py-2.5 sm:px-4">
                        <div className="rounded-[9px] bg-[#fff8f1] px-3 py-3 font-semibold break-words text-brand-text sm:px-4">
                          {row.charge}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-sans text-[14px] font-medium text-secondary/55">
              This information will be shared by the Ancient Trails team.
            </p>
          )}
        </div>
      </details>
      <div className="rounded-[12px] border border-border bg-muted/35 px-4 sm:px-6">
        {notes.map((note) => (
          <div key={note} className="flex items-start gap-3 py-4 font-sans text-[13px] font-medium leading-[1.55] text-secondary/78 sm:gap-5 sm:text-[15px] sm:font-normal [&+div]:border-t [&+div]:border-border/60">
            <p className="min-w-0">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedToKnowContent({ groups }: { groups: TourNeedToKnowGroup[] }) {
  return groups.length > 0 ? (
    <div className="space-y-5 p-5 font-sans text-[14px] leading-[1.65] text-secondary/82 sm:p-6 sm:text-[15px]">
      {groups.map((group, index) => (
        <section key={`${group.heading}-${index}`}>
          <h3 className="font-semibold text-secondary">{group.heading}</h3>
          <ul className="mt-2 grid gap-2 pl-5">
            {group.items.map((item) => <li key={item} className="list-disc">{item}</li>)}
          </ul>
        </section>
      ))}
    </div>
  ) : (
    <p className="p-5 font-sans text-[14px] font-medium text-secondary/55 sm:p-6">This information will be shared by the Ancient Trails team.</p>
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
          className="mt-2 font-sans text-[15px] font-bold text-button-outline transition-colors hover:text-accent"
        >
          {isExpanded ? "Read Less" : "Read More"}
        </button>
      ) : null}
    </div>
  );
}

function InclusionsPanel({ tour }: { tour: PublicTour }) {
  const inclusions = getTourInclusions(tour);
  const exclusions = getTourExclusions(tour);

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
    totalSeats: departure.totalSeats,
    seatsAvailable: getDepartureSeatsLeft(departure),
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

function formatBalanceDueDate(value: Date | null) {
  return value ? formatDate(value.toISOString()) : "-";
}

function DateOfBirthPicker({
  ariaLabel,
  fieldId,
  validationId,
  required = false,
  disabled = false,
  onChange,
  value,
}: {
  ariaLabel: string;
  fieldId?: string;
  validationId?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const fieldProps = useBookingFieldProps();
  const controlId = fieldId || "booking-" + ariaLabel.toLowerCase().replace(/\s+/g, "-");
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
    <div ref={pickerRef} className="relative" onKeyDown={event => { if (event.key === "Escape") { setIsOpen(false); document.getElementById(controlId)?.focus(); } }}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-controls={isOpen ? controlId + "-calendar" : undefined}
        aria-expanded={!disabled && isOpen}
        aria-label={ariaLabel}
        {...fieldProps(controlId, validationId || fieldId)}
        aria-required={required}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={event => { if (event.key === "ArrowDown" && !isOpen) { event.preventDefault(); setIsOpen(true); } }}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15",
          displayValue ? "text-secondary" : "text-secondary/40",
          !disabled && isOpen && "border-primary ring-3 ring-primary/15",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span>{displayValue || "Date of Birth *"}</span>
        <CalendarDays className="size-4 text-brand-text" strokeWidth={1.8} />
      </button>

      {!disabled && isOpen ? (
        <div data-booking-calendar id={controlId + "-calendar"} role="dialog" aria-label={ariaLabel + " calendar"} className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-2rem))] rounded-[8px] border border-primary/25 bg-card p-3 font-sans text-secondary ">
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
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-brand-text" />
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
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-brand-text" />
            </label>

            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div data-calendar-days className="mt-3 grid grid-cols-7 gap-1 text-center">
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
                      : "text-button-outline hover:bg-primary/10 hover:text-button-outline",
                    isFutureDate &&
                      "cursor-not-allowed text-button-outline hover:bg-transparent hover:text-secondary/28"
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
  isBookingFlowOpen,
  onOpenBookingFlow,
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
  isBookingFlowOpen: boolean;
  onOpenBookingFlow: () => void;
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
  const toast = useToast();
  const { onAuthReadyChange } = useBookingFlow();
  const fieldProps = useBookingFieldProps();
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
    selectedDeparture && getDepartureSeatsLeft(selectedDeparture) > 0
      ? getDepartureSeatsLeft(selectedDeparture)
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
  >({});
  // Read browser credentials in the session effect after hydration.
  const [travellerSession, setTravellerSession] = useState<TravellerSession | null>(null);
  const [leadOtp, setLeadOtp] = useState("");
  const [leadOtpTargetMobileNumber, setLeadOtpTargetMobileNumber] =
    useState("");
  const [leadRegistrationToken, setLeadRegistrationToken] = useState("");
  const [hasLeadOtpBeenRequested, setHasLeadOtpBeenRequested] = useState(false);
  const [verifiedLeadMobileNumber, setVerifiedLeadMobileNumber] = useState("");
  const [leadAuthMessage, setLeadAuthMessage] = useState("");
  const [leadAuthError, setLeadAuthError] = useState("");
  const [isRequestingLeadOtp, setIsRequestingLeadOtp] = useState(false);
  const [isVerifyingLeadOtp, setIsVerifyingLeadOtp] = useState(false);
  const [leadOtpCooldownSeconds, setLeadOtpCooldownSeconds] = useState(0);
  const [isGroupEnquiryOpen, setIsGroupEnquiryOpen] = useState(false);
  const leadTravellerDetails = {
    ...defaultTravellerDetailForm,
    ...(travellerDetailForms["adult-1"] || {}),
  };
  const isLeadTravellerLoggedIn = Boolean(travellerSession?.sessionId);
  const leadTravellerAuthMobileNumber =
    getLeadTravellerAuthMobileNumber(leadTravellerDetails);
  const travellerProfileAuthMobileNumber = getProfileAuthMobileNumber(
    travellerSession?.user.mobileNumber
  );
  const isLeadTravellerUsingProfileMobile = Boolean(
    travellerProfileAuthMobileNumber &&
      travellerProfileAuthMobileNumber === leadTravellerAuthMobileNumber
  );
  const isLeadTravellerSessionMobileVerified = Boolean(
    isLeadTravellerLoggedIn &&
      travellerSession?.user.isMobileVerified &&
      isLeadTravellerUsingProfileMobile
  );
  const hasVerifiedLeadMobileNumber =
    Boolean(leadTravellerAuthMobileNumber) &&
    (verifiedLeadMobileNumber === leadTravellerAuthMobileNumber ||
      isLeadTravellerSessionMobileVerified);
  const hasLeadRegistrationOtpVerification = Boolean(
    leadRegistrationToken &&
      leadOtpTargetMobileNumber === leadTravellerAuthMobileNumber
  );
  const canEditTravellerDetailFields =
    hasVerifiedLeadMobileNumber || hasLeadRegistrationOtpVerification;
  const resolvedActiveTravellerDetailId = canEditTravellerDetailFields
    ? activeTravellerDetailId
    : "adult-1";
  const activeTravellerDetailTab =
    travellerDetailTabs.find((tab) => tab.id === resolvedActiveTravellerDetailId) ||
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
  const isLeadTravellerAuthReady = hasVerifiedLeadMobileNumber;
  const areLeadTravellerProfileFieldsReady = Boolean(
    leadTravellerDetails.firstName.trim() &&
      leadTravellerDetails.lastName.trim() &&
      isValidEmail(leadTravellerDetails.email)
  );
  const areAllTravellerDetailsComplete = useMemo(
    () =>
      travellerDetailTabs.length > 0 &&
      travellerDetailTabs.every((tab) => {
        const travellerDetails = {
          ...defaultTravellerDetailForm,
          ...(travellerDetailForms[tab.id] || {}),
        };
        return (
          isTravellerDetailFormComplete(travellerDetails, tab.id === "adult-1") &&
          (tab.id === "adult-1" || /^[0-9]{10}$/.test(travellerDetails.mobileNumber))
        );
      }),
    [travellerDetailForms, travellerDetailTabs]
  );
  const bookingEmergencyContactWarning = getEmergencyContactTravellerWarning(
    leadTravellerDetails,
    travellerDetailTabs,
    travellerDetailForms
  );
  const areTravellerDetailsCompleteForBooking =
    areAllTravellerDetailsComplete &&
    isBookingEmergencyContactComplete(leadTravellerDetails) &&
    !bookingEmergencyContactWarning &&
    isLeadTravellerAuthReady;
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
  const selectedAccommodationOption = selectAccommodationOption(
    accommodationOptions, selectedAccommodationOptionId
  );
  const resolvedSelectedAccommodationOptionId =
    selectedAccommodationOption?.id || "";

  const applyLeadTravellerProfile = useCallback((user: TravellerUser | null) => {
    const leadTravellerForm = getLeadTravellerFormFromProfile(user);

    if (!leadTravellerForm) {
      return;
    }

    setTravellerDetailForms((current) => {
      const currentLeadTraveller = {
        ...defaultTravellerDetailForm,
        ...(current["adult-1"] || {}),
      };

      return {
        ...current,
        "adult-1": {
          ...currentLeadTraveller,
          title: leadTravellerForm.title || currentLeadTraveller.title,
          firstName:
            leadTravellerForm.firstName || currentLeadTraveller.firstName,
          lastName: leadTravellerForm.lastName || currentLeadTraveller.lastName,
          email: leadTravellerForm.email || currentLeadTraveller.email,
          mobileNumber:
            leadTravellerForm.mobileNumber || currentLeadTraveller.mobileNumber,
          phoneCountryCode:
            leadTravellerForm.phoneCountryCode ||
            currentLeadTraveller.phoneCountryCode,
          gender: leadTravellerForm.gender || currentLeadTraveller.gender,
          dateOfBirth:
            leadTravellerForm.dateOfBirth || currentLeadTraveller.dateOfBirth,
          address: currentLeadTraveller.address,
        },
      };
    });
  }, []);

  useEffect(() => {
    const syncTravellerSession = () => {
      const nextTravellerSession = getTravellerSession();

      setTravellerSession(nextTravellerSession);
      applyLeadTravellerProfile(nextTravellerSession?.user ?? null);
    };

    const unsubscribe = listenForTravellerSessionChanges(syncTravellerSession);
    syncTravellerSession();

    return unsubscribe;
  }, [applyLeadTravellerProfile]);

  useEffect(() => {
    if (leadOtpCooldownSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setLeadOtpCooldownSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [leadOtpCooldownSeconds]);

  useEffect(() => {
    onAuthReadyChange(hasVerifiedLeadMobileNumber);
  }, [hasVerifiedLeadMobileNumber, onAuthReadyChange]);

  useEffect(() => {
    onTravellerDetailsCompleteChange(areTravellerDetailsCompleteForBooking);
  }, [
    areTravellerDetailsCompleteForBooking,
    onTravellerDetailsCompleteChange,
  ]);

  useEffect(() => {
    onTravellerDetailsChange(
      getCompleteTravellerDetailForms(travellerCounts, travellerDetailForms)
    );
  }, [onTravellerDetailsChange, travellerCounts, travellerDetailForms]);

  function updateTravellerCount(key: TravellerCountKey, delta: number) {
    setTravellerCounts((current) => {
      const minimum = key === "adults" ? 1 : 0;
      const nextCounts = { ...current, [key]: Math.max(minimum, current[key] + delta) };
      if (delta > 0 && getTotalTravellers(nextCounts) > Math.min(BOOKING_TRAVELLER_LIMIT, maxTravellers)) {
        return current;
      }
      return nextCounts;
    });
  }

  function resetLeadOtpChallenge() {
    setLeadOtp("");
    setLeadOtpTargetMobileNumber("");
    setLeadRegistrationToken("");
    setHasLeadOtpBeenRequested(false);
    setLeadAuthMessage("");
    setLeadAuthError("");
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
    if (field === "mobileNumber" && activeTravellerDetailTab.id !== "adult-1") {
      value = value.replace(/[^0-9]/g, "").slice(0, 10);
    }
    setTravellerDetailForms((current) => ({
      ...current,
      [activeTravellerDetailTab.id]: {
        ...defaultTravellerDetailForm,
        ...(current[activeTravellerDetailTab.id] || {}),
        [field]: value,
      },
    }));

    if (
      activeTravellerDetailTab.id === "adult-1" &&
      (field === "mobileNumber" || field === "phoneCountryCode")
    ) {
      resetLeadOtpChallenge();
    }
  }

  function updateLeadTravellerDetail(
    field: TravellerDetailField,
    value: TravellerDetailForm[TravellerDetailField]
  ) {
    setTravellerDetailForms((current) => ({
      ...current,
      "adult-1": {
        ...defaultTravellerDetailForm,
        ...(current["adult-1"] || {}),
        [field]: value,
      },
    }));

    if (field === "mobileNumber" || field === "phoneCountryCode") {
      resetLeadOtpChallenge();
    }
  }

  function validateLeadTravellerRegistrationDetails() {
    if (
      !leadTravellerDetails.firstName.trim() ||
      !leadTravellerDetails.lastName.trim()
    ) {
      return "Enter the lead traveller first and last name before verifying OTP.";
    }

    if (!isValidEmail(leadTravellerDetails.email)) {
      return "Enter a valid lead traveller email address before verifying OTP.";
    }

    return "";
  }

  function saveLeadTravellerSession(
    session: TravellerSession,
    messageTitle: string,
    message: string
  ) {
    saveTravellerSession(session);
    setTravellerSession(session);
    applyLeadTravellerProfile(session.user);
    setVerifiedLeadMobileNumber(leadTravellerAuthMobileNumber);
    setLeadOtp("");
    setLeadOtpTargetMobileNumber("");
    setLeadRegistrationToken("");
    setHasLeadOtpBeenRequested(false);
    setLeadOtpCooldownSeconds(0);
    setLeadAuthMessage(message);
    setLeadAuthError("");
    toast.success(messageTitle, message);
  }

  async function handleLeadTravellerRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadAuthError("");
    setLeadAuthMessage("");

    if (!leadTravellerAuthMobileNumber || !isValidMobileNumber(leadTravellerDetails.mobileNumber)) {
      const message = "Enter a valid lead traveller mobile number.";

      setLeadAuthError(message);
      toast.error("Phone number required", message);
      return;
    }

    setIsRequestingLeadOtp(true);

    try {
      const response = isLeadTravellerLoggedIn && !isLeadTravellerUsingProfileMobile
        ? await requestTravellerProfileMobileChangeOtp(
            leadTravellerAuthMobileNumber
          )
        : await requestTravellerOtp(leadTravellerAuthMobileNumber);

      setVerifiedLeadMobileNumber("");
      setLeadOtp("");
      setLeadOtpTargetMobileNumber(response.data.mobileNumber);
      setLeadRegistrationToken("");
      setHasLeadOtpBeenRequested(true);
      setLeadOtpCooldownSeconds(60);
      setLeadAuthMessage(response.message);
      toast.success("OTP sent", response.message);
    } catch (error) {
      const message = getBookingErrorMessage(error);

      setLeadAuthError(message);
      toast.error("Could not send OTP", message);
    } finally {
      setIsRequestingLeadOtp(false);
    }
  }

  async function handleLeadTravellerVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadAuthError("");
    setLeadAuthMessage("");

    if (leadRegistrationToken) {
      const registrationError = validateLeadTravellerRegistrationDetails();

      if (registrationError) {
        setLeadAuthError(registrationError);
        toast.error("Lead traveller details required", registrationError);
        return;
      }

      setIsVerifyingLeadOtp(true);

      try {
        const profileResponse = await completeTravellerProfile({
          registrationToken: leadRegistrationToken,
          firstName: leadTravellerDetails.firstName,
          lastName: leadTravellerDetails.lastName,
          email: leadTravellerDetails.email.trim().toLowerCase(),
        });

        saveLeadTravellerSession(
          profileResponse.data,
          "Mobile verified",
          profileResponse.message
        );
      } catch (error) {
        const message = getBookingErrorMessage(error);

        setLeadAuthError(message);
        toast.error("Profile could not be completed", message);
      } finally {
        setIsVerifyingLeadOtp(false);
      }

      return;
    }

    if (!/^\d{6}$/.test(leadOtp.trim())) {
      const message = "OTP must be 6 digits.";

      setLeadAuthError(message);
      toast.error("Invalid OTP", message);
      return;
    }

    if (leadOtpTargetMobileNumber !== leadTravellerAuthMobileNumber) {
      const message = "Mobile number changed. Please request a new OTP.";

      setLeadAuthError(message);
      toast.error("Request OTP again", message);
      setLeadOtp("");
      setLeadOtpTargetMobileNumber("");
      setHasLeadOtpBeenRequested(false);
      return;
    }

    setIsVerifyingLeadOtp(true);

    try {
      if (leadRegistrationToken) {
        const registrationError = validateLeadTravellerRegistrationDetails();

        if (registrationError) {
          setLeadAuthError(registrationError);
          toast.error("Lead traveller details required", registrationError);
          return;
        }

        const profileResponse = await completeTravellerProfile({
          registrationToken: leadRegistrationToken,
          firstName: leadTravellerDetails.firstName,
          lastName: leadTravellerDetails.lastName,
          email: leadTravellerDetails.email.trim().toLowerCase(),
        });

        saveLeadTravellerSession(
          profileResponse.data,
          "Mobile verified",
          profileResponse.message
        );
        return;
      }

      if (isLeadTravellerLoggedIn && !isLeadTravellerUsingProfileMobile) {
        const response = await verifyTravellerProfileMobileChangeOtp({
          mobileNumber: leadTravellerAuthMobileNumber,
          otp: leadOtp.trim(),
        });

        saveLeadTravellerSession(
          response.data,
          "Mobile verified",
          response.message
        );
        return;
      }

      const otpResponse = await verifyTravellerOtp({
        mobileNumber: leadTravellerAuthMobileNumber,
        otp: leadOtp.trim(),
      });

      if (otpResponse.data.requiresProfile) {
        const registrationError = validateLeadTravellerRegistrationDetails();

        if (registrationError) {
          setLeadRegistrationToken(otpResponse.data.registrationToken);
          setLeadAuthMessage(
            "Mobile number verified. Complete lead traveller details to continue."
          );
          setLeadAuthError("");
          toast.success(
            "Mobile verified",
            "Complete lead traveller details to continue."
          );
          return;
        }

        const profileResponse = await completeTravellerProfile({
          registrationToken: otpResponse.data.registrationToken,
          firstName: leadTravellerDetails.firstName,
          lastName: leadTravellerDetails.lastName,
          email: leadTravellerDetails.email.trim().toLowerCase(),
        });

        saveLeadTravellerSession(
          profileResponse.data,
          "Mobile verified",
          profileResponse.message
        );
        return;
      }

      saveLeadTravellerSession(
        {
          sessionId: otpResponse.data.sessionId,
          user: otpResponse.data.user,
        },
        "Login successful",
        otpResponse.message
      );
    } catch (error) {
      const message = getBookingErrorMessage(error);

      setLeadAuthError(message);
      toast.error("OTP verification failed", message);
    } finally {
      setIsVerifyingLeadOtp(false);
    }
  }

  if (!selectedDeparture || !isBookingFlowOpen) {
    return (
      <BookingStep step="1" title={selectedDeparture ? "Reserve Your Seat" : "Coming Soon"}>
        <div className="rounded-[8px] border border-primary/15 bg-[#fff8f1] p-4 font-sans">
          <p className="text-[15px] font-medium leading-[1.6] text-secondary/74">
            {selectedDeparture
              ? "Start your booking to select a departure, add traveller details and choose accommodation."
              : "Dates and prices will be announced soon. Enquire with our team for updates."}
          </p>
          <Button
            type="button"
            onClick={onOpenBookingFlow}
            className="mt-4 w-full justify-between gap-4 px-5 font-normal sm:w-auto sm:min-w-[190px]"
          >
            {selectedDeparture ? "Book Now" : "Enquire Now"}
            <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </BookingStep>
    );
  }

  return (
    <div className="space-y-4">
      <BookingErrorSummary />
      <BookingProgress />
      <BookingStep step="0" title="Sign in to book" mobileStage={0}>
        {hasLeadRegistrationOtpVerification ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            {(["firstName", "lastName", "email"] as const).map(field => (
              <label key={field} className="font-sans text-[13px] font-medium">
                {field === "firstName" ? "First name" : field === "lastName" ? "Last name" : "Email address"}
                <input aria-label={field === "firstName" ? "Sign-in first name" : field === "lastName" ? "Sign-in last name" : "Sign-in email"}
                  {...fieldProps("booking-signin-" + field, bookingFieldId("adult-1", field === "firstName" ? "first name" : field === "lastName" ? "last name" : "email"))}
                  required autoComplete={field === "firstName" ? "given-name" : field === "lastName" ? "family-name" : "email"}
                  type={field === "email" ? "email" : "text"} value={leadTravellerDetails[field]}
                  onChange={event => updateLeadTravellerDetail(field, event.target.value)}
                  className="mt-1 h-11 w-full rounded-[6px] border border-border bg-background px-3" />
              </label>
            ))}
          </div>
        ) : null}
        <LeadTravellerVerificationPanel
          canCompleteProfile={areLeadTravellerProfileFieldsReady}
          cooldownSeconds={leadOtpCooldownSeconds}
          errorMessage={leadAuthError}
          hasOtpBeenRequested={hasLeadOtpBeenRequested}
          isCompletingProfile={hasLeadRegistrationOtpVerification}
          isLoggedIn={isLeadTravellerLoggedIn}
          isProfileMobile={isLeadTravellerUsingProfileMobile}
          isRequestingOtp={isRequestingLeadOtp}
          isVerified={hasVerifiedLeadMobileNumber}
          isVerifyingOtp={isVerifyingLeadOtp}
          message={leadAuthMessage}
          mobileNumber={leadTravellerDetails.mobileNumber}
          onMobileNumberChange={(value) =>
            updateLeadTravellerDetail("mobileNumber", value)
          }
          onOtpChange={setLeadOtp}
          onPhoneCountryCodeChange={(value) =>
            updateLeadTravellerDetail("phoneCountryCode", value)
          }
          onRequestOtp={handleLeadTravellerRequestOtp}
          onVerifyOtp={handleLeadTravellerVerifyOtp}
          otp={leadOtp}
          phoneCountryCode={leadTravellerDetails.phoneCountryCode}
          phoneNumber={leadTravellerAuthMobileNumber}
        />
      </BookingStep>

      <BookingStep
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous departure"
              onClick={() => moveDeparture(-1)}
              className="grid size-8 place-items-center rounded-full border border-button-outline bg-background text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next departure"
              onClick={() => moveDeparture(1)}
              className="grid size-8 place-items-center rounded-full border border-button-outline bg-background text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
        mobileStage={1}
        step="1"
        title="Date and Travellers"
      >
        <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
          {departures.map((departure) => {
            const departureId = getDepartureIdentifier(departure);
            const isSelected = departureId === resolvedSelectedDepartureId;
            const fillProgress = getDepartureFillProgress(departure);
            const filledSeats = getDepartureFilledSeats(departure);
            const totalSeats = getDepartureTotalSeats(departure);

            return (
              <button
                key={departureId}
                data-booking-departure
                type="button"
                onClick={() => setSelectedDepartureId(departureId)}
                className={cn(
                  "group/departure relative flex h-full w-full flex-col overflow-hidden rounded-[12px] border-2 bg-[#fffdf9] p-2 text-left font-sans transition-all sm:p-3",
                  isSelected
                    ? "border-[#2faa5d]"
                    : "border-[#f3d5c3]"
                )}
              >
                <span className="grid gap-3">
                  <span className="rounded-[10px] border border-[#f3d5c3] bg-[#fff7f1] px-3 py-3">
                    <strong className="mt-2 block text-[16px] font-bold leading-none text-secondary">
                      {formatDate(departure.departureDate)}
                    </strong>
                  </span>
                </span>

                <span className="mt-4 block border-t border-[#ecd8ca] pt-4">
                  <span className="mb-3 flex items-center justify-between gap-3 text-[14px] font-semibold leading-none text-secondary/68">
                    <span>Seats</span>
                    <span className="font-bold text-brand-text">
                      {filledSeats}/{totalSeats}
                    </span>
                  </span>
                  <span className="block h-3 overflow-hidden rounded-full bg-[#e2e8eb]">
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

        <div className="grid gap-3 sm:grid-cols-3">
          <TravellerCounter
            increaseDisabled={totalTravellers >= Math.min(BOOKING_TRAVELLER_LIMIT, maxTravellers)}
            ageLabel="Above 12 years"
            label="Adult"
            minimum={1}
            value={travellerCounts.adults}
            onDecrease={() => updateTravellerCount("adults", -1)}
            onIncrease={() => updateTravellerCount("adults", 1)}
          />
          <TravellerCounter
            increaseDisabled={totalTravellers >= Math.min(BOOKING_TRAVELLER_LIMIT, maxTravellers)}
            ageLabel="Above 6 to 12 years"
            label="Child"
            value={travellerCounts.children}
            onDecrease={() => updateTravellerCount("children", -1)}
            onIncrease={() => updateTravellerCount("children", 1)}
          />
          <TravellerCounter
            increaseDisabled={totalTravellers >= Math.min(BOOKING_TRAVELLER_LIMIT, maxTravellers)}
            ageLabel="Below 6 years"
            label="Infant"
            value={travellerCounts.infants}
            onDecrease={() => updateTravellerCount("infants", -1)}
            onIncrease={() => updateTravellerCount("infants", 1)}
          />
        </div>

        {totalTravellers >= Math.min(BOOKING_TRAVELLER_LIMIT, maxTravellers) ? (
          <div className="mt-4 rounded-[8px] border border-primary/20 bg-primary/5 p-3 font-sans">
            <p className="text-[14px] font-semibold leading-[1.5] text-secondary">
              {maxTravellers < BOOKING_TRAVELLER_LIMIT
                ? `Only ${maxTravellers} ${maxTravellers === 1 ? "seat is" : "seats are"} available for this departure.`
                : `Maximum ${BOOKING_TRAVELLER_LIMIT} ${travellerCounts.adults === BOOKING_TRAVELLER_LIMIT ? "adults" : "travellers"} per booking.`} For larger groups, enquire.
            </p>
            <Button
              type="button"
              onClick={() => setIsGroupEnquiryOpen(true)}
              className="mt-3 justify-between gap-4 px-5 font-normal"
            >
              Enquire Now
              <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>
        ) : null}

        {travellerDetailTabs.filter(tab => tab.id !== "adult-1" && tab.travellerType !== "adult").map(tab => (
          <label key={tab.id} className="mt-3 block font-sans text-[13px] font-medium text-secondary">
            {tab.label} date of birth (for accurate room pricing)
            <DateOfBirthPicker ariaLabel={tab.label + " pricing date of birth"}
              fieldId={bookingFieldId(tab.id, "pricing date of birth")} required
              value={travellerDetailForms[tab.id]?.dateOfBirth || ""}
              onChange={dateOfBirth => setTravellerDetailForms(current => ({...current, [tab.id]: {...defaultTravellerDetailForm, ...current[tab.id], dateOfBirth}}))} />
          </label>
        ))}
      </BookingStep>
      <BookingStep mobileStage={2} step="2" title="Select Accommodation">
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
        <fieldset {...fieldProps("booking-accommodation")} aria-required="true" tabIndex={-1} className="mt-3 grid gap-3">
          <legend className="sr-only">Choose accommodation</legend>
          {accommodationOptions.map((option) => (
            <AccommodationOptionCard
              key={option.id}
              option={option}
              selected={resolvedSelectedAccommodationOptionId === option.id}
              onSelect={() => setSelectedAccommodationOptionId(option.id)}
            />
          ))}
        </fieldset>
      </BookingStep>
      <BookingStep mobileStage={3} step="3" title="Your Details">

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
            onKeyDown={handleTabKeyDown}
          >
            {travellerDetailTabs.map((travellerTab) => {
              const isSelected = travellerTab.id === activeTravellerDetailTab.id;

              return (
                <button
                  key={travellerTab.id}
                  aria-controls="traveller-details-panel"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className={cn(
                    "h-9 shrink-0 rounded-[6px] px-3 font-sans !text-[14px] font-medium leading-none transition-colors focus:outline-none focus:ring-3 focus:ring-primary/15",
                    isSelected
                      ? "bg-brand-button-dark text-white shadow-[0_5px_12px_rgba(212,114,32,0.18)]"
                      : "text-secondary/68 hover:bg-background hover:text-secondary",
                    !canEditTravellerDetailFields &&
                      "cursor-not-allowed opacity-55 hover:bg-transparent"
                  )}
                  disabled={!canEditTravellerDetailFields}
                  aria-disabled={!canEditTravellerDetailFields}
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
              : "traveller-details-heading"
          }
          className="mt-5"
          id="traveller-details-panel"
          role={travellerDetailTabs.length > 1 ? "tabpanel" : "group"}
          tabIndex={0}
        >
          <h3 id="traveller-details-heading" className="font-sans text-[14px] font-bold text-secondary">
            {activeTravellerDetailTab.heading}
          </h3>
          <p className="mt-1 font-sans text-[14px] font-medium text-secondary/64">
            {activeTravellerDetailTab.description}
          </p>

          {!canEditTravellerDetailFields ? (
            <p id="booking-traveller-lock-hint" role="status" className="mt-3 flex items-start gap-2 rounded-[6px] border border-border bg-muted px-3 py-2 font-sans text-[14px] font-medium text-secondary">
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Traveller details are locked. Verify the lead traveller mobile number to unlock these fields.</span>
            </p>
          ) : null}

          <fieldset
            data-booking-traveller-fields
            disabled={!canEditTravellerDetailFields}
            aria-disabled={!canEditTravellerDetailFields}
            aria-describedby={!canEditTravellerDetailFields ? "booking-traveller-lock-hint" : undefined}
            className={cn(
              "mt-3 space-y-3",
              !canEditTravellerDetailFields && "[&_input]:cursor-not-allowed [&_input]:bg-muted [&_select]:cursor-not-allowed [&_select]:bg-muted [&_textarea]:cursor-not-allowed [&_textarea]:bg-muted [&_button]:cursor-not-allowed [&_button]:bg-muted"
            )}
          >
            <div className="grid gap-3 md:grid-cols-[0.55fr_1.25fr_1.25fr]">
              <select
                aria-label={`${activeTravellerDetailTab.label} title`}
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "title"))}
                required={true}
                autoComplete={`section-${activeTravellerDetailTab.id} honorific-prefix`}
                className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
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
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "first name"))}
                required={true}
                autoComplete={`section-${activeTravellerDetailTab.id} given-name`}
                className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
                value={activeTravellerDetails.firstName}
                onChange={(event) =>
                  updateActiveTravellerDetail("firstName", event.target.value)
                }
                placeholder="First Name *"
                type="text"
              />
              <input
                aria-label={`${activeTravellerDetailTab.label} last name`}
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "last name"))}
                required={true}
                autoComplete={`section-${activeTravellerDetailTab.id} family-name`}
                className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
                value={activeTravellerDetails.lastName}
                onChange={(event) =>
                  updateActiveTravellerDetail("lastName", event.target.value)
                }
                placeholder="Last Name *"
                type="text"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                aria-label={`${activeTravellerDetailTab.label} email`}
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "email"))}
                required={activeTravellerDetailTab.id === "adult-1"}
                autoComplete={`section-${activeTravellerDetailTab.id} email`}
                className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
                value={activeTravellerDetails.email}
                onChange={(event) =>
                  updateActiveTravellerDetail("email", event.target.value)
                }
                placeholder={
                  activeTravellerDetailTab.id === "adult-1" ? "Email *" : "Email"
                }
                type="email"
              />
              <DateOfBirthPicker
                key={`${activeTravellerDetailTab.id}-date-of-birth`}
                ariaLabel={`${activeTravellerDetailTab.label} date of birth`}
                fieldId={bookingFieldId(activeTravellerDetailTab.id, "date of birth")}
                validationId={activeTravellerDetailTab.travellerType !== "adult" ? bookingFieldId(activeTravellerDetailTab.id, "pricing date of birth") : undefined}
                required
                disabled={!canEditTravellerDetailFields}
                value={activeTravellerDetails.dateOfBirth}
                onChange={(nextValue) =>
                  updateActiveTravellerDetail("dateOfBirth", nextValue)
                }
              />
            </div>

            <textarea
              aria-label={`${activeTravellerDetailTab.label} address`}
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "address"))}
                required={true}
                autoComplete={`section-${activeTravellerDetailTab.id} street-address`}
              className="min-h-24 w-full rounded-[6px] border border-border bg-background px-3 py-2.5 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
              value={activeTravellerDetails.address}
              onChange={(event) =>
                updateActiveTravellerDetail("address", event.target.value)
              }
              placeholder="Address *"
              rows={3}
            />

            <div
              className={cn(
                "grid gap-3",
                activeTravellerDetailTab.id === "adult-1"
                  ? "md:grid-cols-3"
                  : "md:grid-cols-[0.9fr_1fr_1.2fr]"
              )}
            >
              {activeTravellerDetailTab.id !== "adult-1" ? (
                <>
                  <select
                    aria-label={`${activeTravellerDetailTab.label} phone country code`}
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "phone country code"))}
                required={true}
                autoComplete={`section-${activeTravellerDetailTab.id} tel-country-code`}
                    className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
                    value={activeTravellerDetails.phoneCountryCode}
                    onChange={(event) =>
                      updateActiveTravellerDetail(
                        "phoneCountryCode",
                        event.target.value
                      )
                    }
                  >
                    <option value="India +91">+91</option>
                  </select>
                  <input
                    aria-label={`${activeTravellerDetailTab.label} mobile number`}
                {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "mobile number"))}
                required={true}
                autoComplete={`section-${activeTravellerDetailTab.id} tel-national`}
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    className="h-11 w-full rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
                    value={activeTravellerDetails.mobileNumber}
                    onChange={(event) =>
                      updateActiveTravellerDetail(
                        "mobileNumber",
                        event.target.value
                      )
                    }
                    placeholder="Mobile Number *"
                    type="tel"
                  />
                </>
              ) : null}
              <div className="flex h-11 items-center gap-4 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary">
                <span className="font-medium">Gender *</span>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "gender"))}
                    required
                    autoComplete={`section-${activeTravellerDetailTab.id} sex`}
                    checked={activeTravellerDetails.gender === "male"}
                    name={`traveller-gender-${activeTravellerDetailTab.id}`}
                    onChange={() => updateActiveTravellerDetail("gender", "male")}
                    type="radio"
                  />
                  Male
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    {...fieldProps(bookingFieldId(activeTravellerDetailTab.id, "gender-female"), bookingFieldId(activeTravellerDetailTab.id, "gender"))}
                    required
                    autoComplete={`section-${activeTravellerDetailTab.id} sex`}
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

          </fieldset>
        </div>

        <fieldset
          data-booking-emergency
          disabled={!canEditTravellerDetailFields}
          aria-disabled={!canEditTravellerDetailFields}
          aria-describedby={!canEditTravellerDetailFields ? "booking-traveller-lock-hint" : undefined}
          className={cn(
            "mt-4 space-y-3 rounded-[8px] border border-border bg-muted/25 p-3",
            !canEditTravellerDetailFields && "[&_input]:cursor-not-allowed [&_input]:bg-muted"
          )}
        >
          <div>
            <h3 className="font-sans text-[14px] font-bold text-secondary">
              Emergency Contact
            </h3>
            <p className="mt-1 font-sans text-[13px] font-medium text-secondary/64">
              Add one emergency contact for the whole booking.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              aria-label="Booking emergency contact name"
              {...fieldProps("booking-emergency-contact-name")}
              required
              autoComplete="section-emergency name"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
              value={leadTravellerDetails.emergencyContactName}
              onChange={(event) =>
                updateLeadTravellerDetail(
                  "emergencyContactName",
                  event.target.value
                )
              }
              placeholder="Emergency Contact Name *"
              type="text"
            />
            <input
              aria-label="Booking emergency contact mobile number"
              {...fieldProps("booking-emergency-contact-mobile")}
              required
              autoComplete="section-emergency tel-national"
              className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed"
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              value={leadTravellerDetails.emergencyContactMobileNumber}
              onChange={(event) =>
                updateLeadTravellerDetail(
                  "emergencyContactMobileNumber",
                  getMobileDigits(event.target.value).slice(0, 10)
                )
              }
              placeholder="Emergency Contact Number *"
              type="tel"
            />
          </div>
          {bookingEmergencyContactWarning ? (
            <p className="flex items-start gap-2 rounded-[6px] border border-destructive/20 bg-destructive/5 px-3 py-2 font-sans text-[13px] font-semibold leading-[1.45] text-destructive">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{bookingEmergencyContactWarning}</span>
            </p>
          ) : null}
        </fieldset>

        {totalTravellers > 1 ? (
          <p data-booking-group-details-note className="mt-4 font-sans text-[14px] font-medium text-secondary/72">
            Complete each traveller&apos;s details before payment.
          </p>
        ) : null}
      </BookingStep>
      <div className="lg:hidden">
        <BookingStep mobileStage={4} step="4" title="Review and Pay">
          <p className="font-sans text-[14px] text-secondary/72">Check your trip, room and total below, then accept the terms to continue to payment.</p>
        </BookingStep>
      </div>


      {isGroupEnquiryOpen ? (
        <EnquiryModal
          bestDeparture={selectedDeparture}
          departures={departures}
          initialTravellerCounts={travellerCounts}
          tourId={tour.tourId}
          tourName={tour.tourName}
          onClose={() => setIsGroupEnquiryOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LeadTravellerVerificationPanel({
  canCompleteProfile,
  cooldownSeconds,
  errorMessage,
  hasOtpBeenRequested,
  isCompletingProfile,
  isLoggedIn,
  isProfileMobile,
  isRequestingOtp,
  isVerified,
  isVerifyingOtp,
  message,
  mobileNumber,
  onMobileNumberChange,
  onOtpChange,
  onPhoneCountryCodeChange,
  onRequestOtp,
  onVerifyOtp,
  otp,
  phoneCountryCode,
  phoneNumber,
}: {
  canCompleteProfile: boolean;
  cooldownSeconds: number;
  errorMessage: string;
  hasOtpBeenRequested: boolean;
  isCompletingProfile: boolean;
  isLoggedIn: boolean;
  isProfileMobile: boolean;
  isRequestingOtp: boolean;
  isVerified: boolean;
  isVerifyingOtp: boolean;
  message: string;
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onPhoneCountryCodeChange: (value: string) => void;
  onRequestOtp: (event: FormEvent<HTMLFormElement>) => void;
  onVerifyOtp: (event: FormEvent<HTMLFormElement>) => void;
  otp: string;
  phoneCountryCode: string;
  phoneNumber: string;
}) {
  const isBusy = isRequestingOtp || isVerifyingOtp;
  const fieldProps = useBookingFieldProps();
  const requestOtpButtonLabel = isVerified
    ? "Verified"
    : isCompletingProfile
      ? "OTP Verified"
      : cooldownSeconds > 0
        ? `Resend OTP in ${cooldownSeconds}s`
        : isRequestingOtp
          ? "Sending OTP..."
          : "Send OTP";

  return (
    <section data-booking-auth {...fieldProps("booking-lead-auth")} tabIndex={-1} className="mt-4 rounded-[8px] border border-primary/20 bg-primary/5 p-3 font-sans">
      <h4 className="text-[14px] font-bold text-secondary">
        Lead Traveller Mobile Verification
      </h4>
      <p className="mt-1 text-[12px] font-medium leading-[1.45] text-secondary/65">
        {isLoggedIn
          ? isProfileMobile
            ? "Verify your login profile mobile number before booking."
            : "This mobile number is different from your login profile. Verify it before booking."
          : "Verify the lead traveller mobile number before booking."}
      </p>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(120px,0.9fr)_minmax(160px,1.1fr)_auto_minmax(120px,0.9fr)_auto]">
        <select
          aria-label="Lead traveller phone country code"
          {...fieldProps(bookingFieldId("adult-1", "phone country code"))}
          required
          autoComplete="section-adult-1 tel-country-code"
          className="h-11 rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
          value={phoneCountryCode}
          onChange={(event) => onPhoneCountryCodeChange(event.target.value)}
        >
          <option value="India +91">+91</option>
        </select>
        <div className="relative">
          <input
            aria-label="Lead traveller mobile number"
            {...fieldProps(bookingFieldId("adult-1", "mobile number"), "booking-lead-auth")}
            required
            autoComplete="section-adult-1 tel-national"
            className={cn(
              "h-11 w-full rounded-[6px] border border-border bg-background px-3 font-sans text-[14px] font-medium text-secondary outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-3 focus:ring-primary/15",
              isVerified && "border-primary/45 pr-10"
            )}
            value={mobileNumber}
            onChange={(event) => onMobileNumberChange(event.target.value)}
            placeholder="Mobile Number *"
            type="tel"
          />
          {isVerified ? (
            <span
              aria-label="Mobile number verified"
              className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-brand-button-dark text-white"
              title="Mobile number verified"
            >
              <Check className="size-3.5" strokeWidth={2.4} />
            </span>
          ) : null}
        </div>
        <form onSubmit={onRequestOtp} className="contents">
          <Button
            data-booking-send-otp
            type="submit"
            disabled={
              isBusy ||
              isVerified ||
              isCompletingProfile ||
              cooldownSeconds > 0 ||
              !phoneNumber
            }
            className="h-11 justify-center px-4 text-[11px] font-normal disabled:pointer-events-none disabled:opacity-55"
          >
            {requestOtpButtonLabel}
          </Button>
        </form>

        {hasOtpBeenRequested && !isCompletingProfile ? (
          <form onSubmit={onVerifyOtp} className="contents">
            <input
              aria-label="Lead traveller OTP"
              {...fieldProps("booking-lead-otp", "booking-lead-auth")}
              required
              autoComplete="one-time-code"
              className="h-11 min-w-0 rounded-[6px] border border-border bg-background px-3 text-[13px] font-semibold tracking-[0.2em] text-secondary outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                onOtpChange(event.target.value.replace(/\D/g, ""))
              }
              placeholder="6-digit OTP (valid 5 minutes)"
              value={otp}
            />
            <Button
              type="submit"
              disabled={isBusy || !otp}
              variant="outline"
              className="h-11 justify-center px-4 text-[13px] font-normal disabled:pointer-events-none disabled:opacity-55"
            >
              {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
            </Button>
          </form>
        ) : null}

        {isCompletingProfile ? (
          <form onSubmit={onVerifyOtp} className="contents">
            <span className="hidden lg:block" aria-hidden="true" />
            <Button
              type="submit"
              disabled={isBusy || !canCompleteProfile}
              variant="outline"
              className="h-11 justify-center px-4 text-[13px] font-normal disabled:pointer-events-none disabled:opacity-55"
            >
              {isVerifyingOtp ? "Saving..." : "Complete Profile"}
            </Button>
          </form>
        ) : null}
      </div>

      {isCompletingProfile ? (
        <p className="mt-2 text-[12px] font-medium text-secondary/65">
          Fill first name, last name and email below to finish verification.
        </p>
      ) : null}

      {message ? (
        <p className="mt-2 text-[12px] font-medium text-brand-text">{message}</p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-2 text-[12px] font-semibold text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function BookingStep({
  actions,
  mobileStage,
  children,
  step,
  title,
}: {
  actions?: ReactNode;
  mobileStage?: BookingStage;
  children: ReactNode;
  step: string;
  title: string;
}) {
  const { stage } = useBookingFlow();
  return (
    <section data-booking-stage={mobileStage} className={cn(mobileStage !== undefined && stage !== mobileStage && "max-lg:hidden", "rounded-[8px] border border-border bg-background p-4 text-[14px]", step === "1" && "max-lg:border-0 max-lg:p-0")}>
      <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-[5px] bg-brand-button-dark font-sans text-[14px] font-bold leading-none text-white", step === "1" && "max-lg:hidden")}>
            {step}
          </span>
          <h2 className="min-w-0 font-heading text-[19px] font-bold leading-tight text-secondary sm:text-[21px]">
            {title}
          </h2>
        </div>
        {actions ? <div className="shrink-0 self-end sm:self-auto">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function getAccommodationBedIcons(roomType: keyof typeof ROOM_TYPES) {
  switch (roomType) {
    case "double":
      return [BedDouble];
    case "triple_double":
      return [BedDouble, BedSingle];
    case "twin":
      return [BedSingle, BedSingle];
    case "triple_twin":
      return [BedSingle, BedSingle, BedSingle];
    case "single":
    default:
      return [BedSingle];
  }
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
  const fieldProps = useBookingFieldProps();
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
        "grid cursor-pointer gap-3 rounded-[8px] border bg-background p-3 font-sans transition-colors hover:bg-muted/40 sm:grid-cols-[22px_minmax(0,1fr)]",
        selected ? "border-primary ring-3 ring-primary/15" : "border-border"
      )}
    >
      <input
        {...fieldProps("booking-accommodation-" + option.id, "booking-accommodation")}
        required
        checked={selected}
        className="mt-1"
        name="tour-accommodation"
        onChange={onSelect}
        type="radio"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <strong className="font-description text-[15px] font-semibold leading-tight text-secondary">
              {option.title}
            </strong>
            <strong className="shrink-0 whitespace-nowrap text-[16px] font-semibold text-secondary">
              {formatCurrency(option.total)}
            </strong>
          </span>
         
        </span>
        <span className="mt-1 block text-[14px] font-medium text-secondary/64">
          {option.description}
        </span>
        {option.rooms.some(room => room.roomType === "twin" || room.roomType === "triple_twin") ? <BookingTermExplanation term="twin-sharing" /> : null}
        <span className="mt-2 flex flex-wrap gap-2">
          {Object.entries(roomCounts).map(([roomType, count]) => (
            <span
              key={roomType}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-white px-2 py-1 text-[14px] font-medium text-secondary/72"
            >
              <span className="inline-flex items-center gap-0.5 text-brand-text">
                {getAccommodationBedIcons(
                  roomType as keyof typeof ROOM_TYPES
                ).map((Icon, index) => (
                  <Icon
                    key={`${roomType}-bed-${index}`}
                    className="size-3.5"
                  />
                ))}
              </span>
              {ROOM_TYPES[roomType as keyof typeof ROOM_TYPES].title}
              {count && count > 1 ? ` x ${count}` : ""}
            </span>
          ))}
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
  paymentFeedback,
  paymentOption,
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
  paymentFeedback: string;
  paymentOption: BookingPaymentOption;
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
  const isFullPayment = paymentOption === "full";

  return (
    <article className="rounded-[8px] border border-border bg-card p-3 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      <h2 className="font-heading text-[17px] font-bold text-secondary">
        Booking Summary
      </h2>
      <div className="mt-3 grid gap-2 rounded-[8px] border border-border bg-muted/35 p-3 font-sans text-[14px] text-secondary">
        <SummaryLine label="Tour" value={tour.tourName} />
        <SummaryLine label="Departure Date" value={departureDate} />
        <SummaryLine label="Travellers" value={travellerSummary} />
        <SummaryLine
          label="Accommodation"
          value={selectedAccommodationOption?.title || "Not selected"}
        />
        <SummaryLine label="Subtotal" value={formatCurrency(subtotal)} />
        <SummaryLine
          label={`GST (${gstPercentage}%)`}
          value={formatCurrency(gstAmount)}
        />
        <SummaryLine
          strong
          label={isAirfareExcluded(tour) ? "Current Total (Excluding Airfare)" : "Total"}
          value={formatCurrency(grandTotal)}
        />
        {!isFullPayment ? (
          <>
            <SummaryLine
              label="Deposit Payable"
              value={formatCurrency(depositAmount)}
            />
            <BookingTermExplanation term="registration-amount" />
            <BookingTermsLink />
            <SummaryLine label="Balance" value={formatCurrency(balanceAmount)} />
          </>
        ) : null}
        {!isFullPayment ? (
          <SummaryLine
            label="Balance Due Date"
            value={formatBalanceDueDate(balanceDueDate)}
          />
        ) : null}
      </div>

      {paymentFeedback ? (
        <div role="status" aria-live="polite" className="mt-3 rounded-[7px] border border-primary/15 bg-muted/45 px-3 py-2 font-sans text-[12px] font-medium leading-[1.45] text-secondary/72">
          <p>{paymentFeedback}</p>
        </div>
      ) : null}
    </article>
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
        "flex items-start justify-between gap-3",
        strong && "text-[14px]"
      )}
    >
      <span className={cn("font-medium", strong && "font-semibold")}>
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 break-words text-right font-medium",
          value.includes("\u20b9") && "shrink-0 whitespace-nowrap",
          strong && "font-semibold"
        )}
      >
        {value}
      </span>
    </span>
  );
}

function TravellerCounter({
  ageLabel,
  label,
  minimum = 0,
  increaseDisabled = false,
  onDecrease,
  onIncrease,
  value,
}: {
  ageLabel: string;
  label: string;
  minimum?: number;
  increaseDisabled?: boolean;
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
          className="grid size-7 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white disabled:pointer-events-none disabled:opacity-45"
        >
          <Minus className="size-3.5" />
        </button>
        <strong className="w-5 text-center font-sans text-[14px] font-medium text-secondary">
          {value}
        </strong>
        <button
          type="button"
          aria-label={`Increase ${label} count`}
          disabled={increaseDisabled}
          onClick={onIncrease}
          className="grid size-7 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white disabled:pointer-events-none disabled:opacity-45"
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
      <h2 className="font-sans text-eyebrow font-medium uppercase tracking-normal text-button-outline">
        {title}
      </h2>
      <span className="mt-2 block h-0.5 w-8 bg-primary" />
    </div>
  );
}

function DailyItinerary({
  days,
  images,
}: {
  days: ItineraryDay[];
  images: string[];
}) {
  const [openDayNumber, setOpenDayNumber] = useState<number | null>(
    days[0]?.dayNumber || null
  );
  const activeDayNumber = days.some((day) => day.dayNumber === openDayNumber)
    ? openDayNumber
    : null;

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {days.map((day) => {
        const isOpen = day.dayNumber === activeDayNumber;
        const contentId = `itinerary-day-${day.dayNumber}`;
        const places = day.placesVisited?.filter(Boolean) || [];
        const dayImage = images[(day.dayNumber - 1) % images.length];
        const walkingDetails = splitWalkingDifficulty(day.walkingDifficulty);
        const toggleDay = () =>
          setOpenDayNumber((current) =>
            current === day.dayNumber ? null : day.dayNumber
          );

        return (
          <article
            key={day.dayNumber}
            className={cn(
              "relative overflow-hidden rounded-[8px] border border-border bg-background",
              isOpen ? "p-4" : "bg-background"
            )}
          >
            {isOpen ? (
              <>
                <div className="mb-4 flex items-center gap-4  font-sans">
                  <span className="shrink-0 text-[14px] font-medium leading-none text-brand-text">
                    Day {day.dayNumber}
                  </span>
                  <span className="h-8 w-px shrink-0 bg-[#ead8c5]" />
                  <h3 className="min-w-0 break-words font-sans text-[18px] font-semibold leading-tight text-secondary sm:text-[18px]">
                    {day.title}
                  </h3>
                  <button
                    type="button"
                    aria-controls={contentId}
                    aria-expanded={isOpen}
                    aria-label={`Collapse day ${day.dayNumber}`}
                    onClick={toggleDay}
                    className="ml-auto grid size-9 shrink-0 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:bg-brand-button-dark hover:text-white"
                  >
                    <Minus className="size-3.5" />
                  </button>
                </div>

                <div
                  id={contentId}
                  className="grid gap-5 font-sans lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.58fr)] lg:items-start lg:gap-8"
                >
                  <div className="min-w-0">
                    <p className="max-w-[620px] font-sans text-[14px] font-medium leading-[1.55] text-secondary/78">
                      {day.summary}
                    </p>

                    {places.length > 0 ? (
                      <div className="mt-8 grid grid-cols-[34px_minmax(0,1fr)] gap-4">
                        <div className="flex flex-col items-center">
                          <DaySightseeingIcon />
                          <span className="mt-2 h-full min-h-12 w-px bg-[#ead8c5]" />
                        </div>
                        <div className="min-w-0">
                        <h4 className="font-sans text-[14px] font-semibold leading-tight text-secondary">
                          Today&apos;s Sightseeing
                        </h4>
                        <ul className="mt-3 grid gap-x-7 gap-y-1.5 font-sans text-[13px] font-medium leading-[1.45] text-secondary/72 sm:grid-cols-2">
                          {places.map((place) => (
                            <li key={place} className="flex gap-3">
                              <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-primary/70" />
                              <span>{place}</span>
                            </li>
                          ))}
                        </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {dayImage ? (
                    <div className="relative">
                      <div className="relative min-h-[200px] overflow-hidden rounded-[8px] bg-border sm:min-h-[230px] lg:min-h-[205px]">
                        <Image
                          src={dayImage}
                          alt={`${day.title} itinerary visual`}
                          fill
                          sizes="(min-width: 1024px) 330px, 100vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_50%,rgba(0,0,0,0.58)_100%)]" />
                       
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 sm:gap-0 lg:grid-cols-3">
                  {day.meals ? (
                    <DayMetaFact
                      iconSrc="/Tour-assets/meal.png"
                      label="Meals"
                      value={day.meals}
                      className="lg:border-r lg:border-border"
                    />
                  ) : null}
                  {walkingDetails.distance ? (
                    <DayMetaFact
                      iconSrc="/Tour-assets/footprint.png"
                      label="Walking Distance"
                      value={walkingDetails.distance}
                      className="lg:border-r lg:border-border"
                    />
                  ) : null}
                  {day.hotels ? (
                    <DayMetaFact
                      iconSrc="/Tour-assets/hotel (1).png"
                      label="Hotel"
                      value={day.hotels}
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <>
              <button
                type="button"
                aria-controls={contentId}
                aria-expanded={isOpen}
                onClick={toggleDay}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-x-3 px-4 py-4 text-left font-sans transition-colors duration-200 hover:bg-muted/35 sm:px-5"
              >
                <span className="font-sans text-[13px] font-bold uppercase text-brand-text">
                  Day {day.dayNumber}
                </span>
                <strong className="min-w-0 whitespace-normal break-words font-sans text-[16px] font-semibold leading-tight text-secondary sm:truncate sm:text-[18px]">
                  {day.title}
                </strong>
                <span className="grid size-10 place-items-center rounded-full border border-[#ead8c5] bg-white text-brand-text">
                  <Plus className="size-3.5" />
                </span>
              </button>
              <div id={contentId} hidden>
                <p>{day.summary}</p>
                <ul>{places.map(place => <li key={place}>{place}</li>)}</ul>
                {day.meals ? <p>Meals: {day.meals}</p> : null}
                {day.hotels ? <p>Hotel: {day.hotels}</p> : null}
                {day.walkingDifficulty ? <p>Walking: {day.walkingDifficulty}</p> : null}
              </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function DaySightseeingIcon() {
  return (
    <span className="grid size-8 shrink-0 place-items-center text-brand-text">
      <Image
        src="/Tour-assets/tour-guide.png"
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        className="tour-icon-primary size-7 object-contain"
      />
    </span>
  );
}

function splitWalkingDifficulty(value?: string) {
  const parts = (value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      distance: parts[0],
      difficulty: parts[parts.length - 1],
    };
  }

  return {
    distance: "",
    difficulty: parts[0] || "",
  };
}

function DayMetaFact({
  className,
  icon: Icon,
  iconSrc,
  label,
  value,
}: {
  className?: string;
  icon?: LucideIcon;
  iconSrc?: string;
  label: string;
  value: string;
}) {
  return (
    <span className={cn("flex items-center gap-3 px-0 font-sans text-secondary sm:px-5 first:sm:pl-0", className)}>
      <span className="grid size-8 shrink-0 place-items-center text-brand-text">
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
            className="tour-icon-primary size-[20px] object-contain"
          />
        ) : Icon ? (
          <Icon className="size-5" strokeWidth={1.8} />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium leading-tight text-brand-text">
          {label}
        </span>
        <span className="mt-1 block text-[13px] font-medium leading-tight text-secondary/82">
          {value}
        </span>
      </span>
    </span>
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
            <Icon className="mt-0.5 size-4 shrink-0 text-brand-text" strokeWidth={2.1} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PriceCard({
  accommodationOptions,
  balanceAmount,
  balanceDueDate,
  bestDeparture,
  canBook,
  departures,
  destinations,
  expert,
  gstAmount,
  gstPercentage,
  itineraryDays,
  paymentOption,
  price,
  selectedAccommodationOption,
  selectedDeparture,
  subtotal,
  tour,
  travellerCounts,
  onEnquireNow,
}: {
  accommodationOptions: AccommodationOption[];
  balanceAmount: number;
  balanceDueDate: Date | null;
  bestDeparture?: PublicTourDeparture;
  canBook: boolean;
  departures: PublicTourDeparture[];
  destinations: PublicDestination[];
  expert: PublicExpert;
  gstAmount: number;
  gstPercentage: number;
  itineraryDays: ItineraryDay[];
  paymentOption: BookingPaymentOption;
  price: number;
  selectedAccommodationOption?: AccommodationOption;
  selectedDeparture?: PublicTourDeparture;
  subtotal: number;
  tour: PublicTour;
  travellerCounts: TravellerCounts;
  onEnquireNow: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-primary/15 bg-card ">
      <div className="border-b border-border bg-[#fff8f1] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 font-sans">
            {price > 0 ? <>
            <strong className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1 text-[27px] font-bold leading-none text-secondary">
              {formatCurrency(price)}
              <span className="pb-0.5 text-[15px] font-semibold leading-none text-secondary/72">
                per person on twin sharing
              </span>
            </strong>
            <TourPriceNote gstPercentage={gstPercentage} airfareExtra={isAirfareExcluded(tour)} />
            <BookingTermExplanation term="twin-sharing" />
            <BookingTermsLink />
            </> : <strong className="mt-1 block text-[27px] font-bold leading-none text-secondary">Coming Soon</strong>}
          </div>

       
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <DownloadItineraryButton
            departures={departures}
            destinations={destinations}
            expert={expert}
            gstPercentage={gstPercentage}
            itineraryDays={itineraryDays}
            tour={tour}
          />
          <button
            type="button"
            onClick={onEnquireNow}
            className="mt-2 inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-button-outline underline-offset-4 transition-colors hover:text-accent hover:underline"
          >
            Enquire Now
          </button>
        </div>
      </div>

      
    </article>
  );
}

function MobileBookingBar({
  onBookNow,
  suspended,
  isBookingFlowOpen,
  bookingStage,
  total,
  onContinue,
  isBusy,
  isAuthenticated,
  price,
  airfareExtra,
}: {
  onBookNow: () => void;
  suspended: boolean;
  isBookingFlowOpen: boolean;
  bookingStage: BookingStage;
  total: number;
  onContinue: () => void;
  isBusy: boolean;
  isAuthenticated: boolean;
  price: number;
  airfareExtra: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [bookingInView, setBookingInView] = useState(false);
  const hidden = suspended || (!isBookingFlowOpen && bookingInView);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setBarHeight(Math.ceil(bar.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = document.getElementById("departure-pricing");
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setBookingInView(entry.isIntersecting), {
      rootMargin: "-64px 0px -" + barHeight + "px 0px", threshold: 0,
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [barHeight]);

  useLayoutEffect(() => {
    // Reserve space after the shared footer, including while a payment overlay is open.
    const body = document.body;
    const previousPadding = body.style.paddingBottom;
    const basePadding = parseFloat(window.getComputedStyle(body).paddingBottom) || 0;
    const reserved = isBookingFlowOpen || !bookingInView ? barHeight : 0;
    body.style.paddingBottom = (basePadding + reserved) + "px";
    return () => { body.style.paddingBottom = previousPadding; };
  }, [barHeight, bookingInView, isBookingFlowOpen]);

  const dockProps = { ref: barRef, "aria-hidden": hidden, inert: hidden, style: { visibility: hidden ? "hidden" as const : "visible" as const } };
  if (isBookingFlowOpen) return (
    <div {...dockProps} data-mobile-booking-bar className="fixed inset-x-0 bottom-0 z-[2147483646] border-t border-border bg-white px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(67,43,27,0.12)] lg:hidden">
      <div className="mx-auto flex max-w-[700px] items-center justify-between gap-3 font-sans">
        <div className="min-w-0">
          <span className="block text-[11px] font-medium text-secondary/65">Selected total, including {GST_PERCENTAGE}% GST</span>
          <strong data-booking-total className="block whitespace-nowrap text-[22px] font-bold leading-tight text-secondary">{total > 0 ? formatCurrency(total) : "Choose your room"}</strong>
          {airfareExtra ? <span className="block text-[11px] text-secondary/65">Airfare extra</span> : null}
        </div>
        <Button type="button" onClick={onContinue} disabled={hidden || isBusy || (bookingStage === 0 && !isAuthenticated)} className="h-11 shrink-0 rounded-full px-5 font-normal">
          {isBusy ? "Please wait..." : bookingStage === 4 ? "Pay Now" : "Continue"}
        </Button>
      </div>
    </div>
  );
  return (
    <div {...dockProps} data-mobile-booking-launcher className="fixed inset-x-0 bottom-0 z-[2147483646] border-t border-border bg-white px-5 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_rgba(67,43,27,0.12)] lg:hidden">
      <div className="mx-auto max-w-[520px] font-sans">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 text-left">
            {price > 0 ? <>
            <strong className="block text-[20px] font-bold leading-none text-secondary">
              {formatCurrency(price)}
            </strong>
           
            <span className="mt-0.5 block text-[12px] font-semibold leading-tight text-secondary/72">
              per person on twin sharing
            </span>
            <TourPriceNote gstPercentage={GST_PERCENTAGE} airfareExtra={airfareExtra} />
            <BookingTermExplanation term="twin-sharing" className="max-w-[250px] text-[11px] leading-snug" />
            </> : <strong className="block text-[20px] font-bold leading-none text-secondary">Coming Soon</strong>}
          </div>
          <Button
            type="button"
            onClick={onBookNow}
            disabled={hidden}
            className="h-11 shrink-0 rounded-full border border-primary bg-primary px-7 text-[15px] font-normal text-white transition-colors hover:bg-white hover:text-button-outline"
          >
            {price > 0 ? "Book Now" : "Enquire Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getTourInclusions(tour: PublicTour) {
  return tour.inclusions.length > 0
    ? tour.inclusions
    : [
        "Expert-led tour guidance",
        "Curated sightseeing and heritage walks",
        "Accommodation on twin sharing basis",
        "Local transfers as mentioned in itinerary",
      ];
}

function getTourExclusions(tour: PublicTour) {
  return tour.exclusions.length > 0
    ? tour.exclusions
    : [
        "Airfare, visa and travel insurance",
        "Personal expenses and optional activities",
        "Meals not mentioned in the itinerary",
        "Tips, porterage and camera charges",
      ];
}

function EnquiryModal({
  bestDeparture,
  departures,
  initialTravellerCounts,
  onClose,
  tourId,
  tourName,
}: {
  bestDeparture?: PublicTourDeparture;
  departures: PublicTourDeparture[];
  initialTravellerCounts?: TravellerCounts;
  onClose: () => void;
  tourId: string;
  tourName: string;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalFocus(dialogRef, true, onClose, 'input[name="name"]');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [guestCounts, setGuestCounts] = useState<TravellerCounts>(() => ({
    adults: initialTravellerCounts?.adults || 1,
    children: initialTravellerCounts?.children || 0,
    infants: initialTravellerCounts?.infants || 0,
  }));
  const travelDates = Array.from(new Set(getBookableDepartures(departures)
    .map(departure => departure.departureDate)
    .filter((date): date is string => Boolean(date && !Number.isNaN(new Date(date).getTime())))
    .map(date => date.slice(0, 10))));
  const preferredTravelDate = bestDeparture?.departureDate?.slice(0, 10) || "";
  const defaultTravelDate = travelDates.includes(preferredTravelDate)
    ? preferredTravelDate : travelDates[0] || "To be announced";

  function updateGuestCount(type: keyof TravellerCounts, change: number) {
    setGuestCounts(current => ({
      ...current,
      [type]: Math.max(type === "adults" ? 1 : 0, current[type] + change),
    }));
  }



  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setIsSubmitting(true);
    setSubmitError("");

    try {
      await createTourEnquiry({
        city: String(formData.get("city") || ""),
        email: String(formData.get("email") || ""),
        guests: formatTravellerSummary(guestCounts),
        message: String(formData.get("message") || ""),
        name: String(formData.get("name") || ""),
        phone: String(formData.get("phone") || ""),
        tourId,
        tourName,
        travelDate: String(formData.get("travelDate") || ""),
      });
      toast.success("Enquiry sent successfully", "Thank you. Our tour team will get back to you shortly.");
      formElement.reset();
      setGuestCounts({ adults: 1, children: 0, infants: 0 });
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send enquiry. Please try again.";
      setSubmitError(message);
      toast.error("Unable to send enquiry", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const modal = (
    <dialog
      ref={dialogRef}
      aria-labelledby="tour-enquiry-title"
      aria-modal="true"
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 text-secondary z-[2147483647] flex items-center justify-center overflow-y-auto bg-secondary/62 px-3 py-3 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Close enquiry form"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[860px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-[10px] border border-primary/20 bg-card "
      >
        <div className="flex items-start justify-between gap-3 border-b border-border bg-[#fff8f1] px-4 py-2">
          <div>
            <h2 id="tour-enquiry-title" className="font-heading text-[24px] font-bold leading-tight text-secondary">
              Enquire Now
            </h2>
            <p className="mt-0.5 font-sans text-[13px] font-bold text-brand-text">
              {tourName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close enquiry form"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-full border border-button-outline bg-white text-button-outline shadow-[0_8px_18px_rgba(67,43,27,0.1)] transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-4 py-3 [&_[data-slot=button]]:text-[13px]">
          <p className="max-w-[780px] font-sans text-[13px] font-medium leading-[1.4] text-secondary/78">
            Do you have any questions before you book? Complete the form below
            and our tour team will get back to you shortly.
          </p>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <EnquiryField label="Your Name *">
              <input required name="name" type="text" placeholder="Your Name" />
            </EnquiryField>
            <EnquiryField label="Email address *">
              <input required name="email" type="email" placeholder="Email address" />
            </EnquiryField>
            <EnquiryField label="Phone Number *">
              <input required name="phone" type="tel" placeholder="Phone Number" />
            </EnquiryField>
            <EnquiryField label="Current City">
              <input name="city" type="text" placeholder="Current City" />
            </EnquiryField>
            <fieldset className="min-w-0 md:col-span-2">
              <legend className="mb-1 font-sans text-[13px] font-bold text-secondary/58">
                Total No. of Guests *
              </legend>
              <div className="grid gap-2 sm:grid-cols-3 [&>div]:gap-2 [&>div]:px-2 [&>div]:py-2 [&>div>span>span]:text-[12px] [&>div>span:last-child]:gap-1 [&_button]:size-6 [&_strong]:w-4 [&_strong]:text-[12px]">
                <TravellerCounter
                  ageLabel="Above 12 years"
                  label="Adult"
                  minimum={1}
                  value={guestCounts.adults}
                  onDecrease={() => updateGuestCount("adults", -1)}
                  onIncrease={() => updateGuestCount("adults", 1)}
                />
                <TravellerCounter
                  ageLabel="Above 6 to 12 years"
                  label="Child"
                  value={guestCounts.children}
                  onDecrease={() => updateGuestCount("children", -1)}
                  onIncrease={() => updateGuestCount("children", 1)}
                />
                <TravellerCounter
                  ageLabel="Below 6 years"
                  label="Infant"
                  value={guestCounts.infants}
                  onDecrease={() => updateGuestCount("infants", -1)}
                  onIncrease={() => updateGuestCount("infants", 1)}
                />
              </div>
            </fieldset>
            <EnquiryField label="Date Of Travel *">
              <select required name="travelDate" defaultValue={defaultTravelDate}>
                {travelDates.length > 0 ? travelDates.map(date => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                )) : <option value="To be announced">Dates to be announced</option>}
              </select>
            </EnquiryField>
            <EnquiryField label="Please write Your Queries. *">
              <textarea
                required
                name="message"
                rows={2}
                placeholder="Tell us what you would like to know."
              />
            </EnquiryField>
          </div>

          {submitError ? (
            <p className="mt-3 rounded-[8px] border border-destructive/20 bg-destructive/5 px-3 py-2 font-sans text-[13px] font-bold text-destructive">
              {submitError}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 h-9 min-w-[160px] justify-between gap-3 px-4 font-normal"
          >
            {isSubmitting ? "Sending..." : "Send Enquiry"}
            <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </form>
    </dialog>
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
      <span className="mb-1 block text-[13px] font-bold text-secondary/58">
        {label}
      </span>
      <span className="block [&>input]:h-8 [&>input]:w-full [&>input]:rounded-[8px] [&>input]:border [&>input]:border-border [&>input]:bg-background [&>input]:px-3 [&>input]:text-[13px] [&>input]:font-semibold [&>input]:text-secondary [&>input]:outline-none [&>input]:transition-colors [&>input]:placeholder:text-secondary/38 focus-within:[&>input]:border-primary focus-within:[&>input]:ring-3 focus-within:[&>input]:ring-primary/15 [&>select]:h-8 [&>select]:w-full [&>select]:rounded-[8px] [&>select]:border [&>select]:border-border [&>select]:bg-background [&>select]:px-3 [&>select]:text-[13px] [&>select]:font-semibold [&>select]:text-secondary [&>select]:outline-none [&>select]:transition-colors focus-within:[&>select]:border-primary focus-within:[&>select]:ring-3 focus-within:[&>select]:ring-primary/15 [&>textarea]:w-full [&>textarea]:rounded-[8px] [&>textarea]:border [&>textarea]:border-border [&>textarea]:bg-background [&>textarea]:px-3 [&>textarea]:py-2 [&>textarea]:resize-none [&>textarea]:text-[13px] [&>textarea]:font-semibold [&>textarea]:text-secondary [&>textarea]:outline-none [&>textarea]:transition-colors [&>textarea]:placeholder:text-secondary/38 focus-within:[&>textarea]:border-primary focus-within:[&>textarea]:ring-3 focus-within:[&>textarea]:ring-primary/15">
        {children}
      </span>
    </label>
  );
}

function TourHighlightCard({
  action,
  departure,
  departures,
  expert,
  tour,
}: {
  action?: ReactNode;
  departure?: PublicTourDeparture;
  departures: PublicTourDeparture[];
  expert: PublicExpert;
  tour: PublicTour;
}) {
  const seatsAvailable = departure ? getDepartureSeatsLeft(departure) : 0;
  const seatsLabel = departure
    ? seatsAvailable > 0
      ? `${seatsAvailable} ${seatsAvailable === 1 ? "Seat" : "Seats"}`
      : "Sold Out"
    : "Seats on Request";
  const seenDepartureDates = new Set<string>();
  const bookableDepartures = getBookableDepartures(departures);
  const orderedDepartures = departure
    ? [departure, ...bookableDepartures.filter((item) => getDepartureIdentifier(item) !== getDepartureIdentifier(departure))]
    : bookableDepartures;
  const departureDates = orderedDepartures.filter((item) => {
    const date = formatDate(item.departureDate);
    if (date === "Coming Soon" || seenDepartureDates.has(date)) return false;
    seenDepartureDates.add(date);
    return true;
  });

  return (
    <article className="@container rounded-[12px] border border-border bg-card p-3 shadow-[0_10px_24px_rgba(67,43,27,0.06)]">
      <h2 className="flex items-center gap-3 font-heading text-[23px] font-bold text-secondary @min-[600px]:text-[34px]">
        <Landmark className="size-6 shrink-0 text-brand-text @min-[600px]:size-8" strokeWidth={1.8} />
        Tour Highlight
      </h2>

      <div className="mt-1.5 divide-y divide-border/65 font-sans">
        <SidebarSummaryItem
          icon={Clock3}
          label="Duration"
          value={getDurationLabel(tour)}
        />
        <SidebarSummaryItem
          icon={CalendarDays}
          label="Departure Dates"
          value={
            departureDates.length > 0 ? (
              <div className="space-y-2">
                <TourDepartureDateCard departure={departureDates[0]} />
                {departureDates.length > 1 ? (
                  <details className="group/dates">
                    <summary className="inline-flex max-w-full cursor-pointer list-none items-center gap-2 rounded-full border border-border/60 bg-secondary/[0.03] px-3 py-1.5 text-[11px] font-medium [&::-webkit-details-marker]:hidden @min-[600px]:gap-3 @min-[600px]:px-4 @min-[600px]:text-[14px]">
                      <CalendarDays className="size-3.5 shrink-0 @min-[600px]:size-4" strokeWidth={1.8} />
                       All Departures
                      <ChevronDown className="size-4 shrink-0 transition-transform group-open/dates:rotate-180" />
                    </summary>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 @min-[440px]:grid-cols-2 @min-[600px]:grid-cols-3">
                      {departureDates.slice(1).map((item) => (
                        <TourDepartureDateCard key={item.id} departure={item} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : "Coming Soon"
          }
        />
        <SidebarSummaryItem
          icon={BarChart3}
          label="Tour Difficulty Level"
          value={getDifficultyLabel(tour)}
        />
        <SidebarSummaryItem
          icon={UserRound}
          label="Tour Expert"
          value={expert.fullName}
        />
        <SidebarSummaryItem icon={Users} label="No of Seats" value={seatsLabel} />
      </div>
      {action ? (
        <div className="mt-3 border-t border-border pt-3">{action}</div>
      ) : null}
    </article>
  );
}

function TourDepartureDateCard({ departure }: { departure: PublicTourDeparture }) {
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-primary/10 bg-[#fff8f1] px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="whitespace-nowrap text-[12px] font-semibold leading-snug @min-[600px]:text-[15px]">
          {formatDate(departure.departureDate)}
        </div>
        <div className="mt-0.5 text-[12px] font-medium text-secondary/58 @min-[600px]:text-[14px]">
          {new Date(departure.departureDate!).toLocaleDateString("en-GB", { weekday: "short" })}
        </div>
      </div>
    </div>
  );
}

function SidebarSummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] items-start gap-2 py-2.5 @min-[600px]:grid-cols-[minmax(0,1fr)_minmax(0,2.3fr)] @min-[600px]:gap-4 @min-[600px]:py-3">
      <span className="flex min-w-0 items-start gap-2 @min-[600px]:gap-5">
        <Icon className="size-5 shrink-0 text-brand-text @min-[600px]:size-7" strokeWidth={1.8} />
        <span className="min-w-0 text-[13px] font-medium leading-snug text-secondary/58 @min-[600px]:text-[19px]">
          {label}
        </span>
      </span>
      <div className="min-w-0 border-l border-border/65 pl-3 text-[14px] font-semibold leading-snug break-words text-secondary @min-[600px]:pl-5 @min-[600px]:text-[20px]">
        {value}
      </div>
    </div>
  );
}

function BookingTermsCard({
  accepted,
  canBook,
  onAcceptedChange,
}: {
  accepted: boolean;
  canBook: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}) {
  const fieldProps = useBookingFieldProps();
  return (
    <article className="rounded-[8px] border border-border bg-card p-3 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      <h2 className="font-heading text-[17px] font-bold text-secondary">
        Terms & Conditions
      </h2>
      <label
        className={cn(
          "mt-3 flex items-start gap-2 font-sans text-[14px] font-medium leading-[1.45]",
          canBook ? "text-secondary" : "text-secondary/58"
        )}
      >
        <input
          data-booking-terms
          {...fieldProps("booking-terms")}
          required
          checked={accepted}
          className="mt-0.5 size-4 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!canBook}
          onChange={(event) => onAcceptedChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          I have read and agreed to the Ancient Trail&apos;s{" "}
          <Link prefetch={false}
            href="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-text transition-colors hover:text-accent"
          >
            Terms & Conditions.
          </Link>
        </span>
      </label>
      {!canBook ? (
        <p className="mt-2 font-sans text-[12px] font-medium leading-[1.4] text-red-600">
          Complete the booking details to accept terms and continue payment.
        </p>
      ) : null}
    </article>
  );
}

function SidebarTourActions({
  bookingReminder,
  hasBookableDeparture,
  onIncomplete,
  showAirfareNotice,
  canPay,
  checkoutStatus,
  isBookingFlowOpen,
  onBook,
  onBookNow,
  hasOfflineRequest,
}: {
  bookingReminder: string;
  hasBookableDeparture: boolean;
  onIncomplete: () => void;
  showAirfareNotice: boolean;
  canPay: boolean;
  checkoutStatus: CheckoutStatus;
  isBookingFlowOpen: boolean;
  onBook: () => void;
  onBookNow: () => void;
  hasOfflineRequest: boolean;
}) {
  const toast = useToast();
  const buttonClassName =
    "w-full justify-center gap-2 px-3 text-center font-normal focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20";
  const isBusy = checkoutStatus !== "idle" || hasOfflineRequest;

  function handlePrimaryClick() {
    if (isBusy) return;
    if (!hasBookableDeparture || !isBookingFlowOpen) {
      onBookNow();
      return;
    }

    if (!canPay) {
      toast.warning("Complete your booking", bookingReminder);
      onIncomplete();
      return;
    }

    onBook();
  }

  return (
    <article className="rounded-[8px] border border-border bg-card p-3 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      {showAirfareNotice ? (
        <div className="mb-3 rounded-[6px] border border-blue-200 bg-blue-50 px-3 py-2.5 font-sans">
          <p className="flex items-center gap-2 text-[12px] font-bold leading-[1.4] text-secondary">
            <Info aria-hidden="true" className="size-3.5 shrink-0 text-blue-600" />
            Air-Flight Charges (Additional)
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-[1.5] text-secondary/70">
            Air-Flight Charges: To Be Added in the booking summary, invoice, booking voucher, and confirmation email.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2">
        <Button
          type="button"
          onClick={handlePrimaryClick}
          disabled={isBookingFlowOpen && isBusy}
          className={buttonClassName}
        >
          <span className="inline-flex items-center gap-2">
            {isBookingFlowOpen ? (
              <CreditCard className="size-4" />
            ) : null}
            {!hasBookableDeparture ? "Enquire Now" : isBookingFlowOpen ? "Pay Now" : "Book Now"}
          </span>
        </Button>
      </div>
    </article>
  );
}

function PaymentChoiceModal({
  advanceAmount,
  balanceAmount,
  fullAmount,
  isBusy,
  onClose,
  onPayAdvance,
  onPayFull,
  onPayBankTransfer,
  onPayOffline,
}: {
  advanceAmount: number;
  balanceAmount: number;
  fullAmount: number;
  isBusy: boolean;
  onClose: () => void;
  onPayAdvance: () => void;
  onPayFull: () => void;
  onPayBankTransfer?: (option: "advance" | "full") => void;
  onPayOffline: () => void;
}) {
  const [step, setStep] = useState<"method" | "online" | "bank" | "offline">("method");

  const offlineConfirmedRef = useRef(false);
  const [offlineConfirmed, setOfflineConfirmed] = useState(false);
  const confirmationBusy = isBusy || offlineConfirmed;

  function confirmOfflinePayment() {
    if (isBusy || offlineConfirmedRef.current) return;
    offlineConfirmedRef.current = true;
    setOfflineConfirmed(true);
    onPayOffline();
  }

  return (
    <div
      aria-modal="true"
      aria-labelledby="payment-choice-title"
      className="fixed inset-0 z-[2147483647] grid place-items-center bg-secondary/45 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
    >
      <div data-lenis-prevent className="max-h-[calc(100dvh-3rem)] w-full max-w-[520px] overflow-y-auto rounded-[10px] border border-primary/20 bg-card shadow-[0_24px_80px_rgba(35,24,16,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-[#fff8f1] px-5 py-4">
          <div>
            <h2 id="payment-choice-title" className="font-heading text-[24px] font-bold leading-tight text-secondary">
              {step === "method" ? "Choose Payment Method" : step === "offline" ? "Confirm Offline Payment" : step === "online" ? "Online Payment" : "Bank Transfer"}
            </h2>
            <p className="mt-1 font-sans text-[13px] font-medium leading-[1.45] text-secondary/68">
              {step === "method" ? "Select how you want to pay for this booking." : step === "offline" ? "Review your request before submitting." : "Choose full payment or advance payment."}
            </p>
            <BookingTermsLink />
          </div>
          <button
            type="button"
            aria-label="Close payment options"
            onClick={onClose}
            disabled={isBusy}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-button-outline bg-white text-button-outline transition-colors hover:border-button-outline hover:bg-brand-button-dark hover:text-white"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        {step === "method" ? (
          <div className="grid gap-3 p-5">
            <Button type="button" disabled={isBusy} onClick={() => setStep("online")} className="h-auto min-h-12 justify-start whitespace-normal rounded-[8px] px-4 py-3 text-left font-medium">
              Online Payment {"\u2014"} UPI / Card / Netbanking
            </Button>
            <Button type="button" disabled={isBusy || !onPayBankTransfer} onClick={() => setStep("bank")} variant="outline" className="h-auto min-h-12 justify-start whitespace-normal rounded-[8px] px-4 py-3 text-left font-medium">
              Bank Transfer {"\u2014"} NEFT / RTGS / IMPS
            </Button>
            <Button type="button" disabled={isBusy} onClick={() => setStep("offline")} variant="outline" className="h-auto min-h-12 justify-start whitespace-normal rounded-[8px] px-4 py-3 text-left font-medium">
              Offline Payment {"\u2014"} Cash / Cheque
            </Button>
            <BookingTermExplanation term="offline" />
          </div>
        ) : step === "offline" ? (
          <div className="space-y-4 p-5 font-sans">
            <p className="text-[16px] font-semibold leading-relaxed text-secondary">Reserve without paying online? Our team will contact you.</p>
            <p className="text-[13px] leading-relaxed text-secondary/68">No online payment will be taken. Your booking is confirmed only after our team verifies payment and availability.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={confirmationBusy} onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={confirmationBusy} onClick={confirmOfflinePayment}>
                {confirmationBusy ? "Submitting..." : "Confirm Offline Request"}
              </Button>
            </div>
          </div>
        ) : (
        <div className="p-5">
          <button type="button" disabled={isBusy} onClick={() => setStep("method")} className="mb-4 font-sans text-[13px] font-semibold text-button-outline hover:underline disabled:opacity-60">
            Back to payment methods
          </button>
          {step === "bank" ? (
            <p className="mb-4 font-sans text-[13px] leading-relaxed text-secondary/68">
              Generate bank details for this booking. Seats are confirmed only after verified payment and availability checks.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => step === "bank" ? onPayBankTransfer?.("full") : onPayFull()}
            className="group/payment relative rounded-[8px] border-2 border-button-outline bg-white p-4 text-left text-button-outline shadow-[0_0_0_3px_rgba(47,170,93,0.14)] transition-colors hover:bg-[#f8fff9] disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-[#2faa5d] text-white shadow-[0_6px_14px_rgba(47,170,93,0.28)]">
              <Check className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className="font-sans text-[13px] font-semibold uppercase leading-none text-brand-text">
              Pay Full
            </span>
            <strong className="mt-3 block font-sans text-[25px] leading-none">
              {formatCurrency(fullAmount)}
            </strong>
            <span className="mt-3 block font-sans text-[12px] font-medium leading-[1.45] text-secondary/68">
              Complete the total payment now.
            </span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => step === "bank" ? onPayBankTransfer?.("advance") : onPayAdvance()}
            className="group/payment rounded-[8px] border border-button-outline bg-white p-4 text-left text-button-outline transition-colors hover:border-button-outline hover:bg-white hover:shadow-[0_0_0_3px_rgba(212,114,32,0.12)] disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="font-sans text-[13px] font-semibold uppercase leading-none text-brand-text">
              Pay Advance
            </span>
            <strong className="mt-3 block font-sans text-[25px] leading-none">
              {formatCurrency(advanceAmount)}
            </strong>
            <span className="mt-3 block font-sans text-[12px] font-medium leading-[1.45] text-secondary/68">
              <BookingTermExplanation term="advance" className="mt-0" />
              <span className="mt-1 block">Remaining balance: {formatCurrency(balanceAmount)}.</span>
            </span>
          </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function HelpCard({ contact }: { contact: SiteContactSettings }) {
  const callDisplay = getContactCallDisplay(contact);
  const emailAddress = getContactEmailDisplay(contact);

  return (
    <article className="flex items-center gap-3 rounded-[8px] border border-border bg-card p-4 shadow-[0_10px_24px_rgba(67,43,27,0.05)]">
      <div className="min-w-0 font-sans text-secondary">
        <h2 className="font-heading text-[18px] font-bold">Need Help?</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1 break-words text-[14px] font-semibold">
          <PhoneCall className="size-3.5 text-brand-text" />
          Call Us : {callDisplay || defaultSiteContactSettings.primaryCalling}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 break-words text-[14px] font-semibold">
          <Mail className="size-3.5 text-brand-text" />
          Mail Us : {emailAddress}
        </p>
      </div>
    </article>
  );
}

function getYoutubeEmbedUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    const url = new URL(trimmedValue);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname.startsWith("/embed/")) {
        return trimmedValue;
      }

      const videoId = url.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      if (url.pathname.startsWith("/shorts/")) {
        const shortsId = url.pathname.split("/").filter(Boolean)[1];
        return shortsId ? `https://www.youtube.com/embed/${shortsId}` : "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

function ExpertPanel({
  expert,
  tour,
}: {
  expert: PublicExpert;
  tour: PublicTour;
}) {
  const embedUrl = getYoutubeEmbedUrl(tour.video);

  if (!embedUrl) {
    return (
      <div className="rounded-[8px] border border-dashed border-border bg-muted/35 p-4 font-sans text-[14px] font-medium text-secondary/62">
        Tour expert video will appear here once a YouTube link is added for{" "}
        {expert.fullName}.
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-[8px] bg-secondary">
      <iframe
        src={embedUrl}
        title={`${tour.tourName} tour expert video`}
        className="h-full w-full pointer-events-none sm:pointer-events-auto"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
