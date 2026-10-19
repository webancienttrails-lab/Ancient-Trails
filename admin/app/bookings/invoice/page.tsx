"use client";
import { SiteLogo } from "@/components/site-logo";
import { formatBookingPaymentMethod } from "@/lib/bookings";

import { AirfareDisclosure } from "@/components/airfare-disclosure";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
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
import { getAdminSiteSettings, type SiteContactSettings } from "@/lib/site-settings";
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
const invoiceLayoutStyles = `
  .admin-invoice-sheet .admin-invoice-items-table th,
  .admin-invoice-sheet .admin-invoice-items-table td {
    height: auto;
    padding: 10px 12px;
    font-size: 11px;
    overflow-wrap: anywhere;
  }
  .admin-invoice-sheet .admin-invoice-items-table th:first-child { width: 46%; }
  .admin-invoice-sheet.admin-invoice-exporting { padding: 6mm !important; }
`;
const invoiceExportStyles = `
  ${invoiceLayoutStyles}
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
  const amountPaid = toMoney(booking.amountPaid);

  if (booking.paymentStatus !== "paid") {
    return amountPaid;
  }

  if (amountPaid > 0) {
    return amountPaid;
  }

  if (Number.isFinite(booking.balanceAmount) && totalAmount > 0) {
    return Math.max(0, totalAmount - toMoney(booking.balanceAmount));
  }

  if (booking.paymentOption === "full" && totalAmount > 0) {
    return totalAmount;
  }

  if (booking.paymentStatus === "paid") {
    return getBookingTotalAmount(booking);
  }
  return 0;
}

function getBookingDueAmount(booking: AdminBooking): number {
  const totalAmount = getBookingTotalAmount(booking);
  const paidAmount = getBookingPaidAmount(booking);

  if (booking.paymentStatus !== "paid") {
    return totalAmount;
  }

  if (booking.paymentOption === "full" && totalAmount > 0 && paidAmount >= totalAmount) {
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
  const airFlightCharges = toMoney(booking.airFlightCharges);

  if (rooms.length > 0) {
    const roomItems = rooms.map((room, index) => {
      const amount = getRoomAmount(room);

      return {
        amount,
        description: `Accommodation - ${room.title || `Room ${index + 1}`}`,
        quantity: 1,
        rate: amount,
      };
    });

    return airFlightCharges > 0 && !booking.airfareIncludedInTotal
      ? [
          ...roomItems,
          {
            amount: airFlightCharges,
            description: "Air-flight charges",
            quantity: 1,
            rate: airFlightCharges,
          },
        ]
      : roomItems;
  }

  const subtotal = toMoney(booking.subtotal);

  const items = [
    {
      amount: subtotal,
      description: booking.pricingSnapshot?.accommodation?.optionTitle || "Tour Package",
      quantity: booking.totalGuest,
      rate: booking.totalGuest > 0 ? Math.round(subtotal / booking.totalGuest) : subtotal,
    },
  ];

  return airFlightCharges > 0 && !booking.airfareIncludedInTotal
    ? [
        ...items,
        {
          amount: airFlightCharges,
          description: "Air-flight charges",
          quantity: 1,
          rate: airFlightCharges,
        },
      ]
    : items;
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
  return "Paid via " + formatBookingPaymentMethod(booking);
}

function InvoiceSection({ children, className, title }: {
  children: React.ReactNode; className?: string; title: string;
}) {
  return <section className={cn("rounded-[8px] border border-border bg-white p-4", className)}>
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-900">{title}</h2>
    {children}
  </section>;
}

function InvoiceField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-dashed border-border py-2 last:border-0">
    <span className="shrink-0 text-slate-500">{label}</span>
    <span className="min-w-0 text-right font-semibold text-slate-900">{value}</span>
  </div>;
}

function InvoiceSheet({ booking, departure, destinationLabel, invoiceRef, tour, contact }: {
  booking: AdminBooking; departure?: AdminTourDeparture; destinationLabel: string;
  invoiceRef?: React.Ref<HTMLElement>; tour?: AdminTour; contact?: SiteContactSettings;
}) {
  const primaryGuest = booking.guestDetails[0];
  const rooms = booking.pricingSnapshot?.accommodation?.rooms || [];
  const lineItems = createLineItems(booking);
  const currency = booking.paymentCurrency || "INR";
  const subtotal = toMoney(booking.subtotal);
  const gstPercentage = Number.isFinite(booking.gstPercentage) ? Number(booking.gstPercentage) : 0;
  const gstAmount = toMoney(booking.gstAmount);
  const airFlightCharges = toMoney(booking.airFlightCharges);
  const grandTotal = getBookingTotalAmount(booking);
  const amountPaid = getBookingPaidAmount(booking);
  const balanceDue = getBookingDueAmount(booking);
  const departureDate = booking.pricingSnapshot?.departureDate || departure?.departureDate;
  const returnDate = booking.pricingSnapshot?.returnDate || departure?.returnDate;
  const phone = [...new Set([contact?.primaryCalling, contact?.secondaryCalling, contact?.landline].filter(Boolean))].join(" | ");
  return <article ref={invoiceRef} className="admin-invoice-sheet mx-auto w-full max-w-[900px] bg-white p-6 text-[11px] leading-relaxed text-slate-700 shadow-sm print:shadow-none">
    <style>{invoiceLayoutStyles}</style>
    <header className="flex items-start justify-between gap-6 border-b border-border pb-3">
      <div className="min-w-0">
        <SiteLogo alt="Ancient Trails" width={200} height={70} priority className="h-auto w-[170px] object-contain" />
        <p className="mt-2 text-[10px]">A quest for Indian heritage</p>
      </div>
      <div className="min-w-[220px] text-right">
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">Invoice</span>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[10px]">
          <dt className="text-slate-500">Invoice No</dt><dd className="font-bold text-slate-900">{getInvoiceNumber(booking)}</dd>
          <dt className="text-slate-500">Invoice Date</dt><dd className="font-semibold">{formatDate(booking.paymentCapturedAt || booking.createdAt)}</dd>
          <dt className="text-slate-500">Booking ID</dt><dd className="font-semibold">{booking.bookingReference || booking.id}</dd>
        </dl>
      </div>
    </header>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <InvoiceSection title="Ancient Trails">
        <div className="space-y-1 break-words">
          {contact?.officeAddress ? <p className="whitespace-pre-line">{contact.officeAddress}</p> : null}
          {contact?.emailId ? <p>Email: {contact.emailId}</p> : null}
          {phone ? <p>Phone: {phone}</p> : null}
          {contact?.whatsapp ? <p>WhatsApp: {contact.whatsapp}</p> : null}
        </div>
      </InvoiceSection>
      <InvoiceSection title="Bill To">
        <p className="font-bold text-slate-950">{getGuestName(primaryGuest)}</p>
        <div className="mt-1 space-y-1 break-words">
          <p>Email: {primaryGuest?.email || "-"}</p>
          <p>Phone: {primaryGuest ? primaryGuest.countryCode + " " + primaryGuest.mobileNumber : "-"}</p>
          <p className="whitespace-pre-line">{primaryGuest?.address || "-"}</p>
        </div>
      </InvoiceSection>
    </div>
    <InvoiceSection className="mt-3" title="Tour Details">
      <div className="grid grid-cols-2 gap-x-7">
        <div><InvoiceField label="Tour" value={tour?.tourName || booking.tourId} /><InvoiceField label="Departure" value={formatDate(departureDate)} /><InvoiceField label="Return" value={formatDate(returnDate)} /></div>
        <div><InvoiceField label="Destination" value={destinationLabel} /><InvoiceField label="Guests" value={getTravellerLabel(booking)} /><InvoiceField label="Duration" value={tour?.durationDn || "-"} /></div>
      </div>
      <div className="mt-1 border-t border-dashed border-border pt-2">
        <p className="font-semibold text-slate-900">Accommodation: {summarizeAccommodation(booking)}</p>
        {rooms.map((room, index) => <p key={room.id || index}>{room.title || "Room " + (index + 1)} - {room.bedSummary || "Accommodation"}</p>)}
      </div>
    </InvoiceSection>
    <div className="mt-3 overflow-hidden rounded-[8px] border border-border">
      <table className="admin-invoice-items-table w-full border-collapse text-[11px]">
        <thead className="bg-slate-100 text-slate-700"><tr>
          <th className="text-left font-medium">Description</th><th className="text-center font-medium">Qty</th><th className="text-right font-medium">Rate ({currency})</th><th className="text-right font-medium">Amount ({currency})</th>
        </tr></thead>
        <tbody>{lineItems.map((item, index) => <tr key={index} className="border-t border-border">
          <td className="font-semibold text-slate-900">{item.description}</td><td className="text-center">{item.quantity}</td>
          <td className="whitespace-nowrap text-right">{formatCurrency(item.rate, currency)}</td><td className="whitespace-nowrap text-right font-semibold">{formatCurrency(item.amount, currency)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="mt-3 grid grid-cols-[0.85fr_1.15fr] items-start gap-3">
      <div className="rounded-[8px] border border-dashed border-primary/30 bg-primary/5 p-4 text-[10px] leading-relaxed">
        <p className="font-semibold text-primary">Note</p>
        <p className="mt-1">This invoice covers the confirmed tour package and charges listed here. Please retain it for your records.</p>
        <AirfareDisclosure excluded={booking.airfareExcluded} amount={airFlightCharges} addedAt={booking.airfareAddedAt} includedInTotal={booking.airfareIncludedInTotal} />
      </div>
      <InvoiceSection title="Totals">
        <InvoiceField label="Subtotal (Taxable Value)" value={formatCurrency(subtotal, currency)} />
        <InvoiceField label={"GST (" + gstPercentage + "%)"} value={formatCurrency(gstAmount, currency)} />
        {airFlightCharges > 0 ? <InvoiceField label={booking.airfareIncludedInTotal ? "Airfare (Included)" : "Additional Airfare"} value={formatCurrency(airFlightCharges, currency)} /> : null}
        <div className="flex justify-between gap-4 border-t border-border pt-3"><span className="font-bold">{booking.airfareExcluded && !booking.airfareAddedAt && !airFlightCharges ? "Total (Excluding Airfare)" : "Total Payable"}</span><strong className="text-[18px] text-primary">{formatCurrency(grandTotal, currency)}</strong></div>
        <InvoiceField label="Amount Paid" value={formatCurrency(amountPaid, currency)} />
        <InvoiceField label="Balance Due" value={formatCurrency(balanceDue, currency)} />
      </InvoiceSection>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <InvoiceSection title="Payment Details">
        <p>Mode: <strong>{getPaymentMethodLabel(booking).replace(/^Paid via /, "")}</strong></p>
        <p className="break-all">Transaction ID: {booking.paymentId || booking.paymentOrderId || "-"}</p>
        <p>Payment Date: {formatDateTime(booking.paymentCapturedAt || booking.updatedAt)}</p>
        <p>Payment Status: <strong className="text-emerald-800">FULLY PAID</strong></p>
      </InvoiceSection>
      <section className="flex min-h-[110px] flex-col justify-between rounded-[8px] border border-border p-4 text-right">
        <p className="font-semibold text-slate-900">For Ancient Trails</p>
        <p className="mt-10 border-t border-border pt-2">Authorized Signatory</p>
      </section>
    </div>
    <p className="mt-4 text-center text-[10px] text-slate-500">Thank you for travelling with Ancient Trails.</p>
  </article>;
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
  const [contact, setContact] = useState<SiteContactSettings>();
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceData() {
      setIsLoading(true);

      try {
        const [bookingsResponse, toursResponse, departuresResponse, destinationsResponse, settingsResponse] =
          await Promise.all([
            listAdminBookings(),
            listAdminTours(),
            listAdminTourDepartures(),
            listAdminDestinations(),
            getAdminSiteSettings().catch(() => null),
          ]);

        if (!isMounted) {
          return;
        }

        setContact(settingsResponse?.data.settings.contact);
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
          const sheet = clonedDocument.querySelector<HTMLElement>(".admin-invoice-sheet");
          if (sheet) { sheet.style.width = "794px"; sheet.style.padding = "24px"; }
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
            contact={contact}
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
