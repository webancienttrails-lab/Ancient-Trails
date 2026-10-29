import type { BookingConfirmation } from "@/lib/booking-payment";

type PaymentRecord = Pick<BookingConfirmation, "id" | "bookingReference" | "amountPaid" | "grandTotal" |
  "balanceAmount" | "balanceDueDate" | "paymentStatus" | "bookingStatus" | "paymentCurrency">;

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function receiptDate(value?: string | null): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export function getBookingPaymentState(booking: PaymentRecord) {
  const paid = Math.max(0, booking.amountPaid || 0);
  const balance = Math.max(0, booking.balanceAmount ?? ((booking.grandTotal || 0) - paid));
  return { paid, balance, canDownloadReceipt: booking.paymentStatus === "paid" && paid > 0 };
}

export function getBookingPaymentSummary(booking: PaymentRecord): string {
  const { paid, balance, canDownloadReceipt } = getBookingPaymentState(booking);
  const currency = booking.paymentCurrency || "INR";
  if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "expired") {
    return "Booking " + booking.bookingStatus + ". Recorded payments: " + money(paid, currency) + ". Please contact our team for assistance.";
  }
  if (!canDownloadReceipt) return "Payment is pending. Your booking will be confirmed after payment is verified.";
  if (balance <= 0) return "Booking confirmed. Payment of " + money(paid, currency) + " received in full.";
  const due = receiptDate(booking.balanceDueDate);
  return "Booking confirmed with an advance of " + money(paid, currency) + ". Balance " + money(balance, currency)
    + (due === "Not recorded" ? " is outstanding. Our team will confirm the due date." : " due " + due + ".");
}

export function getBookingDocumentMessage(booking: PaymentRecord): string {
  const { balance, canDownloadReceipt } = getBookingPaymentState(booking);
  if (!canDownloadReceipt) return "Your payment receipt will be available after payment is verified. The final invoice and booking voucher are available after final payment.";
  if (balance > 0) return "Your payment receipt is available now. The final invoice and booking voucher are available after final payment.";
  return "Your payment receipt, final invoice and booking voucher are available now in My Bookings.";
}

export async function createBookingPaymentReceiptPdf(booking: BookingConfirmation, tourName: string) {
  const { paid, balance, canDownloadReceipt } = getBookingPaymentState(booking);
  if (!canDownloadReceipt) throw new Error("A receipt is available only after payment has been verified.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const reference = booking.bookingReference || booking.id;
  const title = balance > 0 ? "Advance Payment Receipt" : "Payment Receipt";
  const currency = booking.paymentCurrency || "INR";
  const amount = (value: number) => currency + " " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  const lead = booking.guestDetails[0];
  const lines = [
    "Receipt reference: " + reference + "-PAYMENT",
    "Booking reference: " + reference,
    "Tour: " + tourName,
    "Lead traveller: " + [lead?.firstName, lead?.lastName].filter(Boolean).join(" "),
    "Payment date: " + receiptDate(booking.paymentCapturedAt),
    "Payment reference: " + (booking.paymentId || booking.paymentOrderId || "Recorded by Ancient Trails"),
    "Payment status: Verified",
    "Total verified payments: " + amount(paid),
    "Booking total: " + amount(booking.grandTotal || paid + balance),
    "Outstanding balance: " + amount(balance),
    "Balance due date: " + (balance > 0 ? receiptDate(booking.balanceDueDate) : "Paid in full"),
    getBookingDocumentMessage(booking),
    "This receipt acknowledges payments recorded for this booking. It is not a tax invoice.",
  ];
  pdf.setProperties({ title: title + " - " + reference, author: "Ancient Trails" });
  pdf.setTextColor(214, 106, 26);
  pdf.setFontSize(22);
  pdf.text("Ancient Trails", 42, 52);
  pdf.setTextColor(45, 45, 45);
  pdf.setFontSize(16);
  pdf.text(title, 42, 82);
  pdf.setFontSize(11);
  let y = 118;
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, 510) as string[];
    for (const row of wrapped) {
      if (y > 770) { pdf.addPage(); y = 48; }
      pdf.text(row, 42, y);
      y += 17;
    }
    y += 9;
  }
  return pdf;
}

export async function downloadBookingPaymentReceipt(booking: BookingConfirmation, tourName: string) {
  const pdf = await createBookingPaymentReceiptPdf(booking, tourName);
  const reference = (booking.bookingReference || booking.id).replace(/[^a-zA-Z0-9_-]/g, "-");
  pdf.save(reference + "-Payment-Receipt.pdf");
}
