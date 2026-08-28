"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Hotel,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { clearTravellerSession } from "@/lib/auth";
import {
  createBookingBalancePaymentOrder,
  verifyBookingBalancePayment,
  type BookingPaymentOrder,
  type BookingConfirmation,
} from "@/lib/booking-payment";
import { getHomeMediaUrl } from "@/lib/home-travel";
import { getTourHref } from "@/lib/routes";
import {
  getUserBookingDuration,
  getUserBookingImageSource,
  getUserBookingLocation,
  getUserBookingReference,
  getUserBookingTitle,
  getUserBookingTravellerLabel,
  listTravellerBookings,
  type UserBooking,
} from "@/lib/user-bookings";
import { cn } from "@/lib/utils";

type UserBookingDetailPageProps = {
  bookingId: string;
};

type BalanceCheckoutStatus = "idle" | "creating" | "gateway_open" | "verifying";

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
  modal?: {
    ondismiss?: () => void;
  };
  name: string;
  order_id: string;
  prefill: {
    contact: string;
    email: string;
    name: string;
  };
  theme?: {
    color: string;
  };
};

type RazorpayWindow = Window & {
  Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
};

let razorpayCheckoutScriptPromise: Promise<void> | null = null;

type TimelineItem = {
  date: string;
  done: boolean;
  title: string;
};

type DisplayTraveller = {
  ageOnDeparture?: number;
  firstName?: string;
  id: string;
  lastName?: string;
  title?: string;
  type: "adult" | "child";
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null, fallback = "Not set") {
  const date = parseDate(value);

  return date ? dateFormatter.format(date).replace(",", "") : fallback;
}

function formatCurrency(amount?: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Math.max(0, Math.round(amount || 0)));
}

function loadRazorpayCheckoutScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is available in browser only"));
  }

  if ((window as RazorpayWindow).Razorpay) {
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

    script.async = true;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayCheckoutScriptPromise = null;
      reject(new Error("Razorpay checkout could not be loaded"));
    };

    document.body.appendChild(script);
  });

  return razorpayCheckoutScriptPromise;
}

function getTotalAmount(booking: UserBooking) {
  return (
    booking.booking.grandTotal ||
    booking.booking.amountPaid ||
    booking.booking.depositAmount ||
    0
  );
}

function getPaidAmount(booking: UserBooking) {
  return booking.booking.amountPaid || booking.booking.depositAmount || 0;
}

function getBalanceAmount(booking: UserBooking) {
  if (typeof booking.booking.balanceAmount === "number") {
    return booking.booking.balanceAmount;
  }

  return Math.max(0, getTotalAmount(booking) - getPaidAmount(booking));
}

function getGuestName(guest?: {
  firstName?: string;
  lastName?: string;
  title?: string;
}) {
  return [guest?.title, guest?.firstName, guest?.lastName]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function getTourDetailHref(booking: UserBooking) {
  return booking.tour
    ? getTourHref(booking.tour)
    : `/tours/${encodeURIComponent(booking.booking.tourId)}`;
}

function matchesBookingId(booking: UserBooking, bookingId: string) {
  const normalizedId = decodeURIComponent(bookingId).trim().toLowerCase();
  const bookingReference = getUserBookingReference(booking).toLowerCase();

  return (
    booking.booking.id.toLowerCase() === normalizedId ||
    bookingReference === normalizedId ||
    bookingReference.replace("atb-", "") === normalizedId.replace("atb-", "")
  );
}

function replaceBooking(
  bookings: UserBooking[],
  updatedBooking: BookingConfirmation
) {
  return bookings.map((item) =>
    item.booking.id === updatedBooking.id
      ? {
          ...item,
          booking: updatedBooking,
        }
      : item
  );
}

function getPaymentErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 401) {
    clearTravellerSession();
    return "Please sign in again to continue.";
  }

  return error instanceof Error
    ? error.message
    : "Payment could not be completed. Please try again.";
}

function DetailShell({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-border bg-white shadow-[0_14px_34px_rgba(50,50,50,0.035)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="size-4 text-primary" strokeWidth={1.8} />
        <h2 className="font-heading text-[17px] font-bold leading-tight text-secondary">
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TourMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <span className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-secondary/55" strokeWidth={1.8} />
      <span className="min-w-0">
        <span className="block font-sans text-[10px] font-bold uppercase leading-none text-primary">
          {label}
        </span>
        <strong className="mt-1 block font-sans text-[12px] font-bold leading-tight text-secondary sm:text-[13px]">
          {value}
        </strong>
      </span>
    </span>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="font-sans text-[12px] font-semibold text-secondary/60">
        {label}
      </span>
      <strong
        className={cn(
          "max-w-[62%] text-right font-sans text-[13px] font-bold leading-tight text-secondary",
          valueClassName
        )}
      >
        {value}
      </strong>
    </div>
  );
}

function PaymentSummaryCard({
  booking,
  checkoutStatus,
  onPayBalance,
  paymentFeedback,
}: {
  booking: UserBooking;
  checkoutStatus: BalanceCheckoutStatus;
  onPayBalance: () => void;
  paymentFeedback: string;
}) {
  const currency = booking.booking.paymentCurrency || "INR";
  const totalAmount = getTotalAmount(booking);
  const paidAmount = getPaidAmount(booking);
  const balanceAmount = getBalanceAmount(booking);
  const hasBalance = balanceAmount > 0;
  const isBusy = checkoutStatus !== "idle";
  const buttonLabel =
    checkoutStatus === "creating"
      ? "Opening Payment..."
      : checkoutStatus === "gateway_open"
        ? "Complete Payment..."
        : checkoutStatus === "verifying"
          ? "Confirming Payment..."
          : hasBalance
            ? `Pay Balance ${formatCurrency(balanceAmount, currency)}`
            : "Payment Complete";

  return (
    <article className="overflow-hidden rounded-[8px] border border-primary/20 bg-white shadow-[0_18px_44px_rgba(67,43,27,0.1)]">
      <div className="bg-accent px-4 py-4 text-white">
        <h2 className="font-heading text-[18px] font-bold leading-tight">
          Payment Summary
        </h2>
        <p className="mt-1 font-sans text-[11px] font-semibold text-white/82">
          Booking {getUserBookingReference(booking)}
        </p>
      </div>
      <div className="px-4 py-3">
        <SummaryRow label="Total Booking Amount" value={formatCurrency(totalAmount, currency)} />
        <SummaryRow
          label="Amount Paid"
          value={formatCurrency(paidAmount, currency)}
          valueClassName="text-emerald-700"
        />
        <SummaryRow
          label="Balance Amount"
          value={formatCurrency(balanceAmount, currency)}
          valueClassName={hasBalance ? "text-primary text-[18px]" : "text-emerald-700"}
        />
        <SummaryRow
          label="Balance Due Date"
          value={
            hasBalance
              ? formatDate(booking.booking.balanceDueDate)
              : "Paid in full"
          }
        />
        <Button
          type="button"
          disabled={!hasBalance || isBusy}
          onClick={onPayBalance}
          className="mt-3 h-11 w-full rounded-[7px] text-[13px] font-bold"
        >
          {buttonLabel}
        </Button>
        {paymentFeedback ? (
          <p className="mt-3 rounded-[7px] border border-primary/15 bg-primary/5 px-3 py-2 text-center font-sans text-[11px] font-bold leading-[1.45] text-secondary/68">
            {paymentFeedback}
          </p>
        ) : null}
        <p className="mt-3 flex items-center justify-center gap-1.5 font-sans text-[11px] font-semibold text-secondary/55">
          <ShieldCheck className="size-3.5 text-secondary/45" strokeWidth={1.8} />
          Secure payments - Ancient Trails
        </p>
      </div>
    </article>
  );
}

function Timeline({ booking }: { booking: UserBooking }) {
  const balanceAmount = getBalanceAmount(booking);
  const departureDate =
    booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate;
  const timeline: TimelineItem[] = [
    {
      date: formatDate(booking.booking.createdAt),
      done: true,
      title: "Booking Created",
    },
    {
      date: formatDate(booking.booking.paymentCapturedAt || booking.booking.createdAt),
      done: Boolean(booking.booking.amountPaid),
      title: "Initial Payment Received",
    },
    {
      date: formatDate(booking.booking.paymentCapturedAt || booking.booking.updatedAt),
      done: booking.booking.paymentStatus === "paid",
      title: "Booking Confirmed",
    },
    {
      date: balanceAmount > 0 ? `Due ${formatDate(booking.booking.balanceDueDate)}` : "Paid in full",
      done: balanceAmount <= 0,
      title: "Balance Payment",
    },
    {
      date: balanceAmount > 0 ? "After final payment" : "Ready",
      done: balanceAmount <= 0,
      title: "Final Payment Receipt",
    },
    {
      date: formatDate(departureDate),
      done: false,
      title: "Tour Departure",
    },
  ];

  return (
    <DetailShell icon={Clock3} title="Booking Timeline">
      <div className="relative ml-1 grid gap-0 before:absolute before:bottom-5 before:left-[9px] before:top-3 before:w-px before:bg-border">
        {timeline.map((item) => (
          <div key={item.title} className="relative flex gap-3 pb-5 last:pb-0">
            <span
              className={cn(
                "relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white",
                item.done ? "text-primary" : "text-secondary/35"
              )}
            >
              {item.done ? (
                <CheckCircle2 className="size-5 fill-primary text-white" strokeWidth={2.2} />
              ) : (
                <CircleDot className="size-5" strokeWidth={1.8} />
              )}
            </span>
            <span className="min-w-0">
              <strong className="block font-sans text-[12px] font-bold leading-tight text-secondary">
                {item.title}
              </strong>
              <span className="mt-1 block font-sans text-[11px] font-semibold leading-tight text-secondary/55">
                {item.date}
              </span>
            </span>
          </div>
        ))}
      </div>
    </DetailShell>
  );
}

function HelpCard() {
  return (
    <article className="rounded-[8px] border border-primary/15 bg-primary/5 p-4 shadow-[0_12px_28px_rgba(67,43,27,0.05)]">
      <h2 className="font-heading text-[16px] font-bold leading-tight text-secondary">
        Need help with your booking?
      </h2>
      <p className="mt-1.5 font-sans text-[12px] font-medium leading-[1.55] text-secondary/65">
        Contact the Ancient Trails team for assistance.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="tel:01143033003"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-border bg-white font-sans text-[12px] font-bold text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          <Phone className="size-3.5" strokeWidth={1.8} />
          Call Us
        </Link>
        <Link
          href="mailto:Holidays@ancient.com"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-border bg-white font-sans text-[12px] font-bold text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          <Mail className="size-3.5" strokeWidth={1.8} />
          Email Us
        </Link>
      </div>
    </article>
  );
}

function TravellerDetails({ booking }: { booking: UserBooking }) {
  const travellers: DisplayTraveller[] =
    booking.booking.travellers.length > 0
      ? booking.booking.travellers
      : booking.booking.guestDetails.map((guest, index) => ({
          ...guest,
          ageOnDeparture: undefined,
          id: `guest-${index + 1}`,
          type:
            index < booking.booking.adultCount
              ? ("adult" as const)
              : ("child" as const),
        }));

  return (
    <DetailShell icon={UsersRound} title="Traveller Details">
      <div className="grid gap-2">
        {travellers.map((traveller, index) => {
          const travellerType = traveller.type === "child" ? "Child" : "Adult";
          const guestName = getGuestName(traveller) || `Traveller ${index + 1}`;
          const roomLabel =
            booking.booking.pricingSnapshot?.accommodation?.optionTitle ||
            "Room allocation selected";

          return (
            <article
              key={traveller.id || `${guestName}-${index}`}
              className="flex min-w-0 items-center gap-3 rounded-[7px] border border-border bg-background px-3 py-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 font-sans text-[12px] font-bold text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate font-sans text-[13px] font-bold leading-tight text-secondary">
                  {guestName}
                </strong>
                <span className="mt-1 block truncate font-sans text-[11px] font-semibold leading-tight text-secondary/55">
                  {traveller.ageOnDeparture ? `${traveller.ageOnDeparture} yrs - ` : ""}
                  {roomLabel}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-primary/25 bg-white px-2.5 py-1 font-sans text-[10px] font-bold text-primary">
                {travellerType}
              </span>
            </article>
          );
        })}
      </div>
    </DetailShell>
  );
}

function AccommodationDetails({ booking }: { booking: UserBooking }) {
  const rooms = booking.booking.pricingSnapshot?.accommodation?.rooms || [];

  return (
    <DetailShell icon={Hotel} title="Accommodation Details">
      {rooms.length > 0 ? (
        <div className="grid gap-3">
          {rooms.map((room) => (
            <article
              key={room.id}
              className="rounded-[7px] border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <strong className="font-sans text-[13px] font-bold text-secondary">
                  {room.title}
                </strong>
                <span className="rounded-full border border-border bg-white px-2.5 py-1 font-sans text-[10px] font-bold text-secondary/60">
                  {room.bedSummary || "Selected room"}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {(room.allocations || []).map((allocation) => (
                  <span
                    key={`${room.id}-${allocation.label}`}
                    className="flex items-center justify-between gap-3 font-sans text-[12px] font-semibold text-secondary/70"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{allocation.label}</span>
                    </span>
                    <strong className="shrink-0 text-secondary">
                      {formatCurrency(
                        allocation.price,
                        booking.booking.paymentCurrency || "INR"
                      )}
                    </strong>
                  </span>
                ))}
              </div>
            </article>
          ))}
          <p className="font-sans text-[11px] font-semibold leading-[1.5] text-secondary/50">
            Occupancy shown as selected during booking. Changes require assistance
            from our team.
          </p>
        </div>
      ) : (
        <p className="font-sans text-[13px] font-semibold leading-[1.6] text-secondary/60">
          Accommodation details will be shared by the Ancient Trails team.
        </p>
      )}
    </DetailShell>
  );
}

function PaymentHistory({ booking }: { booking: UserBooking }) {
  const paidAmount = getPaidAmount(booking);
  const currency = booking.booking.paymentCurrency || "INR";

  return (
    <DetailShell icon={WalletCards} title="Payment History">
      {paidAmount > 0 ? (
        <article className="flex flex-col gap-2 rounded-[7px] border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <strong className="block font-sans text-[13px] font-bold text-secondary">
              {formatCurrency(paidAmount, currency)}
              <span className="font-medium text-secondary/55">
                {" "}
                - {formatDate(booking.booking.paymentCapturedAt || booking.booking.createdAt)}
              </span>
            </strong>
            <span className="mt-1 block truncate font-sans text-[11px] font-semibold text-secondary/55">
              {booking.booking.paymentId || booking.booking.paymentOrderId || "Payment reference saved"}
            </span>
          </span>
          <span className="inline-flex h-7 w-fit items-center rounded-full bg-emerald-50 px-3 font-sans text-[11px] font-bold text-emerald-700">
            Successful
          </span>
        </article>
      ) : (
        <p className="font-sans text-[13px] font-semibold leading-[1.6] text-secondary/60">
          No successful payment has been recorded for this booking.
        </p>
      )}
    </DetailShell>
  );
}

function BookingDocuments({ booking }: { booking: UserBooking }) {
  const balanceAmount = getBalanceAmount(booking);

  return (
    <DetailShell icon={FileText} title="Booking Documents">
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[7px] border border-border bg-background p-3">
          <h3 className="font-sans text-[13px] font-bold text-secondary">
            Booking Invoice
          </h3>
          <p className="mt-1 font-sans text-[11px] font-semibold text-secondary/55">
            Issued {formatDate(booking.booking.createdAt)}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled
            className="mt-4 h-9 w-full gap-2 rounded-[6px] text-[11px] font-bold"
          >
            <Eye className="size-3.5" strokeWidth={1.8} />
            View / Download Invoice
          </Button>
        </article>
        <article className="rounded-[7px] border border-border bg-background p-3">
          <h3 className="font-sans text-[13px] font-bold text-secondary">
            Final Payment Receipt
          </h3>
          <p className="mt-1 font-sans text-[11px] font-semibold text-secondary/55">
            {balanceAmount > 0
              ? "Available after final payment"
              : "Available for confirmed payment"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled
            className="mt-4 h-9 w-full gap-2 rounded-[6px] text-[11px] font-bold"
          >
            <Download className="size-3.5" strokeWidth={1.8} />
            Download Receipt
          </Button>
        </article>
      </div>
    </DetailShell>
  );
}

function TourSummary({ booking }: { booking: UserBooking }) {
  const departureDate =
    booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate;
  const returnDate =
    booking.departure?.returnDate || booking.booking.pricingSnapshot?.returnDate;

  return (
    <section className="overflow-hidden rounded-[8px] border border-border bg-white shadow-[0_18px_42px_rgba(65,43,26,0.07)]">
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="relative min-h-[220px] bg-muted md:min-h-[260px]">
          <Image
            src={getHomeMediaUrl(getUserBookingImageSource(booking))}
            alt={`${getUserBookingTitle(booking)} booking`}
            fill
            sizes="(min-width: 1024px) 260px, 100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="p-4 sm:p-5">
          <p className="flex items-center gap-2 font-sans text-[11px] font-bold uppercase leading-none text-primary">
            <ReceiptText className="size-3.5" strokeWidth={1.8} />
            Tour Summary
          </p>
          <h1 className="mt-3 max-w-[620px] font-heading text-[25px] font-bold leading-tight text-secondary sm:text-[30px]">
            {getUserBookingTitle(booking)}
          </h1>
          <p className="mt-2 font-sans text-[13px] font-semibold leading-[1.6] text-secondary/62">
            {getUserBookingLocation(booking)}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TourMeta icon={CalendarDays} label="Departure" value={formatDate(departureDate)} />
            <TourMeta icon={CalendarCheck} label="Return" value={formatDate(returnDate)} />
            <TourMeta icon={Clock3} label="Duration" value={getUserBookingDuration(booking)} />
            <TourMeta
              icon={UsersRound}
              label="Travellers"
              value={getUserBookingTravellerLabel(booking)}
            />
          </div>
          <Link
            href={getTourDetailHref(booking)}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-[7px] bg-primary px-5 font-sans text-[12px] font-bold text-white transition-colors hover:bg-accent"
          >
            View Tour Details
          </Link>
        </div>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="rounded-[8px] border border-border bg-white px-4 py-12 text-center shadow-[0_14px_34px_rgba(50,50,50,0.035)]">
      <Clock3 className="mx-auto size-9 text-primary" strokeWidth={1.8} />
      <p className="mt-3 font-sans text-[13px] font-bold text-secondary">
        Loading booking details...
      </p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-[8px] border border-primary/20 bg-white px-4 py-12 text-center shadow-[0_14px_34px_rgba(50,50,50,0.035)]">
      <HelpCircle className="mx-auto size-10 text-primary" strokeWidth={1.7} />
      <h1 className="mt-3 font-heading text-[24px] font-bold text-secondary">
        Booking details unavailable
      </h1>
      <p className="mx-auto mt-2 max-w-[520px] font-sans text-[13px] font-semibold leading-[1.6] text-secondary/62">
        {message}
      </p>
      <Link
        href="/me/bookings"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 font-sans text-[13px] font-bold text-white transition-colors hover:bg-accent"
      >
        Back to My Bookings
      </Link>
    </section>
  );
}

export function UserBookingDetailPage({ bookingId }: UserBookingDetailPageProps) {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [checkoutStatus, setCheckoutStatus] =
    useState<BalanceCheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentFeedback, setPaymentFeedback] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await listTravellerBookings();

        if (isMounted) {
          setBookings(response.data.bookings);
        }
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          clearTravellerSession();
          return;
        }

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "This booking could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, []);

  const booking = useMemo(
    () => bookings.find((item) => matchesBookingId(item, bookingId)) || null,
    [bookingId, bookings]
  );

  async function openBalanceRazorpayCheckout(
    order: BookingPaymentOrder,
    selectedBooking: UserBooking
  ) {
    await loadRazorpayCheckoutScript();

    const razorpayWindow = window as RazorpayWindow;

    if (!razorpayWindow.Razorpay) {
      throw new Error("Razorpay checkout could not be opened");
    }

    let isVerifying = false;
    const checkout = new razorpayWindow.Razorpay({
      amount: order.checkout.amount,
      currency: order.checkout.currency,
      description: order.checkout.description,
      handler: (paymentResponse) => {
        isVerifying = true;
        setCheckoutStatus("verifying");
        setPaymentFeedback("Confirming your balance payment...");

        verifyBookingBalancePayment(selectedBooking.booking.id, paymentResponse)
          .then((response) => {
            setBookings((current) =>
              replaceBooking(current, response.data.booking)
            );
            setPaymentFeedback("Balance payment confirmed successfully.");
          })
          .catch((error: unknown) => {
            setPaymentFeedback(getPaymentErrorMessage(error));
          })
          .finally(() => {
            setCheckoutStatus("idle");
          });
      },
      key: order.checkout.key,
      modal: {
        ondismiss: () => {
          if (!isVerifying) {
            setCheckoutStatus("idle");
            setPaymentFeedback("Payment window closed before completion.");
          }
        },
      },
      name: order.checkout.name,
      order_id: order.checkout.orderId,
      prefill: order.checkout.prefill,
      theme: {
        color: "#d47220",
      },
    });

    checkout.on("payment.failed", (failureResponse) => {
      setCheckoutStatus("idle");
      setPaymentFeedback(
        failureResponse.error?.description ||
          failureResponse.error?.reason ||
          "Payment failed. Please try again."
      );
    });

    setCheckoutStatus("gateway_open");
    checkout.open();
  }

  async function handlePayBalance() {
    if (!booking || checkoutStatus !== "idle" || getBalanceAmount(booking) <= 0) {
      return;
    }

    setCheckoutStatus("creating");
    setPaymentFeedback("");

    try {
      const response = await createBookingBalancePaymentOrder(booking.booking.id);

      await openBalanceRazorpayCheckout(response.data, booking);
    } catch (error) {
      setCheckoutStatus("idle");
      setPaymentFeedback(getPaymentErrorMessage(error));
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (errorMessage) {
    return <ErrorState message={errorMessage} />;
  }

  if (!booking) {
    return <ErrorState message="We could not find this booking in your account." />;
  }

  return (
    <div>
      <div className="mb-4">
        <p className="font-sans text-[12px] font-bold uppercase tracking-normal text-primary">
          Booking ID: {getUserBookingReference(booking)}
        </p>
        <p className="mt-2 font-sans text-[13px] font-medium leading-[1.6] text-secondary/64">
          Manage your booking, payments and travel information from here.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-5">
          <TourSummary booking={booking} />
          <TravellerDetails booking={booking} />
          <AccommodationDetails booking={booking} />
          <PaymentHistory booking={booking} />
          <BookingDocuments booking={booking} />
        </div>

        <aside className="grid h-fit gap-5 lg:sticky lg:top-5 lg:self-start">
          <PaymentSummaryCard
            booking={booking}
            checkoutStatus={checkoutStatus}
            onPayBalance={handlePayBalance}
            paymentFeedback={paymentFeedback}
          />
          <Timeline booking={booking} />
          <HelpCard />
        </aside>
      </div>
    </div>
  );
}
