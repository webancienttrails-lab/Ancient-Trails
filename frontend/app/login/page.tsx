import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bookmark,
  CalendarCheck,
  Phone,
  Quote,
  Send,
  ShieldCheck,
} from "lucide-react";

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

function GoogleMark() {
  return (
    <span className="relative grid size-5 shrink-0 place-items-center rounded-full bg-white font-sans text-[15px] font-bold leading-none">
      <span className="text-[#4285f4]">G</span>
    </span>
  );
}

export default function LoginPage() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f4eee6] text-secondary">
      <section className="relative h-full overflow-hidden">
        <Image
          src="/home assets/Caves.webp"
          alt="Heritage caves and landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-x-0 bottom-0 h-[56%] bg-[linear-gradient(180deg,rgba(16,11,8,0)_0%,rgba(16,11,8,0.66)_100%)]" />
        <div className="absolute right-0 top-1/2 h-full w-[46vw] -translate-y-1/2 bg-[radial-gradient(ellipse_88%_92%_at_82%_50%,rgba(255,255,255,1)_0%,rgba(255,255,255,0.98)_50%,rgba(255,255,255,0.82)_68%,rgba(255,255,255,0.36)_84%,rgba(255,255,255,0)_100%)]" />
        


        <div className="absolute left-0 right-0 top-[clamp(0.75rem,3vh,2rem)] z-30 mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <Header />
        </div>

        <div className="relative z-10 mx-auto grid h-full w-full max-w-[1300px] items-center gap-7 px-5 pb-[clamp(0.75rem,2vh,1.5rem)] pt-[clamp(6.25rem,14vh,8rem)] sm:px-8 lg:grid-cols-[1fr_560px] lg:px-12">
          <section className="flex min-h-0 flex-col justify-center gap-[clamp(1.1rem,3vh,2.25rem)]">
            <div className="max-w-[390px]">
              <h1 className="font-heading text-[clamp(2.35rem,4.5vw,3.8rem)] font-bold leading-[0.96] text-secondary">
                Your Journey
                <span className="block text-primary">Starts Here</span>
              </h1>
             
              <p className="mt-[clamp(0.75rem,2vh,1.25rem)] max-w-[345px] font-sans text-[clamp(0.88rem,1.2vw,1rem)] leading-[1.55]  mb-2 text-black">
                Sign in to your account and explore amazing destinations,
                personalized itineraries and exclusive offers.
              </p>
            </div>

            <div>
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
            <div className="w-full max-w-[560px] rounded-[13px] border border-white/85 bg-white/96 px-[clamp(1.5rem,3.5vw,3rem)] py-[clamp(1.4rem,3.5vh,2.5rem)] shadow-[0_26px_70px_rgba(50,50,50,0.16)] backdrop-blur-md">
              <div className="grid grid-cols-2 border-b border-border text-center font-sans text-[16px] font-bold">
                <button
                  type="button"
                  className="border-b-2 border-primary pb-[clamp(0.65rem,1.6vh,1rem)] text-primary"
                >
                  Login
                </button>
                <button
                  type="button"
                  className="pb-[clamp(0.65rem,1.6vh,1rem)] text-secondary/62 transition-colors hover:text-primary"
                >
                  Sign Up
                </button>
              </div>

              <div className="mt-[clamp(1.25rem,3vh,2.25rem)] text-center">
                <h2 className="font-heading text-[clamp(1.55rem,3vh,1.9rem)] font-bold leading-none text-secondary">
                  Welcome Back!
                </h2>
                <p className="mt-[clamp(0.55rem,1.5vh,1rem)] font-sans text-[14px] text-secondary/62">
                  Login to continue your journey with us
                </p>
              </div>

              <form className="mt-[clamp(1.25rem,3vh,2.25rem)] space-y-[clamp(1rem,2.5vh,1.75rem)]">
                <label className="block">
                  <span className="font-sans text-[13px] font-bold text-secondary">
                    Phone Number
                  </span>
                  <span className="mt-3 flex h-[clamp(3rem,6vh,3.625rem)] items-center gap-4 rounded-[7px] border border-border bg-white px-5 text-secondary/48 shadow-[0_8px_18px_rgba(50,50,50,0.03)] transition-colors focus-within:border-primary">
                    <Phone className="size-5" strokeWidth={1.8} />
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Enter your phone number"
                      className="h-full min-w-0 flex-1 bg-transparent font-sans text-[14px] text-secondary outline-none placeholder:text-secondary/42"
                    />
                  </span>
                </label>

                <button
                  type="submit"
                  className="flex h-[clamp(3rem,5.8vh,3.5rem)] w-full items-center justify-center gap-3 rounded-[7px] bg-[#d84b00] font-sans text-[15px] font-bold text-white shadow-[0_16px_28px_rgba(216,75,0,0.22)] transition-colors hover:bg-primary"
                >
                  <Send className="size-4" strokeWidth={2.2} />
                  Send OTP
                </button>
              </form>

              <div className="my-[clamp(1rem,2.5vh,1.75rem)] grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <span className="h-px bg-border" />
                <span className="font-sans text-[13px] text-secondary/55">
                  or continue with
                </span>
                <span className="h-px bg-border" />
              </div>

              <button
                type="button"
                className="flex h-[clamp(2.75rem,5vh,3rem)] w-full items-center justify-center gap-3 rounded-[7px] border border-border bg-white font-sans text-[14px] font-semibold text-secondary shadow-[0_8px_18px_rgba(50,50,50,0.03)] transition-colors hover:border-primary hover:text-primary"
              >
                <GoogleMark />
                Continue with Google
              </button>

              <div className="mt-[clamp(1.4rem,3.5vh,2.75rem)] flex flex-wrap items-center justify-center gap-2 font-sans text-[14px] font-semibold text-secondary/72">
                New here?
                <a href="#" className="text-primary hover:text-accent">
                  Sign up
                </a>
                <span>and start exploring!</span>
                <ArrowRight className="size-4 text-primary" strokeWidth={2} />
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
