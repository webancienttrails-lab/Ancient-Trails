"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Hourglass,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Ticket,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useToast } from "@/components/ui/toast";

import {
  archiveAdminBooking,
  cancelAdminBooking,
  createAdminBookingPaymentLink,
  expireAdminBooking,
  listAdminBookings,
  sendAdminBookingFinalPaymentWhatsapp,
  sendAdminBookingRecoveryEmail,
  updateAdminBookingAirFlightCharges,
  type AdminBooking,
  type BookingCancellationPayload,
  type BookingGuestDetails,
} from "@/lib/bookings";

import {
  listAdminTours,
  type AdminTour,
} from "@/lib/tours";

import { cn } from "@/lib/utils";
import { shouldOpenTableRow } from "@/lib/table-row-click";

/* =========================================================
   TYPES
========================================================= */

type BookingMetric = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  descriptionTone: string;
};

/* =========================================================
   HELPERS
========================================================= */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function getGuestName(
  guest?: BookingGuestDetails
): string {
  if (!guest) {
    return "-";
  }

  const name = [
    guest.title,
    guest.firstName,
    guest.lastName,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return name || "-";
}

function getGuestPhone(
  guest?: BookingGuestDetails
): string {
  if (!guest) {
    return "-";
  }

  return [guest.countryCode, guest.mobileNumber]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ") || "-";
}

function getBookingReference(
  booking: AdminBooking
): string {
  return booking.bookingReference || `BK-${booking.id.slice(-6).toUpperCase()}`;
}

function toMoney(
  value: number | null | undefined
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(Number(value)));
}

function formatCurrency(
  value: number,
  currency = "INR"
): string {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(toMoney(value));
}

/* =========================================================
   PAYMENT HELPERS
========================================================= */

function getBookingTotalAmount(
  booking: AdminBooking
): number {
  const grandTotal = toMoney(booking.grandTotal);

  if (grandTotal > 0) {
    return grandTotal;
  }

  const paidAmount =
    toMoney(booking.amountPaid) ||
    toMoney(booking.depositAmount);

  const balanceAmount = Number.isFinite(
    booking.balanceAmount
  )
    ? toMoney(booking.balanceAmount)
    : 0;

  const calculatedTotal =
    paidAmount + balanceAmount;

  if (calculatedTotal > 0) {
    return calculatedTotal;
  }

  return (
    toMoney(booking.subtotal) ||
    paidAmount
  );
}

function getBookingPaidAmount(
  booking: AdminBooking
): number {
  const totalAmount =
    getBookingTotalAmount(booking);
  const amountPaid = toMoney(
    booking.amountPaid
  );

  if (booking.paymentStatus !== "paid") {
    return amountPaid;
  }

  if (amountPaid > 0) {
    return amountPaid;
  }

  if (
    Number.isFinite(booking.balanceAmount) &&
    totalAmount > 0
  ) {
    return Math.max(
      0,
      totalAmount - toMoney(booking.balanceAmount)
    );
  }

  if (
    booking.paymentOption === "full" &&
    totalAmount > 0
  ) {
    return totalAmount;
  }

  const depositAmount = toMoney(
    booking.depositAmount
  );

  if (depositAmount > 0) {
    return depositAmount;
  }

  if (booking.paymentStatus === "paid") {
    return getBookingTotalAmount(booking);
  }

  return 0;
}

function getBookingDueAmount(
  booking: AdminBooking
): number {
  const totalAmount =
    getBookingTotalAmount(booking);

  const paidAmount =
    getBookingPaidAmount(booking);

  if (booking.paymentStatus !== "paid") {
    return totalAmount;
  }

  if (
    booking.paymentOption === "full" &&
    totalAmount > 0 &&
    paidAmount >= totalAmount
  ) {
    return 0;
  }

  if (
    totalAmount > 0 &&
    paidAmount >= totalAmount
  ) {
    return 0;
  }

  if (
    totalAmount > 0 &&
    paidAmount > 0
  ) {
    return Math.max(
      0,
      totalAmount - paidAmount
    );
  }

  if (
    Number.isFinite(booking.balanceAmount)
  ) {
    return toMoney(booking.balanceAmount);
  }

  return Math.max(
    0,
    totalAmount - paidAmount
  );
}

function canSendAirFlightChargesLink(booking: AdminBooking): boolean {
  const totalAmount = getBookingTotalAmount(booking);
  const airFlightCharges = toMoney(booking.airFlightCharges);
  const originalPackageTotal = Math.max(0, totalAmount - airFlightCharges);

  return Boolean(
    booking.paymentStatus === "paid" &&
      airFlightCharges > 0 &&
      getBookingDueAmount(booking) > 0 &&
      originalPackageTotal > 0 &&
      getBookingPaidAmount(booking) >= originalPackageTotal
  );
}

/* =========================================================
   PAID / PENDING STATUS

   Only two statuses as requested.
========================================================= */

function getPaymentStatus(
  booking: AdminBooking
) {
  if (booking.bookingStatus === "cancelled") {
    return {
      label: "Cancelled",
      tone:
        "bg-stone-100 text-stone-600 border-stone-200",
    };
  }

  if (booking.bookingStatus === "expired") {
    return {
      label: "Expired",
      tone:
        "bg-stone-100 text-stone-600 border-stone-200",
    };
  }

  if (booking.bookingStatus === "payment_pending") {
    return {
      label: booking.paymentStatus === "failed" ? "Failed" : "Pending",
      tone:
        "bg-amber-100 text-amber-700 border-amber-200",
    };
  }

  const totalAmount =
    getBookingTotalAmount(booking);

  const paidAmount =
    getBookingPaidAmount(booking);

  const dueAmount =
    getBookingDueAmount(booking);

  const isFullyPaid =
    totalAmount > 0 &&
    dueAmount <= 0 &&
    paidAmount >= totalAmount;

  if (
    booking.paymentStatus === "paid" &&
    dueAmount <= 0
  ) {
    return {
      label: "Paid",
      tone:
        "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }

  if (isFullyPaid) {
    return {
      label: "Paid",
      tone:
        "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }

  return {
    label: "Pending",
    tone:
      "bg-amber-100 text-amber-700 border-amber-200",
  };
}

/* =========================================================
   CURRENT MONTH
========================================================= */

function isCurrentMonth(
  dateValue: string
): boolean {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() ===
      now.getFullYear()
  );
}

/* =========================================================
   METRICS
========================================================= */

function createBookingMetrics(
  bookings: AdminBooking[]
): BookingMetric[] {
  const currentMonthBookings =
    bookings.filter((booking) =>
      isCurrentMonth(booking.createdAt)
    ).length;

  const fullyPaidBookings =
    bookings.filter((booking) => {
      return (
        getPaymentStatus(booking).label ===
        "Paid"
      );
    }).length;

  const balanceDueBookings =
    bookings.filter((booking) => {
      return (
        getBookingDueAmount(booking) > 0
      );
    }).length;

  return [
    {
      label: "Current Month Bookings",
      value:
        currentMonthBookings.toString(),
      description:
        "Bookings received this month",
      icon: CalendarDays,
      tone:
        "bg-orange-100 text-orange-600",
      descriptionTone:
        "text-orange-600",
    },
    {
      label: "Fully Paid Bookings",
      value:
        fullyPaidBookings.toString(),
      description:
        "Payment completed",
      icon: CheckCircle2,
      tone:
        "bg-emerald-100 text-emerald-700",
      descriptionTone:
        "text-emerald-600",
    },
    {
      label: "Balance Due Bookings",
      value:
        balanceDueBookings.toString(),
      description:
        "Bookings with pending balance",
      icon: WalletCards,
      tone:
        "bg-amber-100 text-amber-700",
      descriptionTone:
        "text-amber-600",
    },
    {
      label: "Total Bookings",
      value: bookings.length.toString(),
      description:
        "All active booking records",
      icon: Ticket,
      tone:
        "bg-primary/10 text-primary",
      descriptionTone:
        "text-primary",
    },
  ];
}

/* =========================================================
   PAGE
========================================================= */

export default function BookingsPage() {
  const router = useRouter();
  const toast = useToast();

  const [cancellationBooking, setCancellationBooking] = useState<AdminBooking | null>(null);

  const [bookings, setBookings] =
    useState<AdminBooking[]>([]);

  const [tours, setTours] =
    useState<AdminTour[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    isLoadingBookings,
    setIsLoadingBookings,
  ] = useState(true);

  const [
    isArchivingBookingId,
    setIsArchivingBookingId,
  ] = useState<string | null>(null);

  const [
    pendingActionBookingId,
    setPendingActionBookingId,
  ] = useState<string | null>(null);

  const [
    airFlightDialogBooking,
    setAirFlightDialogBooking,
  ] = useState<AdminBooking | null>(null);

  const [
    airFlightChargeAmount,
    setAirFlightChargeAmount,
  ] = useState("");

  const [
    airFlightFinalPaymentUrl,
    setAirFlightFinalPaymentUrl,
  ] = useState("");

  const [
    isSavingAirFlightCharges,
    setIsSavingAirFlightCharges,
  ] = useState(false);

  const [
    isSendingAirFlightLink,
    setIsSendingAirFlightLink,
  ] = useState(false);

  /* =======================================================
     LOAD BOOKINGS
  ======================================================= */

  useEffect(() => {
    let isMounted = true;

    async function loadBookingData() {
      try {
        const [
          bookingsResponse,
          toursResponse,
        ] = await Promise.all([
          listAdminBookings(),
          listAdminTours(),
        ]);

        if (!isMounted) {
          return;
        }

        setBookings(
          bookingsResponse.data.bookings
        );

        setTours(
          toursResponse.data.tours
        );
      } catch (error) {
        toast.error(
          "Unable to load bookings",
          getErrorMessage(error)
        );
      } finally {
        if (isMounted) {
          setIsLoadingBookings(false);
        }
      }
    }

    loadBookingData();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredBookings =
    useMemo(() => {
      const query = searchQuery
        .trim()
        .toLowerCase();

      if (!query) {
        return bookings;
      }

      return bookings.filter(
        (booking) => {
          const guestSearchValues =
            booking.guestDetails.flatMap(
              (guest) => [
                getGuestName(guest),
                guest.email,
                guest.mobileNumber,
                guest.countryCode,
                guest.gender,
                guest.address,
              ]
            );

          return [
            getBookingReference(
              booking
            ),
            booking.id,
            booking.tourId,
            ...guestSearchValues,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      );
    }, [bookings, searchQuery]);

  /* =======================================================
     METRICS
  ======================================================= */

  const bookingMetrics =
    useMemo(
      () =>
        createBookingMetrics(bookings),
      [bookings]
    );

  /* =======================================================
     TOUR MAP
  ======================================================= */

  const tourNameById = useMemo(
    () =>
      new Map(
        tours.map((tour) => [
          tour.tourId,
          tour.tourName,
        ])
      ),
    [tours]
  );

  /* =======================================================
     ROUTING

     Add / View / Edit are now separate inner pages.
  ======================================================= */

  function openAddBookingPage() {
    router.push("/bookings/add");
  }

  function openViewBookingPage(
    booking: AdminBooking
  ) {
    router.push(
      `/bookings/view?bookingId=${encodeURIComponent(
        booking.id
      )}`
    );
  }

  function openEditBookingPage(
    booking: AdminBooking
  ) {
    router.push(
      `/bookings/edit-booking?bookingId=${encodeURIComponent(
        booking.id
      )}`
    );
  }

  function openInvoicePage(
    booking: AdminBooking
  ) {
    router.push(
      `/bookings/invoice?bookingId=${encodeURIComponent(
        booking.id
      )}`
    );
  }

  /* =======================================================
     ARCHIVE
  ======================================================= */

  async function handleArchiveBooking(
    booking: AdminBooking
  ) {
    const primaryGuest =
      booking.guestDetails[0];

    const shouldArchive =
      window.confirm(
        `Archive booking ${getBookingReference(
          booking
        )} for ${getGuestName(
          primaryGuest
        )}?`
      );

    if (!shouldArchive) {
      return;
    }

    setIsArchivingBookingId(
      booking.id
    );

    try {
      const response =
        await archiveAdminBooking(
          booking.id
        );

      setBookings(
        (currentBookings) =>
          currentBookings.filter(
            (currentBooking) =>
              currentBooking.id !==
              booking.id
          )
      );

      toast.success(
        "Booking archived",
        response.message ||
          "Booking archived successfully."
      );
    } catch (error) {
      toast.error(
        "Booking not archived",
        getErrorMessage(error)
      );
    } finally {
      setIsArchivingBookingId(null);
    }
  }

  async function handleCopyRecoveryLink(booking: AdminBooking) {
    if (!booking.recoveryUrl) {
      toast.error("Recovery link unavailable", "This booking does not have a recovery link.");
      return;
    }

    try {
      await navigator.clipboard.writeText(booking.recoveryUrl);
      toast.success("Recovery link copied", "The secure booking recovery link is ready to share.");
    } catch {
      toast.error("Copy failed", "Unable to copy the recovery link from this browser.");
    }
  }

  async function handleSendRecoveryEmail(booking: AdminBooking) {
    setPendingActionBookingId(booking.id);

    try {
      const response = await sendAdminBookingRecoveryEmail(booking.id);

      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === booking.id
            ? response.data.booking
            : currentBooking
        )
      );
      toast.success("Recovery email sent", response.message || "Recovery email sent successfully.");
    } catch (error) {
      toast.error("Recovery email not sent", getErrorMessage(error));
    } finally {
      setPendingActionBookingId(null);
    }
  }

  const [airfareIncludedInTotal, setAirfareIncludedInTotal] = useState(false);

  async function handleAddAirFlightCharges(booking: AdminBooking) {
    setAirfareIncludedInTotal(booking.airfareIncludedInTotal || false);
    setAirFlightDialogBooking(booking);
    setAirFlightChargeAmount(
      booking.airFlightCharges && booking.airFlightCharges > 0
        ? String(Math.round(booking.airFlightCharges))
        : ""
    );
    setAirFlightFinalPaymentUrl("");
  }

  function closeAirFlightDialog() {
    if (isSavingAirFlightCharges || isSendingAirFlightLink) {
      return;
    }

    setAirFlightDialogBooking(null);
    setAirfareIncludedInTotal(false);
    setAirFlightChargeAmount("");
    setAirFlightFinalPaymentUrl("");
  }

  async function submitAirFlightCharges() {
    if (!airFlightDialogBooking) {
      return;
    }

    const amount = Number(airFlightChargeAmount);

    if (!airFlightChargeAmount.trim() || !Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) {
      toast.error("Invalid amount", "Enter a valid air-flight charge amount.");
      return;
    }

    setIsSavingAirFlightCharges(true);
    setPendingActionBookingId(airFlightDialogBooking.id);

    try {
      const response = await updateAdminBookingAirFlightCharges(
        airFlightDialogBooking.id,
        amount,
        airfareIncludedInTotal
      );

      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === airFlightDialogBooking.id
            ? response.data.booking
            : currentBooking
        )
      );
      setAirFlightDialogBooking(response.data.booking);
      setAirfareIncludedInTotal(response.data.booking.airfareIncludedInTotal || false);
      setAirFlightChargeAmount(
        response.data.booking.airFlightCharges &&
          response.data.booking.airFlightCharges > 0
          ? String(Math.round(response.data.booking.airFlightCharges))
          : ""
      );
      setAirFlightFinalPaymentUrl("");

      if (response.data.finalPaymentUrl) {
        toast.success(
          "Air-flight charges added",
          "Use Send to generate a secure Razorpay payment link."
        );
      } else {
        toast.success(
          "Air-flight charges added",
          response.data.booking.airfareIncludedInTotal ? "Airfare is included in the booking total and has not been added again." : response.message || "Charges added to the remaining amount."
        );
      }
    } catch (error) {
      toast.error("Charges not updated", getErrorMessage(error));
    } finally {
      setPendingActionBookingId(null);
      setIsSavingAirFlightCharges(false);
    }
  }

  async function handleCopyAirFlightDialogLink() {
    if (!airFlightFinalPaymentUrl) {
      toast.error(
        "Final payment link unavailable",
        "Send the payment link once to generate the secure Razorpay URL."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(airFlightFinalPaymentUrl);
      toast.success("Final payment link copied", "Share this link with the traveller.");
    } catch {
      toast.error("Copy failed", "Unable to copy the final payment link from this browser.");
    }
  }

  async function handleSendAirFlightDialogLink() {
    if (!airFlightDialogBooking) {
      return;
    }

    setIsSendingAirFlightLink(true);
    setPendingActionBookingId(airFlightDialogBooking.id);

    try {
      const amountRupees = getBookingDueAmount(airFlightDialogBooking);
      const response = await createAdminBookingPaymentLink(
        airFlightDialogBooking.id,
        {
          additionalChargeAlreadyApplied: true,
          amount: amountRupees,
          description: "Air-flight charge payment",
          purpose: "additional",
        }
      );

      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === airFlightDialogBooking.id
            ? response.data.booking
            : currentBooking
        )
      );
      setAirFlightDialogBooking(response.data.booking);
      setAirFlightFinalPaymentUrl(
        response.data.paymentLinkRequest.paymentLinkUrl
      );
      toast[
        response.data.paymentLinkRequest.whatsappStatus === "sent"
          ? "success"
          : "error"
      ](
        response.data.paymentLinkRequest.whatsappStatus === "sent"
          ? "WhatsApp link sent"
          : "WhatsApp link not sent",
        response.message
      );
    } catch (error) {
      toast.error("WhatsApp link not sent", getErrorMessage(error));
    } finally {
      setPendingActionBookingId(null);
      setIsSendingAirFlightLink(false);
    }
  }

  async function handleSendFinalPaymentWhatsapp(booking: AdminBooking) {
    setPendingActionBookingId(booking.id);

    try {
      const response = await sendAdminBookingFinalPaymentWhatsapp(booking.id);

      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === booking.id
            ? response.data.booking
            : currentBooking
        )
      );
      toast.success("WhatsApp link sent", response.message || "Final payment link sent successfully.");
    } catch (error) {
      toast.error("WhatsApp link not sent", getErrorMessage(error));
    } finally {
      setPendingActionBookingId(null);
    }
  }

  function handleCancelPendingBooking(booking: AdminBooking) {
    setCancellationBooking(booking);
  }

  async function submitBookingCancellation(payload: BookingCancellationPayload) {
    if (!cancellationBooking || pendingActionBookingId === cancellationBooking.id) return;
    const booking = cancellationBooking;
    setPendingActionBookingId(booking.id);
    try {
      const response = await cancelAdminBooking(booking.id, payload);
      setBookings((current) => current.map((item) => item.id === booking.id ? response.data.booking : item));
      setCancellationBooking(null);
      const availability = response.data.availability;
      toast.success("Booking cancelled", availability.seatsAvailable === null
        ? response.message
        : `${availability.seatsReleased} seat(s) released. ${availability.seatsAvailable} seat(s) now available.`);
    } catch (error) {
      toast.error("Booking not cancelled", getErrorMessage(error));
    } finally {
      setPendingActionBookingId(null);
    }
  }

  async function handleMarkExpired(booking: AdminBooking) {
    setPendingActionBookingId(booking.id);

    try {
      const response = await expireAdminBooking(booking.id);

      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === booking.id && response.data.booking
            ? response.data.booking
            : currentBooking
        )
      );
      toast.success("Booking expired", response.message || "Booking marked expired.");
    } catch (error) {
      toast.error("Booking not expired", getErrorMessage(error));
    } finally {
      setPendingActionBookingId(null);
    }
  }

  return (
    <>
    {cancellationBooking ? (
      <BookingCancellationDialog
        booking={cancellationBooking}
        isSubmitting={pendingActionBookingId === cancellationBooking.id}
        onClose={() => { if (pendingActionBookingId !== cancellationBooking.id) setCancellationBooking(null); }}
        onSubmit={submitBookingCancellation}
      />
    ) : null}
    <Dialog
      open={Boolean(airFlightDialogBooking)}
      onOpenChange={(open) => {
        if (!open) {
          closeAirFlightDialog();
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[680px] overflow-hidden rounded-[14px] border border-border bg-white p-0 shadow-2xl shadow-stone-950/12 sm:max-w-[680px]" showCloseButton={false}>
        <form
          className="flex max-h-[88vh] min-w-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            submitAirFlightCharges();
          }}
        >
          <DialogHeader className="border-b border-border bg-white px-5 py-6 sm:px-8">
            <DialogTitle className="font-heading text-[26px] font-bold leading-tight text-secondary">
              Add Air-flight Charges
            </DialogTitle>
            <DialogDescription className="mt-1 break-words text-[14px] font-semibold leading-[1.45] text-primary">
              {airFlightDialogBooking
                ? `${getBookingReference(airFlightDialogBooking)} - ${getGuestName(
                    airFlightDialogBooking.guestDetails[0]
                  )} - ${getGuestPhone(airFlightDialogBooking.guestDetails[0])}`
                : "Update the booking air-flight charges."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-w-0 gap-6 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-8">
            <label className="grid gap-2">
              <span className="text-[12px] font-bold uppercase tracking-[0.02em] text-foreground/55">
                Air-flight charges (inclusive of applicable taxes)
              </span>
              <input
                autoFocus
                min={0}
                type="number"
                value={airFlightChargeAmount}
                onChange={(event) =>
                  setAirFlightChargeAmount(event.target.value)
                }
                placeholder="Enter amount"
                className="h-14 w-full min-w-0 rounded-[10px] border border-border bg-white px-5 text-[20px] font-bold text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary focus:ring-3 focus:ring-primary/15"
              />
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={airfareIncludedInTotal}
                onChange={(event) => setAirfareIncludedInTotal(event.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>Airfare is already included in the booking total. Record it separately without adding it again.</span>
            </label>
            {(airFlightDialogBooking?.airfareHistory || []).map((entry, index) => <p key={index} className="text-xs">
              {formatCurrency(entry.previousAmount)} to {formatCurrency(entry.amount)} | {entry.changedBy} | {new Date(entry.changedAt).toLocaleString()}{entry.includedInTotal === undefined ? "" : entry.includedInTotal ? " | Included in total" : " | Additional"}
            </p>)}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 rounded-[10px] border border-border bg-muted/20 px-5 py-4">
                <p className="text-[12px] font-bold text-foreground/55">
                  Current paid amount
                </p>
                <p className="mt-2 text-[18px] font-bold text-secondary">
                  {formatCurrency(airFlightDialogBooking?.amountPaid || 0)}
                </p>
              </div>
              <div className="min-w-0 rounded-[10px] border border-primary/20 bg-primary/5 px-5 py-4">
                <p className="text-[12px] font-bold text-primary/75">
                  Balance due after save
                </p>
                <p className="mt-2 text-[18px] font-bold text-primary">
                  {formatCurrency(
                    airFlightDialogBooking
                      ? Math.max(0, getBookingDueAmount(airFlightDialogBooking)
                        - (airFlightDialogBooking.airfareIncludedInTotal ? 0 : toMoney(airFlightDialogBooking.airFlightCharges))
                        + (airfareIncludedInTotal ? 0 : Number(airFlightChargeAmount) || 0))
                      : 0
                  )}
                </p>
              </div>
            </div>

            {airFlightDialogBooking &&
            canSendAirFlightChargesLink(airFlightDialogBooking) ? (
              <div className="grid min-w-0 gap-4 rounded-[10px] border border-primary/25 bg-primary/5 px-5 py-5">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-[0.02em] text-primary">
                    {airFlightFinalPaymentUrl
                      ? "Payment link ready"
                      : "Payment link can be sent"}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold leading-[1.45] text-foreground/65">
                    {airFlightFinalPaymentUrl
                      ? `Send this link to ${getGuestPhone(
                          airFlightDialogBooking?.guestDetails[0]
                        )} on WhatsApp for the air-flight charge payment.`
                      : "Generate a secure Razorpay payment link and send it by WhatsApp."}
                  </p>
                  <p className="mt-3 break-all rounded-[8px] border border-primary/15 bg-white px-3 py-2 text-[12px] font-semibold leading-relaxed text-foreground/65">
                    {airFlightFinalPaymentUrl ||
                      "Razorpay link will appear here after sending."}
                  </p>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyAirFlightDialogLink}
                    disabled={!airFlightFinalPaymentUrl}
                    className="min-h-10 rounded-sm px-4 py-2 text-xs font-bold"
                  >
                    <Copy className="size-4" />
                    Copy Link
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendAirFlightDialogLink}
                    disabled={isSendingAirFlightLink}
                    className="min-h-10 min-w-0 whitespace-normal rounded-sm px-4 py-2 text-xs font-bold leading-snug"
                  >
                    <Mail className="size-4" />
                    {isSendingAirFlightLink
                      ? "Sending..."
                      : airFlightFinalPaymentUrl
                        ? `Send to ${getGuestPhone(airFlightDialogBooking?.guestDetails[0])}`
                        : "Generate & Send"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[10px] border border-border bg-muted/15 px-4 py-3 text-[12px] font-semibold leading-[1.55] text-foreground/55">
                {airfareIncludedInTotal
                  ? "This airfare is already part of the booking total. It will not be added to the total or outstanding balance again."
                  : "If this booking was already fully paid, saving air-flight charges will create a final payment link here. Otherwise, the charges are added to the existing remaining amount."}
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap rounded-b-[14px] border-t border-border bg-white px-5 py-5 sm:px-8">
            <Button
              type="button"
              variant="outline"
              onClick={closeAirFlightDialog}
              disabled={isSavingAirFlightCharges || isSendingAirFlightLink}
              className="h-11 rounded-sm px-5 text-xs font-bold"
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={isSavingAirFlightCharges}
              className="h-11 rounded-sm px-5 text-xs font-bold"
            >
              {isSavingAirFlightCharges ? "Saving..." : "Save Charges"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AdminDashboardShell
      activeLabel="Booking"
    >
      <div
        className={cn(
          "mx-auto flex w-full",
          "max-w-[1480px]",
          "flex-col gap-5"
        )}
      >
        {/* =============================================== */}
        {/* ACTION ROW */}
        {/* No separate page title/header */}
        {/* =============================================== */}

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            onClick={openAddBookingPage}
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus
              className="size-4"
              data-icon="inline-start"
            />

            Add New Booking
          </Button>
        </section>

        {/* =============================================== */}
        {/* STATISTICS */}
        {/* =============================================== */}

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {bookingMetrics.map(
            (metric) => (
              <BookingMetricCard
                key={metric.label}
                metric={metric}
              />
            )
          )}
        </section>

        {/* =============================================== */}
        {/* BOOKING TABLE */}
        {/* =============================================== */}

        <section
          className={cn(
            "overflow-hidden rounded-sm",
            "border border-border",
            "bg-white",
            "shadow-sm shadow-stone-200/40"
          )}
        >
          <BookingFilters
            searchQuery={searchQuery}
            onSearchQueryChange={
              setSearchQuery
            }
          />

          <BookingTable
            bookings={filteredBookings}
            isArchivingBookingId={
              isArchivingBookingId
            }
            pendingActionBookingId={
              pendingActionBookingId
            }
            isLoading={
              isLoadingBookings
            }
            onArchive={
              handleArchiveBooking
            }
            onAddAirFlightCharges={
              handleAddAirFlightCharges
            }
            onCancelPending={
              handleCancelPendingBooking
            }
            onCopyRecoveryLink={
              handleCopyRecoveryLink
            }
            onEdit={
              openEditBookingPage
            }
            onExpire={
              handleMarkExpired
            }
            onInvoice={
              openInvoicePage
            }
            onSendRecoveryEmail={
              handleSendRecoveryEmail
            }
            onSendFinalPaymentWhatsapp={
              handleSendFinalPaymentWhatsapp
            }
            onView={
              openViewBookingPage
            }
            totalCount={
              bookings.length
            }
            tourNameById={
              tourNameById
            }
          />
        </section>
      </div>
    </AdminDashboardShell>
    </>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function BookingCancellationDialog({
  booking,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  booking: AdminBooking;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: BookingCancellationPayload) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [percentage, setPercentage] = useState("");
  const [requestedBy, setRequestedBy] = useState<BookingCancellationPayload["requestedBy"] | "">("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-sm border border-border bg-white p-5 sm:max-w-xl" showCloseButton={!isSubmitting}>
        <form
          className="grid gap-4"
          data-admin-ignore-save-reminder="true"
          onSubmit={(event) => {
            event.preventDefault();
            if (isSubmitting || !requestedBy || percentage === "" || reason.trim().length < 3) return;
            void onSubmit({ reason: reason.trim(), chargePercentage: Number(percentage), requestedBy, notes: notes.trim() });
          }}
        >
          <DialogHeader className="border-b border-border pb-3 pr-6">
            <DialogTitle className="text-lg font-bold">Cancel Booking</DialogTitle>
            <DialogDescription>{getBookingReference(booking)} - {getGuestName(booking.guestDetails[0])}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 rounded-sm bg-muted/35 p-3 text-xs">
            <div><span className="block text-foreground/55">Departure</span><strong>{booking.departureId || "-"}</strong></div>
            <div><span className="block text-foreground/55">Guests</span><strong>{booking.totalGuest}</strong></div>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold">
            Cancellation reason *
            <textarea required minLength={3} maxLength={1000} value={reason} disabled={isSubmitting} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Enter the reason for cancellation" className="w-full rounded-sm border border-border px-3 py-2 outline-none focus:border-primary" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold">
              Charges applicable per person *
              <select required disabled={isSubmitting} value={percentage} onChange={(event) => setPercentage(event.target.value)} className="h-10 min-w-0 rounded-sm border border-border bg-white px-3 outline-none focus:border-primary">
                <option value="">Select percentage</option>
                {Array.from({ length: 11 }, (_, index) => index * 10).map((value) => <option key={value} value={value}>{value}%</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold">
              Cancellation requested by *
              <select required disabled={isSubmitting} value={requestedBy} onChange={(event) => setRequestedBy(event.target.value as typeof requestedBy)} className="h-10 min-w-0 rounded-sm border border-border bg-white px-3 outline-none focus:border-primary">
                <option value="">Select requester</option>
                {(["Customer", "Admin", "Tour Operator"] as const).map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold">
            Notes (optional)
            <textarea rows={2} maxLength={2000} value={notes} disabled={isSubmitting} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-sm border border-border px-3 py-2 outline-none focus:border-primary" />
          </label>
          <p className="rounded-sm bg-muted/35 p-3 text-xs leading-relaxed text-foreground/70">
            Cancelling releases this booking's reserved seats. No automatic refund is issued.
          </p>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" required disabled={isSubmitting} className="mt-0.5 accent-primary" />
            I confirm that this booking should be cancelled.
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>Keep Booking</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-700 text-white hover:bg-red-800">{isSubmitting ? "Cancelling..." : "Confirm Cancellation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BookingMetricCard({
  metric,
}: {
  metric: BookingMetric;
}) {
  const Icon = metric.icon;

  return (
    <div
      className={cn(
        "rounded-sm",
        "border border-border",
        "bg-white",
        "p-4",
        "shadow-sm shadow-stone-200/40"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            metric.tone
          )}
        >
          <Icon className="size-6" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {metric.label}
          </p>

          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {metric.value}
          </p>

          <p
            className={cn(
              "mt-2 text-[11px] font-semibold",
              metric.descriptionTone
            )}
          >
            {metric.description}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FILTERS

   Same outer padding:
   20px on all sides.
========================================================= */

function BookingFilters({
  searchQuery,
  onSearchQueryChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (
    value: string
  ) => void;
}) {
  return (
    <div className="flex items-center border-b border-border p-5">
      <label className="relative w-full max-w-[360px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />

        <input
          className={cn(
            "h-10 w-full rounded-sm",
            "border border-border",
            "bg-white",
            "pl-9 pr-3",
            "text-xs font-medium",
            "outline-none",
            "transition-colors",
            "placeholder:text-foreground/40",
            "focus:border-primary",
            "focus:ring-3 focus:ring-primary/15"
          )}
          placeholder="Search booking ID, guest, tour..."
          type="search"
          value={searchQuery}
          onChange={(event) =>
            onSearchQueryChange(
              event.target.value
            )
          }
        />
      </label>
    </div>
  );
}

/* =========================================================
   BOOKING TABLE

   IMPORTANT:
   Every TH and TD uses:

   px-5 py-4

   Therefore:
   Left = 20px
   Right = 20px
   Top = 16px
   Bottom = 16px

   Consistent across the whole table.
========================================================= */

function BookingTable({
  bookings,
  isArchivingBookingId,
  isLoading,
  pendingActionBookingId,
  onArchive,
  onAddAirFlightCharges,
  onCancelPending,
  onCopyRecoveryLink,
  onEdit,
  onExpire,
  onInvoice,
  onSendFinalPaymentWhatsapp,
  onSendRecoveryEmail,
  onView,
  totalCount,
  tourNameById,
}: {
  bookings: AdminBooking[];
  isArchivingBookingId:
    | string
    | null;
  isLoading: boolean;
  pendingActionBookingId:
    | string
    | null;
  onArchive: (
    booking: AdminBooking
  ) => void;
  onAddAirFlightCharges: (
    booking: AdminBooking
  ) => void;
  onCancelPending: (
    booking: AdminBooking
  ) => void;
  onCopyRecoveryLink: (
    booking: AdminBooking
  ) => void;
  onEdit: (
    booking: AdminBooking
  ) => void;
  onExpire: (
    booking: AdminBooking
  ) => void;
  onInvoice: (
    booking: AdminBooking
  ) => void;
  onSendFinalPaymentWhatsapp: (
    booking: AdminBooking
  ) => void;
  onSendRecoveryEmail: (
    booking: AdminBooking
  ) => void;
  onView: (
    booking: AdminBooking
  ) => void;
  totalCount: number;
  tourNameById: Map<
    string,
    string
  >;
}) {
  return (
    <>
      <div className="w-full overflow-x-auto">
       <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
  {/* ============================================= */}
  {/* TABLE HEADER */}
  {/* ============================================= */}

  <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
    <tr className="border-b border-border">
      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        ID
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Date
      </th>

      <th className="border-r border-border px-5 py-4 font-bold last:border-r-0">
        Guest Details
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Tour ID
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Paid
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Due
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Status
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Hold Expiry
      </th>

      <th className="whitespace-nowrap border-r border-border px-5 py-4 font-bold last:border-r-0">
        Recovery Expiry
      </th>

      <th className="whitespace-nowrap px-5 py-4 text-right font-bold">
        Actions
      </th>
    </tr>
  </thead>

  {/* ============================================= */}
  {/* TABLE BODY */}
  {/* ============================================= */}

  <tbody>
    {isLoading ? (
      <tr>
        <td
          colSpan={10}
          className="px-5 py-10 text-center text-xs text-foreground/55"
        >
          Loading bookings...
        </td>
      </tr>
    ) : null}

    {!isLoading && bookings.length === 0 ? (
      <tr>
        <td
          colSpan={10}
          className="px-5 py-10 text-center text-xs text-foreground/55"
        >
          No bookings found.
        </td>
      </tr>
    ) : null}

    {!isLoading
      ? bookings.map((booking) => {
          const primaryGuest = booking.guestDetails[0];

          const extraGuestCount = Math.max(
            booking.guestDetails.length - 1,
            0
          );

          const currency = booking.paymentCurrency || "INR";

          const paidAmount = getBookingPaidAmount(booking);

          const dueAmount = getBookingDueAmount(booking);

          const paymentStatus = getPaymentStatus(booking);

          const tourName = tourNameById.get(booking.tourId);

          return (
            <tr
              key={booking.id}
              onClick={(event) => {
                if (shouldOpenTableRow(event)) {
                  onView(booking);
                }
              }}
              className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/20"
            >
              {/* ID */}

              <td
                data-label="ID"
                data-mobile-primary
                className="border-r border-border px-5 py-4 align-middle"
              >
                <button
                  type="button"
                  onClick={() => onView(booking)}
                  className="whitespace-nowrap text-xs font-bold text-primary transition-colors hover:underline"
                >
                  {getBookingReference(booking)}
                </button>
              </td>

              {/* DATE */}

              <td
                data-label="Date"
                className="whitespace-nowrap border-r border-border px-5 py-4 align-middle text-xs font-medium text-foreground/65"
              >
                {formatDate(booking.createdAt)}
              </td>

              {/* GUEST DETAILS */}

              <td
                data-label="Guest Details"
                className="border-r border-border px-5 py-4 align-middle"
              >
                <div className="min-w-0 md:min-w-[210px]">
                  <p className="font-bold text-foreground">
                    {getGuestName(primaryGuest)}
                  </p>

                  <p className="mt-1 text-[11px] text-foreground/50">
                    {primaryGuest
                      ? `${primaryGuest.countryCode} ${primaryGuest.mobileNumber}`
                      : "-"}
                  </p>

                  <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-foreground/50">
                    {primaryGuest?.email || "-"}
                  </p>

                  {extraGuestCount > 0 ? (
                    <p className="mt-1 text-[10px] font-semibold text-primary">
                      +{extraGuestCount} more guest
                      {extraGuestCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              </td>

              {/* TOUR ID */}

              <td
                data-label="Tour ID"
                className="border-r border-border px-5 py-4 align-middle"
              >
                <div className="min-w-0 md:min-w-[130px]">
                  <p className="whitespace-nowrap text-xs font-bold text-foreground">
                    {booking.tourId}
                  </p>

                  {tourName ? (
                    <p className="mt-1 max-w-[180px] truncate text-[10px] text-foreground/50">
                      {tourName}
                    </p>
                  ) : null}
                </div>
              </td>

              {/* PAID */}

              <td
                data-label="Paid"
                className="whitespace-nowrap border-r border-border px-5 py-4 align-middle"
              >
                <span className="text-xs font-bold text-emerald-600">
                  {formatCurrency(paidAmount, currency)}
                </span>
              </td>

              {/* DUE */}

              <td
                data-label="Due"
                className="whitespace-nowrap border-r border-border px-5 py-4 align-middle"
              >
                <span
                  className={cn(
                    "text-xs font-bold",
                    dueAmount > 0
                      ? "text-amber-600"
                      : "text-foreground/45"
                  )}
                >
                  {formatCurrency(dueAmount, currency)}
                </span>
              </td>

              {/* STATUS */}

              <td
                data-label="Status"
                className="border-r border-border px-5 py-4 align-middle"
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1",
                    "text-[10px] font-bold",
                    paymentStatus.tone
                  )}
                >
                  {paymentStatus.label}
                </span>
              </td>

              <td
                data-label="Hold Expiry"
                className="whitespace-nowrap border-r border-border px-5 py-4 align-middle text-xs font-medium text-foreground/65"
              >
                {booking.holdExpiresAt ? formatDate(booking.holdExpiresAt) : "-"}
              </td>

              <td
                data-label="Recovery Expiry"
                className="whitespace-nowrap border-r border-border px-5 py-4 align-middle text-xs font-medium text-foreground/65"
              >
                {booking.recoveryExpiresAt ? formatDate(booking.recoveryExpiresAt) : "-"}
              </td>

              {/* ACTIONS */}

              <td
                data-actions
                data-label="Actions"
                className="px-5 py-4 align-middle"
              >
                <BookingActionsMenu
                  booking={booking}
                  isArchiving={
                    isArchivingBookingId === booking.id
                  }
                  isPendingAction={
                    pendingActionBookingId === booking.id
                  }
                  onArchive={onArchive}
                  onAddAirFlightCharges={onAddAirFlightCharges}
                  onCancelPending={onCancelPending}
                  onCopyRecoveryLink={onCopyRecoveryLink}
                  onEdit={onEdit}
                  onExpire={onExpire}
                  onInvoice={onInvoice}
                  onSendFinalPaymentWhatsapp={onSendFinalPaymentWhatsapp}
                  onSendRecoveryEmail={onSendRecoveryEmail}
                  onView={onView}
                />
              </td>
            </tr>
          );
        })
      : null}
  </tbody>
</table>
      </div>

      {/* =============================================== */}
      {/* TABLE FOOTER */}
      {/* Same left/right padding as table */}
      {/* =============================================== */}

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-foreground/55">
          Showing{" "}
          {bookings.length
            ? `1 to ${bookings.length}`
            : "0"}{" "}
          of {totalCount} bookings
        </p>

        <div className="flex items-center gap-2">
          <PaginationButton
            label="Previous"
            disabled
          >
            <ChevronDown className="size-4 rotate-90" />
          </PaginationButton>

          <PaginationButton
            label="Page 1"
            active
          >
            1
          </PaginationButton>

          <PaginationButton
            label="Next"
            disabled
          >
            <ChevronDown className="size-4 -rotate-90" />
          </PaginationButton>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   ACTION MENU

   Delete completely removed.
   Archive added instead.

   View/Edit navigate to inner pages.
========================================================= */

function BookingActionsMenu({
  booking,
  isArchiving,
  isPendingAction,
  onArchive,
  onAddAirFlightCharges,
  onCancelPending,
  onCopyRecoveryLink,
  onEdit,
  onExpire,
  onInvoice,
  onSendFinalPaymentWhatsapp,
  onSendRecoveryEmail,
  onView,
}: {
  booking: AdminBooking;
  isArchiving: boolean;
  isPendingAction: boolean;
  onArchive: (
    booking: AdminBooking
  ) => void;
  onAddAirFlightCharges: (
    booking: AdminBooking
  ) => void;
  onCancelPending: (
    booking: AdminBooking
  ) => void;
  onCopyRecoveryLink: (
    booking: AdminBooking
  ) => void;
  onEdit: (
    booking: AdminBooking
  ) => void;
  onExpire: (
    booking: AdminBooking
  ) => void;
  onInvoice: (
    booking: AdminBooking
  ) => void;
  onSendFinalPaymentWhatsapp: (
    booking: AdminBooking
  ) => void;
  onSendRecoveryEmail: (
    booking: AdminBooking
  ) => void;
  onView: (
    booking: AdminBooking
  ) => void;
}) {
  const primaryGuest =
    booking.guestDetails[0];
  const canViewInvoice =
    getPaymentStatus(booking).label === "Paid" &&
    getBookingDueAmount(booking) <= 0;
  const isRecoverable =
    booking.bookingStatus === "payment_pending" &&
    booking.paymentStatus !== "paid" &&
    Boolean(booking.recoveryUrl);
  const canSendChargesLink =
    canSendAirFlightChargesLink(booking);
  const canAddAirFlightCharges =
    booking.airfareExcluded === true &&
    ((booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid") ||
      (booking.paymentMode === "offline" && booking.bookingStatus === "payment_pending" && booking.paymentStatus === "pending")) &&
    !isPendingAction &&
    !(toMoney(booking.airFlightCharges) > 0 && getBookingDueAmount(booking) === 0);
  const canUseRecoveryActions =
    isRecoverable &&
    !isPendingAction;
  const canCancelBooking =
    booking.bookingStatus !== "cancelled" &&
    booking.bookingStatus !== "expired" &&
    !isPendingAction;
  const canArchive =
    !isArchiving;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "grid size-9 place-items-center rounded-full",
                "border border-border",
                "bg-white",
                "text-foreground/65",
                "transition-colors",
                "hover:border-primary",
                "hover:text-primary",
                "disabled:pointer-events-none",
                "disabled:opacity-50"
              )}
              aria-label={`Open actions for ${getGuestName(
                primaryGuest
              )}`}
              disabled={
                isArchiving || isPendingAction
              }
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          {booking.hasBankTransfer || booking.paymentMode === "bank_transfer" || booking.paymentMethod === "bank_transfer" ? (
          <DropdownMenuItem
            render={<a href={"/bookings/bank-transfer/?bookingId=" + encodeURIComponent(booking.id)} />}
            className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
          >
            <WalletCards className="size-4 text-primary" />
            Bank Transfer
          </DropdownMenuItem>
          ) : null}
          {/* View */}

          <DropdownMenuItem
            onClick={() =>
              onView(booking)
            }
            className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />

            View
          </DropdownMenuItem>

          {canViewInvoice ? (
            <DropdownMenuItem
              onClick={() =>
                onInvoice(booking)
              }
              className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
            >
              <FileText className="size-4 text-primary" />

              View Invoice
            </DropdownMenuItem>
          ) : null}

          {/* Edit */}

          <DropdownMenuItem
            onClick={() =>
              onEdit(booking)
            }
            className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />

            Edit
          </DropdownMenuItem>

          {canAddAirFlightCharges ? (
            <DropdownMenuItem
              onClick={() =>
                onAddAirFlightCharges(booking)
              }
              className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
            >
              <Ticket className="size-4 text-primary" />

              Add Air-flight Charges
            </DropdownMenuItem>
          ) : null}

          {canSendChargesLink && !isPendingAction ? (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() =>
                  onSendFinalPaymentWhatsapp(booking)
                }
                className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
              >
                <Mail className="size-4 text-primary" />

                Send Charges Link
              </DropdownMenuItem>
            </>
          ) : null}

          {canUseRecoveryActions ? (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() =>
                  onCopyRecoveryLink(booking)
                }
                className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
              >
                <Copy className="size-4 text-primary" />

                Copy Recovery Link
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() =>
                  onSendRecoveryEmail(booking)
                }
                className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
              >
                <Mail className="size-4 text-primary" />

                Send Recovery Email
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() =>
                  onExpire(booking)
                }
                className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold"
              >
                <Hourglass className="size-4 text-amber-700" />

                Mark Expired
              </DropdownMenuItem>

            </>
          ) : null}

          {canCancelBooking ? (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() =>
                  onCancelPending(booking)
                }
                className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold text-red-700 focus:bg-red-50 focus:text-red-700"
              >
                <Ban className="size-4" />

                Cancel Booking
              </DropdownMenuItem>
            </>
          ) : null}

          {/* Archive */}

          {canArchive ? (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() =>
                  onArchive(
                    booking
                  )
                }
                className="cursor-pointer rounded-sm px-2.5 py-2 text-xs font-semibold text-amber-700 focus:bg-amber-50 focus:text-amber-700"
              >
                <Archive className="size-4" />

                Archive
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* =========================================================
   PAGINATION
========================================================= */

function PaginationButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-sm",
        "border border-border",
        "bg-white",
        "text-xs font-bold",
        "text-foreground/60",
        "transition-colors",
        "hover:border-primary",
        "hover:text-primary",
        "disabled:pointer-events-none",
        "disabled:opacity-45",

        active &&
          "border-primary bg-primary text-white hover:text-white"
      )}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}
