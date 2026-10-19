import { apiRequest } from "@/lib/api";
import type { AdminBooking } from "@/lib/bookings";

type PaymentResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutOrder = { checkout: {
  key: string; orderId: string; amount: number; currency: string; name: string;
  description: string; prefill: { name: string; email: string; contact: string };
} };
type CheckoutInstance = { open(): void; close(): void; on(event: "payment.failed", callback: (failure: { error?: { description?: string } }) => void): void };
type CheckoutOptions = {
  key: string; order_id: string; amount: number; currency: string; name: string; description: string;
  prefill: CheckoutOrder["checkout"]["prefill"]; theme: { color: string }; retry: { enabled: boolean };
  handler(response: PaymentResponse): void; modal: { ondismiss(): void };
};
type RazorpayWindow = Window & { Razorpay?: new (options: CheckoutOptions) => CheckoutInstance };
let scriptPromise: Promise<void> | null = null;

async function loadCheckout() {
  if (typeof window === "undefined") throw new Error("Razorpay checkout requires a browser");
  if ((window as RazorpayWindow).Razorpay) return;
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => { window.clearTimeout(timer); script.remove(); reject(new Error("Unable to load Razorpay checkout. Please retry.")); };
      const timer = window.setTimeout(fail, 15000);
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timer);
        if ((window as RazorpayWindow).Razorpay) resolve(); else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch(error => { scriptPromise = null; throw error; });
  }
  await scriptPromise;
}

export async function openAdminRazorpayCheckout(booking: AdminBooking, paymentOption?: "advance" | "full"): Promise<AdminBooking | null> {
  if (typeof window === "undefined") throw new Error("Razorpay checkout requires a browser");
  if (booking.paymentStatus === "paid") throw new Error("This booking has already been paid");
  const token = booking.recoveryUrl ? new URL(booking.recoveryUrl, window.location.origin).searchParams.get("token") : null;
  if (!token) throw new Error("The secure checkout link is unavailable for this booking");
  await loadCheckout();
  const result = await apiRequest<CheckoutOrder>(
    "/api/bookings/" + encodeURIComponent(booking.id) + "/recovery/payment/order?token=" + encodeURIComponent(token),
    { method: "POST", body: JSON.stringify({ paymentOption: paymentOption || booking.paymentOption }) }
  );
  const order = result.data.checkout;
  const Razorpay = (window as RazorpayWindow).Razorpay;
  if (!Razorpay) throw new Error("Unable to open Razorpay checkout");
  const cancel = () => apiRequest("/api/bookings/payment/cancel", {
    method: "POST", body: JSON.stringify({ orderId: order.orderId }),
  }).catch(() => {});
  return new Promise((resolve, reject) => {
    let settled = false;
    let verifying = false;
    let checkout: CheckoutInstance;
    try { checkout = new Razorpay({
      key: order.key, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: order.name, description: order.description, prefill: order.prefill,
      theme: { color: "#d47220" }, retry: { enabled: false },
      handler: response => {
        if (settled || verifying) return;
        verifying = true;
        if (response.razorpay_order_id !== order.orderId) {
          settled = true;
          reject(new Error("Payment order mismatch. Check the booking payment status before retrying."));
          return;
        }
        apiRequest<{ booking: AdminBooking }>("/api/bookings/payment/verify", {
          method: "POST", body: JSON.stringify(response),
        }).then(verification => {
          settled = true;
          if (verification.data.booking.id !== booking.id || verification.data.booking.paymentStatus !== "paid") {
            reject(new Error("Payment verification is pending. Check the saved booking before retrying."));
          } else resolve(verification.data.booking);
        }).catch(() => {
          settled = true;
          reject(new Error("Payment verification is pending. Check the saved booking before making another payment."));
        });
      },
      modal: { ondismiss: () => {
        if (settled || verifying) return;
        settled = true;
        void cancel().finally(() => resolve(null));
      } },
    });
    } catch (error) { void cancel().finally(() => reject(error)); return; }
    checkout.on("payment.failed", failure => {
      if (settled || verifying) return;
      settled = true;
      checkout.close();
      void cancel().finally(() => reject(new Error(failure.error?.description || "Payment failed. The booking remains unpaid.")));
    });
    try { checkout.open(); }
    catch (error) { settled = true; void cancel().finally(() => reject(error)); }
  });
}
