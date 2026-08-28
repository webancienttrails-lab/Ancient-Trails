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
            <section className="relative overflow-hidden rounded-[8px] border border-border bg-white px-4 py-5 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:px-7 sm:py-7 lg:min-h-[128px]">
              <Image
                src="/home assets/About_trails.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 760px, 100vw"
                priority
                className="pointer-events-none object-cover object-[55%_50%] opacity-[0.23] mix-blend-multiply"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,#ffffff_38%,rgba(255,255,255,0.78)_64%,rgba(255,255,255,0.48)_100%)]" />
              <div className="relative">
                <h1 className="font-heading text-[26px] font-bold leading-none text-secondary sm:text-[30px]">
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
