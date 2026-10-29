import { Booking } from "../../models/booking.model";
import { Tour } from "../../models/tour.model";
import { SmartCollectAccount, SmartCollectTransfer } from "../../models/smartCollect.model";
import { sendBankTransferEmail } from "../booking-confirmation-email.service";
import { sendBookingPaymentLinkWhatsapp } from "../msg91-whatsapp.service";

export async function notifyBankInstructions(accountId: string) {
  const account = await SmartCollectAccount.findById(accountId);
  if (!account || !account.virtualAccountId || account.status !== "active") return;
  const booking = await Booking.findById(account.bookingId).select("+bankTransferToken");
  if (!booking?.bankTransferToken) return;
  const guest = booking.guestDetails[0];
  const tour = await Tour.findOne({ tourId: booking.tourId });
  const url = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "") +
    "/bank-transfer/" + booking._id;
  const name = [guest?.firstName, guest?.lastName].filter(Boolean).join(" ") || "Traveller";
  const tasks = [
    { field: "emailInstructionStatus", send: () => sendBankTransferEmail({
      recipientEmail: guest?.email || "", subject: "Bank transfer instructions - " + account.bookingReference,
      lines: ["Hello " + name + ",", "Booking: " + account.bookingReference,
        "Beneficiary: " + account.beneficiaryName, "Account number: " + account.accountNumber,
        "IFSC: " + account.ifsc, "Payable amount: INR " + (account.amountRequested / 100).toFixed(2),
        "Valid until: " + account.expiresAt.toISOString(),
        "Transfer using NEFT, RTGS or IMPS. Seats are subject to availability until verified payment confirms the booking.",
        "Do not transfer after expiry. Use only this booking's details.", url],
    }) },
    { field: "whatsappInstructionStatus", send: () => {
      if (!/^https:\/\//i.test(url)) throw new Error("WhatsApp instructions need a public HTTPS FRONTEND_URL");
      return sendBookingPaymentLinkWhatsapp({
        amount: (account.amountRequested / 100).toFixed(2), bookingReference: account.bookingReference,
        paymentPurpose: "Bank Transfer (NEFT / RTGS / IMPS)", paymentUrl: url,
        recipientNumber: ((guest?.countryCode || "") + (guest?.mobileNumber || "")).replace(/\D/g, ""),
        tourName: tour?.tourName || booking.tourId, travellerName: name,
        crqId: "smart-collect-" + account._id,
      });
    } },
  ];
  for (const task of tasks) {
    const claimed = await SmartCollectAccount.findOneAndUpdate(
      { _id: account._id, [task.field]: "pending" }, { $set: { [task.field]: "sending" } }
    );
    if (!claimed) continue;
    try {
      await task.send();
      await SmartCollectAccount.updateOne({ _id: account._id }, { $set: { [task.field]: "sent" } });
    } catch {
      // An ambiguous send is not retried automatically: it may have reached the recipient.
      await SmartCollectAccount.updateOne({ _id: account._id }, { $set: { [task.field]: "failed" } });
      console.error("[smart-collect] Instruction notification requires review for " + account._id);
    }
  }
}
export async function notifyBankReceipts(bookingId: string, scope: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return;
  const receipts = await SmartCollectTransfer.find({ bookingId, scope, processedAt: { $ne: null }, receiptEmailStatus: "pending" });
  for (const receipt of receipts) {
    const claimed = await SmartCollectTransfer.findOneAndUpdate(
      { _id: receipt._id, receiptEmailStatus: "pending" }, { $set: { receiptEmailStatus: "sending" } }
    );
    if (!claimed) continue;
    try {
      await sendBankTransferEmail({
        recipientEmail: booking.guestDetails[0]?.email || "",
        subject: "Bank transfer received - " + booking.bookingReference,
        lines: ["Booking: " + booking.bookingReference, "Payment ID: " + receipt.paymentId,
          "Bank reference: " + receipt.utr, "Transfer received: INR " + (receipt.amount / 100).toFixed(2),
          "Applied to booking: INR " + (receipt.amountApplied / 100).toFixed(2),
          "Under admin review: INR " + (receipt.amountReview / 100).toFixed(2),
          "Outstanding: INR " + Math.max(0, (booking.grandTotal || 0) - (booking.amountPaid || 0)).toFixed(2),
          receipt.reason || "Payment verified. Booking status: " + booking.bookingStatus],
      });
      await SmartCollectTransfer.updateOne({ _id: receipt._id }, { $set: { receiptEmailStatus: "sent" } });
    } catch {
      await SmartCollectTransfer.updateOne({ _id: receipt._id }, { $set: { receiptEmailStatus: "failed" } });
      console.error("[smart-collect] Receipt notification requires review for " + receipt._id);
    }
  }
}
