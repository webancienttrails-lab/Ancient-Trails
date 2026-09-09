"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  CreditCard,
  Download,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  listAdminBookings,
  type AdminBooking,
  type BookingAccommodationOption,
  type BookingGuestDetails,
} from "@/lib/bookings";
import { listAdminDestinations, type AdminDestination } from "@/lib/destinations";
import {
  listAdminTourDepartures,
  listAdminTours,
  type AdminTour,
  type AdminTourDeparture,
} from "@/lib/tours";
import { cn } from "@/lib/utils";

type InvoiceLineItem = {
  amount: number;
  description: string;
  quantity: number;
  rate: number;
};

const invoiceDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const invoiceExportStyles = `
  .admin-invoice-sheet,
  .admin-invoice-sheet * {
    border-color: #e8ded6 !important;
    box-shadow: none !important;
    color: #18314f !important;
    outline-color: transparent !important;
    text-shadow: none !important;
  }

  .admin-invoice-sheet {
    background: #ffffff !important;
  }

  .admin-invoice-sheet .text-primary,
  .admin-invoice-sheet [class*="text-primary"] {
    color: #d47220 !important;
  }

  .admin-invoice-sheet .text-slate-950,
  .admin-invoice-sheet [class*="text-slate-950"],
  .admin-invoice-sheet .text-slate-900,
  .admin-invoice-sheet [class*="text-slate-900"] {
    color: #0f172a !important;
  }

  .admin-invoice-sheet .text-slate-700,
  .admin-invoice-sheet [class*="text-slate-700"] {
    color: #334155 !important;
  }

  .admin-invoice-sheet .text-emerald-800,
  .admin-invoice-sheet [class*="text-emerald-800"] {
    color: #166534 !important;
  }

  .admin-invoice-sheet .bg-white,
  .admin-invoice-sheet [class*="bg-white"] {
    background-color: #ffffff !important;
  }

  .admin-invoice-sheet [class*="bg-primary/5"] {
    background-color: #fdf5ed !important;
  }

  .admin-invoice-sheet [class*="bg-primary/8"],
  .admin-invoice-sheet [class*="bg-primary/10"] {
    background-color: #fbeee2 !important;
  }

  .admin-invoice-sheet .bg-emerald-100,
  .admin-invoice-sheet [class*="bg-emerald-100"] {
    background-color: #dcfce7 !important;
  }
`;

function toMoney(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(Number(value)));
}

function formatCurrency(value: number, currency = "INR"): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(toMoney(value));

  return formatted.replace(/^₹/, "₹ ");
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return invoiceDateFormatter.format(date).replace(",", "");
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${formatDate(value)}, ${date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getGuestName(guest?: BookingGuestDetails): string {
  if (!guest) {
    return "-";
  }

  return [guest.title, guest.firstName, guest.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ") || "-";
}

function getBookingTotalAmount(booking: AdminBooking): number {
  const grandTotal = toMoney(booking.grandTotal);

  if (grandTotal > 0) {
    return grandTotal;
  }

  return toMoney(booking.subtotal) + toMoney(booking.gstAmount);
}

function getBookingPaidAmount(booking: AdminBooking): number {
  const totalAmount = getBookingTotalAmount(booking);

  if (booking.paymentOption === "full" && totalAmount > 0) {
    return totalAmount;
  }

  const amountPaid = toMoney(booking.amountPaid);

  if (amountPaid > 0) {
    return amountPaid;
  }

  if (booking.paymentStatus === "paid") {
    return getBookingTotalAmount(booking);
  }

  return toMoney(booking.depositAmount);
}

function getBookingDueAmount(booking: AdminBooking): number {
  const totalAmount = getBookingTotalAmount(booking);
  const paidAmount = getBookingPaidAmount(booking);

  if (booking.paymentOption === "full" && totalAmount > 0) {
    return 0;
  }

  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return 0;
  }

  if (totalAmount > 0 && paidAmount > 0) {
    return Math.max(0, totalAmount - paidAmount);
  }

  if (Number.isFinite(booking.balanceAmount)) {
    return toMoney(booking.balanceAmount);
  }

  return Math.max(0, totalAmount - paidAmount);
}

function isFullyPaidBooking(booking: AdminBooking): boolean {
  const totalAmount = getBookingTotalAmount(booking);
  const paidAmount = getBookingPaidAmount(booking);
  const dueAmount = getBookingDueAmount(booking);

  return Boolean(
    booking.paymentStatus === "paid" &&
      totalAmount > 0 &&
      paidAmount >= totalAmount &&
      dueAmount <= 0
  );
}

function getInvoiceNumber(booking: AdminBooking): string {
  const sourceDate = booking.paymentCapturedAt || booking.updatedAt || booking.createdAt;
  const year = new Date(sourceDate).getFullYear();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const idValue = parseInt(booking.id.replace(/\D/g, "").slice(-5), 10);
  const fallbackValue = parseInt(booking.id.slice(-5), 16);
  const sequence = Number.isFinite(idValue)
    ? idValue
    : Number.isFinite(fallbackValue)
      ? fallbackValue
      : 1;

  return `AT-${safeYear}-${String(sequence % 10000).padStart(4, "0")}`;
}

function getDestinationLabel(
  booking: AdminBooking,
  tour: AdminTour | undefined,
  departure: AdminTourDeparture | undefined,
  destinations: AdminDestination[]
): string {
  const destinationIds = [
    departure?.destinationId,
    tour?.destinationId,
    ...(tour?.destinationIds || []),
  ].filter(Boolean);

  const destination = destinations.find((item) =>
    destinationIds.includes(item.destinationId)
  );

  if (!destination) {
    return tour?.tourName || booking.tourId;
  }

  return [destination.city || destination.destinationName, destination.state || destination.countryRegion]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

function numberWord(value: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  return words[value] || String(value);
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`);
}

function summarizeAccommodation(booking: AdminBooking): string {
  const rooms = booking.pricingSnapshot?.accommodation?.rooms || [];

  if (rooms.length > 0) {
    const firstRoomType = rooms[0]?.roomType || "room";
    const sameRoomType = rooms.every((room) => room.roomType === firstRoomType);

    if (sameRoomType) {
      return `${numberWord(rooms.length)} ${titleCase(firstRoomType)} Room${
        rooms.length === 1 ? "" : "s"
      }`;
    }

    return `${numberWord(rooms.length)} Rooms`;
  }

  const accommodation = booking.accommodationDetails;
  const roomCount =
    accommodation.singleOccupancyOneRoom +
    accommodation.singleOccupancyTwoRooms +
    accommodation.doubleOccupancy +
    accommodation.twinOccupancy +
    accommodation.tripleOccupancy;

  return roomCount > 0
    ? `${numberWord(roomCount)} Room${roomCount === 1 ? "" : "s"}`
    : booking.pricingSnapshot?.accommodation?.optionTitle || "Accommodation";
}

function getRoomAmount(room: BookingAccommodationOption["rooms"][number]): number {
  return room.allocations.reduce((total, allocation) => total + toMoney(allocation.price), 0);
}

function createLineItems(booking: AdminBooking): InvoiceLineItem[] {
  const rooms = booking.pricingSnapshot?.accommodation?.rooms || [];

  if (rooms.length > 0) {
    return rooms.map((room, index) => {
      const amount = getRoomAmount(room);

      return {
        amount,
        description: `Accommodation - ${room.title || `Room ${index + 1}`}`,
        quantity: 1,
        rate: amount,
      };
    });
  }

  const subtotal = toMoney(booking.subtotal);

  return [
    {
      amount: subtotal,
      description: booking.pricingSnapshot?.accommodation?.optionTitle || "Tour Package",
      quantity: booking.totalGuest,
      rate: booking.totalGuest > 0 ? Math.round(subtotal / booking.totalGuest) : subtotal,
    },
  ];
}

function getTravellerLabel(booking: AdminBooking): string {
  const parts = [
    booking.adultCount
      ? `${booking.adultCount} Adult${booking.adultCount === 1 ? "" : "s"}`
      : "",
    booking.childCount
      ? `${booking.childCount} Child${booking.childCount === 1 ? "" : "ren"}`
      : "",
  ].filter(Boolean);

  return parts.join(", ") || `${booking.totalGuest} Guest${booking.totalGuest === 1 ? "" : "s"}`;
}

function getPaymentMethodLabel(booking: AdminBooking): string {
  if (booking.paymentProvider === "razorpay" || booking.paymentMethod === "razorpay") {
    return "Paid via Razorpay (UPI)";
  }

  if (booking.paymentMethod) {
    return `Paid via ${booking.paymentMethod.toUpperCase()}`;
  }

  return "Paid in Full";
}

function InvoiceInfoTile({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-border px-4 py-3 md:border-r md:last:border-r-0">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/8 text-primary">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div>
        <p className="font-heading text-[14px] font-bold leading-none text-primary">
          {label}
        </p>
        <p className={cn("mt-2 text-[14px] font-bold text-slate-900", valueClassName)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function InvoiceSection({
  children,
  className,
  contentClassName,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  title: string;
}) {
  return (
    <section className={cn("rounded-[8px] border border-primary/18 bg-white p-4", className)}>
      <h2 className="font-heading text-[21px] font-bold leading-none text-primary">
        {title}
      </h2>
      <span className="mt-2 block h-px w-8 bg-primary" />
      <div className={cn("mt-4", contentClassName)}>{children}</div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_1.25fr] items-center gap-4">
      <Icon className="size-5 text-primary" />
      <span className="text-[15px] text-slate-700">{label}</span>
      <span className="text-[15px] font-medium text-slate-900">{value}</span>
    </div>
  );
}

function InvoiceSheet({
  booking,
  departure,
  destinationLabel,
  invoiceRef,
  tour,
}: {
  booking: AdminBooking;
  departure?: AdminTourDeparture;
  destinationLabel: string;
  invoiceRef?: React.Ref<HTMLElement>;
  tour?: AdminTour;
}) {
  const primaryGuest = booking.guestDetails[0];
  const rooms = booking.pricingSnapshot?.accommodation?.rooms || [];
  const lineItems = createLineItems(booking);
  const currency = booking.paymentCurrency || "INR";
  const subtotal = toMoney(booking.subtotal) || lineItems.reduce((sum, item) => sum + item.amount, 0);
  const gstPercentage = Number.isFinite(booking.gstPercentage) ? Number(booking.gstPercentage) : 5;
  const gstAmount = toMoney(booking.gstAmount) || Math.round((subtotal * gstPercentage) / 100);
  const grandTotal = getBookingTotalAmount(booking) || subtotal + gstAmount;
  const amountPaid = getBookingPaidAmount(booking);
  const balanceDue = getBookingDueAmount(booking);
  const departureDate =
    booking.pricingSnapshot?.departureDate || departure?.departureDate || null;
  const returnDate =
    booking.pricingSnapshot?.returnDate || departure?.returnDate || null;

  return (
    <article
      ref={invoiceRef}
      className="admin-invoice-sheet mx-auto w-full max-w-[1000px] bg-white px-5 py-7 text-[#18314f] shadow-sm print:max-w-none print:px-8 print:py-7 print:shadow-none"
    >
      <header className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <Image
            src="/brand/header-logo.png"
            alt="Ancient Trails"
            width={260}
            height={90}
            priority
            className="h-auto w-[210px] object-contain"
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold">
            <span className="inline-flex items-center gap-2">
              <Phone className="size-4 text-primary" />
              +91 11 4567 8900
            </span>
            <span className="hidden h-8 w-px bg-border sm:block" />
            <span className="inline-flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              hello@ancienttrails.com
            </span>
          </div>
          
        </div>

        <div className="text-left md:text-right">
          <h1 className="font-heading text-[46px] font-bold leading-none text-slate-950">
            Invoice
          </h1>
          <span className="ml-auto mt-4 block h-px w-14 bg-primary" />
          <p className="mt-3 text-[14px] text-slate-700">Invoice No.</p>
          <p className="mt-1 font-heading text-[22px] font-bold text-primary">
            {getInvoiceNumber(booking)}
          </p>
        </div>
      </header>

      <section className="mt-7 grid overflow-hidden rounded-[8px] border border-primary/18 bg-white md:grid-cols-4">
        <InvoiceInfoTile icon={CalendarDays} label="Issue Date" value={formatDate(booking.createdAt)} />
        <InvoiceInfoTile
          icon={CalendarDays}
          label="Due Date"
          value={formatDate(booking.balanceDueDate || booking.createdAt)}
        />
        <InvoiceInfoTile
          icon={Check}
          label="Booking Status"
          value="Paid"
          valueClassName="inline-flex px-0 py-0 text-[15px] text-emerald-800"
        />
        <InvoiceInfoTile
          icon={CalendarDays}
          label="Payment Date"
          value={formatDate(booking.paymentCapturedAt || booking.updatedAt)}
        />
      </section>

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        <InvoiceSection title="Billed To">
          <p className="font-heading text-[21px] font-bold text-slate-950">
            {getGuestName(primaryGuest)}
          </p>
          <div className="mt-3 space-y-1 text-[14px] leading-[1.5] text-slate-700">
            <p>{primaryGuest?.address || "-"}</p>
            <p>{primaryGuest?.email || "-"}</p>
            <p>
              {primaryGuest
                ? `${primaryGuest.countryCode} ${primaryGuest.mobileNumber}`
                : "-"}
            </p>
          </div>
        </InvoiceSection>

        <InvoiceSection title="Trip Details">
          <div className="space-y-4">
            <DetailRow icon={MapPin} label="Destination" value={destinationLabel} />
            <DetailRow icon={CalendarDays} label="Departure Date" value={formatDate(departureDate)} />
            <DetailRow icon={CalendarDays} label="Return Date" value={formatDate(returnDate)} />
            <DetailRow icon={Users} label="Number of Guests" value={getTravellerLabel(booking)} />
          </div>
        </InvoiceSection>
      </section>

      <InvoiceSection className="mt-3" title="Accommodation Details">
        <div className="grid items-center gap-4 rounded-[8px] bg-primary/5 p-4 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-primary">
              <BedDouble className="size-7" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-heading text-[20px] font-bold text-primary">
                {summarizeAccommodation(booking)}
              </p>
              <div className="mt-1 space-y-0.5 text-[15px] leading-[1.45] text-slate-700">
                {rooms.length > 0 ? (
                  rooms.map((room, index) => (
                    <p key={room.id || index}>
                      {room.title || `Room ${index + 1}`} - {room.bedSummary || "Accommodation"}
                    </p>
                  ))
                ) : (
                  <p>{booking.pricingSnapshot?.accommodation?.optionTitle || tour?.tourName || "Tour accommodation"}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-border pl-0 text-left md:border-l md:pl-10">
            <p className="text-[15px] text-slate-700">Total Room Charges</p>
            <p className="mt-2 font-description text-[18px] font-semibold text-primary">
              {formatCurrency(subtotal, currency)}
            </p>
          </div>
        </div>
      </InvoiceSection>

      <InvoiceSection
        className="mt-3"
        contentClassName="overflow-hidden rounded-[6px] border border-border"
        title="Booking Details"
      >
          <table className="admin-invoice-items-table w-full border-collapse text-[13px]">
            <thead className="bg-primary/5 text-slate-950">
              <tr>
                <th className="w-12 border-r border-border px-4 py-3 text-center">#</th>
                <th className="border-r border-border px-4 py-3 text-left">Description</th>
                <th className="w-28 border-r border-border px-4 py-3 text-center">Quantity</th>
                <th className="w-36 border-r border-border px-4 py-3 text-right">Rate (INR)</th>
                <th className="w-36 px-4 py-3 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={`${item.description}-${index}`} className="border-t border-border">
                  <td className="border-r border-border px-4 py-4 text-center">{index + 1}</td>
                  <td className="border-r border-border px-4 py-4 font-medium text-slate-950">{item.description}</td>
                  <td className="border-r border-border px-4 py-3 text-center">{item.quantity}</td>
                  <td className="border-r border-border px-4 py-3 text-right">
                    {formatCurrency(item.rate, currency).replace(/^₹\s?/, "")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(item.amount, currency).replace(/^₹\s?/, "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </InvoiceSection>

      <section className="mt-3 grid gap-3 md:grid-cols-[1fr_1.02fr]">
        <InvoiceSection title="Payment Method">
          <div className="flex items-center gap-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/8 text-primary">
              <CreditCard className="size-7" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[17px] font-bold text-slate-950">
                {getPaymentMethodLabel(booking)}
              </p>
              <p className="mt-1 text-[14px] text-slate-700">
                Payment ID: {booking.paymentId || booking.paymentOrderId || "-"}
              </p>
              <p className="mt-1 text-[14px] text-slate-700">
                Paid on: {formatDateTime(booking.paymentCapturedAt || booking.updatedAt)}
              </p>
            </div>
          </div>
        </InvoiceSection>

        <InvoiceSection className="p-5" title="Summary">
          <div className="overflow-hidden rounded-[6px] border border-border text-[15px]">
            <SummaryRow label="Subtotal" value={formatCurrency(subtotal, currency)} />
            <SummaryRow label={`GST (${gstPercentage}%)`} value={formatCurrency(gstAmount, currency)} />
            <SummaryRow label="Discount" value={`- ${formatCurrency(0, currency)}`} />
            <SummaryRow
              label="Grand Total"
              value={formatCurrency(grandTotal, currency)}
              strong
            />
            <SummaryRow label="Amount Paid" value={formatCurrency(amountPaid, currency)} />
            <SummaryRow label="Balance Due" value={formatCurrency(balanceDue, currency)} />
          </div>
        </InvoiceSection>
      </section>

      <footer className="mt-10">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <span className="mb-5 block h-px w-20 bg-primary" />
            <p className="font-heading text-[40px] italic leading-none text-primary">
              Thank you
            </p>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#18314f]">
              For travelling with us!
            </p>
          </div>

          <div className="min-w-[230px] border-border md:border-l md:pl-14">
            <p className="font-heading text-[38px] italic leading-none text-primary">
              Rahul
            </p>
            <p className="mt-5 text-[16px] font-semibold text-[#18314f]">
              Rahul Deshmukh
            </p>
            <p className="text-[14px] leading-[1.35] text-[#18314f]">
              Manager
              <br />
              Ancient Trails
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-primary/35 pt-5 text-[12px] text-primary">
          <span className="font-heading text-[19px] font-bold uppercase tracking-[0.04em]">
            Ancient Trails
          </span>
          
          <span className="ml-auto text-[#18314f]">www.ancienttrails.com</span>
        </div>
      </footer>
    </article>
  );
}

function SummaryRow({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] border-b border-border last:border-b-0",
        strong && "bg-primary/10 text-[18px] font-bold text-slate-950"
      )}
    >
      <span className="px-4 py-2">{label}</span>
      <span className="min-w-[180px] border-l border-border px-4 py-2 text-right">
        {value}
      </span>
    </div>
  );
}

function ErrorPanel({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <section className="rounded-sm border border-border bg-white p-8 shadow-sm shadow-stone-200/40">
      <p className="text-sm font-bold text-foreground">{message}</p>
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className="mt-5 h-10 rounded-sm px-4 text-xs font-bold"
      >
        <ArrowLeft className="size-4" />
        Back to Bookings
      </Button>
    </section>
  );
}

function BookingInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") || "";
  const invoiceRef = useRef<HTMLElement | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [departures, setDepartures] = useState<AdminTourDeparture[]>([]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceData() {
      setIsLoading(true);

      try {
        const [bookingsResponse, toursResponse, departuresResponse, destinationsResponse] =
          await Promise.all([
            listAdminBookings(),
            listAdminTours(),
            listAdminTourDepartures(),
            listAdminDestinations(),
          ]);

        if (!isMounted) {
          return;
        }

        setBookings(bookingsResponse.data.bookings);
        setTours(toursResponse.data.tours);
        setDepartures(departuresResponse.data.departures);
        setDestinations(destinationsResponse.data.destinations);
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error && error.message.trim()
              ? error.message
              : "Invoice data could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInvoiceData();

    return () => {
      isMounted = false;
    };
  }, []);

  const booking = useMemo(
    () => bookings.find((item) => item.id === bookingId) || null,
    [bookingId, bookings]
  );
  const tour = useMemo(
    () => tours.find((item) => item.tourId === booking?.tourId),
    [booking?.tourId, tours]
  );
  const departure = useMemo(
    () =>
      departures.find(
        (item) =>
          item.departureId === booking?.departureId ||
          item.id === booking?.departureId
      ),
    [booking?.departureId, departures]
  );
  const destinationLabel = useMemo(
    () =>
      booking
        ? getDestinationLabel(booking, tour, departure, destinations)
        : "-",
    [booking, departure, destinations, tour]
  );

  function goBack() {
    router.push("/bookings");
  }

  async function downloadInvoice() {
    if (!booking || !invoiceRef.current || isDownloading) {
      return;
    }

    setIsDownloading(true);

    const invoiceElement = invoiceRef.current;
    const invoiceNumber = getInvoiceNumber(booking);
    const previousScrollY = window.scrollY;

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      invoiceElement.classList.add("admin-invoice-exporting");
      await document.fonts.ready;

      const canvas = await html2canvas(invoiceElement, {
        backgroundColor: "#ffffff",
        onclone: (clonedDocument) => {
          const style = clonedDocument.createElement("style");

          style.textContent = invoiceExportStyles;
          clonedDocument.head.appendChild(style);
        },
        scale: Math.min(3, window.devicePixelRatio || 2),
        scrollX: 0,
        scrollY: -window.scrollY,
        useCORS: true,
      });

      const imageData = canvas.toDataURL("image/png", 1);
      const pdf = new jsPDF({
        format: "a4",
        orientation: "portrait",
        unit: "mm",
      });
      const imageHeight = (canvas.height * A4_WIDTH_MM) / canvas.width;
      const pdfImageWidth =
        imageHeight > A4_HEIGHT_MM
          ? (canvas.width * A4_HEIGHT_MM) / canvas.height
          : A4_WIDTH_MM;
      const pdfImageHeight =
        imageHeight > A4_HEIGHT_MM ? A4_HEIGHT_MM : imageHeight;
      const pdfImageX = (A4_WIDTH_MM - pdfImageWidth) / 2;

      pdf.addImage(imageData, "PNG", pdfImageX, 0, pdfImageWidth, pdfImageHeight);
      pdf.save(`${invoiceNumber}-Ancient-Trails-Invoice.pdf`);
    } catch (error) {
      console.error("Invoice PDF download failed", error);
      window.alert("Invoice PDF could not be downloaded. Please try again.");
    } finally {
      invoiceElement.classList.remove("admin-invoice-exporting");
      window.scrollTo({ top: previousScrollY });
      setIsDownloading(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Booking">
      <div className="admin-invoice-page mx-auto flex w-full max-w-[1180px] flex-col gap-5">
        <div className="admin-invoice-screen-actions flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            className="h-10 rounded-sm border-border bg-white px-3 text-xs font-bold"
          >
            <ArrowLeft className="size-4" />
            Back to Bookings
          </Button>

          {booking && isFullyPaidBooking(booking) ? (
            <Button
              type="button"
              onClick={downloadInvoice}
              disabled={isDownloading}
              className="h-10 rounded-sm px-4 text-xs font-bold"
            >
              <Download className="size-4" />
              {isDownloading ? "Downloading..." : "Download Invoice"}
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <section className="rounded-sm border border-border bg-white p-8 shadow-sm shadow-stone-200/40">
            <div className="space-y-4">
              <div className="h-5 w-48 animate-pulse rounded-sm bg-muted" />
              <div className="h-[640px] animate-pulse rounded-sm bg-muted/60" />
            </div>
          </section>
        ) : null}

        {!isLoading && loadError ? (
          <ErrorPanel message={loadError} onBack={goBack} />
        ) : null}

        {!isLoading && !loadError && !booking ? (
          <ErrorPanel message="Booking not found." onBack={goBack} />
        ) : null}

        {!isLoading && !loadError && booking && !isFullyPaidBooking(booking) ? (
          <ErrorPanel
            message="Invoice is available only after the booking is fully paid."
            onBack={goBack}
          />
        ) : null}

        {!isLoading && !loadError && booking && isFullyPaidBooking(booking) ? (
          <InvoiceSheet
            booking={booking}
            departure={departure}
            destinationLabel={destinationLabel}
            invoiceRef={invoiceRef}
            tour={tour}
          />
        ) : null}
      </div>
    </AdminDashboardShell>
  );
}

export default function BookingInvoicePage() {
  return (
    <Suspense fallback={null}>
      <BookingInvoiceContent />
    </Suspense>
  );
}
