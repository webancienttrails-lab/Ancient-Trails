import Image from "next/image";
import type { Metadata } from "next";
import {
  Bookmark,
  CalendarCheck,
  Quote,
  ShieldCheck,
} from "lucide-react";

import { TravellerLoginCard } from "@/components/auth/traveller-login-card";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Login",
};

const journeyHighlights = [
  {
    title: "Save Your Favorites",
    description: "Bookmark tours and places you love.",
    icon: Bookmark,
  },
  {
    title: "Easy Bookings",
    description: "Quick and secure bookings in just a few clicks.",
    icon: CalendarCheck,
  },
  {
    title: "Secure & Trusted",
    description: "Your data is safe with us.",
    icon: ShieldCheck,
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fff8f0] text-secondary lg:h-[100dvh] lg:overflow-hidden">
      <section className="relative min-h-[100dvh] overflow-hidden lg:h-full">
        <Image
          src="/home assets/Caves.webp"
          alt="Heritage caves and landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,11,8,0.45)_0%,rgba(16,11,8,0.72)_48%,rgba(16,11,8,0.86)_100%)] lg:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-[56%] bg-[linear-gradient(180deg,rgba(16,11,8,0)_0%,rgba(16,11,8,0.66)_100%)]" />
        <div className="absolute right-0 top-1/2 hidden h-full w-[46vw] -translate-y-1/2 bg-[radial-gradient(ellipse_88%_92%_at_82%_50%,rgba(255,255,255,1)_0%,rgba(255,255,255,0.98)_50%,rgba(255,255,255,0.82)_68%,rgba(255,255,255,0.36)_84%,rgba(255,255,255,0)_100%)] lg:block" />
        


        <div className="absolute inset-x-0 top-0 z-[2147483647] mx-auto w-full max-w-[1300px] px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
          <Header />
        </div>

        <div className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1300px] items-start gap-5 px-4 pb-6 pt-[5.75rem] sm:px-8 sm:pb-8 sm:pt-[6.5rem] lg:h-full lg:grid-cols-[1fr_560px] lg:items-center lg:gap-7 lg:px-12 lg:pb-[clamp(0.75rem,2vh,1.5rem)] lg:pt-[clamp(6.25rem,14vh,8rem)]">
          <section className="flex min-h-0 flex-col justify-center gap-4 lg:gap-[clamp(1.1rem,3vh,2.25rem)]">
            <div className="max-w-[390px]">
              <h1 className="font-heading text-[2.1rem] font-bold leading-[0.98] text-white sm:text-[2.45rem] lg:text-[clamp(2.35rem,4.5vw,3.8rem)] lg:text-secondary">
                Your Journey
                <span className="block text-primary">Starts Here</span>
              </h1>
             
              <p className="mb-1 mt-3 max-w-[345px] font-sans text-[0.9rem] leading-[1.55] text-white/90 sm:text-[clamp(0.88rem,1.2vw,1rem)] lg:mb-2 lg:mt-[clamp(0.75rem,2vh,1.25rem)] lg:text-secondary">
                Sign in to your account and explore amazing destinations,
                personalized itineraries and exclusive offers.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="space-y-[clamp(0.75rem,1.8vh,1.15rem)]">
                {journeyHighlights.map(({ title, description, icon: Icon }) => (
                  <div key={title} className="flex max-w-[360px] items-start gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white/16 text-white ring-1 ring-white/25 backdrop-blur">
                      <Icon className="size-5" strokeWidth={1.9} />
                    </span>
                    <span>
                      <span className="block font-sans text-[14px] font-bold text-white">
                        {title}
                      </span>
                      <span className="mt-1 block font-sans text-[11px] leading-[1.35] text-white/88">
                        {description}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-[clamp(0.9rem,2.4vh,1.5rem)] max-w-[430px] rounded-[8px] border border-white/14 bg-white/12 p-[clamp(0.9rem,2vh,1.25rem)] text-white shadow-[0_22px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/16">
                    <Quote className="size-4 fill-current" strokeWidth={0} />
                  </span>
                  <p className="font-sans text-[12px] leading-[1.55] text-white/92">
                    The best journeys in life are the ones that answer
                    questions you never thought to ask.
                    <span className="mt-2 block">- Unknown</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end">
            <TravellerLoginCard />
          </section>
        </div>
      </section>
    </main>
  );
}
