"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Eye,
  Globe2,
  Headphones,
  MapPin,
  Mountain,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import {
  fallbackAboutContent,
  getAboutMediaUrl,
  getAboutPageContent,
  type AboutPageContent as AboutPageContentType,
  type AboutStatIcon,
} from "@/lib/about";
import { cn } from "@/lib/utils";

const statIconMap: Record<AboutStatIcon, LucideIcon> = {
  BookOpen,
  CalendarDays,
  Globe2,
  MapPin,
  Users,
};

const valueItems = [
  {
    title: "Expertly Researched",
    description:
      "Our itineraries are deeply researched and curated by heritage experts.",
    icon: BookOpen,
  },
  {
    title: "Local Connections",
    description:
      "We work with local guides, artisans and communities to offer authentic experiences.",
    icon: Users,
  },
  {
    title: "Responsible Travel",
    description:
      "We promote sustainable tourism that respects culture, traditions and the environment.",
    icon: BadgeCheck,
  },
  {
    title: "Personalised Support",
    description:
      "From planning to the journey, we are with you every step of the way.",
    icon: Headphones,
  },
];

function getSortedStats(content: AboutPageContentType) {
  return [...content.stats].sort((left, right) => left.sortOrder - right.sortOrder);
}

function getSortedTeam(content: AboutPageContentType) {
  return [...content.teamMembers].sort(
    (left, right) => left.sortOrder - right.sortOrder
  );
}

export function AboutPageContent() {
  const [content, setContent] =
    useState<AboutPageContentType>(fallbackAboutContent);

  useEffect(() => {
    let isMounted = true;

    async function loadAboutContent() {
      try {
        const response = await getAboutPageContent();

        if (isMounted) {
          setContent(response.data.about);
        }
      } catch {
        if (isMounted) {
          setContent(fallbackAboutContent);
        }
      }
    }

    loadAboutContent();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => getSortedStats(content), [content]);
  const teamMembers = useMemo(() => getSortedTeam(content), [content]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff8f0] text-secondary">
      <HeroSection />
      <StatsSection stats={stats} />
      <MissionVisionSection />
      <ValuesSection />
      <TeamSection teamMembers={teamMembers} />
      <QuoteSection />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[640px] overflow-hidden bg-[#fff8f0] sm:min-h-[690px] lg:min-h-[720px]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Indian heritage fort at sunrise"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,245,0.96)_0%,rgba(255,250,245,0.88)_32%,rgba(255,250,245,0.35)_62%,rgba(255,250,245,0)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,rgba(255,250,245,0)_0%,#fffaf5_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[640px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:min-h-[690px] sm:px-0 lg:min-h-[720px]">
        <Header />

        <div className="flex flex-1 items-center px-0 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="max-w-[430px]">
            <p className="font-sans text-[13px] font-bold uppercase tracking-normal text-primary">
              About Ancient Trails
            </p>
            <h1 className="mt-4 font-heading text-[44px] font-bold leading-[0.98] tracking-normal text-secondary sm:text-[62px] lg:text-[72px]">
              Our Story.
              <span className="block">
                Our Passion<span className="text-primary">.</span>
              </span>
            </h1>
            <span className="mt-6 block h-0.5 w-14 bg-primary" />
            <p className="mt-6 max-w-[395px] font-sans text-[14px] leading-[1.75] text-secondary/78 sm:text-[15px]">
              Ancient Trails was born out of a deep love for India&apos;s
              heritage and a desire to share its timeless stories with the
              world. We curate immersive journeys that go beyond sightseeing,
              connecting you with culture, people and histories that inspire.
            </p>
            <Link
              href="/#upcoming-tours"
              className="mt-8 inline-flex h-12 items-center gap-4 rounded-full bg-primary px-6 font-sans text-[13px] font-bold text-white shadow-[0_14px_30px_rgba(212,114,32,0.28)] transition-colors hover:bg-accent"
            >
              Explore Our Tours
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection({
  stats,
}: {
  stats: AboutPageContentType["stats"];
}) {
  return (
    <section className="relative z-20 mx-auto -mt-24 w-full max-w-[1220px] px-5 sm:px-8 lg:px-0">
      <div className="grid overflow-hidden rounded-[8px] border border-[#ead8c5] bg-white/94 shadow-[0_22px_65px_rgba(50,50,50,0.12)] backdrop-blur md:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = statIconMap[stat.icon] || BookOpen;

          return (
            <article
              key={stat.id || `${stat.label}-${index}`}
              className={cn(
                "flex min-h-[120px] flex-col items-center justify-center px-4 py-6 text-center",
                index > 0 && "border-t border-[#e9dbcf] md:border-l md:border-t-0"
              )}
            >
              <Icon className="size-8 text-primary" strokeWidth={1.7} />
              <strong className="mt-4 font-heading text-[26px] leading-none text-secondary sm:text-[32px]">
                {stat.value}
              </strong>
              <span className="mt-2 font-sans text-[12px] font-medium text-secondary/76 sm:text-[13px]">
                {stat.label}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MissionVisionSection() {
  return (
    <section className="relative -mt-16 overflow-hidden bg-secondary pb-16 pt-36 text-white sm:pt-40">
      <Image
        src="/home assets/Caves.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-[0.46]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,16,13,0.92)_0%,rgba(20,16,13,0.72)_48%,rgba(20,16,13,0.84)_100%)]" />

      <div className="relative mx-auto grid w-full max-w-[1220px] gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-0 lg:px-0">
        <StoryBlock
          eyebrow="Our Mission"
          icon={Mountain}
          title="Inspire Meaningful Journeys"
          description="To inspire meaningful journeys that promote cultural understanding, preserve heritage and empower local communities."
        />
        <StoryBlock
          className="lg:border-l lg:border-white/50 lg:pl-20"
          eyebrow="Our Vision"
          icon={Eye}
          title="Heritage for Generations"
          description="To be India's most trusted heritage travel brand, connecting the past with the present for generations to come."
        />
      </div>
    </section>
  );
}

function StoryBlock({
  className,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  className?: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <article className={cn("max-w-[470px]", className)}>
      <Icon className="size-12 text-primary" strokeWidth={1.45} />
      <p className="mt-4 font-sans text-[11px] font-bold uppercase text-white">
        {eyebrow}
      </p>
      <h2 className="mt-4 font-heading text-[28px] font-bold leading-tight tracking-normal text-white sm:text-[34px]">
        {title}
      </h2>
      <span className="mt-4 block h-0.5 w-11 bg-primary" />
      <p className="mt-4 max-w-[390px] font-sans text-[14px] leading-[1.7] text-white/82">
        {description}
      </p>
    </article>
  );
}

function ValuesSection() {
  return (
    <section className="relative overflow-hidden bg-[#fff8f0] py-16 sm:py-20">
      <Image
        src="/home assets/About_trails.webp"
        alt=""
        fill
        sizes="100vw"
        className="pointer-events-none object-cover object-left-bottom opacity-40"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,245,0.96)_0%,rgba(255,250,245,0.82)_44%,rgba(255,250,245,0.96)_100%)]" />

      <div className="relative mx-auto grid w-full max-w-[1220px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-0">
        <div>
          <p className="font-sans text-[12px] font-bold uppercase tracking-normal text-primary">
            What makes us different?
          </p>
          <h2 className="mt-4 max-w-[390px] font-heading text-[34px] font-bold leading-[1.04] tracking-normal text-secondary sm:text-[42px]">
            Thoughtfully Crafted.
            <span className="block">
              Authentically Local<span className="text-primary">.</span>
            </span>
          </h2>
          <span className="mt-7 block h-0.5 w-14 bg-primary" />
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {valueItems.map(({ description, icon: Icon, title }) => (
            <article key={title} className="grid grid-cols-[64px_minmax(0,1fr)] gap-5">
              <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-7" strokeWidth={1.6} />
              </span>
              <span>
                <span className="block font-sans text-[15px] font-bold text-secondary">
                  {title}
                </span>
                <span className="mt-2 block font-sans text-[13px] leading-[1.65] text-secondary/72">
                  {description}
                </span>
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamSection({
  teamMembers,
}: {
  teamMembers: AboutPageContentType["teamMembers"];
}) {
  return (
    <section className="bg-[#fff8f0] py-16 sm:py-20">
      <div className="mx-auto grid w-full max-w-[1220px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.5fr] lg:px-0">
        <div>
          <p className="font-sans text-[12px] font-bold uppercase tracking-normal text-primary">
            Our Team
          </p>
          <h2 className="mt-4 max-w-[340px] font-heading text-[34px] font-bold leading-[1.05] tracking-normal text-secondary sm:text-[42px]">
            The Minds Behind the Journeys
          </h2>
          <span className="mt-7 block h-0.5 w-14 bg-primary" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {teamMembers.map((member, index) => {
            const image = member.image.trim();

            return (
              <article
                key={member.id || `${member.name}-${index}`}
                className="overflow-hidden rounded-[8px] bg-white shadow-[0_16px_42px_rgba(50,50,50,0.08)]"
              >
                <div
                  role="img"
                  aria-label={member.name}
                  className="aspect-[1.35/1] bg-[#eadfd6] bg-cover bg-center"
                  style={{
                    backgroundImage: `url("${getAboutMediaUrl(image || "/home assets/Khajuraho.webp")}")`,
                  }}
                />
                <div className="p-4">
                  <h3 className="font-sans text-[15px] font-bold leading-tight text-secondary">
                    {member.name}
                  </h3>
                  <p className="mt-1 font-sans text-[11px] font-semibold text-primary">
                    {member.role}
                  </p>
                  <p className="mt-3 font-sans text-[12px] leading-[1.65] text-secondary/72">
                    {member.bio}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuoteSection() {
  return (
    <section className="relative overflow-hidden bg-[#fff8f0] py-9">
      <Image
        src="/home assets/destination/Destination_bottom.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-40"
      />
      <div className="relative mx-auto flex w-full max-w-[1220px] flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-0">
        <p className="max-w-[560px] font-heading text-[25px] font-semibold leading-tight text-secondary sm:text-[32px]">
          <span className="mr-4 text-[54px] leading-none text-primary">&ldquo;</span>
          We don&apos;t just show you places,
          <span className="block">we help you experience their soul.</span>
        </p>
        <Link
          href="/#upcoming-tours"
          className="inline-flex h-12 w-fit items-center gap-5 rounded-full bg-primary px-7 font-sans text-[13px] font-bold text-white shadow-[0_14px_30px_rgba(212,114,32,0.24)] transition-colors hover:bg-accent"
        >
          Join Us on a Journey
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
