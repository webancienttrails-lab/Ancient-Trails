import type { Metadata } from "next";

import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserBookingDetailPage } from "@/components/user-dashboard/user-booking-detail-page";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";

type BookingDetailRouteProps = {
  params: Promise<{
    bookingId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Booking Details",
};

export default async function BookingDetailRoute({
  params,
}: BookingDetailRouteProps) {
  const { bookingId } = await params;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="My Bookings" />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1230px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
            <UserBookingDetailPage bookingId={bookingId} />
          </div>
        </section>
      </div>
    </main>
  );
}
