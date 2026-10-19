import type { Metadata } from "next";
import { BookingResultPage, type BookingResultRouteProps } from "@/components/booking-result-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking Confirmed",
  description: "Your Ancient Trails booking confirmation details.",
};

export default function BookingConfirmedRoute(props: BookingResultRouteProps) {
  return <BookingResultPage {...props} />;
}
