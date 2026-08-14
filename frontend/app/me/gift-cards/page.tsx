import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CreditCard,
  Gift,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";

import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { DashboardTopBar } from "@/components/user-dashboard/dashboard-top-bar";
import { UserSidebar } from "@/components/user-dashboard/user-sidebar";

export const metadata: Metadata = {
  title: "Gift Cards",
};

const giftBenefits = [
  {
    title: "Perfect for Any Occasion",
    text: "Ideal for birthdays, anniversaries, festivals and special moments.",
    icon: Gift,
  },
  {
    title: "Flexible & Easy to Use",
    text: "Recipients can use the gift card for any tour or experience.",
    icon: CreditCard,
  },
  {
    title: "Instant Delivery",
    text: "Digital gift cards delivered instantly via email.",
    icon: Mail,
  },
  {
    title: "Memorable Experiences",
    text: "Gift unforgettable travel experiences with Ancient Trails.",
    icon: MapPin,
  },
];

function BenefitCard({ benefit }: { benefit: (typeof giftBenefits)[number] }) {
  const Icon = benefit.icon;

  return (
    <article className="grid grid-cols-[46px_minmax(0,1fr)] gap-4">
      <span className="grid size-11 place-items-center rounded-full bg-primary/12 text-primary">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <h3 className="font-heading text-[16px] font-bold leading-tight text-secondary">
          {benefit.title}
        </h3>
        <p className="mt-2 font-sans text-[12px] leading-[1.45] text-secondary/70">
          {benefit.text}
        </p>
      </div>
    </article>
  );
}

function GiftCardArtwork() {
  return (
    <div className="relative mx-auto h-[150px] w-[280px] max-w-full">
      <div className="absolute left-1/2 top-0 h-[92px] w-[150px] -translate-x-1/2 rounded-[12px] border border-border bg-primary/5 shadow-[0_18px_40px_rgba(50,50,50,0.1)]">
        <span className="absolute -top-5 left-1/2 h-8 w-16 -translate-x-1/2 rounded-t-[14px] border-4 border-border border-b-0" />
      </div>
      <div className="absolute bottom-3 left-1/2 h-[92px] w-[205px] -translate-x-1/2 overflow-hidden rounded-[8px] bg-primary shadow-[0_18px_40px_rgba(212,114,32,0.28)]">
        <Image
          src="/home assets/About_trails.webp"
          alt=""
          fill
          sizes="205px"
          className="object-cover opacity-30 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(155,59,19,0.32))]" />
        <Gift className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white" strokeWidth={1.6} />
      </div>
      <Sparkles className="absolute right-6 top-5 size-5 text-primary/55" strokeWidth={1.7} />
      <Sparkles className="absolute left-8 top-10 size-4 text-primary/45" strokeWidth={1.7} />
    </div>
  );
}

export default function GiftCardsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff8f0] text-secondary lg:overflow-x-visible">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <UserSidebar activeLabel="Gift Cards" />

        <section className="min-w-0">
          <DashboardTopBar />

          <div className="mx-auto w-full max-w-[1220px] px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <section className="relative overflow-hidden pb-5 sm:pb-8">
              <Image
                src="/home assets/About_trails.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                priority
                className="pointer-events-none object-cover object-right-top opacity-[0.22] mix-blend-multiply"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff8f0_0%,#fff8f0_46%,rgba(255,248,240,0.78)_68%,rgba(255,248,240,0.58)_100%)]" />
              <div className="relative">
                <h1 className="font-heading text-[30px] font-bold leading-none text-secondary sm:text-[34px]">
                  Gift Cards
                </h1>
                <p className="mt-3 font-sans text-[13px] font-medium text-secondary/70">
                  You don&apos;t have any gift cards linked to your account yet.
                </p>
              </div>
            </section>

            <section className="rounded-[8px] border border-border bg-white px-4 py-8 text-center shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:px-8 sm:py-12 lg:py-16">
              <GiftCardArtwork />
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-tight text-secondary">
                No Gift Cards Yet!
              </h2>
              <p className="mx-auto mt-3 max-w-[580px] font-sans text-[13px] leading-[1.55] text-secondary/72">
                You do not have any gift cards linked to your account at the moment.
                Explore our gift cards and surprise your loved ones.
              </p>
              <Link
                href="/me/gift-cards"
                className={buttonVariants({
                  className: "mt-7 w-full justify-between gap-4 px-6 font-normal sm:w-auto sm:min-w-[205px]",
                })}
              >
                Explore Gift Cards
                <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
              </Link>
            </section>

            <section className="mt-4 rounded-[8px] border border-border bg-white p-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-6 sm:p-6">
              <h2 className="font-heading text-[20px] font-bold text-secondary">
                Why Gift Cards?
              </h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {giftBenefits.map((benefit) => (
                  <BenefitCard key={benefit.title} benefit={benefit} />
                ))}
              </div>
            </section>

            <section className="relative mt-4 overflow-hidden rounded-[8px] border border-border bg-white p-4 shadow-[0_14px_34px_rgba(50,50,50,0.035)] sm:mt-6 sm:p-6">
              <Image
                src="/home assets/Heritage Banner.webp"
                alt=""
                fill
                sizes="(min-width: 1024px) 480px, 100vw"
                className="pointer-events-none object-cover object-right opacity-[0.12] mix-blend-multiply"
              />
              <div className="relative grid gap-5 md:grid-cols-[200px_minmax(0,1fr)_auto] md:items-center">
                <div className="relative h-[110px] overflow-hidden rounded-[7px] bg-muted">
                  <Image
                    src="/home assets/destination/Udaipur.webp"
                    alt="Travel gift preview"
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-heading text-[21px] font-bold leading-tight text-secondary">
                    Give the Gift of Travel
                  </h2>
                  <p className="mt-2 max-w-[590px] font-sans text-[13px] leading-[1.55] text-secondary/72">
                    From historic trails to breathtaking landscapes, our gift cards open
                    the door to unforgettable journeys.
                  </p>
                </div>
                <Link
                  href="/me/gift-cards"
                  className={buttonVariants({
                    className: "w-full justify-between gap-4 px-6 font-normal md:w-[190px]",
                  })}
                >
                  Buy Gift Card
                  <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                </Link>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
