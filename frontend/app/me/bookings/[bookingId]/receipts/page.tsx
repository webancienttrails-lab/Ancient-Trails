import type { Metadata } from "next";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";
import { UserPaymentReceiptsPage } from "@/components/user-dashboard/user-payment-receipts-page";

export const metadata: Metadata = { title: "Payment Receipts" };

export default async function PaymentReceiptsRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <main id="main-content" tabIndex={-1} className="min-h-screen overflow-x-hidden bg-background text-secondary lg:overflow-x-visible">
    <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
      <UserSidebar activeLabel="My Bookings" />
      <section className="min-w-0"><DashboardTopBar /><div className="mx-auto w-full max-w-[1230px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8"><UserPaymentReceiptsPage bookingId={bookingId} /></div></section>
    </div>
  </main>;
}
