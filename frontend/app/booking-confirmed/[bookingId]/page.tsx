import type { Metadata } from "next";
import { BookingResultPage, type BookingResultRouteProps } from "@/components/booking-result-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  title: "Booking Confirmed",
  description: "Your Ancient Trails booking confirmation details.",
};

export default async function BookingConfirmedRoute(props: BookingResultRouteProps) {
  const { bookingId } = await props.params;
  return <BookingResultPage bookingId={bookingId} />;
}
