import type { Metadata } from "next";

import { DashboardBookingsOverview } from "@/components/user-dashboard/dashboard-bookings-overview";
import { DashboardContinueExploring } from "@/components/user-dashboard/dashboard-continue-exploring";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export default function MePage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen overflow-x-clip bg-background text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1380px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
            <DashboardBookingsOverview />

            <div className="mt-4 sm:mt-6">
              <DashboardContinueExploring />
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}
