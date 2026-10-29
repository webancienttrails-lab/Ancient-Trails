"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PaymentRetryNotice } from "@/components/payment-retry-notice";
import { paymentFailureMessage } from "@/lib/payment-failure";
import { getTravellerSession, listenForTravellerSessionChanges } from "@/lib/auth";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  ReceiptText,
  Users,
} from "lucide-react";

import {
  createBookingRecoveryPaymentOrder,
  getBookingRecovery,
  verifyBookingPayment,
  type BookingPaymentOrder,
  type BookingRecoveryData,
} from "@/lib/booking-payment";
import { Header } from "@/components/layout/header";

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
    eventName: "payment.failed",
    handler: (response: RazorpayFailureResponse) => void
  ) => void;
  open: () => void;
};

type RazorpayCheckoutOptions = {
  amount: number;
  currency: string;
  description: string;
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: { ondismiss: () => void };
  key: string;
  name: string;
  order_id: string;
  prefill: {
    contact: string;
    email: string;
    name: string;
  };
  retry: {
    enabled: boolean;
  };
  theme: {
    color: string;
  };
};

type RazorpayWindow = Window & {
  Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value?: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Coming Soon"
    : dateFormatter.format(date).replace(",", "");
}

function formatCurrency(value?: number) {
  return currencyFormatter.format(value || 0);
}

function loadRazorpayCheckoutScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is available in browser only"));
  }

  if ((window as RazorpayWindow).Razorpay) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Razorpay checkout could not be loaded")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Razorpay checkout could not be loaded"));
    document.body.appendChild(script);
  });
}

function getPayableAmount(data: BookingRecoveryData) {
  if (data.booking.paymentOption === "full") {
    return data.booking.grandTotal || 0;
  }

  return data.booking.depositAmount || data.booking.grandTotal || 0;
}

export default function BookingRecoveryPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const bookingId = params.bookingId;
  const [data, setData] = useState<BookingRecoveryData | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "creating" | "verifying">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [paymentRetryMessage, setPaymentRetryMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const loadRecovery = useCallback(async () => {
    if (!bookingId) {
      setStatus("idle");
      setMessage("This booking link is incomplete.");
      return;
    }

    setStatus("loading");
    setData(null);
    setMessage("");
    const sessionToken = getTravellerSession()?.sessionId;

    try {
      const response = await getBookingRecovery(bookingId);

      if (!isMountedRef.current || getTravellerSession()?.sessionId !== sessionToken) {
        return;
      }

      setData(response.data);
      setStatus("idle");

      if (response.data.isConfirmed) {
        router.replace(
          `/booking-confirmed/${response.data.booking.id}`
        );
      }
    } catch (error) {
      setStatus("idle");
      setMessage(
        error instanceof Error
          ? error.message
          : "This booking recovery link could not be opened."
      );
    }
  }, [bookingId, router]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadRecovery();
    const unsubscribe = listenForTravellerSessionChanges(() => { setData(null); void loadRecovery(); });

    return () => {
      unsubscribe();
      isMountedRef.current = false;
    };
  }, [loadRecovery]);

  const unavailableMessage = useMemo(() => {
    if (!data) {
      return "";
    }

    if (data.isExpired) {
      return "This booking link has expired. Please start a new booking.";
    }

    if (data.isCancelled) {
      return "This booking has been cancelled and can no longer be recovered.";
    }

    if (!data.hasAvailability) {
      return "This departure is currently unavailable for the selected number of travellers. Please choose another departure or contact Ancient Trails.";
    }

    return "";
  }, [data]);

  async function openRazorpayCheckout(order: BookingPaymentOrder) {
    await loadRazorpayCheckoutScript();

    const razorpayWindow = window as RazorpayWindow;

    if (!razorpayWindow.Razorpay) {
      throw new Error("Razorpay checkout could not be opened");
    }

    let didReceivePaymentResponse = false;
    let didEndPaymentAttempt = false;
    const endPaymentAttempt = (reason?: string) => {
      if (didReceivePaymentResponse || didEndPaymentAttempt) return;
      didEndPaymentAttempt = true;
      const message = paymentFailureMessage(reason);
      setStatus("idle");
      setMessage(message);
      setPaymentRetryMessage(message);
    };
    const checkout = new razorpayWindow.Razorpay({
      amount: order.checkout.amount,
      currency: order.checkout.currency,
      description: order.checkout.description,
      key: order.checkout.key,
      name: order.checkout.name,
      order_id: order.checkout.orderId,
      prefill: order.checkout.prefill,
      modal: { ondismiss: () => endPaymentAttempt() },
      retry: {
        enabled: false,
      },
      theme: {
        color: "#d47220",
      },
      handler: (paymentResponse) => {
        if (didReceivePaymentResponse) return;
        didReceivePaymentResponse = true;
        setPaymentRetryMessage(null);
        setStatus("verifying");
        setMessage("Verifying payment and confirming your booking...");

        verifyBookingPayment(paymentResponse)
          .then((verificationResponse) => {
            const { booking } = verificationResponse.data;

            router.push(
              `/booking-confirmed/${booking.id}`
            );
          })
          .catch((error: unknown) => {
            setStatus("idle");
            setMessage(
              error instanceof Error
                ? error.message
                : "Payment verification failed. Please contact support."
            );
          });
      },
    });

    checkout.on("payment.failed", (failureResponse) => {
      endPaymentAttempt(failureResponse.error?.description || failureResponse.error?.reason);
    });

    checkout.open();
  }

  async function handleRetryPayment() {
    if (!data?.canRetry || status !== "idle") {
      return;
    }

    setPaymentRetryMessage(null);
    setStatus("creating");
    setMessage("Checking availability and creating a secure payment link...");

    try {
      const response = await createBookingRecoveryPaymentOrder(bookingId);

      await openRazorpayCheckout(response.data);
    } catch (error) {
      setStatus("idle");
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be started. Please try again."
      );
      void loadRecovery();
    }
  }

  const booking = data?.booking;
  const tourName = data?.tour?.tourName || booking?.tourId || "Ancient Trails";
  const departureDate =
    data?.departure?.departureDate || booking?.pricingSnapshot?.departureDate;
  const isBusy = status === "loading" || status === "creating" || status === "verifying";

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-secondary">
      <Header />
      <PaymentRetryNotice message={paymentRetryMessage} busy={status !== "idle"} onRetry={() => void handleRetryPayment()} onDismiss={() => setPaymentRetryMessage(null)} />
      <section className="mx-auto flex min-h-[72vh] w-full max-w-[900px] flex-col justify-center px-5 py-10">
        <div className="rounded-[8px] border border-border bg-card p-5 shadow-[0_14px_34px_rgba(67,43,27,0.08)] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-sans text-[12px] font-bold uppercase text-button-outline">
                Payment Pending
              </p>
              <h1 className="mt-2 font-heading text-[32px] font-bold leading-tight text-secondary">
                Complete Your Booking
              </h1>
              <p className="mt-2 max-w-[620px] font-sans text-[14px] font-medium leading-[1.7] text-secondary/68">
                Your booking is not confirmed yet. We will recheck availability
                before opening Razorpay.
              </p>
            </div>
            {booking?.bookingReference ? (
              <span className="inline-flex rounded-full bg-primary/10 px-4 py-2 font-sans text-[12px] font-bold text-brand-text">
                {booking.bookingReference}
              </span>
            ) : null}
          </div>

          {status === "loading" ? (
            <div className="mt-8 flex items-center gap-3 rounded-[8px] bg-background p-4 font-sans text-[14px] font-semibold text-secondary/68">
              <Loader2 className="size-5 animate-spin text-brand-text" />
              Checking booking status...
            </div>
          ) : null}

          {booking ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem
                icon={ReceiptText}
                label="Tour"
                value={tourName}
              />
              <SummaryItem
                icon={CalendarDays}
                label="Departure"
                value={formatDate(departureDate)}
              />
              <SummaryItem
                icon={Users}
                label="Travellers"
                value={`${booking.totalGuest} traveller${
                  booking.totalGuest === 1 ? "" : "s"
                }`}
              />
              <SummaryItem
                icon={CreditCard}
                label="Amount"
                value={formatCurrency(getPayableAmount(data))}
              />
            </div>
          ) : null}

          {unavailableMessage || message ? (
            <div className="mt-5 flex gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 font-sans text-[13px] font-semibold leading-[1.55] text-amber-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{unavailableMessage || message}</span>
            </div>
          ) : null}

          {data?.isConfirmed ? (
            <div className="mt-5 flex gap-3 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 font-sans text-[13px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              This booking is already confirmed.
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={!data?.canRetry || isBusy}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 font-sans text-[14px] font-bold text-white transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-55"
            >
              {status === "creating" || status === "verifying" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              <span className="ml-2">
                {status === "creating"
                  ? "Checking Availability..."
                  : status === "verifying"
                    ? "Confirming..."
                    : "Complete Your Booking"}
              </span>
            </button>
            <Link
              href={booking?.tourId ? `/tours/${booking.tourId}` : "/tours"}
              className="inline-flex h-11 items-center justify-center rounded-full border border-button-outline bg-white px-6 font-sans text-[14px] font-bold text-button-outline transition-colors hover:border-button-outline hover:text-button-outline"
            >
              Back to Tour
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[8px] border border-border bg-white p-3">
      <Icon className="size-4 text-brand-text" />
      <span className="mt-3 block font-sans text-[11px] font-bold uppercase text-secondary/48">
        {label}
      </span>
      <strong className="mt-1 block break-words font-sans text-[13px] font-bold leading-snug text-secondary">
        {value}
      </strong>
    </div>
  );
}
