import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import {
  getBookingConfirmation,
  type BookingConfirmation,
  type BookingConfirmationData,
} from "@/lib/booking-payment";
import { getHomeMediaUrl } from "@/lib/home-travel";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

type BookingConfirmedRouteProps = {
  params: Promise<{
    bookingId: string;
  }>;
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking Confirmed",
  description: "Your Ancient Trails booking confirmation details.",
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

function formatCurrency(value?: number) {
  return currencyFormatter.format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Coming Soon";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Coming Soon"
    : dateFormatter.format(date).replace(",", "");
}

function getToken(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function getBookingReference(bookingId: string) {
  return `ATB-${bookingId.slice(-8).toUpperCase()}`;
}

function getLeadGuest(booking: BookingConfirmation) {
  return booking.guestDetails[0];
}

function getHeroImage(data: BookingConfirmationData) {
  return getHomeMediaUrl(
    data.tour?.thumbnailImage ||
      data.tour?.bannerImage ||
      data.tour?.galleryImages?.[0] ||
      "/home assets/Khajuraho.webp"
  );
}

async function loadBookingConfirmation(bookingId: string, token: string) {
  if (!bookingId || !token) {
    return null;
  }

  try {
    const response = await getBookingConfirmation(bookingId, token);

    return response.data;
  } catch {
    return null;
  }
}

function SummaryTile({
  icon: Icon,
  label,
  tone = "primary",
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  tone?: "green" | "primary";
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-[8px] border border-border bg-white p-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-[7px]",
          tone === "green"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-[12px] font-bold uppercase leading-tight text-secondary/50">
          {label}
        </span>
        <strong className="mt-1 block break-words font-sans text-[14px] font-semibold leading-tight text-secondary">
          {value}
        </strong>
      </span>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-2 last:border-b-0">
      <span className="font-sans text-[13px] font-semibold text-secondary/56">
        {label}
      </span>
      <strong className="max-w-[62%] text-right font-sans text-[13px] font-semibold leading-snug text-secondary">
        {value || "-"}
      </strong>
    </div>
  );
}

function SectionCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_28px_rgba(67,43,27,0.06)]">
      <h2 className="font-heading text-[19px] font-bold leading-tight text-secondary">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function BookingConfirmedRoute({
  params,
  searchParams,
}: BookingConfirmedRouteProps) {
  const { bookingId } = await params;
  const token = getToken((await searchParams).token);
  const data = await loadBookingConfirmation(bookingId, token);

  if (!data) {
    return (
      <main className="min-h-screen bg-background text-secondary">
        <Header />
        <section className="mx-auto flex min-h-[70vh] w-full max-w-[760px] flex-col items-center justify-center px-5 text-center">
          <ShieldCheck className="size-12 text-primary" strokeWidth={1.6} />
          <h1 className="mt-4 font-heading text-[34px] font-bold leading-tight">
            Booking confirmation unavailable
          </h1>
          <p className="mt-3 font-sans text-[15px] font-medium leading-[1.7] text-secondary/68">
            The confirmation link is missing or has expired. Please contact
            support with your payment reference if the amount was debited.
          </p>
          <Link
            href="/tours"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 font-sans text-[14px] font-bold text-white transition-colors hover:bg-accent"
          >
            Back to Tours
          </Link>
        </section>
      </main>
    );
  }

  const { booking } = data;
  const leadGuest = getLeadGuest(booking);
  const bookingReference = getBookingReference(booking.id);
  const tourName = data.tour?.tourName || booking.tourId;
  const departureDate =
    data.departure?.departureDate || booking.pricingSnapshot?.departureDate;
  const returnDate =
    data.departure?.returnDate || booking.pricingSnapshot?.returnDate;
  const heroImage = getHeroImage(data);
  const rooms = booking.pricingSnapshot?.accommodation?.rooms || [];

  return (
    <main className="min-h-screen bg-background text-secondary">
      <Header />

      <section className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-10 lg:px-0">
        <nav className="flex flex-wrap items-center gap-2 font-sans text-[13px] font-semibold text-secondary/52">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <Link href="/tours" className="hover:text-primary">
            Tours
          </Link>
          <span>/</span>
          <span className="text-primary">Booking Confirmed</span>
        </nav>

        <section className="mt-4 overflow-hidden rounded-[8px] border border-primary/15 bg-card shadow-[0_18px_44px_rgba(67,43,27,0.1)]">
          <div className="grid min-h-[230px] md:grid-cols-[0.8fr_1.2fr]">
            <div className="relative min-h-[210px]">
              <Image
                src={heroImage}
                alt={tourName}
                fill
                sizes="(max-width: 768px) 100vw, 430px"
                className="object-cover"
                priority
              />
            </div>
            <div className="relative flex flex-col items-center justify-center overflow-hidden px-5 py-8 text-center">
              <CheckCircle2
                className="size-12 text-emerald-700"
                strokeWidth={1.7}
              />
              <h1 className="mt-3 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[42px]">
                Booking Confirmed
              </h1>
              <p className="mt-2 max-w-[560px] font-sans text-[14px] font-semibold leading-[1.6] text-secondary/68">
                Thank you for booking {tourName}. Your payment was verified and
                your seats are confirmed.
              </p>
              <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-4 py-2 font-sans text-[13px] font-bold text-emerald-700">
                {bookingReference}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[8px] border border-border bg-card p-4 shadow-[0_12px_30px_rgba(67,43,27,0.06)]">
          <h2 className="font-heading text-[20px] font-bold text-secondary">
            Booking Summary
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              icon={ReceiptText}
              label="Booking ID"
              value={bookingReference}
            />
            <SummaryTile
              icon={CalendarDays}
              label="Departure"
              value={formatDate(departureDate)}
            />
            <SummaryTile
              icon={Users}
              label="Travellers"
              value={`${booking.totalGuest} traveller${
                booking.totalGuest === 1 ? "" : "s"
              }`}
            />
            <SummaryTile
              icon={CreditCard}
              label="Payment"
              tone="green"
              value={`${formatCurrency(booking.amountPaid)} paid`}
            />
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <SectionCard title="Lead Traveller Details">
            <DetailLine
              label="Name"
              value={
                leadGuest
                  ? `${leadGuest.title} ${leadGuest.firstName} ${leadGuest.lastName}`
                  : "-"
              }
            />
            <DetailLine label="Email" value={leadGuest?.email || "-"} />
            <DetailLine
              label="Phone"
              value={
                leadGuest
                  ? `${leadGuest.countryCode} ${leadGuest.mobileNumber}`
                  : "-"
              }
            />
            <DetailLine label="Tour" value={tourName} />
            <DetailLine label="Return Date" value={formatDate(returnDate)} />
          </SectionCard>

          <SectionCard title="Payment Details">
            <DetailLine
              label="Payment Status"
              value={booking.paymentStatus === "paid" ? "Confirmed" : "Pending"}
            />
            <DetailLine
              label="Razorpay Payment ID"
              value={booking.paymentId || "-"}
            />
            <DetailLine label="Subtotal" value={formatCurrency(booking.subtotal)} />
            <DetailLine label="GST" value={formatCurrency(booking.gstAmount)} />
            <DetailLine
              label="Grand Total"
              value={formatCurrency(booking.grandTotal)}
            />
            <DetailLine
              label="Balance Due"
              value={`${formatCurrency(booking.balanceAmount)} by ${formatDate(
                booking.balanceDueDate
              )}`}
            />
          </SectionCard>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="Accommodation & Traveller Allocation">
            {rooms.length > 0 ? (
              <div className="grid gap-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-[8px] border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        <strong className="block font-sans text-[14px] font-bold text-secondary">
                          {room.title}
                        </strong>
                        <span className="mt-1 block font-sans text-[13px] font-semibold text-secondary/58">
                          {room.bedSummary}
                        </span>
                      </span>
                      <BedDouble className="size-4 shrink-0 text-primary" />
                    </div>
                    <div className="mt-3 grid gap-2">
                      {(room.allocations || []).map((allocation) => (
                        <div
                          key={`${room.id}-${allocation.label}`}
                          className="flex items-center justify-between gap-3 rounded-[6px] bg-white px-3 py-2 font-sans text-[13px] font-semibold"
                        >
                          <span className="text-secondary/68">
                            {allocation.label}
                          </span>
                          <span className="text-secondary">
                            {formatCurrency(allocation.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-sans text-[14px] font-medium text-secondary/64">
                Accommodation details will be shared by the Ancient Trails team.
              </p>
            )}
          </SectionCard>

          <div className="grid gap-5">
            <SectionCard title="What Happens Next">
              <div className="grid gap-3">
                {[
                  {
                    icon: Mail,
                    title: "Confirmation Email",
                    text: "Your booking details and payment reference are saved.",
                  },
                  {
                    icon: FileText,
                    title: "Invoice & Receipt",
                    text: "The team will share tax invoice and travel paperwork.",
                  },
                  {
                    icon: CalendarCheck,
                    title: "Balance Reminder",
                    text: "Balance payment reminders follow the tour schedule.",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex gap-3 rounded-[8px] border border-border bg-background p-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[7px] bg-primary/10 text-primary">
                        <Icon className="size-4" strokeWidth={1.8} />
                      </span>
                      <span>
                        <strong className="block font-sans text-[13px] font-bold text-secondary">
                          {item.title}
                        </strong>
                        <span className="mt-1 block font-sans text-[12px] font-semibold leading-[1.45] text-secondary/58">
                          {item.text}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Need Help?">
              {data.expert ? (
                <div className="mb-3 flex items-center gap-3 rounded-[8px] bg-background p-3">
                  <div className="relative size-14 overflow-hidden rounded-[8px] bg-muted">
                    {data.expert.image ? (
                      <Image
                        src={getHomeMediaUrl(data.expert.image)}
                        alt={data.expert.fullName}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <UserRound className="m-4 size-6 text-primary" />
                    )}
                  </div>
                  <span className="min-w-0">
                    <strong className="block font-sans text-[14px] font-bold text-secondary">
                      {data.expert.fullName}
                    </strong>
                    <span className="mt-1 block font-sans text-[12px] font-semibold text-secondary/58">
                      {data.expert.expertiseTags.slice(0, 2).join(" | ") ||
                        "Tour Expert"}
                    </span>
                  </span>
                </div>
              ) : null}
              <DetailLine label="Call" value="011-43033003 | 43131313" />
              <DetailLine label="Email" value="Holidays@ancient.com" />
              <DetailLine
                label="Confirmed On"
                value={formatDate(booking.paymentCapturedAt || booking.createdAt)}
              />
            </SectionCard>
          </div>
        </section>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-primary/15 bg-primary/5 px-4 py-3 font-sans">
          <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold text-secondary/68">
            <Clock3 className="size-4 shrink-0 text-primary" />
            Please keep this confirmation ID for future communication.
          </span>
          <Link
            href="/me/bookings"
            className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[13px] font-bold text-white transition-colors hover:bg-accent"
          >
            View My Bookings
          </Link>
        </section>
      </section>
    </main>
  );
}
