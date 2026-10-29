"use client";
import { BookingCancellationRequestControl } from "@/components/booking-cancellation-request";
import { PaymentRetryNotice } from "@/components/payment-retry-notice";
import { paymentFailureMessage } from "@/lib/payment-failure";
import { BookingPaymentReceipt } from "@/components/booking-payment-receipt";
import { getBookingPaymentSummary, getBookingDocumentMessage, getBookingPaymentState } from "@/lib/booking-receipt";
import { fetchSiteLogoUrl } from "@/lib/site-logo";
import { formatBookingPaymentMethod } from "@/lib/booking-payment";

import { BankTransferBalanceLink } from "@/components/bank-transfer-link";
import { AirfareDisclosure } from "@/components/airfare-disclosure";
import { AIRFARE_NOTE } from "@/lib/airfare";
import Image from "next/image";
import Link from "next/link";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  Hotel,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Upload,
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
  defaultSiteContactSettings,
  getContactCallDisplay,
  getContactEmailDisplay,
  getMailtoHref,
  getPublicSiteSettings,
  getTelephoneHref,
  type SiteContactSettings,
} from "@/lib/site-settings";
import {
  getUserBookingDuration,
  getUserBookingImageSource,
  getUserBookingLocation,
  getUserBookingReference,
  getUserBookingTitle,
  getUserBookingTravellerLabel,
  getBookingKycDocumentUrl,
  listTravellerBookings,
  uploadTravellerBookingKycDocument,
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
  countryCode?: string;
  email?: string;
  firstName?: string;
  gender?: string;
  id: string;
  kycDocuments?: BookingConfirmation["travellers"][number]["kycDocuments"];
  lastName?: string;
  mobileNumber?: string;
  title?: string;
  type: "adult" | "child";
};

type KycDocumentType =
  NonNullable<BookingConfirmation["travellers"][number]["kycDocuments"]>[number]["documentType"];

const domesticKycDocumentOptions: Array<{
  label: string;
  value: KycDocumentType;
}> = [
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

function formatPdfCurrency(amount?: number, currency = "INR") {
  return `${currency} ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount || 0)))}`;
}

function formatPdfAmount(amount?: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount || 0)));
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " ");
}

function wrapPdfLine(value: string, maxLength = 88) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function buildSimplePdf(lines: string[]) {
  const encoder = new TextEncoder();
  const pageHeight = 842;
  const pageWidth = 595;
  const marginX = 48;
  const startY = 792;
  const lineHeight = 18;
  const linesPerPage = Math.floor((startY - 56) / lineHeight);
  const pages: string[][] = [];

  lines
    .flatMap((line) => wrapPdfLine(line))
    .forEach((line) => {
      const currentPage = pages[pages.length - 1];

      if (!currentPage || currentPage.length >= linesPerPage) {
        pages.push([line]);
        return;
      }

      currentPage.push(line);
    });

  if (pages.length === 0) {
    pages.push(["Final Invoice"]);
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const fontObjectId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  const pageObjectIds: number[] = [];

  pages.forEach((pageLines) => {
    const streamLines = [
      "q",
      "1 1 1 rg",
      `0 0 ${pageWidth} ${pageHeight} re f`,
      "Q",
      "BT",
      "0 0 0 rg",
      "/F1 11 Tf",
      `${lineHeight} TL`,
      `${marginX} ${startY} Td`,
      ...pageLines.flatMap((line, index) => [
        index === 0 ? "" : "T*",
        `(${escapePdfText(line)}) Tj`,
      ]),
      "ET",
    ].join("\n");
    const contentObjectId = addObject(
      `<< /Length ${encoder.encode(streamLines).length} >>\nstream\n${streamLines}\nendstream`
    );
    const pageObjectId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /ProcSet [/PDF /Text] /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );

    pageObjectIds.push(pageObjectId);
  });

  const pagesObjectId = addObject(
    `<< /Type /Pages /Kids ${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")} /Count ${pageObjectIds.length} >>`
  );
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);
  const resolvedObjects = objects.map((object) =>
    object.replace("/Parent 0 0 R", `/Parent ${pagesObjectId} 0 R`)
  );
  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [];
  let byteOffset = encoder.encode(chunks[0]).length;

  resolvedObjects.forEach((object, index) => {
    const objectChunk = `${index + 1} 0 obj\n${object}\nendobj\n`;

    offsets.push(byteOffset);
    chunks.push(objectChunk);
    byteOffset += encoder.encode(objectChunk).length;
  });

  const xrefOffset = byteOffset;
  chunks.push(`xref\n0 ${resolvedObjects.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${resolvedObjects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return new Blob([encoder.encode(chunks.join(""))], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function getInvoiceNumber(booking: UserBooking) {
  const sourceDate =
    booking.booking.paymentCapturedAt ||
    booking.booking.updatedAt ||
    booking.booking.createdAt;
  const year = new Date(sourceDate).getFullYear();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const idValue = parseInt(booking.booking.id.replace(/\D/g, "").slice(-5), 10);
  const fallbackValue = parseInt(booking.booking.id.slice(-5), 16);
  const sequence = Number.isFinite(idValue)
    ? idValue
    : Number.isFinite(fallbackValue)
      ? fallbackValue
      : 1;

  return `AT-${safeYear}-${String(sequence % 10000).padStart(4, "0")}`;
}

function getFinalInvoiceLineItems(booking: UserBooking) {
  const rooms = booking.booking.pricingSnapshot?.accommodation?.rooms || [];
  const airFlightCharges = booking.booking.airFlightCharges || 0;

  if (rooms.length > 0) {
    const roomItems = rooms.map((room, index) => {
      const amount = (room.allocations || []).reduce(
        (total, allocation) => total + Math.max(0, Math.round(allocation.price || 0)),
        0
      );

      return {
        amount,
        description: `Accommodation - ${room.title || `Room ${index + 1}`}`,
        quantity: 1,
        rate: amount,
      };
    });

    return airFlightCharges > 0 && !booking.booking.airfareIncludedInTotal
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

  const packageAmount = getTourPackageAmount(booking);
  const items = [
    {
      amount: packageAmount,
      description:
        booking.booking.pricingSnapshot?.accommodation?.optionTitle ||
        getUserBookingTitle(booking),
      quantity: booking.booking.totalGuest || 1,
      rate:
        booking.booking.totalGuest > 0
          ? Math.round(packageAmount / booking.booking.totalGuest)
          : packageAmount,
    },
  ];

  return airFlightCharges > 0 && !booking.booking.airfareIncludedInTotal
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

function getVoucherTourDetails(booking: UserBooking) {
  return (booking.tour || {}) as NonNullable<UserBooking["tour"]> & {
    accommodationDetails?: string[];
    exclusions?: string[];
    flightDetails?: string[];
    inclusions?: string[];
  };
}

function getVoucherDateTime(value?: string | null) {
  const date = parseDate(value);

  if (!date) {
    return "-";
  }

  return `${formatDate(value)}, ${date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getVoucherNights(booking: UserBooking) {
  const departureDate = parseDate(
    booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate
  );
  const returnDate = parseDate(
    booking.departure?.returnDate || booking.booking.pricingSnapshot?.returnDate
  );

  if (!departureDate || !returnDate) {
    return "";
  }

  const days = Math.max(
    1,
    Math.round((returnDate.getTime() - departureDate.getTime()) / 86_400_000) + 1
  );

  return `${Math.max(0, days - 1)} Night${days === 2 ? "" : "s"}`;
}

function getVoucherHotelRows(booking: UserBooking) {
  const rooms = booking.booking.pricingSnapshot?.accommodation?.rooms || [];
  const nights = getVoucherNights(booking) || "-";
  const destination = getUserBookingLocation(booking);
  const tourDetails = getVoucherTourDetails(booking);

  if (tourDetails.accommodationDetails?.length) {
    return tourDetails.accommodationDetails.slice(0, 5).map((hotel, index) => ({
      category: rooms[index]?.bedSummary || "Selected stay",
      destination,
      hotel,
      nights,
    }));
  }

  if (rooms.length > 0) {
    return rooms.slice(0, 5).map((room) => ({
      category: room.bedSummary || "Selected stay",
      destination,
      hotel: room.title || "Accommodation arranged by Ancient Trails",
      nights,
    }));
  }

  return [
    {
      category: "Selected stay",
      destination,
      hotel:
        booking.booking.pricingSnapshot?.accommodation?.optionTitle ||
        "Accommodation arranged by Ancient Trails",
      nights,
    },
  ];
}

function getVoucherFlightRows(booking: UserBooking) {
  const tourDetails = getVoucherTourDetails(booking);
  const seats = String(booking.booking.totalGuest || 1);
  const departureDate = formatDate(
    booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate
  );
  const returnDate = formatDate(
    booking.departure?.returnDate || booking.booking.pricingSnapshot?.returnDate
  );

  if (tourDetails.flightDetails?.length) {
    return tourDetails.flightDetails.slice(0, 5).map((detail, index) => ({
      airline: detail,
      dateTime: index === 0 ? departureDate : returnDate,
      from: index === 0 ? "Departure city" : getUserBookingLocation(booking),
      seats,
      to: index === 0 ? getUserBookingLocation(booking) : "Return city",
    }));
  }

  return [
    {
      airline: booking.booking.airfareExcluded && !booking.booking.airfareAddedAt && !booking.booking.airFlightCharges
        ? "Air-Flight Charges: To Be Added"
        : "Flight details will be shared after airline confirmation",
      dateTime: departureDate,
      from: "Departure city",
      seats,
      to: getUserBookingLocation(booking),
    },
    {
      airline: "Final airline schedule will be shared before departure",
      dateTime: returnDate,
      from: getUserBookingLocation(booking),
      seats,
      to: "Return city",
    },
  ];
}

function getVoucherInclusions(booking: UserBooking) {
  const tourDetails = getVoucherTourDetails(booking);

  return tourDetails.inclusions?.length
    ? tourDetails.inclusions
    : [
        "Accommodation in selected hotels as per booking.",
        "Meals, sightseeing and transfers included in the tour package.",
        ...(booking.booking.airFlightCharges ? ["Air-flight charges shown separately in the final booking amount."] : []),
        "Tour assistance from the Ancient Trails team.",
        "Applicable taxes as shown in the payment summary.",
      ];
}

function getVoucherExclusions(booking: UserBooking) {
  const tourDetails = getVoucherTourDetails(booking);

  return tourDetails.exclusions?.length
    ? tourDetails.exclusions
    : [
        "Personal expenses such as laundry, telephone, shopping and beverages.",
        "Any increase in airfare, airport taxes or government levies after booking.",
        "Visa, permits or entrance fees unless mentioned in inclusions.",
        "Expenses caused by delays, accidents, illness or itinerary changes.",
        "Anything not specifically mentioned in the inclusions.",
      ];
}

function loadPdfImageDataUrl(source: string) {
  if (typeof window === "undefined") {
    return Promise.resolve("");
  }

  return new Promise<string>((resolve) => {
    const image = new window.Image();

    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        resolve("");
        return;
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve("");
    image.src = source;
  });
}

async function downloadBookingVoucherPdf(booking: UserBooking) {
  const currency = booking.booking.paymentCurrency || "INR";
  const reference = getUserBookingReference(booking);
  const primaryGuest = booking.booking.guestDetails[0];
  const travellers = getBookingTravellers(booking);
  const issueDate = getVoucherDateTime(
    booking.booking.paymentCapturedAt || booking.booking.updatedAt
  );
  const departureDate = formatDate(
    booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate
  );
  const returnDate = formatDate(
    booking.departure?.returnDate || booking.booking.pricingSnapshot?.returnDate
  );
  const totalAmount = getTotalAmount(booking);
  const subtotal = booking.booking.subtotal || getTourPackageAmount(booking);
  const gstPercentage = booking.booking.gstPercentage || 0;
  const gstAmount = booking.booking.gstAmount || 0;
  const airFlightCharges = booking.booking.airFlightCharges || 0;

  try {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      format: "a4",
      orientation: "portrait",
      unit: "pt",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 26;
    const navy: [number, number, number] = [24, 49, 79];
    const orange: [number, number, number] = [212, 114, 32];
    const orangeText: [number, number, number] = [214, 106, 26];
    const orangeDark: [number, number, number] = [169, 80, 0];
    const paleOrange: [number, number, number] = [255, 244, 236];
    const paleBlue: [number, number, number] = [238, 247, 253];
    const lineColor: [number, number, number] = [232, 222, 214];
    const bodyTextSize = 10.5;
    const tableTextSize = 7.8;
    const logoDataUrl = await loadPdfImageDataUrl(await fetchSiteLogoUrl());

    const text = (
      value: string,
      x: number,
      y: number,
      options: {
        align?: "left" | "center" | "right";
        color?: [number, number, number];
        size?: number;
        style?: "bold" | "normal";
      } = {}
    ) => {
      pdf.setFont("helvetica", options.style || "normal");
      pdf.setFontSize(options.size || 9);
      pdf.setTextColor(...(options.color || navy));
      pdf.text(value, x, y, { align: options.align || "left" });
    };

    const rounded = (
      x: number,
      y: number,
      width: number,
      height: number,
      fill: [number, number, number] = [255, 255, 255]
    ) => {
      pdf.setFillColor(...fill);
      pdf.setDrawColor(...lineColor);
      pdf.roundedRect(x, y, width, height, 6, 6, "FD");
    };

    const header = (showVoucherTitle = false) => {
      text(issueDate, margin, 24, { color: [88, 103, 122], size: 7 });
      text("Booking Confirmation Voucher", pageWidth - margin, 24, {
        align: "right",
        color: [88, 103, 122],
        size: 7,
        style: "bold",
      });
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", margin + 12, 48, 100, 48);
      } else {
        pdf.setFillColor(...orangeDark);
        pdf.roundedRect(margin + 18, 50, 58, 38, 6, 6, "F");
        text("ancient", margin + 47, 66, {
          align: "center",
          color: [255, 255, 255],
          size: 13,
          style: "bold",
        });
        text("trails", margin + 47, 81, {
          align: "center",
          color: [255, 255, 255],
          size: 13,
          style: "bold",
        });
        text("A QUEST FOR", margin + 47, 101, {
          align: "center",
          color: orangeText,
          size: 5,
          style: "bold",
        });
        text("INDIAN HERITAGE", margin + 47, 109, {
          align: "center",
          color: orangeText,
          size: 5,
          style: "bold",
        });
      }
      text("Ancient", pageWidth / 2 - 8, 62, {
        align: "right",
        color: navy,
        size: 18,
        style: "bold",
      });
      text("Trails", pageWidth / 2 - 4, 62, {
        color: orangeText,
        size: 18,
        style: "bold",
      });
      text("Ancient Trails LLP", pageWidth / 2, 82, {
        align: "center",
        color: navy,
        size: 9,
        style: "bold",
      });
      text("+91 7272900202", pageWidth / 2 - 62, 104, {
        align: "right",
        color: navy,
        size: 7,
      });
      text("travelwith@ancient-trails.com", pageWidth / 2 + 22, 104, {
        color: navy,
        size: 7,
      });
      if (showVoucherTitle) {
        text("Booking Confirmation Voucher", pageWidth / 2, 146, {
          align: "center",
          color: navy,
          size: 18,
          style: "bold",
        });
        text("JOURNEYS  |  HERITAGE  |  MEMORABLE EXPERIENCES", pageWidth / 2, 164, {
          align: "center",
          color: [126, 139, 156],
          size: 5,
        });
        pdf.setDrawColor(...orange);
        pdf.line(pageWidth / 2 - 36, 154, pageWidth / 2 + 36, 154);
      }
    };

    const footer = (pageNumber: number) => {
      pdf.setFillColor(...navy);
      pdf.rect(0, pageHeight - 24, pageWidth, 24, "F");
      pdf.setFillColor(...orangeDark);
      pdf.rect(0, pageHeight - 27, pageWidth, 3, "F");
      text("www.ancient-trails.com", margin + 18, pageHeight - 9, {
        color: [255, 255, 255],
        size: 7,
      });
      text(`Page ${pageNumber} of 3`, pageWidth - margin, pageHeight - 9, {
        align: "right",
        color: [255, 255, 255],
        size: 7,
      });
    };

    const sectionTitle = (title: string, y: number, strap = "") => {
      const titleX = margin + 24;
      const titleSize = 13;

      rounded(margin, y, pageWidth - margin * 2, 36);
      text(title, titleX, y + 23, {
        color: navy,
        size: titleSize,
        style: "bold",
      });
      if (strap) {
        text(strap, pageWidth - margin - 8, y + 21, {
          align: "right",
          color: [126, 139, 156],
          size: 5,
        });
      }
    };

    const table = (
      startY: number,
      columns: Array<{ label: string; width: number }>,
      rows: string[][],
      rowHeight = 28
    ) => {
      const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
      let y = startY;
      let x = margin + 16;

      pdf.setFillColor(...paleBlue);
      pdf.rect(x, y, tableWidth, 22, "F");
      columns.forEach((column) => {
        text(column.label.toUpperCase(), x + 6, y + 14, {
          color: navy,
          size: 6,
          style: "bold",
        });
        x += column.width;
      });
      y += 22;
      rows.forEach((row) => {
        x = margin + 16;
        columns.forEach((column, index) => {
          pdf.setDrawColor(...lineColor);
          pdf.rect(x, y, column.width, rowHeight, "S");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(tableTextSize);
          const lines = pdf.splitTextToSize(row[index] || "-", column.width - 10);
          text(lines.slice(0, 2).join("\n"), x + 6, y + 11, {
            color: [31, 52, 74],
            size: tableTextSize,
          });
          x += column.width;
        });
        y += rowHeight;
      });
      return y;
    };

    const bulletList = (items: string[], x: number, y: number, maxWidth: number) => {
      let currentY = y;
      items.slice(0, 9).forEach((item) => {
        pdf.setFillColor(...orangeDark);
        pdf.circle(x, currentY - 3, 1.8, "F");
        const lines = pdf.splitTextToSize(item, maxWidth);
        text(lines.join("\n"), x + 8, currentY, {
          color: [31, 52, 74],
          size: bodyTextSize,
        });
        currentY += Math.max(15, lines.length * 13);
      });
      return currentY;
    };

    header(true);
    let y = 186;
    const metricGap = 8;
    const metricWidth = (pageWidth - margin * 2 - metricGap * 3) / 4;
    [
      ["Booking Date", formatDate(booking.booking.createdAt)],
      ["Duration", getUserBookingDuration(booking)],
      ["Total Guest(s)", String(booking.booking.totalGuest || 1)],
      ["Price", formatPdfAmount(totalAmount)],
    ].forEach(([label, value], index) => {
      const metricX = margin + index * (metricWidth + metricGap);

      rounded(metricX, y, metricWidth, 58, index % 2 ? [255, 255, 255] : paleOrange);
      text(label.toUpperCase(), metricX + 18, y + 23, {
        color: [95, 110, 128],
        size: 6,
        style: "bold",
      });
      text(value, metricX + 18, y + 39, {
        color: navy,
        size: 10,
        style: "bold",
      });
    });
    y += 74;

    sectionTitle("BOOKING DETAILS", y, "TRAVEL  -  EXPLORE  -  DISCOVER");
    rounded(margin, y + 42, pageWidth - margin * 2, 116);
    const detailRows = [
      ["TOUR NAME", getUserBookingTitle(booking), "BOOKING ID", reference],
      ["CUSTOMER NAME", getGuestName(primaryGuest) || "Traveller", "CONTACT NUMBER", [primaryGuest?.countryCode, primaryGuest?.mobileNumber].filter(Boolean).join(" ") || "-"],
      ["TOUR DATE", `${departureDate} to ${returnDate}`, "TOTAL ROOMS", String(Math.max(1, getVoucherHotelRows(booking).length))],
    ];
    detailRows.forEach((row, index) => {
      const rowY = y + 68 + index * 28;
      text(row[0], margin + 44, rowY, { color: navy, size: 7, style: "bold" });
      text(`: ${row[1]}`, margin + 122, rowY, {
        color: [31, 52, 74],
        size: bodyTextSize,
      });
      text(row[2], margin + 310, rowY, { color: navy, size: 7, style: "bold" });
      text(`: ${row[3]}`, margin + 407, rowY, {
        color: [31, 52, 74],
        size: bodyTextSize,
      });
    });
    y += 176;

    sectionTitle("HOTEL", y, "COMFORTABLE STAYS  -  GREAT LOCATIONS");
    rounded(margin, y + 42, pageWidth - margin * 2, 124);
    table(
      y + 54,
      [
        { label: "Destination", width: 130 },
        { label: "Hotel Name", width: 220 },
        { label: "Hotel Category", width: 95 },
        { label: "Night", width: 72 },
      ],
      getVoucherHotelRows(booking).map((row) => [
        row.destination,
        row.hotel,
        row.category,
        row.nights,
      ]),
      25
    );
    y += 184;

    sectionTitle("PASSENGERS", y, "TRAVELERS ON THIS BOOKING");
    rounded(margin, y + 42, pageWidth - margin * 2, 102);
    table(
      y + 54,
      [
        { label: "Full Name", width: 160 },
        { label: "Gender", width: 80 },
        { label: "Email", width: 170 },
        { label: "Phone", width: 107 },
      ],
      travellers.slice(0, 4).map((traveller) => [
        getGuestName(traveller) || "Traveller",
        traveller.gender || "-",
        traveller.email || primaryGuest?.email || "-",
        [traveller.countryCode, traveller.mobileNumber].filter(Boolean).join(" ") ||
          [primaryGuest?.countryCode, primaryGuest?.mobileNumber].filter(Boolean).join(" ") ||
          "-",
      ]),
      25
    );
    footer(1);

    pdf.addPage();
    header();
    y = 142;
    sectionTitle("FLIGHT", y, "JOURNEYS  -  CONNECTING DESTINATIONS  -  FLY TO EXPLORE");
    rounded(margin, y + 42, pageWidth - margin * 2, 150);
    table(
      y + 54,
      [
        { label: "From", width: 120 },
        { label: "To", width: 140 },
        { label: "Airline", width: 145 },
        { label: "Seats", width: 50 },
        { label: "Date Time", width: 62 },
      ],
      getVoucherFlightRows(booking).map((row) => [
        row.from,
        row.to,
        row.airline,
        row.seats,
        row.dateTime,
      ]),
      42
    );
    y += 212;

    sectionTitle("INCLUSION", y, "WHAT'S INCLUDED  -  TRAVEL WITH CONFIDENCE");
    rounded(margin, y + 42, pageWidth - margin * 2, 152);
    bulletList(getVoucherInclusions(booking), margin + 36, y + 66, pageWidth - margin * 2 - 66);
    y += 212;

    sectionTitle("EXCLUSION", y, "THINGS NOT INCLUDED  -  PLAN BETTER");
    rounded(margin, y + 42, pageWidth - margin * 2, 152);
    bulletList(getVoucherExclusions(booking), margin + 36, y + 66, pageWidth - margin * 2 - 66);
    footer(2);

    pdf.addPage();
    header();
    y = 142;
    sectionTitle("TERMS AND CONDITIONS", y, "TRAVEL  -  EXPLORE  -  DISCOVER");
    rounded(margin, y + 42, pageWidth - margin * 2, 142);
    bulletList(
      [
        "Carry valid government ID proof for every traveller.",
        "Report at the communicated location and time before departure.",
        "Airline schedules, baggage allowance and route changes are governed by airline rules.",
        "Any extra expenses due to delay, accident, illness or personal choices are payable by the traveller.",
        "Anything not specifically mentioned in inclusions remains excluded.",
      ],
      margin + 36,
      y + 66,
      pageWidth - margin * 2 - 66
    );
    y += 202;

    sectionTitle("BOOKING SUMMARY", y, "JOURNEYS  -  HERITAGE  -  MEMORABLE EXPERIENCES");
    rounded(margin, y + 42, pageWidth - margin * 2, 72);
    text("BOOKING DATE", margin + 82, y + 76, {
      color: navy,
      size: 7,
      style: "bold",
    });
    text(formatDate(booking.booking.createdAt), margin + 82, y + 93, {
      color: navy,
      size: 12,
      style: "bold",
    });
    text("DUE DATE", margin + 345, y + 76, {
      color: navy,
      size: 7,
      style: "bold",
    });
    text(formatDate(booking.booking.balanceDueDate || booking.booking.createdAt), margin + 345, y + 93, {
      color: navy,
      size: 12,
      style: "bold",
    });
    y += 132;

    sectionTitle("PAYMENT DETAILS", y, "SECURE PAYMENTS  -  TRANSPARENT BILLING");
    const paymentPanelY = y + 42;
    const paymentPanelWidth = pageWidth - margin * 2;
    const paymentGridX = margin + 24;
    const paymentGridY = paymentPanelY + 24;
    const paymentCardGap = 8;
    const paymentCardWidth = (paymentPanelWidth - 48 - paymentCardGap) / 2;
    const paymentCardHeight = 24;
    const paymentItems = [
      ["BASIC AMOUNT", formatPdfCurrency(subtotal, currency)],
      ["NET AMOUNT", formatPdfCurrency(subtotal + gstAmount, currency)],
      [`TAX AMOUNT (GST ${gstPercentage}%)`, formatPdfCurrency(gstAmount, currency)],
      ...(booking.booking.airfareExcluded || airFlightCharges > 0 ? [[booking.booking.airfareIncludedInTotal ? "Air-Flight Charges (Included in Total)" : "+ Air-Flight Charges (Additional)", booking.booking.airfareAddedAt || airFlightCharges > 0 ? formatPdfCurrency(airFlightCharges, currency) : "Air-Flight Charges: To Be Added"]] : []),
      ["OUTSTANDING BALANCE", formatPdfCurrency(getBalanceAmount(booking), currency)],
      ["TCS", "-"],
      ["DUE DATE", formatDate(booking.booking.balanceDueDate || booking.booking.createdAt)],
      ["ROUNDOFF", formatPdfCurrency(0, currency)],
      ["TOTAL PAID", formatPdfCurrency(getPaidAmount(booking), currency)],
    ];
    const paymentGridRowCount = Math.ceil(paymentItems.length / 2);
    const paymentGridHeight =
      paymentGridRowCount * paymentCardHeight +
      Math.max(0, paymentGridRowCount - 1) * paymentCardGap;
    const grandTotalY = paymentGridY + paymentGridHeight + 10;
    const paymentPanelHeight = grandTotalY - paymentPanelY + 40;

    rounded(margin, paymentPanelY, paymentPanelWidth, paymentPanelHeight);
    paymentItems.forEach(([label, value], index) => {
      const columnIndex = index % 2;
      const rowIndex = Math.floor(index / 2);
      const cardX = paymentGridX + columnIndex * (paymentCardWidth + paymentCardGap);
      const cardY = paymentGridY + rowIndex * (paymentCardHeight + 8);
      const fill = rowIndex % 2 === 0 ? [255, 255, 255] : [253, 250, 247];

      rounded(cardX, cardY, paymentCardWidth, paymentCardHeight, fill as [number, number, number]);
      text(label, cardX + 10, cardY + (label.includes("Air-Flight Charges") ? 8 : 15.5), {
        color: navy,
        size: 7.2,
        style: "bold",
      });
      text(value, cardX + paymentCardWidth - 10, cardY + (label.includes("Air-Flight Charges") ? 21 : 15.5), {
        align: "right",
        color: [31, 52, 74],
        size: 9.8,
      });
    });

    rounded(margin + 24, grandTotalY, paymentPanelWidth - 48, 30, paleOrange);
    text(booking.booking.airfareExcluded && !booking.booking.airfareAddedAt && !airFlightCharges ? "CURRENT TOTAL (EXCLUDING AIRFARE)" : "GRAND TOTAL", margin + 44, grandTotalY + 20, {
      color: navy,
      size: 8,
      style: "bold",
    });
    text(formatPdfCurrency(totalAmount, currency), pageWidth - margin - 44, grandTotalY + 20, {
      align: "right",
      color: navy,
      size: 12,
      style: "bold",
    });

    y += paymentPanelHeight + 60;
    if (booking.booking.airfareExcluded && !booking.booking.airfareAddedAt && !airFlightCharges) {
      pdf.setFontSize(8);
      const noteLines = pdf.splitTextToSize(AIRFARE_NOTE, pageWidth - margin * 2);
      pdf.text(noteLines, margin, y);
      y += noteLines.length * 10 + 12;
    }
    rounded(margin, y, pageWidth - margin * 2, 64);
    text("CUSTOMER'S SIGNATURE", margin + 66, y + 21, {
      color: navy,
      size: 7,
      style: "bold",
    });
    pdf.setDrawColor(...lineColor);
    pdf.line(margin + 66, y + 44, margin + 280, y + 44);
    text("BOOKED BY", margin + 390, y + 21, {
      color: navy,
      size: 7,
      style: "bold",
    });
    text("Ancient Trails", margin + 390, y + 38, {
      color: [31, 52, 74],
      size: bodyTextSize,
    });
    footer(3);

    pdf.save(`${reference}-Ancient-Trails-Booking-Voucher.pdf`);
  } catch (error) {
    console.error("Booking voucher PDF download failed", error);
    window.alert("Booking voucher PDF could not be downloaded. Please try again.");
  }
}

async function downloadBookingInvoicePdf(booking: UserBooking) {
  const currency = booking.booking.paymentCurrency || "INR";
  const airFlightCharges = booking.booking.airFlightCharges || 0;
  const reference = getUserBookingReference(booking);
  const invoiceNumber = getInvoiceNumber(booking);
  const leadGuest = booking.booking.guestDetails[0];
  const travellers =
    booking.booking.travellers.length > 0
      ? booking.booking.travellers
      : booking.booking.guestDetails.map((guest, index) => ({
          ...guest,
          id: `guest-${index + 1}`,
          type:
            index < booking.booking.adultCount
              ? ("adult" as const)
              : ("child" as const),
        }));
  const lineItems = getFinalInvoiceLineItems(booking);
  const totalAmount = getTotalAmount(booking);
  const paidAmount = getPaidAmount(booking);
  const balanceAmount = getBalanceAmount(booking);
  const issueDate = formatDate(booking.booking.createdAt);
  const paymentDate = formatDate(
    booking.booking.paymentCapturedAt || booking.booking.updatedAt
  );

  try {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      format: "a4",
      orientation: "portrait",
      unit: "pt",
    });
    const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 30, width = pageWidth - 60, gap = 10, half = (width - gap) / 2;
    let y = margin;
    const contact = await getPublicSiteSettings().then(r => r.data.settings.contact).catch(() => defaultSiteContactSettings);
    const text = (value: string, x: number, top: number, size = 9, bold = false, align: "left" | "right" = "left", accent = false) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size);
      if (accent) pdf.setTextColor(214, 106, 26); else pdf.setTextColor(30, 41, 59);
      pdf.text(value, x, top, { align });
    };
    const wrap = (value: string, w: number, size = 9): string[] => {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(size); return pdf.splitTextToSize(value, w);
    };
    const box = (x: number, top: number, w: number, h: number, shaded = false) => {
      pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.6);
      if (shaded) pdf.setFillColor(253, 245, 237); else pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, top, w, h, 7, 7, "FD");
    };
    const ensure = (h: number) => {
      if (y + h > pageHeight - margin) { pdf.addPage(); y = margin; text("Ancient Trails | Invoice " + invoiceNumber, margin, y, 9, true); y += 20; }
    };
    const panelLines = (items: string[], w: number) => items.flatMap(item => wrap(item, w));
    const panels = (leftTitle: string, left: string[], rightTitle: string, right: string[]) => {
      const a = panelLines(left, half - 24), b = panelLines(right, half - 24);
      const h = 42 + Math.max(a.length, b.length) * 12; ensure(h);
      box(margin, y, half, h); box(margin + half + gap, y, half, h);
      text(leftTitle, margin + 12, y + 20, 9, true); text(rightTitle, margin + half + gap + 12, y + 20, 9, true);
      a.forEach((line, i) => text(line, margin + 12, y + 38 + i * 12));
      b.forEach((line, i) => text(line, margin + half + gap + 12, y + 38 + i * 12)); y += h + gap;
    };
    const logo = await loadPdfImageDataUrl(await fetchSiteLogoUrl());
    if (logo) {
      const image = pdf.getImageProperties(logo), w = Math.min(145, 45 * image.width / image.height);
      pdf.addImage(logo, "PNG", margin, y, w, w * image.height / image.width);
    } else text("Ancient Trails", margin, y + 24, 21, true, "left", true);
    text("INVOICE", pageWidth - margin, y + 10, 10, true, "right", true);
    text("Invoice No: " + invoiceNumber, pageWidth - margin, y + 29, 9, true, "right");
    text("Invoice Date: " + paymentDate, pageWidth - margin, y + 43, 9, false, "right");
    text("Booking ID: " + reference, pageWidth - margin, y + 57, 9, true, "right");
    y += 72; pdf.setDrawColor(226, 232, 240); pdf.line(margin, y, pageWidth - margin, y); y += gap;
    panels("ANCIENT TRAILS", [contact.officeAddress, contact.emailId ? "Email: " + contact.emailId : "",
      "Phone: " + [...new Set([contact.primaryCalling, contact.secondaryCalling, contact.landline].filter(Boolean))].join(" | "),
      contact.whatsapp ? "WhatsApp: " + contact.whatsapp : ""].filter(Boolean), "BILL TO", [getGuestName(leadGuest) || "Traveller",
      "Email: " + (leadGuest?.email || "-"), "Phone: " + [leadGuest?.countryCode, leadGuest?.mobileNumber].filter(Boolean).join(" "), leadGuest?.address || "-"]);
    const detailFields = [
      ["Tour", getUserBookingTitle(booking)], ["Duration", getUserBookingDuration(booking)],
      ["Departure", formatDate(booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate)], ["Guests", getUserBookingTravellerLabel(booking)],
      ["Return", formatDate(booking.departure?.returnDate || booking.booking.pricingSnapshot?.returnDate)], ["Destination", getUserBookingLocation(booking)],
    ];
    const heights = Array.from({ length: 3 }, (_, row) => Math.max(...detailFields.slice(row * 2, row * 2 + 2).map(([, v]) => wrap(v, half - 95).length)) * 12 + 12);
    const detailHeight = 36 + heights.reduce((sum, h) => sum + h, 0); ensure(detailHeight); box(margin, y, width, detailHeight);
    text("TOUR DETAILS", margin + 12, y + 20, 9, true); let top = y + 38;
    detailFields.forEach(([label, value], i) => {
      const x = margin + 12 + i % 2 * (half + gap); text(label, x, top, 8);
      wrap(value, half - 95).forEach((line, row) => text(line, x + 75, top + row * 12, 8, true));
      if (i % 2) top += heights[Math.floor(i / 2)];
    }); y += detailHeight + gap;
    const tableHeader = () => {
      box(margin, y, width, 27, true); text("Description", margin + 12, y + 18, 9, true);
      text("Qty", pageWidth - 185, y + 18, 9, true, "right"); text("Rate (" + currency + ")", pageWidth - 112, y + 18, 8, true, "right");
      text("Amount (" + currency + ")", pageWidth - margin - 12, y + 18, 8, true, "right"); y += 27;
    };
    ensure(62); tableHeader();
    for (const item of lineItems) {
      const description = wrap(item.description, width - 230), h = Math.max(32, description.length * 12 + 16);
      if (y + h > pageHeight - margin) { ensure(h + 27); tableHeader(); }
      box(margin, y, width, h); description.forEach((line, i) => text(line, margin + 12, y + 18 + i * 12, 9, true));
      text(String(item.quantity), pageWidth - 185, y + 18, 9, false, "right"); text(formatPdfAmount(item.rate), pageWidth - 112, y + 18, 9, false, "right");
      text(formatPdfAmount(item.amount), pageWidth - margin - 12, y + 18, 9, true, "right"); y += h;
    } y += gap;
    const rows = [
      ["Subtotal (Taxable Value)", formatPdfCurrency(booking.booking.subtotal || 0, currency)],
      ["GST (" + (booking.booking.gstPercentage || 0) + "%)", formatPdfCurrency(booking.booking.gstAmount || 0, currency)],
      ...(airFlightCharges > 0 ? [[booking.booking.airfareIncludedInTotal ? "Airfare (Included)" : "Additional Airfare", formatPdfCurrency(airFlightCharges, currency)]] : []),
      [booking.booking.airfareExcluded && !booking.booking.airfareAddedAt && !airFlightCharges ? "Total (Excluding Airfare)" : "Total Payable", formatPdfCurrency(totalAmount, currency)],
      ["Amount Paid", formatPdfCurrency(paidAmount, currency)], ["Balance Due", formatPdfCurrency(balanceAmount, currency)],
    ];
    const note = "This invoice covers the confirmed tour package and charges listed here. Please retain it for your records." +
      (booking.booking.airfareExcluded && !booking.booking.airfareAddedAt && !airFlightCharges ? " " + AIRFARE_NOTE : "");
    const noteLines = wrap(note, half - 24, 8), h = Math.max(40 + rows.length * 24, 42 + noteLines.length * 11);
    ensure(h); box(margin, y, half, h, true); box(margin + half + gap, y, half, h);
    text("NOTE", margin + 12, y + 20, 9, true, "left", true); noteLines.forEach((line, i) => text(line, margin + 12, y + 38 + i * 11, 8));
    text("TOTALS", margin + half + gap + 12, y + 20, 9, true);
    rows.forEach(([label, value], i) => {
      text(label, margin + half + gap + 12, y + 43 + i * 24, 8, label.startsWith("Total"));
      text(value, pageWidth - margin - 12, y + 43 + i * 24, 9, true, "right", label.startsWith("Total"));
    }); y += h + gap;
    panels("PAYMENT DETAILS", ["Mode: " + formatBookingPaymentMethod(booking.booking),
      "Transaction ID: " + (booking.booking.paymentId || booking.booking.paymentOrderId || "-"), "Payment Date: " + paymentDate,
      "Issue Date: " + issueDate, "Payment Status: FULLY PAID"], "For Ancient Trails", ["", "", "", "Authorized Signatory"]);
    pdf.save(`${invoiceNumber}-Ancient-Trails-Final-Invoice.pdf`);
    return;
  } catch (error) {
    console.error("Final invoice PDF download failed", error);
  }

  const lines = [
    "Ancient Trails",
    "Final Invoice",
    "",
    `Invoice: ${reference}`,
    `Issued: ${formatDate(booking.booking.createdAt)}`,
    `Booking ID: ${getUserBookingReference(booking)}`,
    "",
    "Traveller",
    `Name: ${getGuestName(leadGuest) || "Traveller"}`,
    `Email: ${leadGuest?.email || "-"}`,
    `Mobile: ${[leadGuest?.countryCode, leadGuest?.mobileNumber].filter(Boolean).join(" ") || "-"}`,
    "",
    "Tour",
    `Tour: ${getUserBookingTitle(booking)}`,
    `Destination: ${getUserBookingLocation(booking)}`,
    `Departure: ${formatDate(booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate)}`,
    `Return: ${formatDate(booking.departure?.returnDate || booking.booking.pricingSnapshot?.returnDate)}`,
    `Duration: ${getUserBookingDuration(booking)}`,
    `Travellers: ${getUserBookingTravellerLabel(booking)}`,
    "",
    "Payment Summary",
    `Tour Package Amount: ${formatPdfCurrency(getTourPackageAmount(booking), currency)}`,
    ...(booking.booking.airfareExcluded || airFlightCharges > 0 ? [
      booking.booking.airfareIncludedInTotal ? "Air-Flight Charges (Included in Total)" : "+ Air-Flight Charges (Additional)",
      booking.booking.airfareAddedAt || airFlightCharges > 0 ? `Air-Flight Charges: ${formatPdfCurrency(airFlightCharges, currency)}` : "Air-Flight Charges: To Be Added",
      ...(!booking.booking.airfareAddedAt && !airFlightCharges ? [AIRFARE_NOTE] : []),
    ] : []),
    `Total Booking Amount: ${formatPdfCurrency(getTotalAmount(booking), currency)}`,
    `Amount Paid: ${formatPdfCurrency(getPaidAmount(booking), currency)}`,
    `Balance Amount: ${formatPdfCurrency(getBalanceAmount(booking), currency)}`,
    `Payment Status: ${booking.booking.paymentStatus || "pending"}`,
    `Payment Reference: ${booking.booking.paymentId || booking.booking.paymentOrderId || "-"}`,
    "",
    "Traveller Details",
    ...travellers.map(
      (traveller, index) =>
        `${index + 1}. ${getGuestName(traveller) || `Traveller ${index + 1}`} - ${traveller.type}`
    ),
    "",
    "This invoice is generated from your Ancient Trails booking dashboard.",
  ];

  downloadBlob(buildSimplePdf(lines), `${reference.toLowerCase()}-invoice.pdf`);
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

function getTourPackageAmount(booking: UserBooking) {
  if (booking.booking.airfareIncludedInTotal) return getTotalAmount(booking);
  return Math.max(
    0,
    getTotalAmount(booking) - (booking.booking.airFlightCharges || 0)
  );
}

function getPaidAmount(booking: UserBooking) {
  if (booking.booking.amountPaid && booking.booking.amountPaid > 0) {
    return booking.booking.amountPaid;
  }

  const totalAmount = getTotalAmount(booking);

  if (typeof booking.booking.balanceAmount === "number" && totalAmount > 0) {
    return Math.max(0, totalAmount - booking.booking.balanceAmount);
  }

  return 0;
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

function getBookingTravellers(booking: UserBooking): DisplayTraveller[] {
  return booking.booking.travellers.length > 0
    ? booking.booking.travellers
    : booking.booking.guestDetails.map((guest, index) => ({
        ...guest,
        ageOnDeparture: undefined,
        id: `guest-${index + 1}`,
        kycDocuments: [],
        type:
          index < booking.booking.adultCount
            ? ("adult" as const)
            : ("child" as const),
      }));
}

function isInternationalBooking(booking: UserBooking) {
  const countryRegion = booking.destination?.countryRegion.trim().toLowerCase() || "";
  const leadCountryCode = booking.booking.guestDetails[0]?.countryCode || "";

  return Boolean(countryRegion && countryRegion !== "india") || leadCountryCode !== "+91";
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
        <Icon className="size-4 text-brand-text" strokeWidth={1.8} />
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
        <span className="block font-sans text-[10px] font-bold uppercase leading-none text-brand-text">
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
  const tourPackageAmount = getTourPackageAmount(booking);
  const paidAmount = getPaidAmount(booking);
  const balanceAmount = getBalanceAmount(booking);
  const airFlightCharges = booking.booking.airFlightCharges || 0;
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
        <SummaryRow label="Tour Package Amount" value={formatCurrency(tourPackageAmount, currency)} />
<AirfareDisclosure excluded={booking.booking.airfareExcluded} amount={airFlightCharges} addedAt={booking.booking.airfareAddedAt} includedInTotal={booking.booking.airfareIncludedInTotal} />
        <SummaryRow
          label={booking.booking.airfareExcluded && !booking.booking.airfareAddedAt && !airFlightCharges ? "Current Total (Excluding Airfare)" : "Total Booking Amount"}
          value={formatCurrency(totalAmount, currency)}
          valueClassName="text-secondary"
        />
        <SummaryRow
          label="Amount Paid"
          value={formatCurrency(paidAmount, currency)}
          valueClassName="text-emerald-700"
        />
        <SummaryRow
          label="Balance Amount"
          value={formatCurrency(balanceAmount, currency)}
          valueClassName={hasBalance ? "text-brand-text text-[18px]" : "text-emerald-700"}
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
          className="mt-3 w-full px-5 font-normal"
        >
          {buttonLabel}
        </Button>
        {hasBalance ? <BankTransferBalanceLink bookingId={booking.booking.id} disabled={isBusy} /> : null}
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
      date: getBookingPaymentState(booking.booking).canDownloadReceipt ? "Available now" : "After payment verification",
      done: getBookingPaymentState(booking.booking).canDownloadReceipt,
      title: "Payment Receipt",
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
                item.done ? "text-brand-text" : "text-secondary/35"
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

function HelpCard({ contact }: { contact: SiteContactSettings }) {
  const callDisplay = getContactCallDisplay(contact);
  const callNumber =
    contact.primaryCalling ||
    contact.landline ||
    defaultSiteContactSettings.primaryCalling;
  const emailAddress = getContactEmailDisplay(contact);

  return (
    <article className="rounded-[8px] border border-primary/15 bg-primary/5 p-4 shadow-[0_12px_28px_rgba(67,43,27,0.05)]">
      <h2 className="font-heading text-[16px] font-bold leading-tight text-secondary">
        Need help with your booking?
      </h2>
      <p className="mt-1.5 font-sans text-[12px] font-medium leading-[1.55] text-secondary/65">
        Contact the Ancient Trails team for assistance.
      </p>
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2">
        <Link
          href={getTelephoneHref(callNumber)}
          className="inline-flex min-h-11 min-w-0 items-center justify-start gap-2 rounded-[6px] border border-button-outline bg-white px-3 py-2.5 font-sans text-[12px] font-bold leading-snug text-button-outline transition-colors hover:border-button-outline hover:text-button-outline"
        >
          <Phone className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 break-words">{callDisplay || "Call Us"}</span>
        </Link>
        <Link
          href={getMailtoHref(emailAddress)}
          className="inline-flex min-h-11 min-w-0 items-center justify-start gap-2 rounded-[6px] border border-button-outline bg-white px-3 py-2.5 font-sans text-[12px] font-bold leading-snug text-button-outline transition-colors hover:border-button-outline hover:text-button-outline"
        >
          <Mail className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 break-words">{emailAddress}</span>
        </Link>
      </div>
    </article>
  );
}

function TravellerDetails({ booking }: { booking: UserBooking }) {
  const travellers = getBookingTravellers(booking);

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
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 font-sans text-[12px] font-bold text-brand-text">
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
              <span className="shrink-0 rounded-full border border-primary/25 bg-white px-2.5 py-1 font-sans text-[10px] font-bold text-brand-text">
                {travellerType}
              </span>
            </article>
          );
        })}
      </div>
    </DetailShell>
  );
}

function TravellerKycCard({
  documentOptions,
  isUploading,
  onUpload,
  traveller,
  travellerIndex,
}: {
  documentOptions: Array<{ label: string; value: KycDocumentType }>;
  isUploading: boolean;
  onUpload: (payload: {
    documentType: KycDocumentType;
    file: File;
    travellerId: string;
  }) => Promise<void>;
  traveller: DisplayTraveller;
  travellerIndex: number;
}) {
  const [documentType, setDocumentType] = useState<KycDocumentType>(
    documentOptions[0]?.value || "driving_license"
  );
  const [feedback, setFeedback] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const travellerName =
    getGuestName(traveller) || `Traveller ${travellerIndex + 1}`;
  const documents = traveller.kycDocuments || [];

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const fileName = event.target.files?.[0]?.name || "";
    setSelectedFileName(fileName);
    setFeedback(
      fileName ? "File selected. Click Upload to save this document." : ""
    );
  }

  function handleRemoveSelectedFile() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSelectedFileName("");
    setFeedback("");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("kycFile") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setFeedback("Choose a file before uploading.");
      return;
    }

    try {
      setFeedback("");
      await onUpload({
        documentType,
        file,
        travellerId: traveller.id,
      });
      form.reset();
      setSelectedFileName("");
      setFeedback("Document uploaded.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Document could not be uploaded."
      );
    }
  }

  return (
    <article className="rounded-[7px] border border-border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate font-sans text-[13px] font-bold text-secondary">
            {travellerName}
          </h3>
          <p className="mt-1 font-sans text-[11px] font-semibold text-secondary/55">
            {traveller.type === "child" ? "Child traveller" : "Adult traveller"}
          </p>
        </div>
        <span className="w-fit rounded-full border border-primary/20 bg-white px-2.5 py-1 font-sans text-[10px] font-bold text-brand-text">
          {documents.length} uploaded
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {documents.length > 0 ? (
          documents.map((document) => (
            <a
              key={document.id}
              href={getBookingKycDocumentUrl(document.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center justify-between gap-3 rounded-[6px] border border-button-outline bg-white px-3 py-2 font-sans text-[11px] font-bold text-button-outline transition-colors hover:border-button-outline hover:text-button-outline"
            >
              <span className="min-w-0 truncate">
                {document.documentLabel}
                <span className="font-medium text-secondary/45">
                  {" "}
                  - {document.uploadedBy}
                </span>
              </span>
              <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.8} />
            </a>
          ))
        ) : (
          <p className="rounded-[6px] border border-dashed border-primary/20 bg-white px-3 py-2 font-sans text-[11px] font-semibold text-secondary/55">
            No KYC document uploaded yet.
          </p>
        )}
      </div>

      <form onSubmit={handleUpload} className="mt-3 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value as KycDocumentType)}
          className="h-9 rounded-[6px] border border-border bg-white px-2 font-sans text-[11px] font-bold text-secondary outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
        >
          {documentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          name="kycFile"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="h-9 rounded-[6px] border border-border bg-white px-2 py-1 font-sans text-[11px] font-semibold text-secondary file:mr-2 file:rounded-[5px] file:border-0 file:bg-brand-button-dark file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-white"
        />
        <Button
          type="submit"
          disabled={isUploading}
          className="h-9 gap-2 px-4 text-[12px] font-normal"
        >
          <Upload className="size-3.5" strokeWidth={1.8} />
          {isUploading ? "Uploading" : "Upload"}
        </Button>
      </form>
      {feedback ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={cn(
              "font-sans text-[11px] font-semibold",
              selectedFileName ? "text-brand-text" : "text-secondary/55"
            )}
          >
            {feedback}
          </p>
          {selectedFileName ? (
            <button
              type="button"
              onClick={handleRemoveSelectedFile}
              className="flex w-fit items-center gap-1.5 font-sans text-[11px] font-bold text-button-outline transition-colors hover:text-button-outline"
            >
              <Trash2 className="size-3.5" strokeWidth={1.8} />
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function BookingKycDocuments({
  booking,
  isUploading,
  onUpload,
}: {
  booking: UserBooking;
  isUploading: boolean;
  onUpload: (payload: {
    documentType: KycDocumentType;
    file: File;
    travellerId: string;
  }) => Promise<void>;
}) {
  const travellers = getBookingTravellers(booking);
  const documentOptions = isInternationalBooking(booking)
    ? internationalKycDocumentOptions
    : domesticKycDocumentOptions;

  return (
    <div id="kyc-documents" className="scroll-mt-5">
      <DetailShell icon={FileText} title="KYC Documents">
        <div className="grid gap-3">
          <p className="font-sans text-[12px] font-semibold leading-[1.55] text-secondary/62">
            Upload identity documents for each traveller in this booking.
          </p>
          {travellers.map((traveller, index) => (
            <TravellerKycCard
              key={traveller.id || index}
              documentOptions={documentOptions}
              isUploading={isUploading}
              onUpload={onUpload}
              traveller={traveller}
              travellerIndex={index}
            />
          ))}
        </div>
      </DetailShell>
    </div>
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
      {(booking.booking.collectionHistory || []).map(entry => <p key={entry.paymentId} className="mb-2 text-sm">
        {formatCurrency(entry.amount, currency)} received | Air-Flight Charges: {formatCurrency(entry.airfareAmount, currency)} | {entry.paymentId} | {formatDate(entry.paidAt)}
      </p>)}
      {paidAmount > 0 ? (
        <article className="flex flex-col gap-2 rounded-[7px] border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <strong className="block font-sans text-[13px] font-bold text-secondary">
              Total paid: {formatCurrency(paidAmount, currency)}
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
  const canDownloadInvoice = balanceAmount <= 0;
  const canDownloadVoucher =
    canDownloadInvoice &&
    getPaidAmount(booking) >= getTotalAmount(booking);

  return (
    <DetailShell icon={FileText} title="Booking Documents">
      <p className="mb-3 font-sans text-[12px] leading-relaxed text-secondary/65">{getBookingDocumentMessage(booking.booking)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><BookingPaymentReceipt booking={booking.booking} tourName={getUserBookingTitle(booking)} /></div>
        <article className="rounded-[7px] border border-border bg-background p-3">
          <h3 className="font-sans text-[13px] font-bold text-secondary">
            Final Invoice
          </h3>
          <p className="mt-1 font-sans text-[11px] font-semibold text-secondary/55">
            {canDownloadInvoice
              ? `Issued ${formatDate(booking.booking.createdAt)}`
              : "Available after final payment"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!canDownloadInvoice}
            onClick={() => downloadBookingInvoicePdf(booking)}
            className="mt-4 w-full gap-2 px-5 font-normal"
          >
            <Eye className="size-3.5" strokeWidth={1.8} />
            View / Download Invoice
          </Button>
        </article>
        <article className="rounded-[7px] border border-border bg-background p-3">
          <h3 className="font-sans text-[13px] font-bold text-secondary">
            Booking Voucher
          </h3>
          <p className="mt-1 font-sans text-[11px] font-semibold text-secondary/55">
            {canDownloadVoucher
              ? "Available for confirmed payment"
              : "Available after full payment"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!canDownloadVoucher}
            onClick={() => downloadBookingVoucherPdf(booking)}
            className="mt-4 w-full gap-2 px-5 font-normal"
          >
            <Download className="size-3.5" strokeWidth={1.8} />
            Download Voucher
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
          <p className="flex items-center gap-2 font-sans text-[11px] font-bold uppercase leading-none text-button-outline">
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
          <Button
            nativeButton={false}
            render={<Link href={getTourDetailHref(booking)} />}
            className="mt-6 px-5 font-normal"
          >
            View Tour Details
          </Button>
        </div>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="rounded-[8px] border border-border bg-white px-4 py-12 text-center shadow-[0_14px_34px_rgba(50,50,50,0.035)]">
      <Clock3 className="mx-auto size-9 text-brand-text" strokeWidth={1.8} />
      <p className="mt-3 font-sans text-[13px] font-bold text-secondary">
        Loading booking details...
      </p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-[8px] border border-primary/20 bg-white px-4 py-12 text-center shadow-[0_14px_34px_rgba(50,50,50,0.035)]">
      <HelpCircle className="mx-auto size-10 text-brand-text" strokeWidth={1.7} />
      <h1 className="mt-3 font-heading text-[24px] font-bold text-secondary">
        Booking details unavailable
      </h1>
      <p className="mx-auto mt-2 max-w-[520px] font-sans text-[13px] font-semibold leading-[1.6] text-secondary/62">
        {message}
      </p>
      <Button
        nativeButton={false}
        render={<Link href="/me/bookings" />}
        className="mt-5 px-5 font-normal"
      >
        Back to My Bookings
      </Button>
    </section>
  );
}

export function UserBookingDetailPage({ bookingId }: UserBookingDetailPageProps) {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [checkoutStatus, setCheckoutStatus] =
    useState<BalanceCheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isKycUploading, setIsKycUploading] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [paymentRetryMessage, setPaymentRetryMessage] = useState<string | null>(null);
  const [siteContact, setSiteContact] = useState<SiteContactSettings>(
    defaultSiteContactSettings
  );

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
    let didEndPaymentAttempt = false;
    const endPaymentAttempt = (reason?: string) => {
      if (isVerifying || didEndPaymentAttempt) return;
      didEndPaymentAttempt = true;
      const message = paymentFailureMessage(reason);
      setCheckoutStatus("idle");
      setPaymentFeedback(message);
      setPaymentRetryMessage(message);
    };
    const checkout = new razorpayWindow.Razorpay({
      amount: order.checkout.amount,
      currency: order.checkout.currency,
      description: order.checkout.description,
      handler: (paymentResponse) => {
        if (isVerifying) return;
        isVerifying = true;
        setPaymentRetryMessage(null);
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
          endPaymentAttempt();
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
      endPaymentAttempt(failureResponse.error?.description || failureResponse.error?.reason);
    });

    setCheckoutStatus("gateway_open");
    checkout.open();
  }

  async function handlePayBalance() {
    if (!booking || checkoutStatus !== "idle" || getBalanceAmount(booking) <= 0) {
      return;
    }

    setPaymentRetryMessage(null);
    setCheckoutStatus("creating");
    setPaymentFeedback("");

    try {
      const response = await createBookingBalancePaymentOrder(booking.booking.id);

      if ("paymentLinkUrl" in response.data) {
        window.location.assign(response.data.paymentLinkUrl);
        return;
      }

      await openBalanceRazorpayCheckout(response.data, booking);
    } catch (error) {
      setCheckoutStatus("idle");
      setPaymentFeedback(getPaymentErrorMessage(error));
    }
  }

  async function handleKycUpload(payload: {
    documentType: KycDocumentType;
    file: File;
    travellerId: string;
  }) {
    if (!booking || isKycUploading) {
      return;
    }

    setIsKycUploading(true);

    try {
      const response = await uploadTravellerBookingKycDocument({
        bookingId: booking.booking.id,
        ...payload,
      });

      setBookings((current) => replaceBooking(current, response.data.booking));
    } catch (error) {
      setPaymentFeedback(
        error instanceof Error
          ? error.message
          : "KYC document could not be uploaded."
      );
      throw error;
    } finally {
      setIsKycUploading(false);
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
      <PaymentRetryNotice message={paymentRetryMessage} busy={checkoutStatus !== "idle"} onRetry={() => void handlePayBalance()} onDismiss={() => setPaymentRetryMessage(null)} />
      <div className="mb-4">
        <p className="font-sans text-[12px] font-bold uppercase tracking-normal text-button-outline">
          Booking ID: {getUserBookingReference(booking)}
        </p>
        <p className="mt-2 font-sans text-[13px] font-medium leading-[1.6] text-secondary/64">
          {getBookingPaymentSummary(booking.booking)}
        </p>
      </div>

      <section data-booking-management-actions className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/20 bg-white p-4">
        <div>
          <p className="font-sans text-sm font-bold">Balance due: {formatCurrency(getBalanceAmount(booking), booking.booking.paymentCurrency || "INR")}</p>
          <p className="mt-1 font-sans text-xs text-secondary/65">{getBalanceAmount(booking) > 0 ? "Due " + formatDate(booking.booking.balanceDueDate, "date to be confirmed") : "Paid in full"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {getBalanceAmount(booking) > 0 ? <div>
            <Button type="button" disabled={checkoutStatus !== "idle"} onClick={() => void handlePayBalance()}>{checkoutStatus !== "idle" ? "Payment in progress..." : "Pay Balance " + formatCurrency(getBalanceAmount(booking), booking.booking.paymentCurrency || "INR")}</Button>
            <BankTransferBalanceLink bookingId={booking.booking.id} disabled={checkoutStatus !== "idle"} />
          </div> : null}
          <BookingCancellationRequestControl booking={booking.booking} departureDate={booking.departure?.departureDate || booking.booking.pricingSnapshot?.departureDate} disabled={checkoutStatus !== "idle"} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-5">
          <TourSummary booking={booking} />
          <TravellerDetails booking={booking} />
          <BookingKycDocuments
            booking={booking}
            isUploading={isKycUploading}
            onUpload={handleKycUpload}
          />
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
          <HelpCard contact={siteContact} />
        </aside>
      </div>
    </div>
  );
}
