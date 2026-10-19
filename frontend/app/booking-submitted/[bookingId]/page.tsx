import type { Metadata } from "next";
import { BookingResultPage, type BookingResultRouteProps } from "@/components/booking-result-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking Form Submitted Successfully",
  description: "Your Ancient Trails offline booking request and payment details.",
  robots: { index: false, follow: false },
};

export default function BookingSubmittedRoute(props: BookingResultRouteProps) {
  return <BookingResultPage {...props} variant="submission" />;
}
