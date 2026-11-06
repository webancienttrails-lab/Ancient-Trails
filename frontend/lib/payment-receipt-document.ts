import type { UserBooking, UserPaymentReceipt } from "@/lib/user-bookings";
import { getUserBookingTitle, getUserBookingLocation, getUserBookingReference, getUserBookingTravellerLabel } from "@/lib/user-bookings";
import type { SiteContactSettings } from "@/lib/site-settings";
import { fetchSiteLogoUrl } from "@/lib/site-logo";
import { addContainedPdfImage } from "@/lib/pdf-image";

export function paymentReceiptDate(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
export function paymentReceiptMoney(value: number, currency = "INR") {
  return currency + " " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}
export function paymentReceiptDetails(item: UserBooking, receipt: UserPaymentReceipt, contact: SiteContactSettings) {
  const lead = item.booking.guestDetails[0];
  const amount = (value: number) => paymentReceiptMoney(value, receipt.currency);
  return {
    company: [contact.officeAddress, contact.emailId ? `Email: ${contact.emailId}` : "",
      `Phone: ${[...new Set([contact.primaryCalling, contact.secondaryCalling, contact.landline].filter(Boolean))].join(" | ")}`,
      contact.whatsapp ? `WhatsApp: ${contact.whatsapp}` : "", "GSTIN: 27ABPFA1944D1ZI"].filter(Boolean),
    customer: [[lead?.title, lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || "Traveller",
      `Email: ${lead?.email || "-"}`, `Phone: ${[lead?.countryCode, lead?.mobileNumber].filter(Boolean).join(" ") || "-"}`, lead?.address || "-"],
    tour: [`Tour: ${getUserBookingTitle(item)}`, `Destination: ${getUserBookingLocation(item)}`,
      `Departure: ${paymentReceiptDate(item.departure?.departureDate || item.booking.pricingSnapshot?.departureDate)}`,
      `Return: ${paymentReceiptDate(item.departure?.returnDate || item.booking.pricingSnapshot?.returnDate)}`, `Guests: ${getUserBookingTravellerLabel(item)}`],
    payment: [`Mode: ${receipt.method}`, `Transaction ID: ${receipt.transactionId || "Recorded by Ancient Trails"}`,
      `Payment Date: ${paymentReceiptDate(receipt.paidAt)}`, "Payment Status: PAYMENT RECEIVED"],
    totals: [`Payment Received: ${amount(receipt.amount)}`, `Booking Total: ${amount(receipt.bookingTotal)}`,
      `Total Received Through This Receipt: ${amount(receipt.totalPaid)}`, `Balance Against Current Total: ${amount(receipt.balanceAfterPayment)}`],
    note: "This receipt acknowledges this successful payment only. It is not a tax invoice. Booking totals reflect the current package; retain each receipt for your records.",
  };
}

async function receiptLogo(source: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

export async function createTravellerPaymentReceiptPdf(item: UserBooking, receipt: UserPaymentReceipt, contact: SiteContactSettings) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "a4", unit: "pt", compress: true });
  const details = paymentReceiptDetails(item, receipt, contact);
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
  const margin = 30, gap = 10, half = (width - margin * 2 - gap) / 2;
  let y = margin;
  const text = (value: string, x: number, top: number, size = 9, bold = false, align: "left" | "right" = "left") => {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(30, 41, 59); pdf.text(value, x, top, { align });
  };
  const ensure = (needed: number) => { if (y + needed > height - margin) { pdf.addPage(); y = margin; } };
  const panels = (a: string, left: string[], b: string, right: string[]) => {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const wrap = (lines: string[]) => lines.flatMap((line) => pdf.splitTextToSize(line, half - 24) as string[]);
    const first = wrap(left), second = wrap(right);
    const panelHeight = 44 + Math.max(first.length, second.length) * 12;
    ensure(panelHeight);
    [first, second].forEach((lines, index) => {
      const x = margin + index * (half + gap);
      pdf.setDrawColor(232, 222, 214); pdf.roundedRect(x, y, half, panelHeight, 7, 7);
      text(index ? b : a, x + 12, y + 20, 9, true);
      lines.forEach((line, row) => text(line, x + 12, y + 39 + row * 12));
    });
    y += panelHeight + gap;
  };
  const logo = await receiptLogo(await fetchSiteLogoUrl());
  if (logo) addContainedPdfImage(pdf, logo, { x: margin, y, width: 165, height: 70 });
  else text("Ancient Trails", margin, y + 25, 20, true);
  text("PAYMENT RECEIPT", width - margin, y + 15, 18, true, "right");
  text(receipt.receiptNumber, width - margin, y + 34, 8, true, "right");
  text("Payment Date: " + paymentReceiptDate(receipt.paidAt), width - margin, y + 48, 8, false, "right");
  text("Booking ID: " + getUserBookingReference(item), width - margin, y + 62, 8, false, "right");
  y += 88;
  panels("ANCIENT TRAILS", details.company, "BILL TO", details.customer);
  panels("TOUR DETAILS", details.tour, "PAYMENT DETAILS", details.payment);
  ensure(70);
  pdf.setDrawColor(232, 222, 214); pdf.roundedRect(margin, y, width - margin * 2, 62, 7, 7);
  text("Description", margin + 12, y + 18, 9, true);
  text("Amount Received", width - margin - 12, y + 18, 9, true, "right");
  text(receipt.description, margin + 12, y + 43, 9);
  text(paymentReceiptMoney(receipt.amount, receipt.currency), width - margin - 12, y + 43, 11, true, "right");
  y += 72;
  panels("NOTE", [details.note], "TOTALS", details.totals);
  ensure(65);
  text("For Ancient Trails", width - margin, y + 10, 9, true, "right");
  text("Authorized Signatory", width - margin, y + 45, 9, false, "right");
  return pdf;
}
