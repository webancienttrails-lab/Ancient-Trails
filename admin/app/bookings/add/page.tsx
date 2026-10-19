"use client";

import { openAdminRazorpayCheckout } from "@/lib/razorpay-checkout";
import { createAdminBankTransfer } from "@/lib/bank-transfer";
import { formatBookingPaymentMethod, requestAdminLeadOtp, verifyAdminLeadOtp } from "@/lib/bookings";
import { BookingBankTransferHistory } from "@/components/booking-bank-transfer-history";
import { AirfareDisclosure } from "@/components/airfare-disclosure";
import { isAirfareExcluded } from "@/lib/airfare";
import type { FormEvent, ReactNode } from "react";
import { Suspense } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  ExternalLink,
  Eye,
  IndianRupee,
  LinkIcon,
  Mail,
  Pencil,
  RefreshCw,
  Save,
  Send,
  XCircle,
  Upload,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useToast } from "@/components/ui/toast";

import {
  cancelAdminBookingPaymentLink,
  createAdminBooking,
  createAdminBookingPaymentLink,
  getBookingKycDocumentUrl,
  listAdminBookingAccommodationOptions,
  listAdminBookingPaymentLinks,
  listAdminBookings,
  refreshAdminBookingPaymentLinkStatus,
  resendAdminBookingPaymentLinkWhatsapp,
  sendAdminBookingFinalPaymentWhatsapp,
  updateAdminBooking,
  uploadAdminBookingKycDocument,
  type AdminBooking,
  type BookingAccommodationOption,
  type BookingAccommodationDetails,
  type BookingGuestDetails,
  type BookingKycDocument,
  type BookingPayload,
  type BookingPaymentLinkPurpose,
  type BookingPaymentLinkRequest,
  type BookingPaymentMethod,
  type BookingPaymentOption,
} from "@/lib/bookings";

import {
  listAdminTourDepartures,
  listAdminTours,
  type AdminTourDeparture,
  type AdminTour,
} from "@/lib/tours";

import { cn } from "@/lib/utils";

/* =========================================================
   TYPES
========================================================= */

type BookingPageMode =
  | "add"
  | "view"
  | "edit"
  | "invalid";

type BookingFormGuestDetails = Omit<
  BookingGuestDetails,
  "dateOfBirth"
> & {
  dateOfBirth: string;
};

type BookingFormChildDetails = {
  age: string;
};

type BookingFormAccommodationDetails = {
  [Key in keyof BookingAccommodationDetails]: string;
};

type BookingFormState = Omit<
  BookingPayload,
  | "totalGuest"
  | "adultCount"
  | "childCount"
  | "childDetails"
  | "guestDetails"
  | "accommodationDetails"
  | "paymentOption"
  | "paymentMethod"
  | "amountPaid"
  | "airFlightCharges"
> & {
  departureId: string;
  selectedAccommodationOptionId: string;
  paymentOption: BookingPaymentOption;
  paymentMethod: BookingPaymentMethod;
  amountPaid: string;
  airFlightCharges: string;
  totalGuest: string;
  adultCount: string;
  childCount: string;

  childDetails: BookingFormChildDetails[];

  guestDetails: BookingFormGuestDetails[];

  accommodationDetails: BookingFormAccommodationDetails;
};

type PaymentLinkFormState = {
  amount: string;
  description: string;
  purpose: BookingPaymentLinkPurpose;
};

/* =========================================================
   OPTIONS
========================================================= */

const titleOptions = [
  "Mr",
  "Mrs",
  "Ms",
  "Dr",
  "Prof",
];

const genderOptions = [
  "Male",
  "Female",
  "Other",
];

const countryCodeOptions = [
  "+91",
  "+1",
  "+44",
  "+61",
  "+971",
  "+65",
  "+94",
  "+977",
  "+880",
];

const paymentMethodOptions: Array<{
  label: string;
  value: BookingPaymentMethod;
}> = [
  { label: "Cash", value: "cash" },
  { label: "Cheque", value: "cheque" },
  { label: "NEFT", value: "neft" },
  { label: "IMPS", value: "imps" },
  { label: "RTGS", value: "rtgs" },
  { label: "Bank Transfer (NEFT / IMPS / RTGS)", value: "bank_transfer" },
  { label: "Online (UPI / Netbanking / Card)", value: "razorpay" },
  { label: "UPI", value: "upi" },
  { label: "Netbanking", value: "netbanking" },
  { label: "Card", value: "card" },
  { label: "Wallet", value: "wallet" },
  { label: "EMI", value: "emi" },
];

const paymentLinkPurposeOptions: Array<{
  description: string;
  label: string;
  value: BookingPaymentLinkPurpose;
}> = [
  {
    description: "Collect the full remaining balance.",
    label: "Final Payment",
    value: "final",
  },
  {
    description: "Add a new payable charge to this booking.",
    label: "Additional Charges",
    value: "additional",
  },
  {
    description: "Collect part of the current outstanding balance.",
    label: "Partial Payment",
    value: "partial",
  },
  {
    description: "Collect a labelled custom payment.",
    label: "Custom Payment",
    value: "custom",
  },
];

type KycDocumentType = BookingKycDocument["documentType"];

type BookingKycTraveller = {
  firstName?: string;
  id: string;
  kycDocuments?: BookingKycDocument[];
  lastName?: string;
  title?: string;
  type: "adult" | "child";
};

type BookingPaymentHistoryItem = {
  amount: number;
  currency: string;
  description: string;
  id: string;
  method: string;
  paidAt: string | null | undefined;
  reference: string;
  title: string;
};

const domesticKycDocumentOptions: Array<{
  label: string;
  value: KycDocumentType;
}> = [
  { label: "Aadhaar Card", value: "aadhaar_card" },
  { label: "Driving License", value: "driving_license" },
  { label: "Voter ID", value: "voter_id" },
];

const internationalKycDocumentOptions: Array<{
  label: string;
  value: KycDocumentType;
}> = [
  { label: "Passport", value: "passport" },
  { label: "PAN Card", value: "pan_card" },
];

/* =========================================================
   EMPTY FORM
========================================================= */

function createEmptyGuestDetails(): BookingFormGuestDetails {
  return {
    title: "Mr",
    firstName: "",
    lastName: "",
    countryCode: "+91",
    mobileNumber: "",
    email: "",
    dateOfBirth: "",
    gender: "Male",
    address: "",
  };
}

function createEmptyChildDetails(): BookingFormChildDetails {
  return {
    age: "",
  };
}

function createEmptyBookingForm(
  tourId = ""
): BookingFormState {
  return {
    tourId,
    departureId: "",
    selectedAccommodationOptionId: "",
    paymentOption: "advance",
    paymentMethod: "cash",
    amountPaid: "",
    airFlightCharges: "",

    totalGuest: "1",
    adultCount: "1",
    childCount: "0",

    childDetails: [],

    guestDetails: [
      createEmptyGuestDetails(),
    ],

    accommodationDetails: {
      singleOccupancyOneRoom: "0",
      singleOccupancyTwoRooms: "0",
      doubleOccupancy: "0",
      twinOccupancy: "0",
      tripleOccupancy: "0",
    },
  };
}

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function getGuestName(guest?: {
  firstName?: string;
  lastName?: string;
  title?: string;
}): string {
  return [
    guest?.title,
    guest?.firstName,
    guest?.lastName,
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function getBookingKycTravellers(booking: AdminBooking): BookingKycTraveller[] {
  return booking.travellers && booking.travellers.length > 0
    ? booking.travellers.map((traveller) => ({
        firstName: traveller.firstName,
        id: traveller.id,
        kycDocuments: traveller.kycDocuments || [],
        lastName: traveller.lastName,
        title: traveller.title,
        type: traveller.type,
      }))
    : booking.guestDetails.map((guest, index) => ({
        firstName: guest.firstName,
        id: `guest-${index + 1}`,
        kycDocuments: [],
        lastName: guest.lastName,
        title: guest.title,
        type:
          index < booking.adultCount
            ? ("adult" as const)
            : ("child" as const),
      }));
}

function isInternationalBooking(booking: AdminBooking) {
  return booking.guestDetails[0]?.countryCode !== "+91";
}

function toWholeNumber(
  value: string
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(parsed)
  );
}

function toDateInputValue(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateToInputValue(
  date: Date
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(
  value: string
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date;
}

function formatDatePickerValue(
  value: string
): string {
  const date =
    parseDateInputValue(value);

  if (!date) {
    return "dd-mm-yyyy";
  }

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  return `${day}-${month}-${date.getFullYear()}`;
}

function resizeGuestDetails(
  guests: BookingFormGuestDetails[],
  count: number
): BookingFormGuestDetails[] {
  return Array.from(
    { length: count },
    (_, index) => ({
      ...(
        guests[index] ||
        createEmptyGuestDetails()
      ),
    })
  );
}

function resizeChildDetails(
  children: BookingFormChildDetails[],
  count: number
): BookingFormChildDetails[] {
  return Array.from(
    { length: count },
    (_, index) => ({
      ...(
        children[index] ||
        createEmptyChildDetails()
      ),
    })
  );
}

/* =========================================================
   BOOKING -> FORM
========================================================= */

function bookingGuestToForm(
  guest?: BookingGuestDetails
): BookingFormGuestDetails {
  if (!guest) {
    return createEmptyGuestDetails();
  }

  return {
    title: guest.title,
    firstName: guest.firstName,
    lastName: guest.lastName,

    countryCode:
      guest.countryCode,

    mobileNumber:
      guest.mobileNumber,

    email: guest.email,

    dateOfBirth:
      toDateInputValue(
        guest.dateOfBirth
      ),

    gender: guest.gender,
    address: guest.address,
  };
}

function bookingToForm(
  booking: AdminBooking
): BookingFormState {
  return {
    paymentMode: booking.paymentMode,
    tourId: booking.tourId,
    departureId: booking.departureId || "",
    selectedAccommodationOptionId:
      booking.selectedAccommodationOptionId || "",
    paymentOption: booking.paymentOption || "advance",
    paymentMethod:
      (booking.paymentMethod as BookingPaymentMethod) || (booking.paymentMode === "bank_transfer" ? "bank_transfer" : booking.paymentProvider === "razorpay" || booking.paymentMode === "online" ? "razorpay" : ""),
    amountPaid:
      booking.amountPaid && booking.amountPaid > 0
        ? String(Math.round(booking.amountPaid))
        : "",
    airFlightCharges:
      booking.airFlightCharges && booking.airFlightCharges > 0
        ? String(Math.round(booking.airFlightCharges))
        : "",

    totalGuest: String(
      booking.totalGuest
    ),

    adultCount: String(
      booking.adultCount
    ),

    childCount: String(
      booking.childCount
    ),

    childDetails:
      resizeChildDetails(
        booking.childDetails.map(
          (child) => ({
            age: String(child.age),
          })
        ),
        booking.childCount
      ),

    guestDetails:
      resizeGuestDetails(
        booking.guestDetails.map(
          bookingGuestToForm
        ),
        booking.totalGuest
      ),

    accommodationDetails: {
      singleOccupancyOneRoom:
        String(
          booking
            .accommodationDetails
            .singleOccupancyOneRoom
        ),

      singleOccupancyTwoRooms:
        String(
          booking
            .accommodationDetails
            .singleOccupancyTwoRooms
        ),

      doubleOccupancy:
        String(
          booking
            .accommodationDetails
            .doubleOccupancy
        ),

      twinOccupancy:
        String(
          booking
            .accommodationDetails
            .twinOccupancy
        ),

      tripleOccupancy:
        String(
          booking
            .accommodationDetails
            .tripleOccupancy
        ),
    },
  };
}

/* =========================================================
   FORM -> PAYLOAD
========================================================= */

function createBookingPayload(
  form: BookingFormState
): BookingPayload {
  const adultCount =
    toWholeNumber(
      form.adultCount
    );

  const childCount =
    toWholeNumber(
      form.childCount
    );

  const totalGuest =
    adultCount + childCount;

  return {
    tourId:
      form.tourId.trim(),
    departureId:
      form.departureId.trim() ||
      undefined,
    selectedAccommodationOptionId:
      form.selectedAccommodationOptionId.trim() ||
      undefined,
    paymentOption:
      form.paymentOption,
    paymentMethod:
      form.paymentMethod || undefined,
    paymentMode: form.paymentMode || (form.paymentMethod === "bank_transfer" ? "bank_transfer" : form.paymentMethod === "razorpay" ? "online" : "offline"),
    amountPaid: !form.paymentMode && ["bank_transfer", "razorpay"].includes(form.paymentMethod) ? 0 : toWholeNumber(form.amountPaid),
    airFlightCharges:
      toWholeNumber(
        form.airFlightCharges
      ),

    totalGuest,
    adultCount,
    childCount,

    childDetails:
      Array.from(
        {
          length:
            childCount,
        },
        (_, index) => ({
          age: toWholeNumber(
            form.childDetails[
              index
            ]?.age || "0"
          ),
        })
      ),

    guestDetails:
      Array.from(
        {
          length:
            totalGuest,
        },
        (_, index) => {
          const guest =
            form.guestDetails[
              index
            ] ||
            createEmptyGuestDetails();

          return {
            title:
              guest.title.trim(),

            firstName:
              guest.firstName.trim(),

            lastName:
              guest.lastName.trim(),

            countryCode:
              guest.countryCode.trim(),

            mobileNumber:
              guest.mobileNumber.trim(),

            email:
              guest.email.trim(),

            dateOfBirth:
              guest.dateOfBirth,

            gender:
              guest.gender.trim(),

            address:
              guest.address.trim(),
          };
        }
      ),

    travellers:
      Array.from(
        {
          length:
            totalGuest,
        },
        (_, index) => {
          const guest =
            form.guestDetails[
              index
            ] ||
            createEmptyGuestDetails();
          const isChild =
            index >= adultCount;
          const childIndex =
            index - adultCount;

          return {
            id: isChild
              ? `child-${
                  childIndex + 1
                }`
              : `adult-${
                  index + 1
                }`,
            type: isChild
              ? "child"
              : "adult",
            title:
              guest.title.trim(),
            firstName:
              guest.firstName.trim(),
            lastName:
              guest.lastName.trim(),
            countryCode:
              guest.countryCode.trim(),
            mobileNumber:
              guest.mobileNumber.trim(),
            email:
              guest.email.trim(),
            dateOfBirth:
              guest.dateOfBirth,
            gender:
              guest.gender.trim(),
            address:
              guest.address.trim(),
            ageOnDeparture: isChild
              ? toWholeNumber(
                  form.childDetails[
                    childIndex
                  ]?.age || "0"
                )
              : undefined,
          };
        }
      ),

    accommodationDetails: {
      singleOccupancyOneRoom:
        toWholeNumber(
          form
            .accommodationDetails
            .singleOccupancyOneRoom
        ),

      singleOccupancyTwoRooms:
        toWholeNumber(
          form
            .accommodationDetails
            .singleOccupancyTwoRooms
        ),

      doubleOccupancy:
        toWholeNumber(
          form
            .accommodationDetails
            .doubleOccupancy
        ),

      twinOccupancy:
        toWholeNumber(
          form
            .accommodationDetails
            .twinOccupancy
        ),

      tripleOccupancy:
        toWholeNumber(
          form
            .accommodationDetails
            .tripleOccupancy
        ),
    },
    gstPercentage: 5,
  };
}

/* =========================================================
   ROUTE DETECTION
========================================================= */

function getRouteDetails(
  slug: string[],
  queryMode: string | null,
  queryBookingId: string | null
): {
  mode: BookingPageMode;
  bookingId: string | null;
} {
  if (
    queryMode === "view" &&
    queryBookingId
  ) {
    return {
      mode: "view",
      bookingId: queryBookingId,
    };
  }

  if (
    queryMode === "edit" &&
    queryBookingId
  ) {
    return {
      mode: "edit",
      bookingId: queryBookingId,
    };
  }

  if (
    slug.length === 1 &&
    slug[0] === "view" &&
    queryBookingId
  ) {
    return {
      mode: "view",
      bookingId: queryBookingId,
    };
  }

  if (
    slug.length === 1 &&
    slug[0] === "edit-booking" &&
    queryBookingId
  ) {
    return {
      mode: "edit",
      bookingId: queryBookingId,
    };
  }

  /*
    /bookings/add
  */
  if (
    slug.length === 1 &&
    slug[0] === "add"
  ) {
    return {
      mode: "add",
      bookingId: null,
    };
  }

  /*
    /bookings/:id
  */
  if (
    slug.length === 1 &&
    slug[0] !== "add"
  ) {
    return {
      mode: "view",
      bookingId: slug[0],
    };
  }

  /*
    /bookings/:id/edit
  */
  if (
    slug.length === 2 &&
    slug[1] === "edit"
  ) {
    return {
      mode: "edit",
      bookingId: slug[0],
    };
  }

  /*
    /bookings/edit/:id
  */
  if (
    slug.length === 2 &&
    slug[0] === "edit"
  ) {
    return {
      mode: "edit",
      bookingId: slug[1],
    };
  }

  return {
    mode: "invalid",
    bookingId: null,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function BookingInnerPage() {
  return (
    <Suspense fallback={null}>
      <BookingInnerPageContent />
    </Suspense>
  );
}

function formatCurrency(
  value: number | null | undefined,
  currency = "INR"
): string {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(
    Math.max(
      0,
      Math.round(
        Number(value) || 0
      )
    )
  );
}

function formatDateTime(
  value: string | null | undefined
): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPaymentLinkStatusClassName(
  status: BookingPaymentLinkRequest["status"]
) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "sent" || status === "created") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getWhatsappStatusClassName(
  status: BookingPaymentLinkRequest["whatsappStatus"]
) {
  if (status === "sent") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getBookingDueAmount(booking: AdminBooking): number {
  if (Number.isFinite(booking.balanceAmount)) {
    return Math.max(0, Math.round(Number(booking.balanceAmount)));
  }

  const totalAmount = Math.max(0, Math.round(Number(booking.grandTotal) || 0));
  const paidAmount = Math.max(0, Math.round(Number(booking.amountPaid) || 0));

  return Math.max(0, totalAmount - paidAmount);
}

function getBookingPaymentMethodLabel(booking: AdminBooking): string {
  return formatBookingPaymentMethod(booking);
}

function getPaymentHistoryItems(
  booking: AdminBooking,
  paymentLinkRequests: BookingPaymentLinkRequest[]
): BookingPaymentHistoryItem[] {
  const currency = booking.paymentCurrency || "INR";
  const paidLinkRequests = paymentLinkRequests.filter(
    (paymentLinkRequest) => paymentLinkRequest.status === "paid"
  );
  const paidLinkTotal = paidLinkRequests.reduce(
    (total, paymentLinkRequest) =>
      total + Math.max(0, Math.round(paymentLinkRequest.amountRupees || 0)),
    0
  );
  const bookingPaidAmount = Math.max(0, Math.round(Number(booking.amountPaid) || 0));
  const initialPaidAmount = Math.max(0, bookingPaidAmount - paidLinkTotal);
  const items: BookingPaymentHistoryItem[] = [];

  if (initialPaidAmount > 0) {
    items.push({
      amount: initialPaidAmount,
      currency,
      description:
        booking.paymentOption === "advance"
          ? "Advance booking payment"
          : "Booking payment",
      id: "booking-payment",
      method: getBookingPaymentMethodLabel(booking),
      paidAt: booking.paymentCapturedAt || booking.updatedAt || booking.createdAt,
      reference:
        booking.paymentId ||
        booking.paymentOrderId ||
        "Payment reference saved",
      title:
        booking.paymentOption === "advance"
          ? "Advance Payment"
          : "Booking Payment",
    });
  }

  paidLinkRequests.forEach((paymentLinkRequest) => {
    items.push({
      amount: paymentLinkRequest.amountRupees,
      currency: paymentLinkRequest.currency || currency,
      description: paymentLinkRequest.description || paymentLinkRequest.purposeLabel,
      id: paymentLinkRequest.id,
      method: "Razorpay payment link",
      paidAt: paymentLinkRequest.paidAt || paymentLinkRequest.updatedAt,
      reference:
        paymentLinkRequest.razorpayPaymentId ||
        paymentLinkRequest.razorpayPaymentLinkId,
      title: paymentLinkRequest.purposeLabel,
    });
  });

  return items.sort((left, right) => {
    const leftTime = left.paidAt ? new Date(left.paidAt).getTime() : 0;
    const rightTime = right.paidAt ? new Date(right.paidAt).getTime() : 0;

    return rightTime - leftTime;
  });
}

function canUseFinalPaymentLink(booking: AdminBooking | null): booking is AdminBooking {
  if (!booking) {
    return false;
  }

  return Boolean(
    booking.paymentOption === "full" &&
      booking.paymentStatus === "paid" &&
      (booking.airFlightCharges || 0) > 0 &&
      getBookingDueAmount(booking) > 0 &&
      booking.finalPaymentUrl
  );
}

function getPaymentOptionAmount(
  option: BookingAccommodationOption | null,
  paymentOption: BookingPaymentOption,
  airFlightCharges = 0
): string {
  if (!option) {
    return "";
  }

  const amount =
    paymentOption === "full"
      ? option.grandTotal + airFlightCharges
      : option.depositAmount ||
        option.grandTotal;

  return amount > 0
    ? String(Math.round(amount))
    : "";
}

function AdminKycDocumentsSection({
  booking,
  isUploading,
  onBookingChange,
  onUploadStart,
  onUploadEnd,
}: {
  booking: AdminBooking;
  isUploading: boolean;
  onBookingChange: (booking: AdminBooking) => void;
  onUploadEnd: () => void;
  onUploadStart: () => void;
}) {
  const [selectedTypes, setSelectedTypes] = useState<Record<string, KycDocumentType>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const travellers = getBookingKycTravellers(booking);
  const documentOptions = isInternationalBooking(booking)
    ? internationalKycDocumentOptions
    : domesticKycDocumentOptions;

  async function handleUpload(travellerId: string) {
    const fileInput = fileInputs.current[travellerId];
    const file = fileInput?.files?.[0];

    if (!file) {
      return;
    }

    onUploadStart();

    try {
      const response = await uploadAdminBookingKycDocument({
        bookingId: booking.id,
        documentType:
          selectedTypes[travellerId] ||
          documentOptions[0]?.value ||
          "aadhaar_card",
        file,
        travellerId,
      });

      onBookingChange(response.data.booking);
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      onUploadEnd();
    }
  }

  return (
    <>
      <FormSectionTitle>
        KYC Documents
      </FormSectionTitle>

      <div className="grid gap-4 sm:col-span-2">
        <p className="text-xs font-medium leading-relaxed text-foreground/55">
          Upload identity documents for each traveller in this booking.
        </p>

        {travellers.map((traveller, index) => {
          const documents = traveller.kycDocuments || [];
          const travellerName =
            getGuestName(traveller) || `Traveller ${index + 1}`;

          return (
            <div
              key={traveller.id || index}
              className="grid gap-3 rounded-sm border border-border bg-muted/10 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {travellerName}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-foreground/50">
                    {traveller.type === "child" ? "Child traveller" : "Adult traveller"}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-primary/20 bg-white px-2.5 py-1 text-[10px] font-bold text-primary">
                  {documents.length} uploaded
                </span>
              </div>

              <div className="grid gap-2">
                {documents.length > 0 ? (
                  documents.map((document) => (
                    <a
                      key={document.id}
                      href={getBookingKycDocumentUrl(document.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center justify-between gap-3 rounded-sm border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <span className="truncate">
                        {document.documentLabel}
                        <span className="font-medium text-foreground/45">
                          {" "}
                          - {document.uploadedBy}
                        </span>
                      </span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  ))
                ) : (
                  <p className="rounded-sm border border-dashed border-border bg-white px-3 py-2 text-xs font-semibold text-foreground/50">
                    No KYC document uploaded yet.
                  </p>
                )}
              </div>

              <div
                className="grid gap-2 lg:grid-cols-[180px_minmax(0,1fr)_auto]"
              >
                <select
                  value={selectedTypes[traveller.id] || documentOptions[0]?.value}
                  onChange={(event) =>
                    setSelectedTypes((current) => ({
                      ...current,
                      [traveller.id]: event.target.value as KycDocumentType,
                    }))
                  }
                  className="h-10 rounded-sm border border-border bg-white px-3 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
                >
                  {documentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  name="kycFile"
                  ref={(element) => {
                    fileInputs.current[traveller.id] = element;
                  }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="h-10 rounded-sm border border-border bg-white px-3 py-2 text-xs font-semibold file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1 file:text-[10px] file:font-bold file:text-white"
                />
                <Button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleUpload(traveller.id)}
                  className="h-10 rounded-sm px-4 text-xs font-bold"
                >
                  <Upload className="size-4" />
                  {isUploading ? "Uploading" : "Upload"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AccommodationOptionCard({
  onSelect,
  option,
  readOnly,
  selected,
}: {
  onSelect: () => void;
  option: BookingAccommodationOption;
  readOnly: boolean;
  selected: boolean;
}) {
  return (
    <label
      className={cn(
        "grid cursor-pointer gap-3 rounded-sm border bg-background p-3 transition-colors sm:grid-cols-[22px_minmax(0,1fr)]",
        readOnly && "cursor-default",
        selected
          ? "border-primary ring-3 ring-primary/15"
          : "border-border hover:bg-muted/40"
      )}
    >
      <input
        checked={selected}
        className="mt-1"
        disabled={readOnly}
        name="booking-accommodation"
        onChange={onSelect}
        type="radio"
      />

      <span className="min-w-0">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm font-semibold text-foreground">
            {option.title}
          </strong>
          <strong className="text-sm font-semibold text-foreground">
            {formatCurrency(option.total)}
          </strong>
        </span>

        <span className="mt-1 block text-xs font-medium text-foreground/60">
          {option.description}
        </span>

        <span className="mt-2 flex flex-wrap gap-2">
          {option.rooms.map((room) => (
            <span
              key={room.id}
              className="inline-flex items-center rounded-sm border border-border bg-white px-2 py-1 text-xs font-medium text-foreground/70"
            >
              {room.title}: {room.bedSummary}
            </span>
          ))}
        </span>
      </span>
    </label>
  );
}

function AccommodationPriceBreakdown({
  airfareIncludedInTotal = false,
  airFlightCharges,
  option,
  paymentOption,
}: {
  airFlightCharges: number;
  airfareIncludedInTotal?: boolean;
  option: BookingAccommodationOption;
  paymentOption: BookingPaymentOption;
}) {
  const isFullPayment = paymentOption === "full";
  const finalTotal = option.grandTotal + (airfareIncludedInTotal ? 0 : airFlightCharges);
  const finalBalance = option.balanceAmount + (airfareIncludedInTotal ? 0 : airFlightCharges);

  return (
    <div className="grid gap-2 rounded-sm border border-border bg-muted/35 px-4 py-3 text-xs text-foreground/70 sm:col-span-2">
      <div className="flex items-center justify-between gap-4">
        <span>Accommodation cost</span>
        <span className="font-semibold text-foreground">
          {formatCurrency(option.total)}
        </span>
      </div>

      {option.rooms.flatMap((room) =>
        room.allocations.map((allocation, index) => (
          <div
            className="flex items-center justify-between gap-4 pl-3 text-foreground/55"
            key={`${room.id}-${allocation.label}-${index}`}
          >
            <span>
              {room.title}: {allocation.label}
            </span>
            <span>{formatCurrency(allocation.price)}</span>
          </div>
        ))
      )}

      <div className="flex items-center justify-between gap-4">
        <span>
          GST ({option.gstPercentage}%)
        </span>
        <span>{formatCurrency(option.gstAmount)}</span>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-2 font-bold text-foreground">
        <span>Package total</span>
        <span>{formatCurrency(option.grandTotal)}</span>
      </div>

      {airFlightCharges > 0 ? (
        <div className="flex items-center justify-between gap-4 text-foreground/65">
          <span>{airfareIncludedInTotal ? "Air-flight charges (included in total)" : "Air-flight charges"}</span>
          <span>{formatCurrency(airFlightCharges)}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 font-bold text-foreground">
        <span>Grand total</span>
        <span>{formatCurrency(finalTotal)}</span>
      </div>

      {!isFullPayment ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <span>Advance payable</span>
            <span>{formatCurrency(option.depositAmount)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Balance</span>
            <span>{formatCurrency(finalBalance)}</span>
          </div>
          {option.balanceDueDate ? (
            <div className="flex items-center justify-between gap-4">
              <span>Balance due date</span>
              <span>{formatDatePickerValue(toDateInputValue(option.balanceDueDate))}</span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function createAccommodationDetailsFromOption(
  option: BookingAccommodationOption
): BookingFormAccommodationDetails {
  const singleRooms =
    option.rooms.filter(
      (room) => room.roomType === "single"
    ).length;

  return {
    singleOccupancyOneRoom:
      singleRooms === 1 ? "1" : "0",
    singleOccupancyTwoRooms:
      singleRooms > 1
        ? String(singleRooms)
        : "0",
    doubleOccupancy: String(
      option.rooms.filter(
        (room) =>
          room.roomType === "double"
      ).length
    ),
    twinOccupancy: String(
      option.rooms.filter(
        (room) =>
          room.roomType === "twin"
      ).length
    ),
    tripleOccupancy: String(
      option.rooms.filter(
        (room) =>
          room.roomType.startsWith(
            "triple"
          )
      ).length
    ),
  };
}

function BookingInnerPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const slug = useMemo(() => {
    const bookingsIndex =
      pathname
        .split("/")
        .filter(Boolean)
        .findIndex(
          (segment) =>
            segment === "bookings"
        );

    if (bookingsIndex < 0) {
      return [];
    }

    return pathname
      .split("/")
      .filter(Boolean)
      .slice(bookingsIndex + 1);
  }, [pathname]);

  const {
    mode,
    bookingId,
  } = useMemo(
    () =>
      getRouteDetails(
        slug,
        searchParams.get("mode"),
        searchParams.get("bookingId")
      ),
    [searchParams, slug]
  );

  const [
    bookingForm,
    setBookingForm,
  ] = useState<BookingFormState>(
    createEmptyBookingForm()
  );

  const [checkoutPaymentOption, setCheckoutPaymentOption] = useState<BookingPaymentOption | null>(null);
  const bookingFormRef = useRef<HTMLFormElement>(null);
  const paymentInProgress = useRef(false);
  const savedPaymentBooking = useRef<AdminBooking | null>(null);

  const [leadOtp, setLeadOtp] = useState("");
  const [leadOtpSentTo, setLeadOtpSentTo] = useState("");
  const [leadVerification, setLeadVerification] = useState<{ phone: string; token: string } | null>(null);
  const [leadOtpBusy, setLeadOtpBusy] = useState(false);
  const [leadOtpResendAt, setLeadOtpResendAt] = useState(0);
  const leadPhone = (bookingForm.guestDetails[0]?.countryCode || "") + ":" + (bookingForm.guestDetails[0]?.mobileNumber || "");
  const currentLeadPhone = useRef(leadPhone);
  useEffect(() => { currentLeadPhone.current = leadPhone; }, [leadPhone]);
  const leadVerified = leadVerification?.phone === leadPhone;
  const newExternalPayment = mode === "add" && ["bank_transfer", "razorpay"].includes(bookingForm.paymentMethod);

  async function sendLeadOtp() {
    const guest = bookingForm.guestDetails[0];
    if (!guest?.mobileNumber || leadOtpBusy) return;
    if (Date.now() < leadOtpResendAt) { toast.error("Please wait", "Wait 60 seconds before requesting another OTP."); return; }
    const phone = leadPhone;
    setLeadOtpBusy(true);
    try {
      await requestAdminLeadOtp({ countryCode: guest.countryCode, mobileNumber: guest.mobileNumber });
      if (currentLeadPhone.current !== phone) return;
      setLeadOtpSentTo(phone); setLeadOtp(""); setLeadVerification(null); setLeadOtpResendAt(Date.now() + 60000);
      toast.success("OTP sent", "Ask the lead traveller for the OTP sent to their mobile.");
    } catch (error) { toast.error("Could not send OTP", getErrorMessage(error)); }
    finally { setLeadOtpBusy(false); }
  }
  async function verifyLeadOtp() {
    const guest = bookingForm.guestDetails[0];
    if (!guest || leadOtpSentTo !== leadPhone || leadOtpBusy) return;
    const phone = leadPhone;
    setLeadOtpBusy(true);
    try {
      const response = await verifyAdminLeadOtp({ countryCode: guest.countryCode, mobileNumber: guest.mobileNumber, otp: leadOtp });
      if (currentLeadPhone.current !== phone) return;
      setLeadVerification({ phone, token: response.data.verificationToken });
      const traveller = response.data.traveller;
      if (traveller) setBookingForm(form => ({ ...form, guestDetails: form.guestDetails.map((item, index) => index ? item : {
        ...item, firstName: traveller.firstName || item.firstName, lastName: traveller.lastName || item.lastName,
        email: traveller.email || item.email, gender: traveller.gender || item.gender,
        dateOfBirth: traveller.dateOfBirth ? toDateInputValue(traveller.dateOfBirth) : item.dateOfBirth,
      }) }));
      toast.success("Mobile verified", traveller ? "Existing traveller details filled in." : "Enter the new traveller's details to continue.");
    } catch (error) { toast.error("OTP verification failed", getErrorMessage(error)); }
    finally { setLeadOtpBusy(false); }
  }

  const [
    tours,
    setTours,
  ] =
    useState<AdminTour[]>([]);

  const [
    departures,
    setDepartures,
  ] =
    useState<AdminTourDeparture[]>([]);

  const [
    selectedBooking,
    setSelectedBooking,
  ] =
    useState<AdminBooking | null>(null);

  const providerPayment = Boolean(selectedBooking?.paymentProvider === "razorpay" || selectedBooking?.paymentMode === "bank_transfer" || selectedBooking?.hasBankTransfer || selectedBooking?.paymentMethod === "razorpay");

  const [
    accommodationOptions,
    setAccommodationOptions,
  ] =
    useState<BookingAccommodationOption[]>([]);

  const [
    accommodationError,
    setAccommodationError,
  ] =
    useState("");

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    isKycUploading,
    setIsKycUploading,
  ] =
    useState(false);

  const [
    isSendingFinalPaymentLink,
    setIsSendingFinalPaymentLink,
  ] =
    useState(false);

  const [
    paymentLinkRequests,
    setPaymentLinkRequests,
  ] =
    useState<BookingPaymentLinkRequest[]>([]);

  const [
    paymentLinkForm,
    setPaymentLinkForm,
  ] =
    useState<PaymentLinkFormState>({
      amount: "",
      description: "",
      purpose: "final",
    });

  const [
    isSendingPaymentLink,
    setIsSendingPaymentLink,
  ] =
    useState(false);

  const [
    paymentLinkActionId,
    setPaymentLinkActionId,
  ] =
    useState("");

  const [
    loadError,
    setLoadError,
  ] =
    useState("");

  const isReadOnly =
    mode === "view";

  const selectedTour = useMemo(
    () =>
      tours.find(
        (tour) =>
          tour.tourId ===
          bookingForm.tourId
      ) || null,
    [bookingForm.tourId, tours]
  );

  const availableDepartures = useMemo(
    () =>
      departures.filter(
        (departure) =>
          departure.tourId ===
          bookingForm.tourId
      ),
    [bookingForm.tourId, departures]
  );

  const selectedDeparture = useMemo(
    () =>
      departures.find(
        (departure) =>
          departure.departureId ===
          bookingForm.departureId
      ) || null,
    [bookingForm.departureId, departures]
  );

  const selectedAccommodationOption = useMemo(
    () =>
      accommodationOptions.find(
        (option) =>
          option.id ===
          bookingForm.selectedAccommodationOptionId
      ) || null,
    [
      accommodationOptions,
      bookingForm.selectedAccommodationOptionId,
    ]
  );

  const airFlightCharges = toWholeNumber(
    bookingForm.airFlightCharges
  );

  const finalPaymentBooking =
    canUseFinalPaymentLink(selectedBooking)
      ? selectedBooking
      : null;

  const outstandingAmount =
    selectedBooking
      ? getBookingDueAmount(selectedBooking)
      : 0;

  const paymentHistoryItems = useMemo(
    () =>
      selectedBooking
        ? getPaymentHistoryItems(
            selectedBooking,
            paymentLinkRequests
          )
        : [],
    [paymentLinkRequests, selectedBooking]
  );

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setLoadError("");

      try {
        if (
          mode === "invalid"
        ) {
          setLoadError(
            "Invalid booking page."
          );

          return;
        }

        /*
          ADD
        */
        if (
          mode === "add"
        ) {
          const [
            toursResponse,
            departuresResponse,
          ] =
            await Promise.all([
              listAdminTours(),
              listAdminTourDepartures(),
            ]);

          if (!isMounted) {
            return;
          }

          const loadedTours =
            toursResponse.data.tours;

          setTours(
            loadedTours
          );

          setDepartures(
            departuresResponse.data.departures
          );

          setSelectedBooking(null);
          setPaymentLinkRequests([]);

          setBookingForm(
            createEmptyBookingForm(
              loadedTours[0]
                ?.tourId || ""
            )
          );

          return;
        }

        /*
          VIEW / EDIT
        */

        const [
          bookingsResponse,
          toursResponse,
          departuresResponse,
        ] =
          await Promise.all([
            listAdminBookings(),
            listAdminTours(),
            listAdminTourDepartures(),
          ]);

        if (!isMounted) {
          return;
        }

        const loadedTours =
          toursResponse.data.tours;

        setTours(
          loadedTours
        );

        setDepartures(
          departuresResponse.data.departures
        );

        const booking =
          bookingsResponse.data.bookings.find(
            (item) =>
              item.id ===
              bookingId
          );

        if (!booking) {
          setLoadError(
            "Booking not found."
          );

          return;
        }

        setBookingForm(
          bookingToForm(
            booking
          )
        );

        setSelectedBooking(
          booking
        );

        if (mode === "view") {
          const paymentLinksResponse =
            await listAdminBookingPaymentLinks(
              booking.id
            );

          if (!isMounted) {
            return;
          }

          setPaymentLinkRequests(
            paymentLinksResponse.data.paymentLinkRequests
          );
          setSelectedBooking(
            paymentLinksResponse.data.booking
          );
        } else {
          setPaymentLinkRequests([]);
        }
      } catch (error) {
        const message =
          getErrorMessage(
            error
          );

        setLoadError(
          message
        );

        toast.error(
          "Unable to load booking",
          message
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [
    bookingId,
    mode,
    toast,
  ]);

  useEffect(() => {
    if (paymentLinkForm.purpose !== "final") {
      return;
    }

    setPaymentLinkForm((currentForm) => ({
      ...currentForm,
      amount:
        outstandingAmount > 0
          ? String(outstandingAmount)
          : "",
    }));
  }, [outstandingAmount, paymentLinkForm.purpose]);

  useEffect(() => {
    let isMounted = true;

    async function loadAccommodationOptions() {
      const adultCount =
        toWholeNumber(
          bookingForm.adultCount
        );
      const childCount =
        toWholeNumber(
          bookingForm.childCount
        );

      if (
        !bookingForm.departureId ||
        adultCount < 1
      ) {
        setAccommodationOptions([]);
        setAccommodationError("");
        return;
      }

      try {
        setAccommodationError("");

        const response =
          await listAdminBookingAccommodationOptions(
            {
              departureId:
                bookingForm.departureId,
              adultCount,
              childDetails: Array.from(
                { length: childCount },
                (_, index) => ({
                  age: toWholeNumber(
                    bookingForm.childDetails[
                      index
                    ]?.age || "0"
                  ),
                })
              ),
              gstPercentage: 5,
            }
          );

        if (!isMounted) {
          return;
        }

        const options =
          response.data.options;

        setAccommodationOptions(
          options
        );

        if (
          options.length > 0 &&
          !options.some(
            (option) =>
              option.id ===
              bookingForm.selectedAccommodationOptionId
          )
        ) {
          setBookingForm(
            (currentForm) => {
              if (
                currentForm.departureId !==
                bookingForm.departureId
              ) {
                return currentForm;
              }

              const option =
                options[0];

              return {
                ...currentForm,
                selectedAccommodationOptionId:
                  option.id,
                accommodationDetails:
                  createAccommodationDetailsFromOption(
                    option
                  ),
                amountPaid:
                  getPaymentOptionAmount(
                    option,
                    currentForm.paymentOption,
                    (selectedBooking?.airfareIncludedInTotal ? 0 : toWholeNumber(currentForm.airFlightCharges))
                  ),
              };
            }
          );
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAccommodationOptions([]);
        setAccommodationError(
          getErrorMessage(error)
        );
      }
    }

    loadAccommodationOptions();

    return () => {
      isMounted = false;
    };
  }, [
    bookingForm.adultCount,
    bookingForm.childCount,
    bookingForm.childDetails,
    bookingForm.departureId,
    bookingForm.selectedAccommodationOptionId,
  ]);

  /* =======================================================
     FORM UPDATES
  ======================================================= */

  function updateBookingForm<
    K extends keyof BookingFormState,
  >(
    field: K,
    value: BookingFormState[K]
  ) {
    setBookingForm(
      (currentForm) => {
        const nextForm = {
          ...currentForm,
          [field]: value,
        };

        if (field === "tourId") {
          nextForm.departureId = "";
          nextForm.selectedAccommodationOptionId = "";
          nextForm.amountPaid = "";
        }

        if (field === "departureId") {
          nextForm.selectedAccommodationOptionId = "";
          nextForm.amountPaid = "";
        }

        if (
          field ===
            "adultCount" ||
          field ===
            "childCount"
        ) {
          const adultCount =
            toWholeNumber(
              String(
                nextForm.adultCount
              )
            );

          const childCount =
            toWholeNumber(
              String(
                nextForm.childCount
              )
            );

          const totalGuest =
            adultCount +
            childCount;

          nextForm.totalGuest =
            String(
              totalGuest
            );

          nextForm.guestDetails =
            resizeGuestDetails(
              currentForm.guestDetails,
              totalGuest
            );

          nextForm.childDetails =
            resizeChildDetails(
              currentForm.childDetails,
              childCount
            );

          nextForm.selectedAccommodationOptionId = "";
          nextForm.amountPaid = "";
        }

        return nextForm;
      }
    );
  }

  function updateGuestDetails<
    K extends keyof BookingFormGuestDetails,
  >(
    indexToUpdate: number,
    field: K,
    value: BookingFormGuestDetails[K]
  ) {
    if (indexToUpdate === 0 && (field === "countryCode" || field === "mobileNumber")) {
      setLeadVerification(null); setLeadOtpSentTo(""); setLeadOtp("");
    }
    setBookingForm(
      (currentForm) => ({
        ...currentForm,

        guestDetails:
          currentForm.guestDetails.map(
            (
              guest,
              index
            ) =>
              index ===
              indexToUpdate
                ? {
                    ...guest,
                    [field]:
                      value,
                  }
                : guest
          ),
      })
    );
  }

  function updateChildDetails(
    indexToUpdate: number,
    value: string
  ) {
    setBookingForm(
      (currentForm) => ({
        ...currentForm,

        childDetails:
          currentForm.childDetails.map(
            (
              child,
              index
            ) =>
              index ===
              indexToUpdate
                ? {
                    ...child,
                    age: value,
                  }
                : child
          ),
      })
    );
  }

  function updateAccommodationDetails<
    K extends keyof BookingFormAccommodationDetails,
  >(
    field: K,
    value: BookingFormAccommodationDetails[K]
  ) {
    setBookingForm(
      (currentForm) => ({
        ...currentForm,

        accommodationDetails:
          {
            ...currentForm.accommodationDetails,

            [field]:
              value,
          },
      })
    );
  }

  function selectAccommodationOption(
    option: BookingAccommodationOption
  ) {
    setBookingForm(
      (currentForm) => ({
        ...currentForm,
        selectedAccommodationOptionId:
          option.id,
        accommodationDetails:
          createAccommodationDetailsFromOption(
            option
          ),
        amountPaid:
          getPaymentOptionAmount(
            option,
            currentForm.paymentOption,
            (selectedBooking?.airfareIncludedInTotal ? 0 : toWholeNumber(currentForm.airFlightCharges))
          ),
      })
    );
  }

  function updatePaymentOption(
    value: BookingPaymentOption
  ) {
    setBookingForm(
      (currentForm) => {
        const option =
          accommodationOptions.find(
            (item) =>
              item.id ===
              currentForm.selectedAccommodationOptionId
          ) || null;

        return {
          ...currentForm,
          paymentOption: value,
          amountPaid:
            getPaymentOptionAmount(
              option,
              value,
              (selectedBooking?.airfareIncludedInTotal ? 0 : toWholeNumber(currentForm.airFlightCharges))
            ),
        };
      }
    );
  }

  function updateAirFlightCharges(
    value: string
  ) {
    setBookingForm(
      (currentForm) => {
        const option =
          accommodationOptions.find(
            (item) =>
              item.id ===
              currentForm.selectedAccommodationOptionId
          ) || null;
        const nextForm = {
          ...currentForm,
          airFlightCharges: value,
        };

        if (currentForm.paymentOption === "full" && mode === "add") {
          nextForm.amountPaid = getPaymentOptionAmount(
            option,
            currentForm.paymentOption,
            toWholeNumber(value)
          );
        }

        return nextForm;
      }
    );
  }

  async function copyFinalPaymentLink() {
    if (!finalPaymentBooking?.finalPaymentUrl) {
      toast.error(
        "Final payment link unavailable",
        "Save air-flight charges for a fully paid booking first."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        finalPaymentBooking.finalPaymentUrl
      );
      toast.success(
        "Final payment link copied",
        "Share this link with the traveller to complete the air-flight charge."
      );
    } catch {
      toast.error(
        "Copy failed",
        "Unable to copy the final payment link from this browser."
      );
    }
  }

  async function sendFinalPaymentWhatsapp() {
    if (!finalPaymentBooking || isSendingFinalPaymentLink) {
      return;
    }

    setIsSendingFinalPaymentLink(true);

    try {
      const response = await sendAdminBookingFinalPaymentWhatsapp(
        finalPaymentBooking.id
      );

      setSelectedBooking(response.data.booking);
      setBookingForm(bookingToForm(response.data.booking));
      toast.success(
        "WhatsApp link sent",
        response.message || "Final payment link sent successfully."
      );
    } catch (error) {
      toast.error(
        "WhatsApp link not sent",
        getErrorMessage(error)
      );
    } finally {
      setIsSendingFinalPaymentLink(false);
    }
  }

  async function copyPaymentLink(link: string) {
    if (!link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      toast.success(
        "Payment link copied",
        "The Razorpay payment link is ready to share."
      );
    } catch {
      toast.error(
        "Copy failed",
        "Unable to copy the payment link from this browser."
      );
    }
  }

  async function generateAndSendPaymentLink() {
    if (!selectedBooking || isSendingPaymentLink) {
      return;
    }

    const amount = toWholeNumber(paymentLinkForm.amount);

    if (paymentLinkForm.purpose !== "final" && amount <= 0) {
      toast.error(
        "Amount required",
        "Enter a payment amount greater than zero."
      );
      return;
    }

    setIsSendingPaymentLink(true);

    try {
      const response = await createAdminBookingPaymentLink(
        selectedBooking.id,
        {
          amount:
            paymentLinkForm.purpose === "final"
              ? undefined
              : amount,
          description:
            paymentLinkForm.description.trim(),
          purpose: paymentLinkForm.purpose,
        }
      );

      setSelectedBooking(response.data.booking);
      setBookingForm(bookingToForm(response.data.booking));
      setPaymentLinkRequests(response.data.paymentLinkRequests);
      setPaymentLinkForm((currentForm) => ({
        amount:
          currentForm.purpose === "final"
            ? String(getBookingDueAmount(response.data.booking))
            : "",
        description: "",
        purpose: currentForm.purpose,
      }));
      toast[
        response.data.paymentLinkRequest.whatsappStatus === "sent"
          ? "success"
          : "error"
      ](
        response.data.paymentLinkRequest.whatsappStatus === "sent"
          ? "Payment link sent"
          : "WhatsApp failed",
        response.message
      );
    } catch (error) {
      toast.error(
        "Payment link not sent",
        getErrorMessage(error)
      );
    } finally {
      setIsSendingPaymentLink(false);
    }
  }

  async function resendPaymentLinkWhatsapp(
    paymentLinkRequest: BookingPaymentLinkRequest
  ) {
    if (!selectedBooking || paymentLinkActionId) {
      return;
    }

    setPaymentLinkActionId(paymentLinkRequest.id);

    try {
      const response =
        await resendAdminBookingPaymentLinkWhatsapp(
          selectedBooking.id,
          paymentLinkRequest.id
        );

      setSelectedBooking(response.data.booking);
      setPaymentLinkRequests(response.data.paymentLinkRequests);
      toast[
        response.data.paymentLinkRequest.whatsappStatus === "sent"
          ? "success"
          : "error"
      ](
        response.data.paymentLinkRequest.whatsappStatus === "sent"
          ? "WhatsApp resent"
          : "WhatsApp failed",
        response.message
      );
    } catch (error) {
      toast.error(
        "WhatsApp not resent",
        getErrorMessage(error)
      );
    } finally {
      setPaymentLinkActionId("");
    }
  }

  async function refreshPaymentLinkStatus(
    paymentLinkRequest: BookingPaymentLinkRequest
  ) {
    if (!selectedBooking || paymentLinkActionId) {
      return;
    }

    setPaymentLinkActionId(paymentLinkRequest.id);

    try {
      const response =
        await refreshAdminBookingPaymentLinkStatus(
          selectedBooking.id,
          paymentLinkRequest.id
        );

      setSelectedBooking(response.data.booking);
      setBookingForm(bookingToForm(response.data.booking));
      setPaymentLinkRequests(response.data.paymentLinkRequests);
      toast.success(
        "Payment status refreshed",
        response.message
      );
    } catch (error) {
      toast.error(
        "Status not refreshed",
        getErrorMessage(error)
      );
    } finally {
      setPaymentLinkActionId("");
    }
  }

  async function cancelPaymentLink(
    paymentLinkRequest: BookingPaymentLinkRequest
  ) {
    if (!selectedBooking || paymentLinkActionId) {
      return;
    }

    setPaymentLinkActionId(paymentLinkRequest.id);

    try {
      const response = await cancelAdminBookingPaymentLink(
        selectedBooking.id,
        paymentLinkRequest.id
      );

      setSelectedBooking(response.data.booking);
      setPaymentLinkRequests(response.data.paymentLinkRequests);
      toast.success(
        "Payment link cancelled",
        response.message
      );
    } catch (error) {
      toast.error(
        "Payment link not cancelled",
        getErrorMessage(error)
      );
    } finally {
      setPaymentLinkActionId("");
    }
  }

  function handleKycBookingChange(
    booking: AdminBooking
  ) {
    setSelectedBooking(booking);
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "add" && bookingForm.paymentMethod === "razorpay" && !checkoutPaymentOption) {
      toast.error("Select payment amount", "Choose Advance or Full before opening Razorpay checkout.");
      return;
    }
    await saveBooking(undefined, checkoutPaymentOption || undefined);
  }

  function handlePaymentMethodChange(value: BookingPaymentMethod) {
    if (paymentInProgress.current) return;
    setCheckoutPaymentOption(null);
    updateBookingForm("paymentMethod", value);
    if (mode === "add" && value === "bank_transfer" && bookingFormRef.current?.reportValidity()) {
      void saveBooking(value);
    }
  }

  function handlePayNow(value: BookingPaymentOption) {
    if (paymentInProgress.current) return;
    setCheckoutPaymentOption(value);
    if (selectedBooking?.paymentMode === "online" && selectedBooking.paymentStatus !== "paid") {
      setBookingForm(current => ({ ...current, paymentOption: value }));
    } else updatePaymentOption(value);
  }

  async function handleOpenCheckout() {
    if (!checkoutPaymentOption || paymentInProgress.current) return;
    if (selectedBooking) {
      await openSavedCheckout(selectedBooking, checkoutPaymentOption);
    } else if (bookingFormRef.current?.reportValidity()) {
      await saveBooking("razorpay", checkoutPaymentOption);
    }
  }

  async function openSavedCheckout(booking: AdminBooking, paymentOption: BookingPaymentOption) {
    if (paymentInProgress.current) return;
    paymentInProgress.current = true;
    setIsSaving(true);
    try {
      const paid = await openAdminRazorpayCheckout(booking, paymentOption);
      if (paid) {
        setSelectedBooking(paid);
        setBookingForm(bookingToForm(paid));
        toast.success("Payment verified", "Booking confirmed successfully.");
        router.refresh();
      }
    } catch (error) { toast.error("Checkout not completed", getErrorMessage(error)); }
    finally { paymentInProgress.current = false; setIsSaving(false); }
  }

  async function saveBooking(methodOverride?: BookingPaymentMethod, paymentOptionOverride?: BookingPaymentOption) {
    if (paymentInProgress.current) return;
    if (mode === "add" && savedPaymentBooking.current) {
      router.push("/bookings/view?bookingId=" + encodeURIComponent(savedPaymentBooking.current.id));
      return;
    }
    const form = {
      ...bookingForm,
      ...(methodOverride ? { paymentMethod: methodOverride } : {}),
      ...(paymentOptionOverride ? { paymentOption: paymentOptionOverride } : {}),
    };
    const externalPayment = mode === "add" && ["razorpay", "bank_transfer"].includes(form.paymentMethod);
    if (
      mode === "view" ||
      mode === "invalid"
    ) {
      return;
    }

    const adultCount =
      toWholeNumber(
        form.adultCount
      );

    const childCount =
      toWholeNumber(
        form.childCount
      );

    if (
      adultCount +
        childCount <=
      0
    ) {
      toast.error(
        "Invalid guests",
        "At least one guest is required."
      );

      return;
    }

    if (
      !form.departureId
    ) {
      toast.error(
        "Departure required",
        "Select a tour departure for this booking."
      );

      return;
    }

    if (
      !form.selectedAccommodationOptionId
    ) {
      toast.error(
        "Accommodation required",
        "Select an accommodation option for this booking."
      );

      return;
    }

    if (
      !externalPayment && mode !== "add" && toWholeNumber(form.amountPaid) <= 0
    ) {
      toast.error(
        "Payment amount required",
        "Enter the amount collected now."
      );

      return;
    }

    if (mode === "add" && !leadVerified) { toast.error("Verify lead traveller", "Verify the lead traveller mobile number with OTP before saving."); return; }
    if (!form.paymentMethod) { toast.error("Payment method required", "Select the actual payment method."); return; }
    paymentInProgress.current = true;
    setIsSaving(true);

    try {
      const payload =
        createBookingPayload(
          form
        );

      /*
        EDIT
      */
      if (
        mode === "edit" &&
        bookingId
      ) {
        const response =
          await updateAdminBooking(
            bookingId,
            payload
          );

        toast.success(
          "Booking updated",
          response.message
        );

        router.push(
          `/bookings/view?bookingId=${encodeURIComponent(
            response.data.booking.id
          )}`
        );

        router.refresh();

        return;
      }

      /*
        ADD
      */

      const response = await createAdminBooking({ ...payload, leadVerificationToken: leadVerification?.token });
      const booking = response.data.booking;
      savedPaymentBooking.current = booking;
      if (bookingFormRef.current) delete bookingFormRef.current.dataset.adminUnsaved;

      if (form.paymentMethod === "razorpay") {
        const paid = await openAdminRazorpayCheckout(booking);
        if (paid) toast.success("Payment verified", "Booking confirmed successfully.");
      } else if (form.paymentMethod === "bank_transfer") {
        await createAdminBankTransfer(booking.id, { purpose: form.paymentOption });
        router.push("/bookings/bank-transfer/?bookingId=" + encodeURIComponent(booking.id));
        router.refresh();
        return;
      } else {
        toast.success("Booking added", response.message);
      }
      router.push("/bookings/view?bookingId=" + encodeURIComponent(booking.id));
      router.refresh();
    } catch (error) {
      toast.error(
        savedPaymentBooking.current ? "Booking saved; payment not completed" : mode === "edit" ? "Booking not updated" : "Booking not created",
        getErrorMessage(error)
      );
      if (savedPaymentBooking.current) {
        router.push("/bookings/view?bookingId=" + encodeURIComponent(savedPaymentBooking.current.id));
        router.refresh();
      }
    } finally {
      paymentInProgress.current = false;
      setIsSaving(false);
    }
  }

  /* =======================================================
     TITLES
  ======================================================= */

  const cardTitle =
    mode === "add"
      ? "Add Booking"
      : mode === "edit"
        ? "Edit Booking"
        : "Booking Details";

  const cardDescription =
    mode === "add"
      ? "Create a new tour booking."
      : mode === "edit"
        ? "Update booking guest and accommodation details."
        : "Review complete booking information.";

  /* =======================================================
     INPUT STYLES
  ======================================================= */

  const inputClassName =
    "h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  const textareaClassName =
    "min-h-24 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  return (
    <AdminDashboardShell
      activeLabel="Booking"
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        {/* ================================================= */}
        {/* TOP ACTIONS */}
        {/* ================================================= */}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                "/bookings"
              )
            }
            className="h-10 rounded-sm border-border bg-white px-3 text-xs font-bold"
          >
            <ArrowLeft className="size-4" />
            Back to Bookings
          </Button>

          {mode === "view" &&
          bookingId ? (
            <Button
              type="button"
              onClick={() =>
                router.push(
                  `/bookings/edit-booking?bookingId=${encodeURIComponent(
                    bookingId
                  )}`
                )
              }
              className="h-10 rounded-sm px-4 text-xs font-bold"
            >
              <Pencil className="size-4" />
              Edit Booking
            </Button>
          ) : null}
        </div>

        {/* ================================================= */}
        {/* INVALID / ERROR */}
        {/* ================================================= */}

        {loadError ? (
          <section className="rounded-sm border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold text-red-700">
              {loadError}
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  "/bookings"
                )
              }
              className="mt-4"
            >
              Back to Bookings
            </Button>
          </section>
        ) : null}

        {/* ================================================= */}
        {/* LOADING */}
        {/* ================================================= */}

        {isLoading &&
        !loadError ? (
          <section className="rounded-sm border border-border bg-white p-8 shadow-sm shadow-stone-200/40">
            <div className="space-y-4">
              <div className="h-5 w-44 animate-pulse rounded-sm bg-muted" />
              <div className="h-3 w-80 max-w-full animate-pulse rounded-sm bg-muted" />

              <div className="grid gap-4 pt-5 sm:grid-cols-2">
                {Array.from({
                  length: 8,
                }).map(
                  (_, index) => (
                    <div
                      key={
                        index
                      }
                      className="h-16 animate-pulse rounded-sm bg-muted"
                    />
                  )
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* ================================================= */}
        {/* BOOKING FORM */}
        {/* ================================================= */}

        {!isLoading &&
        !loadError ? (
          <form
            ref={bookingFormRef}
            onSubmit={
              handleSubmit
            }
            className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40"
          >
            {/* CARD TITLE */}

            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  {mode ===
                  "view" ? (
                    <Eye className="size-5 text-primary" />
                  ) : mode ===
                    "edit" ? (
                    <Pencil className="size-5 text-primary" />
                  ) : (
                    <CalendarDays className="size-5 text-primary" />
                  )}

                  <h2 className="text-lg font-bold text-foreground">
                    {
                      cardTitle
                    }
                  </h2>
                </div>

                <p className="mt-1 text-xs text-foreground/55">
                  {
                    cardDescription
                  }
                </p>
              </div>
            </div>

            {/* FORM BODY */}

            <div className="grid gap-6 p-6 sm:grid-cols-2">
              {/* ======================================= */}
              {/* BOOKING DETAILS */}
              {/* ======================================= */}

              <FormSectionTitle>
                Booking Details
              </FormSectionTitle>

              <FormField
                label="Tour ID"
                required
              >
                <Select
                  disabled={
                    isReadOnly ||
                    tours.length ===
                      0
                  }
                  name="tourId"
                  required
                  value={
                    bookingForm.tourId
                  }
                  onValueChange={(
                    value
                  ) =>
                    updateBookingForm(
                      "tourId",
                      String(
                        value ||
                          ""
                      )
                    )
                  }
                >
                  <SelectTrigger
                    className={
                      inputClassName
                    }
                  >
                    <SelectValue
                      placeholder={
                        tours.length
                          ? "Select tour"
                          : "No tours available"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {tours.map(
                      (
                        tour
                      ) => (
                        <SelectItem
                          key={
                            tour.id
                          }
                          value={
                            tour.tourId
                          }
                        >
                          <span className="flex min-w-max flex-col gap-0.5">
                            <span>
                              {
                                tour.tourId
                              }
                            </span>

                            <span className="text-xs text-foreground/55">
                              {
                                tour.tourName
                              }
                            </span>
                          </span>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Departure"
                required
              >
                <Select
                  disabled={
                    isReadOnly ||
                    availableDepartures.length ===
                      0
                  }
                  name="departureId"
                  required
                  value={
                    bookingForm.departureId
                  }
                  onValueChange={(
                    value
                  ) =>
                    updateBookingForm(
                      "departureId",
                      String(
                        value ||
                          ""
                      )
                    )
                  }
                >
                  <SelectTrigger
                    className={
                      inputClassName
                    }
                  >
                    <SelectValue
                      placeholder={
                        availableDepartures.length
                          ? "Select departure"
                          : "No departures available"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {availableDepartures.map(
                      (
                        departure
                      ) => (
                        <SelectItem
                          key={
                            departure.id
                          }
                          value={
                            departure.departureId
                          }
                        >
                          <span className="flex min-w-max flex-col gap-0.5">
                            <span>
                              {
                                departure.departureId
                              }
                            </span>
                            <span className="text-xs text-foreground/55">
                              {formatDatePickerValue(
                                toDateInputValue(
                                  departure.departureDate || ""
                                )
                              )}
                              {" - "}
                              {formatDatePickerValue(
                                toDateInputValue(
                                  departure.returnDate || ""
                                )
                              )}
                            </span>
                          </span>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Total Guest"
                required
              >
                <input
                  type="number"
                  readOnly
                  value={
                    bookingForm.totalGuest
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField
                label="Adult Count"
                required
              >
                <input
                  required
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm.adultCount
                  }
                  onChange={(
                    event
                  ) =>
                    updateBookingForm(
                      "adultCount",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField
                label="Child Count"
                required
              >
                <input
                  required
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly
                  }
                  value={
                    bookingForm.childCount
                  }
                  onChange={(
                    event
                  ) =>
                    updateBookingForm(
                      "childCount",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              {/* ======================================= */}
              {/* CHILD DETAILS */}
              {/* ======================================= */}

              {bookingForm
                .childDetails
                .length ? (
                <>
                  <FormSectionTitle>
                    Child Details
                  </FormSectionTitle>

                  <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                    {bookingForm.childDetails.map(
                      (
                        child,
                        index
                      ) => (
                        <FormField
                          key={
                            index
                          }
                          label={`Child ${
                            index +
                            1
                          } Age`}
                          required
                        >
                          <input
                            required
                            min={
                              0
                            }
                            max={
                              17
                            }
                            type="number"
                            readOnly={
                              isReadOnly
                            }
                            value={
                              child.age
                            }
                            onChange={(
                              event
                            ) =>
                              updateChildDetails(
                                index,
                                event
                                  .target
                                  .value
                              )
                            }
                            className={
                              inputClassName
                            }
                          />
                        </FormField>
                      )
                    )}
                  </div>
                </>
              ) : null}

              {/* ======================================= */}
              {/* GUEST DETAILS */}
              {/* ======================================= */}

              <FormSectionTitle>
                Guest Details
              </FormSectionTitle>

              <div className="grid gap-6 sm:col-span-2">
                {bookingForm.guestDetails.map(
                  (
                    guest,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="grid gap-5 rounded-sm border border-border bg-muted/10 p-5 sm:grid-cols-2"
                    >
                      <div className="sm:col-span-2">
                        <p className="text-xs font-bold uppercase text-foreground/55">
                          Guest{" "}
                          {index +
                            1}
                        </p>
                      </div>

                      <FormField
                        label="Title"
                        required
                      >
                        <Select
                          disabled={
                            isReadOnly
                          }
                          value={
                            guest.title
                          }
                          onValueChange={(
                            value
                          ) =>
                            updateGuestDetails(
                              index,
                              "title",
                              String(
                                value ||
                                  ""
                              )
                            )
                          }
                        >
                          <SelectTrigger
                            className={
                              inputClassName
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {titleOptions.map(
                              (
                                title
                              ) => (
                                <SelectItem
                                  key={
                                    title
                                  }
                                  value={
                                    title
                                  }
                                >
                                  {
                                    title
                                  }
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        label="First Name"
                        required
                      >
                        <input
                          required
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.firstName
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "firstName",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Last Name"
                        required
                      >
                        <input
                          required
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.lastName
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "lastName",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Mobile"
                        required
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="grid min-w-[220px] flex-1 grid-cols-[90px_minmax(0,1fr)] gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
                          <Select
                            disabled={
                              isReadOnly
                            }
                            value={
                              guest.countryCode
                            }
                            onValueChange={(
                              value
                            ) =>
                              updateGuestDetails(
                                index,
                                "countryCode",
                                String(
                                  value ||
                                    ""
                                )
                              )
                            }
                          >
                            <SelectTrigger
                              className={
                                inputClassName
                              }
                            >
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {countryCodeOptions.map(
                                (
                                  code
                                ) => (
                                  <SelectItem
                                    key={
                                      code
                                    }
                                    value={
                                      code
                                    }
                                  >
                                    {
                                      code
                                    }
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>

                          <input
                            required
                            readOnly={
                              isReadOnly
                            }
                            value={
                              guest.mobileNumber
                            }
                            onChange={(
                              event
                            ) =>
                              updateGuestDetails(
                                index,
                                "mobileNumber",
                                event
                                  .target
                                  .value
                              )
                            }
                            className={
                              inputClassName
                            }
                          />
                          </div>
                          {index === 0 && mode === "add" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button type="button" variant="outline" className="h-11 shrink-0" disabled={leadOtpBusy || leadVerified || !guest.mobileNumber} onClick={() => void sendLeadOtp()}>{leadVerified ? "Verified" : leadOtpBusy ? "Please wait..." : "Send OTP"}</Button>
                              {leadOtpSentTo === leadPhone && !leadVerified ? <>
                                <input aria-label="Lead traveller OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={9} value={leadOtp} onChange={event => setLeadOtp(event.target.value.replace(/\D/g, ""))} className="h-11 w-24 rounded-sm border border-border bg-white px-3" placeholder="Enter OTP" />
                                <Button type="button" className="h-11 shrink-0" disabled={leadOtpBusy || !/^\d{4,9}$/.test(leadOtp)} onClick={() => void verifyLeadOtp()}>Verify OTP</Button>
                              </> : null}
                            </div>
                          ) : null}
                        </div>
                      </FormField>

                      <FormField
                        label="Email"
                        required
                      >
                        <input
                          required
                          type="email"
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.email
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "email",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Date of Birth"
                        required
                      >
                        <DatePicker
                          value={
                            guest.dateOfBirth
                          }
                          readOnly={
                            isReadOnly
                          }
                          onChange={(
                            value
                          ) =>
                            updateGuestDetails(
                              index,
                              "dateOfBirth",
                              value
                            )
                          }
                          triggerClassName={
                            inputClassName
                          }
                        />
                      </FormField>

                      <FormField
                        label="Gender"
                        required
                      >
                        <Select
                          disabled={
                            isReadOnly
                          }
                          value={
                            guest.gender
                          }
                          onValueChange={(
                            value
                          ) =>
                            updateGuestDetails(
                              index,
                              "gender",
                              String(
                                value ||
                                  ""
                              )
                            )
                          }
                        >
                          <SelectTrigger
                            className={
                              inputClassName
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {genderOptions.map(
                              (
                                gender
                              ) => (
                                <SelectItem
                                  key={
                                    gender
                                  }
                                  value={
                                    gender
                                  }
                                >
                                  {
                                    gender
                                  }
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        className="sm:col-span-2"
                        label="Address"
                        required
                      >
                        <textarea
                          required
                          readOnly={
                            isReadOnly
                          }
                          value={
                            guest.address
                          }
                          onChange={(
                            event
                          ) =>
                            updateGuestDetails(
                              index,
                              "address",
                              event
                                .target
                                .value
                            )
                          }
                          className={
                            textareaClassName
                          }
                        />
                      </FormField>
                    </div>
                  )
                )}
              </div>

              {selectedBooking ? (
                <AdminKycDocumentsSection
                  booking={selectedBooking}
                  isUploading={isKycUploading}
                  onBookingChange={handleKycBookingChange}
                  onUploadEnd={() => setIsKycUploading(false)}
                  onUploadStart={() => setIsKycUploading(true)}
                />
              ) : null}

              {/* ======================================= */}
              {/* ACCOMMODATION */}
              {/* ======================================= */}

              <FormSectionTitle>
                Accommodation Details
              </FormSectionTitle>

              <div className="grid gap-3 sm:col-span-2">
                {accommodationError ? (
                  <div className="rounded-sm border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
                    {accommodationError}
                  </div>
                ) : null}

                {!bookingForm.departureId ? (
                  <div className="rounded-sm border border-border bg-muted/20 px-4 py-3 text-sm font-semibold text-foreground/60">
                    Select a departure to load accommodation options.
                  </div>
                ) : null}

                {accommodationOptions.map(
                  (option) => (
                    <AccommodationOptionCard
                      key={option.id}
                      option={option}
                      selected={
                        bookingForm.selectedAccommodationOptionId ===
                        option.id
                      }
                      readOnly={isReadOnly}
                      onSelect={() =>
                        selectAccommodationOption(
                          option
                        )
                      }
                    />
                  )
                )}
              </div>

              <FormSectionTitle>
                Payment Details
              </FormSectionTitle>

              {selectedBooking ? (
                <BookingBankTransferHistory
                  key={selectedBooking.id}
                  bookingId={selectedBooking.id}
                  hasBankTransfer={Boolean(selectedBooking.hasBankTransfer || selectedBooking.paymentMode === "bank_transfer" || selectedBooking.paymentMethod === "bank_transfer")}
                />
              ) : null}

              {(mode === "add" && bookingForm.paymentMethod === "razorpay" || selectedBooking?.paymentMode === "online" && selectedBooking.paymentStatus !== "paid" && selectedBooking.recoveryUrl) ? (
                <div className="flex flex-wrap items-center gap-3 rounded-sm border border-primary/20 p-4 text-sm sm:col-span-2">
                  <Button type="button" disabled={isSaving || !checkoutPaymentOption} onClick={() => void handleOpenCheckout()}>Open Razorpay Checkout</Button>
                  <span>Select Advance or Full, then click Open Razorpay Checkout to pay using UPI, Netbanking or Card. Confirmation follows verified payment.</span>
                </div>
              ) : null}
              {mode === "add" ? <p className="text-sm text-foreground/65 sm:col-span-2">Choose Online for UPI, Netbanking or Card checkout, Bank Transfer for NEFT / IMPS / RTGS, or Cash / Cheque for an offline receipt. Online and bank-transfer bookings remain pending until payment is verified. Enter only money actually received for Cash or Cheque; use 0 for an unpaid request.</p> : null}
              {selectedBooking?.paymentMode === "offline" && selectedBooking.paymentStatus !== "paid" ? (
                <div className="rounded-sm border border-primary/20 bg-primary/5 px-4 py-3 text-sm sm:col-span-2">
                  Offline payment pending. Choose Cash or Cheque and enter the amount actually received, then click Mark Paid. The traveller will receive confirmation after payment is recorded.
                </div>
              ) : null}

              <FormField
                label="Payment Method"
                required
              >
                <Select
                  disabled={isReadOnly || providerPayment || isSaving}
                  value={
                    bookingForm.paymentMethod
                  }
                  onValueChange={value => handlePaymentMethodChange(value as BookingPaymentMethod)}
                >
                  <SelectTrigger
                    className={
                      inputClassName
                    }
                  >
                    <SelectValue>{paymentMethodOptions.find(method => method.value === bookingForm.paymentMethod)?.label || "Select payment method"}</SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    {paymentMethodOptions.filter(method => (mode !== "add" || ["cash", "cheque", "bank_transfer", "razorpay"].includes(method.value)) && (selectedBooking?.paymentMode !== "offline" || selectedBooking.paymentStatus === "paid" || method.value === "cash" || method.value === "cheque")).map(
                      (
                        method
                      ) => (
                        <SelectItem
                          key={
                            method.value
                          }
                          value={
                            method.value
                          }
                        >
                          {
                            method.label
                          }
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Pay Now"
                required
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSaving || (isReadOnly && !(selectedBooking?.paymentMode === "online" && selectedBooking.paymentStatus !== "paid"))}
                    aria-pressed={
                      bookingForm.paymentOption ===
                      "advance"
                    }
                    onClick={() =>
                      handlePayNow(
                        "advance"
                      )
                    }
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed",
                      bookingForm.paymentOption ===
                        "advance"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-white text-foreground/65 hover:border-primary/40"
                    )}
                  >
                    <span>Advance</span>
                    {selectedAccommodationOption ? (
                      <span className="text-xs font-semibold">
                        {formatCurrency(
                          selectedAccommodationOption.depositAmount
                        )}
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || (isReadOnly && !(selectedBooking?.paymentMode === "online" && selectedBooking.paymentStatus !== "paid"))}
                    aria-pressed={
                      bookingForm.paymentOption ===
                      "full"
                    }
                    onClick={() =>
                      handlePayNow(
                        "full"
                      )
                    }
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed",
                      bookingForm.paymentOption ===
                        "full"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-white text-foreground/65 hover:border-primary/40"
                    )}
                  >
                    <span>Full</span>
                    {selectedAccommodationOption ? (
                      <span className="text-xs font-semibold">
                        {formatCurrency(
                          selectedAccommodationOption.grandTotal +
                            (selectedBooking?.airfareIncludedInTotal ? 0 : airFlightCharges)
                        )}
                      </span>
                    ) : null}
                  </button>
                </div>
              </FormField>

              <FormField
                label="Amount Paid Now"
              >
                <input
                  min={0}
                  type="number"
                  readOnly={isReadOnly || providerPayment || newExternalPayment}
                  value={newExternalPayment ? "0" : bookingForm.amountPaid}
                  onChange={(
                    event
                  ) =>
                    updateBookingForm(
                      "amountPaid",
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField
                label="Air-flight Charges"
              >
                <input
                  min={0}
                  type="number"
                  readOnly={
                    isReadOnly || Boolean(selectedBooking)
                  }
                  value={
                    bookingForm.airFlightCharges
                  }
                  onChange={(
                    event
                  ) =>
                    updateAirFlightCharges(
                      event.target
                        .value
                    )
                  }
                  className={
                    inputClassName
                  }
                  placeholder="0"
                />
              <p className="mt-1 text-xs">For an existing booking, use the booking list airfare editor to preserve its audit history.</p>
              </FormField>

              <AirfareDisclosure
                excluded={selectedBooking?.airfareExcluded ?? isAirfareExcluded(selectedTour)}
                amount={toWholeNumber(bookingForm.airFlightCharges)}
                addedAt={selectedBooking?.airfareAddedAt}
                includedInTotal={selectedBooking?.airfareIncludedInTotal}
              />
              {selectedAccommodationOption ? (
                <AccommodationPriceBreakdown
                  option={selectedAccommodationOption}
                  airFlightCharges={toWholeNumber(
                    bookingForm.airFlightCharges
                  )}
                  airfareIncludedInTotal={selectedBooking?.airfareIncludedInTotal}
                  paymentOption={bookingForm.paymentOption}
                />
              ) : null}

              {finalPaymentBooking ? (
                <div className="grid gap-3 rounded-sm border border-primary/20 bg-primary/5 px-4 py-3 sm:col-span-2">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-primary">
                        Air-flight payment link
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground/70">
                        {finalPaymentBooking.finalPaymentUrl}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copyFinalPaymentLink}
                        className="h-10 rounded-sm px-4 text-xs font-bold"
                      >
                        <Copy className="size-4" />
                        Copy Link
                      </Button>
                      <Button
                        type="button"
                        onClick={sendFinalPaymentWhatsapp}
                        disabled={isSendingFinalPaymentLink}
                        className="h-10 rounded-sm px-4 text-xs font-bold"
                      >
                        <Mail className="size-4" />
                        {isSendingFinalPaymentLink
                          ? "Sending..."
                          : "Send WhatsApp"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {mode === "view" && selectedBooking ? (
                <div className="grid gap-5 rounded-sm border border-border bg-muted/10 p-4 sm:col-span-2">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-5 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">
                          Send Payment Link
                        </h3>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-foreground/55">
                        Outstanding balance: {formatCurrency(outstandingAmount)}
                      </p>
                    </div>

                    <div className="grid gap-1 text-xs font-semibold text-foreground/60 lg:text-right">
                      <span>
                        {getGuestName(selectedBooking.guestDetails[0]) || "Traveller"}
                      </span>
                      <span>
                        {[
                          selectedBooking.guestDetails[0]?.countryCode,
                          selectedBooking.guestDetails[0]?.mobileNumber,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                    <FormField label="Payment Type">
                      <Select
                        value={paymentLinkForm.purpose}
                        onValueChange={(value) =>
                          setPaymentLinkForm((currentForm) => ({
                            ...currentForm,
                            amount:
                              value === "final" && outstandingAmount > 0
                                ? String(outstandingAmount)
                                : value === "final"
                                  ? ""
                                  : currentForm.amount,
                            purpose: value as BookingPaymentLinkPurpose,
                          }))
                        }
                      >
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentLinkPurposeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex min-w-max flex-col gap-0.5">
                                <span>{option.label}</span>
                                <span className="text-xs text-foreground/45">
                                  {option.description}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField label="Amount">
                      <div className="relative">
                        <IndianRupee className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/45" />
                        <input
                          min={1}
                          readOnly={paymentLinkForm.purpose === "final"}
                          type="number"
                          value={paymentLinkForm.amount}
                          onChange={(event) =>
                            setPaymentLinkForm((currentForm) => ({
                              ...currentForm,
                              amount: event.target.value,
                            }))
                          }
                          className={cn(inputClassName, "pl-9")}
                          placeholder="0"
                        />
                      </div>
                    </FormField>

                    <FormField className="lg:col-span-2" label="Description">
                      <textarea
                        value={paymentLinkForm.description}
                        onChange={(event) =>
                          setPaymentLinkForm((currentForm) => ({
                            ...currentForm,
                            description: event.target.value,
                          }))
                        }
                        className={textareaClassName}
                        placeholder="Payment description"
                      />
                    </FormField>

                    <div className="flex justify-end lg:col-span-2">
                      <Button
                        type="button"
                        disabled={isSendingPaymentLink}
                        onClick={generateAndSendPaymentLink}
                        className="h-10 rounded-sm px-4 text-xs font-bold"
                      >
                        <Send className="size-4" />
                        {isSendingPaymentLink
                          ? "Sending..."
                          : "Generate & Send Payment Link"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                      <h4 className="text-sm font-bold text-foreground">
                        Payment Requests
                      </h4>
                      <span className="text-xs font-semibold text-foreground/45">
                        {paymentLinkRequests.length} request{paymentLinkRequests.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {paymentLinkRequests.length === 0 ? (
                      <div className="rounded-sm border border-dashed border-border bg-white px-4 py-5 text-sm font-semibold text-foreground/50">
                        No payment links sent yet.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {paymentLinkRequests.map((paymentLinkRequest) => {
                          const isBusy =
                            paymentLinkActionId === paymentLinkRequest.id;
                          const canAct =
                            paymentLinkRequest.status === "created" ||
                            paymentLinkRequest.status === "sent";

                          return (
                            <div
                              key={paymentLinkRequest.id}
                              className="grid gap-3 rounded-sm border border-border bg-white p-4"
                            >
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-foreground">
                                      {paymentLinkRequest.purposeLabel}
                                    </span>
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase",
                                        getPaymentLinkStatusClassName(
                                          paymentLinkRequest.status
                                        )
                                      )}
                                    >
                                      {paymentLinkRequest.status}
                                    </span>
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase",
                                        getWhatsappStatusClassName(
                                          paymentLinkRequest.whatsappStatus
                                        )
                                      )}
                                    >
                                      WhatsApp {paymentLinkRequest.whatsappStatus}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-lg font-bold text-primary">
                                    {formatCurrency(paymentLinkRequest.amountRupees)}
                                  </p>
                                  <p className="mt-1 break-words text-xs font-semibold text-foreground/55">
                                    {paymentLinkRequest.description || "-"}
                                  </p>
                                  <a
                                    href={paymentLinkRequest.paymentLinkUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs font-bold text-primary underline-offset-4 hover:underline"
                                  >
                                    <ExternalLink className="size-3.5 shrink-0" />
                                    <span className="truncate">
                                      {paymentLinkRequest.paymentLinkUrl}
                                    </span>
                                  </a>
                                </div>

                                <div className="grid gap-1 text-xs font-semibold text-foreground/50 xl:text-right">
                                  <span>
                                    Created {formatDateTime(paymentLinkRequest.createdAt)}
                                  </span>
                                  <span>
                                    Expires {formatDateTime(paymentLinkRequest.expiresAt)}
                                  </span>
                                </div>
                              </div>

                              {paymentLinkRequest.whatsappError ||
                              paymentLinkRequest.failureReason ? (
                                <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                                  {paymentLinkRequest.whatsappError ||
                                    paymentLinkRequest.failureReason}
                                </div>
                              ) : null}

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      paymentLinkRequest.paymentLinkUrl,
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                  className="h-9 rounded-sm px-3 text-xs font-bold"
                                >
                                  <Eye className="size-4" />
                                  View
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    copyPaymentLink(
                                      paymentLinkRequest.paymentLinkUrl
                                    )
                                  }
                                  className="h-9 rounded-sm px-3 text-xs font-bold"
                                >
                                  <Copy className="size-4" />
                                  Copy Link
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={!canAct || isBusy || Boolean(paymentLinkActionId)}
                                  onClick={() =>
                                    resendPaymentLinkWhatsapp(paymentLinkRequest)
                                  }
                                  className="h-9 rounded-sm px-3 text-xs font-bold"
                                >
                                  <Mail className="size-4" />
                                  Resend WhatsApp
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={isBusy || Boolean(paymentLinkActionId)}
                                  onClick={() =>
                                    refreshPaymentLinkStatus(paymentLinkRequest)
                                  }
                                  className="h-9 rounded-sm px-3 text-xs font-bold"
                                >
                                  <RefreshCw className="size-4" />
                                  Refresh Status
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={!canAct || isBusy || Boolean(paymentLinkActionId)}
                                  onClick={() =>
                                    cancelPaymentLink(paymentLinkRequest)
                                  }
                                  className="h-9 rounded-sm border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="size-4" />
                                  Cancel Link
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                      <h4 className="text-sm font-bold text-foreground">
                        Payment History
                      </h4>
                      <span className="text-xs font-semibold text-foreground/45">
                        {paymentHistoryItems.length} payment{paymentHistoryItems.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {(selectedBooking?.collectionHistory || []).map(entry => <p key={entry.paymentId} className="mb-2 text-xs">
                      {entry.paymentId}: {formatCurrency(entry.amount)} received; Air-Flight Charges: {formatCurrency(entry.airfareAmount)}
                    </p>)}
                    {paymentHistoryItems.length === 0 ? (
                      <div className="rounded-sm border border-dashed border-border bg-white px-4 py-5 text-sm font-semibold text-foreground/50">
                        No successful payment has been recorded yet.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {paymentHistoryItems.map((paymentHistoryItem) => (
                          <div
                            key={paymentHistoryItem.id}
                            className="grid gap-3 rounded-sm border border-border bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-foreground">
                                    {paymentHistoryItem.title}
                                  </span>
                                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-700">
                                    Successful
                                  </span>
                                </div>
                                <p className="mt-1 text-lg font-bold text-primary">
                                  {formatCurrency(
                                    paymentHistoryItem.amount,
                                    paymentHistoryItem.currency
                                  )}
                                </p>
                                <p className="mt-1 break-words text-xs font-semibold text-foreground/55">
                                  {paymentHistoryItem.description}
                                </p>
                                <p className="mt-2 break-words text-xs font-bold text-foreground/60">
                                  {paymentHistoryItem.reference}
                                </p>
                              </div>

                              <div className="grid gap-1 text-xs font-semibold text-foreground/50 xl:text-right">
                                <span>
                                  Paid {formatDateTime(paymentHistoryItem.paidAt)}
                                </span>
                                <span>
                                  {paymentHistoryItem.method}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ================================================= */}
            {/* SAVE FOOTER */}
            {/* ================================================= */}

            {!isReadOnly ? (
              <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/10 px-6 py-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isSaving
                  }
                  onClick={() =>
                    router.push(
                      "/bookings"
                    )
                  }
                  className="h-10 rounded-sm"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={
                    isSaving
                  }
                  className="h-10 rounded-sm px-5 font-bold"
                >
                  <Save className="size-4" />

                  {isSaving
                    ? "Saving..."
                    : mode ===
                        "edit"
                      ? selectedBooking?.paymentMode === "offline" && selectedBooking.paymentStatus !== "paid" ? "Mark Paid" : "Update Booking"
                      : bookingForm.paymentMethod === "razorpay" ? "Proceed to Payment" : bookingForm.paymentMethod === "bank_transfer" ? "Get Bank Details" : "Save Booking"}
                </Button>
              </div>
            ) : null}
          </form>
        ) : null}
      </div>
    </AdminDashboardShell>
  );
}

/* =========================================================
   DATE PICKER
========================================================= */

function DatePicker({
  value,
  onChange,
  readOnly = false,
  triggerClassName,
}: {
  value: string;

  onChange: (
    value: string
  ) => void;

  readOnly?: boolean;

  triggerClassName?: string;
}) {
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false);

  const selectedDate =
    parseDateInputValue(
      value
    );

  const currentYear =
    new Date().getFullYear();

  return (
    <Popover
      open={isOpen}
      onOpenChange={(
        open
      ) => {
        if (
          !readOnly
        ) {
          setIsOpen(
            open
          );
        }
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={
          readOnly
        }
        className={cn(
          triggerClassName,
          "flex w-full items-center justify-between gap-3 text-left font-medium",
          !value &&
            "text-foreground/45"
        )}
      >
        <span>
          {formatDatePickerValue(
            value
          )}
        </span>

        <CalendarDays className="size-4 shrink-0 text-foreground/55" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-3"
      >
        <Calendar
          key={
            value ||
            "empty-date"
          }
          selected={
            selectedDate
          }
          showMonthYearDropdowns
          yearRange={{
            from:
              currentYear -
              120,

            to:
              currentYear,
          }}
          onSelect={(
            date
          ) => {
            onChange(
              dateToInputValue(
                date
              )
            );

            setIsOpen(
              false
            );
          }}
          onClear={() => {
            onChange("");

            setIsOpen(
              false
            );
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/* =========================================================
   FORM SECTION
========================================================= */

function FormSectionTitle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border pb-2 sm:col-span-2">
      <h3 className="text-sm font-bold text-foreground">
        {children}
      </h3>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  children,
  className,
  label,
  required = false,
}: {
  children: ReactNode;

  className?: string;

  label: string;

  required?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-col gap-2",
        className
      )}
    >
      <span className="text-xs font-bold uppercase text-foreground/55">
        {label}

        {required ? (
          <span className="text-primary">
            {" "}
            *
          </span>
        ) : null}
      </span>

      {children}
    </label>
  );
}
