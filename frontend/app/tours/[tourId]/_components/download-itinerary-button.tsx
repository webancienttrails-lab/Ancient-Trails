"use client";

import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  Download,
  MapPin,
  Route,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  getHomeMediaUrl,
  type PublicDestination,
  type PublicExpert,
  type PublicTour,
  type PublicTourDeparture,
} from "@/lib/home-travel";
import type { AccommodationOption } from "@/lib/tour-booking";

type BookingPaymentOption = "advance" | "full";

type TravellerCounts = {
  adults: number;
  children: number;
  infants: number;
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

type DownloadItineraryButtonProps = {
  accommodationOptions: AccommodationOption[];
  balanceAmount: number;
  balanceDueDate: Date | null;
  canBook: boolean;
  depositAmount: number;
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
};

type JsPdfDoc = import("jspdf").jsPDF;

type PdfFontFamily = {
  body: string;
  script: string;
};

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

const fallbackGalleryImages = [
  "/home assets/Khajuraho.webp",
  "/home assets/destination/Hampi.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Egypt.webp",
];

const PDF_FONT_PATHS = {
  bold: "/fonts/Montserrat-Bold.ttf",
  regular: "/fonts/Montserrat-Regular.ttf",
  semibold: "/fonts/Montserrat-SemiBold.ttf",
  script: "/fonts/PlayfairDisplay-Italic.ttf",
};

const TOUR_ICON_PATHS = {
  bus: "/Tour-assets/bus.png",
  footprint: "/Tour-assets/footprint.png",
  hotel: "/Tour-assets/hotel (1).png",
  meal: "/Tour-assets/meal.png",
  tourGuide: "/Tour-assets/tour-guide.png",
};

export function DownloadItineraryButton(props: DownloadItineraryButtonProps) {
  const [isDownloadingItinerary, setIsDownloadingItinerary] = useState(false);

  async function handleDownloadItinerary() {
    if (isDownloadingItinerary) return;

    setIsDownloadingItinerary(true);

    try {
      await downloadTourItineraryPdf(props);
    } catch (error) {
      console.error("Unable to download itinerary PDF", error);
    } finally {
      setIsDownloadingItinerary(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownloadItinerary}
      className="mt-2 inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-primary underline-offset-4 transition-colors hover:text-accent hover:underline disabled:pointer-events-none disabled:opacity-60"
      disabled={isDownloadingItinerary}
    >
      <Download className="size-4" />
      {isDownloadingItinerary ? "Preparing itinerary..." : "Download Itinerary"}
    </button>
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((value) => value?.trim() || "").filter(Boolean))
  );
}

function normalizePdfText(value: string) {
  return (value || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "To be confirmed";
  return `INR ${numberFormatter.format(Math.round(value))}`;
}

function formatCoverPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Price on request";
  return formatCurrency(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Coming Soon";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Coming Soon";

  return shortDateFormatter.format(date).replace(",", "");
}

function formatDateFromDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return "To be confirmed";
  return shortDateFormatter.format(value).replace(",", "");
}

function formatMonthYear(value: string | null | undefined) {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return monthFormatter.format(date).replace(",", "");
}

function getDayOfMonth(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return String(date.getDate()).padStart(2, "0");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

function getDepartureIdentifier(departure: PublicTourDeparture) {
  return departure.id || departure.departureId || departure.departureDate || "";
}

function getDateValue(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortDeparturesByDate(departures: PublicTourDeparture[]) {
  return departures
    .slice()
    .sort(
      (left, right) =>
        getDateValue(left.departureDate) - getDateValue(right.departureDate)
    );
}

function hasTravellerInfo(counts?: TravellerCounts | null) {
  if (!counts) return false;
  return [counts.adults, counts.children, counts.infants].some(
    (value) => Number.isFinite(value) && value > 0
  );
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
    .join(", ");
}

function getExpertRole(expert: PublicExpert) {
  return expert.expertiseTags[0] || expert.qualifications[0] || "Heritage Specialist";
}

function getExpertBio(expert: PublicExpert) {
  return (
    expert.fullBiography ||
    "A heritage researcher and cultural storyteller who brings history, architecture and local traditions into clear focus."
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
        "Airfare, visa and travel insurance unless specifically mentioned",
        "Personal expenses and optional activities",
        "Meals not mentioned in the itinerary",
        "Tips, porterage and camera charges",
      ];
}

function getTourWebsiteUrl(anchor = "") {
  const url = new URL(window.location.href);
  url.hash = anchor;
  return url.toString();
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function loadPdfFonts(doc: JsPdfDoc): Promise<PdfFontFamily> {
  try {
    const [regular, semibold, bold, script] = await Promise.all(
      Object.values(PDF_FONT_PATHS).map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Font not found: ${path}`);
        return response.arrayBuffer();
      })
    );

    doc.addFileToVFS("Montserrat-Regular.ttf", arrayBufferToBase64(regular));
    doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");

    doc.addFileToVFS("Montserrat-SemiBold.ttf", arrayBufferToBase64(semibold));
    doc.addFont("Montserrat-SemiBold.ttf", "Montserrat", "600");

    doc.addFileToVFS("Montserrat-Bold.ttf", arrayBufferToBase64(bold));
    doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");

    doc.addFileToVFS("PlayfairDisplay-Italic.ttf", arrayBufferToBase64(script));
    doc.addFont("PlayfairDisplay-Italic.ttf", "PlayfairDisplay", "italic");

    return { body: "Montserrat", script: "PlayfairDisplay" };
  } catch (error) {
    console.warn(
      "PDF custom fonts could not be loaded. Falling back to built-in fonts.",
      error
    );
    return { body: "helvetica", script: "times" };
  }
}

type ImageDataOptions = {
  targetAspect?: number;
  maxWidth?: number;
  maxHeight?: number;
  preserveTransparency?: boolean;
  quality?: number;
};

async function getImageDataUrl(
  source: string,
  options: ImageDataOptions = {}
) {
  const resolvedSource = source.trim()
    ? new URL(source, window.location.origin).toString()
    : "";

  if (!resolvedSource) return "";

  try {
    const response = await fetch(resolvedSource);
    if (!response.ok) throw new Error(`Image fetch failed: ${resolvedSource}`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;

      if (options.targetAspect && options.targetAspect > 0) {
        const imageAspect = sourceWidth / sourceHeight;

        if (imageAspect > options.targetAspect) {
          sourceWidth = sourceHeight * options.targetAspect;
          sourceX = (image.naturalWidth - sourceWidth) / 2;
        } else {
          sourceHeight = sourceWidth / options.targetAspect;
          sourceY = (image.naturalHeight - sourceHeight) / 2;
        }
      }

      const maxWidth = options.maxWidth || 1800;
      const maxHeight = options.maxHeight || 1800;
      const scale = Math.min(
        1,
        maxWidth / sourceWidth,
        maxHeight / sourceHeight
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));

      const context = canvas.getContext("2d");
      if (!context) return "";

      if (!options.preserveTransparency) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return canvas.toDataURL(
        options.preserveTransparency ? "image/png" : "image/jpeg",
        options.quality ?? 0.9
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.warn("Unable to load PDF image", source, error);
    return "";
  }
}

function getPdfImageFormat(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

type PdfLucideIconOptions = {
  accentColor?: string;
  color: string;
  size?: number;
  strokeWidth?: number;
};

async function renderLucideIconDataUrl(
  Icon: LucideIcon,
  options: PdfLucideIconOptions
) {
  const iconSize = options.size ?? 64;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.width = `${iconSize}px`;
  host.style.height = `${iconSize}px`;
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    root.render(
      createElement(Icon, {
        color: options.color,
        fill: "none",
        height: iconSize,
        size: iconSize,
        strokeWidth: options.strokeWidth ?? 1.8,
        width: iconSize,
      })
    );

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    const svg = host.querySelector("svg");
    if (!svg) return "";

    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serialized = new XMLSerializer().serializeToString(svg);
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = svgDataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = iconSize * 2;
    canvas.height = iconSize * 2;
    const context = canvas.getContext("2d");
    if (!context) return "";

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (options.accentColor) {
      const accentWidth = canvas.width * 0.42;
      const accentHeight = canvas.height * 0.3;
      const accentX = canvas.width - accentWidth - canvas.width * 0.08;
      const accentY = canvas.height - accentHeight - canvas.height * 0.12;
      const radius = canvas.width * 0.06;
      context.save();
      context.fillStyle = options.accentColor;
      context.globalAlpha = 0.9;
      context.beginPath();
      context.moveTo(accentX + radius, accentY);
      context.lineTo(accentX + accentWidth - radius, accentY);
      context.quadraticCurveTo(
        accentX + accentWidth,
        accentY,
        accentX + accentWidth,
        accentY + radius
      );
      context.lineTo(accentX + accentWidth, accentY + accentHeight - radius);
      context.quadraticCurveTo(
        accentX + accentWidth,
        accentY + accentHeight,
        accentX + accentWidth - radius,
        accentY + accentHeight
      );
      context.lineTo(accentX + radius, accentY + accentHeight);
      context.quadraticCurveTo(
        accentX,
        accentY + accentHeight,
        accentX,
        accentY + accentHeight - radius
      );
      context.lineTo(accentX, accentY + radius);
      context.quadraticCurveTo(accentX, accentY, accentX + radius, accentY);
      context.closePath();
      context.fill();
      context.restore();
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Unable to render Lucide icon for PDF", error);
    return "";
  } finally {
    root.unmount();
    host.remove();
  }
}

function getTourHighlights(itineraryDays: ItineraryDay[]) {
  return uniqueValues(
    itineraryDays.flatMap((day) => day.placesVisited || [])
  ).slice(0, 24);
}

function getTourStates(destinations: PublicDestination[]) {
  return uniqueValues(destinations.map((destination) => destination.state));
}

function extractPossibleImageUrls(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return [getHomeMediaUrl(trimmed) || trimmed];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractPossibleImageUrls(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directKeys = [
      "url",
      "src",
      "image",
      "imageUrl",
      "bannerImage",
      "thumbnailImage",
      "mediaUrl",
      "fileUrl",
      "path",
    ];

    const directMatches = directKeys.flatMap((key) =>
      extractPossibleImageUrls(record[key])
    );
    if (directMatches.length) return directMatches;

    const nestedKeys = [
      "gallery",
      "galleryImages",
      "images",
      "media",
      "mediaGallery",
      "tourImages",
      "sliderImages",
      "items",
    ];

    return nestedKeys.flatMap((key) => extractPossibleImageUrls(record[key]));
  }

  return [];
}

function getTourGallerySources(
  tour: PublicTour,
  destinations: PublicDestination[]
) {
  const tourRecord = tour as unknown as Record<string, unknown>;
  const destinationRecords = destinations as unknown as Array<Record<string, unknown>>;

  const collected = [
    tourRecord.galleryImages,
    tourRecord.gallery,
    tourRecord.images,
    tourRecord.mediaGallery,
    tourRecord.media,
    tourRecord.sliderImages,
    tourRecord.tourImages,
    tourRecord.bannerImage,
    tourRecord.thumbnailImage,
    ...destinationRecords.flatMap((destination) => [
      destination.galleryImages,
      destination.gallery,
      destination.images,
      destination.image,
      destination.imageUrl,
      destination.bannerImage,
      destination.thumbnailImage,
    ]),
  ].flatMap((item) => extractPossibleImageUrls(item));

  const unique = Array.from(
    new Set(collected.map((item) => item.trim()).filter(Boolean))
  );

  return (unique.length ? unique : fallbackGalleryImages.map((item) => getHomeMediaUrl(item) || item)).slice(0, 5);
}

async function downloadTourItineraryPdf(payload: DownloadItineraryButtonProps) {

  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const fonts = await loadPdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 34;
  const footerSafeArea = 42;
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = pageHeight - footerSafeArea;

  const colors = {
    accent: "#8C4A28",
    border: "#E6D8CB",
    cream: "#FFF8EF",
    deep: "#3D281E",
    gold: "#DCA457",
    ink: "#33251C",
    lightGold: "#F7E8D3",
    muted: "#F6EFE7",
    primary: "#C76B2B",
    secondary: "#6D3824",
    soft: "#FFFDF9",
    textMuted: "#7D6C60",
    white: "#FFFFFF",
  };

  const bookingUrl = getTourWebsiteUrl("departure-pricing");

  const setBody = (size = 9, color = colors.ink) => {
    doc.setFont(fonts.body, "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };

  const setSemiBold = (size = 9, color = colors.ink) => {
    doc.setFont(fonts.body, fonts.body === "Montserrat" ? "600" : "bold");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };

  const setBold = (size = 9, color = colors.ink) => {
    doc.setFont(fonts.body, "bold");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };

  const setScript = (size = 20, color = colors.secondary) => {
    doc.setFont(fonts.script, "italic");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };

  const wrapTextNoBreak = (text: string, width: number) => {
    const clean = normalizePdfText(text || "-");
    if (!clean) return ["-"];

    const words = clean.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (!currentLine || doc.getTextWidth(candidate) <= width) {
        currentLine = candidate;
        return;
      }

      lines.push(currentLine);
      // Never split a word. A rare extra-long token stays intact on its own line.
      currentLine = word;
    });

    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : ["-"];
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    width: number,
    options: {
      fontSize?: number;
      color?: string;
      lineHeight?: number;
      bold?: boolean;
      align?: "left" | "center" | "right";
    } = {}
  ) => {
    const fontSize = options.fontSize ?? 9;
    const lineHeight = options.lineHeight ?? fontSize + 4;

    if (options.bold) setBold(fontSize, options.color || colors.ink);
    else setBody(fontSize, options.color || colors.ink);

    const lines = wrapTextNoBreak(text || "-", width);
    doc.text(lines, x, y, { align: options.align || "left" });
    return y + lines.length * lineHeight;
  };

  const drawRule = (y: number, x1 = margin, x2 = pageWidth - margin) => {
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.6);
    doc.line(x1, y, x2, y);
  };

  const drawSmallDiamond = (x: number, y: number) => {
    doc.setFillColor(colors.gold);
    doc.triangle(x, y - 3, x + 3, y, x, y + 3, "F");
    doc.triangle(x, y - 3, x - 3, y, x, y + 3, "F");
  };

  const pdfIcons = {
    bed: "",
    calendar: "",
    check: "",
    cross: "",
    expert: "",
    hotel: "",
    meals: "",
    pin: "",
    route: "",
    sightseeing: "",
    transport: "",
    walk: "",
  };

  const drawPdfIcon = (
    dataUrl: string,
    x: number,
    y: number,
    size: number,
    fallbackColor = colors.secondary
  ) => {
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", x, y, size, size);
        return;
      } catch {
        // Keep a minimal fallback so a failed rasterized icon never breaks the PDF.
      }
    }

    doc.setDrawColor(fallbackColor);
    doc.setLineWidth(0.9);
    doc.circle(x + size / 2, y + size / 2, Math.max(2, size * 0.28), "S");
  };

  const drawFactIconCalendar = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.calendar, x, y, 14);

  const drawFactIconPin = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.pin, x, y, 14);

  const drawFactIconState = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.route, x, y, 14);

  const drawHotelIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.hotel, x, y, 28);

  const drawMealsIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.meals, x, y, 28);

  const drawTransportIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.transport, x, y, 28);

  const drawExpertIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.expert, x, y, 28);

  const drawSightseeingIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.sightseeing, x, y, 28);

  const drawMealMetaIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.meals, x, y, 13, colors.textMuted);

  const drawBedMetaIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.bed, x, y, 13, colors.textMuted);

  const drawWalkMetaIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.walk, x, y, 13, colors.textMuted);

  const drawCheckIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.check, x, y, 10, colors.primary);

  const drawCrossIcon = (x: number, y: number) =>
    drawPdfIcon(pdfIcons.cross, x, y, 10, colors.accent);

  const drawInnerHeader = (title?: string) => {
    doc.setFillColor(colors.cream);
    doc.rect(0, 0, pageWidth, 58, "F");
    doc.setFillColor(colors.primary);
    doc.rect(0, 0, 8, 58, "F");

    if (logoImage) {
      try {
        doc.addImage(
          logoImage,
          getPdfImageFormat(logoImage),
          margin,
          15,
          102,
          31
        );
      } catch {
        setBold(13, colors.deep);
        doc.text("ANCIENT TRAILS", margin, 34);
      }
    } else {
      setBold(13, colors.deep);
      doc.text("ANCIENT TRAILS", margin, 34);
    }

    setSemiBold(7.4, colors.textMuted);
    doc.text("CURATED HERITAGE JOURNEYS", margin + 112, 33);

    if (title) {
      setSemiBold(8, colors.secondary);
      const safeTitle = normalizePdfText(title);
      const titleLines = wrapTextNoBreak(safeTitle, 190) as string[];
      doc.text(titleLines.slice(0, 2), pageWidth - margin, 25, {
        align: "right",
      });
    }

    doc.setDrawColor(colors.border);
    doc.line(margin, 58, pageWidth - margin, 58);
  };

  let y = 82;

  const addContentPage = (title?: string) => {
    doc.addPage();
    drawInnerHeader(title || payload.tour.tourName);
    y = 82;
  };

  const ensureSpace = (height: number, title?: string) => {
    if (y + height <= contentBottom) return;
    addContentPage(title);
  };

  const drawSectionTitle = (
    title: string,
    options: {
      eyebrow?: string;
      keepWithNext?: number;
      spaceAfter?: number;
    } = {}
  ) => {
    const headingHeight = 31;
    ensureSpace(headingHeight + (options.keepWithNext ?? 0), title);

    setBold(14, colors.deep);
    doc.text(normalizePdfText(title), margin, y);
    doc.setDrawColor(colors.gold);
    doc.setLineWidth(2);
    doc.line(margin, y + 8, margin + 42, y + 8);
    doc.setLineWidth(0.6);
    y += options.spaceAfter ?? 28;
  };

  const drawSummaryCard = (
    title: string,
    rows: Array<[string, string]>,
    x: number,
    cardY: number,
    width: number
  ) => {
    const labelWidth = 122;
    const valueWidth = width - labelWidth - 28;
    const rowHeights = rows.map(([, value]) => {
      const lines = wrapTextNoBreak(
        normalizePdfText(value || "-"),
        valueWidth
      ) as string[];
      return Math.max(19, lines.length * 11 + 7);
    });
    const height = 42 + rowHeights.reduce((sum, item) => sum + item, 0);

    doc.setFillColor(colors.soft);
    doc.setDrawColor(colors.border);
    doc.roundedRect(x, cardY, width, height, 8, 8, "FD");
    doc.setFillColor(colors.cream);
    doc.roundedRect(x, cardY, width, 32, 8, 8, "F");
    doc.rect(x, cardY + 20, width, 12, "F");
    setBold(10, colors.deep);
    doc.text(normalizePdfText(title), x + 14, cardY + 20);

    let rowY = cardY + 49;
    rows.forEach(([label, value], index) => {
      setBody(8.2, colors.textMuted);
      doc.text(normalizePdfText(label), x + 14, rowY);
      setSemiBold(8.4, colors.ink);
      const lines = wrapTextNoBreak(
        normalizePdfText(value || "-"),
        valueWidth
      ) as string[];
      doc.text(lines, x + 14 + labelWidth, rowY);
      rowY += rowHeights[index];
    });

    return height;
  };

  const gallerySources = getTourGallerySources(payload.tour, payload.destinations);

  const [logoImage, ...galleryImages] = await Promise.all([
    getImageDataUrl("/Header Logo.png", {
      maxWidth: 900,
      maxHeight: 300,
      preserveTransparency: true,
    }),
    ...gallerySources.map((source, index) =>
      getImageDataUrl(source, {
        targetAspect: index === 0 ? 0.8 : 1.75,
        maxWidth: 1500,
        maxHeight: 1200,
        quality: 0.9,
      })
    ),
  ]);

  const [
    calendarIcon,
    pinIcon,
    routeIcon,
    hotelIcon,
    mealsIcon,
    transportIcon,
    expertIcon,
    sightseeingIcon,
    bedIcon,
    walkIcon,
    checkIcon,
    crossIcon,
  ] = await Promise.all([
    renderLucideIconDataUrl(CalendarDays, { color: colors.secondary }),
    renderLucideIconDataUrl(MapPin, { color: colors.secondary }),
    renderLucideIconDataUrl(Route, { color: colors.secondary }),
    getImageDataUrl(TOUR_ICON_PATHS.hotel, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    getImageDataUrl(TOUR_ICON_PATHS.meal, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    getImageDataUrl(TOUR_ICON_PATHS.bus, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    getImageDataUrl(TOUR_ICON_PATHS.tourGuide, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    getImageDataUrl(TOUR_ICON_PATHS.footprint, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    getImageDataUrl(TOUR_ICON_PATHS.hotel, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    getImageDataUrl(TOUR_ICON_PATHS.footprint, {
      maxHeight: 256,
      maxWidth: 256,
      preserveTransparency: true,
    }),
    renderLucideIconDataUrl(Check, { color: colors.primary, strokeWidth: 2.2 }),
    renderLucideIconDataUrl(X, { color: colors.accent, strokeWidth: 2.1 }),
  ]);

  Object.assign(pdfIcons, {
    bed: bedIcon,
    calendar: calendarIcon,
    check: checkIcon,
    cross: crossIcon,
    expert: expertIcon,
    hotel: hotelIcon,
    meals: mealsIcon,
    pin: pinIcon,
    route: routeIcon,
    sightseeing: sightseeingIcon,
    transport: transportIcon,
    walk: walkIcon,
  });

  const stateNames = getTourStates(payload.destinations);
  const sortedDepartures = sortDeparturesByDate(payload.departures);
  const highlights = getTourHighlights(payload.itineraryDays);
  const selectedDepartureId = payload.selectedDeparture
    ? getDepartureIdentifier(payload.selectedDeparture)
    : "";
  const selectedDeparture = payload.selectedDeparture;
  const startDate = selectedDeparture?.departureDate
    ? new Date(selectedDeparture.departureDate)
    : null;
  const safeStartDate =
    startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;
  const travellerSummary = hasTravellerInfo(payload.travellerCounts)
    ? formatTravellerSummary(payload.travellerCounts)
    : "";

  // ---------------------------------------------------------------------------
  // COVER PAGE - inspired by the Rajasthan Marwad brochure structure, but fully
  // re-skinned for Ancient Trails.
  // ---------------------------------------------------------------------------
  doc.setFillColor(colors.cream);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  setSemiBold(8.8, colors.secondary);
  doc.text("Call Us: +91 70286 67777", 26, 42);
  doc.text("Mail Us: holidays@ancienttrails.in", 26, 61);
  setBody(7.2, colors.textMuted);
  doc.text("History. Culture. Journeys with context.", 26, 81);

  if (logoImage) {
    try {
      doc.addImage(
        logoImage,
        getPdfImageFormat(logoImage),
        pageWidth - margin - 145,
        29,
        145,
        46
      );
    } catch {
      setBold(16, colors.deep);
      doc.text("ANCIENT TRAILS", pageWidth - margin, 52, { align: "right" });
    }
  } else {
    setBold(16, colors.deep);
    doc.text("ANCIENT TRAILS", pageWidth - margin, 52, { align: "right" });
  }

  const coverGalleryImages = galleryImages.filter(Boolean);

  if (coverGalleryImages.length) {
    doc.setFillColor(colors.muted);
    doc.roundedRect(margin, 93, contentWidth, 206, 3, 3, "F");
    const gap = 6;
    const leftWidth = coverGalleryImages.length > 1
      ? contentWidth * 0.31
      : contentWidth;
    const tileWidth = (contentWidth - leftWidth - gap * 2) / 2;
    const tileHeight = (206 - gap) / 2;
    const coverSlots = coverGalleryImages.length > 1
      ? [
          { x: margin, y: 93, width: leftWidth, height: 206 },
          {
            x: margin + leftWidth + gap,
            y: 93,
            width: tileWidth,
            height: tileHeight,
          },
          {
            x: margin + leftWidth + gap * 2 + tileWidth,
            y: 93,
            width: tileWidth,
            height: tileHeight,
          },
          {
            x: margin + leftWidth + gap,
            y: 93 + tileHeight + gap,
            width: tileWidth,
            height: tileHeight,
          },
          {
            x: margin + leftWidth + gap * 2 + tileWidth,
            y: 93 + tileHeight + gap,
            width: tileWidth,
            height: tileHeight,
          },
        ]
      : [{ x: margin, y: 93, width: contentWidth, height: 206 }];

    coverSlots.forEach((slot, index) => {
      const image = coverGalleryImages[index] || coverGalleryImages[0];
      try {
        doc.addImage(
          image,
          getPdfImageFormat(image),
          slot.x,
          slot.y,
          slot.width,
          slot.height
        );
      } catch {
        doc.setFillColor(colors.muted);
        doc.rect(slot.x, slot.y, slot.width, slot.height, "F");
      }
    });
  } else {
    doc.setFillColor(colors.muted);
    doc.roundedRect(margin, 93, contentWidth, 206, 3, 3, "F");
  }

  setScript(21, colors.secondary);
  doc.text("Explore", pageWidth / 2, 344, { align: "center" });

  const coverTitle = normalizePdfText(payload.tour.tourName);
  setBold(16, colors.deep);
  const coverTitleLines = wrapTextNoBreak(coverTitle, 430) as string[];
  doc.text(coverTitleLines.slice(0, 2), pageWidth / 2, 372, {
    align: "center",
  });

  const titleBottom = 372 + Math.max(0, coverTitleLines.length - 1) * 16;
  setBody(7.8, colors.textMuted);
  doc.text(
    `Tour ID: ${payload.tour.tourId || "Ancient Trails Curated Tour"}`,
    pageWidth / 2,
    titleBottom + 22,
    { align: "center" }
  );

  const factY = titleBottom + 54;
  const factCenters = [190, 300, 410];
  doc.setDrawColor(colors.border);
  doc.line(95, factY + 1, 144, factY + 1);
  drawSmallDiamond(151, factY + 1);
  drawSmallDiamond(pageWidth - 151, factY + 1);
  doc.line(pageWidth - 144, factY + 1, pageWidth - 95, factY + 1);

  drawFactIconCalendar(factCenters[0] - 29, factY - 6);
  setSemiBold(8.7, colors.ink);
  doc.text(getDurationLabel(payload.tour), factCenters[0] - 10, factY + 3);

  drawFactIconState(factCenters[1] - 28, factY - 5);
  doc.text(
    `${stateNames.length || 1} ${stateNames.length === 1 ? "State" : "States"}`,
    factCenters[1] - 8,
    factY + 3
  );

  drawFactIconPin(factCenters[2] - 30, factY - 7);
  doc.text(
    `${highlights.length || 1} ${highlights.length === 1 ? "Place" : "Places"}`,
    factCenters[2] - 10,
    factY + 3
  );

  const includesTitleY = factY + 58;
  setSemiBold(8.2, colors.secondary);
  doc.text("TOUR INCLUDES", pageWidth / 2, includesTitleY, {
    align: "center",
  });

  const includeTop = includesTitleY + 23;
  const iconCenters = [178, 238, 298, 358, 418];
  const includeIcons = [
    { label: "Hotel", draw: drawHotelIcon },
    { label: "Meals", draw: drawMealsIcon },
    { label: "Transport", draw: drawTransportIcon },
    { label: "Expert", draw: drawExpertIcon },
    { label: "Sightseeing", draw: drawSightseeingIcon },
  ];

  includeIcons.forEach((item, index) => {
    item.draw(iconCenters[index] - 12, includeTop);
    setBody(7.6, colors.ink);
    doc.text(item.label, iconCenters[index], includeTop + 41, {
      align: "center",
    });
  });

  const priceY = includeTop + 92;
  setBody(10, colors.ink);
  doc.text("All inclusive Price", pageWidth / 2, priceY, {
    align: "center",
  });
  setBold(34, colors.primary);
  doc.text(formatCoverPrice(payload.price), pageWidth / 2, priceY + 35, {
    align: "center",
  });
  setBody(10.5, colors.ink);
  doc.text("per person on twin sharing", pageWidth / 2, priceY + 58, {
    align: "center",
  });

  const ctaY = priceY + 94;
  doc.setFillColor(colors.primary);
  doc.roundedRect(pageWidth / 2 - 60, ctaY, 120, 29, 7, 7, "F");
  setBold(9.8, colors.white);
  doc.text("BOOK NOW", pageWidth / 2, ctaY + 19, {
    align: "center",
  });
  doc.link(pageWidth / 2 - 60, ctaY, 120, 29, {
    url: bookingUrl,
  });

  // ---------------------------------------------------------------------------
  // TOUR OVERVIEW PAGE
  // ---------------------------------------------------------------------------
  addContentPage();

  setScript(18, colors.secondary);
  doc.text("Your journey at a glance", margin, y);
  y += 26;

  setBold(21, colors.deep);
  const mainTitleLines = wrapTextNoBreak(coverTitle, contentWidth) as string[];
  doc.text(mainTitleLines, margin, y);
  y += mainTitleLines.length * 22 + 8;

  setBody(9.2, colors.textMuted);
  const descriptionLines = wrapTextNoBreak(
    normalizePdfText(
      payload.tour.description ||
        "A thoughtfully curated heritage journey combining architecture, culture, local stories and immersive experiences."
    ),
    contentWidth
  ) as string[];
  doc.text(descriptionLines, margin, y);
  y += descriptionLines.length * 13 + 18;

  const priceCardWidth = 218;
  const overviewGap = 12;
  const detailCardWidth = contentWidth - priceCardWidth - overviewGap;
  const cardTop = y;

  const departureDateText = selectedDeparture
    ? `${formatDate(selectedDeparture.departureDate)} - ${formatDate(
        selectedDeparture.returnDate
      )}`
    : sortedDepartures.length
      ? `${formatDate(sortedDepartures[0].departureDate)} onwards`
      : "Coming Soon";

  const priceSummaryRows: Array<[string, string]> = [
    ["From", `${formatCurrency(payload.price)} / person`],
    ["GST", `${payload.gstPercentage || 0}% (${formatCurrency(payload.gstAmount)})`],
    ...(travellerSummary ? [["Travellers", travellerSummary] as [string, string]] : []),
  ];

  const priceCardHeight = drawSummaryCard(
    "Tour Price",
    priceSummaryRows,
    margin,
    cardTop,
    priceCardWidth
  );

  const detailCardHeight = drawSummaryCard(
    "Tour Highlights",
    [
      ["Duration", getDurationLabel(payload.tour)],
      ["Departure", departureDateText],
      ["Difficulty", getDifficultyLabel(payload.tour)],
      ["Tour Expert", payload.expert.fullName],
      [
        "Availability",
        selectedDeparture?.seatsAvailable
          ? `${selectedDeparture.seatsAvailable} seats available`
          : payload.canBook
            ? "Open for booking"
            : "Please enquire",
      ],
    ],
    margin + priceCardWidth + overviewGap,
    cardTop,
    detailCardWidth
  );

  y += Math.max(priceCardHeight, detailCardHeight) + 18;

  if (highlights.length) {
    drawSectionTitle("Key Highlights", {
      eyebrow: "What you will experience",
      keepWithNext: 52,
    });
    const colGap = 18;
    const colWidth = (contentWidth - colGap) / 2;
    const leftItems = highlights.filter((_, index) => index % 2 === 0);
    const rightItems = highlights.filter((_, index) => index % 2 === 1);
    const maxRows = Math.max(leftItems.length, rightItems.length);

    for (let row = 0; row < maxRows; row += 1) {
      ensureSpace(22, "Key Highlights");

      [leftItems[row], rightItems[row]].forEach((item, column) => {
        if (!item) return;
        const x = margin + column * (colWidth + colGap);
        doc.setFillColor(colors.primary);
        doc.circle(x + 4, y - 2, 2.4, "F");
        setBody(8.5, colors.ink);
        const lines = wrapTextNoBreak(
          normalizePdfText(item),
          colWidth - 14
        ) as string[];
        doc.text(lines, x + 12, y);
      });

      y += 22;
    }
    y += 8;
  }

  // ---------------------------------------------------------------------------
  // ITINERARY - timeline styling based on the reference brochure.
  // ---------------------------------------------------------------------------
  drawSectionTitle("Detailed Tour Itinerary", {
    eyebrow: "Day-by-day journey",
    keepWithNext: 78,
  });

  const drawTimelineMarker = (markerY: number) => {
    doc.setDrawColor(colors.gold);
    doc.setFillColor(colors.white);
    doc.circle(margin + 5, markerY, 5, "FD");
    doc.setFillColor(colors.primary);
    doc.circle(margin + 5, markerY, 1.7, "F");
  };

  const drawTimelineLine = (fromY: number, toY: number) => {
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([2, 3], 0);
    doc.line(margin + 5, fromY, margin + 5, toY);
    doc.setLineDashPattern([], 0);
  };

  const drawDayMetaItem = (
    icon: (x: number, y: number) => void,
    label: string,
    value: string,
    x: number,
    currentY: number,
    width: number
  ) => {
    icon(x, currentY - 8);
    setBody(8, colors.textMuted);
    const lines = wrapTextNoBreak(
      normalizePdfText(value),
      width - 20
    ) as string[];
    doc.text(lines, x + 20, currentY);
    return Math.max(14, lines.length * 10) + 6;
  };

  const estimateItineraryDayHeight = (day: ItineraryDay) => {
    const dayWidth = contentWidth - 22;
    const colGap = 22;
    const leftWidth = (dayWidth - colGap) * 0.55;
    const rightWidth = dayWidth - colGap - leftWidth;

    setSemiBold(10.5, colors.deep);
    const titleLines = wrapTextNoBreak(day.title, dayWidth - 120);

    setBody(8.5, colors.ink);
    const summaryLines = wrapTextNoBreak(day.summary, dayWidth);

    let leftHeight = 0;
    const places = day.placesVisited?.filter(Boolean) || [];
    if (places.length) {
      leftHeight = 15;
      setBody(7.9, colors.textMuted);
      places.forEach((place) => {
        leftHeight += Math.max(13, wrapTextNoBreak(place, leftWidth - 14).length * 10);
      });
    }

    let rightHeight = 0;
    setBody(8, colors.textMuted);
    [day.meals, day.hotels, day.walkingDifficulty].forEach((value) => {
      if (!value) return;
      rightHeight += 15 + wrapTextNoBreak(value, rightWidth - 20).length * 10;
    });

    if (!day.meals && !day.hotels && !day.walkingDifficulty) {
      rightHeight = 15 + wrapTextNoBreak(day.title, rightWidth - 20).length * 10;
    }

    const metaHeight = places.length || day.meals || day.hotels || day.walkingDifficulty
      ? Math.max(leftHeight, rightHeight) + 14
      : 0;

    return (
      Math.max(22, titleLines.length * 13 + 6) +
      summaryLines.length * 11.2 +
      8 +
      metaHeight +
      22
    );
  };

  const drawItineraryDay = (day: ItineraryDay) => {
    const contentX = margin + 22;
    const dayWidth = contentWidth - 22;
    const titleDate = safeStartDate
      ? formatDateFromDate(addDays(safeStartDate, day.dayNumber - 1))
      : "";
    const estimatedDayHeight = estimateItineraryDayHeight(day);
    const fullPageCapacity = contentBottom - 82;

    if (estimatedDayHeight <= fullPageCapacity && y + estimatedDayHeight > contentBottom) {
      addContentPage("Detailed Tour Itinerary");
    } else {
      ensureSpace(54, "Detailed Tour Itinerary");
    }
    const dayStartY = y;
    drawTimelineMarker(y - 3);
    setBody(8, colors.textMuted);
    doc.text(`Day ${day.dayNumber}${titleDate ? ` / ${titleDate}` : ""}`, contentX, y);
    setSemiBold(10.5, colors.deep);
    const dayTitleLines = wrapTextNoBreak(
      normalizePdfText(day.title),
      dayWidth - 120
    ) as string[];
    doc.text(dayTitleLines, contentX + 112, y);
    y += Math.max(22, dayTitleLines.length * 13 + 6);

    const summaryLines = wrapTextNoBreak(
      normalizePdfText(day.summary),
      dayWidth
    ) as string[];

    let summaryIndex = 0;
    while (summaryIndex < summaryLines.length) {
      const availableLines = Math.max(
        1,
        Math.floor((contentBottom - y - 32) / 11.2)
      );
      const chunk = summaryLines.slice(
        summaryIndex,
        summaryIndex + availableLines
      );
      setBody(8.5, colors.ink);
      doc.text(chunk, contentX, y);
      y += chunk.length * 11.2 + 8;
      summaryIndex += chunk.length;

      if (summaryIndex < summaryLines.length) {
        drawTimelineLine(dayStartY + 6, contentBottom - 10);
        addContentPage("Detailed Tour Itinerary");
        setSemiBold(8.2, colors.primary);
        doc.text(`Day ${day.dayNumber} continued`, contentX, y);
        y += 17;
      }
    }

    const places = day.placesVisited?.filter(Boolean) || [];
    const hasMeta = places.length || day.meals || day.hotels || day.walkingDifficulty;

    if (hasMeta) {
      ensureSpace(70, "Detailed Tour Itinerary");
      const metaTop = y + 2;
      const colGap = 22;
      const leftWidth = (dayWidth - colGap) * 0.55;
      const rightWidth = dayWidth - colGap - leftWidth;
      const leftX = contentX;
      const rightX = contentX + leftWidth + colGap;

      let leftY = metaTop;
      if (places.length) {
        setSemiBold(8.8, colors.deep);
        doc.text("Today's Sightseeing", leftX, leftY);
        leftY += 15;
        places.forEach((place) => {
          ensureSpace(16, "Detailed Tour Itinerary");
          doc.setFillColor(colors.gold);
          doc.circle(leftX + 3, leftY - 2, 1.5, "F");
          setBody(7.9, colors.textMuted);
          const lines = wrapTextNoBreak(
            normalizePdfText(place),
            leftWidth - 14
          ) as string[];
          doc.text(lines, leftX + 10, leftY);
          leftY += Math.max(13, lines.length * 10);
        });
      }

      let rightY = metaTop;
      if (day.meals) {
        rightY += drawDayMetaItem(
          drawMealMetaIcon,
          "Meals",
          day.meals,
          rightX,
          rightY,
          rightWidth
        );
      }
      if (day.hotels) {
        rightY += drawDayMetaItem(
          drawBedMetaIcon,
          "Hotels",
          day.hotels,
          rightX,
          rightY,
          rightWidth
        );
      }
      if (day.walkingDifficulty) {
        rightY += drawDayMetaItem(
          drawWalkMetaIcon,
          "Walking",
          day.walkingDifficulty,
          rightX,
          rightY,
          rightWidth
        );
      }

      if (!day.meals && !day.hotels && !day.walkingDifficulty) {
        drawDayMetaItem(
          drawBedMetaIcon,
          "Night stay",
          day.title,
          rightX,
          rightY,
          rightWidth
        );
      }

      y = Math.max(leftY, rightY) + 10;
    }

    drawTimelineLine(dayStartY + 7, y - 5);
    drawRule(y, contentX, pageWidth - margin);
    y += 20;
  };

  payload.itineraryDays.forEach(drawItineraryDay);

  // ---------------------------------------------------------------------------
  // DEPARTURES GRID
  // ---------------------------------------------------------------------------
  const selectedGuestSummary = travellerSummary || "1 Adult";
  ensureSpace(42, "Choose Your Preferred Departure");
  doc.setFillColor(colors.cream);
  doc.setDrawColor(colors.border);
  doc.roundedRect(margin, y, 230, 26, 13, 13, "FD");
  setSemiBold(8.3, colors.secondary);
  doc.text(`Selected guests: ${selectedGuestSummary}`, margin + 12, y + 17);
  y += 40;

  drawSectionTitle("Choose Your Preferred Departure", {
    eyebrow: "Available dates",
    keepWithNext: sortedDepartures.length ? 72 : 30,
  });

  if (sortedDepartures.length) {
    const tilesPerRow = 6;
    const gap = 8;
    const tileWidth = (contentWidth - gap * (tilesPerRow - 1)) / tilesPerRow;
    const tileHeight = 50;

    sortedDepartures.forEach((departure, index) => {
      const column = index % tilesPerRow;
      if (column === 0) ensureSpace(tileHeight + 12, "More Dates & Departures");

      const x = margin + column * (tileWidth + gap);
      const selected = getDepartureIdentifier(departure) === selectedDepartureId;
      const tileY = y;

      doc.setDrawColor(selected ? colors.primary : colors.border);
      doc.setFillColor(selected ? colors.cream : colors.soft);
      doc.roundedRect(x, tileY, tileWidth, tileHeight, 5, 5, "FD");

      setBody(6.7, colors.textMuted);
      doc.text(formatMonthYear(departure.departureDate), x + tileWidth / 2, tileY + 14, {
        align: "center",
      });
      setBold(11, selected ? colors.primary : colors.deep);
      doc.text(getDayOfMonth(departure.departureDate), x + tileWidth / 2, tileY + 31, {
        align: "center",
      });

      if (selected) {
        doc.setFillColor(colors.primary);
        doc.circle(x + tileWidth - 7, tileY + 7, 2.5, "F");
      }

      if (column === tilesPerRow - 1 || index === sortedDepartures.length - 1) {
        y += tileHeight + 10;
      }
    });

    y += 10;
  } else {
    y = drawText(
      "New departure dates will be announced soon.",
      margin,
      y,
      contentWidth,
      { fontSize: 9.2, color: colors.textMuted }
    );
    y += 12;
  }

  // ---------------------------------------------------------------------------
  // ACCOMMODATION & PRICE TABLES
  // ---------------------------------------------------------------------------
  drawSectionTitle("Accommodation & Pricing", {
    eyebrow: "Room options",
    keepWithNext: 100,
  });

  const accommodationRows = (
    payload.accommodationOptions.length
      ? payload.accommodationOptions
      : payload.selectedAccommodationOption
        ? [payload.selectedAccommodationOption]
        : []
  ).map((option) => ({
    description: option.description || "Accommodation option",
    price: option.total,
    title: option.title,
  }));

  const drawTable = (
    headers: string[],
    rows: string[][],
    columnWidths: number[],
    options: { title?: string } = {}
  ) => {
    const x = margin;
    const rowPad = 9;
    const headerHeight = 28;
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);

    setBody(7.8, colors.ink);
    const preparedRows = rows.map((row) => {
      const cellLines = row.map((cell, index) =>
        wrapTextNoBreak(
          normalizePdfText(cell || "-"),
          columnWidths[index] - rowPad * 2
        )
      );
      const rowHeight = Math.max(
        30,
        ...cellLines.map((lines) => lines.length * 10 + 12)
      );
      return { cellLines, rowHeight };
    });

    const titleHeight = options.title ? 24 : 0;
    const firstRowHeight = preparedRows[0]?.rowHeight ?? 30;
    ensureSpace(titleHeight + headerHeight + firstRowHeight + 6, options.title);

    const drawTableTitle = (continued = false) => {
      if (!options.title) return;
      setSemiBold(10, colors.deep);
      doc.text(
        normalizePdfText(`${options.title}${continued ? " - continued" : ""}`),
        x,
        y
      );
      y += 17;
    };

    const drawTableHeader = () => {
      doc.setFillColor(colors.cream);
      doc.setDrawColor(colors.border);
      doc.roundedRect(x, y, totalWidth, headerHeight, 5, 5, "FD");

      let cursorX = x;
      headers.forEach((header, index) => {
        setSemiBold(7.8, colors.deep);
        const headerLines = wrapTextNoBreak(
          normalizePdfText(header),
          columnWidths[index] - rowPad * 2
        );
        doc.text(headerLines.slice(0, 2), cursorX + rowPad, y + 18);
        cursorX += columnWidths[index];
        if (index < headers.length - 1) {
          doc.line(cursorX, y, cursorX, y + headerHeight);
        }
      });

      y += headerHeight;
    };

    drawTableTitle();
    drawTableHeader();

    preparedRows.forEach(({ cellLines, rowHeight }, rowIndex) => {
      if (y + rowHeight > contentBottom) {
        addContentPage(options.title || payload.tour.tourName);
        drawTableTitle(true);
        drawTableHeader();
      }

      doc.setFillColor(rowIndex % 2 === 0 ? colors.soft : "#FBF7F2");
      doc.setDrawColor(colors.border);
      doc.rect(x, y, totalWidth, rowHeight, "FD");

      let cellX = x;
      cellLines.forEach((lines, index) => {
        setBody(7.8, colors.ink);
        doc.text(lines, cellX + rowPad, y + 18);
        cellX += columnWidths[index];
        if (index < cellLines.length - 1) {
          doc.line(cellX, y, cellX, y + rowHeight);
        }
      });

      y += rowHeight;
    });

    y += 16;
  };

  if (accommodationRows.length) {
    drawTable(
      ["Room / Occupancy", "Description", "Price"],
      accommodationRows.map((row) => [
        row.title,
        row.description,
        formatCurrency(row.price),
      ]),
      [150, contentWidth - 150 - 105, 105],
      { title: "Available Accommodation Options" }
    );
  } else {
    y = drawText(
      "Accommodation options will be shown after you select a departure and traveller combination on the website.",
      margin,
      y,
      contentWidth,
      { fontSize: 8.8, color: colors.textMuted }
    );
    y += 18;
  }

  drawTable(
    ["Price Component", "Amount"],
    [
      ["Tour subtotal", formatCurrency(payload.subtotal)],
      [`GST (${payload.gstPercentage || 0}%)`, formatCurrency(payload.gstAmount)],
      [
        "Selected accommodation",
        payload.selectedAccommodationOption
          ? `${payload.selectedAccommodationOption.title} - ${formatCurrency(
              payload.selectedAccommodationOption.total
            )}`
          : "Not selected",
      ],
      [
        "Payment choice",
        payload.paymentOption === "advance" ? "Advance payment" : "Full payment",
      ],
      ["Pay now", formatCurrency(payload.depositAmount)],
      ["Balance", formatCurrency(payload.balanceAmount)],
      ["Balance due", formatDateFromDate(payload.balanceDueDate)],
    ],
    [contentWidth * 0.55, contentWidth * 0.45],
    { title: "Current Booking Selection" }
  );

  // ---------------------------------------------------------------------------
  // INCLUSIONS / EXCLUSIONS
  // ---------------------------------------------------------------------------
  const drawBulletSection = (
    title: string,
    items: string[],
    mode: "include" | "exclude"
  ) => {
    drawSectionTitle(title, {
      eyebrow: mode === "include" ? "Included in your journey" : "Please note",
      keepWithNext: 48,
    });

    items.forEach((item) => {
      const lines = wrapTextNoBreak(
        normalizePdfText(item),
        contentWidth - 24
      ) as string[];
      ensureSpace(Math.max(20, lines.length * 11 + 8), title);

      if (mode === "include") drawCheckIcon(margin, y - 5);
      else drawCrossIcon(margin, y - 5);

      setBody(8.3, colors.ink);
      doc.text(lines, margin + 18, y);
      y += Math.max(18, lines.length * 11 + 7);
    });

    y += 8;
  };

  drawBulletSection("Inclusions", getTourInclusions(payload.tour), "include");
  drawBulletSection("Exclusions", getTourExclusions(payload.tour), "exclude");

  // ---------------------------------------------------------------------------
  // EXPERT / NOTES / CTA
  // ---------------------------------------------------------------------------
  const expertTextWidth = contentWidth - 112;
  setBold(12, colors.deep);
  const expertNameLines = wrapTextNoBreak(
    normalizePdfText(payload.expert.fullName),
    expertTextWidth
  );
  setSemiBold(8.2, colors.primary);
  const expertRoleLines = wrapTextNoBreak(
    normalizePdfText(getExpertRole(payload.expert)),
    expertTextWidth
  );
  setBody(8.2, colors.textMuted);
  const expertBioLines = wrapTextNoBreak(
    normalizePdfText(getExpertBio(payload.expert)),
    expertTextWidth
  );
  const expertCardHeight = Math.max(
    116,
    24 +
      expertNameLines.length * 14 +
      expertRoleLines.length * 11 +
      expertBioLines.length * 10 +
      22
  );

  drawSectionTitle("Your Tour Expert", {
    eyebrow: "Travel with context",
    keepWithNext: expertCardHeight + 8,
  });

  doc.setFillColor(colors.cream);
  doc.setDrawColor(colors.border);
  doc.roundedRect(margin, y, contentWidth, expertCardHeight, 8, 8, "FD");
  doc.setFillColor(colors.primary);
  doc.circle(margin + 44, y + 42, 25, "F");
  setBold(20, colors.white);
  const initials = payload.expert.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  doc.text(initials || "AT", margin + 44, y + 49, { align: "center" });

  let expertY = y + 26;
  setBold(12, colors.deep);
  doc.text(expertNameLines, margin + 82, expertY);
  expertY += expertNameLines.length * 14 + 2;

  setSemiBold(8.2, colors.primary);
  doc.text(expertRoleLines, margin + 82, expertY);
  expertY += expertRoleLines.length * 11 + 6;

  setBody(8.2, colors.textMuted);
  doc.text(expertBioLines, margin + 82, expertY);
  y += expertCardHeight + 22;

  drawSectionTitle("Important Booking Notes", {
    eyebrow: "Before you confirm",
    keepWithNext: 70,
  });

  const notes = [
    "The itinerary sequence may change due to local conditions, monument timings, weather, operational requirements or other circumstances beyond our control.",
    "Hotel details shown at the time of booking remain subject to availability and final confirmation.",
    ...(travellerSummary
      ? [`Your current traveller selection is ${travellerSummary}. Traveller names, identity details and emergency contact information are completed on the live booking flow.`]
      : []),
    "Please review the live website for the latest cancellation terms, payment conditions, final inclusions, exclusions and any tour-specific advisories before payment.",
  ];

  notes.forEach((note, index) => {
    const lines = wrapTextNoBreak(
      normalizePdfText(note),
      contentWidth - 26
    ) as string[];
    ensureSpace(lines.length * 11 + 16, "Important Booking Notes");
    doc.setFillColor(colors.gold);
    doc.circle(margin + 4, y - 3, 2.4, "F");
    setBody(8.2, colors.textMuted);
    doc.text(lines, margin + 16, y);
    y += Math.max(18, lines.length * 11 + 8);

    if (index < notes.length - 1) {
      doc.setDrawColor(colors.border);
      doc.line(margin + 16, y - 4, pageWidth - margin, y - 4);
      y += 4;
    }
  });

  ensureSpace(138, "Book Your Journey");
  y += 10;
  doc.setFillColor(colors.secondary);
  doc.roundedRect(margin, y, contentWidth, 112, 10, 10, "F");
  setScript(17, colors.white);
  doc.text("Walk through history with us", margin + 22, y + 32);
  setBold(12, colors.white);
  doc.text("Ready to reserve your place?", margin + 22, y + 55);
  setBody(8, "#F2DED5");
  doc.text(
    "Select your date, accommodation and traveller details on the Ancient Trails website.",
    margin + 22,
    y + 74
  );

  doc.setFillColor(colors.gold);
  doc.roundedRect(pageWidth - margin - 128, y + 36, 108, 34, 7, 7, "F");
  setBold(9.2, colors.deep);
  doc.text("BOOK NOW", pageWidth - margin - 74, y + 57, {
    align: "center",
  });
  doc.link(pageWidth - margin - 128, y + 36, 108, 34, { url: bookingUrl });
  y += 130;

  // ---------------------------------------------------------------------------
  // FOOTERS & PAGE NUMBERS
  // ---------------------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  const siteLabel = new URL(window.location.href).host;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const footerY = pageHeight - 24;
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    setBody(6.8, colors.textMuted);
    doc.text("Ancient Trails", margin, footerY);
    doc.text(siteLabel, pageWidth / 2, footerY, { align: "center" });
    doc.text(String(page), pageWidth - margin, footerY, { align: "right" });
  }

  doc.save(`${slugify(payload.tour.tourName) || "tour"}-ancient-trails-itinerary.pdf`);
}
