import Image from "next/image";
import type { Metadata } from "next";

import { AdminLoginCard } from "@/components/auth/admin-login-card";

export const metadata: Metadata = {
  title: "Admin Login",
};

export default function AdminLoginPage() {
  return (
    <main className="fixed inset-0 h-[100dvh] overflow-hidden bg-[#f4eadb] text-[#4d382b]">
      <Image
        src="/admin-login/heritage-login-bg.png"
        alt="Ancient temple courtyard at sunrise"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(250,239,220,0.7)_0%,rgba(250,239,220,0.42)_42%,rgba(250,239,220,0.78)_100%)] lg:bg-[linear-gradient(90deg,rgba(250,239,220,0.14)_0%,rgba(250,239,220,0.18)_42%,rgba(250,239,220,0.62)_100%)]" />

      <section className="relative z-10 mx-auto grid h-full w-full max-w-[1050px] items-center px-4 py-2 sm:px-5 sm:py-4 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-8 lg:px-8 lg:py-0">
        <div className="hidden h-full items-center justify-center lg:flex">
          <div className="w-full max-w-[440px] text-center">
            <Image
              src="/brand/header-logo.png"
              alt="Ancient Trails"
              width={220}
              height={74}
              priority
              className="mx-auto h-auto w-[220px]"
            />
            <div className="mt-2 flex items-center justify-center gap-3 text-[13px] font-bold uppercase tracking-[0.34em] text-[#bf5c21]">
              <span className="h-px w-8 bg-[#d7a171]" />
              Admin Panel
              <span className="h-px w-8 bg-[#d7a171]" />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-[#c7783d]">
              <span className="h-px w-28 bg-[#e6cfb9]" />
              <span className="size-1.5 rotate-45 border border-[#c7783d]" />
              <span className="h-px w-28 bg-[#e6cfb9]" />
            </div>

            <h2 className="mt-6 font-heading text-[33px] font-bold leading-[1.08] tracking-normal text-[#4a3328]">
              Manage journeys.
              <span className="block">Inspire explorers.</span>
              <span className="block text-[#b9551f]">Preserve heritage.</span>
            </h2>

            <div className="mt-5 flex items-center justify-center gap-2 text-[#c7783d]">
              <span className="h-px w-24 bg-[#e6cfb9]" />
              <span className="size-1.5 rotate-45 border border-[#c7783d]" />
              <span className="h-px w-24 bg-[#e6cfb9]" />
            </div>
            <p className="mx-auto mt-4 max-w-[300px] text-[13px] font-medium leading-5 text-[#715a4f]">
              Secure access to the Ancient Trails operations dashboard.
            </p>
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center lg:justify-end">
          <AdminLoginCard />
        </div>
      </section>
    </main>
  );
}
