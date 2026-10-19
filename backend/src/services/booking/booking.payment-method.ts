import type { IBooking } from "../../models/booking.model";

export function verifiedPaymentMethod(value: string | undefined, fallback: "razorpay" | "bank_transfer" = "razorpay"): NonNullable<IBooking["paymentMethod"]> {
  const method = value?.trim().toLowerCase();
  return ["neft", "imps", "rtgs", "upi", "netbanking", "card", "wallet", "emi"].includes(method || "")
    ? method as NonNullable<IBooking["paymentMethod"]> : fallback;
}
