import Image from "next/image";
import type { Metadata } from "next";

import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserBookingsSection } from "@/components/user-dashboard/user-bookings-section";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";

export const metadata: Metadata = {
  title: "My Bookings",
};

export default function MyBookingsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="My Bookings" />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1230px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
            <section className="relative overflow-hidden rounded-[8px] bg-white px-2 py-3  sm:px-5 sm:py-5 lg:min-h-[98px]">
              <div className="relative">
                <h1 className="font-heading text-[26px] font-bold leading-none text-secondary sm:text-[34px]">
                  My Bookings
                </h1>
                <p className="mt-3 font-sans text-[12px] font-medium text-secondary/75 sm:text-[13px]">
                  View and manage all your bookings in one place.
                </p>
              </div>
            </section>

            <UserBookingsSection />
          </div>
        </section>
      </div>
    </main>
  );
}
